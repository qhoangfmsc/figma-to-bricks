#!/usr/bin/env python3
"""
Diagnostic summary — quick overview of all sections' G4 status, issues, and recommendations.

Usage:
  python3 scripts/diagnostic_summary.py --plan plans/page-ldp-test-template.md
  python3 scripts/diagnostic_summary.py --plan plans/page-ldp-test-template.md --check-mcp
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.plan_parser import parse_plan, plan_has_figma_mobile


def _find_latest_g4_report(evidence_dir: Path, template_id: int) -> dict | None:
    json_path = evidence_dir / f"g4-{template_id}.json"
    if not json_path.is_file():
        return None
    try:
        data = json.loads(json_path.read_text())
        return data[0] if data else None
    except (json.JSONDecodeError, IndexError):
        return None


def _find_latest_screenshots(evidence_dir: Path, template_id: int) -> dict[str, Path | None]:
    result = {"desktop": None, "mobile": None}
    for png in sorted(evidence_dir.glob(f"tpl_{template_id}_*.png")):
        if "_audit_" in png.name:
            continue
        if "_mobile_" in png.name:
            result["mobile"] = png
        else:
            result["desktop"] = png
    return result


def _find_diff_png(evidence_dir: Path, template_id: int) -> Path | None:
    diff_dir = evidence_dir / "diff"
    if not diff_dir.is_dir():
        return None
    candidates = list(diff_dir.glob(f"diff_{template_id}_*.png"))
    return candidates[0] if candidates else None


def _has_patch_file(plan_path: Path, template_id: int) -> bool:
    slug = plan_path.stem.replace("page-", "")
    patch_path = ROOT / "scripts" / "data" / slug / "patches" / f"{template_id}.json"
    return patch_path.is_file()


def _has_cached_tree(plan_path: Path, template_id: int) -> bool:
    slug = plan_path.stem.replace("page-", "")
    tree_dir = ROOT / "scripts" / "data" / slug / "trees"
    return any(tree_dir.glob(f"*{template_id}*")) if tree_dir.is_dir() else False


def main() -> int:
    parser = argparse.ArgumentParser(description="Diagnostic summary of G4 status")
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--check-mcp", action="store_true", help="Also verify MCP connection")
    args = parser.parse_args()

    plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
    if not plan_path.is_file():
        print(f"Plan not found: {plan_path}", file=sys.stderr)
        return 1

    meta = parse_plan(plan_path)
    has_mobile = plan_has_figma_mobile(meta)
    evidence_dir = ROOT / meta.evidence_dir if meta.evidence_dir else None
    figma_dir = evidence_dir.parent / "figma" if evidence_dir else None

    # --- Header ---
    print(f"\n{'=' * 70}")
    print(f"DIAGNOSTIC SUMMARY — {plan_path.name}")
    print(f"{'=' * 70}")
    print(f"  Page ID:    {meta.page_id or '?'}")
    print(f"  Sections:   {len(meta.sections)}")
    print(f"  Mobile:     {'yes' if has_mobile else 'no'}")
    print(f"  Evidence:   {evidence_dir or 'not set'}")
    print(f"  Figma dir:  {figma_dir or 'not set'}")

    # --- MCP check ---
    if args.check_mcp:
        from scripts.lib.bricks_mcp import health_check
        print()
        health_check()

    # --- Section status ---
    sections = [s for s in meta.sections if s.template_id]
    if not sections:
        print("\nNo sections with template IDs found.")
        return 0

    print(f"\n{'─' * 70}")
    print(f"{'Section':<30} {'ID':>6} {'Score':>7} {'Status':<10} {'Notes'}")
    print(f"{'─' * 70}")

    passed_count = 0
    near_count = 0
    blocker_count = 0

    for spec in sections:
        tid = spec.template_id
        notes: list[str] = []

        # G4 report
        report = _find_latest_g4_report(evidence_dir, tid) if evidence_dir else None
        score = None
        status = "?"

        if report:
            if report.get("passed"):
                status = "✅ PASS"
                passed_count += 1
            else:
                desktop = report.get("desktop", {})
                score = desktop.get("similarity_pct") if desktop else None
                if score is not None:
                    if score >= 96:
                        status = "🟡 NEAR"
                        near_count += 1
                    elif score >= 80:
                        status = "🟠 MED"
                        blocker_count += 1
                    else:
                        status = "🔴 LOW"
                        blocker_count += 1
                else:
                    status = "❌ ERR"
                    blocker_count += 1

            errors = report.get("errors", [])
            if errors:
                notes.extend(errors[:2])
        else:
            status = "⬜ N/A"

        # Check assets
        screenshots = _find_latest_screenshots(evidence_dir, tid) if evidence_dir else {}
        if screenshots.get("desktop") is None:
            notes.append("no screenshot")

        figma_found = False
        if figma_dir and figma_dir.is_dir():
            figma_pngs = list(figma_dir.glob(f"tpl_{tid}_*.png"))
            figma_found = len(figma_pngs) > 0
        if not figma_found:
            notes.append("no figma PNG")

        if _has_patch_file(plan_path, tid):
            notes.append("has patch")

        if _has_cached_tree(plan_path, tid):
            notes.append("has tree")

        has_diff = _find_diff_png(evidence_dir, tid) if evidence_dir else None
        if has_diff:
            notes.append("diff PNG")

        # Format
        score_str = f"{score:.1f}%" if score is not None else "—"
        notes_str = " | ".join(notes) if notes else ""
        name = spec.name[:28]
        print(f"  {name:<28} {tid:>6} {score_str:>7} {status:<10} {notes_str}")

    # --- Summary ---
    print(f"{'─' * 70}")
    total = len(sections)
    print(f"\n  ✅ Passed: {passed_count}/{total}")
    print(f"  🟡 Near threshold: {near_count}")
    print(f"  🔴 Blockers: {blocker_count}")
    print(f"  ⬜ Not tested: {total - passed_count - near_count - blocker_count}")

    # --- Recommendations ---
    if near_count > 0 or blocker_count > 0:
        print(f"\n{'─' * 70}")
        print("RECOMMENDATIONS:")
        if near_count > 0:
            print(f"  • {near_count} section(s) near threshold — try with --blur-radius 1.0 --font-tolerance 12")
        if blocker_count > 0:
            print(f"  • {blocker_count} section(s) need attention:")
            print(f"    - Check diff PNGs in {evidence_dir}/diff/")
            print(f"    - Sections < 80%: consider rebuild from Figma MCP")
            print(f"    - Sections 80-96%: try autopilot with AA noise reduction")

    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
