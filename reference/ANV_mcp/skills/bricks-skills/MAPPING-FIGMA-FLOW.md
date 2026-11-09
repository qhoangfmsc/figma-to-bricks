# Mapping: Quy trình Figma → Bricks (tổng hợp)

Bản đồ trung tâm nối **PLAN → DO → DONE**, tài liệu, scripts, và **bricks-skills**.

> Entry point thực thi: `infor_todo.md` · Rules: `todo/rules/` · Skills: `skills/` · Site: Bricks **1.12.3** / WP 6.8.1

> **⚠️ Deprecated (2026-07-20)**: Flow 1B (SPEC-driven — `spec.json` IR + `validate_spec.py` + `spec_to_elements.py`) đã bị loại bỏ khỏi quy trình chính thức. Lý do: 2 script lõi (`validate_spec.py`, `spec_to_elements.py`) chưa từng được viết, và đánh giá lại cho thấy không đáng xây — bottleneck thật của pipeline là review G4 bằng mắt, không phải bước sinh JSON; Flow trực tiếp (AI đọc `get_design_context`/`get_variable_defs` rồi viết JSON theo `bricks_rules.md`) đã làm tốt việc này mà không cần thêm tầng compiler phải bảo trì. Nội dung §Flow 1B bên dưới giữ lại **chỉ để tham khảo lịch sử** — không làm theo.

---

## 1. Hai giai đoạn (đã bỏ SPEC/Flow 1B riêng)

```
PLAN (1–6)                          ⏸️ User xác nhận     DO (7a–15)       DONE (16–17)
  │                                                          │                │
  ├─ Phân tích Figma D+M                                     ├─ get_design_context/get_variable_defs
  ├─ Ghi plans/<page>.md                                     │  (đọc trực tiếp từng section, không qua spec.json)
  └─ Tạo page & template thủ công qua MCP                    ├─ BUILD JSON → UPLOAD section
     (create_page / create_template)                         ├─ G1→G3 section
                                                               ├─ G4 review
                                                               └─ sửa JSON trực tiếp theo delta G4 ↺
```

> **Nguyên tắc pipeline hiện tại**:
> `Figma (get_design_context/get_variable_defs) → viết JSON theo bricks_rules.md → validate_template_json ✓ → upload`
> — Sai lệch ở G4 thì sửa lại `bricks-json/<sec>.json` theo delta rồi re-upload, không có tầng IR trung gian.

| Giai đoạn | Output | Không làm |
|-----------|--------|-----------|
| **PLAN** | `plans/<page>.md`, `template_mapping.json` (Page ID, Template IDs) | BUILD JSON, review G4 |
| **DO** | Cập nhật `set_template_content` cho từng Section, pass gates | — |
| **DONE** | Evidence PNG, bảng review | Dọn artifact (chờ user) |

> **Schema `template_mapping.json` (CHUẨN DUY NHẤT — mọi script đọc theo shape này: `screenshot_templates.py`, `review_gates.py`, `validate_css_compiled.py --all`, `lib/bricks_mcp.py`)**:
> ```json
> {
>   "sec100": { "template_id": 9117, "url": "<WP_URL>/?page_id=9119" },
>   "sec200": { "template_id": 9118, "url": "<WP_URL>/?page_id=9120" },
>   "page":   { "page_id": 9130 }
> }
> ```
> `url` = permalink của **page tạm** chứa section (page settings `{"headerDisabled":true,"footerDisabled":true}`) — bắt buộc để screenshot section (KHÔNG có fallback `?bricks_template_preview=`, query var đó không tồn tại — xem `bricks_rules.md` §14).
>
> **Nhiều trang trong 1 phiên (2026-07-22)**: mapping mặc định chỉ giả định **1 trang/phiên**. Khi build nhiều trang cùng lúc, đặt tên riêng từng file theo pattern `template_mapping.<page-slug>.json` và **luôn truyền `--mapping <path>`** tường minh cho script cần đọc mapping — không dựa vào default path. Nếu chỉ cần `--page-id` trực tiếp (vd `screenshot_templates.py --full-page --page-id <id>`) thì không cần mapping file.

---

## 2. Bản đồ tài liệu

| Câu hỏi | Đọc file |
|----------|----------|
| Thứ tự bước, MCP, pause? | `AGENTS.md` §3 (luồng thực thi hợp nhất) |
| Rule bắt buộc? | `todo/rules/general_rules.md` + `bricks_rules.md` + `figma_rules.md` |
| Figma URL, tên page? | `infor_todo.md` |
| Widget name + JSON shape? | `bricks-skills/references/elements-catalog.md`, `element-base-controls.md` |
| Chiến lược responsive? | `snippets/widget-map.md` |
| CSS workaround? | `snippets/css-custom.md` |
| Schema plan section? | §3 bên dưới (spec tối thiểu — không có file template riêng) |
| IR spec schema (lịch sử, Flow 1B deprecated) | `skills/figma-bricks/schema/layout-spec.schema.json` |
| Gates G1–G4? (G0 chưa có script, xem §5) | `review-skill/SKILL.md`, `rubric.md` |
| Lệnh script? | `AGENTS.md` §5 + `bricks_rules.md` §10 |

