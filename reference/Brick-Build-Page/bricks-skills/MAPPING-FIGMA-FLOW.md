# Mapping: Quy trình Figma → Bricks (tổng hợp)

Bản đồ trung tâm nối **PLAN → DO → DONE**, tài liệu, scripts, và **bricks-skills**.

> Entry point thực thi: `flow_figma_to_bricks.md` · Rules: `rule_for_flow.md` · Input: `work_info.md`

---

## 1. Ba giai đoạn

```
PLAN (1–6)  →  DO (7a–15, chạy liền — rule 56)  →  DONE (16–17)     [Dọn dẹp]
  │                                              │                │
  ├─ Phân tích Figma D+M                         ├─ BUILD         ├─ Full page PNG
  ├─ Ghi plans/<page>.md                         ├─ UPLOAD        ├─ Báo cáo %
  ├─ create_page (draft)                         ├─ G1→G3 auto   └─ work_info DONE
  ├─ create_template (rỗng)                      ├─ G4 agent
  └─ set_page_content + label                    └─ vòng lặp ↺
```

| Giai đoạn | Output | Không làm |
|-----------|--------|-----------|
| **PLAN** | `plans/<page>.md`, page_id, template_ids (shell) | BUILD JSON, review G4 |
| **DO** | `set_template_content` đầy đủ, pass gates | Publish page |
| **DONE** | Evidence PNG, bảng review | Dọn artifact (chờ user) |

> **Template-only** (chat có `Tên template:`, rule 55): bỏ `create_page` + `set_page_content`; plan `plans/template-<slug>.md` với `- Mode: `template-only``; DONE không có full page PNG. Chi tiết: `flow_figma_to_bricks.md` § Chế độ template-only.

---

## 2. Bản đồ tài liệu

| Câu hỏi | Đọc file |
|----------|----------|
| Thứ tự bước, MCP, pause? | `flow_figma_to_bricks.md` |
| Rule bắt buộc? | `rule_for_flow.md` |
| Figma URL, tên page? | `work_info.md` |
| Widget name + JSON shape? | `bricks-skills/references/elements.md`, `style-settings.md` |
| Chiến lược responsive? | `snippets/widget-map.md` |
| CSS workaround? | `snippets/css-custom.md` |
| Schema plan section? | `plans/_plan-template.md` |
| Gates G0–G4? | `review-skill/SKILL.md`, `rubric.md` |
| Lệnh script? | `scripts/README.md` |

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
- `Asset map:` `scripts/data/<slug>/assets.json` (URL Figma MCP theo node — rule 2)
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

Tra widget: `snippets/widget-map.md` · Shape JSON: `elements.md`, `style-settings.md`

---

## 5. DO — vòng lặp Review / Rebuild

```
BUILD (desktop JSON)
  → G1 validate_template_json     [trước upload]
  → UPLOAD set_template_content (+ sync_css)
  → G2 validate_css_compiled
  → G2.5 validate_section_structure  (strategy vs DOM)
  → G3 screenshot @1440
  → G4 agent vs Figma              [≥98%]
  ↺ fail → PATCH / rebuild → UPLOAD → G2… (cùng viewport)

Desktop pass → BUILD mobile (cùng template, full JSON REPLACE)
  → G1→G3 @ bề rộng frame Figma mobile → G4
  ↺ PATCH mobile → re-run G2 desktop nếu nghi ngờ

→ section tiếp theo
```

| Gate | Auto | Script |
|------|------|--------|
| G0 | ✅ | `validate_plan_g0.py` |
| G1 | ✅ | `validate_template_json.py` |
| G2 | ✅ | `validate_css_compiled.py` |
| G2.5 | ✅ | `validate_section_structure.py` |
| G3 | ✅ | `review_gates.py --per-section` |
| G3.5 | ✅ | `validate_g4_evidence.py` |
| G4 | agent | Figma MCP + `rubric.md` |

**Autofix loop:** `section_autofix_loop.py` — autofix → upload → G1/G2/G2.5 → screenshot (không thay G4).

---

## 6. Mapping giai đoạn → công cụ

### PLAN

| Bước | MCP / tool | Doc |
|------|------------|-----|
| 1 Input | `get_site_info` | `work_info.md` |
| 2 Figma | `get_metadata`, `get_design_context`, `get_variable_defs` | `widget-map.md` |
| 3 Plan | write `plans/<page>.md` | `_plan-template.md` |
| 4–6 WP shell | `create_page`, `create_template`, `set_page_content` | `page-template-label.json` |
| ⏸️ | user `work_info.md` | — |

### DO

| Bước | Tool | Doc |
|------|------|-----|
| 7a | `spec.md`: Asset chưa resolve = 0 | rule 2, 21 |
| 7 | `build_<page>.py` (mới) | `elements.md`, `MAPPING` §4 |
| 8–9 | BUILD + MCP upload | `css-custom.md` |
| 10–15 | `review_gates.py`, G4 agent | `review-skill/` |
| PATCH | `patch_template.py` | rule 24 |

### DONE

| Bước | Tool |
|------|------|
| Full page PNG | `screenshot_templates.py` |
| Báo cáo | `work_info.md` |
| Dọn (user yêu cầu) | flow § bước 7 |

---

## 7. JSON format

| MCP upload | bricks-skills clipboard |
|------------|-------------------------|
| Flat `[{id,name,parent,children,settings}]` | `{content:[], globalClasses:[], source}` |
| Ảnh: `"url":"https://www.figma.com/api/mcp/asset/<uuid>/<file>", "external": true` (từ `spec.json`) | `external-assets.md` |

---

## 8. Pattern index nhanh

| Figma | `bricks-skills/patterns/` |
|-------|---------------------------|
| Slider + breakpoint | `sections/testimonials-slider.json` |
| FAQ | `sections/faq-accordion.json` |
| Grid features | `sections/feature-grid.json` |
| Hero | `sections/hero-centered.json`, `sections/hero-split-image.json` |
| Tabs | `elements/tabs-section.json` |
| Số liệu / counter | `elements/stats-counter.json` |
| Gallery / video | `elements/gallery-section.json`, `elements/video-section.json` |

Danh sách đầy đủ: `bricks-skills/patterns/INDEX.md`. Site Vietnix: ưu tiên Core Framework classes (rule 9) trước BEM `bem/bem-*.json`.

---

## 9. Checklist trước upload

- [ ] Strategy khớp **Figma mobile** (không ép carousel-dual)
- [ ] Widget từ `elements.md` — không invent key
- [ ] Shapes từ `style-settings.md`
- [ ] `parent`/`children` khớp 2 chiều
- [ ] Ảnh Figma localhost — không WP `id`
- [ ] G1 pass → upload → G2 pass
