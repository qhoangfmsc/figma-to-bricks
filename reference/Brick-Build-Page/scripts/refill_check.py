#!/usr/bin/env python3
"""
Quick refill — scan all templates on a page, collect image URLs,
verify each one, and report broken vs working URLs.

Usage:
  python3 scripts/refill_check.py --page-id 8162
"""
from __future__ import annotations

import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.bricks_mcp import get_page, get_template


def find_image_urls(elements: list[dict]) -> list[tuple[str, str, str]]:
    """Return list of (element_id, label, url) for all image elements."""
    results = []
    for el in elements:
        eid = el.get("id", "")
        label = el.get("label", el.get("name", ""))
        settings = el.get("settings") or {}
        
        # image element
        img = settings.get("image") or {}
        url = img.get("url", "")
        if url:
            results.append((eid, label, url))
        
        # background image
        bg = settings.get("_background") or {}
        bg_img = bg.get("image") or {}
        bg_url = bg_img.get("url", "")
        if bg_url:
            results.append((eid, f"{label} (bg)", bg_url))
    
    return results


def check_url(url: str, timeout: int = 5) -> tuple[bool, str]:
    """Check if URL is accessible via GET (Figma server doesn't support HEAD)."""
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return True, f"{resp.status}"
    except urllib.error.HTTPError as e:
        return False, f"HTTP {e.code}"
    except urllib.error.URLError as e:
        return False, f"URL error: {e.reason}"
    except Exception as e:
        return False, str(e)


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--page-id", type=int, required=True)
    args = parser.parse_args()

    page = get_page(args.page_id)
    print(f"Page: {page.get('title', '?')} (ID {args.page_id})")
    
    template_ids = []
    for el in page.get("elements", []):
        tpl_id = (el.get("settings") or {}).get("template")
        if tpl_id:
            template_ids.append((tpl_id, el.get("label", "?")))
    
    print(f"Templates: {len(template_ids)}\n")
    
    all_images: list[tuple[int, str, str, str, str]] = []  # tpl_id, tpl_name, eid, label, url
    
    for tpl_id, tpl_name in template_ids:
        try:
            tpl = get_template(tpl_id)
            images = find_image_urls(tpl.get("elements", []))
            for eid, label, url in images:
                all_images.append((tpl_id, tpl_name, eid, label, url))
        except Exception as e:
            print(f"  ✗ Template {tpl_id}: {e}")
    
    print(f"Total images: {len(all_images)}")
    print(f"\nChecking URLs...\n")
    
    ok_count = 0
    broken: list[tuple[int, str, str, str, str]] = []
    
    for tpl_id, tpl_name, eid, label, url in all_images:
        is_ok, reason = check_url(url)
        status = "✓" if is_ok else "✗"
        short_url = url.split("/")[-1][:40]
        
        if is_ok:
            ok_count += 1
        else:
            broken.append((tpl_id, tpl_name, eid, label, url))
            print(f"  {status} [{tpl_id}] {label}: {short_url} — {reason}")
    
    print(f"\n{'=' * 60}")
    print(f"OK: {ok_count}/{len(all_images)}")
    print(f"Broken: {len(broken)}/{len(all_images)}")
    
    if broken:
        print(f"\nBroken images by template:")
        by_tpl: dict[int, list] = {}
        for tpl_id, tpl_name, eid, label, url in broken:
            by_tpl.setdefault(tpl_id, []).append((eid, label, url))
        for tpl_id, items in sorted(by_tpl.items()):
            print(f"  Template {tpl_id}:")
            for eid, label, url in items:
                print(f"    [{eid}] {label}")
    
    return 1 if broken else 0


if __name__ == "__main__":
    raise SystemExit(main())
