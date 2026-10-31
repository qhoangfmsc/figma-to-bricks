"""Deterministic Figma section spec for Bricks planning.

Figma REST node JSON is the source of exact numbers (auto-layout, padding, type, fills).
The MCP design-context output is only used to resolve asset URLs by node id, because
rule 2 requires Figma-served asset URLs instead of WordPress uploads.

Every spec node carries `settings` in real Bricks shapes (see
bricks-skills/references/style-settings.md) so builders can copy them verbatim, and
desktop/mobile pairs are diffed into `:tablet_portrait` overrides (rule 10, 44).
"""
from __future__ import annotations

import hashlib
import html
import json
import math
import re
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

VECTOR_TYPES = {"VECTOR", "BOOLEAN_OPERATION", "STAR", "POLYGON", "REGULAR_POLYGON", "LINE", "ELLIPSE"}
LAYOUT_ROLES = {"section", "container", "block", "div"}
BUTTON_NAME_RE = re.compile(r"(button|btn|\bcta\b|nút)", re.I)
NAV_NAME_RE = re.compile(r"(arrow|prev|next|chevron|navigation|pagination|slider|carousel|dots?\b)", re.I)
BUTTON_MAX_HEIGHT = 72
MOBILE_FRAME_MAX_WIDTH = 768
SIGNIFICANT_AREA = 100 * 100
TABLET = ":tablet_portrait"

# Neutral values used when a desktop key has no mobile counterpart, so the desktop value
# does not leak into the breakpoint (Bricks is desktop-first: bare keys cascade down).
RESET_VALUES: dict[str, Any] = {
    "_position": "relative",
    "_top": "auto",
    "_left": "auto",
    "_right": "auto",
    "_bottom": "auto",
    "_height": "auto",
    "_heightMin": "0",
    "_widthMax": "none",
    "_flexGrow": "0",
    "_flexShrink": "1",
    "_overflow": "visible",
    "_rowGap": "0",
    "_columnGap": "0",
    "_opacity": "1",
}


# ---------------------------------------------------------------- formatting


def num(value: float) -> str:
    rounded = round(float(value), 2)
    return str(int(rounded)) if rounded == int(rounded) else f"{rounded:g}"


def px(value: float) -> str:
    return f"{num(value)}px"


def sides(top: float, right: float, bottom: float, left: float) -> dict[str, str]:
    return {"top": px(top), "right": px(right), "bottom": px(bottom), "left": px(left)}


def css_shorthand(values: tuple[float, float, float, float]) -> str:
    top, right, bottom, left = (num(v) for v in values)
    if top == right == bottom == left:
        return top
    if top == bottom and right == left:
        return f"{top}/{right}"
    return f"{top}/{right}/{bottom}/{left}"


def color_css(color: dict[str, float], opacity: float = 1.0) -> str:
    red, green, blue = (round(color.get(channel, 0) * 255) for channel in ("r", "g", "b"))
    alpha = round(color.get("a", 1) * opacity, 3)
    if alpha >= 0.999:
        return f"#{red:02x}{green:02x}{blue:02x}"
    return f"rgba({red}, {green}, {blue}, {alpha:g})"


def bricks_color(css: str) -> dict[str, str]:
    return {"hex": css} if css.startswith("#") else {"rgb": css}


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", "", text or "").lower()


# ---------------------------------------------------------------- paints / effects


def visible(items: list[dict] | None) -> list[dict]:
    return [item for item in items or [] if item.get("visible", True)]


def gradient_angle(paint: dict, width: float, height: float) -> float:
    handles = paint.get("gradientHandlePositions") or []
    if len(handles) < 2:
        return 180.0
    dx = (handles[1]["x"] - handles[0]["x"]) * (width or 1)
    dy = (handles[1]["y"] - handles[0]["y"]) * (height or 1)
    return round((math.degrees(math.atan2(dx, -dy)) + 360) % 360, 1)


def describe_paint(paint: dict, width: float, height: float) -> dict[str, Any]:
    paint_opacity = paint.get("opacity", 1.0)
    kind = paint.get("type", "")
    if kind == "SOLID":
        return {"kind": "solid", "css": color_css(paint["color"], paint_opacity)}
    if kind.startswith("GRADIENT_"):
        stops = [
            {"css": color_css(stop["color"], paint_opacity), "stop": num(stop.get("position", 0) * 100)}
            for stop in paint.get("gradientStops", [])
        ]
        gradient_type = {"GRADIENT_LINEAR": "linear", "GRADIENT_RADIAL": "radial", "GRADIENT_ANGULAR": "conic"}.get(
            kind, "radial"
        )
        return {
            "kind": "gradient",
            "gradientType": gradient_type,
            "angle": gradient_angle(paint, width, height),
            "stops": stops,
        }
    if kind == "IMAGE":
        size = {"FILL": "cover", "FIT": "contain", "TILE": "auto", "STRETCH": "cover"}.get(paint.get("scaleMode"), "cover")
        return {
            "kind": "image",
            "imageRef": paint.get("imageRef"),
            "size": size,
            "opacity": paint_opacity,
            "crop": image_crop(paint),
        }
    return {"kind": kind.lower()}


def image_crop(paint: dict) -> dict[str, str] | None:
    """Crop of a STRETCH image fill as CSS percentages of the frame (img width/height/left/top).

    Figma's imageTransform maps frame space → image space: x_img = a·x + c, so the image
    spans 1/a of the frame and starts at -c/a.
    """
    transform = paint.get("imageTransform")
    if paint.get("scaleMode") != "STRETCH" or not transform:
        return None
    (scale_x, skew_x, offset_x), (skew_y, scale_y, offset_y) = transform
    if skew_x or skew_y or not scale_x or not scale_y:
        return None
    # Sub-1% crops are export rounding in Figma, visually identical to object-fit: cover.
    if abs(scale_x - 1) < 0.01 and abs(scale_y - 1) < 0.01 and abs(offset_x) < 0.01 and abs(offset_y) < 0.01:
        return None
    return {
        "width": f"{num(100 / scale_x)}%",
        "height": f"{num(100 / scale_y)}%",
        "left": f"{num(-offset_x / scale_x * 100)}%",
        "top": f"{num(-offset_y / scale_y * 100)}%",
    }


def bricks_gradient(paint: dict[str, Any], apply_to: str = "background") -> dict[str, Any]:
    return {
        "applyTo": apply_to,
        "gradientType": paint["gradientType"],
        "angle": num(paint["angle"]),
        "colors": [{"color": bricks_color(stop["css"]), "stop": stop["stop"]} for stop in paint["stops"]],
    }


def css_gradient(paint: dict[str, Any]) -> str:
    stops = ", ".join(f"{stop['css']} {stop['stop']}%" for stop in paint["stops"])
    if paint["gradientType"] == "linear":
        return f"linear-gradient({num(paint['angle'])}deg, {stops})"
    if paint["gradientType"] == "conic":
        return f"conic-gradient(from {num(paint['angle'])}deg, {stops})"
    return f"radial-gradient(circle at center, {stops})"


