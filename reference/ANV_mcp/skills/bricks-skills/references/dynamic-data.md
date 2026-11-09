# Dynamic Data (`{tags}`)

> Verified against Bricks 1.12.3 source (theme path: `.../wp-content/themes/bricks`) — 2026-07-14.

Insert WordPress, ACF, WooCommerce, and custom data into any text, link, or image field. Bricks resolves these tokens at render time.

## Tag Reference

### Post & User
- `{post_id}`, `{post_title}`, `{post_excerpt}`, `{post_url}`, `{post_date}`, `{post_modified}`
- `{author_name}`, `{author_url}`, `{author_avatar}`, `{author_bio}`, `{author_email}`
- `{featured_image}` (returns markup; append `:url` for raw link)
- `{cf_meta_key_name}` -- raw custom field / post meta value, **requires the `cf_` prefix** (e.g. `{cf__wp_attachment_image_alt}`). Confirmed in `includes/integrations/dynamic-data/providers/provider-wp.php:521-522` (`if ( strpos( $tag, 'cf_' ) === 0 ) { $render = 'post_metas'; }`) and the value lookup at line 928 (`get_post_meta( $post_id, $meta_key, true )` where `$meta_key = substr( $tag, 3 )`). A bare `{post_meta_key_name}` tag (no `cf_` prefix) is **not** resolved by Bricks 1.12.3.

### Archive & Context
- `{term_name}`, `{term_url}`, `{term_description}` (inside term loop)
- `{search_term_query}` -- for search result headings
- `{archive_title}`, `{archive_description}`
- `{current_date}`, `{current_time}`

### WooCommerce (`{woo_*}` -- when active)
- `{woo_product_title}`, `{woo_product_price}`, `{woo_product_sale_price}`, `{woo_product_regular_price}`, `{woo_product_image}`
- `{woo_cart_count}`, `{woo_cart_total}`, `{woo_cart_url}`
- `{woo_my_account_url}`, `{woo_checkout_url}`

### ACF / Meta Box / JetEngine
- `{acf_field_name}` -- value of ACF field on current post
- `{mb_field_id}` -- Meta Box field
- `{je_field_name}` -- JetEngine field
- `{pods_field}` -- Pods field
- **Modifiers**: `{acf_image_field:link}`, `{acf_date:format:Y-m-d}`, `{acf_gallery:count}`

### Echo / PHP Integration
- `{echo:my_function:arg1:arg2}` -- calls whitelisted PHP function.

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — tính năng của bản 2.x, xác nhận qua grep source không thấy. Giữ lại tham khảo nếu site nâng cấp sau này.
- `{shortcode:[my_shortcode foo='bar']}` -- wrap with `[]`. No `shortcode:` case exists anywhere under `includes/integrations/dynamic-data/` in 1.12.3 (only `echo:` and `do_action:` function-style tags are implemented, see `provider-wp.php` `case 'echo':` / `case 'do_action':`). Use `{echo:do_shortcode:'[my_shortcode foo=bar]'}` with `do_shortcode` whitelisted instead.

## Dynamic data in non-text controls (exact shapes)

```json
"image":       { "useDynamicData": "{acf_portrait}", "size": "large" }
"items":       { "useDynamicData": "{acf_gallery}", "size": "medium" }
"link":        { "type": "meta", "useDynamicData": "{post_url}" }
"link":        { "type": "external", "url": "mailto:{author_email}" }
"videoPoster": { "useDynamicData": "{acf_poster}", "size": "large" }
"_background": { "image": { "useDynamicData": "{featured_image}", "size": "large" } }
"text":        "{post_title}"
```

Color via dynamic data: `{ "raw": "{acf_brand_color}" }` inside any color object.

## Modifiers (the `@modifier:'value'` system)

Confirmed in `includes/integrations/dynamic-data/dynamic-data-parser.php:116` -- the allowed-keys whitelist for `@key:'value'` args is exactly `[ 'fallback', 'fallback-image', 'sanitize' ]` (extensible via the undocumented `bricks/dynamic_data/allowed_keys` filter), and `includes/integrations/dynamic-data/providers/base.php:116` enforces the same set when building filters.

| Modifier | Purpose | Example |
|---|---|---|
| `@fallback` | Default if empty | `{post_title @fallback:'Untitled'}` |
| `@fallback-image` | Default image (id or URL) | `{featured_image @fallback-image:123}` |
| `@sanitize` | true/false (@since 1.11.1) | `{post_meta_html @sanitize:'true'}` |

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — tính năng của bản 2.x, xác nhận qua grep source không thấy. Giữ lại tham khảo nếu site nâng cấp sau này.
>
> The following modifiers are **not implemented** in 1.12.3 (no matching case anywhere in `includes/integrations/dynamic-data/`, and `{active_filters_count}` / `{query_api}` tags themselves don't exist in this version either — see `query-loop.md`'s API-loop note):
>
> | Modifier | Purpose | Example |
> |---|---|---|
> | `@exclude` | Skip listed values | `{active_filters_count @exclude:'123'}` |
> | `@key` | Pluck nested object key | `{query_api @key:'title\|rendered'}` |
> | `@date` / `@to` | Date parsing/formatting | `{acf_date @to:'d M Y'}` |
> | `@count` | Length / count | `{post_terms_category @count:'true'}` |

## Built-in Filters (after a colon)

- `{tag:N}` - Truncate to N chars/words (`{post_excerpt:50}`).
- `{tag:format}` - PHP Date format (`{post_date:F j, Y}`).
- `{tag:url}` - URL only (no markup for images/links).
- `{tag:meta_size:large}` - Image size.
- `{tag:value}` - Raw value (e.g., `1`/`0` for ACF checkboxes).

## Security (`{echo:}`)

Bricks blocks `echo:` by default. Whitelist functions in `functions.php`:
```php
add_filter( 'bricks/code/echo_function_names', function() {
    return [ 'wp_get_attachment_image', 'my_custom_func', '@^get_field' ];
} );
```

## Custom Tags (PHP Implementation)

```php
// 1. Register the tag for the picker
add_filter( 'bricks/dynamic_tags_list', function( $tags ) {
    $tags[] = [ 'name' => '{my_stat}', 'label' => 'My Stat', 'group' => 'Custom' ];
    return $tags;
} );

// 2. Resolve it
// Real filter signature (confirmed in includes/integrations/dynamic-data/providers.php:66 and
// the render_tag() call at line ~429): apply_filters( 'bricks/dynamic_data/render_tag', $tag, $post, $context )
// -- only 3 params ($tag WITHOUT curly braces, $post, $context), no separate $value param.
// The built-in resolver is hooked at priority 10, so a custom tag must hook BEFORE that (lower
// priority number) and pass through the original $tag unchanged when it doesn't match, otherwise
// the built-in resolver never gets a chance to run for other tags.
add_filter( 'bricks/dynamic_data/render_tag', function( $tag, $post, $context ) {
    if ( $tag === 'my_stat' ) {
        return get_option( 'my_stat_value', '0' );
    }
    return $tag;
}, 5, 3 );
```

## Recipes

**Hero subtitle from ACF with fallback:**
`{acf_hero_subtitle @fallback:'Welcome'}`

**Cart count badge that hides at zero:**
`_conditions`: `[{ "key":"dynamic_data","dynamic_data":"{woo_cart_count}","compare":">","value":"0" }]`
(note the snake_case `dynamic_data` field name -- confirmed in `includes/conditions.php:1044-1045`: `case 'dynamic_data': $dynamic_data_tag = $condition['dynamic_data'] ?? false;`. `dynamicData` (camelCase) is not read anywhere in conditions.php and will silently fail.)
