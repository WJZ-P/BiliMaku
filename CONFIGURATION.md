# bilimaku 统一配置

bilimaku 的运行设置由 Rust `AppConfigStore` 统一管理。配置类型位于 `src-tauri/src/types/config.rs`，内存与磁盘中间层位于 `src-tauri/src/store.rs`。

登录凭据不在本文件范围内：会话 Cookie 由 `src-tauri/src/credentials.rs` 写入操作系统凭据库。

## 文件位置

| 平台 | 路径 |
| --- | --- |
| Windows | `C:\Users\<用户名>\AppData\Roaming\wjz.bilimaku.desktop\config.json` |
| macOS | `~/Library/Application Support/wjz.bilimaku.desktop/config.json` |
| Linux | `~/.config/wjz.bilimaku.desktop/config.json` |

也可以通过 Tauri 命令 `get_config_file_path` 获取当前机器的绝对路径。

## 完整结构

下面是各字段取默认值时的完整形态，与 `AppConfig::default()` 一致。

```json
{
  "schemaVersion": 5,
  "account": {
    "profile": null,
    "savedAt": 0
  },
  "appearance": {
    "theme": "light"
  },
  "live": {
    "roomId": "",
    "autoConnect": false,
    "appearance": {
      "messageBubbleColor": "#66CCFF"
    },
    "messages": {
      "displayFilter": "all",
      "maxStoredMessages": 821
    },
    "activityTotals": {
      "entrances": 0,
      "messages": 0,
      "gifts": 0
    }
  },
  "tts": {
    "settings": {
      "provider": "system",
      "modelId": "",
      "voiceId": "",
      "systemVoiceUri": "",
      "rate": 1.05,
      "pitch": 1.0,
      "volume": 1.0,
      "autoSpeak": true,
      "enabledEventTypes": ["message"]
    },
    "models": [],
    "chineseBertDir": "",
    "environmentCache": []
  },
  "overlay": {
    "settings": null,
    "autoOpen": {
      "danmaku": false,
      "sidebar": false
    },
    "sidebarPlacement": null
  },
  "updatedAt": 0
}
```

### `account`

登录成功后 `profile` 会被填充；`savedAt` 是写入时的 Unix 秒级时间戳。

```json
{
  "profile": {
    "uid": "<UID>",
    "username": "<昵称>",
    "avatar": "<头像地址>",
    "level": 0,
    "currentExp": 0,
    "currentMinExp": 0,
    "nextExp": null,
    "coins": 0.0
  },
  "savedAt": 0
}
```

`uid` 使用字符串保存，避免前端整数精度损失。`nextExp` 为 `null` 表示账号已满级。`coins` 是主站硬币余额，不同于钱包中的 B 币。

### `appearance`

`theme` 可选 `light` 或 `dark`，写入前会被校验，非法值回退为 `light`。

### `live`

| 字段 | 说明 |
| --- | --- |
| `roomId` | 最近一次通过格式校验的房间号 |
| `autoConnect` | 上次退出时是否保持连接；为真时冷启动自动恢复长链 |
| `appearance.messageBubbleColor` | 消息气泡的 `#RRGGBB` 基础主题色 |
| `messages.displayFilter` | 聊天工作台最后选中的消息分类 |
| `messages.maxStoredMessages` | 当前会话内存中保留的最新消息条数，上限 50000 |
| `activityTotals` | 自首次使用以来累计收到的进场、弹幕与礼物数量 |

弹幕内容本身只存在于内存中，不写入本文件；`activityTotals` 只保存计数。

### `tts`

| 字段 | 说明 |
| --- | --- |
| `settings.provider` | 语音来源，可选 `system` 或 `custom` |
| `settings.modelId` / `voiceId` | 当前自定义模型与音色编号 |
| `settings.systemVoiceUri` | 当前系统语音 URI |
| `settings.rate` / `pitch` / `volume` | 语速、音高与音量倍率 |
| `settings.autoSpeak` | 收到符合规则的事件后是否自动播报 |
| `settings.enabledEventTypes` | 允许进入语音队列的事件筛选键 |
| `models` | 已导入模型注册表，元素由 TTS 适配器进一步校验 |
| `chineseBertDir` | 全机共享的 Chinese BERT 模型目录 |
| `environmentCache` | 按模型保存的运行环境检测结果 |

`enabledEventTypes` 的可用取值为 `message`、`gift`、`superchat`、`guard`，以及 `interaction-enter`、`interaction-follow`、`interaction-share`、`interaction-special-follow`、`interaction-mutual-follow`、`interaction-like`。写入时会过滤掉无法识别的键并去重。

`environmentCache` 的每一项形如：

```json
{
  "fingerprint": "<模型/运行时/共享资源/适配器版本指纹>",
  "report": { "...": "完整 Python 环境探测报告" }
}
```

### `overlay`

| 字段 | 说明 |
| --- | --- |
| `settings` | 前端定义的完整悬浮窗设置；首次启动为 `null` 并使用前端默认值 |
| `autoOpen.danmaku` | 启动后恢复全屏滚动弹幕层 |
| `autoOpen.sidebar` | 启动后恢复侧边事件栏 |
| `sidebarPlacement` | 侧边事件栏相对目标显示器工作区的位置 |

`sidebarPlacement` 使用归一化比例而非固定像素，以便在分辨率、DPI 或显示器排列变化后仍能恢复到相近位置：

```json
{
  "monitorName": "<显示器名称>",
  "monitorOriginX": 0,
  "monitorOriginY": 0,
  "xRatio": 1.0,
  "yRatio": 1.0
}
```

## 读写规则

- 启动阶段只读磁盘一次，之后所有查询直接读取内存快照；
- 更新先作用于内存副本，相同值直接结束；
- 有变化时先成功原子落盘，再替换当前内存值；
- 落盘先写 `config.tmp`，再把旧文件移动为 `config.bak`，最后替换正式文件；替换失败时恢复备份；
- 缺失字段由 `#[serde(default)]` 补齐，因此手动删掉某一段不会导致启动失败；
- `schemaVersion` 低于当前版本时自动补写为当前版本，高于当前版本则拒绝启动；
- 用户可以在应用关闭后编辑 JSON；运行期间的磁盘改动不会热加载，且可能被后续写入覆盖；
- 登录 Cookie 不写入本文件，改由操作系统凭据库保管，详见 [隐私与安全说明](PRIVACY.md) 与 [`docs/account-session-persistence.md`](docs/account-session-persistence.md)；
- `account.profile` 虽不是凭据，但会暴露账号身份，分享配置前请自行判断；
- TTS 完整环境探测报告按模型写入 `tts.environmentCache`，模型权重、Python 环境、BERT 或适配器未变化时后续只读取内存缓存；
- `environmentCache` 保存的是诊断结论，不保存运行中的 Python 进程或显存；仅在启用自定义自动播报时冷启动后台预热 Worker；
- 模型、Python/BERT 路径、适配器版本变化或手动点击“重新检查环境”时刷新缓存；
- 软件只读取统一的 `config.json`，首次启动时直接创建默认配置。

## 版本历史

| `schemaVersion` | 变更 |
| --- | --- |
| 5 | 账号 Cookie 移出配置文件，改存操作系统凭据库；`account.cookieHeader` 被移除 |
