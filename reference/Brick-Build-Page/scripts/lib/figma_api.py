"""Figma REST API client for plan generation (Phase C)."""
from __future__ import annotations

import json
import re
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any

FIGMA_API = "https://api.figma.com/v1"

FIGMA_URL_RE = re.compile(
    r"figma\.com/design/(?P<file_key>[A-Za-z0-9]+)/[^?]*(?:\?(?:[^#]*&)?node-id=(?P<node>[0-9]+-[0-9]+)|)",
    re.I,
)


@dataclass
class ParsedFigmaUrl:
    file_key: str
    node_id: str | None
    url: str


def node_id_from_url_fragment(raw: str) -> str:
    return raw.replace("-", ":")


def node_id_to_url_fragment(node_id: str) -> str:
    return node_id.replace(":", "-")


def parse_figma_url(url: str) -> ParsedFigmaUrl:
    match = FIGMA_URL_RE.search(url)
    if not match:
        raise ValueError(f"Cannot parse Figma design URL: {url}")
    file_key = match.group("file_key")
    node_raw = match.group("node")
    node_id = node_id_from_url_fragment(node_raw) if node_raw else None
    return ParsedFigmaUrl(file_key=file_key, node_id=node_id, url=url.split("?")[0].split("#")[0])


def build_figma_url(file_key: str, file_name: str, node_id: str | None) -> str:
    base = f"https://www.figma.com/design/{file_key}/{urllib.parse.quote(file_name)}"
    if node_id:
        return f"{base}?node-id={node_id_to_url_fragment(node_id)}"
    return base


RETRYABLE_HTTP_CODES = {429, 500, 502, 503, 504}


def figma_get(path: str, token: str, *, attempts: int = 3, timeout: float = 60) -> dict[str, Any]:
    """GET with retry: full-depth `/nodes` calls occasionally stall or hit 429 rate limits."""
    req = urllib.request.Request(
        f"{FIGMA_API}{path}",
        headers={"X-Figma-Token": token},
    )
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as exc:
            body = exc.read().decode()
            if exc.code not in RETRYABLE_HTTP_CODES or attempt == attempts:
                raise RuntimeError(f"Figma API HTTP {exc.code}: {body}") from exc
            retry_after = exc.headers.get("Retry-After", "")
            time.sleep(min(float(retry_after), 30) if retry_after.isdigit() else 2 * attempt)
        except (socket.timeout, TimeoutError, urllib.error.URLError) as exc:
            if attempt == attempts:
                raise RuntimeError(f"Figma API {path.split('?')[0]} failed after {attempts} attempts: {exc}") from exc
            time.sleep(2 * attempt)
    raise AssertionError("unreachable")


def fetch_file_meta(file_key: str, token: str) -> dict[str, Any]:
    return figma_get(f"/files/{file_key}?depth=1", token)


def fetch_node_tree(file_key: str, node_id: str, token: str, *, depth: int = 4) -> dict[str, Any]:
    encoded = urllib.parse.quote(node_id, safe="")
    data = figma_get(f"/files/{file_key}/nodes?ids={encoded}&depth={depth}", token)
    nodes = data.get("nodes") or {}
    entry = nodes.get(node_id)
    if not entry or "document" not in entry:
        raise RuntimeError(f"Figma node {node_id} not found in file {file_key}")
    return entry["document"]


def bbox_y(node: dict[str, Any]) -> float:
    box = node.get("absoluteBoundingBox") or {}
    return float(box.get("y", 0))


def bbox_size(node: dict[str, Any]) -> tuple[float, float]:
    box = node.get("absoluteBoundingBox") or {}
    return float(box.get("width", 0)), float(box.get("height", 0))


def fetch_node_bboxes(
    file_key: str,
    node_ids: list[str],
    token: str,
) -> dict[str, tuple[float, float]]:
    """Return node_id → (width, height) from absoluteBoundingBox."""
    return {node_id: bbox_size(node) for node_id, node in fetch_nodes(file_key, node_ids, token).items()}


def fetch_nodes(
    file_key: str,
    node_ids: list[str],
    token: str,
) -> dict[str, dict[str, Any]]:
    """Return node_id → the node document (one REST call)."""
    if not node_ids:
        return {}
    encoded = ",".join(urllib.parse.quote(n, safe="") for n in node_ids)
    data = figma_get(f"/files/{file_key}/nodes?ids={encoded}", token)
    out: dict[str, dict[str, Any]] = {}
    for node_id in node_ids:
        entry = (data.get("nodes") or {}).get(node_id)
        if entry and "document" in entry:
            out[node_id] = entry["document"]
    return out


def solid_background_rgb(node: dict[str, Any]) -> tuple[int, int, int] | None:
    """First opaque solid fill of a frame, as 0–255 RGB; None when the frame has no own fill."""
    for paint in (node.get("fills") or []) + (node.get("background") or []):
        if paint.get("type") != "SOLID" or paint.get("visible") is False:
            continue
        color = paint.get("color") or {}
        if color.get("a", 1) * paint.get("opacity", 1) < 0.999:
            continue
        return tuple(round(color.get(channel, 0) * 255) for channel in ("r", "g", "b"))
    return None
