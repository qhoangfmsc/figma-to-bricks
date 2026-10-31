#!/usr/bin/env python3
"""
Patch một template theo file JSON — chỉ đổi settings/label của element cần sửa.

Patch file format:
{
  "w5box1": { "_cssCustom": "...", "_padding": { "top": "32px" } },
  "w5ti01": { "text": "<div>...</div>", "_width": "100%" },
  "tpl001": { "label": "Hero" }
}

Usage:
  python3 scripts/patch_template.py 7970 snippets/patches/workshop-7970.json
  python3 scripts/patch_template.py 7970 snippets/patches/workshop-7970.json --dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.bricks_mcp import get_template, patch_elements, set_template_content


def main() -> int:
    parser = argparse.ArgumentParser(description="Patch Bricks template via MCP")
    parser.add_argument("template_id", type=int)
    parser.add_argument("patch_file", type=Path)
    parser.add_argument("--dry-run", action="store_true", help="Only write patched JSON, do not save")
    parser.add_argument("--out", help="Output path for patched elements JSON")
    args = parser.parse_args()

    patch_path = args.patch_file if args.patch_file.is_absolute() else ROOT / args.patch_file
    patches = json.loads(patch_path.read_text())

    data = get_template(args.template_id)
    elements = patch_elements(data.get("elements", []), patches)

    out = Path(args.out) if args.out else ROOT / f"scripts/refill/{args.template_id}-patched.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(elements, ensure_ascii=False, indent=2))

    if args.dry_run:
        print(json.dumps({"template_id": args.template_id, "dry_run": True, "output": str(out)}, indent=2))
        return 0

    saved = set_template_content(args.template_id, elements)
    print(json.dumps(saved, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
