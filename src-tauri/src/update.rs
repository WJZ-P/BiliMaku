use crate::types::app::{AppUpdateProgress, AppUpdateStatus};
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT};
use semver::Version;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_opener::OpenerExt;
use tokio::io::AsyncWriteExt;

const LATEST_RELEASE_API: &str = "https://api.github.com/repos/WJZ-P/BiliMaku/releases/latest";
const RELEASES_API: &str = "https://api.github.com/repos/WJZ-P/BiliMaku/releases";
const RELEASES_PAGE: &str = "https://github.com/WJZ-P/BiliMaku/releases";
const LATEST_RELEASE_PAGE: &str = "https://github.com/WJZ-P/BiliMaku/releases/latest";
const GITHUB_ACCELERATOR_PREFIX: &str = "https://gh-proxy.com/";
const CORS_PROXY_PREFIX: &str = "https://corsproxy.io/?";
const UPDATE_PROGRESS_EVENT: &str = "update://progress";
const MAX_RELEASE_RESPONSE_BYTES: usize = 2 * 1024 * 1024;
const MAX_UPDATE_ARCHIVE_BYTES: u64 = 256 * 1024 * 1024;
const MAX_EXTRACTED_BYTES: u128 = 512 * 1024 * 1024;
const MAX_ARCHIVE_ENTRIES: usize = 512;

/// 防止用户连续点击时并发运行多个文件替换任务。
#[derive(Default)]
pub struct AppUpdateRuntimeState {
    installing: AtomicBool,
}

struct InstallGuard<'a> {
    installing: &'a AtomicBool,
}

impl AppUpdateRuntimeState {
    fn try_begin(&self) -> Result<InstallGuard<'_>, String> {
        self.installing
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| "已有更新任务正在运行".to_owned())?;
        Ok(InstallGuard {
            installing: &self.installing,
        })
    }
}

impl Drop for InstallGuard<'_> {
    fn drop(&mut self) {
        self.installing.store(false, Ordering::Release);
    }
}

#[derive(Debug, Clone, Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
    size: u64,
    digest: Option<String>,
    state: String,
}

#[derive(Debug, Clone, Deserialize)]
struct GithubRelease {
    tag_name: String,
    name: Option<String>,
    html_url: String,
    published_at: Option<String>,
    draft: bool,
    prerelease: bool,
    #[serde(default)]
    assets: Vec<GithubAsset>,
}

#[derive(Clone, Copy)]
enum ReleaseResponseKind {
    Single,
    List,
}

struct ReleaseCandidate {
    label: &'static str,
    url: String,
    kind: ReleaseResponseKind,
}

fn parse_release_version(label: &str) -> Result<Version, String> {
    let normalized = label.trim().trim_start_matches(['v', 'V']);
    Version::parse(normalized).map_err(|error| format!("Release 版本号 {label} 无效：{error}"))
}

fn trusted_release_url(value: &str) -> String {
    if value.starts_with("https://github.com/WJZ-P/BiliMaku/releases/") {
        value.to_owned()
    } else {
        RELEASES_PAGE.to_owned()
    }
}

fn trusted_asset_url(value: &str) -> bool {
    value.starts_with("https://github.com/WJZ-P/BiliMaku/releases/download/")
}

fn percent_encode_component(value: &str) -> String {
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut output = String::with_capacity(value.len() * 3);
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            output.push(char::from(byte));
        } else {
            output.push('%');
            output.push(char::from(HEX[(byte >> 4) as usize]));
            output.push(char::from(HEX[(byte & 0x0f) as usize]));
        }
    }
    output
}

fn cors_proxy_url(target: &str) -> String {
    format!("{CORS_PROXY_PREFIX}{}", percent_encode_component(target))
}

fn github_accelerator_url(target: &str) -> String {
    format!("{GITHUB_ACCELERATOR_PREFIX}{target}")
}

fn expected_portable_asset_name(version: &Version) -> Option<String> {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        Some(format!("BiliMaku-v{version}-windows-x64-portable.zip"))
    }
    #[cfg(not(all(target_os = "windows", target_arch = "x86_64")))]
    {
        let _ = version;
        None
    }
}

fn current_installation_supports_in_place_update() -> bool {
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        std::env::current_exe()
            .ok()
            .and_then(|path| path.parent().map(|parent| parent.join("portable.flag")))
            .is_some_and(|marker| marker.is_file())
    }
    #[cfg(not(all(target_os = "windows", target_arch = "x86_64")))]
    {
        false
    }
}

