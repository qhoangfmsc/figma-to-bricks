# Scripts — Figma → Bricks automation

Không dùng `wp-cli`. Template CRUD qua **Bricks MCP**; review screenshot qua **curl login**.

- Widget catalog: `bricks-skills/references/elements.md` + `MAPPING-FIGMA-FLOW.md`
- Figma responsive map: `snippets/widget-map.md`
- **Data cache:** `scripts/data/README.md`

## Yêu cầu

- Python 3.9+
- `.env`: copy từ `.env.example` — `WP_*`, `BRICKS_MCP_*`, optional `FIGMA_ACCESS_TOKEN`
- Google Chrome (macOS path trong `wp_session.py`)
- Asset = URL Figma MCP từ xa, resolve theo node trong PLAN (`analyze_figma_section.py`) — không cần Figma Desktop, không kiểm tra lại sau build

---

## Kiến trúc 3 phase

```
Phase C — PLAN          Phase B — BUILD           Phase A — REVIEW
plan_from_figma.py  →   build_from_plan.py   →   review_gates.py (G1–G3)
                        + data/*/trees/*.json      g4_visual_gate.py (G4)
                        + generic_builder/         export_figma_section_pngs.py
```

| Phase | Entry script | Thư mục hỗ trợ |
|-------|--------------|----------------|
| **C** PLAN | `plan_from_figma.py` | `lib/plan_generator/`, `plans/` |
| **B** BUILD | `build_from_plan.py` | `lib/generic_builder/`, `data/<slug>/trees/` |
| **A** REVIEW | `review_gates.py`, `g4_visual_gate.py` | `lib/visual_compare.py`, `notes/*/assets/` |

**Orchestrator:** `ldp_autopilot.py` — mặc định single-pass; `--until-pass` (hoặc alias `g4_review_refix_loop.py`) thêm PATCH, tối đa 2 vòng / section.

```bash
# Mặc định: BUILD → G1–G3 → G4 auto 1 lần, không PATCH
python3 scripts/ldp_autopilot.py --plan plans/page-ldp-test-template.md --page-id 8162 --skip-g0

# PATCH tự động ≤ 2 vòng (rule 39) — alias g4_review_refix_loop.py
python3 scripts/ldp_autopilot.py --plan plans/page-ldp-test-template.md --page-id 8162 --skip-g0 --until-pass
```

---

## Pipeline DO (thủ công từng bước)

```
G0  → validate_plan_g0.py + validate_build_script.py (G0.5)
G0.5→ spec.md: Asset chưa resolve = 0 · plan có `Asset map:`
BUILD → build_from_plan.py --all          # cached tree first
G1–G3 → review_gates.py --per-section
G4  → export_figma_section_pngs.py → g4_visual_gate.py --write-diff
      → agent điền checklist → validate_g4_evidence.py --require-checklist
```

**G4 pass = G4 auto ≥98% (tham số chuẩn `G4_*` trong `lib/visual_compare.py`) + checklist plan** — `rule_for_flow.md` § *Định nghĩa G4*.

**Không có Figma Mobile URL** → mọi script tự `--skip-mobile` (desktop only @1440).

---

## Autopilot — chính sách hiện tại

| Hành vi | Trạng thái |
|---------|------------|
| Mặc định single-pass: BUILD 1 lần → G1–G3 → G4 auto 1 lần | ✅ |
| G4 fail (mặc định) → **không PATCH, không rebuild** | ✅ |
| `--until-pass` → PATCH tối đa **2 vòng** / section (`MAX_PATCH_ROUNDS`, rule 39) | ✅ |
| PATCH làm điểm giảm / refix không đổi gì → dừng section, báo blocker | ✅ |
| `--max-g4-rounds` > 3 | Tự giới hạn về 3 (1 lần đầu + 2 PATCH) |
| Chạy lại section đã fail trong cùng lệnh (`--max-page-rounds`) | ❌ Đã bỏ — vượt ngân sách rule 39 |
| `--force-generic` khi cache đầy hơn plan | ❌ **BLOCKED** (`tree_guard.py`) |

