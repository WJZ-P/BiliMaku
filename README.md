<p align="center">
  <img src="public/icon.png" alt="BiliMaku" width="256" />
</p>

<h1 align="center">BiliMaku · 哔哩弹幕姬</h1>

<p align="center">基于 React、Rust 与 Tauri 2 的桌面直播小工具！支持弹幕的播报、滚动等功能。</p>

<p align="center">
  <a href="https://github.com/WJZ-P/BiliMaku/releases"><img src="https://img.shields.io/github/v/release/WJZ-P/BiliMaku?label=release" alt="Release" /></a>
  <a href="https://github.com/WJZ-P/BiliMaku/actions/workflows/release.yml"><img src="https://github.com/WJZ-P/BiliMaku/actions/workflows/release.yml/badge.svg" alt="Release workflow" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="AGPL-3.0" /></a>
</p>

<p align="center">
  <a href="https://www.bilibili.com/video/BV1Yx411T7Uz">
    <img src="https://i0.hdslb.com/bfs/material_up/a704cbc91a40b39ea3c66b33daed66ce683d53fe.jpg" alt="CONNECT~心的连接~">
  </a>
</p>
<h2 align="center">"歌唱着BILIBILI 跟我一起 探寻这美丽的天地"</h2>

## UI展示

<p align="center">
  <a href="https://www.bilibili.com/video/BV1Yx411T7Uz">
    <img src="markdown/qrscan.png" alt="CONNECT~心的连接~" width="500">
  </a>
</p>

<h3 align="center">登录UI</h3>

---

<p align="center">
  <a href="https://www.bilibili.com/video/BV1Yx411T7Uz">
    <img src="markdown/ui1.png" alt="CONNECT~心的连接~" width="600">
  </a>
</p>

<h3 align="center">直播间界面，支持发送文字、表情，接受各种消息</h3>

---

<p align="center">
  <a href="https://www.bilibili.com/video/BV1Yx411T7Uz">
    <img src="markdown/ui2.png" alt="CONNECT~心的连接~" width="300">
  </a>
</p>

<h3 align="center">侧边栏悬浮窗，接受入场、礼物、弹幕等消息</h3>

---

<p align="center">
  <a href="https://www.bilibili.com/video/BV1Yx411T7Uz">
    <img src="markdown/ui3.png" alt="CONNECT~心的连接~" width="300">
  </a>
</p>

<h3 align="center">全屏滚动弹幕，就像哔哩哔哩！</h3>

---

<p align="center">
  <a href="https://www.bilibili.com/video/BV1Yx411T7Uz">
    <img src="markdown/ui4.png" alt="CONNECT~心的连接~" width="600">
  </a>
</p>

<h3 align="center">支持丰富的自定义选项！</h3>

---

<p align="center">
  <a href="https://www.bilibili.com/video/BV1Yx411T7Uz">
    <img src="markdown/ui5.png" alt="CONNECT~心的连接~" width="600">
  </a>
</p>

<h3 align="center">支持自定义导入bert-vits2模型进行弹幕播报</h3>

---

## 功能

- 扫码登录并恢复本地会话；
- 连接直播间，接收弹幕、礼物、SC、大航海与互动事件；
- 使用系统语音或本地 Bert-VITS2 自定义音色播报；
- 提供全屏滚动弹幕与透明侧边事件悬浮窗；
- 支持浅色模式、深色模式与 WebGL 界面动效。

> Release 不包含 PyTorch、BERT、音色权重或用户 Cookie。

## 安装 BERT-VITS2 自定义音色