fn normalized_sha256_digest(asset: &GithubAsset) -> Option<String> {
    let value = asset.digest.as_deref()?.trim();
    let digest = value.strip_prefix("sha256:")?;
    if digest.len() == 64 && digest.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        Some(digest.to_ascii_lowercase())
    } else {
        None
    }
}

fn release_asset<'a>(release: &'a GithubRelease, version: &Version) -> Option<&'a GithubAsset> {
    let expected_name = expected_portable_asset_name(version)?;
    release.assets.iter().find(|asset| {
        asset.name == expected_name
            && asset.state == "uploaded"
            && trusted_asset_url(&asset.browser_download_url)
            && normalized_sha256_digest(asset).is_some()
    })
}

fn compare_release(
    current_label: &str,
    release: &GithubRelease,
) -> Result<AppUpdateStatus, String> {
    if release.draft || release.prerelease {
        return Err("GitHub 最新版本不是正式 Release".to_owned());
    }

    let current = parse_release_version(current_label)?;
    let latest = parse_release_version(&release.tag_name)?;
    let asset = release_asset(release, &latest);
    let release_name = release
        .name
        .as_ref()
        .filter(|name| !name.trim().is_empty())
        .cloned()
        .unwrap_or_else(|| release.tag_name.clone());

    Ok(AppUpdateStatus {
        current_version: current.to_string(),
        latest_version: latest.to_string(),
        update_available: latest > current,
        release_url: trusted_release_url(&release.html_url),
        release_name,
        published_at: release.published_at.clone(),
        install_supported: !cfg!(debug_assertions)
            && asset.is_some()
            && current_installation_supports_in_place_update(),
        asset_name: asset.map(|value| value.name.clone()),
    })
}

fn github_client(timeout: Duration) -> Result<reqwest::Client, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("application/vnd.github+json"),
    );
    headers.insert(
        "x-github-api-version",
        HeaderValue::from_static("2022-11-28"),
    );

    reqwest::Client::builder()
        .default_headers(headers)
        .user_agent(format!("BiliMaku/{}", env!("CARGO_PKG_VERSION")))
        .connect_timeout(Duration::from_secs(12))
        .timeout(timeout)
        .build()
        .map_err(|error| format!("创建版本检测客户端失败：{error}"))
}

async fn fetch_release_candidate(
    client: &reqwest::Client,
    candidate: &ReleaseCandidate,
) -> Result<GithubRelease, String> {
    let response = client
        .get(&candidate.url)
        .send()
        .await
        .map_err(|error| format!("{}连接失败：{error}", candidate.label))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("{}返回 HTTP {}", candidate.label, status.as_u16()));
    }

    let body = response
        .bytes()
        .await
        .map_err(|error| format!("{}读取失败：{error}", candidate.label))?;
    if body.len() > MAX_RELEASE_RESPONSE_BYTES {
        return Err(format!("{}响应体积异常", candidate.label));
    }

    match candidate.kind {
        ReleaseResponseKind::Single => serde_json::from_slice::<GithubRelease>(&body)
            .map_err(|error| format!("{}解析失败：{error}", candidate.label)),
        ReleaseResponseKind::List => serde_json::from_slice::<Vec<GithubRelease>>(&body)
            .map_err(|error| format!("{}解析失败：{error}", candidate.label))?
            .into_iter()
            .find(|release| !release.draft && !release.prerelease)
            .ok_or_else(|| format!("{}没有正式 Release", candidate.label)),
    }
}

async fn fetch_latest_release() -> Result<GithubRelease, String> {
    let client = github_client(Duration::from_secs(20))?;
    let candidates = [
        ReleaseCandidate {
            label: "GitHub API",
            url: LATEST_RELEASE_API.to_owned(),
            kind: ReleaseResponseKind::Single,
        },
        ReleaseCandidate {
            label: "GitHub API 国内加速",
            url: github_accelerator_url(LATEST_RELEASE_API),
            kind: ReleaseResponseKind::Single,
        },
        ReleaseCandidate {
            label: "GitHub API CORS 代理",
            url: cors_proxy_url(LATEST_RELEASE_API),
            kind: ReleaseResponseKind::Single,
        },
        ReleaseCandidate {
            label: "GitHub Release 列表加速",
            url: github_accelerator_url(RELEASES_API),
            kind: ReleaseResponseKind::List,
        },
    ];
    let mut errors = Vec::new();

    for candidate in &candidates {
        match fetch_release_candidate(&client, candidate).await {
            Ok(release) => return Ok(release),
            Err(error) => errors.push(error),
        }
    }

    Err(format!("检查更新失败：{}", errors.join("；")))
}

