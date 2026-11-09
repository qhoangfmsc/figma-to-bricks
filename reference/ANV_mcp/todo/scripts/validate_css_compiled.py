#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gate G2 — CSS Compiled Validator
Kiểm tra file CSS của template đã được Bricks compile và serve thành công.

Bricks ở chế độ "External files" sẽ generate file CSS tại:
  /wp-content/uploads/bricks/css/post-{template_id}.min.css

Usage:
    python3 todo/scripts/validate_css_compiled.py --template-id 8993
    python3 todo/scripts/validate_css_compiled.py --template-id 8993 --template-id 8994
    python3 todo/scripts/validate_css_compiled.py --all  (đọc từ template_mapping.json)

Options:
    --template-id   Template post ID cần kiểm tra (có thể lặp nhiều lần)
    --all           Kiểm tra tất cả templates trong todo/plans/template_mapping.json
    --page-id       Kiểm tra page ID thay vì template ID
"""

import sys
import os
import json
import argparse
import urllib.request
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.lib.bricks_mcp import _get_config, generate_css_file, BricksMCPError

# WP_URL đọc từ .env — dùng chung cho mọi môi trường, không phân biệt local/remote.
WP_URL = _get_config("WP_URL", "http://localhost:8000").rstrip("/")

MAPPING_FILE = os.path.join(os.path.dirname(__file__), '..', 'plans', 'template_mapping.json')

CSS_UPLOAD_PATH = "/wp-content/uploads/bricks/css/post-{post_id}.min.css"


def check_css_url(post_id: int) -> tuple[bool, int, str]:
    """Kiểm tra URL CSS. Trả về (success, http_status, message)."""
    css_url = WP_URL + CSS_UPLOAD_PATH.format(post_id=post_id)
    try:
        req = urllib.request.Request(css_url, method="HEAD")
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            if status == 200:
                content_length = resp.headers.get("Content-Length", "?")
                return True, status, f"✅ CSS tồn tại ({content_length} bytes) — {css_url}"
            else:
                return False, status, f"❌ HTTP {status} — {css_url}"
    except urllib.error.HTTPError as e:
        return False, e.code, f"❌ HTTP {e.code} {e.reason} — {css_url}"
    except urllib.error.URLError as e:
        return False, 0, f"❌ Không kết nối được: {e.reason} — {css_url}"
    except Exception as e:
        return False, 0, f"❌ Lỗi không xác định: {e}"


def trigger_css_regenerate(post_id: int) -> bool:
    """Regenerate CSS cho post_id qua bridge — dùng client JSON-RPC chung trong
    lib/bricks_mcp.py (protocol tools/call + Bearer token đúng chuẩn). Bản cũ tự
    dựng payload {"tool": ...} sai protocol nên mọi lần regen đều thất bại im lặng."""
    try:
        generate_css_file(post_id)
        return True
    except BricksMCPError as e:
        print(f"           → Regenerate lỗi: {e}")
        return False


def validate_css(post_ids: list[int], auto_regen: bool = True) -> bool:
    print(f"\n{'='*60}")
    print(f"  GATE G2 — CSS COMPILED VALIDATOR")
    print(f"  Site: {WP_URL}")
    print(f"{'='*60}\n")

    total_pass = 0
    total_fail = 0

    for post_id in post_ids:
        success, status, msg = check_css_url(post_id)
        print(f"  [post-{post_id}] {msg}")

        if not success and auto_regen and status in (0, 404):
            print(f"           → Đang thử regenerate CSS...")
            regen_ok = trigger_css_regenerate(post_id)
            if regen_ok:
                # Thử lại sau khi regenerate
                import time
                time.sleep(1)
                success, status, msg = check_css_url(post_id)
                print(f"           → Sau regenerate: {msg}")

        if success:
            total_pass += 1
        else:
            total_fail += 1

    print(f"\n{'─'*60}")
    print(f"  Tổng kết: {total_pass} pass | {total_fail} fail")

    if total_fail == 0:
        print("  ✅ G2 PASS — CSS đã compile thành công cho tất cả templates.\n")
        return True
    else:
        print("  ❌ G2 FAIL — Một số template chưa có CSS. Kiểm tra Bricks CSS generation mode.\n")
        print("  Gợi ý: Vào Bricks → Settings → Performance → CSS Loading Method → External Files")
        print("  Sau đó chạy: wp bricks regenerate_assets (WP-CLI)\n")
        return False


def load_all_template_ids() -> list[int]:
    """Đọc tất cả post IDs cần check CSS từ template_mapping.json.

    Schema thống nhất (giống screenshot_templates.py / lib, xem MAPPING-FIGMA-FLOW.md §3):
      { "<section_key>": {"template_id": <int>, "url": "..."}, "page": {"page_id": <int>} }
    """
    if not os.path.exists(MAPPING_FILE):
        print(f"⚠️  Không tìm thấy {MAPPING_FILE} — dùng --template-id thủ công")
        return []
    with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    post_ids = []
    for key, entry in data.items():
        if not isinstance(entry, dict):
            continue
        if key == "page":
            if entry.get("page_id"):
                post_ids.append(int(entry["page_id"]))
        elif entry.get("template_id"):
            post_ids.append(int(entry["template_id"]))
    return post_ids


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gate G2: Kiểm tra CSS của Bricks template đã compile chưa.")
    parser.add_argument("--template-id", type=int, action="append", dest="template_ids",
                        help="Template post ID (có thể dùng nhiều lần)")
    parser.add_argument("--page-id", type=int, action="append", dest="page_ids",
                        help="Page post ID")
    parser.add_argument("--all", action="store_true", help="Kiểm tra tất cả từ template_mapping.json")
    parser.add_argument("--no-regen", action="store_true", help="Không tự động regenerate CSS khi fail")
    args = parser.parse_args()

    post_ids = []

    if args.all:
        post_ids = load_all_template_ids()
        if not post_ids:
            sys.exit(1)
    else:
        if args.template_ids:
            post_ids.extend(args.template_ids)
        if args.page_ids:
            post_ids.extend(args.page_ids)

    if not post_ids:
        parser.print_help()
        print("\nVí dụ: python3 validate_css_compiled.py --template-id 8993 --template-id 8994")
        sys.exit(1)

    success = validate_css(post_ids, auto_regen=not args.no_regen)
    sys.exit(0 if success else 1)
