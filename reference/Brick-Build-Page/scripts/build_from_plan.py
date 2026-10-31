#!/usr/bin/env python3
"""
Generic plan-driven builder (Phase B) — any page with plans/<page>.md.

Reads ### Cấu trúc element + ### Settings snapshot → Bricks JSON.
Uses cached full trees when present: scripts/data/<plan-slug>/trees/{id}.json

Usage:
  python3 scripts/build_from_plan.py --plan plans/page-ldp-template-v2.md --template-id 8111
  python3 scripts/build_from_plan.py --plan plans/page-ldp-template-v2.md --all
  python3 scripts/build_from_plan.py --plan plans/page-ldp-template-v2.md --all --dry-run
  python3 scripts/build_from_plan.py --plan plans/page-ldp-template-v2.md --template-id 8111 --force-generic
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.bricks_mcp import SECTION_REVIEW_PAGE_SETTINGS, set_template_content
from scripts.lib.figma_build import require_figma_source_note
from scripts.lib.generic_builder.build import build_from_plan_tree, build_section_from_plan, load_cached_tree
from scripts.lib.generic_builder.tree_guard import assert_safe_force_generic
from scripts.lib.plan_parser import parse_plan, section_by_template_id

BUILD_SOURCE = "plan-generic"


def upload_section(
    plan_path: Path,
    template_id: int,
    *,
    dry_run: bool,
    force_generic: bool,
    confirm_overwrite: bool,
) -> dict:
    spec = section_by_template_id(plan_path, template_id)
    if not spec:
        raise SystemExit(f"Template {template_id} not in plan")

    if force_generic:
        if not spec.template_id:
            raise SystemExit("Section missing template_id")
        assert_safe_force_generic(plan_path, spec, confirm=confirm_overwrite)
        elements = build_from_plan_tree(plan_path, spec)
        source = "plan-parse"
    else:
        elements = build_section_from_plan(plan_path, template_id)
        source = BUILD_SOURCE if load_cached_tree(plan_path, spec) is None else "cached-tree"

    slug = spec.slug or str(template_id)
    if dry_run:
        out = ROOT / "scripts" / "refill" / f"generic-{template_id}-dry.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(elements, ensure_ascii=False, indent=2))
        return {
            "dry_run": True,
            "template_id": template_id,
            "slug": slug,
            "elements": len(elements),
            "build_source": source,
            "path": str(out),
        }

    result = set_template_content(
        template_id,
        elements,
        sync_css=True,
        page_settings=SECTION_REVIEW_PAGE_SETTINGS,
    )
    backup = ROOT / "scripts" / "refill" / f"generic-{template_id}.json"
    backup.parent.mkdir(parents=True, exist_ok=True)
    backup.write_text(json.dumps(elements, ensure_ascii=False, indent=2))
    result.update(
        {
            "template_id": template_id,
            "slug": slug,
            "build_source": source,
            "backup": str(backup),
            "figma_node": spec.figma_desktop,
        }
    )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Generic Figma→Bricks builder from plan (Phase B)")
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--template-id", type=int)
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--force-generic",
        action="store_true",
        help="Skip cached trees — build only from plan parse",
    )
    parser.add_argument(
        "--confirm-overwrite-generic",
        action="store_true",
        help="Allow --force-generic even when cached tree has more elements (destructive)",
    )
    args = parser.parse_args()

    plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
    if not plan_path.is_file():
        print(f"Plan not found: {plan_path}", file=sys.stderr)
        return 1

    meta = parse_plan(plan_path)
    print(require_figma_source_note())
    print(f"Generic builder — plan: {plan_path.name}")
    print(f"Build source tag: {BUILD_SOURCE}\n")

    if args.template_id:
        targets = [args.template_id]
    elif args.all:
        targets = [s.template_id for s in meta.sections if s.template_id]
    else:
        parser.error("Specify --template-id or --all")

    for tid in targets:
        spec = section_by_template_id(plan_path, tid)
        name = spec.name if spec else "?"
        print(f"=== {name} → template {tid} ===")
        result = upload_section(
            plan_path,
            tid,
            dry_run=args.dry_run,
            force_generic=args.force_generic,
            confirm_overwrite=args.confirm_overwrite_generic,
        )
        print(json.dumps(result, ensure_ascii=False, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
