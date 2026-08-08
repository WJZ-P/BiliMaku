# bilimaku TTS 架构适配与模型导入

## 1. 设计原则

TTS 模型保留自己的原始目录结构，适配责任属于 bilimaku：

```text
原始模型目录（只读探测）
        ↓
bilimaku TtsModelAdapter 注册表
        ↓
架构识别 → 配置解析 → 权重定位 → 音色枚举
        ↓
统一 TtsModelDescriptor
        ↓
试听 / 自动播报 / 播放队列
```

导入时，bilimaku 只登记目录与识别结果，不向模型目录写入脚本、清单或缓存，也不复制大体积权重。新增 TTS 架构时，应在应用侧增加一个适配器，而不是要求模型作者迁就 bilimaku 的目录格式。

## 2. 适配器注册表

Rust 后端中的每个适配器实现同一条边界：

```rust
trait TtsModelAdapter {
    fn id(&self) -> &'static str;
    fn detect(&self, model_dir: &Path)
        -> Result<Option<TtsModelDescriptor>, String>;
}
```

- `None`：目录不属于该架构，继续尝试下一个适配器；
- `Some(descriptor)`：识别成功，返回模型名、音色、默认音色和推理运行时；
- `Err`：架构已经匹配，但关键配置或权重不完整，直接显示具体诊断。

当前注册顺序：

| 适配器 | 原生探测特征 | 推理入口 |
| --- | --- | --- |
| `bert-vits2` | `config.json`、`data.spk2id`、Bert-VITS2 模型字段、`G_<step>.pth` | bilimaku 内置 Bert-VITS2 Python 适配器 |
| `manifest` | `bilimaku-tts.json`（兼容旧名 `bilicast-tts.json`） | `command` 或 `openai-http` 兼容入口 |

`legacy-manifest` 仅用于兼容已登记的旧模型或快速接入尚未编写原生解析器的架构；它不是普通模型导入的前置条件。

## 3. hoyoTTS / Bert-VITS2 的识别过程

选择原始 `hoyoTTS` 目录后，内置适配器会：

1. 解析原生 `config.json`；
2. 检查 `model.use_spk_conditioned_encoder`、`use_noise_scaled_mas`、`use_duration_discriminator` 等架构特征；
3. 从 `data.spk2id` 按 speaker id 排序生成音色列表；
4. 在存在派蒙音色时将其设为默认值，否则使用首个音色；
5. 选择步数最大的 `G_<step>.pth` 生成器权重；
6. 使用配置、权重文件名和文件大小生成稳定的本地模型 id；
7. 登记识别结果，模型目录全程保持原样。

以仓库当前的 `resources/tss/hoyoTTS` 快照为例，适配器会读取 251 个音色，并定位 `G_78000.pth`。

## 4. 推理适配器的位置

内置 Bert-VITS2 推理代码位于：

```text
src-tauri/resources/tts-adapters/bert-vits2/
├─ infer.py
├─ requirements.txt
└─ upstream/
```

构建时这些文件通过 `include_bytes!` 嵌入 bilimaku。后端把当前版本释放到应用数据目录下的 `tts-adapters/bert-vits2-v2`，随后用选中的原始模型目录作为只读权重来源。

自定义模型被选中后，Rust 会启动一个通过 JSON Lines/stdin/stdout 通信的常驻 Python worker。worker 一次性完成 PyTorch 导入、生成器权重载入、Chinese BERT 载入和 CUDA 预热，然后保留模型与约 1.5 GiB 显存，后续试听和直播播报只发送文本、音色、语速与输出路径。相同模型、Python 和 BERT 组合会复用同一个 worker；切换模型时终止旧 worker，程序退出时由 `kill_on_drop` 回收。

因此需要区分两种耗时：

- **冷启动/预热**：加载 Python、PyTorch、BERT 与音色权重，只发生在程序启动或切换模型后；
- **热推理**：模型驻留显存后的逐句合成。开发机 RTX 5070 Ti 对 23 字测试句的连续实测为 280 ms 与 231 ms。

`inspect_tts_environment` 只服务于环境诊断页面，不再位于每次合成的热路径中。完整探测后，Rust 会把报告与环境指纹保存到统一配置的 `tts.environmentCache`；模型权重、Python 环境、Python/BERT 路径和适配器版本未变化时，后续进入页面直接读取内存缓存，不启动 Python 探针。用户点击“重新检查环境”会显式跳过缓存。

环境报告缓存和运行中的推理 Worker 是两件事：配置文件可以跨进程保留检测结论，Python 进程、模型内存和显存驻留则会在应用退出时被操作系统回收。保存的是自定义模型且开启 `autoSpeak` 时，React 才会在首屏渲染后调用立即返回的 `preload_tts_model`；关闭自动播报后，冷启动不创建 Python Worker，首次试听或进入语音角色页时再按需加载。模型目录检查、适配器释放、Python Worker 启动、BERT 与音色权重加载均由 Tauri 后台任务和独立 Python 进程完成。

Rust 会通过 `tts://preload-status` 向前端同步 `idle`、`queued`、`loading`、`ready`、`error` 五个阶段。顶部状态条与语音角色页都会显示当前结果，也可通过 `get_tts_preload_status` 读取内存快照。显式需要等待完整结果的工具仍可调用 `prepare_tts_model`，冷启动链路不再使用等待式入口。

Python 程序默认使用 PATH 中的 `python`。如需指定虚拟环境，可在启动 bilimaku 前设置：