---

## 3. Plan — một file / page

**Path:** `plans/<page-slug>.md` — **duy nhất** file scripts đọc (G0, assets, review).

```
plans/<page-slug>.md          ← bắt buộc (page meta + mọi ## Section)
plans/<page-slug>/sections/   ← tùy chọn (annex section phức tạp)
```

### Section — spec tối thiểu (mọi section)

- Template ID, Figma node desktop (+ mobile nếu có)
- `Mobile khác desktop?`, **Chiến lược mobile**
- **`### Cấu trúc element`** — một cây DOM
- **`### Settings snapshot`** — nguồn sự thật builder
- **`### Mobile diff (@991px)`** — bullet override mobile
- Assets URL (`localhost:3845`)
- Bảng Review gates (G1–G4 %)

> **Deprecated:** `### Bricks widgets` Desktop/Mobile song song · `Critical rules` (rule 43). Plan legacy → G0 WARN; `--strict` FAIL.

### Section phức tạp — thêm

| Block | Mục đích |
|-------|----------|
| Element tree + id semantic | BUILD không invent DOM |
| Settings snapshot | Số từ Figma → Bricks keys (`:tablet_portrait`) |
| G4 acceptance checklist | Pass trước DONE |
| Pattern ref | `bricks-skills/patterns/`, `css-custom.md` |

---

## 4. Chiến lược responsive — **theo Figma mobile**

**Nguyên tắc:** map layout Figma → strategy. **Không** mặc định `carousel-dual` khi thấy slider desktop.

```
Mobile Figma?
├─ Không frame mobile → n/a (+ rule 10 tối thiểu)
├─ Cùng DOM, chỉ stack/co/size → breakpoint-only
├─ Desktop slider + mobile PEEK carousel (Splide swipe) → slider-responsive
├─ Desktop slider + mobile SCROLL ROW thuần (không Splide) → carousel-dual  ← G0 bắt mobile scroll/div
└─ DOM/component khác → dual-block
```

| Strategy | Widget chính | G0 check mobile widget |
|----------|--------------|------------------------|
| `breakpoint-only` | settings `:tablet_portrait` | — |
| `slider-responsive` | 1× `slider-nested` + breakpoint | slider (cùng DOM) |
| `carousel-dual` | `slider-nested` + `div` scroll | **scroll / div bắt buộc** |
| `dual-block` | 2× `block` ẩn/hiện @991px | — |
| `n/a` | desktop | — |

Tra widget: `snippets/widget-map.md` · Shape JSON: `references/elements-catalog.md`, `element-base-controls.md`

---

## 5. DO — vòng lặp Review / Rebuild

```
BUILD (desktop JSON)
  → G1 validate_template_json     [trước upload]
  → UPLOAD set_template_content (+ sync_css)
  → G2 validate_css_compiled
  → G2.5 validate_section_structure  (strategy vs DOM)
  → G3 screenshot @1440
  → (khuyến nghị) diff_screenshots.py Figma vs WP  [tín hiệu khách quan, không hard-block]
  → G4 agent vs Figma              [≥98%]
  ↺ fail → PATCH / rebuild → UPLOAD → G2… (cùng viewport)

Desktop pass → BUILD mobile (cùng template, full JSON REPLACE)
  → G1→G3 @390 → G4
  ↺ PATCH mobile → re-run G2 desktop nếu nghi ngờ

→ section tiếp theo

Sau khi TOÀN BỘ section của 1 trang đã assemble vào page thật (set_page_content):
  → validate_mobile_overflow.py --page-id <id> --viewport 390   [hard gate, xem bảng dưới]
```

| Gate | Auto | Script |
|------|------|--------|
| G0 | ❌ chưa có script | Đọc plan bằng mắt trước khi build (`validate_plan_g0.py` không tồn tại — không cần viết, xem `AGENTS.md` §5) |
| G1 | ✅ | `validate_template_json.py` |
| G2 | ✅ | `validate_css_compiled.py` |
| G2.5 | ✅ | `validate_section_structure.py` |
| G3 | ✅ | `screenshot_templates.py` |
| G4 evidence | ✅ | `capture_zoom_evidence.py` + `validate_g4_preflight.py` (thay cho `validate_g4_evidence.py` — chưa từng tồn tại) |
| G4 diff khách quan | ✅ (khuyến nghị, không hard-block) | `diff_screenshots.py` (2026-07-20) — % pixel lệch + heatmap, đọc bởi `validate_g4_preflight.py --diff-report-*` |
| G4 | agent | Figma MCP + `rubric.md` HARD GATE |
| Mobile overflow (page-level, hard gate) | ✅ | `validate_mobile_overflow.py` (2026-07-22) — đo `scrollWidth` thật trên page đã assemble, thay cho rubric F2 "nhìn DevTools" cũ. Xem `bricks_rules.md` §21/§23 |

