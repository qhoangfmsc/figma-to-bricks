# Element Base Controls (Style Tab)

> Verified against Bricks 1.12.3 source (theme path: .../themes/bricks) — 2026-07-14. Corrected: width/height min-max key names, border-radius nesting, `_overflow` control type. See `includes/elements/base.php`.

Every Bricks element inherits these controls from the base class (`includes/elements/base.php`, `set_controls_before()`/`set_controls_after()`). Most are saved with an underscore prefix (`_`).

## Spacing (`_margin`, `_padding`)
Saved as an object: `{ "top": "10px", "right": "0", "bottom": "10px", "left": "0" }`.

## Typography (`_typography`)
Controls font, size, weight, and color.
```jsonc
"_typography": {
  "font-family": "Inter",
  "font-size":   "18px",
  "font-weight": "600",
  "line-height": "1.4",
  "color":       { "hex": "#333333" }
}
```

## Background (`_background`)
```jsonc
"_background": {
  "color":    { "hex": "#FFFFFF" },
  "image":    { "url": "..." },
  "size":     "cover",
  "repeat":   "no-repeat"
}
```

## Border (`_border`) — includes radius, no separate `_borderRadius` key

Confirmed in `includes/assets.php` (`case 'border':`, ~line 1731-1917): border-radius is nested **inside** `_border.radius`, not a top-level `_borderRadius` control — there is no such control in 1.12.3.

```jsonc
"_border": {
  "width":  { "top":"1px","right":"1px","bottom":"1px","left":"1px" },
  "style":  "solid",
  "color":  { "hex": "#E0E0E0" },
  "radius": { "top":"4px","right":"4px","bottom":"4px","left":"4px" }
}
```

## Box Shadow (`_boxShadow`)
```jsonc
"_boxShadow": {
  "values": { "offsetX":"0", "offsetY":"4px", "blur":"10px", "spread":"0" },
  "color":  { "hex": "#0000001A" }
}
```

## Layout & Dimensions
- `_width`, `_widthMin`, `_widthMax`, `_height`, `_heightMin`, `_heightMax` — real key names confirmed in `base.php` (~line 359-443); **not** `_minWidth`/`_maxWidth` as an older draft of this doc said.
- `_zIndex`, `_opacity`.
- `_overflow` — confirmed `type: 'text'` (free CSS value, placeholder `visible`), not a fixed select of hidden/auto (`base.php` ~line 697-706).
- `_display` — for non-layout elements the options are `flex`, `inline-flex`, `block`, `inline-block`, `inline`, `none` (`base.php` ~line 641-660, no `grid`). For nestable layout elements (`section`/`container`/`block`/`div`) `container.php` (~line 150-160) adds its own `_display` with `flex`, `grid`, `block`, `inline-block`, `inline`, `none`.

## CSS Classes & IDs
- `_cssId`: Custom ID.
- `_cssClasses`: String of space-separated classes.
- `_cssGlobalClasses`: Array of Global Class **IDs** (not names).

## Responsive & Hover State
Append `:breakpoint` or `:hover` to the key:
- `_padding:tablet_portrait`
- `_background:hover`
- `_typography:mobile_portrait`

## Custom CSS (`_cssCustom`)
Write raw CSS. Use `%root%` to target the current element wrapper.
