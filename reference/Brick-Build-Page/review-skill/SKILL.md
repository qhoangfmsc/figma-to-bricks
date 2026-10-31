---
name: review-skill
description: >-
  Review Bricks templates vs Figma using 5 gates (G0–G4): JSON lint, CSS compile,
  page render, visual rubric. Use for Figma→Bricks DO phase after upload.
disable-model-invocation: true
---

# Review Skill — 5 Gates (Figma → Bricks)

Pipeline: **Figma → JSON → compile → page render → visual parity**. Bản đồ tổng: `bricks-skills/MAPPING-FIGMA-FLOW.md` · Flow: `flow_figma_to_bricks.md`.

**Đọc kèm:** `rule_for_flow.md`, `review-skill/rubric.md`, plan trong `plans/`, `snippets/widget-map.md`.

## Ngưỡng chất lượng

| Metric | Giá trị |
|--------|---------|
| Mục tiêu | **100%** (G4 visual) |
| Pass G4 | G4 auto **≥ 98%** (tham số chuẩn) **+** checklist plan mọi dòng ✅ — `rule_for_flow.md` § *Định nghĩa G4* |
| Thứ tự | Desktop G0–G4 pass → Mobile G0–G4 pass → template tiếp |

---

## 5 Gates — tóm tắt

| Gate | Tên | Ai / tool | Khi nào | Pass = |
|------|-----|-----------|---------|--------|
| **G0** | Spec | **Script** | PLAN / đầu DO | `validate_plan_g0.py` exit 0 |
| **G0.5** | Build independence | **Script** | Trước UPLOAD đầu DO | `validate_build_script.py` exit 0 (rule 48) |
| **G1** | JSON lint | **Script** | **Trước** `set_template_content` | exit 0 |
| **G2** | Compile | **Script** | **Sau** upload + `sync_css` | exit 0 |
| **G2.5** | Structure | **Script** | Sau G2 | strategy vs DOM; `slider-responsive` / `carousel-dual` |
| **G3** | Render | **Script** (auto) | Sau G2.5 | Chrome headless chụp section @1440 + @ bề rộng frame Figma mobile (`review_viewport.mobile_review_width`) |
| **G3.5** | Evidence | **Script** | Sau G3 | PNG đã được script ghi vào evidence dir |
| **G4** | Visual | **Script** (auto) + **Agent** (checklist, luôn luôn) | Sau G3.5 | `g4_visual_gate.py` ≥98% **và** `validate_g4_evidence.py --require-checklist` exit 0 |

## Vòng lặp DO (Review / Rebuild)

Plan chi tiết + G0–G3 auto **không bỏ** vòng lặp — giảm số vòng G4.

```
UPLOAD → G1 → G2 → G2.5 → G3 → G4
  ↺ fail G1–G3  → PATCH/rebuild → UPLOAD → lặp (cùng viewport)
  ↺ fail G4     → PATCH/rebuild → UPLOAD → G2→G4
Desktop ≥98% → Mobile (G1→G4 @ bề rộng frame Figma mobile) → template tiếp
```

```bash
python3 scripts/review_gates.py --plan plans/<page>.md --page-id <pid> --per-section
python3 scripts/section_autofix_loop.py --plan plans/<page>.md --page-id <pid>
```

---

```bash
# G0 — trước BUILD (bắt buộc)
python3 scripts/validate_plan_g0.py plans/page-blog-tuan-dang.md --strict

# G0.5 — build script không clone page khác (bắt buộc đầu DO)
python3 scripts/validate_build_script.py --plan plans/page-blog-tuan-dang.md
```

# Per-section — G3 chụp ảnh tự động (mặc định)
python3 scripts/review_gates.py --plan plans/page-blog-tuan-dang.md --page-id 8035 --per-section

# BUILD phase: chỉ G1+G2+G2.5, không chụp (WP chưa sẵn sàng)
python3 scripts/review_gates.py --plan plans/page-blog-tuan-dang.md --page-id 8035 --per-section --skip-screenshot
```

## Ảnh review — ai tạo?

| Nguồn | Ai tạo | Khi nào |
|-------|--------|---------|
| Bricks PNG | **Script** G3 | `review_gates --per-section` |
| Figma PNG | **Script** export hoặc MCP | Optional trước G4 |
| User | **Không** upload ảnh khi build | — |

**BUILD-only:** `--skip-screenshot` khi WP chưa chạy. **Review:** bỏ flag này — script tự chụp.

---

## G0 — Spec (script)

Mỗi section trong `plans/` **bắt buộc** có:

- `Chiến lược mobile` / `Strategy`
- **`### Cấu trúc element`** — một cây DOM
- **`### Settings snapshot`** — nguồn sự thật builder (rule 42)
- **`### Mobile diff (@991px)`** — bullet thay đổi mobile
- **`### G4 acceptance checklist`** — trước khi ghi DONE

