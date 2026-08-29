"""Load OpenX environment variables without evaluating shell syntax."""
from __future__ import annotations

import os
from pathlib import Path


def load_openx_env() -> None:
    env_path = Path(__file__).with_name('.env')
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        name, value = line.split('=', 1)
        if name.startswith('OPENX_') and name.isidentifier():
            os.environ.setdefault(name, value)
