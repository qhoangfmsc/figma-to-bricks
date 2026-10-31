"""Parse ### Cấu trúc element ASCII tree into nodes."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

WIDGET_ALIASES: dict[str, str] = {
    "section": "section",
    "container": "container",
    "block": "block",
    "div": "div",
    "image": "image",
    "img": "image",
    "heading": "heading",
    "h1": "heading",
    "h2": "heading",
    "h3": "heading",
    "h4": "heading",
    "button": "button",
    "text-basic": "text-basic",
    "text": "text-basic",
    "icon": "icon",
    "slider-nested": "slider-nested",
    "slider": "slider-nested",
    "slide": "slider-nestable",
    "accordion-nested": "accordion-nested",
    "form": "form",
}

ID_PREFIX_WIDGET: list[tuple[str, str]] = [
    ("sec", "section"),
    ("con", "container"),
    ("nav", "block"),
    ("hro", "block"),
    ("row", "block"),
    ("col", "block"),
    ("card", "block"),
    ("bento", "block"),
    ("cta", "button"),
    ("hdimg", "image"),
    ("mnimg", "image"),
    ("subimg", "image"),
    ("sld", "slider-nested"),
    ("txt", "text-basic"),
    ("ico", "icon"),
]

NODE_TOKEN_RE = re.compile(
    r"^(?:(?P<widget>[a-z][a-z0-9-]*)\s+)?(?P<id>[a-zA-Z][a-zA-Z0-9_]*)?(?:\s*\[(?P<meta>[^\]]*)\])?(?:\s*\((?P<note>[^)]*)\))?$"
)


@dataclass
class TreeNode:
    semantic_id: str
    widget: str
    meta: str = ""
    note: str = ""
    children: list[TreeNode] = field(default_factory=list)
    parent_semantic_id: str | None = None


def _infer_widget(widget: str | None, semantic_id: str | None) -> str:
    if widget:
        key = widget.lower()
        if key in WIDGET_ALIASES:
            return WIDGET_ALIASES[key]
        if key.startswith("h") and len(key) == 2 and key[1].isdigit():
            return "heading"
    sid = (semantic_id or "").lower()
    for prefix, w in ID_PREFIX_WIDGET:
        if sid.startswith(prefix):
            return w
    if sid in ("cta", "cta001"):
        return "button"
    return "block"


def _parse_node_token(token: str) -> TreeNode | None:
    token = token.strip()
    if not token or token.startswith("×"):
        return None
    token = re.sub(r"^→\s*", "", token).strip()
    if not token:
        return None

    # heading h2, button CTA, container con001
    parts = token.split(None, 1)
    if len(parts) == 1:
        single = parts[0]
        if single.lower() in WIDGET_ALIASES or single.lower().startswith("h") and len(single) == 2:
            widget = _infer_widget(single, None)
            sid = single.lower() if widget == "heading" else single
            return TreeNode(semantic_id=sid, widget=widget)
        match = NODE_TOKEN_RE.match(single)
        if match:
            wid = match.group("id") or single
            return TreeNode(
                semantic_id=wid,
                widget=_infer_widget(match.group("widget"), wid),
                meta=match.group("meta") or "",
                note=match.group("note") or "",
            )
        return TreeNode(semantic_id=single, widget=_infer_widget(None, single))

    widget_raw, rest = parts[0], parts[1]
    match = NODE_TOKEN_RE.match(f"{widget_raw} {rest}")
    if match:
        sid = match.group("id") or rest.split("[", 1)[0].strip()
        return TreeNode(
            semantic_id=sid,
            widget=_infer_widget(match.group("widget") or widget_raw, sid),
            meta=match.group("meta") or "",
            note=match.group("note") or "",
        )
    return TreeNode(semantic_id=rest, widget=_infer_widget(widget_raw, rest))


def _split_siblings(segment: str) -> list[str]:
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    for char in segment:
        if char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        if char == "+" and depth == 0:
            part = "".join(current).strip()
            if part:
                parts.append(part)
            current = []
            continue
        current.append(char)
    tail = "".join(current).strip()
    if tail:
        parts.append(tail)
    return parts


def _parse_chain(line: str) -> list[TreeNode]:
    line = line.strip()
    line = re.sub(r"^\s*→\s*", "", line)
    nodes: list[TreeNode] = []
    for segment in line.split("→"):
        for sibling in _split_siblings(segment):
            node = _parse_node_token(sibling.strip())
            if node:
                nodes.append(node)
    return nodes


def parse_element_tree(text: str) -> TreeNode | None:
    """Return root TreeNode or None if empty."""
    if not text.strip():
        return None

    lines = [ln.rstrip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return None

    root: TreeNode | None = None
    stack: list[tuple[int, TreeNode]] = []

    for raw_line in lines:
        indent = len(raw_line) - len(raw_line.lstrip(" "))
        chain_nodes = _parse_chain(raw_line.strip())

        while stack and stack[-1][0] >= indent:
            stack.pop()

        parent = stack[-1][1] if stack else None

        for i, node in enumerate(chain_nodes):
            if parent is None and root is None and i == 0:
                root = node
                stack.append((indent, node))
                parent = node
                continue
            if i == 0 and parent:
                node.parent_semantic_id = parent.semantic_id
                parent.children.append(node)
                parent = node
                stack.append((indent, node))
            elif i > 0 and parent:
                node.parent_semantic_id = parent.semantic_id
                parent.children.append(node)

    return root
