param(
  [string]$ViteLog = "",
  [string]$RuntimeLog = "",
  [int]$Top = 12
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Read-JsonLines([string]$Path) {
  if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return @() }
  return @(
    Get-Content -LiteralPath $Path -Encoding UTF8 |
      Where-Object { $_.Trim() } |
      ForEach-Object {
        try { $_ | ConvertFrom-Json } catch {
          Write-Warning "跳过无法解析的 JSONL 行：$($_.Exception.Message)"
        }
      }
  )
}

if (-not $ViteLog) {
  $latestViteLog = Get-ChildItem -LiteralPath (Join-Path $repoRoot ".logs") `
    -Filter "vite-startup-*.jsonl" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($latestViteLog) { $ViteLog = $latestViteLog.FullName }
}

if (-not $RuntimeLog) {
  $runtimeLogDirectory = Join-Path $env:APPDATA "wjz.bilimaku.desktop\logs"
  $latestRuntimeLog = Get-ChildItem -LiteralPath $runtimeLogDirectory `
    -Filter "startup-*.jsonl" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
  if ($latestRuntimeLog) { $RuntimeLog = $latestRuntimeLog.FullName }
}

Write-Host "=== bilimaku 启动性能报告 ===" -ForegroundColor Cyan

$viteRecords = Read-JsonLines $ViteLog
if ($viteRecords.Count) {
  Write-Host "`nVite 日志：$ViteLog" -ForegroundColor Green
  $reportRecord = $viteRecords |
    Where-Object { $_.kind -eq "browser-report" -and $_.report.reason -eq "app-first-frame" } |
    Select-Object -Last 1
  if (-not $reportRecord) {
    $reportRecord = $viteRecords |
      Where-Object { $_.kind -eq "browser-report" } |
      Select-Object -Last 1
  }

  if ($reportRecord) {
    Write-Host "`n关键浏览器阶段（毫秒）"
    $reportRecord.report.metrics |
      Where-Object {
        $_.stage -in @(
          "html-inline-evaluated",
          "frontend-entry-evaluated",
          "react-root-created",
          "react-shell-first-frame",
          "app-module-resolved",
          "app-first-frame"
        )
      } |
      Select-Object stage, elapsedMs, durationMs, detail |
      Format-Table -AutoSize

    Write-Host "最慢浏览器资源"
    $reportRecord.report.metrics |
      Where-Object { $_.stage -eq "resource" } |
      Sort-Object durationMs -Descending |
      Select-Object -First $Top durationMs, elapsedMs, detail |
      Format-Table -AutoSize
  }

  Write-Host "最慢 Vite 模块转换"
  $viteRecords |
    Where-Object { $_.kind -eq "module-transform" } |
    Sort-Object durationMs -Descending |
    Select-Object -First $Top durationMs, sourceBytes, moduleId |
    Format-Table -AutoSize
} else {
  Write-Host "`n尚无 Vite 启动日志。运行 npm run dev 或 npm run tauri:dev 后再试。" `
    -ForegroundColor Yellow
}

$runtimeRecords = Read-JsonLines $RuntimeLog
if ($runtimeRecords.Count) {
  Write-Host "`nRust/Tauri 日志：$RuntimeLog" -ForegroundColor Green
  $runtimeRecords |
    Where-Object { $_.source -eq "rust" } |
    Select-Object stage, processElapsedMs, durationMs, detail |
    Format-Table -AutoSize
} else {
  Write-Host "`n尚无 Rust/Tauri 启动日志；仅运行网页开发服务器时属于正常情况。" `
    -ForegroundColor Yellow
}
