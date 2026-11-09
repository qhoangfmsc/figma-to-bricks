---
name: bricks-review
description: |
  Visual QA và acceptance review cho Bricks Builder sections — Gate G4.
  Dùng khi: đã upload JSON, có ảnh screenshot WordPress, có ảnh Figma.
  So sánh pixel-level layout, spacing, typography, màu sắc, responsive.
---

# Bricks Section Review — Gate G4

Hướng dẫn thực hiện visual QA để đạt acceptance tiêu chuẩn ≥ 98%.

---

## 🔁 Workflow Review G4

```
1. Thu thập ảnh
   ├── Figma: get_screenshot(node_id) → figma-desktop.png / figma-mobile.png
   └── WordPress: screenshot_templates.py --section sec100

1b. (Khuyến nghị) diff_screenshots.py --figma ... --wp ... → % pixel lệch + heatmap
    — tín hiệu khách quan bổ trợ bước 2, không hard-block (xem AGENTS.md §5b)

2. So sánh từng chiều
   ├── Layout & Structure    (xem §1)
   ├── Spacing & Sizing      (xem §2)
   ├── Typography            (xem §3)
   ├── Colors & Visuals      (xem §4)
   ├── Assets (ảnh/icon)     (xem §5)
   └── Responsive            (xem §6)

3. HARD GATE (bắt buộc TRƯỚC khi được chấm PASS — xem rubric.md §HARD GATE):
   ├── capture_zoom_evidence.py → file crop thật Z1-Z5 (desktop + mobile)
   ├── validate_g4_preflight.py --zoom-dir ... phải exit 0
   └── validate_mobile_overflow.py --page-id <id> --viewport 390 (page đã assemble) phải exit 0

4. Chấm điểm theo rubric.md → Tổng ≥ 98 → PASS

5. Nếu FAIL → ghi rõ delta → patch JSON → re-upload → re-review
```

> ⚠️ Mọi settings key trong file này đã đối chiếu source Bricks 1.12.3 (2026-07-23).
> Khi patch theo review, chỉ dùng key từ `references/element-base-controls.md` /
> `elements-catalog.md` — không tự suy diễn key.

---

## §1 Layout & Structure

**Mục tiêu**: Cây element DOM khớp với Figma layer structure.

### Kiểm tra

| Điểm | Tiêu chí |
|------|---------|
| Số cột (grid/flex) khớp Figma | Đếm columns ở desktop |
| Thứ tự element theo chiều đọc | Top→Bottom, Left→Right |
| Không có element thừa/thiếu | Mọi Figma layer đều có element tương ứng |
| Section không lồng section | Rule cứng — root-only |
| Container centered, max-width đúng | Thường 1200px hoặc theo Figma |

### Cách đo

```
Figma → Inspect panel:
  - Frame width → container max-width (_widthMax, kèm _width: "100%" — xem bricks_rules.md §21)
  - Auto Layout direction → _direction (row/column)
  - Auto Layout gap → _columnGap / _rowGap (KHÔNG dùng _gap — không compile trên
    container/block/div ở 1.12.3, xem bricks_rules.md §2; grid dùng _gridGap)
  - Alignment → _alignItems / _justifyContent
```

---

## §2 Spacing & Sizing

**Mục tiêu**: Padding, margin, gap, width/height sai ≤ 4px.

### Kiểm tra

| Property | Figma source | Bricks key |
|----------|-------------|-----------|
| Section padding top/bottom | Frame padding | `_padding` (object `{top,right,bottom,left}`) |
| Container padding | Frame padding | `_padding` |
| Gap giữa cards/items | Auto Layout gap | `_columnGap` / `_rowGap` (grid: `_gridGap`) — KHÔNG dùng `_gap` |
| Card/block width cố định | Frame width | `_width` |
| Card/block height cố định | Frame height | `_height` |
| Icon size | Frame width/height | `_width`, `_height` (element `icon`: `iconSize`) |

### Script hỗ trợ

```bash
# Đọc spacing thật từ Figma (đối chiếu bằng số, không đoán):
python3 scripts/dump_figma_spacings.py --file-key <key> --node sec100=<node_id>
# So ảnh Figma vs WP (pixel diff + heatmap khoanh vùng lệch):
python3 scripts/diff_screenshots.py --figma <figma.png> --wp <wp.png> --out-dir scratch/g3/diff --label sec100-desktop
```

### Tolerance cho phép

- Padding/margin: ±4px
- Typography size: ±1px  
- Gap: ±4px
- Width cố định: ±8px (do border-box)

---

## §3 Typography

**Mục tiêu**: Font, size, weight, line-height, letter-spacing khớp Figma.

### Kiểm tra

| Property | Figma value | Bricks settings key |
|----------|------------|-------------------|
| Font family | Text → Font | `_typography.font-family` |
| Font size | Text → Size | `_typography.font-size` |
| Font weight | Text → Weight | `_typography.font-weight` |
| Line height | Text → Line H | `_typography.line-height` |
| Letter spacing | Text → Letter | `_typography.letter-spacing` |
| Text align | Text → Align | `_typography.text-align` |
| Text color | Fill color | `_typography.color` (KHÔNG có key `_color` — đã grep toàn source 1.12.3, xem figma-skills/SKILL.md §6) |
| Text transform | Text → Case | `_typography.text-transform` |

### Lưu ý đơn vị

Giữ nguyên **`px`** trực tiếp từ Figma (`48px` → `"48px"`) — KHÔNG quy đổi sang rem
(rule vàng `AGENTS.md` §2 / `figma_rules.md` §3). Tỷ lệ mới dùng `%`.

---

## §4 Colors & Visuals

