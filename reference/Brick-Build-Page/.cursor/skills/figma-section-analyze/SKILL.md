---
name: figma-section-analyze
description: Fast, exact Figma → Bricks PLAN analysis for one section (desktop + mobile). Runs one preflight command and one REST-based spec script that emits plan-ready Cấu trúc element, Measurements, Mobile diff, Settings snapshot (real Bricks keys incl. :tablet_portrait) and G4 checklist, then resolves assets with a single parallel Figma MCP batch. Use in the PLAN step of figma-to-bricks, for "Tên template:" requests, or whenever analyzing a Figma frame/section to build a Bricks template is slow or inaccurate.
---

# Figma section → Bricks spec (fast path)

Replaces the slow manual PLAN loop (reading ~900 lines of flow docs, probing MCP schemas, eyeballing Tailwind output, grepping `style-settings.md`). Numbers come from the Figma REST node tree, so they are exact; the agent only verifies what a script cannot know.

Still obey `rule_for_flow.md` (the project rule loads it). Do **not** `cat` `flow_figma_to_bricks.md` in full — read only the section you need (template-only: `## 🧩 Chế độ template-only`).

## Checklist

```
- [ ] 1. Preflight (1 command)
- [ ] 2. Spec script (1 command) → read spec.md only
- [ ] 3. One parallel MCP batch: screenshots + design context (desktop + mobile)
- [ ] 4. Re-run spec with --assets (cached, instant)
- [ ] 5. Verify the 6 points the script cannot know + run the pitfall lint
- [ ] 6. Plan file + template shell + G0
- [ ] 7. Builder reads spec.json (no retyped numbers)
```

### 1. Preflight

```bash
python3 scripts/preflight_figma_bricks.py --template-name "<Tên template>"
```

Run with `required_permissions: ["full_network"]` (sandbox blocks api.figma.com → SSL error). Checks Figma REST, Bricks MCP bridge, and rule-36 name collision in parallel (<1s). Figma Desktop is not needed: assets are remote Figma MCP URLs (rule 2).

- Bricks: always go through `scripts/lib/bricks_mcp.py` (`create_template`, `set_template_content`, `get_template`, …). Do not probe the Cursor Bricks namespace or call `mcp_auth` repeatedly.
- `✗` on a blocking check → stop and report (rule 16).

### 2. Spec script

```bash
python3 scripts/analyze_figma_section.py \
  --desktop-url "<desktop url with node-id>" \
  --mobile-url "<mobile url with node-id>" \
  --slug template-<slug>          # page flow: page-<slug>-<section>
```

Same `full_network` permission. One REST call per Figma file (~10–20s; cached under `scripts/data/<slug>/figma/*.full.json`, `--refresh` to refetch). Output:

- `scripts/data/<slug>/spec.md` — read this, nothing else. `## Plan draft` is copy-ready; `## Appendix` holds the detailed outline (ids, sizes, per-item texts of repeated cards), tokens, asset list.
- `scripts/data/<slug>/spec.json` — every node with `settings` + `mobileSettings` in real Bricks shapes.

Several sections under one frame (page or `--multi-section`): run the script once per section node (child ids from `get_metadata`), in parallel shells.

### 3. One parallel MCP batch

Read `.cursor/skills/figma-design-to-code/SKILL.md` once per session (mandatory before `get_design_context`). Then send **in one batch** (namespace `plugin-figma-figma`; schemas below, no `GetDynamicTools` needed):

| Tool | Arguments |
|------|-----------|
| `get_screenshot` | `{"fileKey": K, "nodeId": DESKTOP}` and `{"fileKey": K, "nodeId": MOBILE}` |
| `get_design_context` | `{"fileKey": K, "nodeId": DESKTOP, "clientLanguages": "python,json", "clientFrameworks": "bricks", "skillNames": "figma-design-to-code", "excludeScreenshot": true}` |

