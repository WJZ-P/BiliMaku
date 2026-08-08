# bilimaku 启动性能监测与白屏排查

## 结论

截图中的 DOM 已经包含 `#root` 与 `/src/main.tsx`，但 `#root` 仍为空，说明 Rust 窗口和 HTML 导航均已启动，延迟发生在 Vite 开发期模块加载、WyW/Linaria 转换与 React 入口执行之间。

这条路径与 BERT 或自定义 TTS 模型预热无关：TTS 预热原本就在 React effect 之后触发，当前本机配置还是系统语音模式。它会影响首帧之后的资源竞争，却解释不了 React Root 创建前的空档。

Git 历史的规模变化也与退化时间吻合：`50fef38` 加入自定义 TTS 和两套透明悬浮窗后，TS/TSX 文件从约 16 个增长到 29 个，Linaria `styled` 使用量从约 120 处增长到 230 处。旧入口又同时静态导入主应用、悬浮窗和全部页面，导致开发服务器第一次打开窗口时需要处理几乎整张业务图。

## 已接入的时间线

### 1. HTML 零依赖阶段

`index.html` 在任何 Vite 模块执行前创建 `window.__BILIMAKU_STARTUP__`，记录：

- `html-inline-evaluated`
- `html-dom-content-loaded`
- `html-window-load`
- `root-first-mutation`
- 5 秒与 10 秒 Root 看门狗

同时直接绘制浅蓝启动界面。即使开发模块仍在转换，窗口也不会显示纯白空页；悬浮窗查询参数会关闭该界面并保持透明。

### 2. React 阶段

`src/main.tsx` 和 `src/App.tsx` 会记录：

- 前端入口执行
- React Root 创建
- React render 请求
- 启动壳首帧
- App 模块请求、解析与执行
- App commit 与完整工作台首帧

页面资源计时会附带最慢的脚本、CSS 与 `/src/` 请求。

### 3. Vite/WyW 阶段

开发服务器记录：

- Vite 开始监听的时间
- `/`、`/src/*` 与虚拟 CSS 的 HTTP 响应耗时
- 每个源码模块经过完整插件转换链的耗时与源码字节数
- 浏览器上报的同一页面时间线

Vite 日志使用异步写流；模块转换只入队一行 JSON，不执行同步磁盘写入，因此探针本身不会扣住 HTTP 响应。

### 4. Rust/Tauri 阶段

Rust 记录：

- `setup` 进入与完成
- 统一配置 Store 初始化耗时
- 登录态后台恢复开始、结束与结果
- 前端上报的浏览器时间线

登录恢复仍运行在 Tauri 异步任务中，启动日志用于证明它没有阻塞窗口首帧。

## 日志位置

开发期 Vite 日志：

```text
<仓库>\.logs\vite-startup-<时间>-<进程>.jsonl
```

Tauri/Rust 与前端统一日志：

```text
%APPDATA%\wjz.bilimaku.desktop\logs\startup-<时间>-<进程>.jsonl
```

`.logs` 已加入 Git 忽略列表。每次进程启动使用独立 JSONL 文件，便于比较不同提交。

## 查看报告

在仓库根目录执行：

```powershell
npm run perf:startup
```

指定日志或增加输出数量：

```powershell
powershell -NoProfile -File .\scripts\startup-performance-report.ps1 `
  -ViteLog .\.logs\vite-startup-<编号>.jsonl `
  -RuntimeLog "$env:APPDATA\wjz.bilimaku.desktop\logs\startup-<编号>.jsonl" `
  -Top 20
```

浏览器控制台也会实时打印 `[bilimaku perf +<毫秒>]` 标记。

## 本轮基准

独立 Vite 进程配合全新无头 Edge 配置目录，最终页面时间线为：

| 阶段 | 最终耗时 |
| --- | ---: |
| Vite ready | 470 ms |
| HTML 启动界面执行 | 529.8 ms |
| React Root 创建 | 637.9 ms |
| React 启动壳首帧 | 668.0 ms |
| 完整工作台 App 首帧 | 1084.8 ms |

无头 Edge 进程从创建到日志上报的墙钟时间是 5.95 秒，其中包含全新浏览器用户目录、浏览器进程创建与 PowerShell 250 ms 轮询；应用内部的 `performance.timeOrigin` 时间线才用于评价页面启动。

改动前不带详细探针的独立基线约 16 秒才出现挂载页面。接入探针的第一版曾使用同步 JSONL 写入并放大延迟，因此那一轮 39 秒数据只用于发现测量器问题，不作为产品基线。

release 可执行文件的隐藏启动复验还得到：HTML 标记 19.5 ms、React Root 55.5 ms、完整 App 首帧 408.1 ms；Rust 配置 Store 初始化约 0.96 ms，登录态恢复约 306.6 ms且在后台完成。该进程持续存活并成功写入 85 条 Rust/前端联合记录后，由测试脚本按精确 PID 关闭。

## 本轮优化

1. `main.tsx` 只同步加载 React 与轻量性能模块；主应用和悬浮窗分别懒加载。
2. 主应用的各功能页独立懒加载，默认窗口不再转换悬浮窗设置、TTS Studio 等页面。
3. App 的 Linaria 声明移到纯 `AppStyles.ts`，避免静态求值业务服务。
4. Overlay/TTS 服务在 App 首帧后后台导入，自定义模型预热使用空闲调度。
5. WyW 只转换实际导入 `@linaria/*` 的源码，并使用 native resolver。
6. Vite 依赖发现改为显式清单，关闭冷启动 crawl hold。
7. 可再生的 Vite 依赖缓存放到 `%LOCALAPPDATA%\bilimaku\vite-cache`。
8. 开发期把启动时已经读取的 TS/TSX、Vite client env 与 Linaria/Emotion ESM 小文件保留在内存；文件变化时更新单项快照，Linaria 引用状态变化时自动重启 Vite 配置。
9. 原生窗口背景色设置为主题浅蓝色，在 HTML 到达前也不会出现刺眼纯白。

WyW 官方排障文档同样建议保持样式模块纯净，并通过 slow-import/dynamic-import 日志定位被误带入静态求值的运行时代码：<https://wyw-in-js.dev/troubleshooting>。
