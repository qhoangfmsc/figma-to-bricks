#!/usr/bin/env python3
"""
scripts/lib/bricks_mcp.py
Python client cho Bricks MCP Bridge (JSON-RPC 2.0 over HTTP POST).

Usage:
    from scripts.lib.bricks_mcp import (
        get_site_info, list_templates, create_template,
        set_template_content, create_page, set_page_content,
        generate_css_file, SECTION_REVIEW_PAGE_SETTINGS
    )
"""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Optional, Union

# ── Cấu hình từ .env ────────────────────────────────────────────────────────

def _find_env() -> Path:
    """Tìm file .env từ thư mục project root."""
    # Tìm từ thư mục script lên trên
    current = Path(__file__).resolve()
    for parent in [current, *current.parents]:
        candidate = parent / '.env'
        if candidate.exists():
            return candidate
    # Fallback: thư mục làm việc hiện tại
    return Path('.env')


def _load_env(env_path: Optional[Path] = None) -> dict:
    """Đọc file .env, trả về dict key=value."""
    path = env_path or _find_env()
    env = {}
    if not path.exists():
        return env
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, val = line.partition('=')
            env[key.strip()] = val.strip().strip('"').strip("'")
    return env


_ENV = _load_env()


def _get_config(key: str, default: str = '') -> str:
    """Lấy giá trị từ env vars (ưu tiên os.environ, fallback .env file)."""
    return os.environ.get(key) or _ENV.get(key) or default


# ── Constants ────────────────────────────────────────────────────────────────

SECTION_REVIEW_PAGE_SETTINGS = {
    "headerDisabled": True,
    "footerDisabled": True
}

# ── JSON-RPC Client ──────────────────────────────────────────────────────────

class BricksMCPError(Exception):
    """Lỗi từ Bricks MCP Bridge."""
    def __init__(self, message: str, code: int = 0):
        super().__init__(message)
        self.code = code


class BricksMCPClient:
    """
    Client giao tiếp với Bricks MCP Bridge qua JSON-RPC 2.0 over HTTP POST.

    Protocol:
        POST {mcp_url}
        Authorization: Bearer {token}
        Content-Type: application/json
        Body: {"jsonrpc": "2.0", "id": 1, "method": "tools/call",
               "params": {"name": "tool_name", "arguments": {...}}}
    """

    def __init__(
        self,
        mcp_url: Optional[str] = None,
        token: Optional[str] = None,
        timeout: int = 60
    ):
        self.mcp_url = (mcp_url or _get_config('BRICKS_MCP_URL')).rstrip('/')
        raw_token    = token or _get_config('BRICKS_MCP_TOKEN')
        # Strip 'Bearer ' prefix nếu đã có sẵn trong .env
        self.token   = raw_token.removeprefix('Bearer ').strip()
        self.timeout = timeout
        self._req_id = 0

        if not self.mcp_url:
            raise BricksMCPError(
                "BRICKS_MCP_URL chưa được cấu hình. "
                "Kiểm tra file .env hoặc biến môi trường."
            )
        if not self.token:
            raise BricksMCPError(
                "BRICKS_MCP_TOKEN chưa được cấu hình. "
                "Kiểm tra file .env hoặc biến môi trường."
            )

    def _next_id(self) -> int:
        self._req_id += 1
        return self._req_id

    def call_tool(self, tool_name: str, arguments: dict = None) -> Any:
        """
        Gọi một Bricks MCP tool qua JSON-RPC.
        Trả về parsed result hoặc raise BricksMCPError.
        """
        payload = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments or {}
            }
        }

        body = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            self.mcp_url,
            data=body,
            method='POST',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.token}',
                'Accept': 'application/json',
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode('utf-8')
        except urllib.error.HTTPError as e:
            raise BricksMCPError(f"HTTP {e.code}: {e.reason} — {self.mcp_url}")
        except urllib.error.URLError as e:
            raise BricksMCPError(f"Không kết nối được tới {self.mcp_url}: {e.reason}")

        try:
            rpc_resp = json.loads(raw)
        except json.JSONDecodeError:
            raise BricksMCPError(f"Response không phải JSON hợp lệ: {raw[:200]}")

        if 'error' in rpc_resp:
            err = rpc_resp['error']
            raise BricksMCPError(err.get('message', str(err)), err.get('code', -1))

        result = rpc_resp.get('result', {})

        # Bricks MCP trả content[0].text (tool_text_result format)
        if isinstance(result, dict) and 'content' in result:
            text = result['content'][0].get('text', '') if result['content'] else ''
            is_error = result.get('isError', False)
            if is_error:
                raise BricksMCPError(text)
            # Parse text nếu là JSON
            try:
                return json.loads(text)
            except (json.JSONDecodeError, TypeError):
                return text

        return result

    def initialize(self) -> dict:
        """Gửi initialize request (kiểm tra kết nối)."""
        payload = {
            "jsonrpc": "2.0",
            "id": self._next_id(),
            "method": "initialize",
            "params": {"protocolVersion": "2025-06-18"}
        }
        body = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            self.mcp_url, data=body, method='POST',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {self.token}',
            }
        )
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode('utf-8')).get('result', {})