```powershell
$env:BILIMAKU_TTS_PYTHON = "W:\\path\\to\\venv\\Scripts\\python.exe"
```

中文前端 BERT 可放在以下任一位置：

```text
<model>/bert/chinese-roberta-wwm-ext-large/
<model-parent>/shared/chinese-roberta-wwm-ext-large/
<adapter>/bert/chinese-roberta-wwm-ext-large/
```

也可以通过 `BILIMAKU_TTS_BERT_DIR` 指向已有目录。Python 环境依赖清单位于内置适配器的 `requirements.txt`。

## 5. Rust 环境预检与配置指南

选择自定义模型后，React 页面会调用 Rust 命令 `inspect_tts_environment`。第一次调用或缓存失效时，Bert-VITS2 预检检查：

1. 内置架构适配器是否存在；
2. 实际会使用哪个 Python，以及该解释器能否启动；
3. `torch`、`transformers`、`numba`、中文文本前处理等模块能否真实导入；
4. 中文 BERT 是否同时具备配置、tokenizer 与权重；
5. PyTorch 是否已启用 CUDA，以及当前显卡名称和 CUDA runtime 版本。

后端返回结构化 `TtsEnvironmentReport`，前端逐项显示“就绪 / 待配置 / 提示”，并给出下载页、目标目录和可复制的安装命令。报告及 SHA-256 环境指纹会持久化；缓存命中只做路径与关键文件的轻量校验，不启动 Python。必需项完成前，试听按钮保持锁定；直接调用合成命令时，后端也会聚合返回全部缺项。

Python 版本只设置 `3.10+` 最低线，不写死最高版本。最终判定依赖“目标解释器实际导入整套模块”的结果，因此 Python 3.14 在获得匹配 wheel 后同样可以进入就绪状态。

`chinese-roberta-wwm-ext-large` 是通用文本编码器，同一台电脑上的多个兼容 Bert-VITS2 音色包可以共享一份。只有模型架构明确要求另一种 BERT、维度或 tokenizer 时，才需要登记另一份资源。bilimaku 会校验它必须是 24 层、hidden size 1024，并检查配置、tokenizer 和完整权重，避免误选名称相近的普通 BERT。

Chinese BERT 的发现顺序包括：

1. `BILIMAKU_TTS_BERT_DIR` 显式路径；
2. 用户在语音角色页通过 **选择已有 Chinese BERT** 登记的持久化路径；
3. 模型旁的 `bert/`、共享 `shared/` 和内置适配器资源目录；
4. 音色目录的各级父目录，例如 `W:\data\chinese-roberta-wwm-ext-large`；
5. `BILIMAKU_TTS_RESOURCE_HOME`、`HF_HOME`、`HF_HUB_CACHE`、旧版 `HUGGINGFACE_HUB_CACHE`、`TRANSFORMERS_CACHE`；
6. `MODELSCOPE_CACHE` 与 Hugging Face / ModelScope 默认用户缓存目录。

文件夹选择器既接受模型目录本身，也接受包含 `chinese-roberta-wwm-ext-large` 子目录或 Hugging Face snapshot 的上级目录。校验通过后，路径保存到 bilimaku 统一 `config.json` 的 `tts.chineseBertDir`；推理进程会收到对应的 `BILIMAKU_TTS_BERT_DIR`，因此资源无需复制进每个音色包。

显式设置 `BILIMAKU_TTS_PYTHON` 时以后者为准；项目资源布局下，后端随后自动发现：

```text
<model-parent>/runtime/bert-vits2/Scripts/python.exe
<model-parent>/shared/chinese-roberta-wwm-ext-large/
```

再回退到应用数据目录或 PATH 中的 Python。

## 6. 新增其他模型架构

以 GPT-SoVITS 为例，新增适配器通常包含四部分：

1. `detect`：识别该架构独有的配置与权重组合；
2. `describe`：从原生配置提取模型名称、语言、音色或参考音频槽位；
3. `runtime`：由 bilimaku 自己维护稳定的推理入口；
4. `diagnostics`：报告缺失依赖、配置版本或权重配对问题。

所有适配器统一输出 `TtsModelDescriptor`，因此 React 页面、直播事件播报和播放队列不需要感知具体模型框架。

## 7. 旧版清单兼容入口

对于暂时只有外部命令或本机 HTTP 服务的项目，`bilimaku-tts.json` 可作为兼容入口；旧文件名仍可读取。下面是最小命令示例：

```json
{
  "schemaVersion": 1,
  "id": "local-command-tts",
  "name": "Local command TTS",
  "runtime": {
    "type": "command",
    "program": "python",
    "args": ["infer.py", "--text", "{text}", "--output", "{output}"],
    "outputFormat": "wav",
    "timeoutSeconds": 120
  },
  "voices": [{ "id": "default", "name": "默认", "language": "zh-CN" }],
  "defaultVoice": "default"
}
```

它保留 `{modelDir}`、`{text}`、`{voice}`、`{speed}`、`{output}` 占位符，并继续支持 `command` 与 `openai-http`。这条路径用于兼容和开发调试，原生模型适配仍以应用侧自动探测为主。

## 8. 用户操作流程

1. 保持下载后的模型目录原样；
2. 启动 bilimaku，进入 **语音角色**；
3. 点击 **识别 TTS 模型目录**；
4. 选择包含模型原生配置与权重的目录；
5. bilimaku 自动显示识别到的架构和音色；
6. 选择音色、语速和音量，然后试听或接入直播自动播报。

单次合成文本上限为 2,000 字符，音频上限为 100 MiB，推理超时范围为 5–900 秒。
