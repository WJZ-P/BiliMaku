# BiliMaku Privacy & Security Policy

_Last updated: 2026-09-28 · Applies to BiliMaku 1.0.4 and later_

BiliMaku (哔哩弹幕姬) is a desktop application that connects to Bilibili live rooms and
displays or speaks the events it receives. It runs entirely on the user's own computer.

**The BiliMaku project does not operate any server, does not collect any data, and never
receives any information about its users.** All data described below stays on the user's
machine or travels directly between the user's machine and the third-party services
listed in section 3.

中文版本见本文档后半部分「中文说明」。

---

## 1. What data BiliMaku stores

### 1.1 Bilibili session credentials

When the user signs in by scanning a QR code with the Bilibili mobile app, Bilibili
returns a set of session cookies, including `SESSDATA`, `bili_jct` and `DedeUserID`.
These cookies can act on behalf of the user's Bilibili account and are therefore treated
as credentials.

| Item | Value |
| --- | --- |
| Storage location | Operating-system credential store |
| Windows | Windows Credential Manager (generic credential) |
| macOS | Keychain Services |
| Linux / other *nix | Secret Service (via D-Bus) |
| Service name | `wjz.bilimaku.desktop` |
| Entry name | `bilibili-web-session` |

The credential is written through the [`keyring`](https://crates.io/crates/keyring) crate
and is protected by the operating system under the current user account. **BiliMaku never
writes session cookies to its configuration file, to any log file, or to any other file
on disk.**

If the operating system has no usable credential store (for example a minimal Linux
desktop with no Secret Service provider running), BiliMaku refuses to persist the login
and tells the user that the session will only last for the current run.

### 1.2 Account profile

The following non-credential, display-only information is stored in plain text in the
configuration file so the account card can be rendered without a network round trip at
startup: numeric UID, nickname, avatar URL, account level, experience points and coin
balance.

### 1.3 Application settings

The configuration file also holds: last used room number, auto-connect preference,
interface theme, chat appearance, speech-synthesis preferences, imported voice-model
registry, local model directory paths, overlay window settings, and cumulative counters
of how many danmaku, gifts and entrance events have been received since first use.

The configuration file lives at:

| Platform | Path |
| --- | --- |
| Windows | `%APPDATA%\wjz.bilimaku.desktop\config.json` |
| macOS | `~/Library/Application Support/wjz.bilimaku.desktop/config.json` |
| Linux | `~/.config/wjz.bilimaku.desktop/config.json` |

### 1.4 What is *not* stored

Danmaku, gifts, super chats, guard purchases and interaction events are held in memory
only and are discarded when the application closes. Only the aggregate counters in
section 1.3 survive a restart. BiliMaku writes no log files in release builds.

## 2. Telemetry

**BiliMaku contains no telemetry, no analytics, no crash reporting, no advertising and no
third-party tracking of any kind.** No usage data leaves the user's computer.

The in-app panel labelled 主播数据 (anchor analytics) displays statistics that Bilibili
itself returns about the connected live room. It does not measure the user and reports
nothing to anyone.

## 3. Third-party services that receive data

BiliMaku contacts only the following services, and only for the purposes listed.

### 3.1 Bilibili

Hosts: `passport.bilibili.com`, `api.bilibili.com`, `api.live.bilibili.com`,
`live.bilibili.com`, `www.bilibili.com`, `link.bilibili.com`, `i0.hdslb.com`.

Used for QR-code sign-in, validating the stored session, reading the account profile,
resolving room numbers, opening the danmaku WebSocket connection, sending danmaku the
user types, and loading avatars and emoticons.

When the user is signed in, the session cookies from section 1.1 are sent to Bilibili.
This is inherent to acting on behalf of the account and is the same data the official
Bilibili website sends. Bilibili's own privacy policy governs what Bilibili does with it.
When the user is not signed in, BiliMaku connects anonymously and sends no cookies.

### 3.2 GitHub

Hosts: `api.github.com`, `github.com`.

Used to check for new releases and to download an update when the user chooses to install
one. No account data is transmitted; GitHub sees the request and the user's IP address.

### 3.3 Update mirrors (fallback only)

Hosts: `gh-proxy.com`, `corsproxy.io`.

Direct access to GitHub is unreliable in some regions. If, and only if, the direct
request in section 3.2 fails, BiliMaku retries the same update check through these public
mirrors. They see the update-check request and the user's IP address. **No account data,
cookies or personal information are ever sent through them.** These services are operated
by third parties under their own policies.

### 3.4 Optional local speech synthesis

The optional Bert-VITS2 voice feature runs entirely offline in a local Python process on
the user's machine. BiliMaku does not download models and sends no text to any cloud
speech service. Users who follow the setup guide download model weights themselves using
third-party tooling, outside of BiliMaku.

## 4. Removing stored data

### 4.1 Signing out

Choosing to sign out inside BiliMaku deletes the credential entry from the operating
system credential store and clears the account section of the configuration file. The
same cleanup runs automatically whenever Bilibili reports that the stored session has
expired.

### 4.2 Uninstalling

**Uninstalling BiliMaku does not by itself remove the operating-system credential entry.**
Users who want everything gone should sign out before uninstalling, or remove the entry
manually:

- **Windows** — Control Panel → Credential Manager → Windows Credentials → remove the
  generic credential named `wjz.bilimaku.desktop`.
- **macOS** — Keychain Access → search for `wjz.bilimaku.desktop` → delete the item.
- **Linux** — use the desktop's keyring tool (for example Seahorse / "Passwords and Keys")
  and delete the `wjz.bilimaku.desktop` item.

Deleting the configuration file directory from section 1.3 removes all remaining settings.

## 5. Source code and licence

BiliMaku is free software released under the GNU AGPL v3. Every claim in this document can
be verified against the source at <https://github.com/WJZ-P/BiliMaku>. The credential
handling described in section 1.1 lives in `src-tauri/src/credentials.rs`.

## 6. Contact

Questions and reports: <https://github.com/WJZ-P/BiliMaku/issues>

---

# 中文说明

BiliMaku（哔哩弹幕姬）是一个运行在用户自己电脑上的桌面程序，用于连接哔哩哔哩直播间并展示、
播报收到的事件。

**本项目不运行任何服务器，不收集任何数据，也不会收到关于用户的任何信息。** 下文描述的所有
数据要么留在用户本机，要么在用户本机与第 3 节列出的第三方服务之间直接传输。

## 1. BiliMaku 保存哪些数据

### 1.1 哔哩哔哩登录凭据

用户用哔哩哔哩手机客户端扫码登录后，B 站会下发一组会话 Cookie，其中包含 `SESSDATA`、
`bili_jct` 与 `DedeUserID`。这些 Cookie 可以代表用户账号进行操作，因此按登录凭据对待。

| 项目 | 内容 |
| --- | --- |
| 存储位置 | 操作系统凭据库 |
| Windows | 凭据管理器（通用凭据） |
| macOS | 钥匙串 Keychain |
| Linux 等 *nix | Secret Service（经由 D-Bus） |
| 服务名 | `wjz.bilimaku.desktop` |
| 条目名 | `bilibili-web-session` |

凭据通过 [`keyring`](https://crates.io/crates/keyring) 写入，由操作系统在当前用户账户下
保护。**BiliMaku 不会把会话 Cookie 写入配置文件、日志文件或磁盘上的任何其他文件。**

如果系统没有可用的凭据库（例如未运行 Secret Service 的精简 Linux 桌面），BiliMaku 会拒绝
持久化登录态，并提示用户本次登录仅在本次运行内有效。

### 1.2 账号资料

以下不属于凭据、仅用于界面展示的信息会以明文保存在配置文件中，以便启动时无需联网即可渲染
账号卡片：数字 UID、昵称、头像地址、账号等级、经验值与硬币余额。

### 1.3 应用设置

配置文件还保存：最近使用的房间号、自动连接偏好、界面主题、聊天区外观、语音播报偏好、已导入
的音色模型注册表、本地模型目录路径、悬浮窗设置，以及自首次使用以来累计收到的弹幕、礼物和
进场事件数量。

配置文件位置：

| 平台 | 路径 |
| --- | --- |
| Windows | `%APPDATA%\wjz.bilimaku.desktop\config.json` |
| macOS | `~/Library/Application Support/wjz.bilimaku.desktop/config.json` |
| Linux | `~/.config/wjz.bilimaku.desktop/config.json` |

### 1.4 不会保存的内容

弹幕、礼物、醒目留言、大航海与互动事件只保存在内存中，程序关闭即丢弃，只有第 1.3 节中的
累计计数会跨重启保留。正式构建不写任何日志文件。

## 2. 遥测

**BiliMaku 不含任何遥测、统计分析、崩溃上报、广告或第三方追踪。** 没有任何使用数据离开用户
的电脑。

应用内的「主播数据」面板展示的是哔哩哔哩自己返回的直播间统计数据，不针对用户进行任何测量，
也不向任何人上报。

## 3. 会收到数据的第三方服务

BiliMaku 只访问下列服务，且仅用于所列用途。

### 3.1 哔哩哔哩

域名：`passport.bilibili.com`、`api.bilibili.com`、`api.live.bilibili.com`、
`live.bilibili.com`、`www.bilibili.com`、`link.bilibili.com`、`i0.hdslb.com`。

用于扫码登录、校验已保存的登录态、读取账号资料、解析房间号、建立弹幕长链、发送用户输入的
弹幕，以及加载头像和表情。

用户登录后，第 1.1 节中的会话 Cookie 会发送给哔哩哔哩。这是代表账号操作所必需的，与哔哩哔哩
官方网页端发送的数据相同，其后续处理适用哔哩哔哩自己的隐私政策。用户未登录时，BiliMaku 以
匿名方式连接，不发送任何 Cookie。

### 3.2 GitHub

域名：`api.github.com`、`github.com`。

用于检查新版本，以及在用户选择安装更新时下载更新包。不传输任何账号数据；GitHub 可以看到该
请求与用户 IP 地址。

### 3.3 更新加速镜像（仅作兜底）

域名：`gh-proxy.com`、`corsproxy.io`。

部分地区直连 GitHub 不稳定。**当且仅当**第 3.2 节的直连请求失败时，BiliMaku 才会通过这些公共
镜像重试同一个更新检查。它们可以看到更新检查请求与用户 IP 地址。**不会有任何账号数据、Cookie
或个人信息经过它们。** 这些服务由第三方运营，适用其自身政策。

### 3.4 可选的本地语音合成

可选的 Bert-VITS2 音色功能完全离线运行在用户本机的 Python 进程中。BiliMaku 不下载模型，也不会
把任何文本发送到云端语音服务。按照安装指南下载模型权重是用户自己使用第三方工具完成的，发生在
BiliMaku 之外。

## 4. 删除已保存的数据

### 4.1 退出登录

在 BiliMaku 中退出登录会删除操作系统凭据库中的条目，并清空配置文件中的账号段。哔哩哔哩报告
登录态失效时，也会自动执行同样的清理。

### 4.2 卸载

**卸载 BiliMaku 本身不会删除操作系统凭据库中的条目。** 希望彻底清除的用户应当先退出登录再
卸载，或手动删除该条目：

- **Windows** —— 控制面板 → 凭据管理器 → Windows 凭据 → 删除名为 `wjz.bilimaku.desktop` 的
  通用凭据。
- **macOS** —— 钥匙串访问 → 搜索 `wjz.bilimaku.desktop` → 删除该项。
- **Linux** —— 使用桌面环境的密钥工具（例如 Seahorse「密码和密钥」）删除 `wjz.bilimaku.desktop`
  条目。

删除第 1.3 节中的配置目录即可清除其余全部设置。

## 5. 源代码与许可证

BiliMaku 是基于 GNU AGPL v3 发布的自由软件。本文档中的每一条陈述都可以对照
<https://github.com/WJZ-P/BiliMaku> 的源代码核实。第 1.1 节描述的凭据处理位于
`src-tauri/src/credentials.rs`。

## 6. 联系方式

问题与反馈：<https://github.com/WJZ-P/BiliMaku/issues>
