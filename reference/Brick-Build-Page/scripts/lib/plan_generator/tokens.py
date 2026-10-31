"""Extract design tokens from Figma nodes."""
from __future__ import annotations

from typing import Any


def _hex_from_fill(fill: dict[str, Any]) -> str | None:
    if fill.get("type") != "SOLID":
        return None
    color = fill.get("color") or {}
    if not color:
        return None
    r = int(round(float(color.get("r", 0)) * 255))
    g = int(round(float(color.get("g", 0)) * 255))
    b = int(round(float(color.get("b", 0)) * 255))
    return f"#{r:02x}{g:02x}{b:02x}"


def collect_tokens_from_nodes(nodes: list[dict[str, Any]], limit: int = 12) -> list[str]:
    colors: list[str] = []
    fonts: set[str] = set()

    def walk(n: dict[str, Any]) -> None:
        for fill in n.get("fills") or []:
            hx = _hex_from_fill(fill)
            if hx and hx not in colors:
                colors.append(hx)
        style = n.get("style") or {}
        family = style.get("fontFamily")
        if family:
            fonts.add(str(family))
        for child in n.get("children") or []:
            walk(child)

    for node in nodes:
        walk(node)

    tokens: list[str] = []
    if colors:
        tokens.append("Brand / surface: " + " · ".join(colors[:6]))
    if fonts:
        tokens.append("Font: " + ", ".join(sorted(fonts)[:3]))
    tokens.append("Container max: ~1140–1200px · Section padding: ~100px (verify Figma)")
    return tokens[:limit]
