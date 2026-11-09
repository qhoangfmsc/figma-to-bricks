#!/usr/bin/env python3
"""
dump_figma_spacings.py — Dump toàn bộ padding/gap/layoutMode của các frame trong
từng section Figma (đối chiếu số thật thay vì đoán từ ảnh).

Usage (từ thư mục todo/):
  python3 scripts/dump_figma_spacings.py --file-key <key> \
      --node sec100=139:18519 --node sec200=5:23710
  # --node nhận "label=node_id" hoặc chỉ "node_id" (label = node id)
  # --file-key bỏ trống → đọc FIGMA_FILE_KEY trong .env
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.lib.bricks_mcp import _get_config
from scripts.inspect_figma_nodes import fetch_nodes, normalize_node_id


def print_spacing_info(node, path=""):
    name = node.get("name")
    nid = node.get("id")
    ntype = node.get("type")
    padding_top = node.get("paddingTop")
    padding_bottom = node.get("paddingBottom")
    padding_left = node.get("paddingLeft")
    padding_right = node.get("paddingRight")
    item_spacing = node.get("itemSpacing")
    layout_mode = node.get("layoutMode")
    box = node.get("absoluteBoundingBox", {})

    current_path = f"{path} > {name}({nid})" if path else f"{name}({nid})"

    has_padding = any(p is not None for p in [padding_top, padding_bottom, padding_left, padding_right])

    if ntype in ["FRAME", "INSTANCE", "COMPONENT"] and (has_padding or item_spacing is not None or layout_mode is not None):
        print(f"[{ntype}] {current_path}")
        print(f"  Box: y={box.get('y')}, h={box.get('height')}, w={box.get('width')}")
        if has_padding:
            print(f"  Padding: T={padding_top}, B={padding_bottom}, L={padding_left}, R={padding_right}")
        if item_spacing is not None:
            print(f"  Item Spacing (Gap): {item_spacing}")
        if layout_mode is not None:
            print(f"  Layout Mode: {layout_mode}")

    for child in node.get("children", []):
        if ntype in ["FRAME", "INSTANCE", "COMPONENT", "CANVAS", "DOCUMENT"]:
            print_spacing_info(child, current_path)


def parse_node_arg(raw: str):
    """'sec100=139:18519' → ('sec100', '139:18519'); '139:18519' → ('139:18519', ...)."""
    if "=" in raw:
        label, _, nid = raw.partition("=")
        return label.strip(), normalize_node_id(nid)
    nid = normalize_node_id(raw)
    return nid, nid


def main():
    ap = argparse.ArgumentParser(description="Dump padding/gap/layoutMode của section Figma qua REST API.")
    ap.add_argument("--file-key", default=None,
                    help="Figma file key (mặc định: FIGMA_FILE_KEY trong .env)")
    ap.add_argument("--node", action="append", required=True, dest="nodes",
                    help="'label=node_id' hoặc 'node_id' (lặp lại được)")
    args = ap.parse_args()

    token = _get_config("FIGMA_ACCESS_TOKEN")
    if not token:
        print("LỖI: Không tìm thấy FIGMA_ACCESS_TOKEN trong file .env")
        sys.exit(1)
    file_key = args.file_key or _get_config("FIGMA_FILE_KEY")
    if not file_key:
        print("LỖI: Thiếu --file-key (hoặc đặt FIGMA_FILE_KEY trong .env)")
        sys.exit(1)

    labeled = dict(parse_node_arg(n) for n in args.nodes)

    try:
        nodes = fetch_nodes(file_key, list(labeled.values()), token)
    except Exception as e:
        print(f"LỖI: {e}")
        sys.exit(1)

    for key, nid in labeled.items():
        document = nodes.get(nid, {}).get("document", {})
        print("\n========================================================")
        print(f"=== SECTION: {key} (Figma Node: {nid}) ===")
        print("========================================================")
        print_spacing_info(document)


if __name__ == "__main__":
    main()
