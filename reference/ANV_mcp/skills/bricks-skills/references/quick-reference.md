# Quick Reference -- Naming, Class Names, Common JSON

> Verified against Bricks 1.12.3 source (theme path: `.../wp-content/themes/bricks`) — 2026-07-14.

Cheat sheet to look up fast. For depth, jump to the specialized references.

## Class & ID naming

| What | Selector / convention |
|---|---|
| Element root class (by name) | `.brxe-{element-name}` -- e.g. `.brxe-heading`, `.brxe-icon-box` |
| Element root class (by id) | `.brxe-{6charid}` -- e.g. `.brxe-abc123` |
| Element root id attr | `id="brxe-{6charid}"` -- only when CSS settings exist or `_cssId` set |
| Custom CSS id | `id="{settings._cssId}"` (no prefix) |
| Custom classes | from `settings._cssClasses` (space-sep, no dots) |
| Global class | 🔧 `.{className}` -- the class's own `name` field from `bricks_global_classes`, output verbatim (e.g. `u-container`), **not** `.brxe-{id}`. Confirmed at `includes/elements/base.php:2004-2024` (`get_element_global_classes()`: `$class_ids_names = wp_list_pluck( $global_classes, 'name', 'id' ); $element_classes[] = $class_ids_names[ $class_id ];`) -- the class `id` is only used to look up the `name`, the rendered HTML class is the name. |
| Component instance | uses `.brxe-{cid}` (component definition id), not the per-instance id |
| Inside `_cssCustom` | `%root%` resolves to `.brxe-{6charid}` at render |
| Element data attribute | `data-x-element="{name}"` (builder context) |

## Element name -> element class file

```
container -> includes/elements/container.php -> \Bricks\Element_Container
icon-box  -> includes/elements/icon-box.php  -> \Bricks\Element_Icon_Box
post-toc  -> includes/elements/post-toc.php  -> \Bricks\Element_Post_Table_Of_Contents   -- 🔧 corrected, see below
```

Built-in name -> class: replace `-` with `_`, then `ucwords(_)`, prefix `\Bricks\Element_` -- **this is only a loose convention, not a hard rule**. `container` and `icon-box` follow it exactly (confirmed `class Element_Container` / `class Element_Icon_Box` at the top of their files), but `post-toc.php` does not: its class is `Element_Post_Table_Of_Contents` (`includes/elements/post-toc.php:6`), not `Element_Post_Toc`. This is possible because `Elements::register_element()` (`includes/elements.php:158-183`) doesn't compute the class name from the file name at all -- it just takes "the last declared class" in the required file (`end( get_declared_classes() )`) unless a class name is passed explicitly. **Don't assume the naming rule; read the element file's `class` declaration directly when unsure** (see "When in doubt" below).

## Saved JSON cheat-sheet (one element)

```jsonc
{
  "id":      "abc123",
  "name":    "container",
  "parent":  "0",                            // or parent id string
  "children":[ "def456", "ghi789" ],
  "settings":{
    "tag":           "section",
    "_direction":    "row",
    "_alignItems":   "center",
    "_justifyContent":"space-between",
    "_columnGap":    "32px",

    "_padding":            { "top":"80px","right":"24px","bottom":"80px","left":"24px" },
    "_padding:tablet_portrait": { "top":"40px","right":"16px","bottom":"40px","left":"16px" },

    "_typography":   { "font-size":"18px","color":{ "hex":"#0f172a" } },
    "_background":   { "color":{ "hex":"#f8fafc" } },
    "_border":       { "radius":{ "top":"12px","right":"12px","bottom":"12px","left":"12px" } },

    "_cssClasses":       "u-container",
    "_cssGlobalClasses": [ "clsAbc123" ],
    "_cssCustom":        "%root% { will-change: transform; }",

    "_interactions": [
      { "trigger":"enterView","action":"startAnimation","target":"self",
        "animationType":"fadeInUp","animationDuration":"0.8s","runOnce":true }
    ],

    "_conditions": [
      { "key":"user_logged_in","compare":"!=","value":"1" }
    ],

    "_attributes": [
      { "name":"data-track","value":"hero" }
    ]
  }
}
```

## Default breakpoint keys

`desktop` (1279, base) * `tablet_portrait` (991) * `mobile_landscape` (767) * `mobile_portrait` (478)

Suffix any settings key: `_padding:mobile_portrait`, `_typography:tablet_portrait`.

## Element categories

`basic` * `layout` * `general` * `media` * `wordpress` * `single` * `query` * `filter` * `woocommerce` * `custom` (used by child theme).

## Control types (the `'type'` field)

`text * textarea * editor * code * number * select * checkbox * color * gradient * image * image-gallery * icon * link * audio * video * svg * typography * border * spacing * dimensions * box-shadow * text-shadow * background * text-align * align-items * justify-content * direction * transform * transition * repeater * query * filters * datepicker * separator * info`

## Common control_options keys (preset option lists)

`animationTypes`, `lightboxAnimationTypes`, `ajaxLoaderAnimations`, `borderStyle`, `fontWeight`, `fontStyle`, `iconPosition`, `objectFit`, `position`, `queryTypes`, `queryOrder`, `queryOrderBy`, `termsOrderBy`, `usersOrderBy`, `queryCompare`, `queryOperator`, `queryValueType`, `templateTypes`, `imageSizes`, `taxonomies`, `userRoles`, `backgroundPosition`, `backgroundRepeat`, `backgroundSize`, `backgroundAttachment`, `blendMode`, `buttonSizes`, `styles`, `whiteSpace`, `textWrap`.

