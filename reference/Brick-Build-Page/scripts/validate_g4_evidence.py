#!/usr/bin/env python3
"""
G3.5 — Verify auto-captured Bricks PNGs exist (from screenshot_templates.py in G3).

User does NOT provide images during build. PNGs are created by review_gates --per-section
(Chrome headless + WP login). This script only checks files landed in evidence dir.

With --require-checklist it also enforces the agent half of G4: every section must
have `### G4 acceptance checklist` with every row marked pass (rule 37).

Usage:
  python3 scripts/validate_g4_evidence.py --plan plans/page-blog-tuan-dang.md
  python3 scripts/validate_g4_evidence.py --plan plans/page-blog-tuan-dang.md --require-figma
  python3 scripts/validate_g4_evidence.py --plan plans/page-blog-tuan-dang.md --require-checklist
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.plan_parser import parse_plan, plan_has_figma_mobile


def _find_bricks_shots(evidence_dir: Path, template_id: int) -> tuple[list[Path], list[Path]]:
    desktop: list[Path] = []
    mobile: list[Path] = []
    for path in evidence_dir.glob(f"tpl_{template_id}_*.png"):
        if "_mobile_" in path.name:
            mobile.append(path)
        else:
            desktop.append(path)
    return desktop, mobile


def _find_figma_shot(figma_dir: Path, node: str | None) -> Path | None:
    if not node or not figma_dir.is_dir():
        return None
    slug = node.replace(":", "-")
    matches = list(figma_dir.glob(f"*{slug}*.png"))
    return matches[0] if matches else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate G4 comparison PNG evidence")
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--evidence-dir", type=Path, help="Override plan G4 evidence dir")
    parser.add_argument("--require-figma", action="store_true", help="Also require figma/*.png per section")
    parser.add_argument("--require-full-page", action="store_true", help="Require page_* desktop + mobile PNG")
    parser.add_argument(
        "--require-checklist",
        action="store_true",
        help="Require every G4 acceptance checklist row marked pass (✅ / pass / đạt)",
    )
    parser.add_argument("--template-id", type=int, help="Single section only")
    args = parser.parse_args()

    plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
    meta = parse_plan(plan_path)
    rel = meta.evidence_dir or args.evidence_dir
    if not rel and not args.evidence_dir:
        print("G4 evidence FAIL: no G4 evidence dir in plan (use --evidence-dir)", file=sys.stderr)
        return 1

    evidence_dir = args.evidence_dir or (ROOT / rel)
    if not evidence_dir.is_absolute():
        evidence_dir = ROOT / evidence_dir

    figma_dir = evidence_dir.parent / "figma"
    errors: list[str] = []
    checklist_errors: list[str] = []
    warns: list[str] = []

    check_mobile = plan_has_figma_mobile(meta)

    if args.require_full_page and meta.page_id:
        page_desktop = evidence_dir / f"page_{meta.page_id}_desktop.png"
        page_mobile = evidence_dir / f"page_{meta.page_id}_mobile.png"
        if not page_desktop.is_file():
            errors.append(f"missing full page desktop: {page_desktop.name}")
        if check_mobile and not page_mobile.is_file():
            errors.append(f"missing full page mobile: {page_mobile.name}")

    sections = [s for s in meta.sections if s.template_id]
    if args.template_id:
        sections = [s for s in sections if s.template_id == args.template_id]
        if not sections:
            print(f"Template {args.template_id} not in plan", file=sys.stderr)
            return 1

    for section in sections:
        label = f"{section.name} ({section.template_id})"
        desktop, mobile = _find_bricks_shots(evidence_dir, section.template_id)

        if args.require_checklist:
            if not section.has_g4_checklist or not section.g4_checklist:
                checklist_errors.append(f"{label}: missing ### G4 acceptance checklist rows")
            for criterion in section.g4_checklist_failures:
                checklist_errors.append(f"{label}: checklist chưa pass — {criterion}")

        if not desktop:
            errors.append(f"{label}: missing Bricks desktop PNG tpl_{section.template_id}_*.png")
        if check_mobile and section.figma_mobile and not mobile:
            errors.append(f"{label}: missing Bricks mobile PNG tpl_{section.template_id}_mobile_*.png")

        if args.require_figma:
            if section.figma_desktop and not _find_figma_shot(figma_dir, section.figma_desktop):
                warns.append(f"{label}: missing Figma desktop PNG for {section.figma_desktop}")
            if check_mobile and section.figma_mobile and not _find_figma_shot(figma_dir, section.figma_mobile):
                warns.append(f"{label}: missing Figma mobile PNG for {section.figma_mobile}")

    for msg in errors + checklist_errors:
        print(f"ERROR {msg}", file=sys.stderr)
    for msg in warns:
        print(f"WARN {msg}")

    if errors:
        print(f"\nG3.5 evidence FAIL: {len(errors)} error(s)", file=sys.stderr)
        print(
            "Auto-capture (WP running + Figma Desktop for assets):\n"
            "  python3 scripts/review_gates.py --plan <plan> --page-id <id> --per-section",
            file=sys.stderr,
        )
    if checklist_errors:
        print(
            f"\nG4 checklist FAIL: {len(checklist_errors)} dòng — agent so Figma PNG ↔ tpl_* cùng viewport "
            "rồi ghi ✅ / ❌ vào cột Pass",
            file=sys.stderr,
        )
    if errors or checklist_errors:
        return 1

    scope = "evidence + checklist" if args.require_checklist else "evidence"
    print(f"G3.5 {scope} PASS: {len(sections)} section(s) under {evidence_dir}")
    if warns:
        print(f"  ({len(warns)} figma warn — add PNGs or run export_figma_note_assets.py)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