def gradient_border_css(paint: dict[str, Any], width: float) -> str:
    return (
        '%root%::before { content: ""; position: absolute; inset: 0; border-radius: inherit; '
        f"padding: {px(width)}; background: {css_gradient(paint)}; "
        "-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); "
        "-webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; }"
    )


def paint_label(paint: dict[str, Any]) -> str:
    if paint["kind"] == "solid":
        return paint["css"]
    if paint["kind"] == "gradient":
        stops = "→".join(stop["css"] for stop in paint["stops"])
        return f"{paint['gradientType']}-gradient {num(paint['angle'])}° {stops}"
    if paint["kind"] == "image":
        crop = paint.get("crop")
        crop_label = f" crop w{crop['width']} h{crop['height']} l{crop['left']} t{crop['top']}" if crop else ""
        return f"image({paint['size']}{crop_label})"
    return paint["kind"]


# ---------------------------------------------------------------- extraction


def node_box(node: dict) -> dict[str, float]:
    return node.get("absoluteBoundingBox") or {"x": 0, "y": 0, "width": 0, "height": 0}


def all_descendants(node: dict):
    for child in node.get("children") or []:
        if child.get("visible", True):
            yield child
            yield from all_descendants(child)


def is_pure_graphic(node: dict) -> bool:
    """Vector-only subtree (icon, logo, illustration): MCP exports it as one asset."""
    if node.get("type") in VECTOR_TYPES:
        return True
    if node.get("type") not in ("GROUP", "FRAME", "INSTANCE", "COMPONENT", "BOOLEAN_OPERATION"):
        return False
    descendants = list(all_descendants(node))
    if not descendants:
        return False
    for child in descendants:
        if child.get("type") == "TEXT":
            return False
        if any(paint.get("type") == "IMAGE" for paint in visible(child.get("fills"))):
            return False
        if child.get("layoutMode") not in (None, "NONE"):
            return False
    return True


def extract_text(node: dict) -> dict[str, Any]:
    style = node.get("style") or {}
    box = node_box(node)
    fills = [describe_paint(paint, box["width"], box["height"]) for paint in visible(node.get("fills"))]
    text = {
        "characters": node.get("characters", ""),
        "fontFamily": style.get("fontFamily"),
        "fontWeight": int(style.get("fontWeight", 400)),
        "fontSize": style.get("fontSize"),
        "lineHeight": style.get("lineHeightPx"),
        "letterSpacing": style.get("letterSpacing", 0),
        "align": style.get("textAlignHorizontal", "LEFT"),
        "case": style.get("textCase"),
        "decoration": style.get("textDecoration"),
        "autoResize": style.get("textAutoResize"),
        "fill": fills[0] if fills else None,
        "runs": [],
    }
    overrides = node.get("characterStyleOverrides") or []
    table = node.get("styleOverrideTable") or {}
    if overrides and table:
        characters = text["characters"]
        start = 0
        for index in range(1, len(overrides) + 1):
            if index == len(overrides) or overrides[index] != overrides[start]:
                override = table.get(str(overrides[start]))
                if override:
                    run_fills = [describe_paint(p, box["width"], box["height"]) for p in visible(override.get("fills"))]
                    text["runs"].append(
                        {
                            "start": start,
                            "end": index,
                            "text": characters[start:index],
                            "fontWeight": override.get("fontWeight"),
                            "fontSize": override.get("fontSize"),
                            "fill": run_fills[0] if run_fills else None,
                        }
                    )
                start = index
    return text


def extract_layout(node: dict) -> dict[str, Any]:
    mode = node.get("layoutMode", "NONE")
    layout: dict[str, Any] = {
        "mode": {"HORIZONTAL": "row", "VERTICAL": "column", "GRID": "grid"}.get(mode, "none"),
        "gap": node.get("itemSpacing", 0),
        "crossGap": node.get("counterAxisSpacing", 0),
        "padding": (
            node.get("paddingTop", 0),
            node.get("paddingRight", 0),
            node.get("paddingBottom", 0),
            node.get("paddingLeft", 0),
        ),
        "justify": node.get("primaryAxisAlignItems", "MIN"),
        "align": node.get("counterAxisAlignItems", "MIN"),
        "wrap": node.get("layoutWrap") == "WRAP",
        "columns": 0,
        "minWidth": node.get("minWidth"),
        "maxWidth": node.get("maxWidth"),
    }
    if mode == "GRID":
        layout["columns"] = node.get("gridColumnCount", 0)
        layout["gap"] = node.get("gridRowGap", 0)
        layout["crossGap"] = node.get("gridColumnGap", 0)
    return layout


def extract_style(node: dict) -> dict[str, Any]:
    box = node_box(node)
    strokes = [describe_paint(paint, box["width"], box["height"]) for paint in visible(node.get("strokes"))]
    radii = node.get("rectangleCornerRadii") or ([node["cornerRadius"]] * 4 if node.get("cornerRadius") else None)
    effects = []
    for effect in visible(node.get("effects")):
        entry = {"type": effect.get("type"), "radius": effect.get("radius", 0)}
        if effect.get("type") in ("DROP_SHADOW", "INNER_SHADOW"):
            entry.update(
                offsetX=effect.get("offset", {}).get("x", 0),
                offsetY=effect.get("offset", {}).get("y", 0),
                spread=effect.get("spread", 0),
                css=color_css(effect.get("color", {})),
            )
        effects.append(entry)
    weights = node.get("individualStrokeWeights")
    stroke_weight = (
        (weights["top"], weights["right"], weights["bottom"], weights["left"])
        if weights
        else (node.get("strokeWeight", 0),) * 4
    )
    return {
        "fills": [describe_paint(paint, box["width"], box["height"]) for paint in visible(node.get("fills"))],
        "stroke": strokes[0] if strokes else None,
        "strokeWeight": stroke_weight,
        "strokeAlign": node.get("strokeAlign", "INSIDE"),
        "radius": tuple(radii) if radii else None,
        "effects": effects,
        "opacity": node.get("opacity", 1.0),
        "clips": bool(node.get("clipsContent")),
        "blend": node.get("blendMode") if node.get("blendMode") not in (None, "PASS_THROUGH", "NORMAL") else None,
    }


