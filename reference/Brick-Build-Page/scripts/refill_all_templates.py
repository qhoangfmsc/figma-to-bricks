#!/usr/bin/env python3
"""
Re-save templates qua Bricks MCP (get_template → set_template_content).
Dùng khi Figma asset cache refresh xong — ép Bricks tải lại ảnh.

Usage:
  python3 scripts/refill_all_templates.py plans/page-cf-talk.md
  python3 scripts/refill_all_templates.py --ids 7965,7966,7967
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.bricks_mcp import refill_template
from scripts.lib.plan_parser import parse_template_ids


def main() -> int:
    parser = argparse.ArgumentParser(description="Refill Bricks templates via MCP bridge")
    parser.add_argument("plan", nargs="?", help="Path to plans/*.md (extract template IDs)")
    parser.add_argument("--ids", help="Comma-separated template IDs (override plan)")
    parser.add_argument("--out", default="scripts/refill/refill-summary.json", help="Summary output path")
    args = parser.parse_args()

    if args.ids:
        template_ids = [int(x.strip()) for x in args.ids.split(",") if x.strip()]
    elif args.plan:
        template_ids = parse_template_ids(args.plan)
    else:
        parser.error("Provide plan path or --ids")

    if not template_ids:
        print("No template IDs found.", file=sys.stderr)
        return 1

    results = []
    for template_id in template_ids:
        try:
            saved = refill_template(template_id)
            row = {
                "template_id": template_id,
                "status": "ok",
                "saved_elements": saved.get("saved_elements"),
                "edit_url": saved.get("edit_url"),
            }
            print(f"OK {template_id}: {row['saved_elements']} elements")
        except Exception as exc:
            row = {"template_id": template_id, "status": "error", "error": str(exc)}
            print(f"ERR {template_id}: {exc}", file=sys.stderr)
        results.append(row)

    out_path = ROOT / args.out
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2))

    failed = sum(1 for r in results if r["status"] != "ok")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
