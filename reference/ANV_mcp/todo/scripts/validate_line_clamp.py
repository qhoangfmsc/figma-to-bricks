#!/usr/bin/env python3
"""
validate_line_clamp.py — Kiểm tra tự động mọi phần tử dùng -webkit-line-clamp trên 1 trang WP đã đăng nhập.

Vấn đề đang vá: line-clamp bị box-sizing:border-box "ăn" padding vào height cố định
(text bị cắt cụt giữa dòng, không có "...") — phát hiện lần đầu do user tự chụp ảnh chỉ ra,
không phải do agent tự test. Script này thay bước "nhìn ảnh" bằng 1 phép tính khách quan:
với mỗi phần tử có -webkit-line-clamp:N, phần content-box height (đã trừ padding theo box-sizing
thực tế) phải là bội số NGUYÊN của line-height. Nếu lệch (vd 1.5 dòng thay vì 2) -> FAIL, kèm
vị trí + text bị ảnh hưởng để agent/dev sửa mà không cần chờ user report bằng mắt.

Usage:
    python3 scripts/validate_line_clamp.py --url "http://localhost:8000/?page_id=9119&preview=true"
"""
import argparse
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("LỖI: cần 'playwright' (đã có trong .venv của project).")
    sys.exit(1)

from lib.wp_login import browser_context_kwargs, wp_login, goto_settled


def load_env():
    import os
    env = {}
    here = os.path.dirname(os.path.abspath(__file__))
    for base in (here, os.getcwd()):
        p = base
        while True:
            cand = os.path.join(p, ".env")
            if os.path.isfile(cand):
                with open(cand, encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            env[k.strip()] = v.strip().strip('"').strip("'")
                return env
            parent = os.path.dirname(p)
            if parent == p:
                break
            p = parent
    return env


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--viewport-width", type=int, default=1440)
    ap.add_argument("--tolerance", type=float, default=0.5,
                     help="Sai số cho phép (px) khi so content-height với bội số line-height")
    args = ap.parse_args()

    env = load_env()
    wp_user = env.get("WP_USER")
    wp_pass = env.get("WP_PASS")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": args.viewport_width, "height": 900},
                                      **browser_context_kwargs())
        page = context.new_page()

        if wp_user and wp_pass:
            wp_login(page)

        goto_settled(page, args.url)
        page.wait_for_timeout(1200)

        results = page.evaluate("""() => {
            const out = [];
            document.querySelectorAll('*').forEach(el => {
                const cs = getComputedStyle(el);
                const clamp = cs.webkitLineClamp;
                if (!clamp || clamp === 'none') return;
                const n = parseInt(clamp, 10);
                if (!n) return;
                const lineHeight = parseFloat(cs.lineHeight);
                const paddingTop = parseFloat(cs.paddingTop) || 0;
                const paddingBottom = parseFloat(cs.paddingBottom) || 0;
                const borderBox = cs.boxSizing === 'border-box';
                const totalHeight = el.getBoundingClientRect().height;
                // getBoundingClientRect luôn trả về total box (content+padding+border)
                // bất kể box-sizing — nên luôn phải trừ padding để ra content height thật.
                const contentHeight = totalHeight - paddingTop - paddingBottom;
                out.push({
                    id: el.id || null,
                    text: (el.textContent || '').slice(0, 60),
                    clampLines: n,
                    lineHeight, paddingTop, paddingBottom, borderBox,
                    totalHeight, contentHeight,
                    expected: n * lineHeight
                });
            });
            return out;
        }""")
        browser.close()

    fails = []
    for r in results:
        diff = abs(r["contentHeight"] - r["expected"])
        r["diff"] = diff
        if diff > args.tolerance:
            fails.append(r)

    print(f"Tổng số phần tử line-clamp: {len(results)}")
    print(f"PASS: {len(results) - len(fails)} | FAIL: {len(fails)}\n")

    if fails:
        print("=== FAIL — content-height không khớp bội số nguyên của line-height (chữ có thể bị cắt cụt giữa dòng) ===")
        for r in fails:
            print(f"- #{r['id']}: clamp={r['clampLines']} dòng, "
                  f"content-height={r['contentHeight']:.1f}px (kỳ vọng {r['expected']:.1f}px, lệch {r['diff']:.1f}px) "
                  f"| box-sizing={'border-box' if r['borderBox'] else 'content-box'} padding-top={r['paddingTop']}px "
                  f"| text: \"{r['text']}...\"")
        sys.exit(1)
    else:
        print("Tất cả phần tử line-clamp đều đúng số dòng khai báo — không có dấu hiệu cắt cụt giữa dòng.")
        sys.exit(0)


if __name__ == "__main__":
    main()