def infer_role(node: dict, depth: int, text: dict | None, style: dict, layout: dict) -> str:
    if depth == 0:
        return "section"
    if node.get("type") == "TEXT":
        size = text.get("fontSize") or 0
        weight = text.get("fontWeight") or 400
        return "heading" if size >= 24 or (weight >= 600 and size >= 20) else "text-basic"
    if is_pure_graphic(node):
        return "svg"
    children = [child for child in node.get("children") or [] if child.get("visible", True)]
    has_image_fill = any(paint["kind"] == "image" for paint in style["fills"])
    if has_image_fill and not children:
        return "image"
    descendant_texts = [child for child in all_descendants(node) if child.get("type") == "TEXT"]
    box = node_box(node)
    looks_like_button = (
        len(descendant_texts) == 1
        and box["height"] <= BUTTON_MAX_HEIGHT
        and (style["fills"] or style["stroke"])
        and style["radius"]
        and layout["mode"] in ("row", "column")
    )
    if BUTTON_NAME_RE.search(node.get("name", "")) and len(descendant_texts) == 1 or looks_like_button:
        return "button"
    return "block" if layout["mode"] != "none" else "div"


def extract(node: dict, root_box: dict, parent: dict | None = None, depth: int = 0) -> dict[str, Any] | None:
    if not node.get("visible", True):
        return None
    box = node_box(node)
    parent_box = parent["box"] if parent else root_box
    text = extract_text(node) if node.get("type") == "TEXT" else None
    layout = extract_layout(node)
    style = extract_style(node)
    spec: dict[str, Any] = {
        "id": node["id"],
        "name": node.get("name", ""),
        "type": node.get("type"),
        "depth": depth,
        "box": {
            "x": box["x"] - root_box["x"],
            "y": box["y"] - root_box["y"],
            "width": box["width"],
            "height": box["height"],
        },
        "relX": box["x"] - (parent_box["x"] + (root_box["x"] if parent else 0)),
        "relY": box["y"] - (parent_box["y"] + (root_box["y"] if parent else 0)),
        "sizingH": node.get("layoutSizingHorizontal"),
        "sizingV": node.get("layoutSizingVertical"),
        "absolute": node.get("layoutPositioning") == "ABSOLUTE",
        "text": text,
        "layout": layout,
        "style": style,
        "children": [],
        "asset": None,
    }
    spec["role"] = infer_role(node, depth, text, style, layout)
    if spec["role"] in ("svg", "image"):
        spec["graphicIds"] = [child["id"] for child in all_descendants(node)]
    if spec["role"] == "svg":
        spec["graphicKey"] = graphic_key(node)
    if parent is not None and parent["layout"]["mode"] == "none":
        spec["absolute"] = True
    if spec["role"] not in ("svg", "image", "button"):
        for child in node.get("children") or []:
            child_spec = extract(child, root_box, spec, depth + 1)
            if child_spec:
                spec["children"].append(child_spec)
    elif spec["role"] == "button":
        label = next((c for c in all_descendants(node) if c.get("type") == "TEXT"), None)
        spec["text"] = extract_text(label) if label else None
        adopt_button_skin(spec, node)
    return spec


def _paint_identity(paint: dict) -> dict:
    return {key: paint.get(key) for key in ("type", "color", "opacity", "imageRef", "gradientStops")}


def _layer_appearance(node: dict) -> dict:
    box = node_box(node)
    return {
        "type": node.get("type"),
        "component": node.get("componentId"),
        "width": round(box["width"], 1),
        "height": round(box["height"], 1),
        "fills": [_paint_identity(paint) for paint in visible(node.get("fills"))],
        "strokes": [_paint_identity(paint) for paint in visible(node.get("strokes"))],
        "strokeWeight": node.get("strokeWeight"),
        "opacity": node.get("opacity", 1),
    }


def graphic_key(node: dict) -> str | None:
    """Identity under which one resolved icon URL may be reused for another node, or None.

    REST nodes carry no vector paths, so two different icons can share name, size and
    colour. Only layers that come from the same component master layer are guaranteed to
    share geometry: an INSTANCE's `componentId`, or the master layer id after the last `;`
    of an instance-sublayer id (`I<instance>;<master layer>`). Size, paints and opacity of
    the whole subtree are added so overridden colours or scaled copies never match.
    """
    if node.get("type") == "INSTANCE" and node.get("componentId"):
        origin = f"component:{node['componentId']}"
    elif node["id"].startswith("I") and ";" in node["id"]:
        origin = f"master:{node['id'].rsplit(';', 1)[1]}"
    else:
        return None
    appearance = [_layer_appearance(layer) for layer in (node, *all_descendants(node))]
    digest = hashlib.sha1(json.dumps(appearance, sort_keys=True).encode()).hexdigest()[:12]
    return f"{origin}:{digest}"


def adopt_button_skin(spec: dict, node: dict) -> None:
    """Button instances often keep fill/radius/padding on an inner frame; Bricks `button` is one element."""
    frames = [node] + [child for child in all_descendants(node) if child.get("type") != "TEXT"]
    if not spec["style"]["fills"] and not spec["style"]["stroke"]:
        skin = next((frame for frame in frames if visible(frame.get("fills")) or visible(frame.get("strokes"))), None)
        if skin is not None:
            skin_style = extract_style(skin)
            for key in ("fills", "stroke", "strokeWeight", "radius", "effects"):
                spec["style"][key] = skin_style[key]
    if not any(spec["layout"]["padding"]):
        padded = next((frame for frame in frames if any(extract_layout(frame)["padding"])), None)
        if padded is not None:
            spec["layout"]["padding"] = extract_layout(padded)["padding"]


def build_spec(root_node: dict) -> dict[str, Any]:
    root_box = node_box(root_node)
    spec = extract(root_node, root_box)
    collapse_wrappers(spec)
    assign_container(spec)
    mark_scroll_rows(spec, is_mobile_frame=root_box["width"] < MOBILE_FRAME_MAX_WIDTH)
    return spec


def is_plain_wrapper(node: dict) -> bool:
    """Single-child frame with no visual style — Figma auto-layout noise, not a Bricks element."""
    style = node["style"]
    return (
        node["role"] in ("block", "div")
        and node["depth"] > 1
        and len(node["children"]) == 1
        and not node["children"][0]["absolute"]
        and not any(node["layout"]["padding"])
        and not style["fills"]
        and not style["stroke"]
        and not style["effects"]
        and not (style["radius"] and any(style["radius"]))
        and style["opacity"] >= 0.999
    )


def collapse_wrappers(node: dict) -> None:
    children: list[dict] = []
    for child in node["children"]:
        collapse_wrappers(child)
        while is_plain_wrapper(child):
            inner = child["children"][0]
            # The wrapper's footprint in its parent is what the layout needs; keep it on the survivor.
            for key in ("box", "relX", "relY", "sizingH", "sizingV", "absolute", "depth"):
                inner[key] = child[key]
            inner["collapsed"] = inner.get("collapsed", []) + [child["id"]]
            child = inner
        children.append(child)
    node["children"] = children


