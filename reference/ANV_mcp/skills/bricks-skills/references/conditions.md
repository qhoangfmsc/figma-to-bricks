# Element Conditions (`_conditions`)

> Verified against Bricks 1.12.3 source (theme path: .../themes/bricks) — 2026-07-14. Re-checked against the actual `includes/conditions.php` (1184 lines): the `Conditions::set_options()` key list and the `Conditions::check()` switch statement. Several keys in this doc did not exist in 1.12.3, some had wrong names, and the "Theme-style & Template Conditions" section described a schema that does not match `Templates::run_template_on_hook()`. All fixed below with file+line citations.

Render an element only when conditions pass. Server-side — hidden elements produce no markup. Verified against `includes/conditions.php`.

## Structure: OR of ANDs

```json
"_conditions": [
  [
    { "key": "user_logged_in", "compare": "==", "value": 1 },
    { "key": "user_role", "compare": "==", "value": ["subscriber"] }
  ],
  [
    { "key": "post_id", "compare": "==", "value": "42" }
  ]
]
```

Outer array = OR groups. Inner array = AND conditions. Above: (logged-in AND subscriber) OR (post 42). Confirmed at `includes/conditions.php:1077` (`Conditions::check()`): "Loop over condition sets (logic between sets: OR)" / "Loop over conditions inside a set (logic inside a set: AND)".

## Condition keys

### Post
| Key | Operators | Value |
|---|---|---|
| `post_id` | `==`, `!=`, `>=`, `<=`, `>`, `<` | post ID string |
| `post_title` | `==`, `!=`, `contains`, `contains_not` | string |
| `post_status` | `==`, `!=` | `publish`, `private`, etc. (from `get_post_statuses()`) |
| `post_parent` | `==`, `!=`, `>=`, `<=`, `>`, `<` | parent ID |
| `post_author` | `==`, `!=` | user ID |
| `post_date` | `==`, `!=`, `>=`, `<=`, `>`, `<` | `Y-m-d` |
| `featured_image` | `==`, `!=` | `1` (set) / `0` (not set) |

Confirmed at `includes/conditions.php:145-256` (key definitions) and `:1055-1069` (switch cases in `check()`).

**Corrections**: `post_type` and `post_template` do **not** exist as condition keys in 1.12.3 — removed (grepped the whole `set_options()`/`check()` block, no such case). `post_title` and `post_date` exist but were missing from this table — added.

### User
| Key | Operators | Value |
|---|---|---|
| `user_logged_in` | `==`, `!=` | `1` (in) / `0` (out) |
| `user_id` | `==`, `!=`, `>=`, `<=`, `>`, `<` | ID |
| `user_registered` | all comparators | `Y-m-d` |
| `user_role` | `==`, `!=` | role name(s); array supported (intersection match) |

Confirmed at `includes/conditions.php:261-329` and `check()` cases `:1082-1099`.

**Correction**: `user_capability` and `user_meta` do **not** exist as condition keys in 1.12.3 — removed (no matching case in `set_options()` or `check()`).

### Date / time
| Key | Operators | Value format |
|---|---|---|
| `weekday` | `==`, `!=`, `>=`, `<=`, `>`, `<` | 1=Monday ... 7=Sunday (PHP `date('N')`) |
| `date` | all comparators | `Y-m-d` |
| `time` | all comparators | `H:i` |
| `datetime` | all comparators | combined date+time (via `strtotime`) |

Confirmed at `includes/conditions.php:331-416` and `check()` cases `:1101-1127`.

**Correction**: `recurring_dates` does **not** exist — removed (no such key anywhere in the file).

### Browser / device
| Key | Operators | Value |
|---|---|---|
| `browser` | `==`, `!=` | `chrome`, `firefox`, `safari`, `edge`, `opera`, `msie` |
| `operating_system` | `==`, `!=` | `windows`, `mac`, `linux`, `ubuntu`, `iphone`, `ipad`, `ipod`, `android`, `blackberry`, `webos` |

