from __future__ import annotations

import argparse
import ctypes
import gc
import json
import os
import re
import sys
import time
import wave
from pathlib import Path
from typing import Any


IPC_PREFIX = "BILIMAKU_TTS_IPC:"
MIB = 1024 * 1024
MIN_COMMIT_HEADROOM_MB = 1024
MEMORY_CLEANUP_HEADROOM_MB = 2048
MIN_GPU_HEADROOM_MB = 768


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="bilimaku Bert-VITS2 adapter")
    parser.add_argument("--model-dir", required=True)
    parser.add_argument("--worker", action="store_true")
    parser.add_argument("--text")
    parser.add_argument("--voice")
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--output")
    return parser.parse_args()


def find_bert_dir(model_dir: Path, adapter_dir: Path) -> Path | None:
    configured = (
        os.environ.get("BILIMAKU_TTS_BERT_DIR", "").strip()
        or os.environ.get("BILICAST_TTS_BERT_DIR", "").strip()
    )
    candidates = [
        Path(configured) if configured else None,
        model_dir / "bert" / "chinese-roberta-wwm-ext-large",
        model_dir.parent / "shared" / "chinese-roberta-wwm-ext-large",
        adapter_dir / "bert" / "chinese-roberta-wwm-ext-large",
    ]
    for candidate in candidates:
        if candidate and (candidate / "config.json").is_file():
            return candidate.resolve()
    return None


def checkpoint_path(model_dir: Path) -> Path:
    checkpoints = list(model_dir.glob("G_*.pth"))
    if not checkpoints:
        raise RuntimeError(f"No G_*.pth generator checkpoint found in {model_dir}")

    def checkpoint_step(path: Path) -> int:
        match = re.search(r"G_(\d+)\.pth$", path.name)
        return int(match.group(1)) if match else -1

    return max(checkpoints, key=checkpoint_step)


def elapsed_ms(start: float) -> int:
    return round((time.perf_counter() - start) * 1000)


def system_memory_status() -> dict[str, int | float]:
    """读取 Windows 系统提交内存余量；其他系统返回空字典。"""
    if sys.platform != "win32":
        return {}

    class MemoryStatusEx(ctypes.Structure):
        _fields_ = [
            ("dwLength", ctypes.c_ulong),
            ("dwMemoryLoad", ctypes.c_ulong),
            ("ullTotalPhys", ctypes.c_ulonglong),
            ("ullAvailPhys", ctypes.c_ulonglong),
            ("ullTotalPageFile", ctypes.c_ulonglong),
            ("ullAvailPageFile", ctypes.c_ulonglong),
            ("ullTotalVirtual", ctypes.c_ulonglong),
            ("ullAvailVirtual", ctypes.c_ulonglong),
            ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
        ]

    status = MemoryStatusEx()
    status.dwLength = ctypes.sizeof(MemoryStatusEx)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
        return {}
    total_commit = round(status.ullTotalPageFile / MIB)
    available_commit = round(status.ullAvailPageFile / MIB)
    return {
        "physicalAvailableMb": round(status.ullAvailPhys / MIB),
        "commitLimitMb": total_commit,
        "commitAvailableMb": available_commit,
        "commitUsedPercent": round(
            ((total_commit - available_commit) / max(1, total_commit)) * 100, 1
        ),
    }


def emit_ipc(payload: dict[str, Any]) -> None:
    print(f"{IPC_PREFIX}{json.dumps(payload, ensure_ascii=False)}", flush=True)


