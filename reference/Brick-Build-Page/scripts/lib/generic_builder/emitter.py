"""Emit Bricks element list from parsed tree + settings."""
from __future__ import annotations

import re
from typing import Any

from scripts.lib.element_ids import ElementIdFactory
from scripts.lib.generic_builder.tree_parser import TreeNode


def _deep_merge(base: dict[str, Any], extra: dict[str, Any]) -> dict[str, Any]:
    out = dict(base)
    for key, val in extra.items():
        if key in out and isinstance(out[key], dict) and isinstance(val, dict):
            out[key] = _deep_merge(out[key], val)
        else:
            out[key] = val
    return out


def _default_settings(node: TreeNode) -> dict[str, Any]:
    settings: dict[str, Any] = {}
    if node.widget == "section":
        settings["tag"] = "section"
    elif node.widget == "heading":
        tag = "h2"
        if node.semantic_id.lower().startswith("h") and len(node.semantic_id) == 2:
            tag = node.semantic_id.lower()
        settings["tag"] = tag
    elif node.widget == "text-basic":
        settings["tag"] = "p"
    elif node.widget == "slider-nested":
        settings["type"] = "slide"
        settings["perPage"] = "3"
        settings["gap"] = "24"
    return settings


def _collect_nodes(root: TreeNode) -> list[TreeNode]:
    nodes: list[TreeNode] = []

    def walk(n: TreeNode) -> None:
        nodes.append(n)
        for child in n.children:
            walk(child)

    walk(root)
    return nodes


def emit_bricks_elements(
    root: TreeNode,
    *,
    template_id: int,
    settings_by_semantic: dict[str, dict[str, Any]],
    asset_urls: list[str],
    section_label: str,
) -> list[dict]:
    """Convert tree + settings into Bricks JSON elements."""
    factory = ElementIdFactory(template_id)
    semantic_to_hex: dict[str, str] = {}
    tree_nodes = _collect_nodes(root)

    for node in tree_nodes:
        semantic_to_hex[node.semantic_id] = factory.next()

    elements: list[dict] = []
    image_idx = 0
    for node in tree_nodes:
        hex_id = semantic_to_hex[node.semantic_id]
        parent_hex = 0 if node.parent_semantic_id is None else semantic_to_hex.get(node.parent_semantic_id, 0)
        children_hex = [semantic_to_hex[c.semantic_id] for c in node.children]

        settings = _default_settings(node)
        if node.semantic_id in settings_by_semantic:
            settings = _deep_merge(settings, settings_by_semantic[node.semantic_id])

        # Apply shared snapshot keys (row1/row2 → row1)
        for key, val in settings_by_semantic.items():
            if "/" in key and node.semantic_id in key.split("/"):
                settings = _deep_merge(settings, val)

        if node.widget == "image" and image_idx < len(asset_urls):
            settings.setdefault("image", {})["url"] = asset_urls[image_idx]
            image_idx += 1

        label = node.meta or node.note or node.semantic_id
        if node == root:
            label = section_label or label

        el: dict[str, Any] = {
            "id": hex_id,
            "name": node.widget,
            "parent": parent_hex,
            "children": children_hex,
            "settings": settings,
        }
        if label:
            el["label"] = label[:80]
        elements.append(el)

    # Fill remaining images in tree order
    for el in elements:
        if el["name"] != "image":
            continue
        if el.get("settings", {}).get("image", {}).get("url"):
            continue
        if image_idx < len(asset_urls):
            el.setdefault("settings", {}).setdefault("image", {})["url"] = asset_urls[image_idx]
            image_idx += 1

    return elements


def apply_measurements(elements: list[dict], measurements_text: str) -> None:
    """Best-effort apply measurements prose to section/container."""
    if not measurements_text:
        return
    section = next((e for e in elements if e.get("name") == "section"), None)
    if not section:
        return

    py = re.search(r"\bpy\s+(\d+)px", measurements_text, re.I)
    if py:
        section.setdefault("settings", {}).setdefault("_padding", {})
        if isinstance(section["settings"]["_padding"], dict):
            section["settings"]["_padding"]["top"] = f"{py.group(1)}px"
            section["settings"]["_padding"]["bottom"] = f"{py.group(1)}px"

    bg = re.search(r"bg\s+#([0-9a-fA-F]{3,8})", measurements_text, re.I)
    if bg:
        section.setdefault("settings", {})["_background"] = {"color": {"hex": f"#{bg.group(1)}"}}

    for el in elements:
        sid = el.get("label", "")
        m = re.search(rf"{re.escape(str(sid))}\s+`_widthMax:\s*(\d+)`", measurements_text)
        if m:
            el.setdefault("settings", {})["_widthMax"] = f"{m.group(1)}px"
