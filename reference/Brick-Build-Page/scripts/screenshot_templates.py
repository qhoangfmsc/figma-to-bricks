#!/usr/bin/env python3
"""
Review screenshot pipeline: WP login (curl) → fetch HTML → Chrome headless PNG.
Không dùng wp-cli.

Usage:
  python3 scripts/screenshot_templates.py --plan plans/page-cf-talk.md
  python3 scripts/screenshot_templates.py --url http://localhost:8000/template/page-cf-talk-hero/ --out screenshots/tpl_7965.png
  python3 scripts/screenshot_templates.py --page-id 7964
"""
from __future__ import annotations

import argparse
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Callable

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.bricks_mcp import get_template
from scripts.lib.env_loader import load_env
from scripts.lib.plan_parser import parse_page_id, parse_template_ids
from scripts.lib.wp_session import screenshot_live_url_viewports, wp_login


def slug_from_edit_url(edit_url: str) -> str:
    match = re.search(r"/template/([^/?]+)", edit_url)
    return match.group(1) if match else "template"


def png_name(prefix: str, suffix: str, slug: str | None = None) -> str:
    """Build filename stem: tpl_8036_mobile_hero or page_8035_mobile."""
    if slug:
        return f"{prefix}{suffix}_{slug}.png"
    return f"{prefix}{suffix}.png"


def parse_viewports(raw: str) -> list[tuple[int, int, str]]:
    viewports = []
    for item in raw.split(","):
        size, _, suffix = item.strip().partition(":")
        width, _, height = size.partition("x")
        viewports.append((int(width), int(height), suffix))
    return viewports


def default_height(width: int, height: int) -> int:
    return height if height != 2000 else (4200 if width <= 500 else 2000)


def main() -> int:
    parser = argparse.ArgumentParser(description="Screenshot Bricks templates for review")
    parser.add_argument("--plan", type=Path, help="Plan file — screenshot all template IDs listed")
    parser.add_argument("--ids", help="Comma-separated template IDs")
    parser.add_argument("--url", help="Single template front URL")
    parser.add_argument("--out", type=Path, help="Output PNG for single --url mode")
    parser.add_argument("--page-id", type=int, help="Screenshot full page by page_id")
    parser.add_argument("--width", type=int, default=1440)
    parser.add_argument("--height", type=int, default=2000)
    parser.add_argument(
        "--suffix",
        default="",
        help="Insert before slug in output name, e.g. _mobile → tpl_8036_mobile_hero.png",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        help="Write PNG/HTML here instead of screenshots/ (for --ids / --page-id batch)",
    )
    parser.add_argument(
        "--viewports",
        help="WxH[:suffix],... e.g. 1440x3000,390x4500:_mobile — one HTML fetch, parallel Chrome per viewport "
        "(overrides --width/--height/--suffix)",
    )
    args = parser.parse_args()
    viewports = parse_viewports(args.viewports) if args.viewports else [(args.width, args.height, args.suffix)]

    env = load_env()
    base = env.get("WP_URL", "http://localhost:8000").rstrip("/")
    wp_login(env=env)
    shots_dir = args.out_dir if args.out_dir else ROOT / "screenshots"
    if not shots_dir.is_absolute():
        shots_dir = ROOT / shots_dir
    shots_dir.mkdir(parents=True, exist_ok=True)

    # url -> output path for a given viewport suffix
    targets: list[tuple[str, Callable[[str], Path]]] = []

    plan_path: Path | None = None
    if args.plan:
        plan_path = args.plan if args.plan.is_absolute() else ROOT / args.plan

    def template_target(template_id: int) -> tuple[str, Callable[[str], Path]]:
        tpl = get_template(template_id)
        url = tpl.get("url") or f"{base}/?p={template_id}"
        slug = slug_from_edit_url(tpl.get("edit_url", ""))
        return url, lambda suffix: shots_dir / png_name(f"tpl_{template_id}", suffix, slug)

    def page_target(page_id: int) -> tuple[str, Callable[[str], Path]]:
        return f"{base}/?page_id={page_id}", lambda suffix: shots_dir / png_name(f"page_{page_id}", suffix)

    if args.url and args.out:
        out = args.out if args.out.is_absolute() else ROOT / args.out
        targets.append((args.url, lambda suffix: out.with_name(f"{out.stem}{suffix}{out.suffix}") if suffix else out))
    elif args.page_id:
        targets.append(page_target(args.page_id))
    elif args.ids:
        ids = [int(x.strip()) for x in args.ids.split(",") if x.strip()]
        targets.extend(template_target(template_id) for template_id in ids)
    elif plan_path:
        targets.extend(template_target(template_id) for template_id in parse_template_ids(plan_path))
        page_id = parse_page_id(plan_path)
        if page_id:
            targets.append(page_target(page_id))
    else:
        parser.error("Provide --plan, --ids, --url, or --page-id")

    HIDE_CHROME_CSS = """
        #wpadminbar, #brx-header, #brx-footer,
        header.brxe-section, footer.brxe-section,
        .site-header, .site-footer, nav.navbar,
        #brxe-vdpdnq, #brxe-drdsks, #brxe-ktayvs { display:none !important; }
        html { margin-top:0 !important; }
        body.admin-bar { padding-top:0 !important; }
    """

    def capture(target: tuple[str, Callable[[str], Path]]) -> list[Path]:
        url, path_for = target
        shots = [(path_for(suffix), width, default_height(width, height)) for width, height, suffix in viewports]
        return screenshot_live_url_viewports(url, shots, hide_chrome_css=HIDE_CHROME_CSS)

    with ThreadPoolExecutor(max_workers=min(4, len(targets))) as pool:
        for saved in pool.map(capture, targets):
            for png_path in saved:
                print(f"Saved {png_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
