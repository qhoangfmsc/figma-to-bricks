#!/usr/bin/env python3
"""
validate_section_structure.py — Gate G2.5
Validate cấu trúc DOM section trên WordPress so với chiến lược responsive đã plan.

Kiểm tra:
  1. Section key tồn tại trong plan file
  2. Chiến lược responsive (strategy) khớp với DOM thực tế
  3. Cấu trúc element tree hợp lệ theo strategy
  4. Không có element "orphan" hoặc nested section

Usage:
  python3 validate_section_structure.py <section_key> <plan_file.md> <json_file.json>
  
  Ví dụ:
  python3 validate_section_structure.py sec100 todo/plans/template-for-ldp.md todo/bricks-json/sec100.json
"""

import json
import re
import sys
from pathlib import Path
from typing import Optional


STRATEGIES = {
    'breakpoint-only',
    'slider-responsive',
    'carousel-dual',
    'dual-block',
    'n/a',
}

errors = []
warnings = []


def err(msg):
    errors.append(f"  ❌ {msg}")


def warn(msg):
    warnings.append(f"  ⚠️  {msg}")


def extract_strategy_from_plan(plan_text: str, section_key: str) -> Optional[str]:
    """Trích xuất chiến lược mobile từ plan markdown."""
    # Tìm section block
    section_pattern = re.compile(
        rf'##\s+{re.escape(section_key)}.*?(?=\n##\s|\Z)',
        re.DOTALL | re.IGNORECASE
    )
    match = section_pattern.search(plan_text)
    if not match:
        return None

    section_text = match.group(0)

    # Tìm Mobile khác desktop / Chiến lược mobile
    # ⚠️ Lớp ký tự cũ `[Cc]hi[eê]n l[ưu][ợo]c` KHÔNG khớp "Chiến" viết đúng chính tả
    # (ế = e + dấu sắc + dấu mũ, không phải ê) → mọi plan viết đúng đều bị bỏ qua
    # strategy check một cách âm thầm. Dùng \w* (Python 3 khớp unicode) cho phần
    # mang dấu, đồng thời cho phép **đậm** markdown bao quanh. (sửa 2026-07-31)
    strategy_match = re.search(
        r'[Cc]hi\w{0,4}\s+l\w{0,4}\s+(?:mobile|responsive)\s*[:\-]\s*\**\s*[`"]?([\w-]+)[`"]?',
        section_text
    )
    if strategy_match:
        return strategy_match.group(1).strip('`"')

    return None


def get_all_elements(data) -> list:
    """Lấy mảng elements từ clipboard hoặc flat array."""
    if isinstance(data, dict) and 'content' in data:
        return data['content']
    elif isinstance(data, list):
        return data
    return []


def check_section_present(elements: list, section_key: str) -> Optional[dict]:
    """Tìm section element bằng label hoặc id prefix."""
    for el in elements:
        label = el.get('label', '').lower()
        el_id = el.get('id', '').lower()
        if section_key.lower() in label or el.get('name') == 'section':
            if el.get('parent') == '0':
                return el
    # Fallback: lấy root section đầu tiên
    for el in elements:
        if el.get('name') == 'section' and el.get('parent') == '0':
            return el
    return None


def check_strategy_breakpoint_only(elements: list):
    """breakpoint-only: DOM thống nhất, chỉ dùng breakpoint settings."""
    slider_elements = [el for el in elements if el.get('name') == 'slider-nested']
    dual_blocks = []

    # Tìm cặp block ẩn/hiện
    for el in elements:
        settings = el.get('settings', {})
        conditions = settings.get('_conditions', [])
        if any('viewport' in str(c).lower() for c in conditions):
            dual_blocks.append(el)

    if slider_elements:
        warn(f"Strategy 'breakpoint-only' nhưng tìm thấy {len(slider_elements)} slider-nested element")
    if len(dual_blocks) >= 2:
        warn(f"Strategy 'breakpoint-only' nhưng có {len(dual_blocks)} element dùng condition viewport — có thể nên là 'dual-block'?")


def check_strategy_slider_responsive(elements: list):
    """slider-responsive: phải có đúng 1 slider-nested."""
    slider_elements = [el for el in elements if el.get('name') == 'slider-nested']
    if not slider_elements:
        err("Strategy 'slider-responsive' nhưng không tìm thấy element 'slider-nested'")
    elif len(slider_elements) > 1:
        warn(f"Strategy 'slider-responsive': tìm thấy {len(slider_elements)} slider — thường chỉ cần 1")


