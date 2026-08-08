# BiliMaku 直播弹幕发送技术说明

更新日期：2026-08-08

## 结论

可行。哔哩哔哩直播网页的接收与发送是两条链路：

- **接收弹幕**：继续使用 BiliMaku 已建立的直播 WebSocket 长链。
- **发送弹幕**：使用当前扫码登录 Session，通过 HTTP `POST https://api.live.bilibili.com/msg/send` 提交。

官方旧版 H5 播放器文档明确列出了 `/msg/send`；当前网页播放器脚本仍调用该地址，但新版请求增加了 **WBI 查询签名**，正文使用 `FormData`，并自动附带 `bili_jct` 对应的 `csrf` 与 `csrf_token`。

## BiliMaku 当前实现

发送命令只面向**当前已经连接的真实直播间号**，不会让前端单独传入另一个隐藏目标房间：

1. 连接直播间时从导航接口取得 WBI 图片密钥并生成混合密钥。
2. 用户在聊天栏输入弹幕并按 Enter 或“发送”。
   输入区与 Rust 后端都按 Unicode 字符计数，当前上限为 40 字。
3. Rust 从内存 Cookie Jar 中读取 `bili_jct`，不把 Cookie 暴露给 React。
4. Rust 为 `/msg/send` 生成 `web_location`、`wts`、`w_rid` 查询参数。
5. 使用 multipart 表单提交普通白色滚动弹幕。
6. 平台返回 `code = 0` 后显示成功状态；自己的弹幕随后仍由既有长链回显，因此前端不会先插入一条可能重复的假消息。

核心表单字段：

| 字段 | 当前值 | 说明 |
| --- | --- | --- |
| `msg` | 用户输入 | 弹幕正文 |
| `roomid` | 当前连接的真实房间号 | 不使用可能存在的短号 |
| `mode` | `1` | 普通滚动弹幕 |
| `bubble` / `room_type` | `0` | 普通文本、普通直播间消息 |
| `fontsize` | `25` | 标准字号 |
| `color` | `16777215` | 白色 `#ffffff` |
| `rnd` | Unix 秒级时间戳 | 与官方播放器请求一致 |
| `data_extend` | `{}` | 新版播放器附带的业务扩展字段 |
| `csrf` / `csrf_token` | `bili_jct` | 登录态请求校验 |

## 权限与边界

- 发送动作使用的是扫码登录账号本人身份；在自己的直播间里就会以主播账号发言。
- 技术上，同一个登录账号也可以向其有权发言的其他直播间发送弹幕。BiliMaku 当前把目标锁定为正在连接的房间，避免 UI 房间与发送房间不一致。
- 最终能否发送、允许的频率、文本长度、禁言状态、等级限制和内容审核都由平台响应决定。
- `code = -101` 时，Rust 会清除失效 Cookie 并广播既有的 `cookie-expired` 账号事件，前端会重新进入扫码登录流程。
- Cookie、`bili_jct` 和 WBI 混合密钥不会写入前端日志或错误提示。

## 稳定性说明

`/msg/send` 属于哔哩哔哩官方 Web 播放器使用的接口，并不是面向第三方承诺长期兼容的开放平台发送 SDK。当前实现把 WBI、CSRF、请求字段和响应解析隔离在 Rust `live/sender.rs`，平台字段变化时只需替换这一层，React 输入组件与接收长链保持不变。

## 官方依据

- [哔哩哔哩直播 WEB 播放器文档：项目内用到的请求接口](https://live.bilibili.com/p/html/bilibili-live-player/docs/player-h5.html)
- [当前直播房间播放器脚本（2026-08-08 页面引用版本）](https://s1.hdslb.com/bfs/static/bilibili-live-player/room-player.98e4d0c0.prod.min.js)
