#!/usr/bin/env python3
"""
End-to-end Figma → Bricks autopilot.

Mặc định SINGLE-PASS: mỗi section BUILD → G1–G3 → G4 auto đúng 1 lần, không tự PATCH.
`--until-pass`: G4 fail → auto-patch → rebuild/upload → G1–G3 → G4, tối đa
MAX_PATCH_ROUNDS vòng (rule 39), sau đó dừng section và báo blocker.

G4 auto pass ở đây chưa phải G4 pass: agent còn phải điền checklist plan
(validate_g4_evidence.py --require-checklist).

Usage:
  python3 scripts/ldp_autopilot.py --plan plans/page-ldp-test-template.md --page-id 8162
  python3 scripts/ldp_autopilot.py --plan plans/page-ldp-test-template.md --until-pass
  python3 scripts/g4_review_refix_loop.py --plan plans/page-ldp-test-template.md  # alias --until-pass
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.bricks_mcp import health_check
from scripts.lib.env_loader import load_env
from scripts.lib.g4_auto_patch import try_write_baseline_patch
from scripts.lib.g4_refix import apply_g4_refix
from scripts.lib.plan_parser import SectionSpec, parse_plan, plan_has_figma_mobile
from scripts.lib.visual_compare import G4_BLUR_RADIUS, G4_PIXEL_TOLERANCE, G4_THRESHOLD_PCT

# Rule 39: at most 2 PATCH → G2 → G3 → G4 rounds per section and viewport per session.
MAX_PATCH_ROUNDS = 2
MAX_G4_ATTEMPTS = MAX_PATCH_ROUNDS + 1


def run_cmd(cmd: list[str], *, label: str) -> int:
    print(f"\n{'=' * 60}")
    print(label)
    print(f"$ {' '.join(cmd)}")
    print("=" * 60)
    return subprocess.call(cmd, cwd=ROOT)


def resolve_build_script(meta, override: str | None) -> Path:
    rel = override or meta.build_script
    if not rel:
        raise SystemExit("No Build script: in plan (add to plans/<page>.md header)")
    path = ROOT / rel if not Path(rel).is_absolute() else Path(rel)
    if not path.is_file():
        raise SystemExit(f"Build script not found: {path}")
    return path


def build_section(build_script: Path, plan_rel: Path | str, spec: SectionSpec) -> int:
    cmd = [
        sys.executable,
        str(build_script),
        "--plan",
        str(plan_rel),
        "--template-id",
        str(spec.template_id),
    ]
    return run_cmd(cmd, label=f"BUILD [{spec.index:02d}] {spec.name} ({spec.template_id})")


def gates_section(
    plan_rel: Path | str,
    page_id: int | None,
    template_id: int,
    *,
    attempt: int,
    skip_mobile: bool,
) -> int:
    cmd = [
        sys.executable,
        "scripts/review_gates.py",
        "--plan",
        str(plan_rel),
        "--template-id",
        str(template_id),
        "--per-section",
    ]
    if page_id:
        cmd.extend(["--page-id", str(page_id)])
    if skip_mobile:
        cmd.append("--skip-mobile")
    return run_cmd(cmd, label=f"G1–G3 [{template_id}] attempt {attempt}")


def g4_section(
    plan_rel: Path | str,
    template_id: int,
    threshold: float,
    *,
    write_diff: bool,
    attempt: int,
    skip_mobile: bool,
    json_out: Path | None,
    blur_radius: float = 0.0,
    font_tolerance: int = 0,
) -> int:
    cmd = [
        sys.executable,
        "scripts/g4_visual_gate.py",
        "--plan",
        str(plan_rel),
        "--template-id",
        str(template_id),
        "--threshold",
        str(threshold),
    ]
    if write_diff:
        cmd.append("--write-diff")
    if skip_mobile:
        cmd.append("--skip-mobile")
    if json_out:
        cmd.extend(["--json-out", str(json_out)])
    if blur_radius > 0:
        cmd.extend(["--blur-radius", str(blur_radius)])
    if font_tolerance > 0:
        cmd.extend(["--font-tolerance", str(font_tolerance)])
    return run_cmd(cmd, label=f"G4 [{template_id}] attempt {attempt}")


def read_g4_score(json_out: Path) -> float | None:
    if not json_out.is_file():
        return None
    try:
        data = json.loads(json_out.read_text())
        if data and data[0].get("desktop"):
            return float(data[0]["desktop"]["similarity_pct"])
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        pass
    return None


def process_section(
    spec: SectionSpec,
    *,
    build_script: Path,
    plan_rel: Path | str,
    plan_path: Path,
    page_id: int | None,
    skip_build: bool,
    skip_g4: bool,
    skip_mobile: bool,
    g4_threshold: float,
    write_diff: bool,
    max_gate_retries: int,
    max_g4_rounds: int,
    until_pass: bool,
    evidence_dir: Path | None,
    blur_radius: float = 0.0,
    font_tolerance: int = 0,
) -> bool:
    """Return True when section passes G4 auto (or G4 skipped).

    Single-pass: one G4 attempt, no PATCH. Until-pass: after each G4 fail apply one
    PATCH and re-run BUILD → G1–G3 → G4, up to MAX_PATCH_ROUNDS (rule 39). A score
    drop after a PATCH stops the section, because stacking more patches on a
    regression is what wiped layouts before (rule 45: fix the builder instead).
    """
    is_floating = spec.slug and "floating" in spec.slug
    built = False
    needs_rebuild = False
    last_score: float | None = None
    best_score: float | None = None
    patch_count = 0

    json_out = None
    if evidence_dir and spec.template_id:
        json_out = evidence_dir / f"g4-{spec.template_id}.json"

    def blocker(reason: str) -> bool:
        print(
            f"  ✗ G4 blocker {spec.template_id} @ {last_score}% (best {best_score}%): {reason}. "
            f"Ghi fail vào plan/work_info; sửa builder từ Figma ở phiên sau (rule 39, 45)."
        )
        return False

    gate_attempt = 0
    for g4_round in range(1, max_g4_rounds + 1):
        if not skip_build and (not built or needs_rebuild):
            if build_section(build_script, plan_rel, spec) != 0:
                return False
            built = True
            needs_rebuild = False

        gates_passed = False
        while gate_attempt < max_gate_retries:
            gate_attempt += 1
            if gates_section(
                plan_rel,
                page_id,
                spec.template_id,
                attempt=gate_attempt,
                skip_mobile=skip_mobile,
            ) == 0:
                gates_passed = True
                break
        if not gates_passed:
            return blocker("G1–G3 fail")

        if skip_g4 or is_floating:
            return True

        if g4_section(
            plan_rel,
            spec.template_id,
            g4_threshold,
            write_diff=write_diff,
            attempt=g4_round,
            skip_mobile=skip_mobile,
            json_out=json_out,
            blur_radius=blur_radius,
            font_tolerance=font_tolerance,
        ) == 0:
            return True

        score = read_g4_score(json_out) if json_out else None
        if score is not None:
            print(f"G4 score {spec.template_id}: {score}% (threshold {g4_threshold}%)")
            if last_score is not None and score < last_score - 0.5:
                last_score = score
                return blocker("PATCH làm điểm giảm")
            last_score = score
            if best_score is None or score > best_score:
                best_score = score

        if not until_pass:
            return False
        if patch_count >= MAX_PATCH_ROUNDS or g4_round >= max_g4_rounds:
            return blocker(f"hết {patch_count}/{MAX_PATCH_ROUNDS} vòng PATCH")

        auto_path = try_write_baseline_patch(spec, plan_path)
        if auto_path:
            print(f"  auto-patch → {auto_path.relative_to(ROOT)}")

        changed, refix_log = apply_g4_refix(spec, plan_path)
        if refix_log:
            print(f"G4 refix {spec.template_id}:")
            for line in refix_log:
                print(f"  {line}")
        if not changed:
            return blocker("auto-refix không tìm được thay đổi")

        patch_count += 1
        gate_attempt = 0
        needs_rebuild = True
        print(f"  PATCH {patch_count}/{MAX_PATCH_ROUNDS} → rebuild + G1–G4")

    return blocker("hết vòng G4")


def main() -> int:
    parser = argparse.ArgumentParser(description="Figma → Bricks autopilot (single-pass mặc định)")
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--page-id", type=int)
    parser.add_argument("--template-id", type=int, help="Single section only")
    parser.add_argument("--build-script", type=Path)
    parser.add_argument("--max-retries", type=int, default=2, help="Max G1–G3 attempts per build")
    parser.add_argument(
        "--max-g4-rounds",
        type=int,
        default=MAX_G4_ATTEMPTS,
        help=f"Max G4 attempts per section with --until-pass (≤ {MAX_G4_ATTEMPTS}, rule 39)",
    )
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--single-pass",
        action="store_true",
        help="(Mặc định) One G4 attempt per section — không PATCH",
    )
    mode_group.add_argument(
        "--until-pass",
        action="store_true",
        help=f"PATCH sau G4 fail, tối đa {MAX_PATCH_ROUNDS} vòng / section (rule 39)",
    )
    parser.add_argument("--g4-threshold", type=float, default=G4_THRESHOLD_PCT)
    parser.add_argument("--skip-g0", action="store_true")
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--skip-g4", action="store_true")
    parser.add_argument("--skip-figma-export", action="store_true")
    parser.add_argument("--write-diff", action="store_true", help="(Mặc định với --until-pass) Write diff PNG on G4 fail")
    parser.add_argument("--no-write-diff", action="store_true")
    fail_group = parser.add_mutually_exclusive_group()
    fail_group.add_argument(
        "--continue-on-fail",
        action="store_true",
        help="(Mặc định) Section fail → ghi blocker, chạy tiếp section kế",
    )
    fail_group.add_argument(
        "--stop-on-fail",
        action="store_true",
        help="Dừng ngay ở section fail đầu tiên (debug)",
    )
    parser.add_argument(
        "--blur-radius", type=float, default=G4_BLUR_RADIUS,
        help=f"Gaussian blur for G4 font AA (default {G4_BLUR_RADIUS:g}; khác chuẩn = chỉ chẩn đoán)",
    )
    parser.add_argument(
        "--font-tolerance", type=int, default=G4_PIXEL_TOLERANCE,
        help=f"Pixel tolerance for G4 font AA (default {G4_PIXEL_TOLERANCE}; khác chuẩn = chỉ chẩn đoán)",
    )
    parser.add_argument("--skip-health-check", action="store_true")
    args = parser.parse_args()

    if args.max_g4_rounds > MAX_G4_ATTEMPTS:
        print(
            f"WARN: --max-g4-rounds {args.max_g4_rounds} vượt rule 39 → giới hạn {MAX_G4_ATTEMPTS}",
            file=sys.stderr,
        )
        args.max_g4_rounds = MAX_G4_ATTEMPTS

    until_pass = args.until_pass
    # The flow must finish every template in one run; one failing section only gets reported.
    continue_on_fail = not args.stop_on_fail
    if not args.no_write_diff and until_pass:
        args.write_diff = True

    plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
    if not plan_path.is_file():
        print(f"Plan not found: {plan_path}", file=sys.stderr)
        return 1

    meta = parse_plan(plan_path)
    page_id = args.page_id or meta.page_id
    if meta.is_template_only:
        page_id = None
    elif not page_id:
        print("--page-id required (or Page ID in plan, or `- Mode: `template-only``)", file=sys.stderr)
        return 1

    skip_mobile = not plan_has_figma_mobile(meta)
    build_script = resolve_build_script(meta, str(args.build_script) if args.build_script else None)
    plan_rel = plan_path.relative_to(ROOT) if plan_path.is_relative_to(ROOT) else plan_path
    evidence_dir = ROOT / meta.evidence_dir if meta.evidence_dir else None

    sections = [s for s in meta.sections if s.template_id]
    if args.template_id:
        sections = [s for s in sections if s.template_id == args.template_id]
        if not sections:
            print(f"Template {args.template_id} not in plan", file=sys.stderr)
            return 1

    env = load_env()
    has_figma_token = bool(env.get("FIGMA_ACCESS_TOKEN", "").strip())

    mode = "REVIEW-REFIX" if until_pass else "SINGLE-PASS"
    mobile_note = "desktop only" if skip_mobile else "desktop + mobile"
    aa_note = ""
    if args.blur_radius > 0 or args.font_tolerance > 0:
        aa_note = f", AA(blur={args.blur_radius}, tol={args.font_tolerance})"
    scope_note = f"page {page_id}" if page_id else "template-only (no page)"
    print(
        f"Autopilot {mode} — {len(sections)} section(s), {scope_note}, "
        f"G4 ≥{args.g4_threshold}%{aa_note}, {mobile_note}\n"
    )

    # --- Health check: verify MCP connection before starting ---
    if not args.skip_health_check:
        if not health_check():
            return 1

    if not args.skip_g0:
        for label, cmd in (
            ("G0 validate plan", [sys.executable, "scripts/validate_plan_g0.py", str(plan_rel)]),
            ("G0.5 build independence", [sys.executable, "scripts/validate_build_script.py", "--plan", str(plan_rel)]),
        ):
            if run_cmd(cmd, label=label) != 0:
                return 1

    if not args.skip_g4 and not args.skip_figma_export and has_figma_token:
        run_cmd(
            [sys.executable, "scripts/export_figma_section_pngs.py", "--plan", str(plan_rel)],
            label="Export Figma PNGs (once)",
        )
    elif not args.skip_g4 and not args.skip_figma_export:
        print("\nWARN: FIGMA_ACCESS_TOKEN missing — skip Figma export")

    # Each section runs once: re-running a failed section would exceed its rule-39 PATCH budget.
    passed_ids: set[int] = set()
    failed_sections: list[SectionSpec] = []
    for spec in sections:
        print(f"\n{'#' * 60}")
        print(f"# [{spec.index:02d}/{len(sections)}] {spec.name} — template {spec.template_id}")
        print("#" * 60)

        ok = process_section(
            spec,
            build_script=build_script,
            plan_rel=plan_rel,
            plan_path=plan_path,
            page_id=page_id,
            skip_build=args.skip_build,
            skip_g4=args.skip_g4,
            skip_mobile=skip_mobile,
            g4_threshold=args.g4_threshold,
            write_diff=args.write_diff,
            max_gate_retries=args.max_retries,
            max_g4_rounds=args.max_g4_rounds,
            until_pass=until_pass,
            evidence_dir=evidence_dir,
            blur_radius=args.blur_radius,
            font_tolerance=args.font_tolerance,
        )

        if ok:
            passed_ids.add(spec.template_id)
            print(f"\n✓ [{spec.index:02d}] {spec.name} G4 auto pass — còn checklist plan")
        else:
            failed_sections.append(spec)
            print(f"\n✗ [{spec.index:02d}] {spec.name} FAILED")
            if not continue_on_fail:
                break

    if page_id:
        run_cmd(
            [
                sys.executable,
                "scripts/review_gates.py",
                "--plan",
                str(plan_rel),
                "--page-id",
                str(page_id),
                "--per-section",
            ]
            + (["--skip-mobile"] if skip_mobile else []),
            label="Full page screenshot + evidence (end)",
        )

    passed = len(passed_ids)
    failed = len(sections) - passed
    print(f"\n{'=' * 60}")
    print(f"AUTOPILOT done: {passed}/{len(sections)} sections G4 auto pass")
    print("=" * 60)
    for spec in failed_sections:
        print(f"  ✗ [{spec.index:02d}] {spec.name} — template {spec.template_id}: ghi fail vào plan, báo user cuối phiên")
    if passed:
        print(
            "Tiếp: điền ### G4 acceptance checklist trong plan rồi chạy\n"
            f"  python3 scripts/validate_g4_evidence.py --plan {plan_rel} --require-checklist"
        )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
