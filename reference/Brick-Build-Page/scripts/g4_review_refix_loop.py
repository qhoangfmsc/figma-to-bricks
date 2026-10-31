#!/usr/bin/env python3
"""
Alias for `ldp_autopilot.py --until-pass`: review + refix, bounded by rule 39.

Per section:
  BUILD → G1–G3 → G4 → fail → auto-patch → rebuild/upload → lặp, tối đa 2 vòng PATCH.

Usage:
  python3 scripts/g4_review_refix_loop.py --plan plans/page-ldp-test-template.md --page-id 8162
  python3 scripts/g4_review_refix_loop.py --plan plans/page-ldp-test-template.md --template-id 8168
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.ldp_autopilot import MAX_G4_ATTEMPTS
from scripts.lib.visual_compare import G4_THRESHOLD_PCT


def main() -> int:
    parser = argparse.ArgumentParser(description="G4 review-refix loop (≤ 2 PATCH rounds / section)")
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--page-id", type=int)
    parser.add_argument("--template-id", type=int)
    parser.add_argument("--g4-threshold", type=float, default=G4_THRESHOLD_PCT)
    parser.add_argument("--max-g4-rounds", type=int, default=MAX_G4_ATTEMPTS)
    parser.add_argument("--skip-g0", action="store_true")
    parser.add_argument("--skip-figma-export", action="store_true")
    args = parser.parse_args()

    plan = args.plan if args.plan.is_absolute() else ROOT / args.plan
    cmd = [
        sys.executable,
        str(ROOT / "scripts" / "ldp_autopilot.py"),
        "--plan",
        str(plan),
        "--until-pass",
        "--write-diff",
        "--continue-on-fail",
        "--g4-threshold",
        str(args.g4_threshold),
        "--max-g4-rounds",
        str(args.max_g4_rounds),
    ]
    if args.page_id:
        cmd.extend(["--page-id", str(args.page_id)])
    if args.template_id:
        cmd.extend(["--template-id", str(args.template_id)])
    if args.skip_g0:
        cmd.append("--skip-g0")
    if args.skip_figma_export:
        cmd.append("--skip-figma-export")
    return subprocess.call(cmd, cwd=ROOT)


if __name__ == "__main__":
    raise SystemExit(main())
