# Plan template — copy thành `plans/page-<slug>.md`

> **Quy ước:** **một file plan / page** — scripts G0, review_gates, G1 asset map đọc file này.  
> Section phức tạp: ghi đủ spec trong block `## Section` bên dưới; annex tùy chọn `plans/<slug>/sections/<section-slug>.md`.

- Figma Desktop: [<node>](https://www.figma.com/design/<fileKey>/<name>?node-id=<id>)
- Figma Mobile: [<node>](https://www.figma.com/design/<fileKey>/<name>?node-id=<id>)
- Page ID: **0000**
- Mode: `page` *(`page` | `template-only` — `template-only`: xóa dòng Page ID, plan đặt tên `plans/template-<slug>.md`, rule 55)*
- G4 evidence dir: `notes/<slug>/assets/bricks`
- Build script: `scripts/build_from_plan.py`
- Build source: `figma` *(bắt buộc — `figma` | `mcp-live`; **cấm** `clone-foreign` · **cấm** materialize refill)*
- Asset map: `scripts/data/<slug>/assets.json` *(node → URL Figma MCP; G1 chặn URL ngoài map — rule 2)*

## Thứ tự section (Figma → Page → DO)

| # | Figma name | Node desktop | Template ID | Ghi chú |
|---|------------|--------------|-------------|---------|
| 1 | … | `0:0` | 0001 | |
| 2 | … | `0:0` | 0002 | |

> Lấy từ `get_metadata` frame page — sort `y`. DO build/review **theo cột #**. Page `set_page_content` **cùng thứ tự**.
- Design tokens: màu, font, spacing scale (từ Figma)

## Review gates

| Section | G0 | G1 | G2 | G2.5 | G3 | G4 Desktop | G4 Mobile | Template |
|---------|----|----|----|------|----|------------|-----------|----------|
| Hero | — | — | — | — | — | — | — | 0001 |

---

## Section 01 — Hero (mẫu breakpoint-only)

- Template ID: **0001**
- Template slug: `page-slug-hero`
- Figma node desktop: `0000:0000`
- Figma node mobile: `0000:0000`
- Mobile khác desktop?: `không`
- Chiến lược mobile: `breakpoint-only`
- Mobile diff: stack cột; padding 16px

### Cấu trúc element

```
section sec001 → container con001 → block row001 → heading hdg001 + image img001
```

(Mobile = cùng cây — overrides chỉ trong Settings snapshot / Mobile diff.)

### Measurements (Figma desktop)

- gap · padding · font-size — **một bảng số**

### Mobile diff (@991px)

- Bullet **chỉ** thay đổi so desktop (vd. `stack column`, `perPage:1`, `ẩn block X`)

### Settings snapshot

- Giá trị Bricks (desktop + `:tablet_portrait` nếu có) — **nguồn sự thật duy nhất** cho builder

### Review spec

- Strategy: `breakpoint-only`
- G4 Bricks: `tpl_0001_*.png` + `tpl_0001_mobile_*.png`
- ~~Critical rules~~ — **không dùng**; dùng Settings snapshot

### G4 acceptance checklist

| Tiêu chí | Pass |
|----------|------|
| Layout desktop | |
| Mobile diff @991px | |

> Cột Pass: `✅` / `❌` — `validate_g4_evidence.py --require-checklist` (rule_for_flow § Định nghĩa G4).

> Catalog: `bricks-skills/references/elements.md` · Map: `snippets/widget-map.md`

---

## Section 02 — Carousel peek (mẫu slider-responsive)

- Template ID: **0002**
- Template slug: `page-slug-events`
- Figma node desktop: `0000:0000`
- Figma node mobile: `0000:0000`
- Mobile khác desktop?: `có`
- Chiến lược mobile: `slider-responsive`
- Mobile diff: 1 card + peek ~80%; arrows dưới track (desktop + mobile) — **một dòng, không đổi giữa các PATCH**

### Cấu trúc element

```
section → container → block (title row) → slider-nested sld001 → block slide×N (image + text-basic)
```

### Settings snapshot

- `perPage: 3` · `gap: 24` · `perPage:tablet_portrait: 1` · `gap:tablet_portrait: 16`
- Slide: `_widthMax:tablet_portrait: 80%`
- Arrows: dưới track · gap 32px · `type: slide` · `start: 0`

### Review spec

- Strategy: `slider-responsive`
- Pattern: `bricks-skills/patterns/sections/testimonials-slider.json`
- G4 Bricks: `tpl_0002_*.png` + `tpl_0002_mobile_*.png`

### G4 acceptance checklist

| Tiêu chí | Pass |
|----------|------|
| Desktop: 3 card, thứ tự đúng, arrows dưới track | |
| Mobile: 1 card + peek, arrows dưới track | |
| Card border / image / text khớp Figma | |

---

## Section 03 — Carousel scroll row (mẫu carousel-dual)

> **Chỉ khi Figma mobile** = scroll row thuần. G0 kiểm `Cấu trúc element` (evds01 + evmb01) + scroll trong Mobile diff.

- Template ID: **0003**
- Template slug: `page-slug-events-scroll`
- Figma node desktop: `0000:0000`
- Figma node mobile: `0000:0000`
- Mobile khác desktop?: `có`
- Chiến lược mobile: `carousel-dual`
- Mobile diff: ẩn evds01 · hiện evmb01 · scroll-x · card 286px

### Cấu trúc element

```
section → container
  → block evds01 [desktop] → slider-nested
  → block evmb01 [mobile @991] → div scroll → card×N
```

### Settings snapshot

- evds01: ẩn @991 · slider perPage 3 · arrows theo Figma
- evmb01: hiện @991 · evrow1 overflow-x auto · card flex 0 0 286px

### G4 acceptance checklist

| Tiêu chí | Pass |
| Desktop slider + arrows | |
| Mobile scroll row | |

---

## Assets

<!-- Không gõ tay URL. Resolve bằng analyze_figma_section.py --assets <design_context.txt>; danh sách node → URL nằm ở Asset map (spec.md § Assets). -->
- Asset map: `scripts/data/<slug>/assets.json` · `Asset chưa resolve: 0`