- Desktop only: mobile images usually share the desktop `imageRef` and resolve automatically. Call it on MOBILE only if step 4 still reports missing assets.
- Timeout or "sparse/too large" → **do not retry the same node**. Take the level-1 child ids from the spec Appendix outline and request them in one new parallel batch.
- The design-context code is used **only for asset URLs** (`const img… = …`). Never take numbers from its Tailwind classes; spec.md is the source of numbers.

### 4. Resolve assets

URLs are remote Figma MCP assets and are **never re-checked after build** (rule 2), so the node → URL map must be right here. The script propagates one URL only where the asset is provably the same: same `imageRef` (bitmaps, incl. the mobile frame) or same component master layer + same size/paints (icons). Different-size mobile icons stay unresolved on purpose. Mappings persist in `scripts/data/<slug>/assets.json`.

- **Prefer `--assets <file>`** with the saved response (`…/agent-tools/<uuid>.txt`): the parser follows JSX nesting, so each asset goes to the tag that uses it or its nearest open ancestor.
- Inline response only: take `assetPathPrefix` and, for each `const img…`, the `data-node-id` of the tag that uses `src={img…}` — or of its **enclosing** element, never a sibling that closed before it:

```bash
python3 scripts/analyze_figma_section.py ...same args... \
  --asset-prefix "<assetPathPrefix>" --asset 3229:15115=6b33b.png 3229:15072=131b1.png
```

- Never combine a prefix with file names from another MCP response; never type URLs. Non-MCP URLs are rejected.
- `⚠ N asset lớp trong` on a line: a collapsed svg/image has several layered assets — call `get_design_context` on that node and map it directly (or build its layers), never pick one.
- Map looks wrong from an earlier run → add `--reset-assets`.

Goal: header shows `Asset chưa resolve: **0**`. Add `- Asset map: \`scripts/data/<slug>/assets.json\`` to the plan header so G1 rejects any URL not in the map.

### 5. Verify against the screenshots (only these)

1. **Heading tags**: script assigns h2/h3… by size; hero/page title → `h1` (rule 8).
2. **Strategy**: header `Gợi ý chiến lược`. With `cân nhắc: carousel-dual`, decide from the mobile screenshot: peek → `slider-responsive`, plain scroll → `carousel-dual` (snippets/widget-map.md).
3. **`⚠` notes**: gradient strokes, masks → one `_cssCustom` per element (rule 44).
4. **Image crops**: the `⚠ ảnh crop` note gives the exact img width/height/left/top (from REST `imageTransform`); build it as an absolute image inside an `_overflow hidden` frame.
5. **Text spans** (`span "…"` in the outline): put inline HTML `<span style="…">` in `text`.
6. **`mobile thêm …` / `ẩn …` lines**: mobile-only blocks need a second branch (`dual-block`); hidden blocks get `_display:tablet_portrait none` (already in the snapshot).

7. **Pitfall lint** (before the builder is written):

```bash
python3 scripts/lint_spec_pitfalls.py --slug template-<slug>
```

Flags zero-size SVG strokes, `_alignSelf: stretch`, fixed-width labels that will wrap, flex-grow siblings with unequal padding, and box-shadow on exported assets. Every warning needs an entry in the builder OVERRIDES (see the pitfalls table below) or a note in the plan explaining why it is fine.

Anything else in spec.md is trusted — do not re-measure.

### 6. Plan + shell + G0

- Template-only: `plans/template-<slug>.md` = header (Figma links, `- Mode: \`template-only\``, evidence dir, build script, `Build source: \`figma\``, `Asset map: \`scripts/data/<slug>/assets.json\``) + section table + `## Section 01 — <name>` containing `Template ID: **<id>**`, `Template slug`, and the `## Plan draft` blocks pasted as-is (edited per step 5).
- Create the template with `create_template(<name from preflight>, "section")` from `scripts/lib/bricks_mcp.py`; do not run `plan_from_figma.py` for template-only (it re-fetches Figma depth-limited).
- `python3 scripts/validate_plan_g0.py plans/template-<slug>.md --strict`

### 7. Builder from spec.json

