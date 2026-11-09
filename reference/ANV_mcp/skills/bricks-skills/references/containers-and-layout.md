# Containers, Sections, Blocks, Divs -- Layout System

> Verified against Bricks 1.12.3 source (theme path: .../themes/bricks) — 2026-07-14. Corrected: flex/grid control keys (no generic `_gap` or `_alignContent` on layout elements; grid uses `*Grid`-suffixed keys), and flagged several controls (`_sticky*`, `_overlay`, `_columnCount`, `_gridItemJustifySelf`, `disableLinkOnClick`) not found anywhere in `includes/elements/container.php` or `base.php`.

The four nestable layout elements (`section`, `container`, `block`, `div`) share a control set inherited from `Element_Container`. The differences are mostly **default tag** and **default children**:

| Element | Default tag | Default children when added | Vue component |
|---|---|---|---|
| `section` | `<section>` | one `container` child (so the canonical pattern is section > container > content) | `bricks-nestable` |
| `container` | `<div>` (or `tag` setting) | none (empty) | `bricks-nestable` |
| `block` | `<div>` | none | `bricks-nestable` |
| `div` | `<div>` | none | `bricks-nestable` |

All four accept `tag` (a select with `section`, `header`, `footer`, `aside`, `article`, `nav`, `main`, `div`, `custom`) and `customTag` (text). Set `tag: 'custom'` to use `customTag`.

## Choosing the right one

- **`section`** for top-level page slices (Hero, Features, Pricing, Footer-CTA). Renders semantic `<section>`.
- **`container`** as the inner constrained-width wrapper inside a section. Holds your columns/grid.
- **`block`** for repeating content blocks inside a container (cards, list items).
- **`div`** for the lightest wrapping when semantics don't matter (icon stacks, layout helpers).

The convention you'll see in well-built Bricks sites:
```
section (full-width bg)
  +-- container (max-width inner, flex/grid)
        +-- block / div / heading / icon-box / --
        +-- --
```

## ⚠️ Default `width:100%` on `block`/`div` — core CSS trap (confirmed 2026-07-16)

Bricks' own frontend stylesheet ships a base class rule (confirmed via `assets/css/frontend.min.css`, class `.brxe-block`):
```css
.brxe-block{align-items:flex-start;display:flex;flex-direction:column;width:100%}
```
Any `block`/`div` element that does **not** have its own `_width` in `settings` inherits this — it stretches to **100% of its parent**, not to its content size. This is invisible for elements meant to be full-width (cards, content columns), but silently breaks any element meant to **shrink-wrap its content** (an icon+label pill, a "Link"/"Xem tất cả" row, a badge, a nav-button wrapper) that sits as one of several siblings in a flex row:

- If left at default (`_flexShrink` unset, browser default `1`), the browser shrinks it back down non-uniformly relative to its siblings — content still *reads* okay but spacing/alignment is subtly wrong (e.g. a date+icon group with a large unexplained gap before the next sibling).
- If you also add `"_flexShrink": 0` (e.g. following the Overflow-Safety rule — `bricks_rules.md` §17) **without** an explicit `_width`, the element gets *worse*: it locks in at the bogus 100% basis and visually stretches across (nearly) the whole row, pushing/overlapping its siblings — this is what broke `justify-content:space-between` headers (title stuck to the "Xem tất cả" link) and turned a filter-tab row into one giant pill in two separate builds (2026-07-15/16, full incident write-up in `bricks_rules.md` §18).

