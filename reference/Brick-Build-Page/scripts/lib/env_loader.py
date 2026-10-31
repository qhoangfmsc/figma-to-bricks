from __future__ import annotations

from pathlib import Path


def load_env(env_path: str | None = None) -> dict[str, str]:
    root = Path(__file__).resolve().parents[2]
    path = Path(env_path) if env_path else root / ".env"
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values
