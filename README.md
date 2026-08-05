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
- 登录 Cookie 由 Rust 使用 AES-256-GCM 加密持久化，启动时自动在线校验，前端事件与日志不包含 Cookie；
- 广播登录、恢复、在线复验、Cookie 过期、退出与会话错误等账号事件；
- 导入带 `bilicast-tts.json` 的自定义 TTS 目录，支持本机命令与 OpenAI 兼容 HTTP 两种推理适配器；
- 统一系统语音与自定义模型的自动播报、试听、暂停、继续和停止队列；
- 全屏透明滚动弹幕窗口，支持事件颜色、字体、粗细、描边、轨道、速度与滑入滑出时间；
- 独立纯透明侧边事件流，空态完全不绘制背景，仅在入场、点赞/互动、弹幕、礼物、SC 与大航海等事件到来时显示动画气泡；
- 两类悬浮组件各自订阅标准直播事件，可独立打开、关闭、预览与鼠标穿透。

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

扫码成功后 Cookie 会加密写入应用数据目录。关闭并重新启动 BiliCast 时，Rust 会恢复 Cookie 并通过账号导航接口校验；服务端确认过期后自动删除本地会话、切换匿名模式并发出 `cookie-expired` 事件。点击“退出当前账号”会清理加密文件并换成全新的匿名 Cookie 容器。

## 自动检查与构建

```powershell
npm run check
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

Windows 安装包会生成在 `src-tauri/target/release/bundle/`。更多资料：

- [匿名 Web 与登录态 Web 数据对照](WEB_SESSION_COMPARISON.md)
- [直播弹幕接入技术报告](docs/live-connection-technical-report.md)
- [自定义 TTS 模型包与 ModelScope 接入](docs/tts-model-package.md)
- [透明滚动弹幕与侧边事件栏](docs/transparent-overlays.md)
- [登录态加密持久化与账号事件](docs/account-session-persistence.md)