fn emit_progress(
    app: &AppHandle,
    phase: &str,
    percent: Option<u8>,
    downloaded_bytes: u64,
    total_bytes: Option<u64>,
    message: impl Into<String>,
) {
    let _ = app.emit(
        UPDATE_PROGRESS_EVENT,
        AppUpdateProgress {
            phase: phase.to_owned(),
            percent,
            downloaded_bytes,
            total_bytes,
            message: message.into(),
        },
    );
}

fn safe_reset_directory(path: &Path, allowed_root: &Path) -> Result<(), String> {
    if !path.starts_with(allowed_root) || path == allowed_root {
        return Err(format!("更新暂存路径异常：{}", path.display()));
    }
    if path.exists() {
        fs::remove_dir_all(path).map_err(|error| format!("清理更新暂存目录失败：{error}"))?;
    }
    fs::create_dir_all(path).map_err(|error| format!("创建更新暂存目录失败：{error}"))
}

fn ensure_directory_writable(directory: &Path) -> Result<(), String> {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let probe = directory.join(format!(
        ".bilimaku-update-write-test-{}-{nonce}",
        std::process::id()
    ));
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe)
        .map_err(|error| format!("应用目录缺少写入权限：{error}"))?;
    file.write_all(b"bilimaku-update")
        .map_err(|error| format!("应用目录写入测试失败：{error}"))?;
    drop(file);
    fs::remove_file(&probe).map_err(|error| format!("清理写入测试文件失败：{error}"))
}

async fn download_asset_once(
    app: &AppHandle,
    client: &reqwest::Client,
    asset: &GithubAsset,
    url: &str,
    partial_path: &Path,
    expected_digest: &str,
) -> Result<(), String> {
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("连接更新资源失败：{error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("更新资源返回 HTTP {}", status.as_u16()));
    }
    if response
        .content_length()
        .is_some_and(|size| size > MAX_UPDATE_ARCHIVE_BYTES)
    {
        return Err("更新资源超过 256 MiB 限制".to_owned());
    }

    let mut file = tokio::fs::File::create(partial_path)
        .await
        .map_err(|error| format!("创建更新下载文件失败：{error}"))?;
    let mut hasher = Sha256::new();
    let mut downloaded = 0_u64;
    let total = (asset.size > 0).then_some(asset.size);
    emit_progress(
        app,
        "downloading",
        Some(0),
        0,
        total,
        "正在下载免安装更新包",
    );

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("读取更新数据失败：{error}"))?
    {
        downloaded = downloaded
            .checked_add(chunk.len() as u64)
            .ok_or_else(|| "更新资源大小溢出".to_owned())?;
        if downloaded > MAX_UPDATE_ARCHIVE_BYTES {
            return Err("更新资源超过 256 MiB 限制".to_owned());
        }
        file.write_all(&chunk)
            .await
            .map_err(|error| format!("写入更新下载文件失败：{error}"))?;
        hasher.update(&chunk);
        let percent = total.map(|size| {
            (downloaded
                .saturating_mul(100)
                .checked_div(size)
                .unwrap_or_default()
                .min(99)) as u8
        });
        emit_progress(
            app,
            "downloading",
            percent,
            downloaded,
            total,
            "正在下载免安装更新包",
        );
    }

    file.flush()
        .await
        .map_err(|error| format!("刷新更新下载文件失败：{error}"))?;
    file.sync_all()
        .await
        .map_err(|error| format!("同步更新下载文件失败：{error}"))?;
    drop(file);

    if asset.size > 0 && downloaded != asset.size {
        return Err(format!(
            "更新包大小不一致：应为 {} 字节，实际为 {} 字节",
            asset.size, downloaded
        ));
    }
    let actual_digest = format!("{:x}", hasher.finalize());
    if actual_digest != expected_digest {
        return Err("更新包 SHA-256 校验失败".to_owned());
    }

    emit_progress(
        app,
        "verifying",
        Some(100),
        downloaded,
        total,
        "下载完成，SHA-256 校验通过",
    );
    Ok(())
}

