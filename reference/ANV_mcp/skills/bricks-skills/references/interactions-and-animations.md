# Interactions & Animations

> Verified against Bricks 1.12.3 source (theme path: .../themes/bricks) — 2026-07-14. Primary source: `includes/interactions.php` (control/field definitions), `includes/setup.php` (`animationTypes` option list), `includes/elements/base.php` (deprecated "Entry animation" note). Several claims below were wrong for 1.12.3 (invented trigger/action names, wrong field names) and have been corrected in place; see inline notes.

Bricks uses the `_interactions` array (repeater field) for events (click, hover, scroll) and animations.

## Interaction Shape

Real fields, per `includes/interactions.php` repeater definition (`id`, `trigger`, `action`, `target`, `targetSelector`, `templateId`, plus action-specific fields):

```jsonc
{
  "id":       "abc123",
  "trigger":  "click",
  "action":   "show",
  "target":   "custom",
  "targetSelector": ".my-class"
}
```

Notes:
- `target` is an enum: `self` | `custom` | `popup` (`includes/interactions.php:244-254`). When `target` is a CSS selector you use `target: "custom"` + `targetSelector: "..."` — there is no generic `"target": "selector"` value, and the CSS-selector field is `targetSelector`, not `selector`.
- When `target: "popup"`, the popup to show/hide is chosen via `templateId` (a template post ID), not `popupId` — see `popups-and-templates.md`.

### Triggers

Real trigger options (`includes/interactions.php:46-73`):
- Element: `click`, `mouseover` (hover), `focus`, `blur`, `mouseenter`, `mouseleave`, `enterView` (enter viewport), `leaveView` (leave viewport), `animationEnd`, `ajaxStart`/`ajaxEnd` (query AJAX loader), `formSubmit`, `formSuccess`, `formError`
- Browser/Window: `scroll` (window scroll position, has a `scrollOffset` field — this is a scroll-position trigger, not "element enters view"; use `enterView`/`leaveView` for that), `contentLoaded` (fires on page/AJAX content load, has a `delay` field), `mouseleaveWindow` (exit-intent)
- Query filters (only when query filters are enabled): `filterOptionEmpty`, `filterOptionNotEmpty`

Corrections from an earlier version of this doc: **`load` is not a real trigger** — the equivalent is `contentLoaded`. **`popupShow`/`popupHide` are not real triggers** — no such trigger names exist in the source.

### Actions

Real action options (`includes/interactions.php:163-180`):
- `show`, `hide` (show/hide the target element)
- `setAttribute`, `removeAttribute`, `toggleAttribute` (generic attribute mutation — set `actionAttributeKey` / `actionAttributeValue`)
- `toggleOffCanvas` (@since 1.11 — toggles an offcanvas; don't set on a Toggle element)
- `loadMore` (query loop "load more", needs `loadMoreQuery`)
- `startAnimation`
- `scrollTo` (has `scrollToOffset` px, `scrollToDelay` ms — not `scrollToElement`)
- `javascript` (calls a global JS function named in `jsFunction`, optional `jsFunctionArgs`)
- `storageAdd`, `storageRemove`, `storageCount` (browser storage, `storageType`: `windowStorage`/`sessionStorage`/`localStorage`)

Corrections from an earlier version of this doc: **`toggle` is not a real action** (only `show`/`hide` exist). **`addClass`/`removeClass`/`toggleClass` do not exist** — class-like mutation is done generically via `setAttribute`/`removeAttribute`/`toggleAttribute` (e.g. targeting the `class` attribute), there is no dedicated class-list action. **`showPopup`/`hidePopup` do not exist** — showing/hiding a popup is `action: "show"` (or `"hide"`) + `target: "popup"` + `templateId`. **`scrollToElement` is not the real name** — it's `scrollTo`.

## Animations (`startAnimation`)

Bricks bundles **Animate.css**. `animationType` uses the literal Animate.css class names, from the fixed list in `includes/setup.php:1165-1279` (confirmed present): `fadeIn`, `slideInUp`, `zoomIn`, `bounceIn`, `fadeOut`, `slideOutDown`, `pulse`, `tada`, etc.

- **Entrances**: `fadeIn`, `slideInUp`, `zoomIn`, `bounceIn`.
- **Exits**: `fadeOut`, `slideOutDown`.
- **Attention**: `pulse`, `tada`, `shakeX`, `shakeY` (correction: there is no plain `shake` — Animate.css v4 in this build only exposes `shakeX`/`shakeY`).

Settings (`includes/interactions.php:225-242`):
- `animationDuration`: **CSS time string**, e.g. `"1s"` or `"400ms"` (placeholder is `1s`) — correction: not a raw milliseconds number.
- `animationDelay`: **CSS time string**, e.g. `"0s"` or `"200ms"` (placeholder is `0s`) — correction: not a raw milliseconds number.

## Entrance Animations (Deprecated)
*Confirmed accurate: `includes/elements/base.php` (~line 1493-1505) — the old per-element "Entry animation" control on the Style tab is deprecated since 1.6 in favor of Interactions, with a converter under Bricks > Settings > General > Converter.*

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — tính năng của bản 2.x, xác nhận qua grep source không thấy. Giữ lại tham khảo nếu site nâng cấp sau này.
>
> ## Custom JS Hooks
>
> The snippet below (`bricksInteraction({ action: 'show', target: 'selector', selector: '.my-element' })`) does not match any public function in `assets/js/frontend.js`. The real frontend interaction runtime exposes internal functions named `bricksInteractions()`, `bricksInteractionCallback()`, `bricksInteractionCallbackExecution()` — none of which is a documented/stable public API matching this signature. Do not rely on this snippet on this 1.12.3 site.
>
> ## Programmatic Hooks
>
> ```php
> add_filter( 'bricks/interactions/triggers', function( $triggers ) { ... } );
> add_filter( 'bricks/interactions/actions', function( $actions ) { ... } );
> ```
> Grepped the entire theme (`includes/interactions.php` and beyond) for `bricks/interactions/triggers` and `bricks/interactions/actions` — neither filter exists anywhere in 1.12.3. There is no documented way to register custom trigger/action option labels via a filter in this version.
