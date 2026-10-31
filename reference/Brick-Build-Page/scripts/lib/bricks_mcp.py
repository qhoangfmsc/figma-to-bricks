"""Bricks MCP bridge client — IDE-agnostic via .env (không phụ thuộc Cursor)."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

from .env_loader import load_env

DEFAULT_MCP_URL = "http://localhost:8000/wp-json/bricks-mcp-bridge/v1/mcp"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
PROJECT_MCP_CONFIG = PROJECT_ROOT / "config" / "bricks-mcp.json"

# Section template preview: hide site chrome for G3/G4 screenshots (Bricks Page Settings).
SECTION_REVIEW_PAGE_SETTINGS: dict[str, bool] = {
    "headerDisabled": True,
    "footerDisabled": True,
}


def normalize_bearer_token(token: str) -> str:
    token = token.strip()
    return token if token.startswith("Bearer ") else f"Bearer {token}"


def _token_from_json_payload(config: dict) -> str | None:
    for key in ("token", "authorization", "Authorization"):
        value = config.get(key)
        if isinstance(value, str) and value.strip():
            return normalize_bearer_token(value)

    servers = config.get("mcpServers")
    if isinstance(servers, dict):
        server = servers.get("bricks-mcp") or servers.get("bricks_mcp")
        if isinstance(server, dict):
            headers = server.get("headers") or {}
            auth = headers.get("Authorization") or headers.get("authorization")
            if isinstance(auth, str) and auth.strip():
                return normalize_bearer_token(auth)
    return None


def load_bearer_token_from_file(config_path: Path) -> str:
    config = json.loads(config_path.read_text())
    token = _token_from_json_payload(config)
    if not token:
        raise ValueError(
            f"Cannot read Bearer token from {config_path}. "
            "Use BRICKS_MCP_TOKEN in .env or a JSON with token/Authorization/mcpServers.bricks-mcp"
        )
    return token


def _candidate_config_paths(explicit: Path | None = None) -> list[Path]:
    if explicit:
        return [explicit]

    env = load_env()
    paths: list[Path] = []

    raw = env.get("MCP_CONFIG", "").strip()
    if raw:
        paths.append(Path(os.path.expanduser(raw)))

    if PROJECT_MCP_CONFIG not in paths:
        paths.append(PROJECT_MCP_CONFIG)

    cursor_default = Path.home() / ".cursor" / "mcp.json"
    if cursor_default not in paths:
        paths.append(cursor_default)

    return paths


def load_bearer_token(config_path: Path | None = None) -> str:
    env = load_env()
    token = env.get("BRICKS_MCP_TOKEN", "").strip()
    if token:
        return normalize_bearer_token(token)

    tried: list[str] = []
    for path in _candidate_config_paths(config_path):
        tried.append(str(path))
        if path.exists():
            return load_bearer_token_from_file(path)

    raise FileNotFoundError(
        "Bricks MCP token not found. Set in .env (recommended for any IDE):\n"
        "  BRICKS_MCP_TOKEN=Bearer <token>\n"
        "Or optional file fallback:\n"
        "  MCP_CONFIG=/path/to/mcp.json\n"
        f"  {PROJECT_MCP_CONFIG}\n"
        f"Tried: {', '.join(tried)}"
    )


def resolve_mcp_url(mcp_url: str | None = None) -> str:
    if mcp_url:
        return mcp_url
    env = load_env()
    return env.get("BRICKS_MCP_URL", "").strip() or DEFAULT_MCP_URL


def mcp_call(tool: str, args: dict, mcp_url: str | None = None, token: str | None = None) -> dict:
    url = resolve_mcp_url(mcp_url)
    bearer = token or load_bearer_token()
    payload = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": tool, "arguments": args},
    }).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": bearer,
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        raise RuntimeError(f"MCP HTTP {exc.code}: {body}") from exc


def parse_mcp_result(data: dict) -> dict:
    if data.get("error"):
        raise RuntimeError(data["error"])
    content = data.get("result", {}).get("content", [])
    if not content:
        raise RuntimeError(f"MCP empty result: {data}")
    text = content[0].get("text", "{}")
    return json.loads(text) if text.strip().startswith("{") else {"raw": text}


def get_template(template_id: int, mcp_url: str | None = None) -> dict:
    return parse_mcp_result(mcp_call("get_template", {"template_id": template_id}, mcp_url))


def section_review_page_settings_applied(page_settings: dict | None) -> bool:
    if not page_settings:
        return False
    return bool(page_settings.get("headerDisabled")) and bool(page_settings.get("footerDisabled"))


def set_template_content(
    template_id: int,
    elements: list,
    mcp_url: str | None = None,
    *,
    sync_css: bool = True,
    generate_css: bool | None = None,
    page_settings: dict | None = None,
) -> dict:
    """Upload template. sync_css=True (default): auto external file or inline no-op."""
    args: dict = {
        "template_id": template_id,
        "elements_json": json.dumps(elements, ensure_ascii=False),
    }
    use_sync = generate_css if generate_css is not None else sync_css
    if use_sync:
        args["sync_css"] = True
    if page_settings is not None:
        args["page_settings_json"] = json.dumps(page_settings, ensure_ascii=False)
    return parse_mcp_result(mcp_call("set_template_content", args, mcp_url))


def set_page_settings(
    page_settings: dict,
    *,
    template_id: int | None = None,
    page_id: int | None = None,
    mcp_url: str | None = None,
) -> dict:
    """Merge Bricks page settings without re-uploading elements."""
    if not template_id and not page_id:
        raise ValueError("template_id or page_id required")
    args: dict = {
        "page_settings_json": json.dumps(page_settings, ensure_ascii=False),
    }
    if template_id is not None:
        args["template_id"] = template_id
    if page_id is not None:
        args["page_id"] = page_id
    return parse_mcp_result(mcp_call("set_page_settings", args, mcp_url))


def set_template_page_settings(
    template_id: int,
    page_settings: dict,
    mcp_url: str | None = None,
) -> dict:
    return set_page_settings(page_settings, template_id=template_id, mcp_url=mcp_url)


def health_check(mcp_url: str | None = None) -> bool:
    """Verify MCP connection before running automated tools.

    Returns True if connected, False with diagnostic output otherwise.
    Call at the start of any automated pipeline (autopilot, review_gates, etc.).
    """
    try:
        info = get_site_info(mcp_url)
        site_url = info.get("site_url", info.get("url", "unknown"))
        bricks_ver = info.get("bricks_version", "?")
        print(f"✓ MCP connected: {site_url} (Bricks {bricks_ver})")
        return True
    except FileNotFoundError as exc:
        print(f"✗ MCP token not found: {exc}")
        print("  → Copy token from WP Admin → Bricks MCP Bridge settings")
        print("  → Paste into .env as BRICKS_MCP_TOKEN=Bearer <token>")
        return False
    except RuntimeError as exc:
        msg = str(exc)
        if "401" in msg or "unauthorized" in msg.lower():
            print(f"✗ MCP unauthorized (401): token expired or invalid")
            print("  → WP Admin → Bricks MCP Bridge → Generate new token")
            print("  → Update .env BRICKS_MCP_TOKEN")
        elif "Connection refused" in msg or "ECONNREFUSED" in msg.lower():
            print(f"✗ MCP connection refused: WordPress not running?")
            print("  → Start WordPress (docker/local) on the URL in .env")
        else:
            print(f"✗ MCP error: {msg}")
        return False
    except Exception as exc:
        print(f"✗ MCP unexpected error: {exc}")
        return False


def get_site_info(mcp_url: str | None = None) -> dict:
    return parse_mcp_result(mcp_call("get_site_info", {}, mcp_url))


def list_pages(mcp_url: str | None = None) -> dict:
    return parse_mcp_result(mcp_call("list_pages", {}, mcp_url))


def list_templates(mcp_url: str | None = None) -> dict:
    return parse_mcp_result(mcp_call("list_templates", {}, mcp_url))


def get_page(page_id: int, mcp_url: str | None = None) -> dict:
    return parse_mcp_result(mcp_call("get_page", {"page_id": page_id}, mcp_url))


def create_page(
    title: str,
    *,
    slug: str = "",
    status: str = "draft",
    elements: list | None = None,
    mcp_url: str | None = None,
) -> dict:
    args: dict = {"title": title, "status": status}
    if slug:
        args["slug"] = slug
    if elements is not None:
        args["elements_json"] = json.dumps(elements, ensure_ascii=False)
    return parse_mcp_result(mcp_call("create_page", args, mcp_url))


def create_template(
    title: str,
    template_type: str = "section",
    *,
    elements: list | None = None,
    mcp_url: str | None = None,
) -> dict:
    args: dict = {"title": title, "type": template_type}
    if elements is not None:
        args["elements_json"] = json.dumps(elements, ensure_ascii=False)
    return parse_mcp_result(mcp_call("create_template", args, mcp_url))


def set_page_content(
    page_id: int,
    elements: list,
    mcp_url: str | None = None,
    *,
    sync_css: bool = False,
) -> dict:
    args: dict = {
        "page_id": page_id,
        "elements_json": json.dumps(elements, ensure_ascii=False),
    }
    if sync_css:
        args["sync_css"] = True
    return parse_mcp_result(mcp_call("set_page_content", args, mcp_url))


def generate_css_file(post_id: int | None = None, template_id: int | None = None, mcp_url: str | None = None) -> dict:
    """Regenerate post-{id}.min.css for one page/template (external CSS mode only)."""
    args: dict = {}
    if post_id is not None:
        args["post_id"] = post_id
    if template_id is not None:
        args["template_id"] = template_id
    return parse_mcp_result(mcp_call("generate_css_file", args, mcp_url))


def patch_elements(elements: list, patches: dict[str, dict]) -> list:
    for el in elements:
        element_id = el.get("id")
        if element_id not in patches:
            continue
        settings = el.setdefault("settings", {})
        for key, value in patches[element_id].items():
            if key == "label":
                el["label"] = value
            else:
                settings[key] = value
    return elements


def refill_template(template_id: int, mcp_url: str | None = None) -> dict:
    data = get_template(template_id, mcp_url)
    elements = data.get("elements", [])
    return set_template_content(template_id, elements, mcp_url)


def ensure_page_template_labels(
    page_elements: list[dict],
    section_labels: dict[int, str],
) -> list[dict]:
    """Fix 'Label hiện Template' issue on page template elements.

    Bricks Structure panel displays the **top-level** ``label`` field, not
    ``settings._label`` alone.  This function sets both for every ``template``
    element whose ``settings.template`` ID appears in *section_labels*.

    Args:
        page_elements: The page's element list (will be mutated in-place).
        section_labels: Mapping of template_id → display name
            (e.g. ``{8163: "Hero section", 8164: "Section 1"}``).

    Returns:
        The same list with labels applied (for chaining).

    Usage::

        from scripts.lib.plan_parser import parse_plan
        meta = parse_plan(plan_path)
        labels = {s.template_id: s.name for s in meta.sections if s.template_id}
        page = get_page(page_id)
        elements = ensure_page_template_labels(page["elements"], labels)
        set_page_content(page_id, elements)
    """
    for el in page_elements:
        if el.get("name") != "template":
            continue
        tpl_id = el.get("settings", {}).get("template")
        if tpl_id and tpl_id in section_labels:
            label = section_labels[tpl_id]
            el["label"] = label
            el.setdefault("settings", {})["_label"] = label
    return page_elements