async fn download_asset(
    app: &AppHandle,
    asset: &GithubAsset,
    archive_path: &Path,
) -> Result<(), String> {
    if !trusted_asset_url(&asset.browser_download_url) {
        return Err("Release 资源地址不属于 BiliMaku GitHub 仓库".to_owned());
    }
    if asset.size == 0 || asset.size > MAX_UPDATE_ARCHIVE_BYTES {
        return Err(format!("Release 资源大小异常：{} 字节", asset.size));
    }
    let expected_digest = normalized_sha256_digest(asset)
        .ok_or_else(|| "Release 资源缺少有效的 SHA-256 digest".to_owned())?;
    let partial_path = archive_path.with_extension("zip.partial");
    let urls = [
        asset.browser_download_url.clone(),
        github_accelerator_url(&asset.browser_download_url),
        cors_proxy_url(&asset.browser_download_url),
    ];
    let client = github_client(Duration::from_secs(20 * 60))?;
    let mut errors = Vec::new();

    for url in urls {
        let _ = tokio::fs::remove_file(&partial_path).await;
        match download_asset_once(app, &client, asset, &url, &partial_path, &expected_digest).await
        {
            Ok(()) => {
                let _ = tokio::fs::remove_file(archive_path).await;
                tokio::fs::rename(&partial_path, archive_path)
                    .await
                    .map_err(|error| format!("提交更新下载文件失败：{error}"))?;
                return Ok(());
            }
            Err(error) => errors.push(error),
        }
    }

    let _ = tokio::fs::remove_file(&partial_path).await;
    Err(format!("更新包下载失败：{}", errors.join("；")))
}

fn validate_windows_executable(path: &Path) -> Result<(), String> {
    let metadata = fs::metadata(path).map_err(|error| format!("读取新程序信息失败：{error}"))?;
    if metadata.len() < 1024 * 1024 {
        return Err("新程序体积异常".to_owned());
    }
    let mut file = File::open(path).map_err(|error| format!("打开新程序失败：{error}"))?;
    let mut magic = [0_u8; 2];
    file.read_exact(&mut magic)
        .map_err(|error| format!("读取新程序头失败：{error}"))?;
    if &magic != b"MZ" {
        return Err("新程序不是有效的 Windows PE 文件".to_owned());
    }
    Ok(())
}

fn extract_portable_archive(archive_path: &Path, output: &Path) -> Result<PathBuf, String> {
    let file = File::open(archive_path).map_err(|error| format!("打开更新包失败：{error}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|error| format!("读取更新 ZIP 失败：{error}"))?;
    if archive.len() > MAX_ARCHIVE_ENTRIES {
        return Err("更新 ZIP 文件数量异常".to_owned());
    }
    if archive
        .has_overlapping_files()
        .map_err(|error| format!("检查更新 ZIP 重叠项失败：{error}"))?
    {
        return Err("更新 ZIP 包含重叠文件".to_owned());
    }
    if archive
        .decompressed_size()
        .is_some_and(|size| size > MAX_EXTRACTED_BYTES)
    {
        return Err("更新 ZIP 解压体积超过 512 MiB 限制".to_owned());
    }

    fs::create_dir_all(output).map_err(|error| format!("创建更新解压目录失败：{error}"))?;
    let mut extracted_bytes = 0_u128;
    let mut extracted_paths = HashSet::new();
    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("读取更新 ZIP 第 {index} 项失败：{error}"))?;
        let relative = entry
            .enclosed_name()
            .ok_or_else(|| format!("更新 ZIP 包含越界路径：{}", entry.name()))?;
        if !extracted_paths.insert(relative.clone()) {
            return Err(format!("更新 ZIP 包含重复路径：{}", relative.display()));
        }
        if entry
            .unix_mode()
            .is_some_and(|mode| mode & 0o170000 == 0o120000)
        {
            return Err(format!("更新 ZIP 包含符号链接：{}", entry.name()));
        }
        extracted_bytes = extracted_bytes
            .checked_add(u128::from(entry.size()))
            .ok_or_else(|| "更新 ZIP 解压体积溢出".to_owned())?;
        if extracted_bytes > MAX_EXTRACTED_BYTES {
            return Err("更新 ZIP 解压体积超过 512 MiB 限制".to_owned());
        }

        let destination = output.join(relative);
        if entry.is_dir() {
            fs::create_dir_all(&destination)
                .map_err(|error| format!("创建更新目录失败：{error}"))?;
            continue;
        }
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|error| format!("创建更新文件目录失败：{error}"))?;
        }
        let mut destination_file =
            File::create(&destination).map_err(|error| format!("创建更新文件失败：{error}"))?;
        std::io::copy(&mut entry, &mut destination_file)
            .map_err(|error| format!("解压更新文件失败：{error}"))?;
        destination_file
            .sync_all()
            .map_err(|error| format!("同步更新文件失败：{error}"))?;
    }

    let portable_root = output.join("BiliMaku");
    validate_windows_executable(&portable_root.join("BiliMaku.exe"))?;
    Ok(portable_root)
}

