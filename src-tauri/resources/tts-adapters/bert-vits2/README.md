# bilimaku Bert-VITS2 adapter

This directory belongs to bilimaku rather than to any imported model package.
`upstream/` contains the Bert-VITS2-compatible inference implementation and
`infer.py` is the stable bilimaku command entrypoint.

Inference additionally needs a Python environment containing
`requirements.txt` and a local `chinese-roberta-wwm-ext-large` BERT
directory. Importing a model does not mutate the selected directory: the Rust
adapter detects its native `config.json`, generator checkpoint, and speaker map.
