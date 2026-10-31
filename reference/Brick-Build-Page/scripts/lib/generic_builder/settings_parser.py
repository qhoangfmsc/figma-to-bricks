"""Map Settings snapshot prose → Bricks settings dict."""
from __future__ import annotations

import re
from typing import Any

BACKTICK_KV_RE = re.compile(r"`(_[a-zA-Z0-9:._-]+):\s*([^`]+)`")
PLAIN_KV_RE = re.compile(r"(_[a-zA-Z0-9:._-]+):\s*([^\s·]+)")
HEX_COLOR_RE = re.compile(r"#([0-9a-fA-F]{3,8})")
GAP_RE = re.compile(r"\bgap[:\s]+(\d+)", re.I)
BG_RE = re.compile(r"\bbg\s+#([0-9a-fA-F]{3,8})", re.I)
RADIUS_FULL_RE = re.compile(r"\bradius\s+full\b", re.I)
PADDING_TB_RE = re.compile(r"_padding\.top/bottom:\s*(\d+)", re.I)


def _set_nested(target: dict[str, Any], key: str, value: Any) -> None:
    target[key] = value


def _parse_value(raw: str) -> Any:
    val = raw.strip().strip("'\"")
    if val.lower() in ("none", "hidden"):
        return val.lower()
    if val.isdigit():
        return val
    if val.replace(".", "", 1).isdigit():
        return val
    return val


def parse_settings_line(line: str) -> dict[str, Any]:
    """Parse one snapshot bullet body (after element id prefix)."""
    settings: dict[str, Any] = {}

    for match in BACKTICK_KV_RE.finditer(line):
        key, val = match.group(1), match.group(2).strip()
        _set_nested(settings, key, _parse_value(val))

    for match in PLAIN_KV_RE.finditer(line):
        key, val = match.group(1), match.group(2).strip()
        if key not in settings:
            _set_nested(settings, key, _parse_value(val))

    tb = PADDING_TB_RE.search(line)
    if tb:
        px = f"{tb.group(1)}px"
        settings["_padding"] = settings.get("_padding") or {}
        if isinstance(settings["_padding"], dict):
            settings["_padding"]["top"] = px
            settings["_padding"]["bottom"] = px

    bg = BG_RE.search(line)
    if bg:
        settings["_background"] = {"color": {"hex": f"#{bg.group(1)}"}}

    gap = GAP_RE.search(line)
    if gap and "_rowGap" not in settings and "_columnGap" not in settings:
        settings["_rowGap"] = gap.group(1)

    if RADIUS_FULL_RE.search(line):
        settings["_border"] = settings.get("_border") or {}
        if isinstance(settings["_border"], dict):
            settings["_border"]["radius"] = "9999px"

    for hex_match in HEX_COLOR_RE.finditer(line):
        if "_background" not in settings and "bg" in line.lower():
            settings["_background"] = {"color": {"hex": f"#{hex_match.group(1)}"}}
            break

    if "_display: flex" in line or "_display:flex" in line.replace(" ", ""):
        settings["_display"] = "flex"
    if "_direction: column" in line:
        settings["_direction"] = "column"

    return settings


def parse_settings_snapshot(lines: list[str]) -> dict[str, dict[str, Any]]:
    """Map semantic element id → settings dict."""
    result: dict[str, dict[str, Any]] = {}
    for line in lines:
        if ":" not in line:
            continue
        element_part, _, rest = line.partition(":")
        element_id = element_part.strip().strip("-").strip()
        if not element_id or element_id.startswith("http"):
            continue
        # shared keys: row1/row2, bento cards
        targets = [t.strip() for t in re.split(r"\s*/\s*", element_id)]
        parsed = parse_settings_line(rest)
        if not parsed:
            continue
        for tid in targets:
            if tid:
                merged = dict(result.get(tid, {}))
                merged.update(parsed)
                result[tid] = merged
    return result
