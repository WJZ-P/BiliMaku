# BiliCast

BiliCast 是一个基于 **React + Tauri + Rust** 的桌面直播弹幕智能播报器。前端组件使用 Linaria 的 `styled` API，颜色统一由 `src/styles/theme.ts` 管理；直播间解析、二维码登录、Cookie 会话、弹幕长链与协议解包均运行在 Rust 端。

## 已实现能力

- 输入短房间号或真实房间号，连接公开直播间 Web 弹幕长链；
- 接收弹幕、礼物、醒目留言、上舰、进场、关注与分享等事件；
- 展示长链心跳返回的直播间人气值；
- 通过哔哩哔哩客户端扫码建立观看账号登录态；
- 登录后自动复用 Cookie、账号 UID、WBI 参数与弹幕令牌；
- 在播报台明确显示“匿名 Web 长链”或“登录态 Web 长链”；
- 头像使用 `no-referrer` 请求并提供首字兜底；
- 登录凭据只保存在当前 Rust 进程内，不进入 React 状态或日志。

## 本地开发

准备 Node.js、npm、Rust stable、Tauri 2 所需的 Windows WebView2 与 C++ 构建工具，然后在仓库根目录执行：

```powershell
npm ci
npm run tauri:dev
```

只预览 React 页面时可以执行 `npm run dev`，但二维码登录和真实弹幕连接依赖 Tauri 命令，需要从桌面窗口使用。

## 扫码登录与连接流程

1. 启动 BiliCast，进入左侧 **连接设置**。
2. 点击 **扫码登录 B 站**。
3. 使用哔哩哔哩手机客户端扫码，并在手机上确认登录。
4. 页面显示账号昵称与 UID 后，进入 **播报台**。
5. 输入目标直播间号并点击连接。
6. 连接成功后，顶部状态会显示 **登录态 Web 长链**，说明该连接已携带当前登录会话；退出账号后再次连接则使用匿名模式。
7. 在同一个房间分别进行匿名与登录态测试，对比进场事件昵称、头像和事件数量。服务端最终下发哪些身份字段仍以实际数据包为准。

二维码与 Cookie 的生命周期跟随当前应用进程。关闭应用后再次启动，需要重新扫码；点击“退出当前账号”会立即换成全新的匿名 Cookie 容器。

## 自动检查与构建

```powershell
npm run check
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

Windows 安装包会生成在 `src-tauri/target/release/bundle/`。更完整的接入方式、权限差异与数据语义见 [直播弹幕接入技术报告](docs/live-connection-technical-report.md)。

