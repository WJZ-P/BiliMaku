[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BinaryPath,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$')]
  [string]$Version,

  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'

$resolvedBinary = (Resolve-Path -LiteralPath $BinaryPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
$archiveName = "BiliMaku-v$Version-windows-x64-portable.zip"
$archivePath = Join-Path $resolvedOutput $archiveName
$stagingParent = [System.IO.Path]::GetFullPath((Join-Path $resolvedOutput ".bilimaku-portable-$PID"))
$portableRoot = Join-Path $stagingParent 'BiliMaku'

$outputPrefix = $resolvedOutput.TrimEnd(
  [System.IO.Path]::DirectorySeparatorChar,
  [System.IO.Path]::AltDirectorySeparatorChar
) + [System.IO.Path]::DirectorySeparatorChar
if (-not $stagingParent.StartsWith($outputPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "临时目录超出输出目录：$stagingParent"
}

New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null

try {
  Remove-Item -LiteralPath $stagingParent -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Path $portableRoot -Force | Out-Null

  Copy-Item -LiteralPath $resolvedBinary -Destination (Join-Path $portableRoot 'BiliMaku.exe')

  @"
BiliMaku v$Version 免安装版

1. 请先解压整个 BiliMaku 文件夹，再运行 BiliMaku.exe。
2. 账号、直播间与界面配置仍保存在当前 Windows 用户的应用数据目录。
3. 自定义 TTS 模型、Python、CUDA 与 Chinese BERT 运行环境不包含在此压缩包中。
"@ | Set-Content -LiteralPath (Join-Path $portableRoot 'README.txt') -Encoding utf8

  Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
  Compress-Archive -LiteralPath $portableRoot -DestinationPath $archivePath -CompressionLevel Optimal

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
  try {
    $entries = @($zip.Entries | ForEach-Object { $_.FullName.Replace('\\', '/') })
    if ($entries -notcontains 'BiliMaku/BiliMaku.exe') {
      throw '免安装压缩包缺少 BiliMaku/BiliMaku.exe。'
    }
    if ($entries -notcontains 'BiliMaku/README.txt') {
      throw '免安装压缩包缺少 BiliMaku/README.txt。'
    }
  }
  finally {
    $zip.Dispose()
  }

  Write-Output $archivePath
}
finally {
  Remove-Item -LiteralPath $stagingParent -Recurse -Force -ErrorAction SilentlyContinue
}
