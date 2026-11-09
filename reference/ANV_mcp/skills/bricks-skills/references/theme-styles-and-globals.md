# Theme Styles & Globals

> Verified against Bricks 1.12.3 source (theme path: .../themes/bricks) — 2026-07-14. Option keys confirmed via `functions.php` constant defines (`BRICKS_DB_THEME_STYLES` = `bricks_theme_styles`, `BRICKS_DB_GLOBAL_CLASSES` = `bricks_global_classes`, `BRICKS_DB_GLOBAL_VARIABLES` = `bricks_global_variables`, `BRICKS_DB_COMPONENTS` = `bricks_components`, `BRICKS_DB_COLOR_PALETTE` = `bricks_color_palette`) and `includes/database.php`. `_cssGlobalClasses` storing class IDs (not BEM names) confirmed at `includes/elements/base.php:1733-1734, 4275-4295`. Component instance keys `cid` / `instanceId` confirmed at `includes/elements/base.php:75,86` and `includes/components.php`. One precision fix made below (theme-style conditions storage path).

Bricks uses global options for theme-wide styling, classes, variables, and components.

## Theme Styles (`bricks_theme_styles`)

Theme styles define defaults for elements (h1, buttons, links).
- **Structure**: Array of theme style objects.
- **Conditions**: stored at `style.settings.conditions.conditions` (array) — same condition schema as Template Conditions (see `popups-and-templates.md`), not the same schema as element `_conditions`. Confirmed at `includes/theme-styles.php:324`.

## Global Classes (`bricks_global_classes`)

Reusable style recipes.
- **IMPORTANT**: `_cssGlobalClasses` on an element stores the **ID** (e.g., `cls_abc`), not the BEM name.
- The `bricks_global_classes` option maps IDs to their settings and human names.

## Global Variables (`bricks_global_variables`)

Design tokens (Colors, Spacing, Typography).
- Reference in settings via `var(--variable-slug)`.

## Components (`bricks_components`)

Reusable element trees.
- Instance JSON: `{ "id": "123", "cid": "comp_id", "instanceId": "1" }`.
- Overrides are stored in the instance's `settings`.

## Color Palettes (`bricks_color_palette`)

Site-wide colors.
- Saved as objects: `{ "hex": "#...", "id": "...", "name": "..." }`.

## CSS Strategy Hierarchy

1.  **Global Variables**: Use for brand colors, font stacks, spacing scales.
2.  **Theme Styles**: Use for element-type defaults (all H2s, all buttons).
3.  **Global Classes**: Use for repeating patterns (e.g., `.card--featured`).
4.  **Per-element settings**: Use for one-off tweaks.
5.  **`_cssCustom`**: Last resort for complex CSS. Use `%root%` to target the element.

## Programmatic Access (PHP)

```php
// Get all theme styles
$styles = get_option( 'bricks_theme_styles', [] );

// Get global classes
$classes = get_option( 'bricks_global_classes', [] );

// Get global variables
$vars = get_option( 'bricks_global_variables', [] );
```
