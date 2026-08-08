# bilimaku local TTS resources

This directory stores local TTS voice/model packages. Large model weights are
kept out of Git and deliberately excluded from Vite and Tauri build artifacts.
BiliMaku loads them at runtime from the absolute path saved in local settings.

Current layout:

- `hoyoTTS/` - local snapshot of `Genius-Society/hoyoTTS` from ModelScope.
  It remains an unmodified native model directory containing `config.json` and
  the original checkpoints. Select this directory itself in the bilimaku model
  importer; the built-in Bert-VITS2 adapter discovers its 251 voices.

Architecture adapters live under `src-tauri/resources/tts-adapters/`, not in
downloaded model folders. bilimaku inspects native configuration and weight
signatures, registers the discovered voices, and leaves model files untouched.
