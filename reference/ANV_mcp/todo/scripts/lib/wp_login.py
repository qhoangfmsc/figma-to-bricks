#!/usr/bin/env python3
"""
scripts/lib/wp_login.py
Đăng nhập WordPress cho mọi script Playwright (screenshot, zoom evidence, gate mobile/line-clamp).

Hỗ trợ site có lớp bảo vệ trước form login (vd. vietnix.vn):
    WP_FIREWALL       URL trang login riêng (slug ẩn thay cho /wp-login.php). Bỏ trống → <WP_URL>/wp-login.php
    WP_FIREWALL_USER  \  HTTP Basic Auth (openresty "Authorized Only") chặn trước form login.
    WP_FIREWALL_PASS  /  Bỏ trống → không gửi Basic Auth.

Usage:
    from lib.wp_login import browser_context_kwargs, wp_login   # chạy kiểu `python3 scripts/x.py`
    context = browser.new_context(viewport=..., **browser_context_kwargs())
    page = context.new_page()
    wp_login(page)   # raise RuntimeError nếu không đăng nhập được
"""

from urllib.parse import urlsplit

from .bricks_mcp import _get_config


def _wp_url() -> str:
    return _get_config('WP_URL', 'http://localhost:8000').rstrip('/')


def login_url() -> str:
    return _get_config('WP_FIREWALL') or f"{_wp_url()}/wp-login.php"


def has_credentials() -> bool:
    return bool(_get_config('WP_USER') and _get_config('WP_PASS'))


def browser_context_kwargs() -> dict:
    """kwargs cho browser.new_context(): Basic Auth giới hạn trong origin của WP_URL."""
    user, password = _get_config('WP_FIREWALL_USER'), _get_config('WP_FIREWALL_PASS')
    if not (user and password):
        return {}
    parts = urlsplit(_wp_url())
    return {'http_credentials': {
        'username': user,
        'password': password,
        'origin': f"{parts.scheme}://{parts.netloc}",
    }}


def goto_settled(page, url: str, timeout: int = 60000, idle_ms: int = 5000) -> None:
    """page.goto chịu được site production: chờ `load`, rồi thử `networkidle` tối đa idle_ms.

    vietnix.vn (chat widget/analytics/LiteSpeed) KHÔNG bao giờ đạt `networkidle` → goto
    wait_until='networkidle' timeout dù trang đã render xong (sự cố 2026-10-12). Không dùng
    networkidle làm điều kiện bắt buộc; caller vẫn tự wait_for_timeout cho render/lazyload."""
    page.goto(url, wait_until='load', timeout=timeout)
    try:
        page.wait_for_load_state('networkidle', timeout=idle_ms)
    except Exception:
        pass


def wp_login(page, timeout: int = 30000) -> None:
    """Đăng nhập WP bằng WP_USER/WP_PASS; kiểm tra cookie wordpress_logged_in_* để chống false-success."""
    url = login_url()
    print(f"Đang đăng nhập vào WordPress tại: {url}")
    goto_settled(page, url, timeout=timeout)
    page.fill('#user_login', _get_config('WP_USER'), timeout=timeout)
    page.fill('#user_pass', _get_config('WP_PASS'))
    page.click('#wp-submit')
    page.wait_for_load_state('load', timeout=timeout)
    try:
        page.wait_for_load_state('networkidle', timeout=5000)
    except Exception:
        pass
    if not any(c['name'].startswith('wordpress_logged_in_') for c in page.context.cookies()):
        raise RuntimeError(
            f"Đăng nhập WP thất bại (không có cookie wordpress_logged_in_*). URL hiện tại: {page.url}. "
            "Kiểm tra WP_USER/WP_PASS, WP_FIREWALL (URL login) và WP_FIREWALL_USER/PASS trong .env."
        )
    print("Đăng nhập thành công.")
