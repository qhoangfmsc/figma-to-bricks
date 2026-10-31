#!/usr/bin/env python3
"""
Export Figma section PNGs for G4 auto compare (Figma REST Images API).

Exports at viewport-matched scale so PNG width ≈ Bricks screenshot width
(1440 desktop / 390 mobile), not a fixed @2x scale.

Requires FIGMA_ACCESS_TOKEN in .env (Personal access token with file read).

Usage:
  python3 scripts/export_figma_section_pngs.py --plan plans/page-ldp-template-v2.md
  python3 scripts/export_figma_section_pngs.py --plan plans/page-ldp-template-v2.md --scale 2
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from PIL import Image

from scripts.lib.env_loader import load_env
from scripts.lib.figma_api import bbox_size, fetch_nodes, solid_background_rgb
from scripts.lib.plan_parser import parse_plan, plan_has_figma_mobile
from scripts.lib.review_viewport import DESKTOP_WIDTH, MOBILE_FALLBACK_WIDTH, is_device_width

FIGMA_API = "https://api.figma.com/v1"
DESKTOP_VIEWPORT = DESKTOP_WIDTH
MOBILE_VIEWPORT = MOBILE_FALLBACK_WIDTH


def _figma_get(path: str, token: str) -> dict:
    req = urllib.request.Request(
        f"{FIGMA_API}{path}",
        headers={"X-Figma-Token": token},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def _download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as resp:
        dest.write_bytes(resp.read())


def _flatten(dest: Path, background: tuple[int, int, int] | None) -> bool:
    """Figma renders a frame without its own fill as transparent, and the G4 compare would
    then composite the whole section onto white. Bake the section background in instead."""
    if background is None:
        return False
    with Image.open(dest) as img:
        if img.mode not in ("RGBA", "LA", "PA"):
            return False
        rgba = img.convert("RGBA")
        if rgba.getchannel("A").getextrema()[0] == 255:
            return False
        flat = Image.alpha_composite(Image.new("RGBA", rgba.size, (*background, 255)), rgba)
    flat.convert("RGB").save(dest)
    return True


def _viewport_scale(
    node_width: float,
    target_viewport: int,
    *,
    fallback: float,
    max_scale: float = 4.0,
    min_scale: float = 0.25,
) -> float:
    if node_width <= 0:
        return fallback
    scale = target_viewport / node_width
    return round(max(min_scale, min(scale, max_scale)), 4)


def _export_nodes(
    file_key: str,
    nodes: dict[str, str],
    out_dir: Path,
    token: str,
    *,
    scales: dict[str, float],
    default_scale: float,
    backgrounds: dict[str, tuple[int, int, int]],
) -> list[str]:
    """nodes: figma_node -> output filename stem"""
    if not nodes:
        return []

    by_scale: dict[float, list[str]] = {}
    for node_id in nodes:
        scale = scales.get(node_id, default_scale)
        by_scale.setdefault(scale, []).append(node_id)

    errors: list[str] = []
    for scale, node_ids in sorted(by_scale.items()):
        ids = ",".join(urllib.parse.quote(n, safe="") for n in node_ids)
        data = _figma_get(
            f"/images/{file_key}?ids={ids}&format=png&scale={scale}",
            token,
        )
        if data.get("err"):
            raise RuntimeError(data["err"])

        images: dict[str, str | None] = data.get("images") or {}
        for node_id in node_ids:
            stem = nodes[node_id]
            url = images.get(node_id)
            if not url:
                errors.append(f"No image URL for node {node_id}")
                continue
            slug = node_id.replace(":", "-")
            dest = out_dir / f"{stem}_{slug}.png"
            _download(url, dest)
            flattened = _flatten(dest, backgrounds.get(node_id))
            background = f" bg={'#%02x%02x%02x' % backgrounds[node_id]}" if flattened else ""
            print(f"  ✓ {dest.name} (scale={scale}){background}")
            time.sleep(0.2)
    return errors


def section_backgrounds(sections, documents: dict[str, dict]) -> dict[str, tuple[int, int, int]]:
    """node_id → background to bake in. A mobile frame usually carries no fill of its own
    (the dark page frame behind it does), so it inherits the desktop section's background."""
    out: dict[str, tuple[int, int, int]] = {}
    for spec in sections:
        desktop = solid_background_rgb(documents.get(spec.figma_desktop) or {}) if spec.figma_desktop else None
        for node_id in (spec.figma_desktop, spec.figma_mobile):
            if not node_id:
                continue
            color = solid_background_rgb(documents.get(node_id) or {}) or desktop
            if color:
                out[node_id] = color
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Export Figma section PNGs for G4")
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--out-dir", type=Path, help="Default: notes/<page>/assets/figma")
    parser.add_argument(
        "--scale",
        type=float,
        default=None,
        help="Fixed export scale for all nodes (overrides viewport-matched scale)",
    )
    args = parser.parse_args()

    env = load_env()
    token = env.get("FIGMA_ACCESS_TOKEN", "").strip()
    if not token:
        print(
            "FIGMA_ACCESS_TOKEN missing in .env — add Personal Access Token from Figma settings.",
            file=sys.stderr,
        )
        return 1

    plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan
    meta = parse_plan(plan_path)
    if not meta.figma_file_key:
        print("Cannot parse Figma file key from plan URL", file=sys.stderr)
        return 1

    if args.out_dir:
        out_dir = args.out_dir
    elif meta.evidence_dir:
        out_dir = ROOT / meta.evidence_dir
        out_dir = out_dir.parent / "figma"
    else:
        print("Specify --out-dir or G4 evidence dir in plan", file=sys.stderr)
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
    fixed_scale = args.scale if args.scale is not None else 1.0
    use_viewport_scale = args.scale is None

    print(f"Export Figma PNGs → {out_dir} (file {meta.figma_file_key})")
    if use_viewport_scale:
        print(f"  viewport scale: desktop {DESKTOP_VIEWPORT}px · mobile 1:1 (frame width, else {MOBILE_VIEWPORT}px)\n")
    else:
        print(f"  fixed scale: {fixed_scale}\n")

    desktop_nodes: dict[str, str] = {}
    mobile_nodes: dict[str, str] = {}
    export_mobile = plan_has_figma_mobile(meta)

    for spec in meta.sections:
        if not spec.template_id:
            continue
        stem = f"tpl_{spec.template_id}"
        if spec.figma_desktop:
            desktop_nodes[spec.figma_desktop] = stem
        if export_mobile and spec.figma_mobile and spec.figma_mobile != spec.figma_desktop:
            mobile_nodes[spec.figma_mobile] = f"{stem}_mobile"

    all_node_ids = list({*desktop_nodes, *mobile_nodes})
    documents = fetch_nodes(meta.figma_file_key, all_node_ids, token)
    bboxes = {node_id: bbox_size(node) for node_id, node in documents.items()} if use_viewport_scale else {}
    backgrounds = section_backgrounds(meta.sections, documents)

    desktop_scales: dict[str, float] = {}
    mobile_scales: dict[str, float] = {}
    if use_viewport_scale:
        for node_id in desktop_nodes:
            width, _ = bboxes.get(node_id, (0.0, 0.0))
            desktop_scales[node_id] = _viewport_scale(width, DESKTOP_VIEWPORT, fallback=fixed_scale)
        for node_id in mobile_nodes:
            width, _ = bboxes.get(node_id, (0.0, 0.0))
            mobile_scales[node_id] = (
                1.0 if is_device_width(width) else _viewport_scale(width, MOBILE_VIEWPORT, fallback=fixed_scale)
            )

    errors: list[str] = []
    if desktop_nodes:
        print("Desktop nodes:")
        errors.extend(
            _export_nodes(
                meta.figma_file_key,
                desktop_nodes,
                out_dir,
                token,
                scales=desktop_scales,
                default_scale=fixed_scale,
                backgrounds=backgrounds,
            )
        )
    if mobile_nodes:
        print("\nMobile nodes:")
        errors.extend(
            _export_nodes(
                meta.figma_file_key,
                mobile_nodes,
                out_dir,
                token,
                scales=mobile_scales,
                default_scale=fixed_scale,
                backgrounds=backgrounds,
            )
        )

    if errors:
        for msg in errors:
            print(f"WARN {msg}", file=sys.stderr)
        return 1

    print(f"\nExported {len(desktop_nodes) + len(mobile_nodes)} PNG(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