const WINDOWS_UPDATE_HELPER: &str = r#"param(
  [Parameter(Mandatory = $true)][int]$ParentPid,
  [Parameter(Mandatory = $true)][string]$SourceRoot,
  [Parameter(Mandatory = $true)][string]$TargetRoot,
  [Parameter(Mandatory = $true)][string]$TargetExeName,
  [Parameter(Mandatory = $true)][string]$ResultLog
)

$ErrorActionPreference = 'Stop'
$sourceRootFull = [System.IO.Path]::GetFullPath($SourceRoot).TrimEnd('\', '/')
$targetRootFull = [System.IO.Path]::GetFullPath($TargetRoot).TrimEnd('\', '/')
$sourceExe = Join-Path $sourceRootFull 'BiliMaku.exe'
$targetExe = Join-Path $targetRootFull $TargetExeName
$incomingExe = "$targetExe.bilimaku-new"
$backupExe = "$targetExe.bilimaku-old"

function Write-Result([string]$value) {
  [System.IO.File]::WriteAllText($ResultLog, $value, [System.Text.UTF8Encoding]::new($false))
}

try {
  Wait-Process -Id $ParentPid -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 350

  Remove-Item -LiteralPath $incomingExe -Force -ErrorAction SilentlyContinue
  Copy-Item -LiteralPath $sourceExe -Destination $incomingExe -Force

  Get-ChildItem -LiteralPath $sourceRootFull -Recurse -File -Force |
    Where-Object { $_.FullName -ne $sourceExe } |
    ForEach-Object {
      $relative = $_.FullName.Substring($sourceRootFull.Length).TrimStart('\', '/')
      $destination = Join-Path $targetRootFull $relative
      $destinationParent = Split-Path -Parent $destination
      New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
      Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
    }

  $applied = $false
  for ($attempt = 1; $attempt -le 20; $attempt += 1) {
    try {
      Remove-Item -LiteralPath $backupExe -Force -ErrorAction SilentlyContinue
      if (Test-Path -LiteralPath $targetExe) {
        Move-Item -LiteralPath $targetExe -Destination $backupExe -Force
      }
      Move-Item -LiteralPath $incomingExe -Destination $targetExe -Force
      $applied = $true
      break
    }
    catch {
      if ((Test-Path -LiteralPath $backupExe) -and -not (Test-Path -LiteralPath $targetExe)) {
        Move-Item -LiteralPath $backupExe -Destination $targetExe -Force -ErrorAction SilentlyContinue
      }
      if ($attempt -eq 20) { throw }
      Start-Sleep -Milliseconds 250
    }
  }

  if (-not $applied) { throw 'update file replacement did not complete' }

  Remove-Item -LiteralPath $backupExe -Force -ErrorAction SilentlyContinue
  Write-Result 'success'
}
catch {
  Remove-Item -LiteralPath $incomingExe -Force -ErrorAction SilentlyContinue
  if ((Test-Path -LiteralPath $backupExe) -and -not (Test-Path -LiteralPath $targetExe)) {
    Move-Item -LiteralPath $backupExe -Destination $targetExe -Force -ErrorAction SilentlyContinue
  }
  Write-Result ("error: " + $_.Exception.Message)
  exit 1
}
"#;

#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
fn spawn_windows_update_helper(
    helper_path: &Path,
    source_root: &Path,
    target_root: &Path,
    target_exe_name: &str,
    result_log: &Path,
) -> Result<(), String> {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-WindowStyle",
            "Hidden",
            "-File",
        ])
        .arg(helper_path)
        .arg("-ParentPid")
        .arg(std::process::id().to_string())
        .arg("-SourceRoot")
        .arg(source_root)
        .arg("-TargetRoot")
        .arg(target_root)
        .arg("-TargetExeName")
        .arg(target_exe_name)
        .arg("-ResultLog")
        .arg(result_log)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|error| format!("启动更新替换进程失败：{error}"))?;
    Ok(())
}

