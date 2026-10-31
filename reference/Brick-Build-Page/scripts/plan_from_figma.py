#!/usr/bin/env python3
"""
Phase C — Auto PLAN from Figma URL + work_info.md.

Reads Figma Desktop URL + Tên Page → generates plans/page-<slug>.md
Optional: create WP page + section templates (--create-shell).

Template-only (rule 55): --template-name → plans/template-<slug>.md, creates templates only,
never a page, and leaves work_info.md untouched.

Usage:
  python3 scripts/plan_from_figma.py --work-info work_info.md
  python3 scripts/plan_from_figma.py --figma-url "https://figma.com/design/..." --page-name "My LDP"
  python3 scripts/plan_from_figma.py --work-info work_info.md --create-shell
  python3 scripts/plan_from_figma.py --work-info work_info.md --dry-run
  python3 scripts/plan_from_figma.py --figma-url "https://figma.com/design/...?node-id=1-2" --template-name "Hero CF" --create-shell
  python3 scripts/plan_from_figma.py --figma-url "..." --template-name "CF Talk" --multi-section --create-shell
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.bricks_mcp import get_site_info
from scripts.lib.env_loader import load_env
from scripts.lib.figma_api import parse_figma_url
from scripts.lib.plan_generator.build_plan import generate_plan_from_figma
from scripts.lib.plan_generator.work_info import read_work_info, update_work_info


def main() -> int:
    parser = argparse.ArgumentParser(description="Phase C: auto-generate plan from Figma")
    parser.add_argument("--work-info", type=Path, default=ROOT / "work_info.md")
    parser.add_argument("--figma-url", type=str, help="Override Figma Desktop URL")
    parser.add_argument("--page-name", type=str, help="Override Tên Page")
    parser.add_argument(
        "--template-name",
        type=str,
        help="Template-only mode (rule 55): build section template(s) without a page",
    )
    parser.add_argument(
        "--multi-section",
        action="store_true",
        help="Template-only: treat children of the Figma node as separate sections",
    )
    parser.add_argument("--figma-mobile-url", type=str, default="")
    parser.add_argument("--page-node", type=str, help="Figma page frame node id (e.g. 5:23441)")
    parser.add_argument(
        "--create-shell",
        action="store_true",
        help="Create draft page + templates via MCP (template-only: templates only)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print plan only, no write/MCP")
    parser.add_argument("--no-context", action="store_true", help="Skip saving Figma context JSON")
    parser.add_argument("--out", type=Path, help="Override plan output path")
    args = parser.parse_args()

    template_only = bool(args.template_name and args.template_name.strip())
    if args.multi_section and not template_only:
        parser.error("--multi-section requires --template-name")
    if template_only and args.page_name:
        parser.error("Use either --template-name or --page-name, not both")

    env = load_env()
    token = env.get("FIGMA_ACCESS_TOKEN", "").strip()
    if not token:
        print("FIGMA_ACCESS_TOKEN missing in .env", file=sys.stderr)
        return 1

    work_path = args.work_info if args.work_info.is_absolute() else ROOT / args.work_info
    # Template-only input comes from chat, so a half-filled work_info.md must not leak in.
    info = read_work_info(work_path) if work_path.is_file() and not template_only else {}

    figma_url = args.figma_url or info.get("figma_desktop_url", "")
    name = args.template_name.strip() if template_only else (args.page_name or info.get("page_name", ""))
    mobile_url = args.figma_mobile_url or info.get("figma_mobile_url", "")
    if mobile_url.lower() in ("", "trống", "trong", "none", "n/a"):
        mobile_url = None

    if not figma_url:
        print("Missing Figma Desktop URL (--figma-url or work_info.md)", file=sys.stderr)
        return 1
    try:
        figma_node_in_url = parse_figma_url(figma_url).node_id
    except ValueError as error:
        print(f"{error} — cần link dạng https://www.figma.com/design/<fileKey>/<name>?node-id=<id>", file=sys.stderr)
        return 1
    if template_only and not args.page_node and not figma_node_in_url:
        print("Template-only needs a Figma URL with node-id (Copy link to selection)", file=sys.stderr)
        return 1
    if not name:
        print("Missing page name (--page-name or Tên Page in work_info.md)", file=sys.stderr)
        return 1

    if args.create_shell and not args.dry_run:
        print("Checking Bricks MCP…")
        site = get_site_info()
        print(f"  Site: {site.get('site_url', site)}")

    draft, markdown = generate_plan_from_figma(
        figma_desktop_url=figma_url,
        page_title=name,
        figma_mobile_url=mobile_url,
        figma_token=token,
        page_frame_node=args.page_node,
        create_shell=args.create_shell,
        dry_run=args.dry_run,
        save_context=not args.no_context,
        template_only=template_only,
        multi_section=args.multi_section,
    )

    plan_path = args.out or (ROOT / "plans" / draft.plan_filename)
    plan_rel = f"plans/{draft.plan_filename}"

    if args.dry_run:
        print(markdown)
        print(f"\n[dry-run] Would write: {plan_path}", file=sys.stderr)
        return 0

    plan_path.parent.mkdir(parents=True, exist_ok=True)
    plan_path.write_text(markdown)
    print(f"✓ Plan written: {plan_path}")

    if work_path.is_file() and not template_only:
        update_work_info(work_path, draft, plan_rel)
        print(f"✓ work_info.md updated: {work_path}")

    buildable = [s for s in draft.sections if not s.skip_build]
    print(f"\nSections: {len(buildable)} buildable")
    for s in buildable:
        tid = s.template_id or "TBD"
        title = f" \"{s.template_title}\"" if s.template_title else ""
        print(f"  #{s.index} {s.figma_name}{title} → {tid} ({s.strategy})")

    if template_only:
        if len(buildable) == 1 and buildable[0].template_id:
            print(f"\nNext: python3 scripts/ldp_autopilot.py --plan {plan_rel} --template-id {buildable[0].template_id}")
            return 0
        print("\n⏸️  PAUSE — nhiều template: review plan, xác nhận rồi chạy autopilot --template-id từng cái.")
        return 0

    if draft.page_id:
        print(f"\nPage ID: {draft.page_id}")
        print("Next: python3 scripts/ldp_autopilot.py --plan", plan_rel)

    print("\n⏸️  PAUSE — review plan + work_info, xác nhận rồi chạy autopilot.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
