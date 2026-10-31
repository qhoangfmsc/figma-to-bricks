"""Bricks element tree from `scripts/data/<slug>/spec.json` (output of analyze_figma_section.py).

Build source stays `figma` (rule 54): every element and setting comes from the Figma REST
spec; per-template scripts only add OVERRIDES for what Figma cannot express (h1, widgets,
copy fixes). Mobile-only Figma blocks are inserted as a hidden-on-desktop branch, which is
the `dual-block` strategy (rule 11) without hand-writing a second tree.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from scripts.lib.bricks_mcp import (
    SECTION_REVIEW_PAGE_SETTINGS,
    generate_css_file,
    get_template,
    set_template_content,
)
from scripts.lib.element_ids import ElementIdFactory, validate_tree_element_ids
from scripts.lib.figma_spec import TABLET, unresolved_asset_ids, walk

ELEMENT_NAMES = {
    "section": "section",
    "container": "container",
    "block": "block",
    "div": "div",
    "heading": "heading",
    "text-basic": "text-basic",
    "button": "button",
    "image": "image",
    "svg": "image",
}
CONTENT_KEYS = {"text", "tag", "image", "link"}
FRAME_KEYS_FOR_CROP = {"_position", "_top", "_left", "_right", "_bottom", "_width", "_height", "_flexShrink",
                       "_flexGrow", "_flexBasis", "_alignSelf", "_widthMax", "_opacity", "_display", "_margin",
                       "_border", "_heightMin", "_aspectRatio",
                       # a Figma rotation/flip applies to the cropped result, not to the oversized image
                       "_transform", "_transformOrigin"}


def image_control(settings: dict[str, Any]) -> dict[str, Any]:
    """`image` element takes `{url}`; `external` is only meaningful on background images."""
    image = settings.get("image")
    if isinstance(image, dict) and "external" in image:
        settings["image"] = {"url": image["url"]}
    return settings


def mobile_only_settings(settings: dict[str, Any], role: str, is_branch_root: bool) -> dict[str, Any]:
    """Settings for a node that exists only in the Figma mobile frame: everything at :tablet_portrait."""
    result = {key: value for key, value in settings.items() if key in CONTENT_KEYS}
    for key, value in settings.items():
        if key in CONTENT_KEYS or ":" in key:
            continue
        result[f"{key}{TABLET}"] = value
    if is_branch_root:
        visible_display = settings.get("_display") or ("block" if role in ("image", "svg", "div") else "flex")
        result["_display"] = "none"
        result[f"_display{TABLET}"] = visible_display
    return result


class SpecTreeBuilder:
    def __init__(self, payload: dict[str, Any], template_id: int, overrides: dict[str, dict], skip: set[str]):
        self.payload = payload
        self.ids = ElementIdFactory(template_id)
        self.overrides = overrides
        self.skip = skip
        self.elements: list[dict[str, Any]] = []
        self.crop_by_node = self._crops()
        self.mobile_inserts = self._mobile_only_inserts()

    def _crops(self) -> dict[str, dict[str, str]]:
        crops: dict[str, dict[str, str]] = {}
        trees = [self.payload["desktop"]] + ([self.payload["mobile"]] if self.payload.get("mobile") else [])
        for tree in trees:
            for node in walk(tree):
                crop = next((paint.get("crop") for paint in node["style"]["fills"] if paint["kind"] == "image"), None)
                if crop and node["role"] == "image":
                    crops[node["id"]] = crop
        return crops

    def _mobile_only_inserts(self) -> dict[str, list[tuple[str | None, dict]]]:
        """desktop parent id → [(desktop sibling to insert after, mobile-only node)]."""
        mobile = self.payload.get("mobile")
        if not mobile:
            return {}
        reverse: dict[str, str] = {}
        for desktop_id, mobile_id in self.payload["pairs"].items():
            reverse.setdefault(mobile_id, desktop_id)
        inserts: dict[str, list[tuple[str | None, dict]]] = {}

        def has_pair(node: dict) -> bool:
            return any(item["id"] in reverse for item in walk(node))

        def visit(node: dict, desktop_anchor: str) -> None:
            anchor = reverse.get(node["id"], desktop_anchor)
            previous: str | None = None
            for child in node["children"]:
                if has_pair(child):
                    visit(child, anchor)
                    previous = reverse.get(child["id"], previous)
                else:
                    inserts.setdefault(anchor, []).append((previous, child))

        visit(mobile, self.payload["desktop"]["id"])
        return inserts

    def add(self, name: str, parent: dict | None, settings: dict[str, Any], label: str) -> dict[str, Any]:
        element = {
            "id": self.ids.next(),
            "name": name,
            "parent": parent["id"] if parent else 0,
            "children": [],
            "settings": settings,
            "label": label,
        }
        if parent:
            parent["children"].append(element["id"])
        self.elements.append(element)
        return element

    def node_settings(self, node: dict, mobile_only: bool, is_branch_root: bool) -> dict[str, Any]:
        if mobile_only:
            settings = mobile_only_settings(dict(node["settings"]), node["role"], is_branch_root)
        else:
            settings = {**node["settings"], **node.get("mobileSettings", {})}
        for key, value in self.overrides.get(node["id"], {}).items():
            if value is None:
                settings.pop(key, None)
            else:
                settings[key] = value
        return image_control(settings)

    def emit(self, node: dict, parent: dict | None, mobile_only: bool = False, is_branch_root: bool = False) -> None:
        if node["id"] in self.skip:
            return
        settings = self.node_settings(node, mobile_only, is_branch_root)
        label = node["name"]
        crop = self.crop_by_node.get(node["id"])
        if crop:
            self.emit_cropped_image(node, parent, settings, crop, label)
            return
        element = self.add(ELEMENT_NAMES[node["role"]], parent, settings, label)
        inserts = [] if mobile_only else self.mobile_inserts.get(node["id"], [])
        child_ids = {child["id"] for child in node["children"]}
        for after, mobile_node in inserts:
            if after is None:
                self.emit(mobile_node, element, mobile_only=True, is_branch_root=True)
        for child in node["children"]:
            self.emit(child, element, mobile_only=mobile_only)
            for after, mobile_node in inserts:
                if after == child["id"]:
                    self.emit(mobile_node, element, mobile_only=True, is_branch_root=True)
        # The preceding mobile sibling may pair with a deeper desktop node (layout regrouped on mobile).
        for after, mobile_node in inserts:
            if after is not None and after not in child_ids:
                self.emit(mobile_node, element, mobile_only=True, is_branch_root=True)

    def emit_cropped_image(self, node: dict, parent: dict | None, settings: dict, crop: dict, label: str) -> None:
        """Figma crops a bitmap inside its frame; Bricks needs a clipping div + oversized absolute image."""
        frame_settings = {key: value for key, value in settings.items() if key.split(":")[0] in FRAME_KEYS_FOR_CROP}
        frame_settings.setdefault("_position", "relative")
        frame_settings["_overflow"] = "hidden"
        if "_height" not in frame_settings:
            frame_settings["_aspectRatio"] = f"{node['box']['width']:g}/{node['box']['height']:g}"
        frame = self.add("div", parent, frame_settings, label)
        self.add(
            "image",
            frame,
            {
                "image": settings.get("image"),
                "_position": "absolute",
                "_top": crop["top"],
                "_left": crop["left"],
                "_width": crop["width"],
                "_height": crop["height"],
                "_widthMax": "none",
                "_objectFit": "fill",
            },
            f"{label} image",
        )


# Figma lays text out with Inter's optical-size axis at its 14 default, while a browser defaults
# to `font-optical-sizing: auto` and picks opsz 32 at heading sizes — every line then measures
# ~4% narrower than the design and wraps at a different word.
SECTION_ROOT_CSS = "%root% { font-optical-sizing: none; }"


def with_root_css(root: dict[str, Any], css: str) -> None:
    settings = root["settings"]
    settings["_cssCustom"] = "\n".join(filter(None, (settings.get("_cssCustom"), css)))


def resolve_root_selector(elements: list[dict[str, Any]]) -> None:
    """Bricks only expands `%root%` for CSS it prints inline; the external post-<id>.min.css that
    the frontend actually loads keeps the placeholder verbatim and the rule never matches."""
    for element in elements:
        css = element["settings"].get("_cssCustom")
        if css:
            element["settings"]["_cssCustom"] = css.replace("%root%", f"#brxe-{element['id']}")


def build_elements(
    spec_path: Path,
    template_id: int,
    *,
    overrides: dict[str, dict] | None = None,
    skip: set[str] | None = None,
) -> list[dict[str, Any]]:
    payload = json.loads(Path(spec_path).read_text())
    builder = SpecTreeBuilder(payload, template_id, overrides or {}, skip or set())
    builder.emit(payload["desktop"], None)
    with_root_css(builder.elements[0], SECTION_ROOT_CSS)
    resolve_root_selector(builder.elements)
    return builder.elements


def check_elements(elements: list[dict[str, Any]]) -> list[str]:
    errors = validate_tree_element_ids(elements)
    missing = unresolved_asset_ids(elements)
    if missing:
        errors.append(f"unresolved <asset:…> on elements {missing} — resolve assets before upload")
    return errors


def upload_or_dump(elements: list[dict[str, Any]], template_id: int, output_json: Path, *, dry_run: bool) -> int:
    """G1-safe write path: validate → dump JSON → upload with section review page settings → read back (rule 18)."""
    errors = check_elements(elements)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    output_json.parent.mkdir(parents=True, exist_ok=True)
    output_json.write_text(json.dumps(elements, ensure_ascii=False, indent=2))
    print(f"Built {len(elements)} elements -> {output_json}")
    if dry_run:
        return 0
    set_template_content(template_id, elements, page_settings=SECTION_REVIEW_PAGE_SETTINGS)
    # Bricks serves styles from post-<id>.min.css; without this the next screenshot still renders
    # the previous build's CSS and G4 scores a stale template.
    generate_css_file(template_id=template_id)
    saved = get_template(template_id).get("elements", [])
    print(f"Saved {len(saved)} elements on template {template_id}")
    return 0 if len(saved) == len(elements) else 1