# ── Singleton client ─────────────────────────────────────────────────────────

_client: Optional[BricksMCPClient] = None


def _get_client() -> BricksMCPClient:
    global _client
    if _client is None:
        _client = BricksMCPClient()
    return _client


# ── Public API ───────────────────────────────────────────────────────────────

def get_site_info() -> dict:
    """Lấy thông tin site WordPress + Bricks."""
    return _get_client().call_tool('get_site_info')


def list_pages(search: str = '', status: str = 'any', per_page: int = 20) -> dict:
    """Liệt kê WordPress pages."""
    args = {'status': status, 'per_page': per_page}
    if search:
        args['search'] = search
    return _get_client().call_tool('list_pages', args)


def create_page(
    title: str,
    slug: str = '',
    status: str = 'draft',
    elements_json: str = ''
) -> dict:
    """Tạo WordPress page và enable Bricks editor."""
    args = {'title': title, 'status': status}
    if slug:
        args['slug'] = slug
    if elements_json:
        args['elements_json'] = elements_json
    return _get_client().call_tool('create_page', args)


def get_page(page_id: int) -> dict:
    """Đọc page bao gồm Bricks element tree."""
    return _get_client().call_tool('get_page', {'page_id': page_id})


def set_page_content(
    page_id: int,
    elements: Union[list, dict, str],
    sync_css: bool = True,
    page_settings: Optional[dict] = None
) -> dict:
    """Ghi Bricks element content lên page."""
    elements_json = elements if isinstance(elements, str) else json.dumps(elements)
    args = {
        'page_id': page_id,
        'elements_json': elements_json,
        'sync_css': sync_css,
    }
    if page_settings:
        args['page_settings_json'] = json.dumps(page_settings)
    return _get_client().call_tool('set_page_content', args)


def list_templates(type_filter: str = '') -> dict:
    """Liệt kê Bricks templates."""
    args = {}
    if type_filter:
        args['type'] = type_filter
    return _get_client().call_tool('list_templates', args)


def create_template(
    title: str,
    template_type: str,
    elements_json: str = ''
) -> dict:
    """
    Tạo Bricks template.
    template_type: 'header' | 'footer' | 'content' | 'section' | 'archive' | 'search' | 'error' | 'popup'
    """
    args = {'title': title, 'type': template_type}
    if elements_json:
        args['elements_json'] = elements_json
    return _get_client().call_tool('create_template', args)


def get_template(template_id: int) -> dict:
    """Đọc Bricks template bao gồm element tree."""
    return _get_client().call_tool('get_template', {'template_id': template_id})


