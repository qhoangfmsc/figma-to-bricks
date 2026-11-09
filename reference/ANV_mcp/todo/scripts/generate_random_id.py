#!/usr/bin/env python3
"""
generate_random_id.py
Sinh 6-char alphanumeric ID ngẫu nhiên dùng cho Bricks Builder elements.
Đảm bảo không trùng lặp trong một batch.

Usage:
  python3 generate_random_id.py          # Sinh 1 ID
  python3 generate_random_id.py 10       # Sinh 10 IDs
  python3 generate_random_id.py 10 --check path/to/file.json  # Sinh 10 IDs không trùng file JSON
"""

import random
import string
import sys
import json
import re


def generate_id(length: int = 6) -> str:
    """Sinh 1 ID ngẫu nhiên gồm chữ thường + số."""
    chars = string.ascii_lowercase + string.digits
    return ''.join(random.choices(chars, k=length))


def generate_unique_ids(count: int, existing: set = None) -> list:
    """Sinh nhiều ID duy nhất, không trùng với existing set."""
    existing = existing or set()
    ids = []
    attempts = 0
    max_attempts = count * 100

    while len(ids) < count and attempts < max_attempts:
        new_id = generate_id()
        if new_id not in existing and new_id not in ids:
            ids.append(new_id)
        attempts += 1

    if len(ids) < count:
        raise RuntimeError(f"Không thể sinh đủ {count} ID unique sau {max_attempts} lần thử.")

    return ids


def extract_ids_from_json(filepath: str) -> set:
    """Đọc file JSON và trích xuất tất cả 6-char ID đang dùng."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        # Match tất cả chuỗi 6 ký tự alphanumeric
        found = set(re.findall(r'\b[a-z0-9]{6}\b', content))
        return found
    except FileNotFoundError:
        print(f"⚠️  File không tồn tại: {filepath} — bỏ qua check trùng lặp", file=sys.stderr)
        return set()
    except json.JSONDecodeError as e:
        print(f"⚠️  JSON parse lỗi: {e} — bỏ qua check trùng lặp", file=sys.stderr)
        return set()


def main():
    args = sys.argv[1:]

    count = 1
    check_file = None

    # Parse args
    i = 0
    while i < len(args):
        if args[i] == '--check' and i + 1 < len(args):
            check_file = args[i + 1]
            i += 2
        else:
            try:
                count = int(args[i])
            except ValueError:
                print(f"❌ Argument không hợp lệ: {args[i]}", file=sys.stderr)
                sys.exit(1)
            i += 1

    # Lấy existing IDs nếu có file check
    existing = set()
    if check_file:
        existing = extract_ids_from_json(check_file)
        print(f"ℹ️  Tìm thấy {len(existing)} ID đang dùng trong {check_file}", file=sys.stderr)

    # Sinh IDs
    ids = generate_unique_ids(count, existing)

    # Output
    if count == 1:
        print(ids[0])
    else:
        for id_ in ids:
            print(id_)

    print(f"\n✅ Đã sinh {len(ids)} ID unique.", file=sys.stderr)


if __name__ == '__main__':
    main()
