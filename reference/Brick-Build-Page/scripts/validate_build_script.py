#!/usr/bin/env python3
"""
G0.5 — Validate build script independence (rule 48).

Detects clone anti-patterns: get_template(foreign_id) + deepcopy, V1→V2 SECTION_MAP.

Usage:
  python3 scripts/validate_build_script.py scripts/build_ldp-template-v2.py \\
      --plan plans/page-ldp-template-v2.md
  python3 scripts/validate_build_script.py scripts/build_page.py --plan plans/page.md --strict
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.build_guard import scan_build_script
from scripts.lib.plan_parser import parse_plan

BUILD_SCRIPT_RE = __import__("re").compile(
    r"Build script:\s*`([^`]+)`", __import__("re").I
)


def _resolve_script(plan_path: Path, explicit: Path | None) -> Path | None:
    if explicit:
        return explicit if explicit.is_absolute() else ROOT / explicit
    text = plan_path.read_text()
    match = BUILD_SCRIPT_RE.search(text)
    if not match:
        return None
    rel = match.group(1).strip()
    return ROOT / rel


def main() -> int:
    parser = argparse.ArgumentParser(description="G0.5: validate build script independence")
    parser.add_argument("script", type=Path, nargs="?", help="Path to scripts/build_*.py")
    parser.add_argument("--plan", type=Path, help="Plan file (reads Build script: line if script omitted)")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail on warnings (default: fail only on errors)",
    )
    parser.add_argument(
        "--allow-clone",
        action="store_true",
        help="Downgrade clone detection to warnings (debug only)",
    )
    args = parser.parse_args()

    allow_clone = args.allow_clone or os.environ.get("BUILD_ALLOW_CLONE") == "1"

    plan_path: Path | None = None
    if args.plan:
        plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
        if not plan_path.exists():
            print(f"G0.5 FAIL: plan not found: {plan_path}", file=sys.stderr)
            return 1

    script_path = _resolve_script(plan_path, args.script) if plan_path else None
    if args.script:
        script_path = args.script if args.script.is_absolute() else ROOT / args.script

    if not script_path:
        print("G0.5 FAIL: specify script path or --plan with Build script: line", file=sys.stderr)
        return 1

    if not script_path.exists():
        print(f"G0.5 FAIL: script not found: {script_path}", file=sys.stderr)
        return 1

    result = scan_build_script(script_path, plan_path=plan_path, allow_clone=allow_clone)

    for msg in result.errors:
        print(f"ERROR {msg}", file=sys.stderr)
    for msg in result.warnings:
        print(f"WARN {msg}")

    fail = not result.ok or (args.strict and result.warnings)
    if fail:
        label = "FAIL" if not result.ok else "FAIL (--strict)"
        print(
            f"\nG0.5 {label}: {len(result.errors)} error(s), {len(result.warnings)} warn(s)",
            file=sys.stderr,
        )
        print(
            "Fix: rebuild từ Figma get_design_context + ### Settings snapshot trong plan (rule 45, 48)",
            file=sys.stderr,
        )
        return 1

    print(f"G0.5 PASS: {script_path.name} — independent build (no clone detected)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
