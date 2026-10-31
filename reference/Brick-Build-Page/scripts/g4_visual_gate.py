#!/usr/bin/env python3
"""
G4 — Automated visual gate: compare Figma PNG vs Bricks PNG per section.

Requires:
  - Bricks PNG from review_gates / screenshot_templates (G3)
  - Figma PNG in notes/<page>/assets/figma/ (export_figma_section_pngs.py)

This is only half of G4: a section passes G4 when this script passes with the
canonical parameters AND its plan checklist passes (validate_g4_evidence.py
--require-checklist). See rule_for_flow.md § Định nghĩa G4.

Usage:
  python3 scripts/g4_visual_gate.py --plan plans/page-ldp-template-v2.md
  python3 scripts/g4_visual_gate.py --plan plans/page-ldp-template-v2.md --template-id 8111 --write-diff
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.plan_parser import SectionSpec, parse_plan, plan_has_figma_mobile
from scripts.lib.review_viewport import DESKTOP_WIDTH, mobile_review_width
from scripts.lib.visual_compare import (
    G4_BLUR_RADIUS,
    G4_PIXEL_TOLERANCE,
    G4_THRESHOLD_PCT,
    VisualCompareResult,
    compare_images,
    write_diff_image,
)



@dataclass
class SectionG4Report:
    section: str
    template_id: int
    desktop: VisualCompareResult | None = None
    mobile: VisualCompareResult | None = None
    errors: list[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        if self.errors:
            return False
        if self.desktop and not self.desktop.passed:
            return False
        if self.mobile and not self.mobile.passed:
            return False
        return self.desktop is not None or self.mobile is not None


def _node_slug(node: str) -> str:
    return node.replace(":", "-")


def _is_tiny_figma(path: Path, *, max_width: int = 400) -> bool:
    try:
        from PIL import Image

        with Image.open(path) as img:
            return img.width < max_width
    except OSError:
        return False


def _find_bricks_png(evidence_dir: Path, template_id: int, *, mobile: bool) -> Path | None:
    candidates = sorted(evidence_dir.glob(f"tpl_{template_id}_*.png"))
    filtered: list[Path] = []
    for path in candidates:
        if "_audit_" in path.name:
            continue
        if mobile and "_mobile_" not in path.name:
            continue
        if not mobile and "_mobile_" in path.name:
            continue
        filtered.append(path)
    if not filtered:
        return None
    return max(filtered, key=lambda p: p.stat().st_mtime)


def _find_figma_png(figma_dir: Path, node: str | None) -> Path | None:
    if not node or not figma_dir.is_dir():
        return None
    slug = _node_slug(node)
    matches = sorted(figma_dir.glob(f"*{slug}*.png"))
    return matches[0] if matches else None


def _compare_viewport(
    spec: SectionSpec,
    evidence_dir: Path,
    figma_dir: Path,
    *,
    mobile: bool,
    threshold: float,
    target_width: int | None,
    write_diff: bool,
    diff_dir: Path | None,
    blur_radius: float = 0.0,
    pixel_tolerance: int = 0,
) -> tuple[VisualCompareResult | None, list[str]]:
    errors: list[str] = []
    template_id = spec.template_id
    if not template_id:
        return None, ["missing template_id"]

    node = spec.figma_mobile if mobile else spec.figma_desktop
    if not node:
        if mobile and spec.mobile_differs:
            errors.append("missing Figma mobile node in plan")
        return None, errors

    bricks = _find_bricks_png(evidence_dir, template_id, mobile=mobile)
    figma = _find_figma_png(figma_dir, node)
    if not bricks:
        errors.append(f"missing Bricks {'mobile' if mobile else 'desktop'} PNG")
        return None, errors
    if not figma:
        errors.append(f"missing Figma PNG for node {node}")
        return None, errors

    width = mobile_review_width(figma) if mobile else (None if _is_tiny_figma(figma) else target_width)
    result = compare_images(
        figma,
        bricks,
        target_width=width,
        threshold_pct=threshold,
        blur_radius=blur_radius,
        pixel_tolerance=pixel_tolerance,
    )
    if write_diff and diff_dir and not result.passed:
        diff_path = diff_dir / f"diff_{template_id}_{'mobile' if mobile else 'desktop'}.png"
        write_diff_image(figma, bricks, diff_path, target_width=width)
    return result, errors


def _is_floating_section(spec: SectionSpec) -> bool:
    if spec.slug and "floating" in spec.slug:
        return True
    return "floating" in spec.name.lower()


def review_section(
    spec: SectionSpec,
    evidence_dir: Path,
    figma_dir: Path,
    meta,
    *,
    threshold: float,
    skip_mobile: bool,
    write_diff: bool,
    diff_dir: Path | None,
    blur_radius: float = 0.0,
    pixel_tolerance: int = 0,
) -> SectionG4Report:
    report = SectionG4Report(section=spec.name, template_id=spec.template_id or 0)

    if _is_floating_section(spec):
        report.errors.append("floating section — G4 auto skipped (manual review)")
        return report

    desktop, d_errors = _compare_viewport(
        spec,
        evidence_dir,
        figma_dir,
        mobile=False,
        threshold=threshold,
        target_width=DESKTOP_WIDTH,
        write_diff=write_diff,
        diff_dir=diff_dir,
        blur_radius=blur_radius,
        pixel_tolerance=pixel_tolerance,
    )
    report.desktop = desktop
    report.errors.extend(d_errors)

    needs_mobile = (
        not skip_mobile
        and plan_has_figma_mobile(meta)
        and (
            spec.mobile_differs
            or (
                spec.figma_mobile
                and spec.figma_desktop
                and spec.figma_mobile != spec.figma_desktop
            )
        )
    )
    if needs_mobile:
        mobile, m_errors = _compare_viewport(
            spec,
            evidence_dir,
            figma_dir,
            mobile=True,
            threshold=threshold,
            target_width=None,
            write_diff=write_diff,
            diff_dir=diff_dir,
            blur_radius=blur_radius,
            pixel_tolerance=pixel_tolerance,
        )
        report.mobile = mobile
        report.errors.extend(m_errors)

    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="G4 automated visual compare Figma vs Bricks")
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--template-id", type=int, help="Single section only")
    parser.add_argument("--evidence-dir", type=Path)
    parser.add_argument("--figma-dir", type=Path, help="Override figma PNG dir")
    parser.add_argument(
        "--threshold",
        type=float,
        default=G4_THRESHOLD_PCT,
        help=f"Pass similarity %% (default {G4_THRESHOLD_PCT:g})",
    )
    parser.add_argument("--skip-mobile", action="store_true")
    parser.add_argument("--write-diff", action="store_true", help="Write diff PNG on fail")
    parser.add_argument("--json-out", type=Path, help="Write report JSON")
    parser.add_argument(
        "--blur-radius",
        type=float,
        default=G4_BLUR_RADIUS,
        help=f"Gaussian blur radius before compare (font AA noise). Default {G4_BLUR_RADIUS:g}.",
    )
    parser.add_argument(
        "--font-tolerance",
        type=int,
        default=G4_PIXEL_TOLERANCE,
        help=f"Ignore per-channel pixel diff below this value (font AA). Default {G4_PIXEL_TOLERANCE}.",
    )
    args = parser.parse_args()

    is_canonical = (
        args.threshold == G4_THRESHOLD_PCT
        and args.blur_radius == G4_BLUR_RADIUS
        and args.font_tolerance == G4_PIXEL_TOLERANCE
    )

    plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
    meta = parse_plan(plan_path)
    evidence_dir = args.evidence_dir or (ROOT / meta.evidence_dir if meta.evidence_dir else None)
    if not evidence_dir:
        print("G4 FAIL: no evidence dir (plan or --evidence-dir)", file=sys.stderr)
        return 1

    figma_dir = args.figma_dir or (evidence_dir.parent / "figma")
    diff_dir = evidence_dir / "diff" if args.write_diff else None
    skip_mobile = args.skip_mobile or not plan_has_figma_mobile(meta)

    sections = meta.sections
    if args.template_id:
        sections = [s for s in sections if s.template_id == args.template_id]
        if not sections:
            print(f"Template {args.template_id} not in plan", file=sys.stderr)
            return 1

    reports: list[SectionG4Report] = []
    passed = 0
    failed = 0

    aa_note = ""
    if args.blur_radius > 0 or args.font_tolerance > 0:
        parts = []
        if args.blur_radius > 0:
            parts.append(f"blur={args.blur_radius}")
        if args.font_tolerance > 0:
            parts.append(f"tolerance={args.font_tolerance}")
        aa_note = f"  AA noise reduction: {', '.join(parts)}\n"

    print(f"G4 visual gate — threshold {args.threshold}%")
    print(f"  Bricks: {evidence_dir}")
    print(f"  Figma:  {figma_dir}")
    if aa_note:
        print(aa_note, end="")
    if not is_canonical:
        print(
            "  WARN: tham số khác chuẩn G4 — kết quả chỉ để chẩn đoán, không ghi G4 pass.",
            file=sys.stderr,
        )
    print()

    for spec in sections:
        if not spec.template_id:
            continue
        report = review_section(
            spec,
            evidence_dir,
            figma_dir,
            meta,
            threshold=args.threshold,
            skip_mobile=skip_mobile,
            write_diff=args.write_diff,
            diff_dir=diff_dir,
            blur_radius=args.blur_radius,
            pixel_tolerance=args.font_tolerance,
        )
        reports.append(report)

        label = f"{spec.name} ({spec.template_id})"
        if report.errors and not report.desktop and not report.mobile:
            if any("skipped" in e.lower() for e in report.errors):
                print(f"○ {label}: SKIP — {'; '.join(report.errors)}")
                passed += 1
                continue
            print(f"✗ {label}: SKIP — {'; '.join(report.errors)}")
            failed += 1
            continue

        lines: list[str] = []
        if report.desktop:
            lines.append(f"desktop {report.desktop.similarity_pct}%")
        if report.mobile:
            lines.append(f"mobile {report.mobile.similarity_pct}%")
        if report.errors:
            lines.extend(report.errors)

        if report.passed:
            print(f"✓ {label}: {' · '.join(lines)}")
            passed += 1
        else:
            print(f"✗ {label}: {' · '.join(lines)}")
            failed += 1

    if args.json_out:
        payload = []
        for r in reports:
            item = {
                "section": r.section,
                "template_id": r.template_id,
                "passed": r.passed,
                "errors": r.errors,
            }
            if r.desktop:
                d = asdict(r.desktop)
                d["figma_path"] = str(d["figma_path"])
                d["bricks_path"] = str(d["bricks_path"])
                item["desktop"] = d
            if r.mobile:
                d = asdict(r.mobile)
                d["figma_path"] = str(d["figma_path"])
                d["bricks_path"] = str(d["bricks_path"])
                item["mobile"] = d
            payload.append(item)
        args.json_out.parent.mkdir(parents=True, exist_ok=True)
        args.json_out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))

    print(f"\nG4 auto summary: {passed} passed, {failed} failed")
    if passed:
        print("  → G4 chỉ pass khi checklist plan cũng pass: validate_g4_evidence.py --require-checklist")
    if not is_canonical:
        return 1
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
