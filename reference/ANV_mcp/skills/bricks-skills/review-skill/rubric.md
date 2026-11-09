# Rubric Chấm Điểm — Gate G4 Visual Acceptance

> Dùng rubric này sau khi có ảnh chụp WordPress và ảnh Figma.
> Tổng điểm tối đa: **100 điểm**.
> Acceptance threshold: **≥ 98 điểm**.

### Quan hệ 3 ngưỡng số (đừng nhầm lẫn — 3 thang đo khác nhau)

| Con số | Thang đo | Dùng ở đâu |
|--------|----------|-----------|
| **≥ 95%** | % pixel similarity (`diff_screenshots.py`) | Gate chuyển phase trong build (Phase 3→4, `bricks_rules.md` §12) — điều kiện cần để đi tiếp, KHÔNG phải điểm acceptance |
| **< 90%** | % pixel similarity | Ngưỡng `--diff-warn-below` in cảnh báo trong preflight — buộc tự soi heatmap trước khi chấm |
| **≥ 98 điểm** | Điểm rubric A–F (file này) | Acceptance G4 cuối cùng — do agent chấm SAU khi HARD GATE pass |

---

## Cách dùng

1. So sánh ảnh chụp WordPress vs Figma (desktop + mobile)
   - Khuyến nghị (2026-07-20, không bắt buộc): chạy `scripts/diff_screenshots.py --figma ... --wp ...` trước —
     cho ra % pixel lệch + heatmap khoanh vùng. Đây là tín hiệu khách quan bổ trợ, không thay việc tự chấm dưới đây
     (nội dung thật khác placeholder vẫn ra diff cao mà không phải lỗi) — nhưng nếu similarity thấp mà vẫn định
     chấm PASS, phải tự soi heatmap trước, tự giải trình lý do trong note.
2. Đánh giá từng dimension bên dưới
3. Cộng điểm → quyết định PASS / MINOR FIX / FAIL
4. Ghi note cụ thể cho mọi điểm bị trừ

---

## A. Layout & Structure — 25 điểm

| # | Tiêu chí | Điểm tối đa | Điểm đạt | Note |
|---|---------|------------|----------|------|
| A1 | Số cột / rows đúng theo Figma (desktop) | 5 | | |
| A2 | Thứ tự element đọc đúng (top→bottom, left→right) | 4 | | |
| A3 | Container max-width đúng (sai ≤ 20px) | 4 | | |
| A4 | Alignment (center, start, space-between...) đúng | 4 | | |
| A5 | Không element thừa / thiếu | 4 | | |
| A6 | Section là root element, không bị lồng | 4 | | |
| **Tổng A** | | **25** | **/25** | |

### Hướng dẫn chấm A

- **A1 FULL (5đ)**: Đúng hoàn toàn số cột, thứ tự card, flex direction
- **A1 -2đ**: Sai 1 cột hoặc sai thứ tự 1 element
- **A1 -5đ**: Layout sai hoàn toàn (ví dụ row thành column)

---

## B. Spacing & Sizing — 25 điểm

| # | Tiêu chí | Điểm tối đa | Điểm đạt | Note |
|---|---------|------------|----------|------|
| B1 | Section padding top/bottom sai ≤ 4px | 6 | | |
| B2 | Container padding sai ≤ 4px | 4 | | |
| B3 | Gap giữa items sai ≤ 4px | 5 | | |
| B4 | Width/height element cố định sai ≤ 8px | 5 | | |
| B5 | Icon / image size đúng | 5 | | |
| **Tổng B** | | **25** | **/25** | |

### Hướng dẫn chấm B

- **±0–4px**: Điểm đầy đủ
- **±5–8px**: Trừ 50% điểm tiêu chí đó
- **>8px**: 0 điểm tiêu chí đó
- **Dùng DevTools**: Inspect → Computed → padding/margin/width/height

---

## C. Typography — 20 điểm

| # | Tiêu chí | Điểm tối đa | Điểm đạt | Note |
|---|---------|------------|----------|------|
| C1 | Font family đúng (heading + body) | 4 | | |
| C2 | Font size đúng (sai ≤ 1px) | 5 | | |
| C3 | Font weight đúng | 3 | | |
| C4 | Line-height đúng (sai ≤ 0.1) | 4 | | |
| C5 | Text align đúng | 2 | | |
| C6 | Letter-spacing (nếu Figma có) | 2 | | |
| **Tổng C** | | **20** | **/20** | |

### Hướng dẫn chấm C

- **C1**: Google Fonts phải load đúng tên font (check Network tab)
- **C2**: Dùng DevTools → `font-size` computed value
- **C4**: Ký hiệu `1.2` = 1.2 × font-size; `24px` = absolute