## DB constants (cheat sheet)

```
BRICKS_DB_PAGE_HEADER         = _bricks_page_header_2
BRICKS_DB_PAGE_CONTENT        = _bricks_page_content_2
BRICKS_DB_PAGE_FOOTER         = _bricks_page_footer_2
BRICKS_DB_PAGE_SETTINGS       = _bricks_page_settings
BRICKS_DB_TEMPLATE_TYPE       = _bricks_template_type
BRICKS_DB_TEMPLATE_SETTINGS   = _bricks_template_settings
BRICKS_DB_EDITOR_MODE         = _bricks_editor_mode

BRICKS_DB_GLOBAL_SETTINGS     = bricks_global_settings
BRICKS_DB_BREAKPOINTS         = bricks_breakpoints
BRICKS_DB_THEME_STYLES        = bricks_theme_styles
BRICKS_DB_GLOBAL_CLASSES      = bricks_global_classes
BRICKS_DB_GLOBAL_VARIABLES    = bricks_global_variables
BRICKS_DB_COLOR_PALETTE       = bricks_color_palette
BRICKS_DB_COMPONENTS          = bricks_components
BRICKS_DB_TEMPLATE_SLUG       = bricks_template
```

## Bricks PHP helpers (use, don't reinvent)

```php
bricks_is_builder()        // editor canvas
bricks_is_builder_main()   // editor chrome (panel side)
bricks_is_builder_iframe() // editor canvas iframe
bricks_is_frontend()
bricks_is_ajax_call()
bricks_is_rest_call()

\Bricks\Helpers::generate_random_id( $echo = true )           // 🔧 corrected: param controls whether the id is echoed (default true), not "with dash" -- see includes/helpers.php:1406
\Bricks\Database::get_data( $post_id, $area = '' )
\Bricks\Database::get_setting( $key, $fallback = false )      // global setting
// ⚠️ Không tồn tại trong Bricks 1.12.3 (site này) -- xác nhận qua grep includes/theme-styles.php không thấy method này (tính năng của bản 2.x hoặc chưa bao giờ tồn tại). Giữ lại tham khảo nếu cần.
// \Bricks\Theme_Styles::get_setting_by_key( $element_name )  // method not found; theme-styles.php's real public methods are get_control_groups(), get_controls(), get_controls_data(), set_active_style(), create_styles(), delete_style()
\Bricks\Breakpoints::get_breakpoints()
\Bricks\Breakpoints::$is_mobile_first
\Bricks\Elements::register_element( $file, $name = '', $class = '' )
\Bricks\Elements::get_element( $element, $property = '' )
```

## Frontend JS globals

- `window.bricksData` -- server-injected config (confirmed throughout `assets/js/frontend.js`, e.g. `window.bricksData.interactions`, `window.bricksData?.i18n`, `window.bricksData.nonce`).
- `window.bricksUtils` -- plain object of utility helper functions (`assets/js/frontend.js:137`, `const bricksUtils = {...}`), e.g. `bricksUtils.getFiltersForQuery()`, `bricksUtils.hideOrShowLoadMoreButtons()`, `bricksUtils.debounce()`.
- 🔧 `BricksFunction` is corrected below -- it is **not** a method on `bricksUtils`.
- ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — không tìm thấy `bricksAnimations` ở bất kỳ đâu trong `assets/js/` (kể cả bản minified). Animation type names/config are exposed via `control_options.animationTypes` server-side (`includes/setup.php:1165`), not a `bricksAnimations` JS global.

`BricksFunction` is its own **top-level class** (`assets/js/frontend.js:678`, `class BricksFunction {...}`), used as `new BricksFunction({...})` -- it is not called as `bricksUtils.BricksFunction(name, fn)`. Real usage pattern, e.g. `assets/js/frontend.js:1132`:
```js
const bricksInitQueryLoopInstancesFn = new BricksFunction({
  parentNode: document,
  selector: '.my-selector',
  eachElement: (el) => { /* init logic */ },
  // ...
})
```
When custom JS depends on Bricks-rendered HTML being in the DOM, wrap the init in `new BricksFunction({...})` so it re-runs after AJAX-loaded content (loop pagination, query filters, AJAX popups) -- the exact option shape (`parentNode`, `selector`, `eachElement`, etc.) should be read directly from `assets/js/frontend.js`'s `BricksFunction` class before relying on it, since it's unminified/first-party but not officially documented.

## "Did Bricks really save what I think?" -- verify

```bash
# WP-CLI
wp post meta get <id> _bricks_page_content_2 --format=json
```

Or read with PHP:
```php
$elements = get_post_meta( $id, '_bricks_page_content_2', true );
print_r( $elements );
```

If the result is a string (not an array), it's invalid -- Bricks expects a serialized array. Re-save in the builder to fix.

## When the panel and the rendered page disagree

1. Hard refresh (CSS files cache).
2. Bricks > Settings > General > Regenerate CSS files.
3. Confirm `cssLoading` setting (file vs inline) matches your environment.
4. Inspect rendered HTML -- does it have `.brxe-{id}` for the expected element? If not, the JSON is malformed.
5. Check `_conditions` -- element may be conditionally hidden.

## When in doubt

Read the element source: `{template_dir}/includes/elements/{name}.php` is the source of truth for what controls and settings keys exist. Don't guess.
