#!/usr/bin/env python3
"""Upload 1 section JSON lên Bricks template qua bricks-mcp trực tiếp (đỡ tốn context paste JSON)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.lib.bricks_mcp import set_template_content, load_json_file, BricksMCPError


def main():
    if len(sys.argv) < 3:
        print("Usage: python3 upload_section.py <template_id> <json_file>", file=sys.stderr)
        sys.exit(1)
    try:
        template_id = int(sys.argv[1])
    except ValueError:
        print(f"❌ template_id phải là số nguyên, nhận '{sys.argv[1]}'", file=sys.stderr)
        sys.exit(1)
    json_file = sys.argv[2]

    try:
        elements = load_json_file(json_file)
    except (FileNotFoundError, ValueError) as e:
        print(f"❌ {e}", file=sys.stderr)
        sys.exit(1)

    try:
        result = set_template_content(template_id, elements, sync_css=True)
        print(f"✅ Uploaded template {template_id}: {result.get('saved_elements')} elements, "
              f"css_sync={result.get('css_sync', {}).get('synced')}")
    except BricksMCPError as e:
        print(f"❌ Lỗi upload template {template_id}: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