**Autofix loop:** `review_gates.py <sec> <plan> <json> [--template-id N | --mapping <path>]` — chạy G1+G2+G2.5 tổng hợp 1 lệnh cho từng section (G2 cần template_id: truyền trực tiếp hoặc để script tự tra mapping).

**Screenshot**: `screenshot_templates.py --section <key>` — dùng sau upload để lấy ảnh so sánh G4.

---

## 6. Mapping giai đoạn → công cụ

### PLAN

| Bước | MCP / tool | Doc |
|------|------------|-----|
| 1 Input | `get_site_info` | `infor_todo.md` |
| 2 Figma | `get_metadata`, `get_design_context`, `get_variable_defs` | `widget-map.md` |
| 3 Plan | write `plans/<page>.md` | spec tối thiểu §3 |
| 4–6 WP shell | Tạo page & template thủ công qua `create_page`/`create_template` (MCP) — `setup_page_with_templates.py` không tồn tại, cố ý không viết | `template_mapping.json` |
| ⏸️ | user `infor_todo.md` | — |

### DO (Thực hiện tuần tự cho từng Section)

> Không còn bước SPEC/`spec.json` riêng — đọc Figma section (`get_design_context` + `get_variable_defs`) ngay trong bước này rồi viết JSON thẳng theo `bricks_rules.md`.

| Bước | Tool | Doc |
|------|------|-----|
| 7a | Đọc `get_design_context(section_node_id)` + `get_variable_defs(file_key)`; ảnh upload thủ công qua MCP theo `external-assets.md` (`upload_assets.py`/`check_assets.py` không tồn tại, cố ý không viết) | rule 21, `figma-skills/SKILL.md` §2-3 |
| 7 | Viết `bricks-json/<sec>.json` trực tiếp theo `elements-catalog.md`/`element-base-controls.md`/`bricks_rules.md` (`spec_to_elements.py` không tồn tại, cố ý không viết) | `bricks_rules.md` |
| 8 | `python3 scripts/validate_template_json.py bricks-json/<sec>.json` (G1) | `bricks_rules.md` §10 |
| 9 | `set_template_content` qua bricks-mcp (`sync_css=True`) | `bricks_rules.md` §8 |
| 10–15 | `review_gates.py`, G4 agent → sửa **trực tiếp `bricks-json/<sec>.json`** theo delta → re-upload | `review-skill/` |


### DONE

| Bước | Tool | Ghi chú |
|------|------|---------|
| Full page PNG | `screenshot_templates.py --all-sections --full-page` | Desktop + Mobile |
| Báo cáo | Cập nhật `infor_todo.md` | Set Trạng thái = DONE |
| Re-host assets (trước công bố cho khách thật) | `rehost_assets.py bricks-json/*.json --apply` → re-upload JSON → re-screenshot | Bắt buộc mọi môi trường — URL Figma cache không sống ngoài máy build (`bricks_rules.md` §11) |
| Dọn (user yêu cầu) | `CLEANUP.md` | Set Cleanup=yes trong `infor_todo.md` |

---

## 6b. Python Client Library

Mọi script upload đều import từ `scripts/lib/bricks_mcp.py`:

```python
from scripts.lib.bricks_mcp import (
    get_site_info,          # kiểm tra kết nối
    create_page,            # tạo WordPress page
    create_template,        # tạo Bricks template
    set_template_content,   # upload JSON + sync_css
    SECTION_REVIEW_PAGE_SETTINGS  # {headerDisabled, footerDisabled}
)
```

**Chạy từ**: `todo/` directory (không phải root project).

---

## 7. JSON format

| MCP upload | bricks-skills clipboard |
|------------|-------------------------|
| Flat `[{id,name,parent,children,settings}]` | `{content:[], globalClasses:[], source}` |
| Ảnh: `"url":"http://localhost:3845/assets/…"` | `external-assets.md` |

---

## 8. Pattern index nhanh

| Figma | `bricks-skills/patterns/` |
|-------|---------------------------|
| Slider + breakpoint | `testimonials-slider.json` |
| FAQ | `faq-accordion.json` |
| Grid features | `feature-grid.json` |
| Hero | `hero-centered.json`, `hero-split-image.json` |

Site Vietnix: ưu tiên Core Framework classes (rule 9) trước BEM `bem-*.json`.

---

## 9. Checklist trước upload

- [ ] Strategy khớp **Figma mobile** (không ép carousel-dual)
- [ ] Widget từ `references/elements-catalog.md` — không invent key
- [ ] Shapes từ `references/element-base-controls.md`
- [ ] `parent`/`children` khớp 2 chiều
- [ ] Ảnh có `url` (Figma cache lúc build; re-host bằng `rehost_assets.py` trước công bố) — không WP `id` trần
- [ ] G1 pass → upload → G2 pass