BiliMaku 内置了 BERT-VITS2 架构适配器，可以直接识别模型原本的 `config.json`、`data.spk2id` 与 `G_<step>.pth`，无需向模型目录添加 BiliMaku 专用清单。下面以魔搭社区的 [Genius-Society/hoyoTTS](https://modelscope.cn/models/Genius-Society/hoyoTTS) 为例；该模型包含《原神》和《崩坏：星穹铁道》的多角色音色。模型权重由第三方提供，下载与使用时请同时遵守模型页面标注的许可证和使用约定。

> 以下命令以 Windows PowerShell 为例。模型、Python 环境和 Chinese BERT 均保存在应用目录之外，升级 BiliMaku 时无需重新下载。

### 1. 准备目录与 Python

推荐把音色模型、共享 BERT 和 Python 虚拟环境放在同一个根目录：

```text
D:\BiliMaku-TTS\
├─ hoyoTTS\
├─ shared\
│  └─ chinese-roberta-wwm-ext-large\
└─ runtime\
   └─ bert-vits2\
      └─ Scripts\python.exe
```

BiliMaku 支持 Python 3.10 及以上版本；推荐使用 Python 3.11 或 3.12 创建独立环境：

```powershell
$root = "D:\BiliMaku-TTS"
py -3.11 -m venv "$root\runtime\bert-vits2"
$python = "$root\runtime\bert-vits2\Scripts\python.exe"
& $python -m pip install --upgrade pip modelscope
```

如果模型与运行时采用上述相对位置，BiliMaku 会自动找到这个 Python。放在其他位置时，可以设置用户环境变量，重新启动 BiliMaku 后生效：

```powershell
[Environment]::SetEnvironmentVariable(
  "BILIMAKU_TTS_PYTHON",
  "D:\BiliMaku-TTS\runtime\bert-vits2\Scripts\python.exe",
  "User"
)
```

### 2. 下载 hoyoTTS 音色模型

使用 ModelScope CLI 下载到指定目录：

```powershell
$modelscope = "D:\BiliMaku-TTS\runtime\bert-vits2\Scripts\modelscope.exe"
& $modelscope download `
  --model "Genius-Society/hoyoTTS" `
  --local_dir "D:\BiliMaku-TTS\hoyoTTS"
```

也可以使用模型页给出的 Python SDK：

```python
from modelscope import snapshot_download

model_dir = snapshot_download(
    "Genius-Society/hoyoTTS",
    local_dir=r"D:\BiliMaku-TTS\hoyoTTS",
)
print(model_dir)
```

下载结束后，`hoyoTTS` 根目录中应能看到 `config.json`、生成器权重 `G_<step>.pth`，并且配置中的 `data.spk2id` 包含音色映射。Git 克隆方式还需要 Git LFS；使用 ModelScope CLI/SDK 可以直接取得完整权重。

### 3. 安装 PyTorch 与推理依赖

首先选择一种 PyTorch。NVIDIA 显卡示例：

```powershell
$python = "D:\BiliMaku-TTS\runtime\bert-vits2\Scripts\python.exe"
& $python -m pip install torch --index-url https://download.pytorch.org/whl/cu128
```

纯 CPU 环境使用：

```powershell
& $python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
```

PyTorch 的 CUDA wheel 自带所需 CUDA runtime，通常只需保证 NVIDIA 驱动可用。随后安装 BiliMaku 内置适配器需要的其余依赖：

```powershell
& $python -m pip install `
  "transformers>=4.45,<5" `
  "huggingface_hub>=0.34,<1" `
  numpy cn2an jieba numba pypinyin requests scipy tqdm
```

### 4. 下载共享 Chinese BERT

BERT-VITS2 的中文文本特征依赖 `chinese-roberta-wwm-ext-large`。同一台电脑上的多个兼容音色包可以共享这一份资源：

```powershell
$modelscope = "D:\BiliMaku-TTS\runtime\bert-vits2\Scripts\modelscope.exe"
& $modelscope download `
  --model "dienstag/chinese-roberta-wwm-ext-large" `
  --local_dir "D:\BiliMaku-TTS\shared\chinese-roberta-wwm-ext-large"
```

资源目录至少需要包含：

```text
chinese-roberta-wwm-ext-large/
├─ config.json
├─ tokenizer.json 或 vocab.txt
└─ model.safetensors 或 pytorch_model.bin
```

放在推荐的 `shared/` 目录时会被自动发现；放在其他位置时，可在 BiliMaku 的 **语音角色 → 选择 Chinese BERT** 中登记文件夹。登记结果会持久化，无需复制到每个音色模型中。

### 5. 在 BiliMaku 中导入并播报

1. 打开 **语音角色** 页面，点击 **导入模型**；
2. 选择 `D:\BiliMaku-TTS\hoyoTTS`，即包含 `config.json` 和 `G_<step>.pth` 的模型根目录；
3. 等待 BiliMaku 自动识别 BERT-VITS2 架构并列出全部音色；
4. 在 **运行环境** 卡片中点击 **重新检查环境**，按提示补齐仍缺少的项目；
5. 选择音色并试听，确认成功后开启 **自动语音播报**，再勾选需要播报的弹幕、关注、礼物等事件。

第一次试听需要加载 PyTorch、Chinese BERT 与音色权重，耗时会明显高于后续播报；环境就绪后，BiliMaku 会复用常驻推理进程。更详细的目录探测、环境缓存与适配器说明见 [TTS 架构文档](docs/tts-model-package.md)。

常见问题：

- **导入后没有出现模型**：确认选择的是模型根目录，并检查 `G_<step>.pth` 是否为完整权重而非 Git LFS 指针；
- **提示缺少 Chinese BERT**：在语音角色页重新选择 `chinese-roberta-wwm-ext-large` 文件夹；
- **推理速度较慢**：查看运行环境是否显示 `GPU 就绪`；CPU 推理会明显更慢；
- **安装了依赖仍提示缺失**：确认安装依赖使用的 Python 与运行环境卡片显示的是同一个解释器。

## 开发

需要 Node.js 22、npm、Rust stable、Microsoft C++ Build Tools 和 WebView2 Runtime。

```powershell
git clone https://github.com/WJZ-P/BiliMaku.git
cd BiliMaku
npm ci
npm run tauri:dev
```

检查项目：

```powershell
npm run check
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

## 发布

推送 `vMAJOR.MINOR.PATCH` 格式的 Git Tag 后，`.github/workflows/release.yml` 会校验所有版本号，构建 Windows、Linux 与 macOS 产物（Windows 同时提供 NSIS、MSI 和免安装 ZIP），并创建同名 Release：

```powershell
git tag v1.0.0
git push origin v1.0.0
```

Release 标题仅使用 Tag，例如 `v1.0.0`。

## License

[GNU AGPL v3](LICENSE)

## ⭐ Star 历史


**如果你喜欢这个项目，请给个 ⭐ 吧(๑>◡<๑)！**

[![Stargazers over time](https://starchart.cc/WJZ-P/BiliMaku.svg?variant=adaptive)](https://starchart.cc/WJZ-P/BiliMaku)

## 友情链接

- [LINUX DO](https://linux.do/)
