#!/usr/bin/env python3
"""
Refill broken image URLs on all templates of a page.

Approach:
  1. Collect all working image URLs from Figma MCP context outputs
  2. For each template: find images with 404 URLs, try to match by
     element label/position to new Figma URLs
  3. Update templates via set_template_content

Usage:
  python3 scripts/refill_images.py --page-id 8162 --dry-run
  python3 scripts/refill_images.py --page-id 8162
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.bricks_mcp import get_page, get_template, set_template_content


def url_ok(url: str) -> bool:
    """Check if URL is reachable via GET (Figma server doesn't support HEAD)."""
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


def collect_figma_urls(context_dirs: list[Path]) -> set[str]:
    """Collect unique working asset URLs from Figma context output files."""
    urls: set[str] = set()
    pattern = re.compile(r'http://localhost:3845/assets/[a-f0-9]+\.\w+')
    for d in context_dirs:
        for f in d.rglob("output.txt"):
            text = f.read_text(errors="ignore")
            urls.update(pattern.findall(text))
    return urls


def find_image_elements(elements: list[dict]) -> list[dict]:
    """Find all elements with image URLs."""
    results = []
    for el in elements:
        settings = el.get("settings") or {}
        img = settings.get("image") or {}
        url = img.get("url", "")
        if url and "localhost:3845" in url:
            results.append(el)
        # Also check background images
        bg = settings.get("_background") or {}
        bg_img = bg.get("image") or {}
        bg_url = bg_img.get("url", "")
        if bg_url and "localhost:3845" in bg_url:
            results.append(el)
    return results


def extract_hash(url: str) -> str:
    """Extract hash from localhost:3845 URL."""
    match = re.search(r'/assets/([a-f0-9]+)\.', url)
    return match.group(1) if match else ""


def refill_template(
    template_id: int,
    working_urls: set[str],
    *,
    dry_run: bool = True,
) -> tuple[int, int]:
    """Refill broken image URLs in a template.
    
    Returns (fixed_count, broken_count).
    """
    tpl = get_template(template_id)
    elements = tpl.get("elements", [])
    title = tpl.get("title", f"Template {template_id}")
    
    fixed = 0
    still_broken = 0
    changed = False
    
    # Build lookup: hash -> working URL
    working_by_hash = {}
    for url in working_urls:
        h = extract_hash(url)
        if h:
            working_by_hash[h] = url
    
    for el in elements:
        eid = el.get("id", "")
        settings = el.get("settings") or {}
        label = el.get("label", el.get("name", ""))
        
        # Check image URL
        img = settings.get("image") or {}
        url = img.get("url", "")
        if url and "localhost:3845" in url:
            if not url_ok(url):
                h = extract_hash(url)
                if h in working_by_hash:
                    new_url = working_by_hash[h]
                    if dry_run:
                        print(f"  [DRY] {eid} ({label}): would fix → same hash")
                    else:
                        settings["image"]["url"] = new_url
                        changed = True
                    fixed += 1
                else:
                    # Try to find same extension
                    ext = url.rsplit(".", 1)[-1]
                    print(f"  ✗ {eid} ({label}): no match for {h[:12]}...{ext}")
                    still_broken += 1
        
        # Check background image
        bg = settings.get("_background") or {}
        bg_img = bg.get("image") or {}
        bg_url = bg_img.get("url", "")
        if bg_url and "localhost:3845" in bg_url:
            if not url_ok(bg_url):
                h = extract_hash(bg_url)
                if h in working_by_hash:
                    new_url = working_by_hash[h]
                    if dry_run:
                        print(f"  [DRY] {eid} ({label}) bg: would fix → same hash")
                    else:
                        bg_img["url"] = new_url
                        changed = True
                    fixed += 1
                else:
                    ext = bg_url.rsplit(".", 1)[-1]
                    print(f"  ✗ {eid} ({label}) bg: no match for {h[:12]}...{ext}")
                    still_broken += 1
    
    if changed and not dry_run:
        result = set_template_content(template_id, elements, sync_css=True)
        saved = result.get("saved_elements", len(elements))
        print(f"  ✓ Uploaded {saved} elements")
    
    return fixed, still_broken


def main() -> int:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--page-id", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true", help="Show what would change without uploading")
    args = parser.parse_args()
    
    # Collect working URLs from Figma context outputs
    brain_dir = Path.home() / ".gemini" / "antigravity-ide" / "brain"
    context_dirs = list(brain_dir.rglob("steps"))
    
    print("Collecting working Figma URLs from context cache...")
    working_urls = collect_figma_urls(context_dirs)
    # Filter to only actually working ones
    print(f"  Found {len(working_urls)} unique URLs, verifying...")
    verified: set[str] = set()
    for url in working_urls:
        if url_ok(url):
            verified.add(url)
    print(f"  Verified: {len(verified)} working URLs\n")
    
    page = get_page(args.page_id)
    print(f"Page: {page.get('title', '?')} (ID {args.page_id})")
    
    template_ids = []
    for el in page.get("elements", []):
        tpl_id = (el.get("settings") or {}).get("template")
        if tpl_id:
            template_ids.append((tpl_id, el.get("label", "?")))
    
    total_fixed = 0
    total_broken = 0
    
    for tpl_id, tpl_name in template_ids:
        print(f"\n--- Template {tpl_id}: {tpl_name} ---")
        fixed, broken = refill_template(tpl_id, verified, dry_run=args.dry_run)
        total_fixed += fixed
        total_broken += broken
        if fixed == 0 and broken == 0:
            print("  ✓ All images OK")
    
    print(f"\n{'=' * 60}")
    mode = "DRY RUN" if args.dry_run else "APPLIED"
    print(f"{mode}: Fixed {total_fixed}, Still broken {total_broken}")
    if args.dry_run and total_fixed > 0:
        print(f"\nRun without --dry-run to apply changes.")
    
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