class BertVits2Engine:
    def __init__(self, model_dir: Path):
        started = time.perf_counter()
        self.model_dir = model_dir.resolve()
        self.adapter_dir = Path(__file__).resolve().parent
        runtime_dir = self.adapter_dir / "upstream"
        if not runtime_dir.is_dir():
            raise RuntimeError(f"Bert-VITS2 runtime source is missing: {runtime_dir}")

        bert_dir = find_bert_dir(self.model_dir, self.adapter_dir)
        if bert_dir is None:
            raise RuntimeError(
                "Chinese BERT resources are not installed. Select a complete "
                "chinese-roberta-wwm-ext-large directory in bilimaku."
            )

        os.environ["BILIMAKU_TTS_MODEL_DIR"] = str(self.model_dir)
        os.environ["BILIMAKU_TTS_BERT_DIR"] = str(bert_dir)
        sys.path.insert(0, str(runtime_dir))

        import_started = time.perf_counter()
        try:
            import numpy as np
            import torch
            import commons
            import utils
            from models import SynthesizerTrn
            from text import cleaned_text_to_sequence, get_bert
            from text.cleaner import clean_text
            from text.symbols import symbols
        except ModuleNotFoundError as error:
            raise RuntimeError(
                f"Missing Bert-VITS2 Python dependency: {error.name}. "
                "Install the built-in adapter requirements.txt in the selected runtime."
            ) from error

        self.np = np
        self.torch = torch
        self.commons = commons
        self.cleaned_text_to_sequence = cleaned_text_to_sequence
        self.get_bert = get_bert
        self.clean_text = clean_text
        self.timings: dict[str, int] = {"importsMs": elapsed_ms(import_started)}

        self.hps = utils.get_hparams_from_dir(str(self.model_dir))
        self.default_voice = "派蒙"
        if self.default_voice not in self.hps.data.spk2id:
            self.default_voice = next(iter(self.hps.data.spk2id))

        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        if self.device.startswith("cuda"):
            torch.set_float32_matmul_precision("high")
            torch.backends.cuda.matmul.allow_tf32 = True
            torch.backends.cudnn.allow_tf32 = True

        generator_started = time.perf_counter()
        self.generator = SynthesizerTrn(
            len(symbols),
            self.hps.data.filter_length // 2 + 1,
            self.hps.train.segment_size // self.hps.data.hop_length,
            n_speakers=self.hps.data.n_speakers,
            **self.hps.model,
        ).to(self.device)
        self.generator.eval()
        utils.load_checkpoint(
            str(checkpoint_path(self.model_dir)),
            self.generator,
            None,
            skip_optimizer=True,
        )
        self.timings["generatorLoadMs"] = elapsed_ms(generator_started)

        # Chinese BERT is imported lazily by upstream text.get_bert. Import it now
        # so the worker reports ready only after its 1.3 GB weights are on the GPU.
        bert_started = time.perf_counter()
        __import__("text.chinese_bert")
        self._synchronize()
        self.timings["bertLoadMs"] = elapsed_ms(bert_started)

        # Run one tiny synthesis to initialize CUDA kernels. User requests after the
        # ready message then measure warm inference rather than one-time setup work.
        warmup_started = time.perf_counter()
        self.synthesize_audio("你好", self.default_voice, 1.0)
        self._synchronize()
        self.timings["warmupMs"] = elapsed_ms(warmup_started)
        # 加载 checkpoint 与首次推理会留下可回收的 Python/CUDA 缓存。常驻
        # worker 只保留模型本体，避免空闲时继续占用系统提交内存和显存余量。
        gc.collect()
        if self.device.startswith("cuda"):
            self.torch.cuda.empty_cache()
        self.timings["totalLoadMs"] = elapsed_ms(started)

    def _synchronize(self) -> None:
        if self.device.startswith("cuda"):
            self.torch.cuda.synchronize()

    def memory_status(self) -> dict[str, Any]:
        status: dict[str, Any] = system_memory_status()
        if self.device.startswith("cuda"):
            free_bytes, total_bytes = self.torch.cuda.mem_get_info()
            status.update(
                {
                    "gpuAllocatedMb": round(self.torch.cuda.memory_allocated(0) / MIB),
                    "gpuReservedMb": round(self.torch.cuda.memory_reserved(0) / MIB),
                    "gpuPeakAllocatedMb": round(
                        self.torch.cuda.max_memory_allocated(0) / MIB
                    ),
                    "gpuFreeMb": round(free_bytes / MIB),
                    "gpuTotalMb": round(total_bytes / MIB),
                }
            )
        return status

    def protect_memory_headroom(self) -> dict[str, Any]:
        """低内存时主动归还缓存，并在原生分配崩溃前返回可读错误。"""
        status = self.memory_status()
        commit_available = int(status.get("commitAvailableMb", 0))
        gpu_free = int(status.get("gpuFreeMb", 0))
        should_cleanup = (
            0 < commit_available < MEMORY_CLEANUP_HEADROOM_MB
            or 0 < gpu_free < MIN_GPU_HEADROOM_MB * 2
        )
        if should_cleanup:
            gc.collect()
            if self.device.startswith("cuda"):
                self.torch.cuda.empty_cache()
            status = self.memory_status()
            status["cacheReleased"] = True
        else:
            status["cacheReleased"] = False

        commit_available = int(status.get("commitAvailableMb", 0))
        gpu_free = int(status.get("gpuFreeMb", 0))
        if 0 < commit_available < MIN_COMMIT_HEADROOM_MB:
            raise RuntimeError(
                "系统提交内存余量过低（"
                f"{commit_available} MiB）；请关闭高内存程序或增大 Windows 页面文件后重试"
            )
        if self.device.startswith("cuda") and 0 < gpu_free < MIN_GPU_HEADROOM_MB:
            raise RuntimeError(
                f"CUDA 显存余量过低（{gpu_free} MiB）；请关闭占用显卡的程序后重试"
            )
        return status

    def prepare_text(self, value: str):
        normalized, phone, tone, word2ph = self.clean_text(value, "ZH")
        phone, tone, language = self.cleaned_text_to_sequence(phone, tone, "ZH")
        if self.hps.data.add_blank:
            phone = self.commons.intersperse(phone, 0)
            tone = self.commons.intersperse(tone, 0)
            language = self.commons.intersperse(language, 0)
            word2ph = [count * 2 for count in word2ph]
            word2ph[0] += 1
        bert = self.get_bert(normalized, word2ph, "ZH")
        return (
            bert,
            self.torch.LongTensor(phone),
            self.torch.LongTensor(tone),
            self.torch.LongTensor(language),
        )

    def synthesize_audio(self, text: str, voice: str, speed: float):
        voice = voice.strip() or self.default_voice
        if voice not in self.hps.data.spk2id:
            raise RuntimeError(f"Unknown hoyoTTS voice: {voice}")

        segments = [
            item.strip()
            for item in re.split(r"[。；！？？，、\n\r\t.!;?~]+", text)
            if item.strip()
        ]
        if not segments:
            raise RuntimeError("TTS text is empty after normalization")

        speed = min(4.0, max(0.25, speed))
        speaker = self.torch.LongTensor([self.hps.data.spk2id[voice]]).to(self.device)
        generated = []
        with self.torch.inference_mode():
            for segment in segments:
                bert, phones, tones, languages = self.prepare_text(segment)
                phones = phones.to(self.device).unsqueeze(0)
                tones = tones.to(self.device).unsqueeze(0)
                languages = languages.to(self.device).unsqueeze(0)
                bert = bert.to(self.device).unsqueeze(0)
                lengths = self.torch.LongTensor([phones.size(1)]).to(self.device)
                audio = self.generator.infer(
                    phones,
                    lengths,
                    speaker,
                    tones,
                    languages,
                    bert,
                    sdp_ratio=0.2,
                    noise_scale=0.6,
                    noise_scale_w=0.8,
                    length_scale=1.0 / speed,
                )[0][0, 0].data.cpu().float().numpy()
                generated.append(audio)

        silence = self.np.zeros(
            int(self.hps.data.sampling_rate * 0.18), dtype=self.np.float32
        )
        combined = generated[0]
        for audio in generated[1:]:
            combined = self.np.concatenate((combined, silence, audio))
        return combined

    def synthesize_to_file(
        self, text: str, voice: str, speed: float, output: Path
    ) -> dict[str, Any]:
        started = time.perf_counter()
        memory_before = self.protect_memory_headroom()
        if self.device.startswith("cuda"):
            self.torch.cuda.reset_peak_memory_stats(0)
        audio = self.synthesize_audio(text, voice, speed)
        self._synchronize()
        inference_ms = elapsed_ms(started)

        write_started = time.perf_counter()
        waveform = self.np.asarray(audio, dtype=self.np.float32)
        waveform = self.np.clip(waveform, -1.0, 1.0)
        pcm = (waveform * 32767.0).astype("<i2")
        output = output.resolve()
        output.parent.mkdir(parents=True, exist_ok=True)
        with wave.open(str(output), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(self.hps.data.sampling_rate)
            wav.writeframes(pcm.tobytes())

        memory_after = self.protect_memory_headroom()
        return {
            "inferenceMs": inference_ms,
            "writeMs": elapsed_ms(write_started),
            "totalMs": elapsed_ms(started),
            "frames": int(waveform.size),
            "memory": {"before": memory_before, "after": memory_after},
        }

    def status(self) -> dict[str, Any]:
        cuda = self.device.startswith("cuda")
        return {
            "device": self.device,
            "cuda": cuda,
            "gpu": self.torch.cuda.get_device_name(0) if cuda else "",
            "torch": self.torch.__version__,
            "cudaRuntime": self.torch.version.cuda or "",
            "gpuMemoryMb": round(self.torch.cuda.memory_allocated(0) / 1024 / 1024) if cuda else 0,
            "timings": self.timings,
        }


def run_worker(engine: BertVits2Engine) -> int:
    emit_ipc({"type": "ready", "ok": True, **engine.status()})
    for raw_line in sys.stdin:
        if not raw_line.strip():
            continue
        request_id: Any = None
        try:
            request = json.loads(raw_line)
            request_id = request.get("id")
            if request.get("type") == "shutdown":
                emit_ipc({"type": "shutdown", "ok": True, "id": request_id})
                return 0
            timings = engine.synthesize_to_file(
                str(request.get("text", "")),
                str(request.get("voice", "")),
                float(request.get("speed", 1.0)),
                Path(str(request["output"])),
            )
            emit_ipc(
                {
                    "type": "result",
                    "ok": True,
                    "id": request_id,
                    "device": engine.device,
                    "timings": timings,
                }
            )
        except Exception as error:
            emit_ipc(
                {
                    "type": "result",
                    "ok": False,
                    "id": request_id,
                    "error": str(error),
                    "memory": engine.memory_status(),
                }
            )
    return 0


def main() -> int:
    args = parse_args()
    engine = BertVits2Engine(Path(args.model_dir))
    if args.worker:
        return run_worker(engine)
    if not args.text or not args.voice or not args.output:
        raise RuntimeError("--text, --voice and --output are required outside worker mode")
    timings = engine.synthesize_to_file(
        args.text, args.voice, args.speed, Path(args.output)
    )
    print(json.dumps({"device": engine.device, "timings": timings}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        if "--worker" in sys.argv:
            emit_ipc({"type": "ready", "ok": False, "error": str(error)})
        print(f"bilimaku Bert-VITS2 adapter: {error}", file=sys.stderr)
        raise SystemExit(1)
