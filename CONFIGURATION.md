# bilimaku 统一配置

bilimaku 的运行设置由 Rust `AppConfigStore` 统一管理。配置类型位于 `src-tauri/src/types/config.rs`，内存与磁盘中间层位于 `src-tauri/src/store.rs`。

## 文件位置

```text
C:\Users\<用户名>\AppData\Roaming\wjz.bilimaku.desktop\config.json
```

也可以通过 Tauri 命令 `get_config_file_path` 获取当前机器的绝对路径。

## 完整结构

```json
{
  "schemaVersion": 1,
  "account": {
    "cookieHeader": "<COOKIE>",
    "profile": {
      "uid": "<UID>",
      "username": "<昵称>",
      "avatar": "<头像地址>"
    },
    "savedAt": 0
  },
  "live": {
    "roomId": "4457340"
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
      "autoSpeak": true
    },
    "models": [],
    "chineseBertDir": "",
    "environmentCache": []
  },
  "overlay": {
    "settings": null
  },
  "updatedAt": 0
}
```

## 读写规则

- 启动阶段只读磁盘一次，之后所有查询直接读取内存快照；
- 更新先作用于内存副本，相同值直接结束；
- 有变化时先成功原子落盘，再替换当前内存值；
- 用户可以在应用关闭后编辑 JSON；
- Cookie 是明文敏感信息，不应提交到版本库或分享给他人；
- TTS 完整环境探测报告按模型写入 `tts.environmentCache`，模型权重、Python 环境、BERT 或适配器未变化时后续只读取内存缓存；
- `environmentCache` 保存的是诊断结论，不保存运行中的 Python 进程或显存；仅在启用自定义自动播报时冷启动后台预热 Worker；
- 模型、Python/BERT 路径、适配器版本变化或手动点击“重新检查环境”时刷新缓存；
- 当前 Demo 只读取统一的 `config.json`，首次启动时直接创建默认配置。
