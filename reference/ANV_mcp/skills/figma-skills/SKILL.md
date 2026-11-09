---
name: figma-ui
description: |
  Parse Figma design structures, map to Bricks Builder JSON.
  Dùng khi: nhận Figma URL → cần phân tích layout, extract tokens, xác định responsive strategy.
  Tools: get_metadata (scan), get_design_context (deep), get_variable_defs (tokens), get_screenshot (G4 compare).
---

# Figma → Bricks Builder Mapping Skill

> Verified against Bricks 1.12.3 source (theme path: .../themes/bricks) — 2026-07-14. Mục §2/§3/§6 đã sửa 3 lỗi mapping thật (`_gap` không tồn tại, `_padding` phải là object không phải chuỗi, `_color` không tồn tại — dùng `_typography.color`).

Hướng dẫn đọc Figma qua MCP và chuyển đổi sang Bricks Builder JSON chính xác.

---

## ⚡ Workflow chuẩn — "Scan → Zoom → Build"

```
1. SCAN    get_metadata(node_id)
           → Đọc layer tree nhẹ, lấy đúng node IDs của từng section
           → KHÔNG get_design_context cho toàn page (quá lớn, bị truncate)

2. ZOOM    get_design_context(section_node_id)
           → Deep data cho TỪNG section riêng lẻ
           → Layout, spacing, typography, colors, components

3. TOKENS  get_variable_defs(file_key)
           → CSS design tokens (--color-primary, --spacing-md...)
           → Chạy 1 lần đầu phiên, lưu vào plan file

4. BUILD   Sinh JSON Bricks từ data trên + rules/bricks_rules.md

5. COMPARE get_screenshot(section_node_id) → so sánh với WordPress screenshot
           → Gate G4: diff layout, spacing, colors
```

---

## §1 get_metadata — Scan nhẹ

**Dùng để**: Map cấu trúc trang, tìm node IDs section, kiểm tra layer names.

**Output quan trọng**:
- `id` — node ID (dạng `123:456`) dùng cho các tool tiếp theo
- `name` — tên layer (phải khớp với plan file)
- `type` — FRAME, GROUP, TEXT, VECTOR, INSTANCE...
- `absoluteBoundingBox` — vị trí và kích thước

**Best practices**:
- Chạy TRƯỚC `get_design_context`
- Nhận diện section root = FRAME con trực tiếp của PAGE
- Note lại `desktop_node_id` và `mobile_node_id` cho từng section vào plan file

---

## §2 get_design_context — Deep Analysis

**Dùng để**: Lấy đầy đủ layout, style, spacing, fonts, màu sắc của 1 section.

**⚠️ Quy tắc bắt buộc**:
- Luôn target **section frame**, KHÔNG target toàn page/file
- Nếu response bị truncate → chia nhỏ hơn (target sub-frame)
- Chạy RIÊNG từng section, không gộp

**Output → map sang Bricks**:

| Figma property | Bricks setting |
|---------------|---------------|
| `layoutMode: HORIZONTAL` | `_direction: "row"` |
| `layoutMode: VERTICAL` | `_direction: "column"` |
| `itemSpacing` | `_columnGap`/`_rowGap` (KHÔNG dùng `_gap` — không compile trên container ở Bricks 1.12.3, xem `todo/rules/bricks_rules.md` mục 2) |
| `paddingTop/Bottom/Left/Right` | `_padding: {"top":"Xpx","right":"Xpx","bottom":"Xpx","left":"Xpx"}` (object bắt buộc — control `type: spacing`, KHÔNG phải chuỗi shorthand `"top right bottom left"`; xác thực `includes/assets.php` case `'spacing'`) |
| `primaryAxisAlignItems: CENTER` | `_justifyContent: "center"` (grid dùng `_justifyContentGrid`) |
| `counterAxisAlignItems: CENTER` | `_alignItems: "center"` (grid dùng `_alignItemsGrid`) |
| `fills[0].color` | `_background.color.hex` (nền) hoặc `_typography.color.hex` (màu chữ — KHÔNG có key `_color` độc lập, đã grep toàn source không thấy) |
| `style.fontSize` | `_typography.font-size` |
| `style.fontWeight` | `_typography.font-weight` |
| `style.lineHeightPx` | `_typography.line-height` |
| `cornerRadius` | `_border.radius.*` |
| `effects[].type: DROP_SHADOW` | `_boxShadow` |

