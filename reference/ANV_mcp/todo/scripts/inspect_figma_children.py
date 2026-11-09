#!/usr/bin/env python3
"""
inspect_figma_children.py — In cây con (tree) của node Figma: type, box, padding,
gap, nội dung text — qua REST API.

Usage (từ thư mục todo/):
  python3 scripts/inspect_figma_children.py --file-key <key> --node 5:23710 [--node ...] [--depth 3]
  # --file-key bỏ trống → đọc FIGMA_FILE_KEY trong .env
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.lib.bricks_mcp import _get_config
from scripts.inspect_figma_nodes import fetch_nodes, normalize_node_id


def print_node_tree(node, depth=0, max_depth=None):
    if max_depth is not None and depth > max_depth:
        return
    indent = "  " * depth
    ntype = node.get("type")
    box = node.get("absoluteBoundingBox", {})

    text_content = ""
    if ntype == "TEXT":
        raw_text = node.get("characters", "").replace("\n", " ")
        text_content = f" → {raw_text}"

    print(
        f"{indent}- [{ntype}] ID: {node.get('id')} | Name: {node.get('name')}{text_content} | "
        f"Box: y={box.get('y')}, h={box.get('height')} | "
        f"Pad: T={node.get('paddingTop')}, B={node.get('paddingBottom')} | Gap: {node.get('itemSpacing')}"
    )

    for child in node.get("children", []):
        print_node_tree(child, depth + 1, max_depth)


def main():
    ap = argparse.ArgumentParser(description="In cây con của node Figma qua REST API.")
    ap.add_argument("--file-key", default=None,
                    help="Figma file key (mặc định: FIGMA_FILE_KEY trong .env)")
    ap.add_argument("--node", "--node_id", action="append", required=True, dest="nodes",
                    help="Node ID (lặp lại được)")
    ap.add_argument("--depth", type=int, default=None, help="Giới hạn độ sâu in cây")
    args = ap.parse_args()

    token = _get_config("FIGMA_ACCESS_TOKEN")
    if not token:
        print("LỖI: Không tìm thấy FIGMA_ACCESS_TOKEN trong file .env")
        sys.exit(1)
    file_key = args.file_key or _get_config("FIGMA_FILE_KEY")
    if not file_key:
        print("LỖI: Thiếu --file-key (hoặc đặt FIGMA_FILE_KEY trong .env)")
        sys.exit(1)

    node_ids = [normalize_node_id(n) for n in args.nodes]

    try:
        nodes = fetch_nodes(file_key, node_ids, token)
    except Exception as e:
        print(f"LỖI: {e}")
        sys.exit(1)

    for nid, node_data in nodes.items():
        print(f"\n==================== NODE {nid} ====================")
        print_node_tree(node_data.get("document", {}), max_depth=args.depth)


if __name__ == "__main__":
    main()
