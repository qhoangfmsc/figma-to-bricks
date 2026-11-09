#!/usr/bin/env python3
"""
inspect_figma_nodes.py — Đọc nhanh box/padding/gap/layoutMode của các node Figma
qua REST API (khi không tiện dùng Figma MCP).

Usage (từ thư mục todo/):
  python3 scripts/inspect_figma_nodes.py --file-key <key> --node 139:18519 --node 5:23710
  # --file-key bỏ trống → đọc FIGMA_FILE_KEY trong .env
  # node id chấp nhận cả dạng URL "139-18519" (tự đổi thành "139:18519")
"""
import argparse
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.lib.bricks_mcp import _get_config


def normalize_node_id(raw: str) -> str:
    """Figma URL dùng '139-18519', API dùng '139:18519' — chấp nhận cả hai."""
    part = raw.strip()
    if "-" in part and ":" not in part:
        left, _, right = part.partition("-")
        if left.isdigit() and right.isdigit():
            return f"{left}:{right}"
    return part


def fetch_nodes(file_key: str, node_ids: list, token: str) -> dict:
    url = f"https://api.figma.com/v1/files/{file_key}/nodes?ids={','.join(node_ids)}"
    req = urllib.request.Request(url)
    req.add_header("X-Figma-Token", token)
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode("utf-8")).get("nodes", {})


def main():
    ap = argparse.ArgumentParser(description="Đọc box/padding/gap/layoutMode của node Figma qua REST API.")
    ap.add_argument("--file-key", default=None,
                    help="Figma file key (mặc định: FIGMA_FILE_KEY trong .env)")
    ap.add_argument("--node", action="append", required=True, dest="nodes",
                    help="Node ID (lặp lại được), ví dụ: --node 139:18519")
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
        document = node_data.get("document", {})
        box = document.get("absoluteBoundingBox", {})
        print(f"Node: {nid} | Name: {document.get('name')}")
        print(f"  Box: {box}")
        print(f"  Padding: Top={document.get('paddingTop')}, Bottom={document.get('paddingBottom')}")
        print(f"  Item Spacing: {document.get('itemSpacing')}")
        print(f"  Layout Mode: {document.get('layoutMode')}")


if __name__ == "__main__":
    main()