Confirmed at `includes/conditions.php:668-712` (key + value option definitions) and `check()` cases `:1160-1165`.

**Corrections**: the key is `operating_system`, **not `os`**. `msie` is the real value, **not `ie`**. There is **no `device` key** (desktop/tablet/mobile) at all — removed; grepped the whole file, no such option.

### Page / context
**Correction**: `is_front_page`, `is_home`, `is_singular`, `is_archive`, `is_search`, `is_404`, `language`, and `query_result_count` are **not** element condition keys in 1.12.3 — none of them appear in `set_options()` or `check()`. Removed from this table.
- Front page / archive / search / error page detection *does* exist, but only as **Template Conditions** (`main`: `frontpage`/`archiveType`/`search`/`error`), a different schema — see the corrected section below and `popups-and-templates.md`.
- "Result count of a query" is achieved the way this file's own recipe already shows further down: via a `dynamic_data` condition against a `{query_results_count:...}` tag, not a dedicated key.
- Missing from the original table: `current_url` — a real key (`==`, `!=`, `contains`, `contains_not` against the current URL incl. query string). Confirmed at `includes/conditions.php:717-735` and `check()` case `:1167-1172`.

### WooCommerce (when active)
| Key | Compare | Value |
|-----|---------|-------|
| `woo_product_type` | `==` `!=` | `simple`, `variable`, etc. |
| `woo_product_sale` | `==` | `1` (on sale) / `0` |
| `woo_product_new` | `==` | `1` / `0` (based on `woocommerceBadgeNew` setting) |
| `woo_product_stock_status` | `==` | `instock`, `outofstock`, `onbackorder` |
| `woo_product_stock_quantity` | numeric ops | number |
| `woo_product_stock_management` | `==` | `1` / `0` |
| `woo_product_sold_individually` | `==` | `1` / `0` |
| `woo_product_purchased_by_user` | `==` | `1` / `0` |
| `woo_product_featured` | `==` | `1` / `0` |
| `woo_product_category` | `==` | category term ID(s) |
| `woo_product_tag` | `==` | tag term ID(s) |
| `woo_product_rating` | numeric ops | number |

Confirmed at `includes/conditions.php:417-647` (definitions) and `check()` cases `:1129-1158`. Table expanded — the original only listed 5 of these 11 keys.

### Other
| Key | Notes |
|---|---|
| `dynamic_data` | Compare arbitrary DD value against a literal. Compare options: `contains`, `contains_not`, `empty`, `empty_not` (@since 1.10), plus `==`/`!=`/`>=`/`<=`/`>`/`<`. `dynamicData` field holds the tag. Confirmed `includes/conditions.php:648-666`, `check()` case `:1136-1150`. |
| `current_url` | Current URL incl. query params. `==`, `!=`, `contains`, `contains_not`. Confirmed `:717-735`. |
| `referer` | Referrer URL. `==`, `!=`, `contains`, `contains_not`. **Correction: the real key is `referer` (matches `$_SERVER['HTTP_REFERER']`), not `referrer`.** Confirmed `:737-754`, `check()` case `:1174-1176`. |

**Correction**: `custom_code`, `cookie`, and `query_parameter` do **not** exist as condition keys in 1.12.3 — removed. `query_parameter` overlaps with what `current_url` already covers (URL incl. `?params`).

## Relations
`AND` -- all conditions in a set must match. `OR` -- any condition set can match (between sets only).

**Correction**: the real engine (`Conditions::check()`) only supports the flat two-level structure above — an outer OR-of-groups, each group a flat AND-list of `{key, compare, value}` objects. There is **no per-condition `"relation"` field** parsed anywhere in `includes/conditions.php`; nesting a `{"relation":"AND"}` marker inside a group, or trying to express `(A AND B) OR C` via inline relation markers, is not supported syntax for 1.12.3 element conditions. To express `(A AND B) OR C`, use two OR-groups where the first repeats the shared condition:
```jsonc
[
  [ /* A */, /* B */ ],
  [ /* C */ ]
]
```
If C needs to combine with something else via AND, put both conditions in its own group — there's no operator-precedence syntax beyond OR-of-AND.

