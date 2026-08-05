# BiliCast 自定义 TTS 模型包

## 1. 设计目标

BiliCast 把“模型目录”和“如何推理”拆开：模型仍保存在用户选择的位置，应用只登记目录、读取 `bilicast-tts.json`，并把文本交给对应运行时。系统语音和自定义模型最终进入同一条播放队列，因此自动播报、暂停、继续、停止和试听使用一致的界面。

目前提供两种运行时：

| 运行时 | 适合场景 | BiliCast 的职责 |
| --- | --- | --- |
| `command` | ModelScope 项目、CosyVoice、GPT-SoVITS、模型自带 Python 推理脚本 | 逐参数启动本机进程，等待音频文件并播放 |
| `openai-http` | 已启动的本机 TTS 服务、OpenAI `/v1/audio/speech` 兼容服务 | 发送 JSON，请求返回的音频并播放 |

不同 TTS 权重使用的推理框架、声学前后处理和音色参数并不一致。首版采用“清单 + 适配器”作为稳定边界，不对权重格式作猜测；模型项目只需提供一个很薄的启动脚本或 HTTP 服务。

## 2. ModelScope 现状

ModelScope 目前仍有独立的[文本转语音模型分类](https://modelscope.cn/models?page=1&tasks=text-to-speech)，可以找到 [Qwen3-TTS 1.7B](https://modelscope.cn/models/Qwen/Qwen3-TTS-12Hz-1.7B-Base)、[Qwen3-TTS 0.6B CustomVoice](https://www.modelscope.cn/models/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice/feedback)、[CosyVoice2](https://modelscope.cn/models/gpustack/CosyVoice2-0.5B) 和 [GPT-SoVITS WebTTS](https://modelscope.cn/models/mingwuyan/gpt-sovits-webtts) 等项目。ModelScope 的[开源 SDK](https://github.com/modelscope/modelscope)支持通过 SDK 或 Git 获取模型。

下载模型后，优先按照模型页提供的依赖版本和推理示例准备 Python 环境，再把官方推理入口包装成下面任意一种运行时。这样能保留每个项目自己的环境约束，也让 BiliCast UI 与具体模型解耦。

## 3. 导入目录

一个可导入目录至少包含：

```text
my-tts-model/
├─ bilicast-tts.json       # 必需，BiliCast 清单
├─ infer.py                # command 运行时示例入口
├─ config/                 # 模型自己的配置
└─ weights/                # 模型自己的权重
```

导入只登记该目录，不复制或删除模型文件。移除登记同样会保留原目录。

## 4. `command` 清单

```json
{
  "schemaVersion": 1,
  "id": "my-cosyvoice",
  "name": "我的 CosyVoice",
  "description": "本机中文直播音色",
  "version": "1.0.0",
  "author": "local",
  "runtime": {
    "type": "command",
    "program": "C:/tts-env/python.exe",
    "args": [
      "infer.py",
      "--model-dir", "{modelDir}",
      "--text", "{text}",
      "--voice", "{voice}",
      "--speed", "{speed}",
      "--output", "{output}"
    ],
    "outputFormat": "wav",
    "timeoutSeconds": 120
  },
  "voices": [
    { "id": "xiaolan", "name": "小蓝", "language": "zh-CN" }
  ],
  "defaultVoice": "xiaolan"
}
```

可用占位符：

- `{modelDir}`：导入目录的绝对路径；
- `{text}`：本次待合成文本；
- `{output}`：BiliCast 生成的临时音频绝对路径；
- `{voice}`：界面选择的音色 ID；
- `{speed}`：界面设置的语速，范围 `0.25-4.0`。

每个 `args` 元素作为独立进程参数传递，不经过 shell。推理脚本需要在成功退出前把 `wav`、`mp3`、`ogg` 或 `flac` 音频写入 `{output}`。`program` 可以是系统 PATH 中的程序、绝对路径，也可以是模型目录内的相对可执行文件。

仓库内的 [`examples/tts-model/command-smoke-test`](../examples/tts-model/command-smoke-test) 是一个零第三方依赖的可导入目录。它生成测试 WAV，用于先验证“选目录 → 启动进程 → 返回音频 → 播放”整条链路。

## 5. `openai-http` 清单

```json
{
  "schemaVersion": 1,
  "id": "local-http-tts",
  "name": "本机 HTTP TTS",
  "runtime": {
    "type": "openai-http",
    "endpoint": "http://127.0.0.1:8000/v1/audio/speech",
    "model": "local-tts",
    "apiKeyEnv": "LOCAL_TTS_API_KEY",
    "responseFormat": "wav",
    "timeoutSeconds": 120
  },
  "voices": [
    { "id": "default", "name": "默认音色", "language": "zh-CN" }
  ],
  "defaultVoice": "default"
}
```

BiliCast 发送：

```json
{
  "model": "local-tts",
  "input": "需要播报的文本",
  "voice": "default",
  "response_format": "wav",
  "speed": 1.0
}
```

服务应直接返回音频字节。`apiKeyEnv` 留空时不发送鉴权头；填写后从启动 BiliCast 的环境变量读取值，并使用 Bearer 头发送。

## 6. 操作流程

1. 准备模型依赖，先在命令行跑通模型自己的单句推理。
2. 在模型目录加入 `bilicast-tts.json`；命令模式还要确认脚本写入 `{output}`。
3. 启动 BiliCast，进入 **语音角色**。
4. 点击 **导入 TTS 模型包**，选择包含清单的目录。
5. 选择模型、音色、语速和音量，在试听框点击 **播放试听**。
6. 开启 **新事件自动播报** 后，直播事件会自动走所选模型。

命令运行时会启动清单指定的本机程序，因此导入动作等同于登记一个推理入口；使用自己确认来源与内容的模型目录即可。单次文本上限为 2,000 字符，音频上限为 100 MiB，超时时间可配置为 5-900 秒。

## 7. ModelScope 项目适配建议

对已经下载的模型，保留项目原来的虚拟环境，在 `infer.py` 中完成三件事：

1. 在进程启动后加载 `{modelDir}` 下的权重；
2. 接收 `{text}`、`{voice}`、`{speed}`；
3. 将最终波形写到 `{output}`。

模型加载较慢时，更适合先启动常驻 HTTP 服务，再使用 `openai-http` 清单，避免每条弹幕都重新载入权重。后续可以继续增加进程常驻协议，而不改动语音页面和直播播报队列。
