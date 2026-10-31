#!/usr/bin/env python3
"""
Apply Bricks pageSettings on section templates — hide site header/footer for G3 screenshots.

Usage:
  python3 scripts/apply_section_page_settings.py --plan plans/page-blog-tuan-dang.md
  python3 scripts/apply_section_page_settings.py --template-id 8039
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.bricks_mcp import (
    SECTION_REVIEW_PAGE_SETTINGS,
    get_template,
    section_review_page_settings_applied,
    set_page_settings,
    set_template_content,
)
from scripts.lib.plan_parser import parse_plan


def apply_one(template_id: int, *, dry_run: bool) -> bool:
    data = get_template(template_id)
    page_settings = data.get("page_settings") or {}
    if section_review_page_settings_applied(page_settings):
        print(f"OK {template_id}: page_settings already set")
        return True

    if dry_run:
        print(f"DRY {template_id}: would set headerDisabled + footerDisabled")
        return True

    elements = data.get("elements", [])
    result = set_page_settings(
        SECTION_REVIEW_PAGE_SETTINGS,
        template_id=template_id,
    )
    saved = (result.get("saved_page_settings") or result.get("page_settings", {}).get("saved_page_settings"))
    verify = get_template(template_id)
    applied = section_review_page_settings_applied(verify.get("page_settings"))
    if applied:
        print(f"OK {template_id}: headerDisabled + footerDisabled")
        return True

    if saved:
        print(f"OK {template_id}: page_settings saved → {saved}")
        return True

    print(
        f"FAIL {template_id}: page_settings chưa lưu — deploy plugin "
        f"plugins/bricks-mcp-bridge lên WP rồi chạy lại",
        file=sys.stderr,
    )
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Hide site header/footer on section templates")
    parser.add_argument("--plan", type=Path)
    parser.add_argument("--template-id", type=int)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    template_ids: list[int] = []
    if args.template_id:
        template_ids = [args.template_id]
    elif args.plan:
        plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
        template_ids = [
            s.template_id for s in parse_plan(plan_path).sections if s.template_id
        ]
    else:
        parser.error("Provide --plan or --template-id")

    failed = 0
    for tid in template_ids:
        try:
            if not apply_one(tid, dry_run=args.dry_run):
                failed += 1
        except Exception as exc:
            print(f"FAIL {tid}: {exc}", file=sys.stderr)
            failed += 1

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
