#!/usr/bin/env python3
"""Batch PATCH → build → G1–G3 → G4 for sections with patch files."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.g4_refix import apply_g4_refix, merge_patches_into_cached_tree
from scripts.lib.plan_parser import parse_plan, section_by_template_id

TIDS_DEFAULT = [8168, 8165, 8164, 8169, 8167, 8171, 8170, 8172, 8163]


def run(cmd: list[str]) -> int:
    print(f"$ {' '.join(cmd)}")
    return subprocess.call(cmd, cwd=ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(description="Batch refix sections with patch JSON")
    parser.add_argument("--plan", type=Path, default=Path("plans/page-ldp-test-template.md"))
    parser.add_argument("--page-id", type=int, default=8162)
    parser.add_argument("--template-ids", help="Comma-separated template IDs")
    parser.add_argument("--threshold", type=float, default=98.0)
    args = parser.parse_args()

    plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
    meta = parse_plan(plan_path)
    plan_rel = plan_path.relative_to(ROOT)
    tids = (
        [int(x.strip()) for x in args.template_ids.split(",") if x.strip()]
        if args.template_ids
        else TIDS_DEFAULT
    )

    passed: list[int] = []
    failed: list[tuple[int, float | None]] = []

    for tid in tids:
        spec = section_by_template_id(plan_path, tid)
        if not spec:
            print(f"Skip {tid}: not in plan")
            continue
        print(f"\n{'=' * 60}\nBATCH REFIX {tid} — {spec.name}\n{'=' * 60}")

        merge_patches_into_cached_tree(spec, plan_path)
        changed, log = apply_g4_refix(spec, plan_path)
        if log:
            for line in log:
                print(f"  {line}")

        if run(
            [
                sys.executable,
                "scripts/build_from_plan.py",
                "--plan",
                str(plan_rel),
                "--template-id",
                str(tid),
            ]
        ):
            failed.append((tid, None))
            continue

        if run(
            [
                sys.executable,
                "scripts/review_gates.py",
                "--plan",
                str(plan_rel),
                "--page-id",
                str(args.page_id),
                "--template-id",
                str(tid),
                "--per-section",
                "--skip-mobile",
            ]
        ):
            failed.append((tid, None))
            continue

        json_out = ROOT / "notes" / "ldp-test-template" / f"g4-{tid}.json"
        rc = run(
            [
                sys.executable,
                "scripts/g4_visual_gate.py",
                "--plan",
                str(plan_rel),
                "--template-id",
                str(tid),
                "--threshold",
                str(args.threshold),
                "--write-diff",
                "--skip-mobile",
                "--json-out",
                str(json_out),
            ]
        )
        score = None
        if json_out.is_file():
            data = json.loads(json_out.read_text())
            if data and data[0].get("desktop"):
                score = data[0]["desktop"]["similarity_pct"]
        if rc == 0:
            passed.append(tid)
            print(f"✓ {tid} G4 PASS {score}%")
        else:
            failed.append((tid, score))
            print(f"✗ {tid} G4 FAIL {score}%")

    print(f"\n{'=' * 60}")
    print(f"BATCH done: {len(passed)} pass, {len(failed)} fail")
    for tid in passed:
        print(f"  ✓ {tid}")
    for tid, score in failed:
        print(f"  ✗ {tid} ({score}%)")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