def assign_container(root: dict) -> None:
    """Pick the centered content wrapper under the section as Bricks `container`."""
    candidates = [child for child in root["children"] if not child["absolute"] and child["role"] in ("block", "div")]
    if len(candidates) == 1:
        candidates[0]["role"] = "container"
        return
    root["containerHint"] = root["box"]["width"] - root["layout"]["padding"][1] - root["layout"]["padding"][3]


def flow_children(spec: dict) -> list[dict]:
    return [child for child in spec["children"] if not child["absolute"]]


def mark_scroll_rows(spec: dict, is_mobile_frame: bool) -> None:
    """Row without wrap whose children overflow the frame.

    On a mobile frame that is a swipe/scroll row (`overflow: auto`); on desktop it is a
    clipped strip such as a logo marquee (`overflow: hidden`) — a scrollbar would be wrong.
    """
    layout = spec["layout"]
    children = flow_children(spec)
    if layout["mode"] == "row" and not layout["wrap"] and len(children) >= 2:
        inner = spec["box"]["width"] - layout["padding"][1] - layout["padding"][3]
        gap = 0 if layout["justify"] == "SPACE_BETWEEN" else layout["gap"]
        used = sum(child["box"]["width"] for child in children) + gap * (len(children) - 1)
        if used > inner + 1:
            spec["scrollRow"] = True
            spec["overflowMode"] = "auto" if is_mobile_frame else "hidden"
    if layout["mode"] == "row" and layout["wrap"] and children:
        first_y = children[0]["box"]["y"]
        layout["columns"] = sum(1 for child in children if abs(child["box"]["y"] - first_y) < 1)
    for child in spec["children"]:
        mark_scroll_rows(child, is_mobile_frame)


def walk(spec: dict):
    yield spec
    for child in spec["children"]:
        yield from walk(child)


def coarse_role(node: dict) -> str:
    return "box" if node["role"] in ("block", "div", "image") else node["role"]


def structure_signature(node: dict, with_leaf_names: bool = True) -> tuple:
    leaf_name = node["name"] if with_leaf_names and not node["children"] and not node["text"] else ""
    text = node["text"]
    text_style = (text["fontSize"], text["fontWeight"], paint_label(text["fill"]) if text["fill"] else "") if text else ()
    return (
        coarse_role(node),
        node["layout"]["mode"],
        leaf_name,
        text_style,
        tuple(structure_signature(child, with_leaf_names) for child in node["children"]),
    )


def grouped_children(node: dict, with_leaf_names: bool = True) -> list[list[dict]]:
    """Consecutive siblings with the same structure collapse into one group (cards, logos, features)."""
    groups: list[list[dict]] = []
    for child in node["children"]:
        signature = structure_signature(child, with_leaf_names)
        if groups and structure_signature(groups[-1][0], with_leaf_names) == signature:
            groups[-1].append(child)
        else:
            groups.append([child])
    return groups


def repeated_ids(spec: dict) -> set[str]:
    ids: set[str] = set()
    for node in walk(spec):
        for group in grouped_children(node, with_leaf_names=False):
            if len(group) > 1:
                for item in group:
                    ids.update(descendant["id"] for descendant in walk(item))
    return ids


# ---------------------------------------------------------------- Bricks settings


def typography(text: dict) -> dict[str, Any]:
    result: dict[str, Any] = {
        "font-family": text["fontFamily"],
        "font-size": px(text["fontSize"]),
        "line-height": px(text["lineHeight"]),
        "font-weight": str(text["fontWeight"]),
    }
    if text["fill"] and text["fill"]["kind"] == "solid":
        result["color"] = bricks_color(text["fill"]["css"])
    align = {"CENTER": "center", "RIGHT": "right", "JUSTIFIED": "justify"}.get(text["align"])
    if align:
        result["text-align"] = align
    case = {"UPPER": "uppercase", "LOWER": "lowercase", "TITLE": "capitalize"}.get(text["case"] or "")
    if case:
        result["text-transform"] = case
    if text["letterSpacing"]:
        result["letter-spacing"] = px(text["letterSpacing"])
    if text["decoration"] in ("UNDERLINE", "STRIKETHROUGH"):
        result["text-decoration"] = "underline" if text["decoration"] == "UNDERLINE" else "line-through"
    return result


def sizing_settings(spec: dict, parent: dict | None) -> dict[str, Any]:
    settings: dict[str, Any] = {}
    if parent is None or spec["role"] == "container":
        if spec["role"] == "container":
            settings["_width"] = "100%"
            settings["_widthMax"] = px(spec["box"]["width"])
        return settings
    width, height = spec["box"]["width"], spec["box"]["height"]
    if spec["absolute"]:
        # Figma measures an absolute child from the frame edge; CSS resolves top/left against the
        # parent's padding box, which an INSIDE stroke (a CSS border) pushes in by its own width.
        edge_top, _, _, edge_left = border_inset(parent)
        settings.update(
            _position="absolute",
            _top=px(spec["relY"] - edge_top),
            _left=px(spec["relX"] - edge_left),
        )
        settings.update(_width=px(width), _height=px(height))
        return settings
    parent_mode = parent["layout"]["mode"]
    if parent_mode == "row":
        if spec["sizingH"] == "FILL":
            settings["_flexGrow"] = "1"
            settings["_flexBasis"] = "0"
        elif spec["sizingH"] == "FIXED":
            settings["_width"] = px(width)
            settings["_flexShrink"] = "0"
        elif spec["role"] in ("block", "button"):
            settings["_width"] = "auto"
        if spec["sizingV"] == "FILL":
            settings["_alignSelf"] = "stretch"
    else:
        if spec["sizingH"] == "FILL":
            settings["_width"] = "100%"
        elif spec["sizingH"] == "FIXED":
            settings["_width"] = px(width)
        elif spec["role"] in ("block", "button"):
            settings["_width"] = "auto"
        if spec["sizingV"] == "FILL":
            settings["_flexGrow"] = "1"
    if parent.get("scrollRow"):
        settings["_flexShrink"] = "0"
    has_flow_children = bool(flow_children(spec))
    if spec["sizingV"] == "FIXED" and spec["role"] != "heading" and spec["role"] != "text-basic":
        settings["_heightMin" if has_flow_children else "_height"] = px(height)
    if spec["layout"]["maxWidth"]:
        settings["_widthMax"] = px(spec["layout"]["maxWidth"])
    if spec["text"] and spec["text"]["autoResize"] in ("HEIGHT", "NONE") and spec["sizingH"] == "FIXED":
        settings.pop("_width", None)
        settings["_widthMax"] = px(width)
    return settings


def border_inset(spec: dict | None) -> tuple[float, float, float, float]:
    """Width of the CSS border a node's INSIDE Figma stroke becomes (top, right, bottom, left)."""
    if not spec:
        return (0.0, 0.0, 0.0, 0.0)
    style = spec["style"]
    if style["stroke"] and style["stroke"]["kind"] == "solid" and style["strokeAlign"] == "INSIDE":
        return style["strokeWeight"]
    return (0.0, 0.0, 0.0, 0.0)