**Cấm trong plan mới:** `### Bricks widgets` Desktop/Mobile song song · `Critical rules` (rule 43).

**Mẫu `slider-responsive`:** xem `plans/_plan-template.md` § Section 02.

**Mẫu `carousel-dual`:** hai nhánh trong `### Cấu trúc element` (evds01 + evmb01).

```bash
python3 scripts/validate_plan_g0.py plans/page-blog-tuan-dang.md
python3 scripts/validate_plan_g0.py plans/page-blog-tuan-dang.md --strict  # plan mới: bắt snapshot, cấm legacy
```

**Fail G0** nếu thiếu spec hoặc strategy không khớp Figma mobile. Plan legacy (Desktop/Mobile widgets) → **WARN**; `--strict` → **FAIL**.

## G0.5 — Build independence (script)

Trước UPLOAD section đầu tiên, kiểm tra `Build script:` trong plan **không** clone template page khác:

- `get_template(ID)` với ID **không** thuộc plan hiện tại
- `get_template` + `copy.deepcopy`
- `SECTION_MAP` kiểu `v1` → `v2`

```bash
python3 scripts/validate_build_script.py --plan plans/page-<slug>.md
python3 scripts/validate_build_script.py scripts/build_<slug>.py --plan plans/page-<slug>.md --strict
```

**Fail G0.5** → viết lại builder: Figma `get_design_context` + `### Settings snapshot` (`scripts/lib/figma_build.py`). **Cấm** ghi DONE nếu build source = clone (rule 48–49).

**G4 bổ sung:** không kết luận pass chỉ từ % tổng — so heading, grid, spacing từng vùng. Clone hoặc layout lệch dù G1–G3 pass → rebuild, không PATCH chồng (rule 50).

**Thứ tự (rule 51–53):** PLAN/Page/DO theo `get_metadata` sort `y`. Phiên sửa chất lượng: rule → PLAN → builder Figma → G4 → DONE (user confirm).

Widget catalog: `bricks-skills/references/elements.md` · Mapping: `bricks-skills/MAPPING-FIGMA-FLOW.md`.

Copy từ `plans/_plan-template.md`.

---

## G1 — JSON lint (trước upload)

Kiểm tra **intent** trước khi Bricks compile:

- Element id **đúng 6** ký tự alphanumeric; parent/children khớp 2 chiều
- Không leaf trực tiếp dưới `section`
- `_cssCustom`: `{` = `}`; **`{{` / `}}` = error** khi lint `--json` (trước upload), **warn** khi `--template-id` (sau upload — G2 là nguồn truth compile)
- **Warn:** `container` + selector con `>` (hay fail compile → dùng `div`)

**Fail G1** → sửa build script / JSON → **không upload**, không chụp screenshot.

---

## G2 — Compile (sau upload)

So `_cssCustom` trong MCP `get_template` vs CSS thực tế:

- **External files:** `wp-content/uploads/bricks/css/post-{id}.min.css`
- **Inline:** CSS trong `<style>` của template/page HTML

**Fail G2** → fix element type / CSS syntax → UPLOAD + `sync_css` → chạy lại G2.

**Pass G2** bắt buộc trước G2.5/G3/G4.

---

## G2.5 — Structure (plan strategy vs template)

```bash
python3 scripts/validate_section_structure.py --plan plans/page-blog-tuan-dang.md --template-id 8037
```

- `dual-block` → `@media (max-width:991px)` + `display:none` trong `_cssCustom`
- `slider-responsive` → một `slider-nested` + `perPage:tablet_portrait` / `_widthMax` (theo **Settings snapshot**, không mặc định ẩn arrows)
- `carousel-dual` → `slider-nested` + `display:none` swap + `overflow-x` mobile row
- Plan mobile diff “1 ảnh” / collage → template không được còn 5 image mà không dual-block

**Fail G2.5** → sửa build theo strategy trong plan trước khi chụp screenshot.

---

## G3 — Render (section + page)

**Nguồn sự thật G4:** so Figma **section node** với `tpl_*` từ `--per-section` (page có `pageSettings`). Full page `page_*` dùng ở **DONE / G3.5**, không thay section review trong loop.

```bash
python3 scripts/review_gates.py --plan plans/page-blog-tuan-dang.md --page-id 8035 --per-section
```

| Mode | Ai tạo | Dùng cho |
|------|--------|----------|
| `notes/.../tpl_*_mobile_*.png` | Script G3 | Per-section mobile |
| `notes/.../tpl_*_*.png` | Script G3 | Per-section desktop |
| `notes/.../page_*_mobile.png` | Script G3 | Full page mobile |

**Pass G3:** PNG đã được script ghi + layout section OK (agent checklist).

---

## G3.5 — Evidence (bắt buộc trước G4 sign-off)

```bash
python3 scripts/validate_g4_evidence.py --plan plans/page-blog-tuan-dang.md --require-full-page
```