Write `scripts/build_<slug>.py` (rule 30) using the ids from the outline:

```python
from scripts.lib.figma_spec import load_node_settings, unresolved_asset_ids

SPEC = load_node_settings(ROOT / "scripts/data/template-<slug>/spec.json")
card_settings = SPEC["3229:15071"]          # desktop keys + :tablet_portrait overrides
...
missing = unresolved_asset_ids(elements)
if missing:
    raise SystemExit(f"unresolved <asset:…> in {missing}")   # never upload broken images
```

Repeated cards: build one item from the first id's settings and fill content from the `#1…#N` lines in the outline. Settings snapshot in the plan and spec.json must stay identical (rule 42).

Image/icon URLs come only from `SPEC[node_id]` (already in `settings.image.url`) — no URL constants in the builder. Before upload: `validate_template_json.py --json <out> --assets-json scripts/data/template-<slug>/assets.json`.

## Comparing Bricks vs Figma when G4 % looks fine but the section "looks off"

G4 uses blur + tolerance, so a column that is a few px off or unevenly distributed still passes. Compare positions numerically instead of eyeballing (image descriptions are unreliable):

1. Crop the Bricks PNG to the Figma PNG size, then list vertical runs of "content" rows per column band (`runs(a, x0, x1, y0, y1, thr)`), for example the rail (x 150–500), text column, and card column. Compare the run tables of Figma vs Bricks; the first band whose runs shift is the culprit.
2. Match elements by bbox: white text (`sum>700`), brand colour pills (`#14b5ff`), card photos. Report offsets in px, not %.
3. Text width differing ~1–2% on bold/uppercase only is the Inter version gap (Figma vs browser), not layout — do not chase it with letter-spacing.
4. Mobile PNG must be rendered at the Figma mobile frame width (rule 46). If mobile % is far below desktop with repeated blocks every N px, check the screenshot width first; `review_gates.py` now reads it from the Figma export.

Known Bricks pitfalls found this way (fix in the builder OVERRIDES, not with patches; `scripts/lint_spec_pitfalls.py` detects the first five before building):

| Symptom | Cause | Fix |
|---|---|---|
| Fixed-width column grows to 100% | `_alignSelf: stretch` makes Bricks emit `width: 100%` | drop `_alignSelf`, set parent `_alignItems: stretch` |
| Equal rows with unequal padding drift off centres | Figma `flex: 1 0 0` includes padding; CSS basis 0 is floored at padding, `%` basis resolves against content | use the measured Figma row height (`_height` px, `_flexGrow 0`) |
| SVG line/stroke not visible | Figma line frame is `0px` wide, the stroke overflows; a 0px `<img>` never paints | give it `_width: 1px`, full height, `_objectFit: fill` |
| Dot/ring cut off | asset is drawn with Figma inset (e.g. -16.67%), larger than its layout box | size the image to the asset box and offset with a negative `_margin`; drop duplicated `_boxShadow` |
| Pill label wraps | fixed width minus padding/border is narrower than bold text | `white-space: nowrap` via `_cssCustom` |
| Glass overlay too bright | `background-color` plus an overlay in `_cssCustom` applied twice | keep image in `_background`, put the tint in a flat `_gradient` (`applyTo: background`) |
| Mobile screenshot collapses/tiles | same large image URL repeated inside `_cssCustom` is inlined several times | never repeat asset URLs in custom CSS |
| Circle icon with glow stretched | collapsed Figma "svg" is only the 24px glyph | pad the `image` figure (border, radial-gradient via `_cssCustom`) |

## Reading spec.md

- `role "label" ×N` — `×N` = repeated siblings with identical structure (only the first is spelled out).
- `@991:` line = keys to add with `:tablet_portrait` (already suffixed in spec.json).
- `<asset:NODE>` = asset URL not resolved yet (step 4).
- Single-child style-less Figma wrappers are already collapsed; unmatched wrappers of matched content stay visible on mobile.

For the Figma → Bricks mapping rules the script applies (sizing, defaults, limits), see [reference.md](reference.md).