def css_padding(spec: dict) -> dict[str, str]:
    """Figma paints an INSIDE stroke over the padding, so the frame measures
    `padding` from its edge; CSS `border` adds to it. Give the border its pixel back,
    otherwise every bordered frame is 2px taller/wider than the Figma node."""
    top, right, bottom, left = spec["layout"]["padding"]
    inset = border_inset(spec)
    return sides(*(max(0.0, pad - edge) for pad, edge in zip((top, right, bottom, left), inset)))


def layout_settings(spec: dict) -> dict[str, Any]:
    layout = spec["layout"]
    settings: dict[str, Any] = {}
    if spec["role"] == "button" and any(layout["padding"]):
        settings["_padding"] = css_padding(spec)
    if spec["role"] not in LAYOUT_ROLES:
        return settings
    mode = layout["mode"]
    is_grid = mode == "grid" or (layout["wrap"] and layout["columns"] > 1)
    if is_grid:
        settings["_display"] = "grid"
        settings["_gridTemplateColumns"] = f"repeat({layout['columns']}, minmax(0, 1fr))"
        row_gap = layout["crossGap"] if mode != "grid" else layout["gap"]
        column_gap = layout["gap"] if mode != "grid" else layout["crossGap"]
        settings["_gridGap"] = px(row_gap) if row_gap == column_gap else f"{px(row_gap)} {px(column_gap)}"
    elif mode in ("row", "column"):
        settings["_display"] = "flex"
        settings["_direction"] = mode
        if layout["wrap"]:
            settings["_flexWrap"] = "wrap"
        if layout["justify"] != "SPACE_BETWEEN" and layout["gap"]:
            settings["_columnGap" if mode == "row" else "_rowGap"] = px(layout["gap"])
        if layout["wrap"] and layout["crossGap"]:
            settings["_rowGap"] = px(layout["crossGap"])
        justify = {"CENTER": "center", "MAX": "flex-end", "SPACE_BETWEEN": "space-between"}.get(layout["justify"])
        if justify:
            settings["_justifyContent"] = justify
        align = {"CENTER": "center", "MAX": "flex-end", "BASELINE": "baseline"}.get(layout["align"], "flex-start")
        settings["_alignItems"] = align
        if spec.get("scrollRow"):
            settings["_flexWrap"] = "nowrap"
            settings["_overflow"] = spec["overflowMode"]
    if any(layout["padding"]):
        settings["_padding"] = css_padding(spec)
    if any(child["absolute"] for child in spec["children"]):
        settings["_position"] = "relative"
    return settings


def style_settings(spec: dict) -> dict[str, Any]:
    style = spec["style"]
    settings: dict[str, Any] = {}
    custom_css: list[str] = []
    fills = style["fills"]
    is_text = spec["role"] in ("heading", "text-basic")
    if fills and not is_text and spec["role"] not in ("svg",):
        solid = next((paint for paint in fills if paint["kind"] == "solid"), None)
        image = next((paint for paint in fills if paint["kind"] == "image"), None)
        gradient = next((paint for paint in fills if paint["kind"] == "gradient"), None)
        if spec["role"] == "image":
            settings["image"] = {"url": spec["asset"] or f"<asset:{spec['id']}>", "external": True}
            settings["_objectFit"] = image["size"] if image else "cover"
            if image and image["opacity"] < 0.999:
                settings["_opacity"] = num(image["opacity"] * style["opacity"])
            if image and image.get("crop"):
                crop = image["crop"]
                spec.setdefault("notes", []).append(
                    f"ảnh crop: img width {crop['width']} · height {crop['height']} · left {crop['left']} · "
                    f"top {crop['top']} trong khung `_overflow hidden` (spec_builder tự dựng div + image absolute — đã sinh)"
                )
        else:
            background: dict[str, Any] = {}
            if solid:
                background["color"] = bricks_color(solid["css"])
            if image:
                background.update(
                    image={"url": spec["asset"] or f"<asset:{spec['id']}>", "external": True},
                    size=image["size"],
                    position="center center",
                    repeat="no-repeat",
                )
            if background:
                settings["_background"] = background
            if gradient:
                settings["_gradient"] = bricks_gradient(gradient)
    # Vector assets already carry their own strokes in the exported SVG.
    if style["stroke"] and any(style["strokeWeight"]) and spec["role"] != "svg":
        if style["stroke"]["kind"] == "solid":
            settings["_border"] = {
                "width": sides(*style["strokeWeight"]),
                "style": "solid",
                "color": bricks_color(style["stroke"]["css"]),
            }
        elif style["stroke"]["kind"] == "gradient":
            # A colorless Bricks border renders in currentColor; a masked ::before ring keeps
            # the gradient and the radius (border-radius: inherit) without touching layout.
            custom_css.append(gradient_border_css(style["stroke"], style["strokeWeight"][0]))
            spec.setdefault("notes", []).append(
                f"stroke {num(style['strokeWeight'][0])}px {paint_label(style['stroke'])} → `_cssCustom` ::before (đã sinh)"
            )
    if style["radius"] and any(style["radius"]):
        top_left, top_right, bottom_right, bottom_left = style["radius"]
        settings.setdefault("_border", {})["radius"] = sides(top_left, top_right, bottom_right, bottom_left)
    for effect in style["effects"]:
        if effect["type"] in ("DROP_SHADOW", "INNER_SHADOW"):
            shadow = {
                "values": {
                    "offsetX": num(effect["offsetX"]),
                    "offsetY": num(effect["offsetY"]),
                    "blur": num(effect["radius"]),
                    "spread": num(effect["spread"]),
                },
                "color": bricks_color(effect["css"]),
            }
            if effect["type"] == "INNER_SHADOW":
                shadow["inset"] = True
            settings["_boxShadow"] = shadow
        elif effect["type"] == "LAYER_BLUR":
            settings["_cssFilters"] = {"blur": num(effect["radius"] / 2)}
        elif effect["type"] == "BACKGROUND_BLUR":
            blur = num(effect["radius"] / 2)
            custom_css.append(f"%root% {{ -webkit-backdrop-filter: blur({blur}px); backdrop-filter: blur({blur}px); }}")
    if custom_css:
        settings["_cssCustom"] = "\n".join(custom_css)
    if style["opacity"] < 0.999:
        settings.setdefault("_opacity", num(style["opacity"]))
    if style["blend"]:
        settings["_mixBlendMode"] = style["blend"].lower().replace("_", "-")
    needs_clip = style["radius"] or any(child["absolute"] for child in spec["children"])
    if style["clips"] and needs_clip and spec["role"] in LAYOUT_ROLES and "_overflow" not in settings:
        settings["_overflow"] = "hidden"
    return settings


