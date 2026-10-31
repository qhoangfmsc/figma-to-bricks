"""Draft ### Cấu trúc element tree from Figma node walk."""
from __future__ import annotations

from typing import Any

SKIP_TYPES = {"VECTOR", "ELLIPSE", "LINE", "STAR", "BOOLEAN_OPERATION"}


def _semantic(section_index: int, kind: str, counter: dict[str, int]) -> str:
    counter[kind] = counter.get(kind, 0) + 1
    n = counter[kind]
    prefixes = {
        "section": "sec",
        "container": "con",
        "block": "blk",
        "image": "img",
        "heading": "hdg",
        "text": "txt",
        "button": "btn",
        "slider": "sld",
        "slide": "sld",
    }
    return f"{prefixes.get(kind, 'el')}{section_index:03d}{n:02d}"


def _map_child_to_line(child: dict[str, Any], section_index: int, counter: dict[str, int]) -> str | None:
    ctype = child.get("type", "")
    name = (child.get("name") or "").strip()
    if ctype in SKIP_TYPES:
        return None
    if ctype == "TEXT":
        style = child.get("style") or {}
        size = float(style.get("fontSize", 16))
        kind = "heading" if size >= 28 else "text"
        sid = _semantic(section_index, kind, counter)
        widget = "heading h2" if kind == "heading" else "text-basic"
        return f"{widget} {sid}"
    if ctype in ("RECTANGLE", "FRAME") and _has_image_fill(child):
        sid = _semantic(section_index, "image", counter)
        return f"image {sid}"
    if ctype == "INSTANCE" and "button" in name.lower():
        sid = _semantic(section_index, "button", counter)
        return f"button {sid}"
    if ctype in ("FRAME", "GROUP", "COMPONENT", "INSTANCE", "SECTION"):
        sid = _semantic(section_index, "block", counter)
        label = f" ({name})" if name else ""
        return f"block {sid}{label}"
    return None


def _has_image_fill(node: dict[str, Any]) -> bool:
    for fill in node.get("fills") or []:
        if fill.get("type") == "IMAGE" and fill.get("visible", True):
            return True
    return False


def draft_element_tree(section_index: int, node: dict[str, Any], strategy: str) -> str:
    counter: dict[str, int] = {}
    sec_id = _semantic(section_index, "section", counter)
    con_id = _semantic(section_index, "container", counter)

    lines = [f"section {sec_id} → container {con_id}"]

    children = node.get("children") or []
    child_lines: list[str] = []

    if strategy == "slider-responsive":
        sld_id = _semantic(section_index, "slider", counter)
        lines.append(f"  → block title-row (heading + text-basic)")
        lines.append(f"  → slider-nested {sld_id} → slide×N (image + text-basic)")
        return "\n".join(lines)

    if strategy == "carousel-dual":
        lines.append("  → block evds01 [desktop] → slider-nested")
        lines.append("  → block evmb01 [mobile @991] → div scroll → card×N")
        return "\n".join(lines)

    for child in children[:12]:
        mapped = _map_child_to_line(child, section_index, counter)
        if mapped:
            child_lines.append(f"  → {mapped}")

    if not child_lines:
        blk = _semantic(section_index, "block", counter)
        child_lines.append(f"  → block {blk} (content — refine from Figma)")

    lines.extend(child_lines)
    return "\n".join(lines)