**Mục tiêu**: Màu sắc chính xác, gradient/shadow đúng hướng.

### Kiểm tra

| Element | Figma source | Bricks key |
|---------|-------------|-----------|
| Background color solid | Fill → Hex | `_background.color.hex` |
| Background gradient | Fill → Gradient | `_gradient` (control RIÊNG ngang hàng `_background` — `_background` KHÔNG có gradient, xem bricks_rules.md §15; hoặc raw CSS qua `_cssCustom`) |
| Border color | Stroke → Color | `_border.color` |
| Border radius | Corner radius | `_border.radius.*` (KHÔNG có key `_borderRadius` top-level) |
| Box shadow | Effect → Drop Shadow | `_boxShadow` (offsets trong `values`) |
| Text color | Text fill | `_typography.color` |
| Overlay | Figma layer opacity | `_background.color` với alpha |

### Cách lấy HEX chính xác từ Figma

```
Figma Inspect → Copy as CSS → `color: #RRGGBB`
Hoặc: Fill → chọn màu → copy Hex
```

---

## §5 Assets (Ảnh / Icon / SVG)

**Mục tiêu**: Đúng ảnh, đúng tỷ lệ, không bị méo/crop sai.

### Kiểm tra

| Asset type | Vấn đề hay gặp | Cách fix |
|------------|---------------|---------|
| Background image | URL chết / sai domain | Lúc build: URL Figma cache (`localhost:3845`). Trước công bố: `rehost_assets.py --apply` (URL chỉ sống trên máy build) |
| Inline image | Bị stretch | Thêm `_objectFit: "cover"` (có gạch dưới — `objectFit` không gạch bị ignore, xem bricks_rules.md §15) |
| SVG icon | Màu không đúng | Element `icon` (icon-font): `iconColor`. SVG qua element `image`: sửa file SVG hoặc CSS `filter` qua `_cssCustom` (`<img>` không nhận `fill`) |
| Logo PNG | Blurry trên Retina | Dùng `@2x` hoặc SVG thay thế |
| Image bị crop | Sai ratio | Điều chỉnh wrapper height |

### Quy trình xử lý ảnh

> Lúc build: dùng trực tiếp URL Figma cache (`localhost:3845/assets/...`) theo `references/external-assets.md`, không cần bước upload/mapping riêng. **Trước khi công bố trang cho khách thật** (mọi môi trường): chạy `python3 scripts/rehost_assets.py <json> --apply` để chuyển ảnh về WP Media rồi re-upload JSON — xem `bricks_rules.md` §11. (`upload_assets.py`/`check_assets.py` không tồn tại — cố ý không viết, xem `AGENTS.md` §5.)

---

## §6 Responsive

**Mục tiêu**: Layout mobile khớp Figma mobile design ≥ 95%.

### Breakpoints Bricks (mặc định)

| Bricks key | Phạm vi áp dụng |
|-----------|-------|
| Desktop (bare key, KHÔNG suffix) | Mọi width — bị override bởi breakpoint hẹp hơn bên dưới |
| `:tablet_portrait` | ≤ 991px |
| `:mobile_landscape` | ≤ 767px |
| `:mobile_portrait` | ≤ 478px |

### Kiểm tra theo strategy

| Strategy | Kiểm tra |
|---------|---------|
| `breakpoint-only` | Settings `tablet_portrait` đúng giá trị |
| `slider-responsive` | `perPage` đổi đúng theo breakpoint |
| `carousel-dual` | Desktop: slider visible; Mobile: scroll div visible |
| `dual-block` | Desktop block hidden mobile, mobile block hidden desktop |

### Chụp ảnh mobile

```bash
python3 scripts/screenshot_templates.py --section sec100 --viewports mobile
```

---

## §7 Interactive States (nếu có)

Kiểm tra hover, focus states nếu Figma có prototype:

| State | Bricks setting |
|-------|--------------|
| Hover background | `_background:hover` |
| Hover text color | `_typography:hover` (color bên trong — không có key `_color`) |
| Hover transform | `_transform:hover` |
| Hover shadow | `_boxShadow:hover` |

---

## 🚦 Quyết định PASS / FAIL

```
Chạy rubric.md → tính tổng điểm

≥ 98 điểm → ✅ G4 PASS → sang section tiếp theo
90–97 điểm → 🟡 MINOR FIX → patch nhỏ → re-review
< 90 điểm  → 🔴 G4 FAIL → patch JSON → re-upload → re-review toàn bộ
```

---

## 📋 Checklist cuối trước khi PASS

- [ ] **HARD GATE**: `validate_g4_preflight.py --zoom-dir ...` exit 0 (kèm file crop Z1-Z5 thật trên đĩa — xem rubric.md §HARD GATE)
- [ ] **Mobile overflow**: `validate_mobile_overflow.py --page-id <id> --viewport 390` exit 0 trên page đã assemble
- [ ] Layout columns/rows đúng số lượng và thứ tự
- [ ] Spacing sai ≤ 4px ở mọi element
- [ ] Font size, weight, line-height khớp Figma
- [ ] Tất cả màu sắc đúng HEX (sai ≤ 5 HEX units là chấp nhận được)
- [ ] Ảnh hiển thị đúng, không méo, không placeholder
- [ ] Mobile layout khớp Figma mobile (hoặc breakpoint-only responsive đúng)
- [ ] Không có element thừa hoặc thiếu
- [ ] CSS đã generated (sync_css=True đã chạy)
- [ ] Không có console error liên quan Bricks
- [ ] (Trước khi công bố cho khách thật) Ảnh đã re-host về WP Media — `rehost_assets.py --apply`, không còn URL `localhost:3845` trong JSON
