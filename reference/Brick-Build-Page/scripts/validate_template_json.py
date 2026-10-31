#!/usr/bin/env python3
"""
G1 — Lint Bricks element JSON before set_template_content.

Usage:
  python3 scripts/validate_template_json.py --template-id 8036
  python3 scripts/validate_template_json.py --json scripts/refill/blog-tuan-dang-8036.json
  python3 scripts/validate_template_json.py --json <out.json> --assets-json scripts/data/<slug>/assets.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.bricks_mcp import get_template
from scripts.lib.template_validate import run_g1


def load_elements(args: argparse.Namespace) -> list[dict]:
    if args.json:
        path = args.json if args.json.is_absolute() else ROOT / args.json
        data = json.loads(path.read_text())
        if isinstance(data, list):
            return data
        return data.get("elements", data.get("content", []))
    if args.template_id:
        return get_template(args.template_id).get("elements", [])
    raise SystemExit("Provide --template-id or --json")


def load_bound_asset_urls(path: Path | None) -> set[str] | None:
    """Asset URLs resolved per Figma node: `assets.json` (node → URL) or `spec.json` (its `assets`)."""
    if not path:
        return None
    path = path if path.is_absolute() else ROOT / path
    data = json.loads(path.read_text())
    mapping = data.get("assets", data) if isinstance(data, dict) else {}
    return {url for url in mapping.values() if isinstance(url, str)}


def main() -> int:
    parser = argparse.ArgumentParser(description="G1: validate Bricks template JSON before upload")
    parser.add_argument("--template-id", type=int)
    parser.add_argument("--json", type=Path)
    parser.add_argument(
        "--assets-json",
        type=Path,
        help="scripts/data/<slug>/assets.json or spec.json — every Figma asset URL must come from it",
    )
    args = parser.parse_args()

    elements = load_elements(args)
    if not elements:
        print("G1 FAIL: no elements", file=sys.stderr)
        return 1

    strict_css = args.json is not None
    result = run_g1(elements, strict_css=strict_css, bound_asset_urls=load_bound_asset_urls(args.assets_json))
    for issue in result.issues:
        mark = "ERROR" if issue.level == "error" else "WARN"
        print(f"{mark} [{issue.element_id}] {issue.message}")

    status = "PASS" if result.passed else "FAIL"
    print(f"\nG1 {status}: {len(result.issues)} issue(s)")
    return 0 if result.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
