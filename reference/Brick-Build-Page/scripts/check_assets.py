#!/usr/bin/env python3
"""
Health check Figma local asset server trước mỗi vòng REVIEW.

Usage:
  python3 scripts/check_assets.py plans/page-cf-talk.md
  python3 scripts/check_assets.py plans/page-cf-talk.md --sample 5
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.plan_parser import parse_asset_urls


def check_url(url: str) -> dict:
    req = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read()
            return {"url": url, "status": resp.status, "size": len(body), "ok": resp.status == 200}
    except Exception as exc:
        return {"url": url, "status": 0, "size": 0, "ok": False, "error": str(exc)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Check Figma asset URLs from plan file")
    parser.add_argument("plan", type=Path)
    parser.add_argument("--sample", type=int, default=0, help="Limit to first N URLs (0 = all)")
    parser.add_argument("--out", default="scripts/refill/asset-check.json")
    args = parser.parse_args()

    plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
    urls = parse_asset_urls(plan_path)
    if args.sample > 0:
        urls = urls[: args.sample]

    if not urls:
        print("No asset URLs found in plan.", file=sys.stderr)
        return 1

    results = [check_url(url) for url in urls]
    failed = [r for r in results if not r["ok"]]

    out_path = ROOT / args.out
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2))

    for row in results:
        mark = "OK" if row["ok"] else "FAIL"
        print(f"{mark} {row['status']} {row['url']}")

    print(f"\n{len(results) - len(failed)}/{len(results)} assets OK")
    if failed:
        print("→ Gọi Figma MCP get_design_context cho section liên quan, rồi chạy refill_all_templates.py", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
