#!/usr/bin/env python3
"""
G2.5 — Validate Bricks structure matches plan mobile strategy.

Usage:
  python3 scripts/validate_section_structure.py --plan plans/page-blog-tuan-dang.md --template-id 8037
  python3 scripts/validate_section_structure.py --template-id 8037 --strategy dual-block
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.bricks_mcp import get_template
from scripts.lib.plan_parser import section_by_template_id
from scripts.lib.section_structure import validate_section_structure


def main() -> int:
    parser = argparse.ArgumentParser(description="G2.5: plan strategy vs template structure")
    parser.add_argument("--template-id", type=int, required=True)
    parser.add_argument("--plan", type=Path, help="Plan file for section spec")
    parser.add_argument(
        "--strategy",
        choices=("breakpoint-only", "slider-responsive", "dual-block", "carousel-dual", "n/a"),
        help="Override strategy when plan missing",
    )
    args = parser.parse_args()

    elements = get_template(args.template_id).get("elements", [])
    spec = None
    if args.plan:
        plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
        spec = section_by_template_id(plan_path, args.template_id)
        if not spec:
            print(f"WARN: template {args.template_id} not found in plan", file=sys.stderr)

    if args.strategy and spec:
        spec.strategy = args.strategy
    elif args.strategy and not spec:
        from scripts.lib.plan_parser import SectionSpec

        spec = SectionSpec(index=0, name="?", body="", template_id=args.template_id, strategy=args.strategy)

    result = validate_section_structure(elements, spec)
    for issue in result.issues:
        mark = "ERROR" if issue.level == "error" else "WARN"
        print(f"{mark} {issue.message}")

    status = "PASS" if result.passed else "FAIL"
    strategy = spec.strategy if spec else "?"
    print(f"\nG2.5 {status}: template {args.template_id}, strategy={strategy}, {len(result.issues)} issue(s)")
    return 0 if result.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
