#!/usr/bin/env python3
"""
validate_mobile_overflow.py
Gate bổ trợ F2 (rubric.md) / phòng lỗi §21 (bricks_rules.md) — đo thật document.scrollWidth
qua Playwright thay vì "mở DevTools nhìn mắt". Dùng cho cả trang thật (page_id) lẫn
1 section template riêng (qua URL preview).

Usage:
  python3 validate_mobile_overflow.py --page-id 9136
  python3 validate_mobile_overflow.py --url "http://localhost:8000/?page_id=9136" --viewport 390
  python3 validate_mobile_overflow.py --page-id 9136 --viewport 390 --viewport 768 --tolerance 40
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

try:
    from playwright.sync_api import sync_playwright
    PLAYWRIGHT_OK = True
except ImportError:
    PLAYWRIGHT_OK = False

from scripts.lib.bricks_mcp import _get_config
from scripts.lib.wp_login import browser_context_kwargs, wp_login, goto_settled


def check_overflow(url: str, viewport: int, user: str, password: str, tolerance: int):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": viewport, "height": 900}, **browser_context_kwargs())
        page = ctx.new_page()
        if user and password:
            wp_login(page)
        goto_settled(page, url)
        page.wait_for_timeout(1200)

        scroll_width = page.evaluate("document.documentElement.scrollWidth")
        offenders = page.evaluate(
            """(vw) => {
                const els = document.querySelectorAll('body *');
                const out = [];
                els.forEach(el => {
                    const r = el.getBoundingClientRect();
                    if (r.right > vw + 5 && r.width < 5000) {
                        out.push({
                            tag: el.tagName,
                            id: el.id || '',
                            cls: (typeof el.className === 'string') ? el.className.slice(0, 60) : '',
                            width: Math.round(r.width),
                            right: Math.round(r.right),
                        });
                    }
                });
                out.sort((a, b) => b.right - a.right);
                return out.slice(0, 15);
            }""",
            viewport,
        )
        browser.close()
        return scroll_width, offenders


def main():
    if not PLAYWRIGHT_OK:
        print("❌ Playwright chưa cài. Chạy: pip3 install playwright && playwright install chromium")
        sys.exit(1)

    ap = argparse.ArgumentParser(description="Đo document.scrollWidth thật (không nhìn mắt) để bắt lỗi tràn ngang mobile.")
    ap.add_argument("--page-id", type=int, help="WordPress page ID (dùng ?page_id=)")
    ap.add_argument("--url", help="URL đầy đủ (thay cho --page-id)")
    ap.add_argument("--viewport", type=int, action="append", default=None,
                     help="Viewport width cần check (có thể lặp lại). Mặc định: 390")
    ap.add_argument("--tolerance", type=int, default=20,
                     help="Sai số cho phép (px) trước khi coi là FAIL — mặc định 20px "
                          "(chừa cho scrollbar/site header ngoài phạm vi build)")
    args = ap.parse_args()

    if not args.page_id and not args.url:
        ap.error("Cần --page-id hoặc --url")

    wp_url = _get_config("WP_URL", "http://localhost:8000").rstrip("/")
    url = args.url or f"{wp_url}/?page_id={args.page_id}"
    user, password = _get_config("WP_USER"), _get_config("WP_PASS")
    viewports = args.viewport or [390]

    print(f"\n{'='*60}\n  Gate — Mobile Overflow Check (scrollWidth thật)\n  URL: {url}\n{'='*60}")

    fail = False
    for vw in viewports:
        scroll_width, offenders = check_overflow(url, vw, user, password, args.tolerance)
        delta = scroll_width - vw
        status = "✅ PASS" if delta <= args.tolerance else "❌ FAIL"
        if delta > args.tolerance:
            fail = True
        print(f"\n  [{vw}px] scrollWidth={scroll_width}px (delta={delta}px, tolerance={args.tolerance}px) → {status}")
        if delta > args.tolerance and offenders:
            print("  Phần tử tràn (rộng nhất trước):")
            for o in offenders[:8]:
                sel = f"#{o['id']}" if o["id"] else f".{o['cls'].split()[0]}" if o["cls"] else o["tag"]
                print(f"    - {sel}  width={o['width']}px  right={o['right']}px")

    print(f"\n{'='*60}")
    if fail:
        print("  ❌ FAIL — có viewport tràn ngang vượt tolerance. Xem bricks_rules.md §21.")
        sys.exit(1)
    print("  ✅ PASS — không tràn ngang ở mọi viewport đã check.")
    print(f"{'='*60}\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
