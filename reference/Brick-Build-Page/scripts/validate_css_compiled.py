#!/usr/bin/env python3
"""
G2 — Compare template _cssCustom vs compiled CSS (external file or page HTML).

Usage:
  python3 scripts/validate_css_compiled.py --template-id 8038
  python3 scripts/validate_css_compiled.py --template-id 8038 --page-id 8035
  python3 scripts/validate_css_compiled.py --template-id 8038 --rule overflow-x:auto --rule "flex:0 0 286px"
"""
from __future__ import annotations

import argparse
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.bricks_mcp import generate_css_file, get_site_info, get_template
from scripts.lib.env_loader import load_env
from scripts.lib.template_validate import validate_compiled_css
from scripts.lib.wp_session import fetch_authenticated_html


def fetch_external_css(base_url: str, template_id: int) -> str:
    url = f"{base_url.rstrip('/')}/wp-content/uploads/bricks/css/post-{template_id}.min.css"
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        raise RuntimeError(f"Cannot fetch {url}: {exc}") from exc


def extract_inline_css(html: str) -> str:
    blocks = re.findall(r"<style[^>]*>(.*?)</style>", html, flags=re.DOTALL | re.IGNORECASE)
    return "\n".join(blocks)


def load_compiled_css(template_id: int, page_id: int | None, env: dict) -> str:
    base = env.get("WP_URL", "http://localhost:8000").rstrip("/")
    info = get_site_info()
    mode = info.get("css_loading", "inline")

    if mode == "file":
        try:
            return fetch_external_css(base, template_id)
        except RuntimeError:
            generate_css_file(template_id=template_id)
            return fetch_external_css(base, template_id)

    html_path = ROOT / "screenshots" / f"_g2_tpl_{template_id}.html"
    html_path.parent.mkdir(exist_ok=True)
    tpl = get_template(template_id)
    tpl_url = tpl.get("url") or f"{base}/?p={template_id}"
    fetch_authenticated_html(tpl_url, html_path, env=env)
    css = extract_inline_css(html_path.read_text(encoding="utf-8"))

    if page_id and not css.strip():
        page_path = ROOT / "screenshots" / f"_g2_page_{page_id}.html"
        fetch_authenticated_html(f"{base}/?page_id={page_id}", page_path, env=env)
        css = extract_inline_css(page_path.read_text(encoding="utf-8"))

    return css


def main() -> int:
    parser = argparse.ArgumentParser(description="G2: validate compiled CSS vs template JSON")
    parser.add_argument("--template-id", type=int, required=True)
    parser.add_argument("--page-id", type=int, help="Fallback inline CSS from full page")
    parser.add_argument("--rule", action="append", default=[], help="Extra critical rule from plan spec")
    args = parser.parse_args()

    env = load_env()
    elements = get_template(args.template_id).get("elements", [])
    compiled = load_compiled_css(args.template_id, args.page_id, env)
    result = validate_compiled_css(elements, compiled, extra_rules=args.rule)

    for issue in result.issues:
        mark = "ERROR" if issue.level == "error" else "WARN"
        print(f"{mark} [{issue.element_id}] {issue.message}")

    status = "PASS" if result.passed else "FAIL"
    print(f"\nG2 {status}: {len(compiled)} bytes compiled, {len(result.issues)} issue(s)")
    return 0 if result.passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
