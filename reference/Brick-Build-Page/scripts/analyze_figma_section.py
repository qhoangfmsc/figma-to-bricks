#!/usr/bin/env python3
"""
Fast, exact PLAN input for one Figma section (desktop + optional mobile).

One REST call per Figma file (cached) → `scripts/data/<slug>/spec.md` (plan-ready draft:
Cấu trúc element, Measurements, Mobile diff, Settings snapshot, G4 checklist) and
`spec.json` (every node with Bricks `settings` + `mobileSettings` in real Bricks shapes).

Usage:
  python3 scripts/analyze_figma_section.py --desktop-url "<url>" --mobile-url "<url>" --slug template-hero
  python3 scripts/analyze_figma_section.py ... --assets <design_context_desktop.txt> <design_context_mobile.txt>
  python3 scripts/analyze_figma_section.py ... --refresh        # ignore cached REST JSON

Needs FIGMA_ACCESS_TOKEN in .env and unrestricted network (api.figma.com).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from scripts.lib.env_loader import load_env
from scripts.lib.figma_api import figma_get, node_id_to_url_fragment, parse_figma_url
from scripts.lib.figma_spec import (
    TABLET,
    apply_mobile,
    attach_assets,
    build_spec,
    collect_tokens,
    compute_settings,
    css_shorthand,
    grouped_children,
    invalid_asset_urls,
    num,
    paint_label,
    parse_design_context_assets,
    suggest_strategy,
    walk,
)

TREE_TEXT_PREVIEW = 32
MAX_MEASUREMENT_ROWS = 24
MAX_CHECKLIST_ROWS = 4


# ---------------------------------------------------------------- fetch


def fetch_documents(requests: dict[str, list[str]], token: str) -> dict[str, dict]:
    """One `/nodes` call per file key; files fetched in parallel."""

    def fetch(file_key: str) -> dict[str, dict]:
        ids = ",".join(urllib.parse.quote(node_id, safe="") for node_id in requests[file_key])
        data = figma_get(f"/files/{file_key}/nodes?ids={ids}", token)
        return {node_id: entry["document"] for node_id, entry in (data.get("nodes") or {}).items() if entry}

    documents: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=max(1, len(requests))) as pool:
        for result in pool.map(fetch, requests):
            documents.update(result)
    return documents


def cache_path(cache_dir: Path, node_id: str) -> Path:
    # `.full` suffix: plan_from_figma.py writes depth-limited trees as `<node>.json` in the same folder.
    return cache_dir / f"{node_id_to_url_fragment(node_id)}.full.json"


def load_nodes(targets: list[tuple[str, str]], cache_dir: Path, token: str, refresh: bool) -> dict[str, dict]:
    nodes: dict[str, dict] = {}
    missing: dict[str, list[str]] = {}
    for file_key, node_id in targets:
        cache_file = cache_path(cache_dir, node_id)
        if cache_file.is_file() and not refresh:
            nodes[node_id] = json.loads(cache_file.read_text())
        else:
            missing.setdefault(file_key, []).append(node_id)
    if missing:
        fetched = fetch_documents(missing, token)
        cache_dir.mkdir(parents=True, exist_ok=True)
        for node_id, document in fetched.items():
            cache_path(cache_dir, node_id).write_text(json.dumps(document, ensure_ascii=False))
            nodes[node_id] = document
    for _, node_id in targets:
        if node_id not in nodes:
            raise SystemExit(f"Figma node {node_id} not returned by REST API (check URL / token access)")
    return nodes


# ---------------------------------------------------------------- formatting


def label(node: dict) -> str:
    if node["text"] and node["role"] in ("heading", "text-basic", "button"):
        text = " ".join(node["text"]["characters"].split())
        return f'"{text[:TREE_TEXT_PREVIEW]}{"…" if len(text) > TREE_TEXT_PREVIEW else ""}"'
    return f'"{node["name"]}"'


def size(node: dict) -> str:
    return f"{num(node['box']['width'])}×{num(node['box']['height'])}"


def fmt_value(key: str, value: Any) -> str:
    if isinstance(value, dict):
        if not value:
            return "-"
        if set(value) <= {"top", "right", "bottom", "left"}:
            return css_shorthand(tuple(float(value.get(side, "0").rstrip("px%") or 0) for side in ("top", "right", "bottom", "left")))
        if "hex" in value or "rgb" in value:
            return value.get("hex") or value.get("rgb")
        if key.startswith("_typography"):
            parts = [value.get("font-family"), value.get("font-weight"), f"{value.get('font-size')}/{value.get('line-height')}"]
            parts += [fmt_value("", value["color"])] if "color" in value else []
            parts += [value[k] for k in ("text-align", "text-transform", "letter-spacing") if k in value]
            return " ".join(str(part) for part in parts if part)
        if key.startswith("_border"):
            parts = []
            if "width" in value:
                parts.append(f"{fmt_value('', value['width'])} {value.get('style', '')} {fmt_value('', value.get('color', {}))}".strip())
            if "radius" in value:
                parts.append(f"r{fmt_value('', value['radius'])}")
            return " ".join(parts)
        if key.startswith("_background"):
            parts = []
            if "color" in value:
                parts.append(fmt_value("", value["color"]))
            if "image" in value:
                parts.append(f"img {value['image'].get('url')} {value.get('size', '')}".strip())
            return " + ".join(parts)
        if key.startswith("_gradient"):
            stops = "→".join(fmt_value("", stop["color"]) for stop in value.get("colors", []))
            return f"{value.get('applyTo')} {value.get('gradientType')} {value.get('angle')}° {stops}"
        if key.startswith("_boxShadow"):
            values = value.get("values", {})
            return f"{values.get('offsetX')} {values.get('offsetY')} {values.get('blur')} {values.get('spread')} {fmt_value('', value.get('color', {}))}{' inset' if value.get('inset') else ''}"
        if key == "image":
            return value.get("url", "")
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def fmt_settings(settings: dict[str, Any], skip: tuple[str, ...] = ("text",)) -> str:
    return " · ".join(f"`{key} {fmt_value(key, value)}`" for key, value in settings.items() if key not in skip)


def first_of_groups(spec: dict) -> list[tuple[dict, int]]:
    """Walk that visits only the first item of each repeated group, with its repeat count."""
    result: list[tuple[dict, int]] = [(spec, 1)]

    def visit(node: dict) -> None:
        for group in grouped_children(node):
            result.append((group[0], len(group)))
            visit(group[0])

    visit(spec)
    return result


def layout_summary(node: dict) -> str:
    layout = node["layout"]
    parts: list[str] = []
    settings = node["settings"]
    if settings.get("_display") == "grid":
        parts.append(f"grid {layout['columns']} cột gap {settings['_gridGap']}")
    elif layout["mode"] in ("row", "column"):
        parts.append(layout["mode"] + (" wrap" if layout["wrap"] else ""))
        if layout["gap"] and layout["justify"] != "SPACE_BETWEEN":
            parts.append(f"gap {num(layout['gap'])}")
        if layout["justify"] == "SPACE_BETWEEN":
            parts.append("space-between")
    if any(layout["padding"]):
        parts.append(f"p {css_shorthand(layout['padding'])}")
    if node["style"]["radius"] and any(node["style"]["radius"]):
        parts.append(f"r {css_shorthand(node['style']['radius'])}")
    if node["style"]["stroke"]:
        parts.append(f"border {num(node['style']['strokeWeight'][0])} {paint_label(node['style']['stroke'])}")
    fills = [paint_label(paint) for paint in node["style"]["fills"]]
    if fills and node["role"] not in ("heading", "text-basic"):
        parts.append("bg " + " + ".join(fills))
    if node["absolute"] and node["depth"] > 0:
        parts.append(f"abs @{num(node['relX'])},{num(node['relY'])}")
    if node.get("scrollRow"):
        parts.append("tràn ngang → scroll")
    if node["style"]["opacity"] < 0.999:
        parts.append(f"opacity {num(node['style']['opacity'])}")
    return " · ".join(parts)


def text_summary(text: dict) -> str:
    parts = [f"{text['fontFamily']} {text['fontWeight']} {num(text['fontSize'])}/{num(text['lineHeight'])}"]
    if text["fill"]:
        parts.append(paint_label(text["fill"]))
    if text["align"] != "LEFT":
        parts.append(text["align"].lower())
    if text["case"] == "UPPER":
        parts.append("uppercase")
    if text["letterSpacing"]:
        parts.append(f"ls {num(text['letterSpacing'])}")
    for run in text["runs"]:
        run_parts = [f'"{run["text"].strip()[:24]}"']
        if run["fontWeight"]:
            run_parts.append(str(run["fontWeight"]))
        if run["fill"]:
            run_parts.append(paint_label(run["fill"]))
        parts.append("span " + " ".join(run_parts))
    return " · ".join(parts)


def render_tree(spec: dict, detailed: bool) -> list[str]:
    lines: list[str] = []

    def visit(node: dict, indent: int, repeat: int, siblings: list[dict]) -> None:
        pad = "  " * indent
        count = f" ×{repeat}" if repeat > 1 else ""
        line = f"{pad}{node['role']} {label(node)}{count}"
        if detailed:
            line += f" `{node['id']}` {size(node)}"
            summary = text_summary(node["text"]) if node["text"] else layout_summary(node)
            if summary:
                line += f" · {summary}"
            if node["asset"]:
                line += f" · asset {node['asset']}"
        lines.append(line)
        if detailed and repeat > 1:
            for index, sibling in enumerate(siblings, start=1):
                texts = [" ".join(n["text"]["characters"].split()) for n in walk(sibling) if n["text"]]
                assets = [n["asset"] for n in walk(sibling) if n["asset"]]
                content = " | ".join(texts) or "-"
                lines.append(f"{pad}  #{index} `{sibling['id']}`: {content}{' · ' + ', '.join(assets) if assets else ''}")
        for group in grouped_children(node):
            visit(group[0], indent + 1, len(group), group)

    visit(spec, 0, 1, [spec])
    return lines


# ---------------------------------------------------------------- sections of spec.md


def measurements(desktop: dict) -> list[str]:
    rows = ["| Thông số | Giá trị |", "|----------|---------|"]
    text_styles: dict[str, str] = {}
    count = 0
    for node, repeat in first_of_groups(desktop):
        if node["text"] and node["role"] in ("heading", "text-basic"):
            text_styles.setdefault(text_summary(node["text"]), label(node))
            continue
        if node["role"] not in ("section", "container", "block", "div", "button", "image") or count >= MAX_MEASUREMENT_ROWS:
            continue
        summary = layout_summary(node)
        if not summary and node["role"] not in ("section", "container"):
            continue
        repeat_note = f" ×{repeat}" if repeat > 1 else ""
        rows.append(f"| {node['role']} {label(node)}{repeat_note} | {size(node)}{' · ' + summary if summary else ''} |")
        count += 1
    for style, sample in text_styles.items():
        rows.append(f"| text {sample} | {style} |")
    return rows


def mobile_diff_bullets(desktop: dict, mobile: dict | None, match: dict | None) -> list[str]:
    if not mobile or not match:
        return ["- (không có Figma Mobile — áp dụng rule 10 tối thiểu: stack + padding)"]
    bullets = [f"- Frame mobile {size(mobile)} (review 390px)"]
    hidden = {node["id"] for node in match["desktopOnly"]}
    for node, repeat in first_of_groups(desktop):
        if node["id"] in hidden:
            bullets.append(f"- ẩn {node['role']} {label(node)} `{node['id']}`{' ×' + str(repeat) if repeat > 1 else ''}")
            continue
        overrides = node.get("mobileSettings", {})
        if not overrides:
            continue
        compact = " · ".join(f"{key.replace(TABLET, '')} {fmt_value(key, value)}" for key, value in overrides.items())
        scroll = " (hàng cuộn ngang)" if node.get("mobileScrollRow") else ""
        bullets.append(f"- {node['role']} {label(node)}{scroll}: {compact}")
    for node in match["mobileOnly"]:
        bullets.append(f"- mobile thêm {node['role']} \"{node['name']}\" `{node['id']}` {size(node)}{' · asset ' + node['asset'] if node['asset'] else ''}")
    return bullets


def settings_snapshot(desktop: dict) -> list[str]:
    lines: list[str] = []
    for node, repeat in first_of_groups(desktop):
        settings = {k: v for k, v in node["settings"].items() if k not in ("text", "_margin")}
        if not settings and not node.get("mobileSettings"):
            continue
        repeat_note = f" (×{repeat})" if repeat > 1 else ""
        lines.append(f"- {node['role']} {label(node)} `{node['id']}`{repeat_note}: {fmt_settings(settings)}")
        if node.get("mobileSettings"):
            lines.append(f"  - @991: {fmt_settings(node['mobileSettings'])}")
        for note in node.get("notes", []):
            lines.append(f"  - ⚠ {note}")
    lines.append("- heading / text-basic: `_margin 0` (reset margin theme)")
    return lines


def checklist(desktop: dict, mobile_bullets: list[str]) -> list[str]:
    rows = ["| Tiêu chí | Pass |", "|----------|------|"]
    container = next((n for n in walk(desktop) if n["role"] == "container"), desktop)
    for group in grouped_children(container)[:MAX_CHECKLIST_ROWS]:
        node = group[0]
        count = f" ×{len(group)}" if len(group) > 1 else ""
        summary = layout_summary(node) or (text_summary(node["text"]) if node["text"] else size(node))
        rows.append(f"| Desktop: {node['role']} {label(node)}{count} — {summary} | |")
    for bullet in mobile_bullets[1 : 1 + MAX_CHECKLIST_ROWS]:
        rows.append(f"| Mobile: {bullet[2:][:110]} | |")
    return rows


def asset_lines(trees: list[dict]) -> tuple[list[str], int]:
    lines: list[str] = []
    unresolved = 0
    seen: set[str] = set()
    for tree in trees:
        for node in walk(tree):
            needs_asset = node["role"] in ("svg", "image") or any(p["kind"] == "image" for p in node["style"]["fills"])
            if not needs_asset or node["id"] in seen:
                continue
            seen.add(node["id"])
            if not node["asset"]:
                unresolved += 1
            status = node["asset"] or "CHƯA CÓ"
            if node.get("assetConflict"):
                status += (
                    f" (⚠ {len(node['assetConflict'])} asset lớp trong — map trực tiếp node này"
                    " hoặc dựng từng lớp, không chọn đại 1 URL)"
                )
            lines.append(f"- `{node['id']}` {node['role']} \"{node['name']}\" {size(node)} → {status}")
    return lines, unresolved


def render_markdown(name: str, slug: str, desktop: dict, mobile: dict | None, match: dict | None, cache_dir: Path) -> str:
    strategy = match["strategy"] if match else suggest_strategy(desktop, None, [], [])
    mobile_bullets = mobile_diff_bullets(desktop, mobile, match)
    assets, unresolved = asset_lines([desktop] + ([mobile] if mobile else []))
    tokens = collect_tokens(desktop)
    differs = "có" if mobile and len(mobile_bullets) > 1 else "không"
    alternatives = f" (cân nhắc: {', '.join(strategy.get('alternatives', []))})" if strategy.get("alternatives") else ""
    summary_bits = []
    if match:
        changed = sum(1 for n in walk(desktop) if n.get("mobileSettings") and n["id"] not in {d["id"] for d in match["desktopOnly"]})
        summary_bits.append(f"{changed} node đổi settings")
        if match["desktopOnly"]:
            summary_bits.append(f"ẩn {len(match['desktopOnly'])} khối")
        if match["mobileOnly"]:
            summary_bits.append(f"mobile thêm {len(match['mobileOnly'])} khối")
        scroll_rows = [label(n) for n in walk(desktop) if n.get("mobileScrollRow")]
        if scroll_rows:
            summary_bits.append("cuộn ngang " + ", ".join(scroll_rows))

    out: list[str] = [
        f"# Figma spec — {name}",
        "",
        f"- Desktop: `{desktop['id']}` \"{desktop['name']}\" {size(desktop)}",
        f"- Mobile: `{mobile['id']}` \"{mobile['name']}\" {size(mobile)}" if mobile else "- Mobile: —",
        f"- Cache REST: `{cache_dir.relative_to(ROOT)}` · spec JSON: `scripts/data/{slug}/spec.json`",
        f"- Gợi ý chiến lược: `{strategy['value']}`{alternatives} — " + "; ".join(strategy["reasons"]),
        f"- Asset chưa resolve: **{unresolved}**" + (" → gọi `get_design_context` rồi chạy lại với `--assets`" if unresolved else ""),
        "",
        "## Plan draft",
        "",
        f"- Figma node desktop: `{desktop['id']}`",
        f"- Figma node mobile: `{mobile['id']}`" if mobile else "- Figma node mobile: —",
        f"- Mobile khác desktop?: `{differs}`",
        f"- Chiến lược mobile: `{strategy['value']}`",
        f"- Mobile diff: {' · '.join(summary_bits) or '—'}",
        "",
        "### Cấu trúc element",
        "",
        "```",
        *render_tree(desktop, detailed=False),
        "```",
        "",
        "### Measurements (Figma desktop)",
        "",
        *measurements(desktop),
        "",
        "### Mobile diff (@991px)",
        "",
        *mobile_bullets,
        "",
        "### Settings snapshot",
        "",
        *settings_snapshot(desktop),
        "",
        "### G4 acceptance checklist",
        "",
        *checklist(desktop, mobile_bullets),
        "",
        "## Appendix",
        "",
        "### Outline desktop (id · size · layout · text · asset)",
        "",
        "```",
        *render_tree(desktop, detailed=True),
        "```",
    ]
    if mobile:
        out += ["", "### Outline mobile", "", "```", *render_tree(mobile, detailed=True), "```"]
    out += ["", "### Tokens", "", "- Màu: " + " · ".join(f"`{color}`×{count}" for color, count in tokens["colors"][:12])]
    out += [f"- Text `{style}` ×{info['count']} — \"{info['sample']}\"" for style, info in tokens["textStyles"].items()]
    out += ["", "### Assets", "", *(assets or ["- (không có)"]), ""]
    return "\n".join(out)


# ---------------------------------------------------------------- main


def strip_runtime(spec: dict) -> dict:
    """spec.json keeps the tree + settings; raw REST JSON already lives in the cache."""
    return {
        key: ([strip_runtime(child) for child in value] if key == "children" else value)
        for key, value in spec.items()
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze one Figma section into a Bricks-ready spec")
    parser.add_argument("--desktop-url", required=True)
    parser.add_argument("--mobile-url", default="")
    parser.add_argument("--slug", required=True, help="Data folder under scripts/data/, e.g. template-hero-cf")
    parser.add_argument("--name", default="", help="Display name (defaults to Figma node name)")
    parser.add_argument("--assets", nargs="*", type=Path, default=[], help="Saved get_design_context outputs")
    parser.add_argument(
        "--asset",
        nargs="*",
        default=[],
        help="NODE_ID=FILE (with --asset-prefix) or NODE_ID=URL; one node per distinct asset is enough",
    )
    parser.add_argument("--asset-prefix", default="", help="`assetPathPrefix` from the design-context response")
    parser.add_argument("--refresh", action="store_true", help="Re-fetch REST JSON instead of using cache")
    parser.add_argument(
        "--reset-assets",
        action="store_true",
        help="Drop scripts/data/<slug>/assets.json before resolving (stale or wrong mappings)",
    )
    args = parser.parse_args()

    token = load_env().get("FIGMA_ACCESS_TOKEN", "").strip()
    desktop_ref = parse_figma_url(args.desktop_url)
    mobile_ref = parse_figma_url(args.mobile_url) if args.mobile_url.strip() else None
    if not desktop_ref.node_id or (mobile_ref and not mobile_ref.node_id):
        print("Figma URL cần node-id (Copy link to selection)", file=sys.stderr)
        return 1

    data_dir = ROOT / "scripts" / "data" / args.slug
    cache_dir = data_dir / "figma"
    targets = [(desktop_ref.file_key, desktop_ref.node_id)]
    if mobile_ref:
        targets.append((mobile_ref.file_key, mobile_ref.node_id))
    cached = all(cache_path(cache_dir, node_id).is_file() for _, node_id in targets)
    if not token and not (cached and not args.refresh):
        print("FIGMA_ACCESS_TOKEN missing in .env", file=sys.stderr)
        return 1

    started = time.time()
    nodes = load_nodes(targets, cache_dir, token, args.refresh)
    desktop = build_spec(nodes[desktop_ref.node_id])
    mobile = build_spec(nodes[mobile_ref.node_id]) if mobile_ref else None

    # Assets accumulate across runs so a later --asset call never drops earlier ones.
    asset_store = data_dir / "assets.json"
    keep_stored = asset_store.is_file() and not args.reset_assets
    assets: dict[str, str] = json.loads(asset_store.read_text()) if keep_stored else {}
    for asset_file in args.assets:
        assets.update(parse_design_context_assets(asset_file.read_text()))
    for pair in args.asset:
        node_id, _, value = pair.partition("=")
        if not value:
            print(f"--asset expects NODE_ID=FILE_OR_URL, got {pair!r}", file=sys.stderr)
            return 1
        if value.startswith("http"):
            assets[node_id.strip()] = value.strip()
        elif args.asset_prefix:
            assets[node_id.strip()] = f"{args.asset_prefix.rstrip('/')}/{value.strip()}"
        else:
            print("--asset with a file name needs --asset-prefix", file=sys.stderr)
            return 1
    invalid = invalid_asset_urls(assets)
    if invalid:
        for node_id, url in invalid.items():
            print(f"✗ asset `{node_id}` không phải URL Figma MCP: {url}", file=sys.stderr)
        print("  → lấy lại từ get_design_context (assetPathPrefix + tên file), không gõ tay", file=sys.stderr)
        return 1
    trees = [desktop] + ([mobile] if mobile else [])
    attach_assets(trees, assets)
    for tree in trees:
        compute_settings(tree)
    if assets:
        data_dir.mkdir(parents=True, exist_ok=True)
        asset_store.write_text(json.dumps(assets, ensure_ascii=False, indent=1))
    match = apply_mobile(desktop, mobile) if mobile else None

    name = args.name or desktop["name"]
    markdown = render_markdown(name, args.slug, desktop, mobile, match, cache_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / "spec.md").write_text(markdown)
    payload = {
        "name": name,
        "desktop": strip_runtime(desktop),
        "mobile": strip_runtime(mobile) if mobile else None,
        "pairs": match["pairs"] if match else {},
        "strategy": match["strategy"] if match else suggest_strategy(desktop, None, [], []),
        "assets": assets,
    }
    (data_dir / "spec.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1))

    node_count = sum(1 for _ in walk(desktop)) + (sum(1 for _ in walk(mobile)) if mobile else 0)
    unresolved = markdown.count("→ CHƯA CÓ")
    print(f"✓ {node_count} nodes in {time.time() - started:.1f}s")
    print(f"  spec.md   → {(data_dir / 'spec.md').relative_to(ROOT)}")
    print(f"  spec.json → {(data_dir / 'spec.json').relative_to(ROOT)}")
    print(f"  strategy  → {payload['strategy']['value']}")
    print(f"  assets    → {len(assets)} resolved, {unresolved} missing")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