**Rule**: any `block`/`div` that should hug its own content — not stretch — needs an explicit `"_width": "auto"` in `settings`, and this becomes **mandatory, not optional,** the moment you also set `"_flexShrink": 0` on it. Pattern:
```json
{ "_display": "flex", "_direction": "row", "_alignItems": "center", "_columnGap": "8px", "_width": "auto", "_flexShrink": 0 }
```
`section` and `container` are less commonly hit by this in practice (they're usually intentionally full-width already), but the same default applies to them too — verify with a quick computed-width check (Playwright `getBoundingClientRect()`) any time a row's children look mis-spaced despite correct `justify-content`/`gap` CSS.

**`_flexShrink: 0` itself is optional** — the two settings solve different problems and aren't a package deal:
- `_width: "auto"` fixes *stretching* (this trap) and should be added whenever a `block`/`div` must hug its content.
- `_flexShrink: 0` fixes *shrinking/wrapping* under a tight row — only needed for content that must never break mid-line (short unbreakable labels/prices/badges — see `bricks_rules.md` §17). If the element has no risk of being squeezed (roomy row, or shrinking a little is harmless), skip `_flexShrink` and leave the browser default (`1`).
- If you *do* need `_flexShrink: 0` for that reason, `_width: "auto"` becomes mandatory alongside it (per the Rule above) — that combination is the only mandatory pairing, not `_flexShrink: 0` on its own.

## Layout controls

All values below are saved into `settings`. Below `_direction` is a `direction` control (string), `_alignItems` etc. are alignment controls (string), `_columnGap`/`_rowGap` are number controls with units.

### Flex (default `_display: 'flex'`)

Confirmed against `includes/elements/container.php` (`set_controls()`, ~line 150-420 — this is the control set for `section`/`container`/`block`/`div`):

```jsonc
"_display":        "flex",
"_direction":      "row",                 // row | column | row-reverse | column-reverse
"_flexWrap":       "nowrap",              // nowrap | wrap | wrap-reverse
"_alignItems":     "center",              // flex-start | center | flex-end | stretch | baseline
"_justifyContent": "space-between",       // flex-start | center | flex-end | space-between | space-around | space-evenly
"_alignSelf":      "stretch",             // set on the child, not the flex parent
"_columnGap":      "20px",
"_rowGap":         "20px",
"_flexGrow":       0,
"_flexShrink":     1,
"_flexBasis":      "auto",
"_order":          0
```

Corrections: there is **no** `_alignContent` control on `section`/`container`/`block`/`div` in 1.12.3 (only the grid equivalent `_alignContentGrid` exists — see Grid below), and there is **no** generic `_gap` control for these layout elements — only `_columnGap`/`_rowGap` (`_gap` does exist, but only as a base-class control for *non*-layout elements' flex settings, e.g. icon-box/button, in `includes/elements/base.php` ~line 921).

**Alignment cheat-sheet (row direction):**
- Center horizontally + vertically: `_direction: row`, `_justifyContent: center`, `_alignItems: center`.
- Stretch evenly across width: `_justifyContent: space-between` and `_flexWrap: wrap` if items overflow.

### Grid

Set `_display: 'grid'` and use (confirmed in `container.php` ~line 187-322; grid alignment keys are suffixed `Grid` to avoid clashing with the flex keys of the same element):
```jsonc
"_display":             "grid",
"_gridTemplateColumns": "repeat(3, 1fr)",   // any valid CSS string
"_gridTemplateRows":    "auto",
"_gridAutoFlow":        "row",              // row | column | dense
"_gridAutoColumns":     "1fr",
"_gridAutoRows":        "auto",
"_gridGap":             "24px",             // shorthand, CSS 'grid-gap' -> '{column-gap} {row-gap}'
"_justifyItemsGrid":    "start",
"_alignItemsGrid":      "stretch",          // grid items vertical
"_justifyContentGrid":  "start",            // track alignment horizontal
"_alignContentGrid":    "stretch"           // track alignment vertical (wrap rows)
```

Note: unlike flex, grid does **not** have separate `_columnGap`/`_rowGap` controls on these elements — only the `_gridGap` shorthand. And the alignment controls are `_justifyItemsGrid`/`_alignItemsGrid`/`_justifyContentGrid`/`_alignContentGrid` — not the bare `_alignItems`/`_justifyContent` used by flex (those two are `required: _display=flex` only).

Per-item placement (set on the **child** element, confirmed `container.php` ~line 45-67):
```jsonc
"_gridItemColumnSpan": "span 2",
"_gridItemRowSpan":    "span 1"
```

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — `_gridItemJustifySelf` không tìm thấy trong source (`container.php` chỉ có `_gridItemColumnSpan`/`_gridItemRowSpan`). Có thể là suy đoán sai hoặc tính năng của bản khác. Giữ lại tham khảo nếu site nâng cấp sau này.

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — `_columnCount` không tìm thấy ở bất kỳ đâu trong source (`grep -r "_columnCount" includes/` không có kết quả). Đây có thể là tính năng của bản khác hoặc suy đoán sai. Giữ lại tham khảo nếu site nâng cấp sau này.
### Legacy `_columnCount` (avoid in new work)

Some older elements still use `_columnCount` (number 1--12) -- Bricks generates a 12-col flex grid. Prefer `_display: grid` instead.

### Masonry (image gallery, posts, etc.)

Confirmed in `includes/elements/base.php` (~line 997-1086); default-enabled elements are `section`/`container`/`block`/`div` (`support_masonry_element()`, ~line 4321).

```jsonc
"_useMasonry":                 true,
"_masonryColumn":              3,          // key is singular "Column", not "Columns"
"_masonryGutter":              "16px",
"_masonryTransitionDuration":  "0.4s",
"_masonryTransitionMode":      "default"
```
Only elements with `support_masonry_element()` returning true will respect these — call it on the element instance, not statically.

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — `_masonryHorizontalOrder` không tìm thấy trong source (`base.php` chỉ có `_useMasonry`, `_masonryColumn`, `_masonryGutter`, `_masonryTransitionDuration`, `_masonryTransitionMode`). Giữ lại tham khảo nếu site nâng cấp sau này.

## Container-only controls

Confirmed real (container.php `set_controls()`): `link`, `tag`, `customTag`, `_shapeDividers` (repeater, defined in `base.php` for layout elements, ~line 1121-1293).

```jsonc
"link":               { "type": "internal", "url": "/case-studies" },
"tag":                "section",
"customTag":          "main",
"_shapeDividers": [ { /* per-divider config, fields: shape, shapeCustom, fill, front, flipHorizontal, flipVertical, overflow, height, width, rotate, horizontalAlign, verticalAlign, top, right, bottom, left */ } ]
```

When `link` is set (`required: [ 'tag', '=', 'a' ]`), the container wraps its content in a clickable `<a>` wrapper.

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — `disableLinkOnClick`, `_sticky`, `_stickyOffset`, `_stickyAtBreakpoint`, `_stickyTopOffset`, `_overlay` (dạng repeater "overlay layers") không tìm thấy ở bất kỳ đâu trong `container.php` hoặc `base.php`. Sticky thực tế trong 1.12.3 dùng control chung `_position: sticky` + `_top` (xem phần "Sticky containers" bên dưới), không có nhóm control `_sticky*` riêng hay `_overlay`. Đây có thể là tính năng của bản 2.x hoặc suy đoán sai. Giữ lại tham khảo nếu site nâng cấp sau này.

## Backgrounds (full set)

Confirmed accurate: background image + video can coexist on layout elements — video plays as an overlay wrapper on top of the `_background.image`/color (`container.php` `get_background_video_html()`).

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — "multiple background layers" / `_background.layers` (array) không tìm thấy trong source (`grep -r "layers" includes/elements/base.php includes/assets.php` không có kết quả liên quan). `_background` trong 1.12.3 là một object phẳng (color/image/attachment/blendMode/repeat/position/size + video*), không phải mảng nhiều layer. Đây là tính năng của bản 2.x (Style Manager). Giữ lại tham khảo nếu site nâng cấp sau này.

## Sticky containers

Use `_position: sticky` + `_top: "0"` + sufficient parent height for the effect to work. Bricks adds the sticky CSS but cannot make a flex child sticky unless its parent layout permits it.

## Aspect ratio

```jsonc
"_aspectRatio": "16/9"
```
Pairs nicely with `_overflow: hidden` and `_background.image`/`_background.video` for video-fill panels.

## Children defaults (custom elements)

If you write a custom nestable element and want it to ship with default children (like `section` ships with a `container`), implement `get_nestable_children()`:

```php
public function get_nestable_children() {
  return [
    [ 'name' => 'container', 'settings' => [], 'children' => [] ],
  ];
}
```
And `get_nestable_item()` for what a "new repeater item" looks like (used by accordions/tabs/sliders nested variants).

## When to nest vs flatten

- Each nestable element adds a DOM wrapper. Don't add unnecessary div/blocks if you can do the layout on the existing container.
- For complex grids with overlapping items, prefer one grid container with grid-area placements over multiple nested flex containers.
- Sliders/tabs/accordions need the **nested** variant (e.g. `slider-nested`) when content needs to be Bricks elements rather than plain text -- the basic `slider`/`tabs`/`accordion` use repeater items with limited content fields.
