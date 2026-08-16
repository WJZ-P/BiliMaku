<p align="center">
  <img src="public/icon.png" alt="BiliMaku" width="96" />
</p>

<h1 align="center">BiliMaku · 哔哩播报</h1>

<p align="center">基于 React、Rust 与 Tauri 2 的桌面直播弹幕播报工具。</p>

<p align="center">
  <a href="https://github.com/WJZ-P/BiliMaku/releases"><img src="https://img.shields.io/github/v/release/WJZ-P/BiliMaku?label=release" alt="Release" /></a>
  <a href="https://github.com/WJZ-P/BiliMaku/actions/workflows/release.yml"><img src="https://github.com/WJZ-P/BiliMaku/actions/workflows/release.yml/badge.svg" alt="Release workflow" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="AGPL-3.0" /></a>
</p>

## 功能

- 扫码登录并恢复本地会话；
- 连接直播间，接收弹幕、礼物、SC、大航海与互动事件；
- 使用系统语音或本地 Bert-VITS2 自定义音色播报；
- 提供全屏滚动弹幕与透明侧边事件悬浮窗；
- 支持浅色模式、深色模式与 WebGL 界面动效。

> Release 不包含 PyTorch、BERT、音色权重或用户 Cookie。

## 开发

需要 Node.js 22、npm、Rust stable、Microsoft C++ Build Tools 和 WebView2 Runtime。

```powershell
git clone https://github.com/WJZ-P/BiliMaku.git
cd BiliMaku
npm ci
npm run tauri:dev
```

检查项目：

```powershell
npm run check
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

## 发布

推送 `vMAJOR.MINOR.PATCH` 格式的 Git Tag 后，`.github/workflows/release.yml` 会校验所有版本号、构建 Windows NSIS/MSI 安装包，并创建同名 Release：

```powershell
git tag v1.0.0
git push origin v1.0.0
```

Release 标题仅使用 Tag，例如 `v1.0.0`。

## License

[GNU AGPL v3](LICENSE)
