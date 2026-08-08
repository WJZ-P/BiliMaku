"""Generate a tiny WAV so bilimaku's command adapter can be tested without dependencies."""

from __future__ import annotations

import argparse
import math
import struct
import wave
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", default="")
    parser.add_argument("--text", required=True)
    parser.add_argument("--voice", default="bright")
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    sample_rate = 24_000
    duration = max(0.35, min(2.4, len(args.text) * 0.055 / max(args.speed, 0.25)))
    base_frequency = 660.0 if args.voice == "bright" else 440.0
    sample_count = int(sample_rate * duration)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    with wave.open(str(output), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(sample_rate)
        frames = bytearray()
        for index in range(sample_count):
            progress = index / sample_count
            envelope = min(1.0, progress * 12.0, (1.0 - progress) * 12.0)
            sample = math.sin(2.0 * math.pi * base_frequency * index / sample_rate)
            frames.extend(struct.pack("<h", int(sample * envelope * 7_500)))
        target.writeframes(frames)


if __name__ == "__main__":
    main()
