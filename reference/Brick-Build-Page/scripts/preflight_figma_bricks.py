#!/usr/bin/env python3
"""
One-shot preflight for Figma → Bricks: every connection the flow needs, checked in parallel.

  - Figma REST (FIGMA_ACCESS_TOKEN)           → used by analyze_figma_section.py
  - Bricks MCP bridge (.env BRICKS_MCP_*)     → get_site_info + list_templates
  - Template name collision (rule 36)         → prints the next free name

Asset URLs come from the remote Figma MCP (`get_design_context`), so Figma Desktop is
not required (rule 2).

Usage:
  python3 scripts/preflight_figma_bricks.py
  python3 scripts/preflight_figma_bricks.py --template-name "Hero CF Talk"

Needs unrestricted network (api.figma.com). Exit code 1 when a blocking check fails.
"""
from __future__ import annotations

import argparse
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.bricks_mcp import get_site_info, list_templates
from scripts.lib.env_loader import load_env
from scripts.lib.figma_api import figma_get

TRAILING_NUMBER_RE = re.compile(r"^(.*?)(\d+)$")


def next_free_name(name: str, existing: set[str]) -> str:
    """Rule 36: bump a trailing number, or append ` 2`, until the name is unused."""
    candidate = name
    while candidate in existing:
        match = TRAILING_NUMBER_RE.match(candidate)
        candidate = f"{match.group(1)}{int(match.group(2)) + 1}" if match else f"{candidate} 2"
    return candidate


def check_figma_rest() -> tuple[bool, str]:
    token = load_env().get("FIGMA_ACCESS_TOKEN", "").strip()
    if not token:
        return False, "FIGMA_ACCESS_TOKEN missing in .env"
    me = figma_get("/me", token)
    return True, f"user {me.get('handle') or me.get('email')}"


def check_bricks() -> tuple[bool, str]:
    site = get_site_info()
    return True, f"{site.get('site_url')} · Bricks {site.get('bricks_version')} · CSS {site.get('css_loading')}"


def check_template_name(name: str) -> tuple[bool, str]:
    titles = {template.get("title", "") for template in list_templates().get("templates", [])}
    free = next_free_name(name, titles)
    if free == name:
        return True, f'"{name}" chưa tồn tại'
    return True, f'"{name}" đã tồn tại → dùng "{free}" (rule 36)'


def run(check) -> tuple[bool, str]:
    try:
        return check()
    except Exception as error:  # noqa: BLE001 — every failure is reported, none aborts the others
        return False, f"{type(error).__name__}: {error}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Preflight Figma REST, Bricks MCP")
    parser.add_argument("--template-name", default="", help="Check rule-36 collision for this template name")
    args = parser.parse_args()

    checks = {
        "Figma REST": (check_figma_rest, True),
        "Bricks MCP": (check_bricks, True),
    }
    if args.template_name.strip():
        checks["Template name"] = (lambda: check_template_name(args.template_name.strip()), True)

    with ThreadPoolExecutor(max_workers=len(checks)) as pool:
        futures = {label: pool.submit(run, check) for label, (check, _) in checks.items()}
    blocked = False
    for label, future in futures.items():
        ok, detail = future.result()
        blocking = checks[label][1]
        mark = "✓" if ok else ("✗" if blocking else "!")
        print(f"{mark} {label}: {detail}")
        blocked = blocked or (not ok and blocking)
    return 1 if blocked else 0


if __name__ == "__main__":
    raise SystemExit(main())
