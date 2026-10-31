#!/usr/bin/env python3
"""Flag Figma→Bricks pitfalls in a spec.json before the builder runs.

  python3 scripts/lint_spec_pitfalls.py --slug template-foo

Each warning names the Figma node id so the fix can go into the builder OVERRIDES.
See the "Known Bricks pitfalls" table in .cursor/skills/figma-section-analyze/SKILL.md.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.figma_spec import walk  # noqa: E402

# Average glyph width of bold Inter relative to font size; deliberately generous so only real wraps are flagged.
BOLD_GLYPH_WIDTH_EM = 0.62


def px_value(value: object) -> float | None:
    if isinstance(value, str) and value.endswith("px"):
        try:
            return float(value[:-2])
        except ValueError:
            return None
    return None


def padding_sides(settings: dict) -> tuple[float, float, float, float]:
    padding = settings.get("_padding") or {}
    return tuple(px_value(padding.get(side)) or 0.0 for side in ("top", "right", "bottom", "left"))  # type: ignore[return-value]


def lint_tree(tree: dict, viewport: str) -> list[str]:
    warnings: list[str] = []
    for node in walk(tree):
        settings = node.get("settings", {})
        label = f'{viewport} {node["role"]} "{node["name"]}" `{node["id"]}`'

        if node["role"] in ("svg", "image"):
            width, height = px_value(settings.get("_width")), px_value(settings.get("_height"))
            if width == 0 or height == 0:
                warnings.append(f"{label}: zero-size image — an <img> never paints; give the stroke a real 1px size")

        if settings.get("_alignSelf") == "stretch":
            warnings.append(f"{label}: _alignSelf stretch makes Bricks emit width:100% — use parent _alignItems stretch")

        if node["role"] == "button" and settings.get("text") and px_value(settings.get("_width")):
            typography = settings.get("_typography") or {}
            font_size = px_value(typography.get("font-size")) or 0
            top, right, bottom, left = padding_sides(settings)
            available = px_value(settings["_width"]) - left - right - 2
            needed = len(settings["text"]) * font_size * BOLD_GLYPH_WIDTH_EM
            if font_size and needed > available:
                warnings.append(f"{label}: fixed-width label may wrap ({needed:.0f}px text in {available:.0f}px) — add white-space: nowrap")

        children = node.get("children", [])
        growing = [child for child in children if child.get("settings", {}).get("_flexGrow") == "1"]
        paddings = {padding_sides(child.get("settings", {})) for child in growing}
        if len(growing) > 1 and len(paddings) > 1:
            warnings.append(f"{label}: flex-grow siblings with unequal padding — CSS will not split them equally; set a measured height")

        if settings.get("_boxShadow") and node["role"] in ("svg", "image"):
            warnings.append(f"{label}: box-shadow on an exported asset — the ring is usually baked into the asset, check for a doubled effect")
    return warnings


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slug", required=True)
    args = parser.parse_args()
    spec = json.loads((ROOT / "scripts/data" / args.slug / "spec.json").read_text())
    warnings = lint_tree(spec["desktop"], "desktop")
    if spec.get("mobile"):
        warnings += lint_tree(spec["mobile"], "mobile")
    print("\n".join(warnings) if warnings else "No pitfalls detected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