---

## D. Colors & Visuals — 15 điểm

| # | Tiêu chí | Điểm tối đa | Điểm đạt | Note |
|---|---------|------------|----------|------|
| D1 | Background color / gradient đúng | 4 | | |
| D2 | Text color đúng (sai ≤ #05 hex) | 4 | | |
| D3 | Border color + radius đúng | 3 | | |
| D4 | Box shadow / effect đúng | 2 | | |
| D5 | Overlay / transparency đúng | 2 | | |
| **Tổng D** | | **15** | **/15** | |

### Hướng dẫn chấm D

- **HEX tolerance**: `#2563EB` vs `#2562EA` (Δ1) → PASS
- **Gradient direction**: sai 10° → trừ 2đ; sai chiều hoàn toàn → 0đ
- **Dùng**: Browser Color Picker extension hoặc DevTools `color` computed

---

## E. Assets (Ảnh / Icon) — 10 điểm

| # | Tiêu chí | Điểm tối đa | Điểm đạt | Note |
|---|---------|------------|----------|------|
| E1 | Đúng ảnh (không dùng placeholder) | 4 | | |
| E2 | Tỷ lệ ảnh không bị méo / stretch | 3 | | |
| E3 | Icon / SVG hiển thị đúng màu, size | 3 | | |
| **Tổng E** | | **10** | **/10** | |

### Hướng dẫn chấm E

- **E1 FAIL**: Ảnh placeholder, broken image icon → 0đ toàn E
- **E2**: `object-fit: cover` → không méo → PASS
- **E3**: SVG màu khác Figma → trừ 1–2đ

---

## F. Responsive (Mobile) — 5 điểm

| # | Tiêu chí | Điểm tối đa | Điểm đạt | Note |
|---|---------|------------|----------|------|
| F1 | Layout mobile khớp Figma mobile | 3 | | |
| F2 | Không overflow ngang trên mobile | 2 | | |
| **Tổng F** | | **5** | **/5** | |

### Hướng dẫn chấm F

- Dùng ảnh `sec100-mobile.png` vs Figma mobile frame
- **F2** (2026-07-22 cập nhật — không chỉ nhìn mắt): chạy `python3 scripts/validate_mobile_overflow.py --page-id <id> --viewport 390` trên **page thật đã assemble** — đo `document.scrollWidth` thật, không phải "mở DevTools nhìn xem có thanh cuộn không". Full-page screenshot vẫn có thể "trông ổn" dù nội dung tràn ~3x (sự cố 2026-07-22, xem `bricks_rules.md` §21) vì Playwright vẫn chụp đúng kích thước ảnh yêu cầu — chỉ số `scrollWidth` mới lộ tràn ngang thật.
- **⚠️ F2 FAIL = G4 FAIL TOÀN BÀI (2026-07-23)**: script exit 1 → kết quả review là **FAIL bất kể tổng điểm** — không phải chỉ trừ 2 điểm. Lý do: F chỉ chiếm 5/100 điểm nên về số học một trang tràn ngang toàn bộ vẫn có thể đạt 98 — trong khi sự cố nghiêm trọng nhất từng xảy ra (2026-07-22, vỡ mobile 4 trang) chính là loại lỗi này. Tràn ngang mobile là lỗi chặn, không phải lỗi trừ điểm.

---

## 📊 Tổng Kết

```
A (Layout)    : ___/25
B (Spacing)   : ___/25
C (Typography): ___/20
D (Colors)    : ___/15
E (Assets)    : ___/10
F (Responsive): ___/ 5
─────────────────────
TOTAL         : ___/100
```

---

## 🚦 Quyết định

| Tổng điểm | Quyết định | Hành động |
|----------|-----------|---------|
| **98–100** | ✅ **G4 PASS** | Sang section tiếp theo |
| **90–97** | 🟡 **MINOR FIX** | Patch 1–2 điểm nhỏ → re-review nhanh |
| **< 90** | 🔴 **G4 FAIL** | Patch JSON → re-upload → full review |

> **Điều kiện chặn bất kể tổng điểm**: `validate_mobile_overflow.py` FAIL (xem F2) hoặc G4 preflight FAIL → 🔴 **G4 FAIL** dù điểm ≥ 98.

---

## 🛑 HARD GATE — Cấm false-PASS (bắt buộc trước khi ghi DONE)

> Full-page “trông giống” **không đủ**. Session 2026-07-14: agent báo ≥98% nhưng user annotate mới lộ border schema sai, `Chỉ từ` wrap, mobile width.

### Bước 0 — Zoom evidence + Preflight script (máy chạy, không tự chấm điểm bằng mắt)

> **2026-07-14 cập nhật**: checklist Z1-Z5 trước đây chỉ là bước agent tự khai đã zoom-compare bằng mắt — không có gì bắt buộc kiểm tra được, nên vẫn lọt lỗi. Giờ bắt buộc có **file crop thật trên đĩa** cho từng vùng Z1-Z5 trước khi preflight có thể PASS.

```bash
# từ thư mục todo/
python3 scripts/validate_template_json.py bricks-json/<sec>.json

# 1. Chụp crop THẬT cho từng vùng Z1-Z5 (chọn #brxe-{id} tương ứng), desktop + mobile:
python3 scripts/capture_zoom_evidence.py --url <page_url> --viewport desktop \
  --out-dir scratch/g3/zoom \
  --element <id_card_featured>:card-border \
  --element <id_price_row>:price-row \
  --element <id_cta>:cta
python3 scripts/capture_zoom_evidence.py --url <page_url> --viewport mobile \
  --out-dir scratch/g3/zoom \
  --element <id_mobile_scroll>:mobile-width

# 2. Preflight — FAIL nếu thiếu --zoom-dir hoặc thiếu evidence:
python3 scripts/validate_g4_preflight.py bricks-json/<sec>.json \
  --template-id <ID> \
  --desktop scratch/g3/<sec>-desktop.png \
  --mobile scratch/g3/<sec>-mobile.png \
  --zoom-dir scratch/g3/zoom
```

Preflight FAIL → **cấm** viết `G4 ≥98%` / `DONE` vào `infor_todo.md`.

### Bước 1 — Zoom checklist (bắt buộc, không chỉ full-page)

So Figma node vs **file crop** (`scratch/g3/zoom/<label>-<viewport>.png`, không phải nhìn mắt trên full-page) cho **từng** mục (desktop + mobile):

| # | Vùng zoom | Label crop gợi ý | Pass nếu |
|---|-----------|------------------|----------|
| Z1 | Border + radius 1 card featured | `card-border` | 4 cạnh nhìn thấy; bo góc đúng; CSS có `border-radius` |
| Z2 | Hàng giá `Chỉ từ` + số + `VNĐ/…` | `price-row` | **một dòng** (nowrap); không cắt chữ |
| Z3 | CTA primary / secondary | `cta` | Đủ nút, không bị art che, radius pill |
| Z4 | Mobile card width | `mobile-width` | Đúng strategy (vd. 280px + peek); **không** co `min-width:0`; scroll nằm trong container |
| Z5 | Gap / padding vùng lệch dễ miss | `spacing-risk` | So spacer Figma ≤ 4–8px |

### Bước 2 — Evidence tối thiểu để PASS

- [ ] Preflight script exit 0 (bao gồm check `--zoom-dir`)
- [ ] Screenshot full-page D+M trên disk
- [ ] Zoom evidence crop D+M trên disk (`scratch/g3/zoom/manifest-*.json`, mọi entry `status: ok`)
- [ ] Bảng điểm A–F đã điền (không để trống)
- [ ] Delta log rỗng **hoặc** mọi HIGH đã patch + re-shot
- [ ] Không còn key schema trap: `_borderRadius`, `_minWidth`, `_gap` trên nestable
- [ ] `validate_mobile_overflow.py --page-id <id> --viewport 390` exit 0 trên page thật đã assemble (không chỉ từng section) — xem `bricks_rules.md` §21/§23

---

## 📝 Delta Log (ghi khi FAIL)

> Ghi rõ để patch nhanh:

| Element ID | Property | Figma value | WP value | Delta | Priority |
|-----------|---------|------------|---------|-------|---------|
| `sec100` | `_padding` | `"80px 0"` | `"60px 0"` | -20px top/bottom | HIGH |
| `tit100` | `font-size` | `"48px"` | `"40px"` | -8px | HIGH |
| `crd110` | `_gap` | `"24px"` | `"16px"` | -8px | MED |
| ... | ... | ... | ... | ... | ... |

### Patch command

```bash
# Sau khi sửa JSON (upload_single_section.py không tồn tại — dùng MCP tool trực tiếp):
python3 scripts/validate_template_json.py bricks-json/sec100.json && \
python3 scripts/validate_g4_preflight.py bricks-json/sec100.json --template-id <ID> \
  --desktop scratch/g3/sec100-desktop.png --mobile scratch/g3/sec100-mobile.png
# Upload: gọi MCP tool set_template_content(template_id, elements_json, sync_css=True)
python3 scripts/screenshot_templates.py --section sec100

# Re-review với ảnh mới
```
