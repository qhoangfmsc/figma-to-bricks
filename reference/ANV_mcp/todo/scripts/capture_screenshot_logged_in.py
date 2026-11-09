#!/usr/bin/env python3
import sys
import argparse
import os

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("LỖI: Thư viện 'playwright' chưa được cài đặt.")
    sys.exit(1)

from lib.wp_login import browser_context_kwargs, wp_login, goto_settled

def _find_env_file():
    """Walk up from this script and the cwd to locate the project's .env."""
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

def capture_screenshot_logged_in(url, output_path, viewport_type):
    print(f"=== BẮT ĐẦU CHỤP ẢNH GIAO DIỆN (ĐÃ ĐĂNG NHẬP) ===")
    env = load_env()
    wp_user = env.get("WP_USER")
    wp_pass = env.get("WP_PASS")

    if not wp_user or not wp_pass:
        print("CẢNH BÁO: Không tìm thấy thông tin đăng nhập trong .env. Sẽ chạy không đăng nhập.")

    if viewport_type == "desktop":
        width, height = 1440, 900
    elif viewport_type == "mobile":
        width, height = 390, 844
    else:
        print(f"LỖI: Viewport '{viewport_type}' không hợp lệ.")
        sys.exit(1)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                viewport={"width": width, "height": height},
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                **browser_context_kwargs()
            )
            page = context.new_page()

            if wp_user and wp_pass:
                wp_login(page)

            print(f"Đang tải trang mục tiêu: {url}")
            goto_settled(page, url)
            page.wait_for_timeout(1500)
            
            # Đảm bảo thư mục lưu tồn tại
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            
            page.screenshot(path=output_path, full_page=True)
            print(f"✅ THÀNH CÔNG: Đã chụp ảnh và lưu tại {output_path}")
            
            browser.close()
    except Exception as e:
        print(f"❌ LỖI: {e}")
        sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Chụp ảnh màn hình WordPress đã đăng nhập.")
    parser.add_argument("--url", required=True)
    parser.add_argument("--viewport", required=True, choices=["desktop", "mobile"])
    parser.add_argument("--output", required=True)
    
    args = parser.parse_args()
    capture_screenshot_logged_in(args.url, args.output, args.viewport)
