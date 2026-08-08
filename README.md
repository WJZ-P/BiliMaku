# bilimaku

bilimaku 是一个基于 **React + Tauri + Rust** 的桌面直播弹幕智能播报器。前端组件使用 Linaria 的 `styled` API，颜色统一由 `src/styles/theme.ts` 管理；直播间解析、二维码登录、Cookie 会话、弹幕长链与协议解包均运行在 Rust 端。

## 已实现能力

- 输入短房间号或真实房间号，连接公开直播间 Web 弹幕长链；
- 接收弹幕、礼物、醒目留言、上舰、进场、关注与分享等事件；
- 展示长链心跳返回的直播间人气值；
- 启动时先由 Rust 恢复并校验登录态；匿名状态进入 690×460（3:2）浅蓝扫码窗，登录成功后切换完整工作台；
- 使用无边框自绘标题栏接管最小化、最大化与关闭按钮，并提供弹簧动效和 Mica/CSS 磨砂效果；
- 通过哔哩哔哩客户端扫码建立观看账号登录态；
- 登录后自动复用 Cookie、账号 UID、WBI 参数与弹幕令牌；
- 侧边栏提供应用设置页，可查看当前账号、主题和配置路径并退出登录；
- 在播报台明确显示“匿名 Web 长链”或“登录态 Web 长链”；
- 头像使用 `no-referrer` 请求并提供首字兜底；
- 登录 Cookie、房间号、TTS 与悬浮窗设置由 Rust 统一 Store 持久化到可编辑 JSON，启动时自动恢复并在线校验登录态；
- 广播登录、恢复、在线复验、Cookie 过期、退出与会话错误等账号事件；
- 自动识别原始 TTS 模型目录，当前内置 Bert-VITS2 适配器，并兼容本机命令与 OpenAI HTTP 入口；
- 由 Rust 聚合检查 Python、推理依赖、BERT 与 GPU 状态，在试听前展示逐项配置指南；
- 自定义 TTS 使用 Rust 托管的常驻 Python worker；冷启动只把预热任务投递到后台并同步 queued/loading/ready/error 状态，首屏不等待模型加载，后续复用显存；
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

1. 启动 BiliMaku，应用先检查统一配置中的本地登录态。
2. 本地会话为空或 Cookie 已过期时，3:2 登录窗会自动生成浅蓝色二维码。
3. 使用哔哩哔哩手机客户端扫码，并在手机上确认登录。
4. 登录成功后窗口自动展开为完整工作台，并显示账号昵称与头像。
5. 在 **播报台** 输入目标直播间号并连接。
6. 连接成功后，顶部状态会显示 **登录态 Web 长链**，说明该连接已携带当前登录会话。
7. 需要切换账号时进入左侧 **应用设置**，点击 **退出登录**；窗口会回到扫码形态。

扫码成功后 Cookie 会写入统一配置。关闭并重新启动 bilimaku 时，Rust 会从内存 Store 恢复 Cookie 并通过账号导航接口校验；服务端确认过期后自动清空账号段、切换匿名模式并发出 `cookie-expired` 事件。在应用设置页点击“退出登录”会保留房间号、TTS 与悬浮窗等设置，只移除账号登录态并返回扫码窗。

## 自动检查与构建

```powershell
npm run check
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo build --manifest-path src-tauri/Cargo.toml --release
```

安装包打包步骤由发布者单独执行。更多资料：

- [匿名 Web 与登录态 Web 数据对照](WEB_SESSION_COMPARISON.md)
- [直播弹幕接入技术报告](docs/live-connection-technical-report.md)
- [自定义 TTS 模型包与 ModelScope 接入](docs/tts-model-package.md)
- [透明滚动弹幕与侧边事件栏](docs/transparent-overlays.md)
- [统一配置与内存 Store](CONFIGURATION.md)
- [登录态持久化与账号事件](docs/account-session-persistence.md)
- [启动性能监测与白屏排查](docs/startup-performance.md)
