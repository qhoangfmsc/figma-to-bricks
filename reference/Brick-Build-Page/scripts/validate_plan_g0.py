#!/usr/bin/env python3
"""
G0 — Validate plan spec before BUILD/DO.

Usage:
  python3 scripts/validate_plan_g0.py plans/page-blog-tuan-dang.md
  python3 scripts/validate_plan_g0.py plans/page-blog-tuan-dang.md --strict
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.build_guard import scan_build_script
from scripts.lib.plan_parser import parse_plan, plan_has_figma_mobile

BUILD_SCRIPT_RE = __import__("re").compile(r"Build script:\s*`([^`]+)`", __import__("re").I)

VALID_STRATEGIES = (
    "breakpoint-only",
    "slider-responsive",
    "dual-block",
    "carousel-dual",
    "n/a",
)


def main() -> int:
    parser = argparse.ArgumentParser(description="G0: validate plan review spec")
    parser.add_argument("plan", type=Path, help="Path to plans/*.md")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail if figma mobile URL, evidence dir, legacy plan format, or clone build script",
    )
    parser.add_argument(
        "--skip-build-guard",
        action="store_true",
        help="Skip G0.5 build script clone check",
    )
    args = parser.parse_args()

    plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
    if not plan_path.exists():
        print(f"G0 FAIL: plan not found: {plan_path}", file=sys.stderr)
        return 1

    meta = parse_plan(plan_path)
    errors: list[str] = []
    warns: list[str] = []
    has_mobile_url = plan_has_figma_mobile(meta)

    if meta.is_template_only:
        if meta.page_id:
            errors.append("Mode `template-only` must not declare a Page ID")
    elif not meta.page_id:
        errors.append("missing Page ID: **8035** (or set `- Mode: `template-only``)")
    if not meta.figma_desktop_url:
        errors.append("missing Figma Desktop URL")
    if args.strict and not meta.figma_mobile_url:
        errors.append("missing Figma Mobile URL (--strict)")
    if args.strict and not meta.evidence_dir:
        errors.append("missing G4 evidence dir (--strict)")

    if not meta.sections:
        errors.append("no ## Section blocks found")
    else:
        for section in meta.sections:
            label = f"Section {section.index} {section.name}"
            if not section.template_id:
                errors.append(f"{label}: missing Template ID")
            if not section.figma_desktop:
                errors.append(f"{label}: missing Figma node desktop")
            if not section.strategy:
                errors.append(
                    f"{label}: missing Chiến lược mobile / Strategy "
                    "(breakpoint-only | slider-responsive | dual-block | carousel-dual | n/a)"
                )
            elif section.strategy not in VALID_STRATEGIES:
                errors.append(f"{label}: invalid strategy {section.strategy!r}")

            if section.strategy == "slider-responsive":
                if has_mobile_url and not section.figma_mobile:
                    errors.append(f"{label}: slider-responsive requires Figma node mobile")
                if not section.has_slider_in_plan:
                    errors.append(
                        f"{label}: slider-responsive — thiếu slider-nested trong "
                        "Cấu trúc element / Settings snapshot"
                    )
                if not section.has_settings_snapshot and not section.has_element_tree:
                    if section.uses_legacy_widget_lines:
                        warns.append(
                            f"{label}: plan legacy (Desktop/Mobile widgets) — migrate sang "
                            "Settings snapshot + Mobile diff trước DO mới (rule 42)"
                        )
                    else:
                        errors.append(
                            f"{label}: thiếu ### Settings snapshot hoặc ### Cấu trúc element "
                            "(rule 42)"
                        )
                elif section.uses_legacy_widget_lines and section.has_settings_snapshot:
                    warns.append(
                        f"{label}: gộp dòng Desktop/Mobile legacy vào Settings snapshot"
                    )

            if section.strategy == "carousel-dual":
                if has_mobile_url and not section.figma_mobile:
                    errors.append(f"{label}: carousel-dual requires Figma node mobile (scroll row layout)")
                if not section.has_slider_in_plan:
                    errors.append(
                        f"{label}: carousel-dual — thiếu slider-nested (nhánh desktop) trong plan"
                    )
                if not (section.has_mobile_scroll_in_plan or section.widget_mobile):
                    errors.append(
                        f"{label}: carousel-dual — thiếu scroll row mobile "
                        "(Mobile diff / Cấu trúc element evmb01 + overflow-x)"
                    )
                if not section.has_element_tree:
                    warns.append(
                        f"{label}: carousel-dual nên có ### Cấu trúc element (evds01 + evmb01)"
                    )

            if section.critical_rules:
                warns.append(
                    f"{label}: Critical rules deprecated (rule 43) — chuyển vào Settings snapshot"
                )

            if args.strict and has_mobile_url:
                if section.strategy and section.strategy != "n/a":
                    if not section.has_settings_snapshot:
                        errors.append(f"{label}: --strict requires ### Settings snapshot")
                    if not section.has_mobile_diff_block and not section.mobile_diff:
                        errors.append(f"{label}: --strict requires ### Mobile diff (@991px)")
                if section.uses_legacy_widget_lines:
                    errors.append(
                        f"{label}: --strict cấm dòng Desktop/Mobile widgets legacy (rule 43)"
                    )
                if section.critical_rules:
                    errors.append(f"{label}: --strict cấm Critical rules (rule 43)")

            if section.strategy == "dual-block" and not section.figma_mobile:
                warns.append(f"{label}: dual-block but no Figma node mobile")

            if section.requires_dual_block_heuristic and section.strategy == "breakpoint-only":
                errors.append(
                    f"{label}: mobile diff implies structural change — "
                    "strategy must be dual-block, not breakpoint-only"
                )

            if section.requires_carousel_dual_heuristic and section.strategy == "breakpoint-only":
                errors.append(
                    f"{label}: desktop nav/carousel + mobile scroll row — "
                    "strategy must be carousel-dual, not breakpoint-only"
                )

            if section.requires_slider_responsive_heuristic and section.strategy == "breakpoint-only":
                errors.append(
                    f"{label}: desktop nav/carousel + mobile peek — "
                    "strategy must be slider-responsive, not breakpoint-only"
                )

            if section.requires_carousel_dual_heuristic and section.strategy == "slider-responsive":
                warns.append(
                    f"{label}: mobile scroll row detected — confirm slider-responsive vs carousel-dual"
                )

            if section.requires_slider_responsive_heuristic and section.strategy == "carousel-dual":
                warns.append(
                    f"{label}: mobile peek carousel — prefer slider-responsive over carousel-dual"
                )

            if section.requires_carousel_dual_heuristic and section.strategy == "dual-block":
                warns.append(
                    f"{label}: carousel with nav — prefer carousel-dual over dual-block"
                )

            if section.mobile_differs and section.strategy == "n/a":
                warns.append(f"{label}: mobile differs but strategy=n/a")

    if not args.skip_build_guard:
        build_match = BUILD_SCRIPT_RE.search(plan_path.read_text())
        if build_match:
            script_path = ROOT / build_match.group(1).strip()
            guard = scan_build_script(script_path, plan_path=plan_path)
            for msg in guard.errors:
                errors.append(f"G0.5 build script: {msg}")
            for msg in guard.warnings:
                warns.append(f"G0.5 build script: {msg}")
        elif args.strict:
            errors.append("missing Build script: `scripts/build_<slug>.py` (--strict)")

    for msg in errors:
        print(f"ERROR {msg}", file=sys.stderr)
    for msg in warns:
        print(f"WARN {msg}")

    if errors:
        print(f"\nG0 FAIL: {len(errors)} error(s), {len(warns)} warn(s)", file=sys.stderr)
        return 1

    scope = "template-only" if meta.is_template_only else f"page_id={meta.page_id}"
    print(f"G0 PASS: {len(meta.sections)} section(s), {scope}")
    if meta.evidence_dir:
        print(f"  evidence dir: {meta.evidence_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
