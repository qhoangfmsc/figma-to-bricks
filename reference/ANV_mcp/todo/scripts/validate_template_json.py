#!/usr/bin/env python3
"""
validate_template_json.py — Gate G1
Validate JSON Bricks trước khi upload lên set_template_content.

Kiểm tra:
  1. JSON parse hợp lệ
  2. Detect format: clipboard (bricksCopiedElements) hoặc flat array
  3. Flat tree integrity: mọi parent/children tham chiếu nhau 2 chiều
  4. ID format: đúng 6 ký tự alphanumeric, không trùng lặp
  5. Bắt buộc có `source: bricksCopiedElements` và `version` (clipboard format)
  6. Mọi `_cssGlobalClasses` ID phải có định nghĩa trong `globalClasses`
  7. Responsive key syntax hợp lệ
  8. Ảnh phải có `url` (Figma cache localhost:3845 HOẶC URL đã re-host trên WP đều
     hợp lệ — quy tắc chung mọi môi trường); chỉ có WP media `id` không có `url` là lỗi
     (id không resolve khi build bằng set_template_content). Nếu còn URL Figma cache,
     in cảnh báo gộp nhắc chạy rehost_assets.py trước khi công bố trang cho khách thật.

Usage:
  python3 validate_template_json.py path/to/section.json
  python3 validate_template_json.py path/to/section.json --strict
"""

import json
import re
import sys
from pathlib import Path


VALID_BREAKPOINTS = {'tablet_portrait', 'mobile_landscape', 'mobile_portrait'}
VALID_ID_PATTERN = re.compile(r'^[a-z0-9]{6}$')

# Responsive key pattern: setting:breakpoint hoặc setting:breakpoint:pseudo
RESPONSIVE_KEY_PATTERN = re.compile(
    r'^_[a-zA-Z]+(?::(?:tablet_portrait|mobile_landscape|mobile_portrait))?(?::(?:hover|focus|active|visited))?$'
)

errors = []
warnings = []


def err(msg: str):
    errors.append(f"  ❌ {msg}")


def warn(msg: str):
    warnings.append(f"  ⚠️  {msg}")


def validate_id(id_val: str, context: str):
    if not VALID_ID_PATTERN.match(str(id_val)):
        err(f"ID không hợp lệ '{id_val}' tại {context} — cần đúng 6 ký tự [a-z0-9]")
        return False
    return True


MEDIA_KEYS = {'image', 'logo', 'lightboxImage'}


def _walk_media_dicts(node, path=''):
    """Yield (path, dict) cho mọi control ảnh (`image`, `logo`, `lightboxImage`,
    `icon.svg`) ở bất kỳ độ sâu nào trong 1 cây settings."""
    if isinstance(node, dict):
        for key, value in node.items():
            new_path = f"{path}.{key}" if path else key
            if key in MEDIA_KEYS and isinstance(value, dict):
                yield new_path, value
            elif key == 'icon' and isinstance(value, dict) and isinstance(value.get('svg'), dict):
                yield f"{new_path}.svg", value['svg']
            yield from _walk_media_dicts(value, new_path)
    elif isinstance(node, list):
        for i, item in enumerate(node):
            yield from _walk_media_dicts(item, f"{path}[{i}]")


FIGMA_CACHE_HOST = 'localhost:3845'


def check_image_urls(elements: list):
    """Rule vàng (AGENTS.md §2) — áp dụng CHUNG mọi môi trường (không phân biệt
    local/remote): mọi control ảnh phải có `url`. Hai họ URL đều hợp lệ:
      - Figma cache (`localhost:3845/assets/...`) — chuẩn lúc build; chỉ resolve
        trên máy build khi Figma Desktop đang mở.
      - URL trên chính site WP (`/wp-content/uploads/...`) — sau khi re-host bằng
        `rehost_assets.py`, bắt buộc trước khi công bố trang cho khách thật.
    Chỉ có WP media `id` mà không có `url` là lỗi cứng (id không resolve khi ghi
    JSON trực tiếp qua set_template_content, xem references/external-assets.md)."""
    figma_cache_paths = []
    for el in elements:
        el_id = el.get('id', '')
        settings = el.get('settings', {}) or {}
        for media_path, media in _walk_media_dicts(settings):
            url = media.get('url')
            media_id = media.get('id')
            if not url:
                if media_id:
                    err(
                        f"Element '{el_id}' setting '{media_path}': chỉ có WP media 'id' "
                        f"({media_id}), thiếu 'url' — ảnh sẽ vỡ khi upload qua set_template_content "
                        f"(id không resolve ngoài UI import). Dùng URL Figma cache hoặc URL đã re-host."
                    )
                continue
            if FIGMA_CACHE_HOST in url:
                figma_cache_paths.append(f"{el_id}:{media_path}")
    if figma_cache_paths:
        warn(
            f"{len(figma_cache_paths)} ảnh đang dùng URL Figma cache ({FIGMA_CACHE_HOST}) — hợp lệ "
            f"trong lúc build (cần Figma Desktop đang mở trên máy build), nhưng khách truy cập "
            f"từ máy khác sẽ KHÔNG thấy ảnh. Trước khi công bố trang: chạy "
            f"`python3 scripts/rehost_assets.py <json_file> --apply` để chuyển ảnh về WP Media."
        )


