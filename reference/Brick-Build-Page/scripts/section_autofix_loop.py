#!/usr/bin/env python3
"""
Autonomous per-section loop: autofix → upload → G1/G2/G2.5 → screenshot → next section.

No manual screenshot from user — agent self-reviews via compile + structure gates.

Usage:
  python3 scripts/section_autofix_loop.py --plan plans/page-blog-tuan-dang.md --page-id 8035
  python3 scripts/section_autofix_loop.py --plan plans/page-blog-tuan-dang.md --template-id 8039
  python3 scripts/section_autofix_loop.py --plan plans/page-blog-tuan-dang.md --page-id 8035 --max-retries 3
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.bricks_mcp import (
    SECTION_REVIEW_PAGE_SETTINGS,
    generate_css_file,
    get_template,
    section_review_page_settings_applied,
    set_page_settings,
    set_template_content,
)
from scripts.lib.env_loader import load_env
from scripts.lib.plan_parser import SectionSpec, parse_plan, plan_has_figma_mobile, section_by_template_id
from scripts.lib.review_viewport import DESKTOP_WIDTH, figma_mobile_png, mobile_review_width
from scripts.lib.section_autofix import AutofixChange, autofix_template, run_gates
from scripts.validate_css_compiled import load_compiled_css

DEFAULT_MAX_RETRIES = 3


def screenshot_section(template_id: int, evidence_dir: Path, *, mobile: bool) -> int:
    width = mobile_review_width(figma_mobile_png(evidence_dir, template_id)) if mobile else DESKTOP_WIDTH
    height = 4500 if mobile else 3000
    suffix = "_mobile" if mobile else ""
    cmd = [
        sys.executable,
        "scripts/screenshot_templates.py",
        "--ids",
        str(template_id),
        "--width",
        str(width),
        "--height",
        str(height),
        "--suffix",
        suffix,
        "--out-dir",
        str(evidence_dir),
    ]
    print(f"\n$ {' '.join(cmd)}")
    return subprocess.call(cmd, cwd=ROOT)


def review_section_loop(
    spec: SectionSpec,
    page_id: int | None,
    plan_path: Path,
    evidence_dir: Path | None,
    *,
    max_retries: int,
    skip_screenshot: bool,
    skip_mobile: bool,
) -> bool:
    template_id = spec.template_id
    if not template_id:
        print(f"SKIP {spec.name}: no template_id")
        return True

    print(f"\n{'=' * 60}")
    print(f"Section {spec.index:02d} — {spec.name} (template {template_id})")
    print(f"{'=' * 60}")

    for attempt in range(1, max_retries + 1):
        print(f"\n--- Attempt {attempt}/{max_retries} ---")
        data = get_template(template_id)
        elements = data.get("elements", [])
        page_settings = data.get("page_settings") or {}
        patched, changes = autofix_template(template_id, elements, spec)
        needs_page_settings = not section_review_page_settings_applied(page_settings)

        if changes:
            result = set_template_content(
                template_id,
                patched,
                sync_css=True,
                page_settings=SECTION_REVIEW_PAGE_SETTINGS if needs_page_settings else None,
            )
            backup = ROOT / "scripts" / "refill" / f"autofix-{template_id}-a{attempt}.json"
            backup.parent.mkdir(parents=True, exist_ok=True)
            backup.write_text(json.dumps(patched, ensure_ascii=False, indent=2))
            print(f"Uploaded {result.get('saved_elements')} elements → {backup.name}")
            for change in changes:
                print(f"  FIX [{change.element_id}] {change.reason}")
            if needs_page_settings and not section_review_page_settings_applied(
                get_template(template_id).get("page_settings")
            ):
                set_page_settings(SECTION_REVIEW_PAGE_SETTINGS, template_id=template_id)
                print("  FIX [page_settings] headerDisabled + footerDisabled (set_page_settings)")
            elif needs_page_settings:
                print("  FIX [page_settings] headerDisabled + footerDisabled")
            generate_css_file(template_id=template_id)
        elif needs_page_settings:
            set_page_settings(SECTION_REVIEW_PAGE_SETTINGS, template_id=template_id)
            print("  FIX [page_settings] headerDisabled + footerDisabled")
        else:
            print("No autofix patches needed")
            patched = elements

        env = load_env()
        compiled = load_compiled_css(template_id, page_id, env)
        report = run_gates(template_id, patched, compiled, spec)

        if report.g1_issues:
            print("G1 FAIL:")
            for msg in report.g1_issues:
                print(f"  {msg}")
        if report.g2_issues:
            print("G2 FAIL:")
            for msg in report.g2_issues:
                print(f"  {msg}")
        if report.g25_issues:
            print("G2.5 FAIL:")
            for msg in report.g25_issues:
                print(f"  {msg}")

        if report.passed:
            print(f"\n✓ {spec.name} ({template_id}): G1+G2+G2.5 PASS")
            if not skip_screenshot and evidence_dir:
                evidence_dir.mkdir(parents=True, exist_ok=True)
                screenshot_section(template_id, evidence_dir, mobile=False)
                if not skip_mobile and spec.figma_mobile:
                    screenshot_section(template_id, evidence_dir, mobile=True)
            return True

        if attempt < max_retries:
            print("Retrying after autofix on next attempt…")
        else:
            print(f"\n✗ {spec.name} ({template_id}): FAILED after {max_retries} attempts")

    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Autonomous build-review-rebuild loop per section")
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--page-id", type=int)
    parser.add_argument("--template-id", type=int, help="Run single template only")
    parser.add_argument("--evidence-dir", type=Path)
    parser.add_argument("--max-retries", type=int, default=DEFAULT_MAX_RETRIES)
    parser.add_argument("--skip-screenshot", action="store_true")
    fail_group = parser.add_mutually_exclusive_group()
    fail_group.add_argument(
        "--continue-on-fail",
        action="store_true",
        help="(Default) Process all sections even if one fails after max retries",
    )
    fail_group.add_argument(
        "--stop-on-fail",
        action="store_true",
        help="Stop at the first failing section (debug)",
    )
    args = parser.parse_args()

    plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
    if not plan_path.exists():
        print(f"Plan not found: {plan_path}", file=sys.stderr)
        return 1

    meta = parse_plan(plan_path)
    page_id = args.page_id or meta.page_id
    if meta.is_template_only:
        page_id = None
    elif not page_id:
        print("--page-id required (or Page ID in plan, or `- Mode: `template-only``)", file=sys.stderr)
        return 1

    skip_mobile = not plan_has_figma_mobile(meta)

    evidence_dir = args.evidence_dir
    if not evidence_dir and meta.evidence_dir:
        evidence_dir = ROOT / meta.evidence_dir

    sections = meta.sections
    if args.template_id:
        spec = section_by_template_id(plan_path, args.template_id)
        if not spec:
            print(f"Template {args.template_id} not in plan", file=sys.stderr)
            return 1
        sections = [spec]

    passed = 0
    failed = 0
    for spec in sections:
        if not spec.template_id:
            continue
        ok = review_section_loop(
            spec,
            page_id,
            plan_path,
            evidence_dir,
            max_retries=args.max_retries,
            skip_screenshot=args.skip_screenshot,
            skip_mobile=skip_mobile,
        )
        if ok:
            passed += 1
        else:
            failed += 1
            if args.stop_on_fail:
                print("\nStopping at first section failure (--stop-on-fail).", file=sys.stderr)
                break

    print(f"\n{'=' * 60}")
    print(f"Loop done: {passed} passed, {failed} failed")
    print(f"{'=' * 60}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