#[cfg(all(target_os = "windows", target_arch = "x86_64"))]
async fn install_windows_update(
    app: &AppHandle,
    release: &GithubRelease,
    latest: &Version,
) -> Result<(), String> {
    if cfg!(debug_assertions) {
        return Err("开发构建已关闭文件替换，请使用 release 构建验证更新".to_owned());
    }
    let asset = release_asset(release, latest)
        .ok_or_else(|| "最新 Release 缺少 Windows x64 免安装更新包或 digest".to_owned())?;
    let current_exe =
        std::env::current_exe().map_err(|error| format!("读取当前程序路径失败：{error}"))?;
    let target_root = current_exe
        .parent()
        .ok_or_else(|| "当前程序路径缺少父目录".to_owned())?;
    let target_exe_name = current_exe
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "当前程序文件名不是有效 UTF-8".to_owned())?;
    if !target_root.join("portable.flag").is_file() {
        return Err("当前为安装版或缺少 portable.flag，请从 Release 页面使用安装包更新".to_owned());
    }
    ensure_directory_writable(target_root)?;

    let update_root = app
        .path()
        .app_cache_dir()
        .map_err(|error| format!("读取应用缓存目录失败：{error}"))?
        .join("updates");
    fs::create_dir_all(&update_root).map_err(|error| format!("创建更新缓存根目录失败：{error}"))?;
    let version_root = update_root.join(format!("v{latest}"));
    safe_reset_directory(&version_root, &update_root)?;
    let archive_path = version_root.join(&asset.name);

    download_asset(app, asset, &archive_path).await?;
    emit_progress(
        app,
        "staging",
        Some(100),
        asset.size,
        Some(asset.size),
        "正在解压并检查更新文件",
    );
    let extraction_root = version_root.join("extracted");
    let archive_for_extract = archive_path.clone();
    let extraction_for_task = extraction_root.clone();
    let portable_root = tokio::task::spawn_blocking(move || {
        extract_portable_archive(&archive_for_extract, &extraction_for_task)
    })
    .await
    .map_err(|error| format!("更新解压任务失败：{error}"))??;

    let helper_path = version_root.join("apply-update.ps1");
    let result_log = version_root.join("apply-result.txt");
    fs::write(&helper_path, WINDOWS_UPDATE_HELPER.as_bytes())
        .map_err(|error| format!("写入更新替换脚本失败：{error}"))?;
    spawn_windows_update_helper(
        &helper_path,
        &portable_root,
        target_root,
        target_exe_name,
        &result_log,
    )?;

    emit_progress(
        app,
        "ready",
        Some(100),
        asset.size,
        Some(asset.size),
        "更新已准备完成，BiliMaku 即将退出；重新打开后生效",
    );
    tokio::time::sleep(Duration::from_millis(700)).await;
    app.exit(0);
    Ok(())
}

/// 查询 GitHub 最新正式 Release，并与当前 Cargo 包版本进行 SemVer 比较。
#[tauri::command]
pub async fn check_app_update() -> Result<AppUpdateStatus, String> {
    let release = fetch_latest_release().await?;
    compare_release(env!("CARGO_PKG_VERSION"), &release)
}

/// 下载 Windows 免安装包，校验 GitHub digest，退出后由独立进程替换应用文件。
#[tauri::command]
pub async fn install_app_update(
    app: AppHandle,
    state: State<'_, AppUpdateRuntimeState>,
) -> Result<(), String> {
    let _guard = state.try_begin()?;
    emit_progress(&app, "checking", None, 0, None, "正在确认最新正式版本");
    let release = fetch_latest_release().await?;
    let current = parse_release_version(env!("CARGO_PKG_VERSION"))?;
    let latest = parse_release_version(&release.tag_name)?;
    if latest <= current {
        return Err(format!("当前 v{current} 已是最新正式版本"));
    }

    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    {
        install_windows_update(&app, &release, &latest).await
    }
    #[cfg(not(all(target_os = "windows", target_arch = "x86_64")))]
    {
        let _ = (app, release, latest);
        Err("应用内文件替换当前适配 Windows x64，请从 Release 页面更新此平台".to_owned())
    }
}