**Fail** nếu thiếu Bricks PNG cho bất kỳ section nào. Figma PNG optional (`--require-figma`).

**Template-only (rule 55):** plan `- Mode: `template-only`` không có page → bỏ `--page-id`; `--require-full-page` tự bỏ qua `page_*`, vẫn bắt buộc `tpl_*`.

---

## G4 — Visual (Figma parity)

Chỉ chạy khi **G1 + G2 + G2.5 + G3 + G3.5 pass**.

**G4 pass = (1) G4 auto + (2) checklist** — định nghĩa duy nhất ở `rule_for_flow.md` § *Định nghĩa G4*.

### (1) G4 auto

```bash
python3 scripts/export_figma_section_pngs.py --plan plans/<page>.md
python3 scripts/g4_visual_gate.py --plan plans/<page>.md --write-diff
```

**Pass G4 auto:** similarity ≥ **98%** (desktop + mobile) với tham số mặc định của script. Đổi `--threshold` / `--blur-radius` / `--font-tolerance` → script trả fail (chỉ chẩn đoán).

Hoặc end-to-end — mặc định single-pass; `--until-pass` thêm tối đa 2 vòng PATCH (rule 39):

```bash
python3 scripts/ldp_autopilot.py --plan plans/<page>.md
```

### (2) G4 checklist (agent, mọi section)

Mỗi section có **`### G4 acceptance checklist`** — **5–7 dòng**, lấy từ Figma node. **Không** nhân đôi cột Desktop/Mobile nếu mobile chỉ là override @991px: dùng cột **Mobile** chỉ khi layout khác hẳn (dual-block, carousel-dual).

```markdown
### G4 acceptance checklist

| Tiêu chí | Pass |
|----------|------|
| Layout / thứ tự khối (desktop) | |
| Spacing · typography · màu (desktop) | |
| Mobile @991px: <chép 1 dòng từ Mobile diff> | |
| Slider only: perPage · arrows · peek (nếu có) | |
```

Cột **Pass** ghi `✅` hoặc `❌` (chấp nhận thêm `pass` / `đạt`; ô trống, `fail`, `chưa`, `không` = chưa pass).

### Quy trình G4

1. G4 auto pass (bước 1)
2. Figma MCP `get_screenshot` — node section từ plan
3. So `notes/.../tpl_*` (script G3) với Figma **cùng viewport**, điền ✅ / ❌ từng dòng checklist
4. `python3 scripts/validate_g4_evidence.py --plan plans/<page>.md --template-id <id> --require-checklist`
5. **Cấm** hỏi user xác nhận visual từng section — chỉ dừng ở blocker cứng (rule 56: thiếu URL, preflight/MCP fail); section fail sau rule 39 → ghi fail, review section kế; user xác nhận ở DONE

**Pass G4:** bước 1 pass + bước 4 exit 0. G4 fail → chấm [rubric.md](rubric.md) để khoanh vùng lệch (chỉ chẩn đoán).

---

## Khi nào lặp lại review?

| Fail | Lặp từ | Viewport |
|------|--------|----------|
| G1 | BUILD → G1 | — |
| G2 | UPLOAD + sync_css → G2 | — |
| G3 layout | PATCH → UPLOAD → G2 → G3 | Cùng viewport |
| G4 auto <98% hoặc checklist ❌ | PATCH → UPLOAD → **G2 → G3 → G4** (tối đa 2 vòng, rule 39) | Cùng viewport |
| Ảnh sai node / G1 asset | `get_design_context` đúng node → `analyze_figma_section.py --assets` → rebuild → G1… | Cả hai |
| PATCH mobile phá desktop | G2→G4 **desktop** lại | Desktop |

---

## Ghi kết quả

Cập nhật `work_info.md` + plan — template [work-info-template.md](work-info-template.md):

| Section | G1 | G2 | G3 | G4 D | G4 M | Template |
|---------|----|----|----|------|------|----------|

---

## PATCH sau fail

1. `patch_template.py` — sửa nhỏ
2. Rebuild script — sửa lớn / CSS
3. Sau PATCH: `review_gates.py --template-id … --page-id …` rồi G4 nếu pass

Pattern CSS: `snippets/css-custom.md` · Widget/settings: `bricks-skills/MAPPING-FIGMA-FLOW.md`

---

## Tài liệu (mapping flow)

| File | Nội dung |
|------|----------|
| `flow_figma_to_bricks.md` | PLAN → DO → DONE, vòng lặp |
| `bricks-skills/MAPPING-FIGMA-FLOW.md` | Bản đồ tổng |
| `rule_for_flow.md` | Rules 1–46 |
| `snippets/widget-map.md` | Strategy theo Figma |
| `scripts/README.md` | Pipeline scripts |
| [rubric.md](rubric.md) | Chẩn đoán vùng lệch khi G4 fail |
