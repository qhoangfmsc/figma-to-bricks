#!/usr/bin/env python3
"""
Run review gates G0 → G1 → G2 → G2.5 → G3 (+ G4 evidence) for template(s).

Usage:
  # G0 only — before BUILD
  python3 scripts/review_gates.py --g0 plans/page-blog-tuan-dang.md

  # Single template
  python3 scripts/review_gates.py --template-id 8038 --page-id 8035 --plan plans/page-blog-tuan-dang.md

  # Per-section pipeline — G3 chụp ảnh tự động (mặc định, không cần user cung cấp PNG)
  python3 scripts/review_gates.py --plan plans/page-blog-tuan-dang.md --page-id 8035 --per-section

  # G4 evidence check only
  python3 scripts/review_gates.py --plan plans/page-blog-tuan-dang.md --evidence-only
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.plan_parser import parse_plan, plan_has_figma_mobile, section_by_template_id
from scripts.lib.review_viewport import MOBILE_FALLBACK_WIDTH, figma_mobile_png, mobile_review_width

BRICKS_SETTING_RULE = re.compile(
    r"^[a-zA-Z][\w-]*:(?:tablet_portrait|mobile_portrait|desktop)$"
)


def css_critical_rules(rules: list[str]) -> list[str]:
    """G2 only validates compiled CSS — skip Bricks breakpoint setting keys (G2.5)."""
    return [r.strip() for r in rules if r.strip() and not BRICKS_SETTING_RULE.match(r.strip())]


def run(cmd: list[str]) -> int:
    print(f"\n$ {' '.join(cmd)}")
    return subprocess.call(cmd, cwd=ROOT)


def run_g0(plan: Path, strict: bool) -> int:
    cmd = [sys.executable, "scripts/validate_plan_g0.py", str(plan)]
    if strict:
        cmd.append("--strict")
    return run(cmd)


def run_g1(template_id: int, json_path: Path | None, asset_map: str | None = None) -> int:
    cmd = [sys.executable, "scripts/validate_template_json.py", "--template-id", str(template_id)]
    if json_path:
        cmd = [sys.executable, "scripts/validate_template_json.py", "--json", str(json_path)]
    if asset_map:
        cmd.extend(["--assets-json", asset_map])
    return run(cmd)


def run_g2(template_id: int, page_id: int | None, rules: list[str], plan: Path | None) -> int:
    cmd = [sys.executable, "scripts/validate_css_compiled.py", "--template-id", str(template_id)]
    if page_id:
        cmd.extend(["--page-id", str(page_id)])
    for rule in rules:
        cmd.extend(["--rule", rule])
    return run(cmd)


def run_g25(template_id: int, plan: Path) -> int:
    return run([
        sys.executable,
        "scripts/validate_section_structure.py",
        "--template-id",
        str(template_id),
        "--plan",
        str(plan),
    ])


def run_g3_section(template_id: int, evidence_dir: Path, *, with_mobile: bool) -> int:
    """Desktop + mobile in one call: the HTML/CSS/assets are fetched once and both Chromes run in parallel."""
    # Rule 46: review at the Figma mobile frame width so G4 compares like with like.
    mobile_width = mobile_review_width(figma_mobile_png(evidence_dir, template_id))
    viewports = "1440x3000" + (f",{mobile_width}x4500:_mobile" if with_mobile else "")
    return run([
        sys.executable,
        "scripts/screenshot_templates.py",
        "--ids",
        str(template_id),
        "--viewports",
        viewports,
        "--out-dir",
        str(evidence_dir),
    ])


def run_g3_page(page_id: int, evidence_dir: Path, *, with_mobile: bool) -> int:
    viewports = "1440x9000:_desktop" + (",390x12000:_mobile" if with_mobile else "")
    return run([
        sys.executable,
        "scripts/screenshot_templates.py",
        "--url",
        f"http://localhost:8000/?page_id={page_id}",
        "--out",
        str(evidence_dir / f"page_{page_id}.png"),
        "--viewports",
        viewports,
    ])


def run_evidence(plan: Path, evidence_dir: Path | None, require_full_page: bool) -> int:
    cmd = [sys.executable, "scripts/validate_g4_evidence.py", "--plan", str(plan)]
    if evidence_dir:
        cmd.extend(["--evidence-dir", str(evidence_dir)])
    if require_full_page:
        cmd.append("--require-full-page")
    return run(cmd)


def review_one_section(
    template_id: int,
    plan: Path,
    page_id: int | None,
    *,
    json_path: Path | None,
    evidence_dir: Path | None,
    screenshot: bool,
    skip_g25: bool,
    section_name: str,
    skip_mobile: bool,
) -> int:
    print(f"\n{'=' * 60}\nSection {section_name} — template {template_id}\n{'=' * 60}")
    failed = 0
    spec = section_by_template_id(plan, template_id)
    rules = spec.critical_rules if spec else []

    failed |= run_g1(template_id, json_path, parse_plan(plan).asset_map)
    if failed:
        return failed

    failed |= run_g2(template_id, page_id, css_critical_rules(rules), plan)
    if failed:
        return failed

    if not skip_g25:
        failed |= run_g25(template_id, plan)
        if failed:
            return failed

    if screenshot and evidence_dir:
        with_mobile = bool(not skip_mobile and spec and spec.figma_mobile)
        failed |= run_g3_section(template_id, evidence_dir, with_mobile=with_mobile)

    if failed:
        print(f"\nSection {section_name} ({template_id}): FAIL — fix before G4 visual")
    else:
        print(f"\nSection {section_name} ({template_id}): G1+G2+G2.5 pass — proceed to next section or G4 visual")
    return failed


def main() -> int:
    parser = argparse.ArgumentParser(description="Run G0–G3 review gates")
    parser.add_argument("--plan", type=Path)
    parser.add_argument("--template-id", type=int)
    parser.add_argument("--json", type=Path, help="G1 from JSON file instead of MCP")
    parser.add_argument("--page-id", type=int)
    parser.add_argument("--width", type=int, default=MOBILE_FALLBACK_WIDTH)
    parser.add_argument("--suffix", default="_mobile")
    parser.add_argument(
        "--screenshot",
        action="store_true",
        help="Run G3 auto-screenshot (default when --per-section)",
    )
    parser.add_argument(
        "--skip-screenshot",
        action="store_true",
        help="Skip G3/G3.5 — only G1+G2+G2.5 (no PNG capture)",
    )
    parser.add_argument("--per-section", action="store_true", help="Run G1→G2→G2.5→G3 per section in plan")
    parser.add_argument("--g0", action="store_true", help="Run G0 plan validation only (with --plan)")
    parser.add_argument("--g0-strict", action="store_true", help="Strict G0 (evidence dir + mobile URL)")
    parser.add_argument("--evidence-dir", type=Path, help="G3 PNG output + G4 evidence check")
    parser.add_argument("--evidence-only", action="store_true", help="Only validate G4 evidence PNGs")
    parser.add_argument("--require-full-page", action="store_true", help="G4 evidence needs page desktop+mobile")
    parser.add_argument("--skip-g25", action="store_true", help="Skip G2.5 structure gate")
    parser.add_argument("--skip-mobile", action="store_true", help="Skip G3 mobile screenshots + mobile evidence")
    parser.add_argument("--rule", action="append", default=[])
    args = parser.parse_args()

    if args.skip_screenshot and args.screenshot:
        parser.error("Use either --screenshot or --skip-screenshot")

    # G3: auto-capture Bricks PNG — user never uploads images manually
    capture_screenshots = args.screenshot or (args.per_section and not args.skip_screenshot)

    if args.g0:
        if not args.plan:
            parser.error("--g0 requires --plan")
        plan = args.plan if args.plan.is_absolute() else ROOT / args.plan
        return run_g0(plan, args.g0_strict)

    if args.evidence_only:
        if not args.plan:
            parser.error("--evidence-only requires --plan")
        plan = args.plan if args.plan.is_absolute() else ROOT / args.plan
        meta = parse_plan(plan)
        evidence = args.evidence_dir
        if not evidence and meta.evidence_dir:
            evidence = ROOT / meta.evidence_dir
        if not evidence:
            parser.error("Provide --evidence-dir or G4 evidence dir in plan")
        return run_evidence(plan, evidence, args.require_full_page)

    if not args.plan and not args.template_id:
        parser.error("Provide --plan or --template-id")

    plan_path: Path | None = None
    if args.plan:
        plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
        if not plan_path.exists():
            print(f"Plan not found: {plan_path}", file=sys.stderr)
            return 1

    page_id = args.page_id
    evidence_dir = args.evidence_dir
    if plan_path and not page_id:
        page_id = parse_plan(plan_path).page_id
    if plan_path and not evidence_dir:
        meta = parse_plan(plan_path)
        if meta.evidence_dir:
            evidence_dir = ROOT / meta.evidence_dir

    skip_mobile = args.skip_mobile
    if plan_path and not skip_mobile:
        skip_mobile = not plan_has_figma_mobile(parse_plan(plan_path))

    template_ids: list[int] = []
    if args.per_section and plan_path:
        if not args.g0_strict:
            g0_code = run_g0(plan_path, strict=False)
            if g0_code:
                return g0_code
        for section in parse_plan(plan_path).sections:
            if section.template_id:
                if args.template_id and section.template_id != args.template_id:
                    continue
                template_ids.append(section.template_id)
    elif args.template_id:
        template_ids = [args.template_id]
    elif plan_path:
        from scripts.lib.plan_parser import parse_template_ids

        template_ids = parse_template_ids(plan_path)

    if not template_ids:
        parser.error("No template IDs to review")

    failed = 0

    if args.per_section and plan_path:
        plan_sections = parse_plan(plan_path).sections
        for section in plan_sections:
            if not section.template_id:
                continue
            if args.template_id and section.template_id != args.template_id:
                continue
            failed |= review_one_section(
                section.template_id,
                plan_path,
                page_id,
                json_path=args.json,
                evidence_dir=evidence_dir,
                screenshot=capture_screenshots,
                skip_g25=args.skip_g25,
                section_name=section.name,
                skip_mobile=skip_mobile,
            )
            if failed:
                print("\nPer-section review stopped at first failure.", file=sys.stderr)
                return 1

        # Full page + evidence only when reviewing all sections (not single --template-id)
        if not args.template_id and capture_screenshots and evidence_dir and page_id:
            failed |= run_g3_page(page_id, evidence_dir, with_mobile=not skip_mobile)

        require_full = args.require_full_page or capture_screenshots
        if not args.template_id and capture_screenshots and evidence_dir and plan_path:
            failed |= run_evidence(plan_path, evidence_dir, require_full)

        if failed:
            print("\nGates: FAIL", file=sys.stderr)
            return 1
        print("\nPer-section gates PASS — complete G4 visual per section before DONE")
        return 0

    for tid in template_ids:
        print(f"\n=== Template {tid} ===")
        spec = section_by_template_id(plan_path, tid) if plan_path else None
        rules = (spec.critical_rules if spec else []) + args.rule
        failed |= run_g1(tid, args.json, parse_plan(plan_path).asset_map if plan_path else None)
        g2_cmd_rules = rules
        failed |= run_g2(tid, page_id, g2_cmd_rules, plan_path)
        if plan_path and not args.skip_g25:
            failed |= run_g25(tid, plan_path)

    if capture_screenshots and page_id:
        shot_cmd = [
            sys.executable,
            "scripts/screenshot_templates.py",
            "--page-id",
            str(page_id),
            "--width",
            str(args.width),
        ]
        if args.suffix:
            shot_cmd.extend(["--suffix", args.suffix])
        if evidence_dir:
            shot_cmd.extend(["--out-dir", str(evidence_dir)])
        failed |= run(shot_cmd)

    if failed:
        print("\nGates: FAIL — fix and re-run review_gates.py (same viewport/template)", file=sys.stderr)
        return 1
    print("\nGates G1+G2+G2.5 (+G3 if requested): PASS — proceed to G4 visual review")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