def check_css_custom_root(elements: list):
    """`%root%` CHỈ được builder UI thay thế phía client trước khi POST
    (xem bricks_rules.md §13). Pipeline ghi JSON thẳng qua REST bỏ qua bước đó
    → `%root%` ra CSS nguyên văn, selector vô nghĩa, browser bỏ qua TOÀN BỘ
    khối `_cssCustom` đó mà không báo lỗi.

    Đây là lỗi câm điển hình: G1/G2/G2.5 cũ vẫn PASS (JSON hợp lệ, file CSS có
    tồn tại và có nội dung), chỉ lộ ra khi soi computed style trên trang thật.
    Đã dính thật ở phiên 2026-07-31 (section `sec-uu-dai`: mất nền gradient nút,
    mất chữ gradient, mất mask notch, mất nowrap) → nâng thành lỗi cứng ở G1.

    Cách sửa: trong script sinh JSON, chạy
        settings[k] = settings[k].replace("%root%", f"#brxe-{element_id}")
    cho mọi key bắt đầu bằng `_cssCustom` (gồm cả biến thể `:breakpoint`).
    """
    for el in elements:
        el_id = el.get('id', '')
        settings = el.get('settings', {}) or {}
        for key, value in settings.items():
            if not key.startswith('_cssCustom'):
                continue
            if isinstance(value, str) and '%root%' in value:
                err(
                    f"Element '{el_id}' setting '{key}': còn chứa `%root%` chưa "
                    f"thay thế — CSS sẽ compile ra selector `%root%{{...}}` không "
                    f"khớp gì cả và bị browser bỏ qua trong im lặng. "
                    f"Thay bằng `#brxe-{el_id}` trước khi upload (bricks_rules.md §13)."
                )


_BR_HIDE_RE = re.compile(r'br\s*\{[^}]*display\s*:\s*none', re.IGNORECASE)
_BR_GLUED_RE = re.compile(r'\S<br\s*/?>\S', re.IGNORECASE)


def check_css_id_vs_root_selector(elements: list):
    """Element có `_cssId` (CSS ID tuỳ chỉnh, vd anchor `#dang-ky`) được Bricks render
    `id="<_cssId>"` THAY CHO `id="brxe-<id>"` (Helpers::get_element_attribute_id) — CSS do
    Bricks tự sinh đi theo ID mới, nhưng `_cssCustom` đã thay `%root%` → `#brxe-<id>` thì
    không còn khớp phần tử nào → toàn bộ khối CSS tuỳ biến bị bỏ qua trong im lặng.

    Lỗi câm thật phiên 2026-10-12 (LDP Grow Smarter, section đăng ký `#dang-ky`): mất ảnh nền
    section, G1/G2/G2.5/G4 preflight đều PASS. Cách sửa: với element có `_cssId`, thay
    `%root%` bằng `#<_cssId>` (bricks_rules.md §32).
    """
    for el in elements:
        el_id = el.get('id', '')
        settings = el.get('settings', {}) or {}
        css_id = (settings.get('_cssId') or '').strip()
        if not css_id:
            continue
        for key, value in settings.items():
            if key.startswith('_cssCustom') and isinstance(value, str) and f'#brxe-{el_id}' in value:
                err(
                    f"Element '{el_id}' có `_cssId: {css_id}` nhưng '{key}' dùng selector "
                    f"`#brxe-{el_id}` — Bricks render id=\"{css_id}\" nên selector này không khớp, "
                    f"CSS bị bỏ qua im lặng. Dùng `#{css_id}` (bricks_rules.md §32)."
                )


