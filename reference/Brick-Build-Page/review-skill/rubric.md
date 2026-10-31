# Rubric — Gate G4 (Visual vs Figma)

G1–G3 là **gate tự động** — không dùng rubric %. **G4 pass = G4 auto ≥98% + checklist plan mọi dòng ✅** (`rule_for_flow.md` § *Định nghĩa G4*). Rubric % trong file này **không** phải điều kiện pass — chỉ dùng để khoanh vùng lệch khi G4 fail.

## G4 tự động (script)

```bash
python3 scripts/g4_visual_gate.py --plan plans/<page>.md
```

| Pass | Điều kiện |
|------|-----------|
| Desktop | similarity ≥ 98% vs Figma PNG @1440 |
| Mobile | similarity ≥ 98% vs Figma PNG @390 (nếu mobile diff) |

Similarity = `100 × (1 - mean_pixel_diff/255)` sau align width, blur + pixel tolerance theo hằng số `G4_*` trong `scripts/lib/visual_compare.py`. Đổi tham số qua CLI → script trả fail (chỉ chẩn đoán).

## Rubric % — chẩn đoán khi G4 fail

Chấm % để xác định hạng mục nào kéo điểm xuống trước khi PATCH (rule 39: tối đa 2 vòng).

| Hạng mục | Trọng số | Kiểm tra gì |
|----------|----------|-------------|
| **Layout** | 25% | Thứ tự khối, cột/hàng, scroll/carousel, dual-block |
| **Typography** | 20% | Font, size, weight, line-height, hierarchy |
| **Màu & surface** | 15% | Nền, border, shadow, radius |
| **Ảnh & icon** | 20% | Load 200, đúng asset, mask/crop |
| **Spacing** | 20% | padding, margin, gap |

```
Tổng G4 % = Layout×0.25 + Typography×0.20 + Màu×0.15 + Ảnh×0.20 + Spacing×0.20
```

## Thang chấm hạng mục

| Điểm | Ý nghĩa |
|------|---------|
| 100 | Khớp Figma |
| 98–99 | Lệch cực nhỏ — pass |
| 95–97 | Lệch nhẹ — fail hạng nếu kéo tổng <98% |
| 90–94 | Lệch rõ — fail hạng |
| <90 | Fail — PATCH bắt buộc |

## Pass / Fail toàn review (1 template × 1 viewport)

| Gate | Pass |
|------|------|
| G1 | `validate_template_json.py` exit 0 |
| G2 | `validate_css_compiled.py` exit 0 |
| G3 | Page screenshot — layout section OK |
| G4 | `g4_visual_gate.py` ≥ **98%** + `validate_g4_evidence.py --require-checklist` exit 0 |

**Cả 4 gate (G1–G4)** phải pass trước khi chuyển viewport/template tiếp hoặc DONE.

---

## Desktop vs Mobile (G3/G4)

| Viewport | Width | Figma node | Bricks breakpoint |
|----------|-------|------------|-------------------|
| Desktop | 1440px | Desktop URL | default |
| Mobile | **390px** | Mobile URL | `:tablet_portrait` (≤991px) |

**Responsive theo Figma:** so visual trên **page screenshot** (G3). Chiến lược plan phải khớp layout Figma mobile — xem `snippets/widget-map.md`.

---

## G2 — CSS validation (không dùng rubric %)

Script `validate_css_compiled.py` thay cho grep thủ công:

```bash
python3 scripts/validate_css_compiled.py --template-id 8038 --page-id 8035
```

Quy tắc Bricks `_cssCustom`: xem `snippets/css-custom.md`, G1 lint. Widget/settings: `bricks-skills/MAPPING-FIGMA-FLOW.md`.

---

## Ghi plan / work_info

```markdown
| Section | G1 | G2 | G3 | G4 Desktop | G4 Mobile | Template |
|---------|----|----|----|------------|-----------|----------|
| Hero | ✅ | ✅ | ✅ | 98% | 98% | 8036 |
| Sự kiện | ✅ | ✅ | ✅ | 98% | 98% | 8038 |
```