/// 使用系统默认浏览器打开项目的最新 Release 页面。
#[tauri::command]
pub fn open_release_page(app: AppHandle) -> Result<(), String> {
    app.opener()
        .open_url(LATEST_RELEASE_PAGE, None::<&str>)
        .map_err(|error| format!("打开 Release 页面失败：{error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use zip::{write::SimpleFileOptions, ZipWriter};

    fn write_zip(path: &Path, entries: &[(&str, Vec<u8>)]) {
        let file = File::create(path).unwrap();
        let mut writer = ZipWriter::new(file);
        for (name, bytes) in entries {
            writer
                .start_file(*name, SimpleFileOptions::default())
                .unwrap();
            writer.write_all(bytes).unwrap();
        }
        writer.finish().unwrap();
    }

    fn release(tag: &str) -> GithubRelease {
        let version = parse_release_version(tag).unwrap();
        let assets = expected_portable_asset_name(&version)
            .map(|name| {
                vec![GithubAsset {
                    browser_download_url: format!(
                        "https://github.com/WJZ-P/BiliMaku/releases/download/{tag}/{name}"
                    ),
                    name,
                    size: 16 * 1024 * 1024,
                    digest: Some(format!("sha256:{}", "a".repeat(64))),
                    state: "uploaded".to_owned(),
                }]
            })
            .unwrap_or_default();
        GithubRelease {
            tag_name: tag.to_owned(),
            name: Some(tag.to_owned()),
            html_url: format!("https://github.com/WJZ-P/BiliMaku/releases/tag/{tag}"),
            published_at: Some("2026-08-21T00:00:00Z".to_owned()),
            draft: false,
            prerelease: false,
            assets,
        }
    }

    #[test]
    fn accepts_v_prefixed_semver_and_detects_newer_release() {
        let release = release("v1.1.0");
        let result = compare_release("1.0.0", &release).unwrap();
        assert_eq!(result.current_version, "1.0.0");
        assert_eq!(result.latest_version, "1.1.0");
        assert!(result.update_available);
        #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
        assert_eq!(
            result.asset_name.as_deref(),
            Some("BiliMaku-v1.1.0-windows-x64-portable.zip")
        );
    }

    #[test]
    fn equal_or_older_release_does_not_report_an_update() {
        assert!(
            !compare_release("1.1.0", &release("v1.1.0"))
                .unwrap()
                .update_available
        );
        assert!(
            !compare_release("1.2.0", &release("v1.1.0"))
                .unwrap()
                .update_available
        );
    }

    #[test]
    fn rejects_draft_and_prerelease_entries() {
        let mut draft = release("v1.1.0");
        draft.draft = true;
        assert!(compare_release("1.0.0", &draft).is_err());

        let mut prerelease = release("v1.1.0-beta.1");
        prerelease.prerelease = true;
        assert!(compare_release("1.0.0", &prerelease).is_err());
    }

    #[test]
    fn replaces_untrusted_release_urls_with_project_releases_page() {
        let mut value = release("v1.1.0");
        value.html_url = "https://example.com/download".to_owned();
        assert_eq!(
            compare_release("1.0.0", &value).unwrap().release_url,
            RELEASES_PAGE
        );
    }

    #[test]
    fn cors_proxy_matches_encode_uri_component_shape() {
        assert_eq!(
            cors_proxy_url("https://api.github.com/repos/WJZ-P/BiliMaku/releases/latest"),
            "https://corsproxy.io/?https%3A%2F%2Fapi.github.com%2Frepos%2FWJZ-P%2FBiliMaku%2Freleases%2Flatest"
        );
    }

    #[test]
    fn github_accelerator_wraps_the_complete_url() {
        assert_eq!(
            github_accelerator_url(LATEST_RELEASE_API),
            "https://gh-proxy.com/https://api.github.com/repos/WJZ-P/BiliMaku/releases/latest"
        );
    }

    #[test]
    fn validates_release_asset_digest_and_origin() {
        let value = release("v1.1.0");
        let asset = &value.assets[0];
        assert!(trusted_asset_url(&asset.browser_download_url));
        assert_eq!(normalized_sha256_digest(asset), Some("a".repeat(64)));
    }

    #[test]
    fn extracts_a_valid_portable_archive() {
        let temp = tempfile::tempdir().unwrap();
        let archive_path = temp.path().join("portable.zip");
        let mut executable = vec![0_u8; 1024 * 1024 + 1];
        executable[0..2].copy_from_slice(b"MZ");
        write_zip(
            &archive_path,
            &[
                ("BiliMaku/BiliMaku.exe", executable),
                ("BiliMaku/README.txt", b"portable".to_vec()),
                ("BiliMaku/portable.flag", b"bilimaku-portable-v1".to_vec()),
            ],
        );

        let extracted = extract_portable_archive(&archive_path, &temp.path().join("out")).unwrap();
        assert_eq!(extracted, temp.path().join("out").join("BiliMaku"));
        assert!(extracted.join("BiliMaku.exe").is_file());
        assert!(extracted.join("README.txt").is_file());
        assert!(extracted.join("portable.flag").is_file());
    }

    #[test]
    fn rejects_zip_path_traversal() {
        let temp = tempfile::tempdir().unwrap();
        let archive_path = temp.path().join("unsafe.zip");
        write_zip(&archive_path, &[("../outside.txt", b"bad".to_vec())]);

        let error = extract_portable_archive(&archive_path, &temp.path().join("out")).unwrap_err();
        assert!(error.contains("越界路径"));
        assert!(!temp.path().join("outside.txt").exists());
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_helper_replaces_files_after_parent_exit() {
        let temp = tempfile::tempdir().unwrap();
        let source = temp.path().join("source");
        let target = temp.path().join("target");
        fs::create_dir_all(&source).unwrap();
        fs::create_dir_all(&target).unwrap();
        fs::write(source.join("BiliMaku.exe"), b"new-executable").unwrap();
        fs::write(source.join("README.txt"), b"new-readme").unwrap();
        fs::write(source.join("portable.flag"), b"bilimaku-portable-v1").unwrap();
        fs::write(target.join("current.exe"), b"old-executable").unwrap();
        let helper = temp.path().join("apply-update.ps1");
        let result_log = temp.path().join("result.txt");
        fs::write(&helper, WINDOWS_UPDATE_HELPER).unwrap();

        let status = Command::new("powershell.exe")
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
            ])
            .arg(&helper)
            .arg("-ParentPid")
            .arg("2147483646")
            .arg("-SourceRoot")
            .arg(&source)
            .arg("-TargetRoot")
            .arg(&target)
            .arg("-TargetExeName")
            .arg("current.exe")
            .arg("-ResultLog")
            .arg(&result_log)
            .status()
            .unwrap();

        assert!(status.success());
        assert_eq!(
            fs::read(target.join("current.exe")).unwrap(),
            b"new-executable"
        );
        assert_eq!(fs::read(target.join("README.txt")).unwrap(), b"new-readme");
        assert_eq!(
            fs::read(target.join("portable.flag")).unwrap(),
            b"bilimaku-portable-v1"
        );
        assert_eq!(fs::read_to_string(result_log).unwrap(), "success");
    }

    #[tokio::test]
    #[ignore = "requires a live connection to the GitHub Releases API"]
    async fn checks_the_live_github_release() {
        let result = check_app_update().await.unwrap();
        assert!(!result.current_version.is_empty());
        assert!(!result.latest_version.is_empty());
        assert!(result.release_url.starts_with(RELEASES_PAGE));
        #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
        assert!(result.asset_name.is_some());
    }

    #[tokio::test]
    #[ignore = "requires a live connection to the GitHub accelerator"]
    async fn checks_the_live_github_accelerator() {
        let client = github_client(Duration::from_secs(30)).unwrap();
        let candidate = ReleaseCandidate {
            label: "GitHub API 国内加速测试",
            url: github_accelerator_url(LATEST_RELEASE_API),
            kind: ReleaseResponseKind::Single,
        };
        let release = fetch_release_candidate(&client, &candidate).await.unwrap();
        assert!(!release.tag_name.is_empty());
        assert!(release
            .assets
            .iter()
            .any(|asset| asset.name.ends_with("windows-x64-portable.zip")
                && normalized_sha256_digest(asset).is_some()));
    }
}
