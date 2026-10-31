# Figma → Bricks mapping applied by `scripts/lib/figma_spec.py`

Use this when hand-fixing a value or when the script output looks wrong. Shapes follow `bricks-skills/references/style-settings.md`.

## Roles

| Figma | Role | Notes |
|-------|------|-------|
| Root node | `section` | |
| Only flow child of root | `container` | `_width 100%` + `_widthMax <figma width>`; several children → `containerHint` only |
| TEXT ≥24px, or ≥20px with weight ≥600 | `heading` | tag by size rank: largest h2, next h3… (h1 decided in plan) |
| Other TEXT | `text-basic` | |
| Vector-only subtree (icons, logos, illustrations) | `svg` | Not descended; one asset (Bricks `image` with svg URL) |
| Leaf with IMAGE fill | `image` | `image.url` + `_objectFit` (FILL/STRETCH → cover, FIT → contain) |
| ≤72px high, one text, fill/stroke + radius, or name matches button/btn/cta/nút | `button` | Fill/radius/padding adopted from inner frame |
| Auto-layout frame | `block` | Bricks block = full-width flex column by default |
| Free-layout frame / group | `div` | Children become `_position absolute` |

Single-child frames with no padding, fill, stroke, effect, radius or opacity are collapsed into their child (the child keeps the wrapper's size/sizing).

## Layout

| Figma | Bricks |
|-------|--------|
| HORIZONTAL / VERTICAL | `_display flex` · `_direction row/column` |
| itemSpacing (not space-between) | row → `_columnGap`, column → `_rowGap` |
| WRAP with N items on first row, or GRID | `_display grid` · `_gridTemplateColumns repeat(N, minmax(0, 1fr))` · `_gridGap "row col"` |
| primaryAxisAlignItems CENTER/MAX/SPACE_BETWEEN | `_justifyContent center/flex-end/space-between` |
| counterAxisAlignItems | `_alignItems` (always emitted; MIN → flex-start) |
| padding | `_padding` sides |
| Row overflows its frame | mobile frame (<768px) → `_overflow auto` + `_flexWrap nowrap`, items `_flexShrink 0`; desktop → `_overflow hidden` (strip/marquee) |
| clipsContent + radius or absolute children | `_overflow hidden` |
| Absolute child | `_position absolute` · `_top/_left` relative to parent · `_width/_height`; parent `_position relative` |

## Sizing (relative to parent direction)

| Child sizing | Parent row | Parent column |
|--------------|------------|---------------|
| FILL width | `_flexGrow 1` · `_flexBasis 0` | `_width 100%` |
| FIXED width | `_width Npx` · `_flexShrink 0` | `_width Npx` |
| HUG width (block/button) | `_width auto` | `_width auto` |
| FILL height | `_alignSelf stretch` | `_flexGrow 1` |
| FIXED height | `_heightMin` if it has flow children, else `_height` | same |
| Fixed-width wrapping text | `_widthMax Npx` instead of `_width` | same |

## Style

| Figma | Bricks |
|-------|--------|
| Solid fill | `_background.color` (`hex`, or `rgb` when alpha < 1) |
| Image fill on a frame with children | `_background.image` (`external`) + `size`/`position`/`repeat` |
| Linear/radial/angular gradient | `_gradient` (`applyTo background`; angle from gradient handles, ≈) |
| Gradient text fill | `_gradient` `applyTo text` |
| Solid stroke | `_border.width/style/color` |
| Gradient stroke | **not** emitted as `_border` (colorless border = currentColor); `⚠` note → `_cssCustom` |
| Corner radius / per-corner | `_border.radius` (top-left, top-right, bottom-right, bottom-left) |
| Drop / inner shadow | `_boxShadow` (`inset` for inner) |
| Layer blur | `_cssFilters.blur` = radius / 2 |
| Background blur | `_cssCustom` `backdrop-filter: blur(radius/2 px)` |
| Node opacity, image-fill opacity | `_opacity` |

## Text

`_typography`: `font-family`, `font-size`, `line-height` (px from Figma), `font-weight`, `color`, `text-align` (non-left), `text-transform` (UPPER/LOWER/TITLE), `letter-spacing`, `text-decoration`. Headings and text get `_margin 0` to neutralize theme margins. Mixed styles appear as `span "…"` runs in the outline — the script does not write HTML spans.

## Desktop ↔ mobile pairing

1. Texts by normalized content (whitespace/case-insensitive), then fuzzy ≥0.8, then fragment-in-text (desktop "Thuê" + "VPS OPENCLAW" ↔ mobile "THUÊ VPS OPENCLAW"; fragments only take size/line-height/weight).
2. Containers by shared texts (Jaccard ≥0.6), best pairs first.
3. Graphics/images inside paired parents by name, then by coarse role.
4. Unpaired desktop node with nothing paired inside → `_display:tablet_portrait none`; unpaired wrapper of paired content → unchanged.
5. Changed keys → `key:tablet_portrait`; keys missing on mobile get neutral resets (`_position relative`, `_height auto`, `_widthMax none`, `_flexGrow 0`, gaps `0`, …).

## Strategy suggestion

| Signal | Suggestion |
|--------|-----------|
| No mobile URL | `n/a` |
| Desktop node named arrow/prev/next/chevron/dots/slider + mobile overflow row | `slider-responsive` (alt `carousel-dual`) |
| Desktop nav names only | `slider-responsive` |
| Significant mobile-only block outside repeated items | `dual-block` |
| Otherwise (stack, resize, grid → scroll row, hidden blocks) | `breakpoint-only` |

## Known limits

- Image crop transforms (`imageTransform`) are approximated by `cover`.
- Rotation, masks and boolean shapes are not translated (masks/booleans usually export as `svg`).
- Text in Figma components with variable-bound fonts uses the resolved family/weight from REST.
