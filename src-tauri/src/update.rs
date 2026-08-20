use crate::types::app::AppUpdateStatus;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT};
use semver::Version;
use serde::Deserialize;
use std::time::Duration;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

const LATEST_RELEASE_API: &str = "https://api.github.com/repos/WJZ-P/BiliMaku/releases/latest";
const RELEASES_PAGE: &str = "https://github.com/WJZ-P/BiliMaku/releases";
const LATEST_RELEASE_PAGE: &str = "https://github.com/WJZ-P/BiliMaku/releases/latest";

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    name: Option<String>,
    html_url: String,
    published_at: Option<String>,
    draft: bool,
    prerelease: bool,
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

fn compare_release(current_label: &str, release: GithubRelease) -> Result<AppUpdateStatus, String> {
    if release.draft || release.prerelease {
        return Err("GitHub 最新版本不是正式 Release".to_owned());
    }

    let current = parse_release_version(current_label)?;
    let latest = parse_release_version(&release.tag_name)?;
    let release_name = release
        .name
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| release.tag_name.clone());

    Ok(AppUpdateStatus {
        current_version: current.to_string(),
        latest_version: latest.to_string(),
        update_available: latest > current,
        release_url: trusted_release_url(&release.html_url),
        release_name,
        published_at: release.published_at,
    })
}

/// 查询 GitHub 最新正式 Release，并与当前 Cargo 包版本进行 SemVer 比较。
#[tauri::command]
pub async fn check_app_update() -> Result<AppUpdateStatus, String> {
    let mut headers = HeaderMap::new();
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("application/vnd.github+json"),
    );
    headers.insert(
        "x-github-api-version",
        HeaderValue::from_static("2022-11-28"),
    );

    let client = reqwest::Client::builder()
        .default_headers(headers)
        .user_agent(format!("BiliMaku/{}", env!("CARGO_PKG_VERSION")))
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|error| format!("创建版本检测客户端失败：{error}"))?;

    let response = client
        .get(LATEST_RELEASE_API)
        .send()
        .await
        .map_err(|error| format!("连接 GitHub Release 失败：{error}"))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!("GitHub Release 返回 HTTP {}", status.as_u16()));
    }

    let release = response
        .json::<GithubRelease>()
        .await
        .map_err(|error| format!("解析 GitHub Release 失败：{error}"))?;
    compare_release(env!("CARGO_PKG_VERSION"), release)
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

    fn release(tag: &str) -> GithubRelease {
        GithubRelease {
            tag_name: tag.to_owned(),
            name: Some(tag.to_owned()),
            html_url: format!("https://github.com/WJZ-P/BiliMaku/releases/tag/{tag}"),
            published_at: Some("2026-08-21T00:00:00Z".to_owned()),
            draft: false,
            prerelease: false,
        }
    }

    #[test]
    fn accepts_v_prefixed_semver_and_detects_newer_release() {
        let result = compare_release("1.0.0", release("v1.1.0")).unwrap();
        assert_eq!(result.current_version, "1.0.0");
        assert_eq!(result.latest_version, "1.1.0");
        assert!(result.update_available);
    }

    #[test]
    fn equal_or_older_release_does_not_report_an_update() {
        assert!(
            !compare_release("1.1.0", release("v1.1.0"))
                .unwrap()
                .update_available
        );
        assert!(
            !compare_release("1.2.0", release("v1.1.0"))
                .unwrap()
                .update_available
        );
    }

    #[test]
    fn rejects_draft_and_prerelease_entries() {
        let mut draft = release("v1.1.0");
        draft.draft = true;
        assert!(compare_release("1.0.0", draft).is_err());

        let mut prerelease = release("v1.1.0-beta.1");
        prerelease.prerelease = true;
        assert!(compare_release("1.0.0", prerelease).is_err());
    }

    #[test]
    fn replaces_untrusted_release_urls_with_project_releases_page() {
        let mut value = release("v1.1.0");
        value.html_url = "https://example.com/download".to_owned();
        assert_eq!(
            compare_release("1.0.0", value).unwrap().release_url,
            RELEASES_PAGE
        );
    }

    #[tokio::test]
    #[ignore = "requires a live connection to the GitHub Releases API"]
    async fn checks_the_live_github_release() {
        let result = check_app_update().await.unwrap();
        assert!(!result.current_version.is_empty());
        assert!(!result.latest_version.is_empty());
        assert!(result.release_url.starts_with(RELEASES_PAGE));
    }
}
