#!/usr/bin/env python3
"""
capture_zoom_evidence.py — Chụp crop-screenshot TỪNG element cụ thể làm bằng chứng
zoom-compare (checklist Z1-Z5 trong review-skill/rubric.md).

Vấn đề đang vá: checklist zoom trước đây là bước agent TỰ KHAI đã làm bằng mắt,
không có file bằng chứng bắt buộc — agent có thể bỏ qua mà không ai biết (giống
lỗi false-PASS gây ra sự cố "Chỉ từ" wrap ngày 2026-07-14, chỉ khác ở chỗ full-page
đổi thành zoom). Script này bắt buộc phải tồn tại file crop PNG thật trên đĩa cho
từng element được liệt kê, giống cách G3 bắt buộc file full-page PNG tồn tại.

Dùng đúng quy ước `#brxe-{id}` đã xác lập cho toàn dự án (xem bricks_rules.md §13) —
không cần đoán toạ độ crop thủ công, Playwright tự lấy bounding box thật của element
đã render (tự động đúng dù layout responsive thay đổi).

Usage (từ thư mục todo/):
  python3 scripts/capture_zoom_evidence.py \\
      --url "http://localhost:8000/?page_id=9116" \\
      --viewport desktop \\
      --out-dir scratch/g3/zoom \\
      --element a0001e:cta-featured \\
      --element a00030:price-row \\
      --element a00010:card-border

  # Mobile:
  python3 scripts/capture_zoom_evidence.py \\
      --url "http://localhost:8000/?page_id=9116" \\
      --viewport mobile \\
      --out-dir scratch/g3/zoom \\
      --element a00050:mobile-scroll-row
"""

import argparse
import json
import os
import sys

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("LỖI: Thư viện 'playwright' chưa được cài đặt.")
    sys.exit(1)

from lib.wp_login import browser_context_kwargs, wp_login, goto_settled


def _find_env_file():
    candidates = []
    here = os.path.dirname(os.path.abspath(__file__))
    for base in (here, os.getcwd()):
        path = base
        while True:
            candidates.append(os.path.join(path, ".env"))
            parent = os.path.dirname(path)
            if parent == path:
                break
            path = parent
    for candidate in candidates:
        if os.path.isfile(candidate):
            return candidate
    return None


def load_env():
    env_vars = {}
    env_path = _find_env_file()
    if env_path:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip().strip('"').strip("'")
    return env_vars


def parse_element_arg(raw: str):
    if ":" not in raw:
        print(f"LỖI: --element phải theo dạng <brxe_id>:<label>, nhận được: {raw}")
        sys.exit(1)
    brxe_id, label = raw.split(":", 1)
    return brxe_id.strip(), label.strip()


def capture_zoom_evidence(url, out_dir, viewport_type, elements):
    print("=== BẮT ĐẦU CHỤP ZOOM EVIDENCE (per-element) ===")
    env = load_env()
    wp_user = env.get("WP_USER")
    wp_pass = env.get("WP_PASS")

    if viewport_type == "desktop":
        width, height = 1440, 900
    elif viewport_type == "mobile":
        width, height = 390, 844
    else:
        print(f"LỖI: Viewport '{viewport_type}' không hợp lệ.")
        sys.exit(1)

    os.makedirs(out_dir, exist_ok=True)
    manifest = {"viewport": viewport_type, "url": url, "results": []}
    had_failure = False

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": width, "height": height},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            ),
            **browser_context_kwargs(),
        )
        page = context.new_page()

        if wp_user and wp_pass:
            wp_login(page)

        print(f"Đang tải trang mục tiêu: {url}")
        goto_settled(page, url)
        page.wait_for_timeout(1500)

        for brxe_id, label in elements:
            selector = f"#brxe-{brxe_id}"
            out_path = os.path.join(out_dir, f"{label}-{viewport_type}.png")
            entry = {"brxe_id": brxe_id, "label": label, "selector": selector, "path": out_path}
            try:
                locator = page.locator(selector).first
                locator.wait_for(state="visible", timeout=8000)
                locator.scroll_into_view_if_needed()
                locator.screenshot(path=out_path)
                entry["status"] = "ok"
                print(f"  ✅ {label} ({selector}) → {out_path}")
            except Exception as exc:  # element not found / not visible / timeout
                entry["status"] = "fail"
                entry["error"] = str(exc)
                had_failure = True
                print(f"  ❌ {label} ({selector}): {exc}")
            manifest["results"].append(entry)

        browser.close()

    manifest_path = os.path.join(out_dir, f"manifest-{viewport_type}.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"Manifest: {manifest_path}")

    if had_failure:
        print("\n❌ Một hoặc nhiều element không chụp được — KHÔNG được coi zoom-evidence là đủ.")
        sys.exit(1)
    print(f"\n✅ Đã chụp {len(elements)}/{len(elements)} element zoom evidence.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Chụp crop-screenshot từng element (#brxe-{id}) làm bằng chứng zoom-compare G4."
    )
    parser.add_argument("--url", required=True)
    parser.add_argument("--viewport", required=True, choices=["desktop", "mobile"])
    parser.add_argument("--out-dir", required=True, help="Thư mục lưu (vd. scratch/g3/zoom)")
    parser.add_argument(
        "--element",
        action="append",
        required=True,
        dest="elements",
        metavar="BRXE_ID:LABEL",
        help="Lặp lại cho mỗi element cần zoom, vd. --element a0001e:cta-featured",
    )
    args = parser.parse_args()

    parsed_elements = [parse_element_arg(e) for e in args.elements]
    capture_zoom_evidence(args.url, args.out_dir, args.viewport, parsed_elements)
