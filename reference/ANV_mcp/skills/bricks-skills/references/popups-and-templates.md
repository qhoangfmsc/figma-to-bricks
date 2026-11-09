# Popups & Templates

> Verified against Bricks 1.12.3 source (theme path: .../themes/bricks) — 2026-07-14. Primary sources: `includes/templates.php` (2438 lines, template type resolution + `run_template_on_hook()` condition engine), `includes/admin.php` (template type case list, ~lines 828-921), `includes/popups.php` (`Popups::set_controls()`, ~lines 40-460), `includes/settings/settings-template.php`, `includes/elements/template.php`. Most of this file's "Trigger Settings", "Limits & Behavior", template-type list, and hook names did not match 1.12.3 and are corrected below.

Templates are a custom post type (`bricks_template`) that can be applied to parts of the site (Header, Footer, Archive) or triggered as Popups.

## Template Types (`_bricks_template_type`)

Real base types, confirmed at `includes/setup.php:1150-1163` (`Setup::get_control_options('templateTypes')`) and `includes/database.php` (`$default_template_types`, active-template keys):
- `header`, `footer`
- `content` (Post/Page/CPT singular — UI label is "Single", but the stored value is `content`, **not `single`**)
- `archive`, `search`, `error` (404)
- `section` (reusable chunks)
- `popup`
- `password_protection` (only shown if `passwordProtectionEnabled` is on)

WooCommerce types (confirmed at `includes/admin.php:828-921`, `switch ($template_type)` case list) — **corrected**: these use a `wc_` prefix and specific names, not the generic `wc_archive`/`woo_single`/`woo_cart`/`woo_checkout`/`woo_account` this doc previously listed:
- `wc_archive` (product archive), `wc_product` (single product — not `woo_single`)
- `wc_cart`, `wc_cart_empty`
- `wc_form_checkout` (checkout — not `wc_checkout`/`woo_checkout`), `wc_form_pay`, `wc_thankyou`, `wc_order_receipt`
- Account area (Woo Phase 3), no single `woo_account` type — it's split into: `wc_account_dashboard`, `wc_account_orders`, `wc_account_view_order`, `wc_account_downloads`, `wc_account_addresses`, `wc_account_form_edit_address`, `wc_account_form_edit_account`, `wc_account_form_login`, `wc_account_form_lost_password`, `wc_account_form_lost_password_confirmation`, `wc_account_reset_password`

## Template Assignment & Conditions

Template conditions live in `_bricks_template_settings.templateConditions[]` (confirmed: `BRICKS_DB_TEMPLATE_SETTINGS` = `_bricks_template_settings` in `functions.php:84`, and `templateConditions` key read in `includes/admin.php:819`).