def set_template_content(
    template_id: int,
    elements: Union[list, dict, str],
    sync_css: bool = True,
    page_settings: Optional[dict] = None,
    global_classes: Optional[list] = None
) -> dict:
    """
    Upload Bricks element content lên template.
    elements có thể là:
      - list: flat array of element objects
      - dict: bricksCopiedElements clipboard payload
      - str: JSON string của cả hai loại trên
    """
    elements_json = elements if isinstance(elements, str) else json.dumps(elements, ensure_ascii=False)
    args = {
        'template_id': template_id,
        'elements_json': elements_json,
        'sync_css': sync_css,
    }
    if page_settings:
        args['page_settings_json'] = json.dumps(page_settings)
    if global_classes:
        args['global_classes_json'] = json.dumps(global_classes)
    return _get_client().call_tool('set_template_content', args)


def set_page_settings(
    page_settings: dict,
    template_id: int = 0,
    page_id: int = 0
) -> dict:
    """Merge Bricks page settings mà không re-upload elements."""
    args = {'page_settings_json': json.dumps(page_settings)}
    if template_id:
        args['template_id'] = template_id
    if page_id:
        args['page_id'] = page_id
    return _get_client().call_tool('set_page_settings', args)


def generate_css_file(post_id: int) -> dict:
    """Regenerate CSS file cho một template/page (External files mode)."""
    return _get_client().call_tool('generate_css_file', {'post_id': post_id})


def upload_media(filename: str, content: bytes) -> dict:
    """Upload file media (bytes) lên WP Media Library qua bridge (tool upload_media,
    bridge >= 1.3.0). Trả về {'attachment_id': int, 'url': str, ...}.

    Dùng để re-host ảnh Figma cache (localhost:3845) về chính site WP — bước bắt
    buộc trước khi công bố trang cho khách thật, áp dụng chung mọi môi trường
    (local hay remote). Xem scripts/rehost_assets.py."""
    import base64
    return _get_client().call_tool('upload_media', {
        'filename': filename,
        'content_base64': base64.b64encode(content).decode('ascii'),
    })


def regenerate_css() -> dict:
    """Regenerate tất cả CSS files toàn site."""
    return _get_client().call_tool('regenerate_css')


# ── Helpers ──────────────────────────────────────────────────────────────────

def load_json_file(path: Union[str, Path]) -> Union[list, dict]:
    """Đọc JSON từ file, raise rõ ràng nếu lỗi."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"JSON file không tìm thấy: {path}")
    with open(path, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError as e:
            raise ValueError(f"JSON parse lỗi tại {path}: {e}")


def load_template_mapping(
    mapping_path: Union[str, Path] = 'todo/plans/template_mapping.json'
) -> dict:
    """Đọc template_mapping.json — ánh xạ section_key → template_id."""
    return load_json_file(mapping_path)


def get_template_id(section_key: str, mapping_path: Union[str, Path] = 'todo/plans/template_mapping.json') -> int:
    """Lấy template_id cho section_key từ mapping file."""
    mapping = load_template_mapping(mapping_path)
    if section_key not in mapping:
        available = list(mapping.keys())
        raise KeyError(
            f"Section key '{section_key}' không có trong template_mapping.json. "
            f"Các key có sẵn: {available}"
        )
    return int(mapping[section_key]['template_id'])


# ── Test trực tiếp ───────────────────────────────────────────────────────────

if __name__ == '__main__':
    import sys
    print("🔌 Kiểm tra kết nối Bricks MCP Bridge...")
    try:
        info = get_site_info()
        print(f"✅ Kết nối thành công!")
        print(f"   Site: {info.get('site_name')} ({info.get('site_url')})")
        print(f"   Bricks: {info.get('bricks_version')}")
        print(f"   CSS loading: {info.get('css_loading_label')}")
        print(f"   User: {info.get('acting_as_user')}")
    except BricksMCPError as e:
        print(f"❌ Lỗi kết nối: {e}", file=sys.stderr)
        sys.exit(1)
