"""G2.5 — structural checks: plan strategy vs Bricks element tree."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from scripts.lib.plan_parser import SectionSpec

MEDIA_991_RE = re.compile(r"@media\s*\(\s*max-width\s*:\s*991px\s*\)", re.I)
DISPLAY_NONE_RE = re.compile(r"display\s*:\s*none", re.I)
BREAKPOINT_SETTINGS = (
    ":tablet_portrait",
    ":mobile_portrait",
    ":mobile_landscape",
)


@dataclass
class StructureIssue:
    level: str
    message: str


@dataclass
class StructureResult:
    passed: bool
    issues: list[StructureIssue] = field(default_factory=list)

    def add(self, level: str, message: str) -> None:
        self.issues.append(StructureIssue(level, message))
        if level == "error":
            self.passed = False


def _collect_css(elements: list[dict]) -> str:
    chunks: list[str] = []
    for el in elements:
        css = (el.get("settings") or {}).get("_cssCustom") or ""
        if css:
            chunks.append(css)
    return "\n".join(chunks)


def _has_breakpoint_settings(elements: list[dict]) -> bool:
    for el in elements:
        settings = el.get("settings") or {}
        for key in settings:
            if any(bp in key for bp in BREAKPOINT_SETTINGS):
                return True
    return False


def _count_images(elements: list[dict]) -> int:
    return sum(1 for el in elements if el.get("name") == "image")


def _dual_block_css_ok(css: str) -> bool:
    if not MEDIA_991_RE.search(css):
        return False
    if not DISPLAY_NONE_RE.search(css):
        return False
    return True


def _dual_block_hidden(elements: list[dict]) -> tuple[int, int]:
    """Branches hidden through Bricks settings: (hidden on desktop, hidden @991).

    Rule 44 wants the breakpoint swap in settings — Bricks compiles `_display:tablet_portrait`
    into the same `@media (max-width: 991px)` rule, so these never show up in `_cssCustom`.
    """
    desktop_only = mobile_only = 0
    for el in elements:
        settings = el.get("settings") or {}
        tablet = settings.get("_display:tablet_portrait")
        if settings.get("_display") == "none" and tablet not in (None, "none"):
            mobile_only += 1
        elif tablet == "none":
            desktop_only += 1
    return desktop_only, mobile_only


def _has_slider_element(elements: list[dict]) -> bool:
    return any(el.get("name") in ("slider-nestable", "slider-nested", "slider") for el in elements)


def _has_slider_breakpoint_settings(elements: list[dict]) -> bool:
    for el in elements:
        if el.get("name") not in ("slider-nested", "slider-nestable", "slider"):
            continue
        settings = el.get("settings") or {}
        for key in settings:
            if key.startswith("perPage:") or key.startswith("gap:"):
                return True
            if key.startswith("_cssCustom:"):
                return True
    for el in elements:
        settings = el.get("settings") or {}
        for key in settings:
            if ":tablet_portrait" in key or ":mobile_portrait" in key:
                if key.startswith("_widthMax") or key.startswith("_width"):
                    return True
    return False


def _slider_responsive_ok(elements: list[dict], css: str) -> bool:
    if not _has_slider_element(elements):
        return False
    if _has_slider_breakpoint_settings(elements):
        return True
    if MEDIA_991_RE.search(css) and "splide" in css.lower():
        return True
    return False


def _has_overflow_scroll(css: str) -> bool:
    compact = css.replace(" ", "").lower()
    return "overflow-x:auto" in compact or "overflow-x:scroll" in compact


def validate_section_structure(
    elements: list[dict],
    spec: SectionSpec | None,
) -> StructureResult:
    result = StructureResult(passed=True)
    if not elements:
        result.add("error", "no elements in template")
        return result

    css = _collect_css(elements)
    strategy = (spec.strategy if spec else None) or "breakpoint-only"

    if strategy == "dual-block":
        desktop_only, mobile_only = _dual_block_hidden(elements)
        if not _dual_block_css_ok(css) and not (desktop_only and mobile_only):
            result.add(
                "error",
                "strategy=dual-block but no breakpoint swap: needs either _display/_display:tablet_portrait "
                "settings on both branches, or @media (max-width:991px) + display:none in _cssCustom",
            )
        hide_blocks = len(DISPLAY_NONE_RE.findall(css)) + desktop_only + mobile_only
        if hide_blocks < 2:
            result.add(
                "warn",
                "dual-block usually needs at least 2 display:none rules (desktop block + mobile block)",
            )
    elif strategy == "slider-responsive":
        if not _has_slider_element(elements):
            result.add(
                "error",
                "strategy=slider-responsive but no slider-nested element in template",
            )
        elif not _slider_responsive_ok(elements, css):
            result.add(
                "warn",
                "slider-responsive: add perPage:tablet_portrait on slider, "
                "_widthMax:tablet_portrait on slides, or splide arrow hide @991px in _cssCustom",
            )
        if _dual_block_css_ok(css) and _has_overflow_scroll(css):
            result.add(
                "warn",
                "slider-responsive with carousel-dual CSS (display:none + overflow-x) — "
                "confirm strategy in plan",
            )
    elif strategy == "carousel-dual":
        if not _has_slider_element(elements):
            result.add(
                "error",
                "strategy=carousel-dual but no slider-nested element in template",
            )
        if not _dual_block_css_ok(css):
            result.add(
                "error",
                "strategy=carousel-dual but missing @media (max-width:991px) + display:none swap",
            )
        if not _has_overflow_scroll(css):
            result.add(
                "error",
                "strategy=carousel-dual but missing overflow-x scroll CSS for mobile row",
            )
    elif strategy == "breakpoint-only":
        if spec and spec.mobile_differs:
            if not _has_breakpoint_settings(elements) and not MEDIA_991_RE.search(css):
                result.add(
                    "warn",
                    "mobile differs but no :tablet_portrait/:mobile_portrait settings or @media 991px",
                )
    elif strategy == "n/a":
        pass

    if spec and spec.requires_dual_block_heuristic and strategy == "breakpoint-only":
        result.add(
            "error",
            f"mobile diff suggests structural change ({spec.mobile_diff[:80]}…) "
            "but strategy=breakpoint-only — use dual-block",
        )

    if spec and spec.requires_carousel_dual_heuristic and strategy == "breakpoint-only":
        result.add(
            "error",
            "desktop carousel/nav + mobile scroll row in plan but strategy=breakpoint-only — "
            "use carousel-dual",
        )

    if spec and spec.requires_slider_responsive_heuristic and strategy == "breakpoint-only":
        result.add(
            "error",
            "desktop carousel/nav + mobile peek in plan but strategy=breakpoint-only — "
            "use slider-responsive",
        )

    if spec and spec.requires_slider_responsive_heuristic and strategy == "carousel-dual":
        result.add(
            "warn",
            "plan suggests mobile peek carousel — prefer slider-responsive over carousel-dual",
        )

    if spec and spec.mobile_diff and "1 ảnh" in spec.mobile_diff.lower():
        images = _count_images(elements)
        if images >= 5 and strategy != "dual-block":
            result.add(
                "error",
                f"plan expects 1 mobile image but template has {images} image elements without dual-block",
            )

    for rule in spec.critical_rules if spec else []:
        needle = rule.strip()
        if len(needle) >= 6 and needle not in css and needle.replace(" ", "") not in css.replace(" ", ""):
            result.add("warn", f"critical rule from plan not found in _cssCustom: {needle!r}")

    return result