```bash
# An toàn — gates only, không rebuild
python3 scripts/ldp_autopilot.py --plan plans/page-ldp-template-v2.md --skip-build --skip-g4

# Gates + G4 một lần (mặc định)
python3 scripts/ldp_autopilot.py --plan plans/page-ldp-template-v2.md
```

---

## Lệnh thường dùng

```bash
# G0
python3 scripts/validate_plan_g0.py plans/page-ldp-template-v2.md
python3 scripts/validate_build_script.py --plan plans/page-ldp-template-v2.md

# BUILD (restore / upload cached trees)
python3 scripts/build_from_plan.py --plan plans/page-ldp-template-v2.md --all

# G1–G3 + screenshot
python3 scripts/review_gates.py --plan plans/page-ldp-template-v2.md --page-id 8110 --per-section

# G4 desktop only
python3 scripts/export_figma_section_pngs.py --plan plans/page-ldp-template-v2.md
python3 scripts/g4_visual_gate.py --plan plans/page-ldp-template-v2.md --write-diff

# PLAN nhanh 1 section (skill figma-section-analyze) — cần full network
python3 scripts/preflight_figma_bricks.py --template-name "Hero CF"
python3 scripts/analyze_figma_section.py --desktop-url "<url>" --mobile-url "<url>" --slug template-hero-cf
python3 scripts/analyze_figma_section.py ... --assets <design_context_desktop.txt> <design_context_mobile.txt>

# Phase C — plan mới (page chưa có plan)
python3 scripts/plan_from_figma.py --work-info work_info.md --create-shell

# Template-only (rule 55) — chỉ tạo template, không page
python3 scripts/plan_from_figma.py --figma-url "<url có node-id>" --template-name "Hero CF" --create-shell
python3 scripts/ldp_autopilot.py --plan plans/template-hero-cf.md --template-id <id>
```

---

## Cấu trúc thư mục

```
scripts/
  lib/
    plan_parser.py         # đọc plans/*.md, plan_has_figma_mobile()
    bricks_mcp.py          # MCP bridge
    wp_session.py          # curl login + Chrome screenshot
    visual_compare.py      # G4 pixel compare
    figma_api.py           # Figma REST (Phase C + export)
    figma_spec.py          # REST node → Bricks settings + desktop/mobile diff (analyze_figma_section)
    build_guard.py         # G0.5 — cấm clone template
    section_autofix.py     # patch kỹ thuật G1/G2
    generic_builder/
      build.py             # cached tree → upload resolution
      tree_guard.py        # chặn --force-generic destructive
    plan_generator/        # Phase C
  data/                    # → README.md
  refill/                  # backup JSON sau upload / autofix

  # Phase C
  plan_from_figma.py
  preflight_figma_bricks.py      # Figma REST + Bricks MCP + rule 36, song song
  analyze_figma_section.py       # spec.md (plan draft) + spec.json cho 1 section

  # Phase B
  build_from_plan.py

  # Phase A — gates
  validate_plan_g0.py
  validate_build_script.py
  validate_template_json.py      # G1 (+ asset URL đúng map: --assets-json / plan `Asset map:`)
  validate_css_compiled.py       # G2
  validate_section_structure.py  # G2.5
  validate_g4_evidence.py        # G3.5
  review_gates.py
  g4_visual_gate.py
  export_figma_section_pngs.py
  screenshot_templates.py
  check_assets.py                # legacy localhost:3845 — không dùng (rule 2: URL Figma MCP, không kiểm tra lại)

  # Orchestration
  ldp_autopilot.py
  section_autofix_loop.py
  patch_template.py
  apply_section_page_settings.py

  # Legacy LDP (deprecated — dùng build_from_plan + data/ldp-template-v2/)
  build_ldp-template-v2.py
  build_ldp-template-v2-live.py
  build_ldp-template-v2-figma.py
  lib/ldp_v2/
```

---

## Evidence & notes

```
notes/<page-slug>/
  assets/
    bricks/     # G3 Bricks PNG, diff/
    figma/      # G4 Figma export PNG
```

Page preview (draft): `http://localhost:8000/?page_id=<id>&preview=true` — cần đăng nhập WP.

---

## Mục tiêu chất lượng

Xem `review-skill/SKILL.md`. G1–G3 pass **≠** G4 pass. Không ghi DONE khi chưa checklist G4 trong plan.