def check_hidden_br_word_gap(elements: list):
    """Ẩn `<br>` theo breakpoint (`_cssCustom:<bp>` có `br{display:none}`) mà text
    viết dính `A<br>B` (không có khoảng trắng hai bên) → ở breakpoint đó 2 từ dính
    liền thành `AB`. `<br>` bị `display:none` không sinh khoảng trắng nào.

    Lỗi câm: G1/G2/G2.5/G4 preflight và mobile-overflow đều PASS, diff pixel cũng
    gần như không nhích — chỉ lộ khi đọc chữ trên screenshot. Dính thật phiên
    2026-10-07 (template 9319: "VIỆT NAM<br>TỐC" → tablet/mobile "NAMTỐC").

    Cách sửa: viết `A <br>B` — khoảng trắng trước `<br>` bị trình duyệt nuốt khi
    `<br>` hiện (không đổi layout desktop) và thành dấu cách khi `<br>` bị ẩn.
    """
    for el in elements:
        settings = el.get('settings', {}) or {}
        hides_br = any(
            k.startswith('_cssCustom') and isinstance(v, str) and _BR_HIDE_RE.search(v)
            for k, v in settings.items()
        )
        text = settings.get('text')
        if hides_br and isinstance(text, str) and _BR_GLUED_RE.search(text):
            err(
                f"Element '{el.get('id', '')}': text có `<br>` dính liền 2 từ "
                f"({_BR_GLUED_RE.search(text).group(0)!r}) trong khi `_cssCustom` ẩn `br` "
                f"theo breakpoint → 2 từ sẽ dính nhau khi `<br>` bị ẩn. "
                f"Thêm dấu cách trước `<br>` (vd `A <br>B`)."
            )


def validate_elements(elements: list, global_classes: list, strict: bool = False):
    """Core validation cho mảng elements."""
    id_set = {}  # id -> index

    # Pass 1: Kiểm tra ID và thu thập map
    for i, el in enumerate(elements):
        el_id = el.get('id', '')
        if not el_id:
            err(f"Element [{i}] thiếu field 'id'")
            continue
        if el_id in id_set:
            err(f"ID trùng lặp '{el_id}' — xuất hiện tại index {id_set[el_id]} và {i}")
        else:
            validate_id(el_id, f"element[{i}]")
            id_set[el_id] = i

        if 'name' not in el:
            err(f"Element '{el_id}' thiếu field 'name'")
        if 'parent' not in el:
            err(f"Element '{el_id}' thiếu field 'parent'")
        if 'children' not in el:
            err(f"Element '{el_id}' thiếu field 'children'")

    # Pass 2: Kiểm tra parent/children reciprocity
    for el in elements:
        el_id = el.get('id', '')
        parent = el.get('parent', '')
        children = el.get('children', [])

        # Check parent tồn tại (trừ root = "0")
        if parent != "0" and parent not in id_set:
            err(f"Element '{el_id}': parent '{parent}' không tồn tại trong mảng")

        # Check children tồn tại và point back
        for child_id in children:
            if child_id not in id_set:
                err(f"Element '{el_id}': children '{child_id}' không tồn tại trong mảng")
            else:
                child_el = elements[id_set[child_id]]
                if child_el.get('parent') != el_id:
                    err(f"Ràng buộc 2 chiều lỗi: '{el_id}' → children '{child_id}' nhưng '{child_id}'.parent = '{child_el.get('parent')}'")

    # Pass 2b: Chiều ngược lại — nếu X khai parent = Y, thì Y.children PHẢI chứa X.
    # (Pass 2 chỉ đi theo chiều children[] → parent; bug thật gặp phải 2026-07-16:
    #  helper function set đúng `child.parent = parent_id` nhưng quên gọi add_child()
    #  nên `parent.children` không có id con — Pass 2 không bắt được vì nó không lặp
    #  qua nhánh này. Phải quét riêng theo chiều parent → children.)
    for el in elements:
        el_id = el.get('id', '')
        parent = el.get('parent', '')
        if parent == "0" or parent not in id_set:
            continue  # đã báo lỗi ở trên nếu parent không tồn tại
        parent_el = elements[id_set[parent]]
        if el_id not in parent_el.get('children', []):
            err(
                f"Ràng buộc 2 chiều lỗi: '{el_id}'.parent = '{parent}' nhưng "
                f"'{parent}'.children không chứa '{el_id}' — element sẽ không được Bricks render "
                f"(builder chỉ dựng cây theo children[], không theo parent)."
            )

    # Pass 3: Kiểm tra globalClasses
    global_class_ids = {gc.get('id') for gc in global_classes if 'id' in gc}
    for el in elements:
        el_id = el.get('id', '')
        settings = el.get('settings', {})
        css_global = settings.get('_cssGlobalClasses', [])
        for class_id in css_global:
            if class_id not in global_class_ids:
                err(f"Element '{el_id}': _cssGlobalClasses tham chiếu class '{class_id}' không có trong globalClasses")

    # Pass 4: Spot-check responsive keys
    for el in elements:
        el_id = el.get('id', '')
        settings = el.get('settings', {})
        for key in settings.keys():
            if ':' in key:
                parts = key.split(':')
                if len(parts) >= 2 and parts[1] not in VALID_BREAKPOINTS and parts[1] not in {'hover', 'focus', 'active', 'visited'}:
                    warn(f"Element '{el_id}': responsive key '{key}' có breakpoint '{parts[1]}' không chuẩn")

    # Pass 4b: Bricks 1.12.3 schema traps (false visual QA — keys bị ignore silently)
    for el in elements:
        el_id = el.get('id', '')
        settings = el.get('settings', {}) or {}
        for key in list(settings.keys()):
            base = key.split(':')[0]
            if base == '_borderRadius':
                err(
                    f"Element '{el_id}': key '{key}' KHÔNG tồn tại trên Bricks 1.12.3 — "
                    f"radius phải nằm trong `_border.radius` (xem element-base-controls.md). "
                    f"Key này bị ignore → card vuông / border lệch Figma."
                )
            if base == '_minWidth' or base == '_maxWidth':
                correct = '_widthMin' if base == '_minWidth' else '_widthMax'
                err(
                    f"Element '{el_id}': key '{key}' sai tên — dùng `{correct}` "
                    f"(base.php). Key sai → mobile card co/tràn width."
                )
            if base == '_gap' and el.get('name') in ('container', 'block', 'div', 'section'):
                err(
                    f"Element '{el_id}' ({el.get('name')}): `_gap` không compile trên nestable — "
                    f"dùng `_columnGap` / `_rowGap`."
                )
        border = settings.get('_border')
        if isinstance(border, dict) and any(k.startswith('_border') for k in settings if k != '_border'):
            pass  # ok to have _border:tablet_portrait
        # If element has cssCustom border but _border missing radius while claiming rounded cards
        if isinstance(border, dict) and 'width' in border and 'radius' not in border:
            warn(
                f"Element '{el_id}': `_border` có width nhưng thiếu `radius` — "
                f"nếu Figma bo góc, thêm `_border.radius`."
            )

    # Pass 4c: Ảnh phải có URL external (Figma cache), không chỉ dựa vào WP media id
    check_image_urls(elements)
    check_css_custom_root(elements)
    check_hidden_br_word_gap(elements)
    check_css_id_vs_root_selector(elements)

    # Pass 5: Root elements check
    root_elements = [el for el in elements if el.get('parent') == '0']
    section_roots = [el for el in root_elements if el.get('name') == 'section']
    non_section_roots = [el for el in root_elements if el.get('name') != 'section']

    if not root_elements:
        err("Không có root element nào (parent = '0')")
    if non_section_roots and strict:
        warn(f"Root element không phải section: {[el.get('name') for el in non_section_roots]}")