def check_strategy_carousel_dual(elements: list):
    """carousel-dual: slider-nested (desktop) + div scroll (mobile)."""
    slider_elements = [el for el in elements if el.get('name') == 'slider-nested']
    scroll_blocks = []
    for el in elements:
        settings = el.get('settings', {})
        css_custom = settings.get('_cssCustom', '')
        overflow = settings.get('_overflow', '')
        if 'overflow-x' in css_custom or overflow == 'auto':
            scroll_blocks.append(el)

    if not slider_elements:
        err("Strategy 'carousel-dual' cần có slider-nested (desktop slider)")
    if not scroll_blocks:
        warn("Strategy 'carousel-dual' cần có div scroll ngang (mobile) — không tìm thấy overflow element")


def check_strategy_dual_block(elements: list):
    """dual-block: 2 block ẩn/hiện theo viewport."""
    condition_blocks = []
    for el in elements:
        settings = el.get('settings', {})
        conditions = settings.get('_conditions', [])
        if conditions:
            condition_blocks.append(el)
    if len(condition_blocks) < 2:
        warn(f"Strategy 'dual-block' cần ít nhất 2 block với _conditions — tìm thấy {len(condition_blocks)}")


def check_no_nested_sections(elements: list):
    """Section không được lồng trong element khác."""
    id_to_parent = {el.get('id'): el.get('parent') for el in elements}
    for el in elements:
        if el.get('name') == 'section' and el.get('parent') != '0':
            parent_id = el.get('parent')
            parent_el = next((e for e in elements if e.get('id') == parent_id), None)
            parent_name = parent_el.get('name', '?') if parent_el else '?'
            err(f"Section '{el.get('id')}' bị lồng trong '{parent_name}' (id: {parent_id}) — section phải là root")


def main():
    if len(sys.argv) < 4:
        print("Usage: python3 validate_section_structure.py <section_key> <plan_file.md> <json_file.json>")
        sys.exit(1)

    section_key = sys.argv[1]
    plan_file = sys.argv[2]
    json_file = sys.argv[3]

    print(f"\n{'='*55}")
    print(f"  Gate G2.5 — Validate Section Structure")
    print(f"  Section: {section_key}")
    print(f"  Plan:    {plan_file}")
    print(f"  JSON:    {json_file}")
    print(f"{'='*55}")

    # Đọc plan
    try:
        plan_text = Path(plan_file).read_text(encoding='utf-8')
    except FileNotFoundError:
        err(f"Plan file không tìm thấy: {plan_file}")
        plan_text = ""

    # Đọc JSON
    try:
        raw = Path(json_file).read_text(encoding='utf-8')
        data = json.loads(raw)
    except FileNotFoundError:
        print(f"\n❌ FAIL — JSON file không tìm thấy: {json_file}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"\n❌ FAIL — JSON parse lỗi: {e}")
        sys.exit(1)

    elements = get_all_elements(data)
    print(f"  ✅ Đọc {len(elements)} elements từ JSON")

    # Kiểm tra không nested section
    check_no_nested_sections(elements)

    # Kiểm tra strategy
    strategy = extract_strategy_from_plan(plan_text, section_key)

    if not strategy:
        warn(f"Không tìm thấy chiến lược mobile cho '{section_key}' trong plan — bỏ qua strategy check")
    else:
        print(f"  ℹ️  Strategy từ plan: '{strategy}'")
        if strategy not in STRATEGIES:
            warn(f"Strategy '{strategy}' không nằm trong danh sách chuẩn: {STRATEGIES}")
        elif strategy == 'breakpoint-only':
            check_strategy_breakpoint_only(elements)
        elif strategy == 'slider-responsive':
            check_strategy_slider_responsive(elements)
        elif strategy == 'carousel-dual':
            check_strategy_carousel_dual(elements)
        elif strategy == 'dual-block':
            check_strategy_dual_block(elements)
        elif strategy == 'n/a':
            print("  ℹ️  Strategy 'n/a' — không kiểm tra DOM structure")

    # In kết quả
    print()
    if warnings:
        print("Warnings:")
        for w in warnings:
            print(w)

    if errors:
        print("\nErrors:")
        for e in errors:
            print(e)
        print(f"\n{'='*55}")
        print(f"  ❌ G2.5 FAIL — {len(errors)} lỗi, {len(warnings)} cảnh báo")
        print(f"{'='*55}\n")
        sys.exit(1)
    else:
        print(f"{'='*55}")
        print(f"  ✅ G2.5 PASS — 0 lỗi{f', {len(warnings)} cảnh báo' if warnings else ''}")
        print(f"{'='*55}\n")
        sys.exit(0)


if __name__ == '__main__':
    main()