---

## §3 get_variable_defs — Design Tokens

**Dùng để**: Lấy CSS variables từ Figma Variables panel.

Ghi vào plan file để dùng trong JSON:
```json
"color": { "raw": "var(--color-primary)" }
"_columnGap": "var(--spacing-md)"
```

---

## §4 get_screenshot — So sánh G4

**Dùng để**: Lấy ảnh Figma node cho Gate G4 visual comparison.

**Workflow G4**:
1. `get_screenshot(section_node_id)` → figma-sec100-desktop.png
2. `screenshot_templates.py --section sec100` → wp-sec100-desktop.png
3. So sánh 2 ảnh theo `review-skill/rubric.md` → chấm điểm 100pt

---

## §5 Xác định Responsive Strategy

Sau khi scan metadata, so sánh desktop frame vs mobile frame:

```
Mobile frame tồn tại?
├─ KHÔNG → "n/a"
└─ CÓ → So sánh DOM:
    ├─ Cùng component, chỉ stack/co → "breakpoint-only"
    ├─ Desktop slider + Mobile slider (perPage đổi) → "slider-responsive"
    ├─ Desktop slider + Mobile scroll div → "carousel-dual"
    └─ DOM khác hoàn toàn → "dual-block"
```

---

## §6 Extract Layout Numbers

### Spacing/Padding
```
Figma: paddingTop=80, paddingBottom=80, paddingLeft=120, paddingRight=120
→ Bricks: "_padding": {"top":"80px","right":"120px","bottom":"80px","left":"120px"}
```
(Object bắt buộc — control `_padding`/`_margin` là `type: spacing` trong `includes/elements/base.php`, KHÔNG nhận chuỗi shorthand CSS.)

### Gap
```
Figma: itemSpacing=24 (Horizontal Auto Layout) → "_columnGap": "24px"
Figma: itemSpacing=24 (Vertical Auto Layout)   → "_rowGap": "24px"
```
(`_gap` không tồn tại/không compile trên `section`/`container`/`block`/`div` — xem `todo/rules/bricks_rules.md` mục 2. Với `_display: grid` dùng `_gridGap`.)

### Typography
```
Figma: fontSize=48, fontWeight=700, lineHeightPx=57.6
→ _typography: { "font-size": "48px", "font-weight": "700", "line-height": "1.2" }
```

### Color (Figma RGBA → HEX)
```
Figma: color = {r:0.145, g:0.388, b:0.922, a:1}
→ r*255=37, g*255=99, b*255=235 → HEX: #2563EB
→ Bricks (màu chữ): "_typography": { "color": { "hex": "#2563EB" } }
→ Bricks (màu nền): "_background": { "color": { "hex": "#2563EB" } }
```
(Không có key `_color` độc lập — đã grep toàn bộ `includes/` không thấy; xác thực 2026-07-14.)

### Border radius
```
Figma: cornerRadius=12
→ "_border": { "radius": { "top":"12px","right":"12px","bottom":"12px","left":"12px" } }
```

---

## §7 Figma → Bricks Widget nhanh

| Figma layer | Bricks widget | Lưu ý |
|------------|--------------|-------|
| Frame (Vertical Auto Layout) | `block` (`_direction: column`) | |
| Frame (Horizontal Auto Layout) | `block` (`_direction: row`) | |
| Text heading style | `heading` | Chọn `tag: h1/h2/h3` |
| Text body style | `text-basic` | |
| Rectangle + image fill | `block` + `image` con | Luôn bọc wrapper |
| Button component | `button` | |
| Icon + label | `block` (row) + `icon` + `text-basic` | |
| Carousel component | `slider-nested` + Splide config | |

Chi tiết → `skills/bricks-skills/snippets/widget-map.md`

---

## Reference Files

- [figma-to-ui-rules.md](figma-to-ui-rules.md) — Mapping table chi tiết
- [MAPPING-FIGMA-FLOW.md](MAPPING-FIGMA-FLOW.md) — Pipeline PLAN→DO→DONE
- `todo/rules/bricks_rules.md` — Bricks JSON rules + scripts
- `skills/bricks-skills/snippets/widget-map.md` — Widget lookup
- `skills/bricks-skills/review-skill/rubric.md` — G4 scoring rubric