**Correction**: the condition item shape below (previously `{"main": "include", "type": "entire_website"}`) does not match `Templates::run_template_on_hook()` (`includes/templates.php:2103-2389`). The real shape: `main` selects the **condition type** itself (not include/exclude — that's a separate `exclude` flag), and there is no literal `"entire_website"` string or generic `"type"` field:

```jsonc
"templateConditions": [
  { "main": "any" },                                              // = "Entire website"
  { "main": "postType", "postType": ["product"] },                // postType is an ARRAY, key is "postType" not "post_type"
  { "main": "archiveType", "archiveType": ["any"] },
  { "main": "frontpage" },
  { "main": "search" },
  { "main": "error" },
  { "main": "terms", "terms": ["product_cat::12"] },
  { "main": "ids", "ids": [42, 99] },
  { "main": "postType", "postType": ["post"], "exclude": true }    // presence of "exclude" key = an exclude rule
]
```
See `conditions.md` → "Theme-style & Template Conditions" for the full match-logic explanation (include-only / exclude-only / both).

## Popups

Popups are templates of type `popup`. Settings live in `_bricks_template_settings`, sourced from `Popups::get_controls()` (`includes/popups.php:40-460`) merged into the template settings panel's "Popup" group (`includes/settings/settings-template.php:321-328`).

### Correction: how a popup opens (Trigger Settings)
**There is no dedicated `popupTrigger`/`popupTriggerScrollSelector`/`popupTriggerInactivityDelay` setting in 1.12.3** — grepped `includes/popups.php` and the whole theme, no such keys exist. Popups are opened the same way any element interaction shows a target: an `_interactions` (or the popup's own `template_interactions`) entry with `action: "show"`, `target: "popup"`, `templateId: "<popup template ID>"`, triggered by any real trigger — e.g. `click` on a button, `contentLoaded` (+ `delay`) for an on-load popup, `scroll` (+ `scrollOffset`) for scroll-triggered, `mouseleaveWindow` for exit-intent. See `interactions-and-animations.md` for the real trigger/action list — there is no built-in "inactivity" trigger.

```jsonc
// Auto-open popup ~3s after content loads (real shape)
{
  "trigger": "contentLoaded",
  "delay": "3s",
  "action": "show",
  "target": "popup",
  "templateId": "123"
}
```

### Correction: Limits & Behavior
Real controls (`includes/popups.php:93-460`):
- `popupCloseOn`: select, values `backdrop` | `esc` | `none` (placeholder "Backdrop & ESC" = both by default) — **replaces the previously-listed separate `popupBackdropClose`/`popupEscClose` booleans**, which don't exist.
- `popupLimitWindow` (number, per page load), `popupLimitSessionStorage` (per session), `popupLimitLocalStorage` (persistent), `popupLimitTimeStorage` (hours) — **replaces the previously-listed single `popupLimit`**, which doesn't exist as one field; there are 4 separate limit controls, each independently optional.
- `popupBreakpointMode` (`at` = start display at breakpoint | `on` = display only on specific breakpoints), `popupShowAt`, `popupShowOn` — this is how mobile show/hide is actually controlled. **`popupDisableOnMobile` does not exist** as a dedicated boolean; removed.
- Other real popup controls not previously documented: `popupPadding`, `popupJustifyConent`/`popupAlignItems` (popup box alignment), `popupZindex` (default 10000), `popupBodyScroll`, `popupScrollToTop`, `popupDisableAutoFocus`, `popupAjax` (+ AJAX loader sub-settings, Woo Quick View support), `popupDisableBackdrop`, `popupBackground`, `popupBackdropTransition`, `popupContentPadding`/`Width`/`Height`/`Background`/`Border`/`BoxShadow`.

### Interaction (Triggering via Click)
Any element can trigger a popup via an interaction:
```jsonc
{
  "trigger": "click",
  "action":  "show",
  "target":  "popup",
  "templateId": "123" // Template ID — correction: field is "templateId", not "popupId" (confirmed includes/interactions.php:288-295)
}
```

## Programmatic Insertion

Insert a template into a page using the `template` element (confirmed `includes/elements/template.php:17-23,40`):
```jsonc
{
  "name": "template",
  "settings": {
    "template": "123"   // correction: the settings key is "template", not "templateId" — the element reads $settings['template']
  }
}
```
Optional: `"noRoot": true` renders without the wrapping `<div>` (style-tab settings on the element then have no effect).

## Hooks

**Correction**: grepped the whole theme for `bricks/template/id` and `bricks/template/conditions` — neither filter exists anywhere in 1.12.3. The hook examples below (previously shown as real) are not present in this version's source and should not be relied on.

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — không tìm thấy `bricks/template/id` hay `bricks/template/conditions` ở đâu trong source qua grep. Có thể là API của bản khác hoặc bị hiểu nhầm; giữ lại tham khảo nếu cần đối chiếu sau này, nhưng đừng dùng trên site 1.12.3 này.
>
> ```php
> // Resolve which template to use (Advanced)
> add_filter( 'bricks/template/id', function( $template_id, $template_type ) {
>     return $template_id;
> }, 10, 2 );
>
> // Modify template conditions list
> add_filter( 'bricks/template/conditions', function( $conditions ) {
>     return $conditions;
> } );
> ```