def run_style(run: dict[str, Any]) -> str:
    rules: list[str] = []
    fill = run.get("fill")
    if fill and fill["kind"] == "solid":
        # Explicit fill color also beats an inherited gradient-text `-webkit-text-fill-color: transparent`.
        rules += [f"color:{fill['css']}", f"-webkit-text-fill-color:{fill['css']}"]
    elif fill and fill["kind"] == "gradient":
        rules += [
            f"background-image:{css_gradient(fill)}",
            "-webkit-background-clip:text",
            "background-clip:text",
            "-webkit-text-fill-color:transparent",
        ]
    if run.get("fontWeight"):
        rules.append(f"font-weight:{int(run['fontWeight'])}")
    if run.get("fontSize"):
        rules.append(f"font-size:{px(run['fontSize'])}")
    return ";".join(rules)


def text_html(text: dict[str, Any]) -> str:
    """Figma characters → Bricks text: style runs as inline spans, hard line breaks as <br>."""
    characters = text["characters"]
    parts: list[str] = []
    cursor = 0
    for run in sorted(text["runs"], key=lambda item: item.get("start", 0)):
        if "start" not in run:
            continue
        parts.append(html.escape(characters[cursor : run["start"]], quote=False))
        style = run_style(run)
        segment = html.escape(characters[run["start"] : run["end"]], quote=False)
        parts.append(f'<span style="{style}">{segment}</span>' if style else segment)
        cursor = run["end"]
    parts.append(html.escape(characters[cursor:], quote=False))
    return "".join(parts).replace("\u2028", "\n").replace("\n", "<br>")


def text_settings(spec: dict) -> dict[str, Any]:
    text = spec["text"]
    if not text:
        return {}
    settings: dict[str, Any] = {"text": text_html(text)}
    if spec["role"] == "heading":
        settings["tag"] = "h2"
    if spec["role"] in ("heading", "text-basic"):
        settings["_margin"] = sides(0, 0, 0, 0)
    settings["_typography"] = typography(text)
    if text["fill"] and text["fill"]["kind"] == "gradient":
        settings["_gradient"] = bricks_gradient(text["fill"], apply_to="text")
    return settings


def compute_settings(spec: dict, parent: dict | None = None) -> None:
    settings: dict[str, Any] = {}
    settings.update(sizing_settings(spec, parent))
    settings.update(layout_settings(spec))
    settings.update(style_settings(spec))
    settings.update(text_settings(spec))
    if "::before" in settings.get("_cssCustom", ""):
        # The ::before ring is absolute; keep an absolute node absolute, otherwise anchor it.
        settings.setdefault("_position", "relative")
    if spec["role"] == "svg":
        settings["image"] = {"url": spec["asset"] or f"<asset:{spec['id']}>", "external": True}
    spec["settings"] = settings
    for child in spec["children"]:
        compute_settings(child, spec)
    if parent is None:
        assign_heading_tags(spec)


def assign_heading_tags(spec: dict) -> None:
    """Larger heading size → higher level; h1 is a page-level decision left to the plan (rule 8)."""
    headings = [node for node in walk(spec) if node["role"] == "heading"]
    sizes = sorted({node["text"]["fontSize"] for node in headings}, reverse=True)
    for node in headings:
        node["settings"]["tag"] = f"h{min(2 + sizes.index(node['text']['fontSize']), 6)}"


# ---------------------------------------------------------------- assets


ASSET_PREFIX_RE = re.compile(r'const assetPathPrefix\s*=\s*"([^"]+)"')
ASSET_CONST_RE = re.compile(r'const (\w+)\s*=\s*(?:`\$\{assetPathPrefix\}/([^`]+)`|"(https?://[^"]+)")')
NODE_ID_RE = re.compile(r'data-node-id="([^"]+)"')
JSX_TAG_START_RE = re.compile(r"<(/?)([A-Za-z][\w.:-]*)")
FIGMA_MCP_ASSET_RE = re.compile(r"^https://www\.figma\.com/api/mcp/asset/[0-9a-f-]{36}(?:/[\w.-]+)?$")


def _jsx_tag_end(source: str, start: int) -> int:
    """Index of the `>` closing the tag opened at `start`, skipping quoted and `{…}` attribute values."""
    depth = 0
    quote: str | None = None
    index = start + 1
    while index < len(source):
        char = source[index]
        if quote:
            if char == "\\":
                index += 2
                continue
            if char == quote:
                quote = None
        elif char in "\"'`":
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
        elif char == ">" and depth == 0:
            return index
        index += 1
    return len(source) - 1


def parse_design_context_assets(source: str) -> dict[str, str]:
    """Map Figma node id → asset URL from a saved `get_design_context` response.

    The owner of an asset usage is the `data-node-id` of the tag that uses it, else of its
    nearest open ancestor. Tracking open/close tags matters: the closest *preceding*
    `data-node-id` is often a sibling that already closed, which assigned the wrong node.
    The first asset seen per node wins (a frame's own fill precedes its children's).
    """
    prefix_match = ASSET_PREFIX_RE.search(source)
    prefix = prefix_match.group(1) if prefix_match else ""
    variables: dict[str, str] = {}
    for match in ASSET_CONST_RE.finditer(source):
        name, relative, absolute = match.groups()
        if name == "assetPathPrefix":
            continue
        variables[name] = absolute or f"{prefix}/{relative}"
    assets: dict[str, str] = {}
    if not variables:
        return assets
    usage_re = re.compile(r"[{$]\{?(" + "|".join(map(re.escape, variables)) + r")\}")
    usages = [(match.start(), match.group(1)) for match in usage_re.finditer(source)]
    usage_index = 0
    open_tags: list[tuple[str, str | None]] = []

    def ancestor_id() -> str | None:
        return next((node_id for _, node_id in reversed(open_tags) if node_id), None)

    def assign(owner: str | None, variable: str) -> None:
        if owner and owner not in assets:
            assets[owner] = variables[variable]

    scan_from = 0
    for tag in JSX_TAG_START_RE.finditer(source):
        if tag.start() < scan_from:
            continue
        end = _jsx_tag_end(source, tag.start())
        while usage_index < len(usages) and usages[usage_index][0] < tag.start():
            assign(ancestor_id(), usages[usage_index][1])
            usage_index += 1
        is_closing, name = tag.group(1) == "/", tag.group(2)
        if is_closing:
            for depth in range(len(open_tags) - 1, -1, -1):
                if open_tags[depth][0] == name:
                    del open_tags[depth:]
                    break
        else:
            own_id_match = NODE_ID_RE.search(source, tag.start(), end)
            own_id = own_id_match.group(1) if own_id_match else None
            while usage_index < len(usages) and usages[usage_index][0] <= end:
                assign(own_id or ancestor_id(), usages[usage_index][1])
                usage_index += 1
            if source[end - 1] != "/":
                open_tags.append((name, own_id))
        scan_from = end + 1
    for _, variable in usages[usage_index:]:
        assign(ancestor_id(), variable)
    return assets


