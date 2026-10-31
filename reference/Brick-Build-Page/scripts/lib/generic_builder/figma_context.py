"""Optional Figma get_design_context JSON overlay."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]


def _slug_from_plan(plan_path: Path) -> str:
    return plan_path.stem.replace("page-", "")


def context_paths(plan_path: Path, figma_node: str | None) -> list[Path]:
    if not figma_node:
        return []
    slug = _slug_from_plan(plan_path)
    node_slug = figma_node.replace(":", "-")
    return [
        ROOT / "scripts" / "data" / slug / "figma" / f"{node_slug}.json",
        ROOT / "scripts" / "data" / slug / "figma" / f"{figma_node}.json",
        ROOT / "notes" / slug / "figma" / f"{node_slug}.json",
    ]


def load_figma_context(plan_path: Path, figma_node: str | None) -> dict[str, Any] | None:
    for path in context_paths(plan_path, figma_node):
        if path.is_file():
            return json.loads(path.read_text())
    return None


def extract_text_blocks(context: dict[str, Any]) -> list[str]:
    """Pull plain text strings from exported design context (best-effort)."""
    texts: list[str] = []

    def walk(obj: Any) -> None:
        if isinstance(obj, str):
            stripped = obj.strip()
            if 2 < len(stripped) < 500 and not stripped.startswith("http"):
                if re.search(r"[A-Za-zÀ-ỹ]", stripped):
                    texts.append(stripped)
        elif isinstance(obj, dict):
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for v in obj:
                walk(v)

    walk(context)
    seen: set[str] = set()
    ordered: list[str] = []
    for t in texts:
        if t not in seen:
            seen.add(t)
            ordered.append(t)
    return ordered


def extract_image_urls(context: dict[str, Any]) -> list[str]:
    urls: list[str] = []
    pattern = re.compile(r"https?://localhost:3845/assets/[a-f0-9]+\.(?:png|svg|jpg|webp)", re.I)

    def walk(obj: Any) -> None:
        if isinstance(obj, str):
            for match in pattern.findall(obj):
                if match not in urls:
                    urls.append(match)
        elif isinstance(obj, dict):
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for v in obj:
                walk(v)

    walk(context)
    return urls
