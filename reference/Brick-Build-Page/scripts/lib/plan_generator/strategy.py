"""Infer responsive strategy from Figma section node."""
from __future__ import annotations

import re
from typing import Any

SLIDER_NAME_KEYWORDS = (
    "speaker",
    "carousel",
    "slider",
    "swiper",
    "sự kiện",
    "su kien",
    "event",
    "testimonial",
)

SCROLL_NAME_KEYWORDS = ("scroll row", "scroll-row", "horizontal scroll")

FOOTER_NAME_KEYWORDS = ("footer", "chân trang", "chan trang")

FLOATING_NAME_KEYWORDS = ("floating", "fab", "sticky cta")


def is_footer_section(name: str) -> bool:
    lower = name.lower().strip()
    return any(k in lower for k in FOOTER_NAME_KEYWORDS)


def is_floating_section(name: str) -> bool:
    lower = name.lower().strip()
    return any(k in lower for k in FLOATING_NAME_KEYWORDS)


def count_similar_width_children(node: dict[str, Any]) -> int:
    children = node.get("children") or []
    widths: list[float] = []
    for child in children:
        if child.get("type") not in ("FRAME", "COMPONENT", "INSTANCE", "GROUP"):
            continue
        box = child.get("absoluteBoundingBox") or {}
        w = float(box.get("width", 0))
        if w > 80:
            widths.append(round(w, -1))
    if len(widths) < 3:
        return 0
    from collections import Counter

    common = Counter(widths).most_common(1)
    return common[0][1] if common else 0


def infer_strategy(section_name: str, node: dict[str, Any]) -> str:
    lower = section_name.lower()
    if any(k in lower for k in SCROLL_NAME_KEYWORDS):
        return "carousel-dual"
    if any(k in lower for k in SLIDER_NAME_KEYWORDS):
        return "slider-responsive"
    if count_similar_width_children(node) >= 3:
        return "slider-responsive"
    child_count = len(node.get("children") or [])
    if child_count >= 4 and "grid" in lower:
        return "breakpoint-only"
    return "breakpoint-only"


def default_mobile_diff(strategy: str, section_name: str) -> tuple[bool, str]:
    if strategy == "slider-responsive":
        return True, (
            "`perPage:tablet_portrait: 1` · slide `_widthMax:tablet_portrait: 80%` (peek) · giữ arrows nếu Figma desktop có"
        )
    if strategy == "carousel-dual":
        return True, "ẩn desktop slider @991px · hiện scroll row mobile · card width cố định px"
    if is_floating_section(section_name):
        return True, "`_position:tablet_portrait: fixed` · thu gọn padding @991px"
    return True, "stack column @991px · full-width cards/CTA · padding 16px"