def invalid_asset_urls(assets: dict[str, str]) -> dict[str, str]:
    """Node → URL entries that are not a Figma MCP asset URL (typos, localhost, other hosts)."""
    return {node_id: url for node_id, url in assets.items() if not FIGMA_MCP_ASSET_RE.match(url)}


def image_ref(node: dict) -> str | None:
    return next((paint["imageRef"] for paint in node["style"]["fills"] if paint["kind"] == "image"), None)


def attach_assets(trees: list[dict], assets: dict[str, str]) -> None:
    """Resolve assets by node id, then propagate only where the asset is provably identical.

    - Same `imageRef` = same uploaded bitmap, so one resolved card resolves every card
      (and the mobile frame).
    - Icons propagate only by `graphicKey` (same component master layer + same look);
      name/size alone matched different icons.
    - A collapsed svg/image whose inner layers map to several different assets cannot be
      one URL: it stays unresolved with `assetConflict` instead of picking one.
    Frames with an image fill only take their own id: a child's icon is never their background.
    """
    by_image_ref: dict[str, str] = {}
    by_graphic_key: dict[str, str] = {}
    for tree in trees:
        for node in walk(tree):
            node.pop("assetConflict", None)
            url = assets.get(node["id"])
            if not url and node["role"] in ("svg", "image"):
                inner = sorted({assets[layer_id] for layer_id in node.get("graphicIds", []) if layer_id in assets})
                if len(inner) == 1:
                    url = inner[0]
                elif inner:
                    node["assetConflict"] = inner
            if not url:
                continue
            node["asset"] = url
            if image_ref(node):
                by_image_ref.setdefault(image_ref(node), url)
            if node.get("graphicKey"):
                by_graphic_key.setdefault(node["graphicKey"], url)
    for tree in trees:
        for node in walk(tree):
            if node["asset"] or node.get("assetConflict"):
                continue
            node["asset"] = by_image_ref.get(image_ref(node) or "") or by_graphic_key.get(node.get("graphicKey") or "")


# ---------------------------------------------------------------- desktop ↔ mobile


def text_index(spec: dict) -> list[dict]:
    return [node for node in walk(spec) if node["text"] and node["role"] in ("heading", "text-basic", "button")]


def match_texts(desktop: dict, mobile: dict) -> dict[str, str]:
    pairs: dict[str, str] = {}
    mobile_texts = text_index(mobile)
    used: set[str] = set()
    desktop_texts = text_index(desktop)
    for node in desktop_texts:
        key = normalize_text(node["text"]["characters"])
        hit = next((m for m in mobile_texts if m["id"] not in used and normalize_text(m["text"]["characters"]) == key), None)
        if hit:
            pairs[node["id"]] = hit["id"]
            used.add(hit["id"])
    for node in desktop_texts:
        if node["id"] in pairs:
            continue
        key = normalize_text(node["text"]["characters"])
        best, best_ratio = None, 0.0
        for candidate in mobile_texts:
            if candidate["id"] in used:
                continue
            ratio = SequenceMatcher(None, key, normalize_text(candidate["text"]["characters"])).ratio()
            if ratio > best_ratio:
                best, best_ratio = candidate, ratio
        if best and best_ratio >= 0.8:
            pairs[node["id"]] = best["id"]
            used.add(best["id"])
    # Desktop often splits one mobile text into sibling nodes ("Thuê" + "VPS OPENCLAW");
    # pair each fragment with the containing mobile text instead of hiding it.
    for node in desktop_texts:
        key = normalize_text(node["text"]["characters"])
        if node["id"] in pairs or len(key) < 2:
            continue
        hit = next((m for m in mobile_texts if key in normalize_text(m["text"]["characters"])), None)
        if hit:
            pairs[node["id"]] = hit["id"]
    return pairs


def text_signature(spec: dict, text_ids: dict[str, str] | None = None) -> set[str]:
    ids = {node["id"] for node in walk(spec) if node["text"]}
    if text_ids is None:
        return ids
    return {text_ids[node_id] for node_id in ids if node_id in text_ids}


def match_trees(desktop: dict, mobile: dict) -> dict[str, str]:
    """Pair desktop → mobile nodes: texts by content, containers by shared texts, graphics by name/order."""
    pairs = match_texts(desktop, mobile)
    pairs[desktop["id"]] = mobile["id"]
    mobile_nodes = [node for node in walk(mobile) if not node["text"] and node["depth"] > 0]
    mobile_signatures = {node["id"]: text_signature(node) for node in mobile_nodes}
    # Global best-first assignment: a greedy parent-first pass pairs outer wrappers with
    # the wrong mobile block whenever mobile drops a wrapper level (common in Figma).
    candidates: list[tuple[float, int, int, str, str]] = []
    for node in walk(desktop):
        if node["id"] in pairs or node["text"]:
            continue
        signature = text_signature(node, pairs)
        if not signature:
            continue
        for candidate in mobile_nodes:
            candidate_signature = mobile_signatures[candidate["id"]]
            if not candidate_signature:
                continue
            score = len(signature & candidate_signature) / len(signature | candidate_signature)
            if candidate["name"] == node["name"]:
                score += 0.05
            if candidate["role"] == node["role"]:
                score += 0.02
            if score >= 0.6:
                candidates.append((-score, node["depth"], candidate["depth"], node["id"], candidate["id"]))
    used = set(pairs.values())
    for _, _, _, desktop_id, mobile_id in sorted(candidates):
        if desktop_id in pairs or mobile_id in used:
            continue
        pairs[desktop_id] = mobile_id
        used.add(mobile_id)
    mobile_by_id = {node["id"]: node for node in walk(mobile)}
    for node in walk(desktop):
        mobile_parent_id = pairs.get(node["id"])
        if not mobile_parent_id:
            continue
        free = [c for c in mobile_by_id[mobile_parent_id]["children"] if c["id"] not in used]
        for child in node["children"]:
            if child["id"] in pairs or text_signature(child):
                continue
            hit = next((c for c in free if c["name"] == child["name"]), None)
            hit = hit or next((c for c in free if coarse_role(c) == coarse_role(child)), None)
            if hit:
                pairs[child["id"]] = hit["id"]
                used.add(hit["id"])
                free.remove(hit)
    return pairs


def significant(node: dict) -> bool:
    return bool(text_signature(node)) or node["box"]["width"] * node["box"]["height"] >= SIGNIFICANT_AREA


def top_level_unmatched(spec: dict, matched: set[str]) -> list[dict]:
    """Outermost nodes with nothing matched inside; unmatched wrappers of matched content stay visible."""
    result: list[dict] = []

    def visit(node: dict) -> None:
        if not any(descendant["id"] in matched for descendant in walk(node)):
            result.append(node)
            return
        for child in node["children"]:
            visit(child)

    visit(spec)
    return result