def validate_clipboard_format(data: dict, strict: bool):
    """Validate bricksCopiedElements clipboard format."""
    print("  ℹ️  Format: clipboard (bricksCopiedElements)")

    if data.get('source') != 'bricksCopiedElements':
        err("Thiếu hoặc sai 'source' — phải là 'bricksCopiedElements'")
    if 'version' not in data:
        warn("Thiếu 'version' field")
    if 'sourceUrl' not in data:
        warn("Thiếu 'sourceUrl' field")

    content = data.get('content', [])
    if not isinstance(content, list):
        err("'content' phải là mảng")
        return
    if not content:
        err("'content' rỗng — không có element nào")
        return

    global_classes = data.get('globalClasses', [])
    validate_elements(content, global_classes, strict)


def validate_flat_array(data: list, strict: bool):
    """Validate flat array format (MCP upload)."""
    print("  ℹ️  Format: flat array (MCP upload)")
    validate_elements(data, [], strict)


def main():
    args = sys.argv[1:]
    if not args:
        print("Usage: python3 validate_template_json.py <file.json> [--strict]")
        sys.exit(1)

    filepath = args[0]
    strict = '--strict' in args

    print(f"\n{'='*55}")
    print(f"  Gate G1 — Validate Template JSON")
    print(f"  File: {filepath}")
    print(f"  Mode: {'STRICT' if strict else 'normal'}")
    print(f"{'='*55}")

    # Đọc file
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            raw = f.read()
    except FileNotFoundError:
        print(f"\n❌ FAIL — File không tìm thấy: {filepath}")
        sys.exit(1)

    # Parse JSON
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"\n❌ FAIL — JSON parse lỗi: {e}")
        sys.exit(1)

    print(f"  ✅ JSON parse OK")

    # Phân loại format và validate
    if isinstance(data, dict) and 'content' in data:
        validate_clipboard_format(data, strict)
    elif isinstance(data, list):
        validate_flat_array(data, strict)
    else:
        err("Format không nhận dạng được — cần là dict với 'content' hoặc flat array")

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
        print(f"  ❌ G1 FAIL — {len(errors)} lỗi, {len(warnings)} cảnh báo")
        print(f"{'='*55}\n")
        sys.exit(1)
    else:
        print(f"{'='*55}")
        print(f"  ✅ G1 PASS — 0 lỗi{f', {len(warnings)} cảnh báo' if warnings else ''}")
        print(f"{'='*55}\n")
        sys.exit(0)


if __name__ == '__main__':
    main()