## Theme-style & Template Conditions
**Correction**: templates and theme styles do **not** reuse the element `_conditions` schema, and do not use `templateType`/`archive`/`single` keys. The real schema (`Templates::run_template_on_hook()`, `includes/templates.php:2103-2389`, reused by theme styles via `includes/theme-styles.php:324` at `style.settings.conditions.conditions`) is a **flat array** of condition objects, each with a `main` key selecting the condition type, plus type-specific fields, plus an optional `exclude` flag (its mere presence — any value — marks the condition as an "exclude" rule instead of "include"):

```jsonc
"templateConditions": [
  { "main": "any" },                                             // entire website
  { "main": "frontpage" },                                       // front page
  { "main": "postType", "postType": ["product", "post"] },       // specific post type(s)
  { "main": "archiveType", "archiveType": ["any"] },              // any archive
  { "main": "archiveType", "archiveType": ["postType"], "archivePostTypes": ["product"] },
  { "main": "archiveType", "archiveType": ["term"], "archiveTerms": ["product_cat::12"] },
  { "main": "search" },
  { "main": "error" },
  { "main": "terms", "terms": ["category::5"] },                 // post has taxonomy term
  { "main": "ids", "ids": [42, 99], "idsIncludeChildren": true }, // specific post IDs (+children)
  { "main": "any", "exclude": true }                              // presence of "exclude" = exclude rule
]
```
Full match logic: if no `exclude` entries, template runs if ANY `include` condition matches; if no `include` entries, it runs on all pages EXCEPT where an `exclude` condition matches; if both are present, it must match an include AND match no exclude. See `popups-and-templates.md` for the corrected list of real `main`/`templateType` values.

## Recipes

**Members-only block + logged-out CTA (pair):**
```json
{ "settings": { "_conditions": [[ { "key": "user_logged_in", "compare": "==", "value": 1 } ]] } }
{ "settings": { "_conditions": [[ { "key": "user_logged_in", "compare": "==", "value": 0 } ]] } }
```

**Show only on weekdays during business hours:**
```jsonc
[
  [
    { "key":"weekday","compare":">=","value":"1" },
    { "key":"weekday","compare":"<=","value":"5" },
    { "key":"time","compare":">=","value":"09:00" },
    { "key":"time","compare":"<","value":"18:00" }
  ]
]
```
(Corrected to the real flat AND-array shape — no inline `{"relation":"AND"}` markers; all four conditions are simply items of the same inner AND-group.)

**Empty query fallback message** (`loop01` = loop element id):
```json
"_conditions": [[ { "key": "dynamic_data", "dynamic_data": "{query_results_count:loop01}", "compare": "==", "value": "0" } ]]
```

## Hooks (Custom Conditions)

```php
add_filter( 'bricks/conditions/groups',  $cb );             // add/modify condition groups (post/user/date/woo/other)
add_filter( 'bricks/conditions/options', $cb );              // add condition keys
add_filter( 'bricks/conditions/result',  $cb, 10, 3 );        // ($render_set, $key, $condition)
```
To register a custom key, add to `options` and evaluate in `result`.

**Correction**: the `bricks/conditions/result` filter's real parameter order is `($render_set, $key, $condition)` — `$render_set` (bool, the current AND-set's running result), `$key` (string, the condition's `key`), `$condition` (array, the full condition item) — confirmed at `includes/conditions.php:1173`. It is **not** `($result, $condition, $element)`; there is no `$element`/instance argument passed to this filter. Also added the real `bricks/conditions/groups` filter (`:58`), which was missing from this doc.