def diff_settings(desktop_settings: dict, mobile_settings: dict) -> dict[str, Any]:
    overrides: dict[str, Any] = {}
    for key, value in mobile_settings.items():
        if key in ("text", "tag", "image") or key.startswith("<"):
            continue
        if desktop_settings.get(key) != value:
            overrides[f"{key}{TABLET}"] = value
    for key in desktop_settings:
        if key not in mobile_settings and key in RESET_VALUES:
            overrides[f"{key}{TABLET}"] = RESET_VALUES[key]
    return overrides


def is_fragment_pair(desktop_node: dict, mobile_node: dict) -> bool:
    if not desktop_node["text"] or not mobile_node["text"]:
        return False
    return normalize_text(desktop_node["text"]["characters"]) != normalize_text(mobile_node["text"]["characters"])


def fragment_settings(desktop_settings: dict, mobile_settings: dict) -> dict:
    """A desktop fragment only inherits the mobile text's size; its own color/gradient stays."""
    merged = dict(desktop_settings)
    typography_desktop = desktop_settings.get("_typography", {})
    typography_mobile = mobile_settings.get("_typography", {})
    merged["_typography"] = {
        **typography_desktop,
        **{key: typography_mobile[key] for key in ("font-size", "line-height", "font-weight") if key in typography_mobile},
    }
    return merged


def apply_mobile(desktop: dict, mobile: dict) -> dict[str, Any]:
    pairs = match_trees(desktop, mobile)
    mobile_by_id = {node["id"]: node for node in walk(mobile)}
    desktop_only = [n for n in top_level_unmatched(desktop, set(pairs)) if n["depth"] > 0]
    mobile_only = [n for n in top_level_unmatched(mobile, set(pairs.values())) if n["depth"] > 0]
    hidden_roots = {node["id"] for node in desktop_only}
    for node in walk(desktop):
        mobile_id = pairs.get(node["id"])
        node["mobileId"] = mobile_id
        node["mobileSettings"] = {}
        if mobile_id:
            mobile_settings = mobile_by_id[mobile_id]["settings"]
            if is_fragment_pair(node, mobile_by_id[mobile_id]):
                mobile_settings = fragment_settings(node["settings"], mobile_settings)
            node["mobileSettings"] = diff_settings(node["settings"], mobile_settings)
            node["mobileScrollRow"] = bool(mobile_by_id[mobile_id].get("scrollRow"))
        elif node["id"] in hidden_roots:
            node["mobileSettings"] = {f"_display{TABLET}": "none"}
    return {
        "pairs": pairs,
        "desktopOnly": desktop_only,
        "mobileOnly": mobile_only,
        "strategy": suggest_strategy(desktop, mobile, desktop_only, mobile_only),
    }


def suggest_strategy(desktop: dict, mobile: dict | None, desktop_only: list[dict], mobile_only: list[dict]) -> dict[str, Any]:
    if mobile is None:
        return {"value": "n/a", "reasons": ["không có Figma Mobile URL"]}
    has_nav = any(NAV_NAME_RE.search(node["name"]) for node in walk(desktop))
    mobile_scroll = any(node.get("scrollRow") for node in walk(mobile))
    # Extras inside repeated cards are per-item content variations, not a different DOM.
    in_repeats = repeated_ids(mobile)
    mobile_extra = [node for node in mobile_only if significant(node) and node["id"] not in in_repeats]
    reasons: list[str] = []
    if has_nav and mobile_scroll:
        reasons.append("desktop có node nav/slider + mobile là hàng tràn ngang")
        reasons.append("mobile peek (1 card + mép) → slider-responsive; kéo tay thuần → carousel-dual")
        return {"value": "slider-responsive", "alternatives": ["carousel-dual"], "reasons": reasons}
    if has_nav:
        reasons.append("desktop có node nav/slider (arrow/prev/next/dots)")
        return {"value": "slider-responsive", "reasons": reasons}
    if mobile_extra:
        names = ", ".join(f"{node['name']} `{node['id']}`" for node in mobile_extra[:4])
        reasons.append(f"mobile có khối không tồn tại ở desktop: {names}")
        return {"value": "dual-block", "reasons": reasons}
    if mobile_scroll:
        reasons.append("grid/hàng desktop → hàng cuộn ngang mobile, không có nav → override breakpoint")
    if desktop_only:
        reasons.append(f"{len(desktop_only)} khối desktop ẩn ở mobile → `_display:tablet_portrait none`")
    reasons.append("cùng DOM, chỉ đổi size/stack/padding")
    return {"value": "breakpoint-only", "reasons": reasons}


# ---------------------------------------------------------------- builder access


ASSET_PLACEHOLDER = "<asset:"


def load_node_settings(spec_json_path: str | Path) -> dict[str, dict[str, Any]]:
    """Figma node id → Bricks settings (desktop keys + `:tablet_portrait` overrides) from spec.json.

    Placeholders `<asset:NODE_ID>` mean the asset URL was never resolved; uploading them
    renders broken images, so builders must fail on them (see `unresolved_asset_ids`).
    """
    payload = json.loads(Path(spec_json_path).read_text())
    merged: dict[str, dict[str, Any]] = {}
    for node in walk(payload["desktop"]):
        merged[node["id"]] = {**node.get("settings", {}), **node.get("mobileSettings", {})}
    if payload.get("mobile"):
        for node in walk(payload["mobile"]):
            merged.setdefault(node["id"], dict(node.get("settings", {})))
    return merged


def unresolved_asset_ids(elements: list[dict]) -> list[str]:
    return [element["id"] for element in elements if ASSET_PLACEHOLDER in json.dumps(element.get("settings", {}))]


# ---------------------------------------------------------------- tokens


def collect_tokens(spec: dict) -> dict[str, Any]:
    colors: Counter[str] = Counter()
    text_styles: dict[str, dict[str, Any]] = {}
    for node in walk(spec):
        for paint in node["style"]["fills"]:
            if paint["kind"] == "solid" and node["role"] not in ("heading", "text-basic"):
                colors[paint["css"]] += 1
        if node["style"]["stroke"] and node["style"]["stroke"]["kind"] == "solid":
            colors[node["style"]["stroke"]["css"]] += 1
        text = node["text"]
        if not text or not text["fontSize"]:
            continue
        fill = paint_label(text["fill"]) if text["fill"] else "-"
        if text["fill"] and text["fill"]["kind"] == "solid":
            colors[text["fill"]["css"]] += 1
        key = f"{text['fontFamily']} {text['fontWeight']} {num(text['fontSize'])}/{num(text['lineHeight'])} {fill}"
        entry = text_styles.setdefault(key, {"count": 0, "sample": text["characters"][:40].replace("\n", " ")})
        entry["count"] += 1
    return {"colors": colors.most_common(), "textStyles": text_styles}
