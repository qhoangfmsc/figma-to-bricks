# Query Loops & Filters

> Verified against Bricks 1.12.3 source (theme path: `.../wp-content/themes/bricks`) — 2026-07-14.

Bricks handles loops through the `hasLoop` setting (on any nestable) or the `posts` element.

## The `query` object

🔧 **Corrected key name.** All query settings live under the **`query`** key (no leading underscore) inside `settings`, for every element that supports loops -- including the `posts` element. Confirmed in `includes/elements/base.php:3763` (`$controls['query'] = [ ... 'type' => 'query' ... ]`, shared by all nestable elements) and `includes/query.php:88/301/310` (`$element['settings']['query']['objectType']`, `$settings['query']['objectType']`, `$settings['query'] ?? []`). There is no `_query` key anywhere in the query engine -- every other reference file in this skill that touches loops (`acf-providers.md`, `woocommerce.md`) already correctly uses `"query"`; this file was the outlier.

### Post Query
```jsonc
"query": {
  "objectType": "post",
  "post_type":   ["post"],
  "posts_per_page": 10,
  "orderby":     "date",
  "order":       "DESC",
  "meta_query":  [ { "key": "price", "value": "100", "compare": ">" } ],
  "tax_query":   [ { "taxonomy": "category", "field": "slug", "terms": ["news"] } ]
}
```

### Term Query
```jsonc
"query": {
  "objectType": "term",
  "taxonomy":   "category",
  "number":     20,
  "orderby":    "name",
  "current_post_term": false
}
```

### User Query
```jsonc
"query": {
  "objectType": "user",
  "role":       "subscriber",
  "number":     10
}
```

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — tính năng của bản 2.x, xác nhận qua grep source không thấy. Giữ lại tham khảo nếu site nâng cấp sau này.
### API Loop
Grepped `includes/query.php` and the whole `includes/` tree for `'api'` as an `objectType`, plus `apiUrl` / `apiPath` -- no matches. `Query::object_type` only ever branches on `'post'`, `'term'`, `'user'` (see `includes/query.php:124`, `:1179`, `:1587-1673`). There is no built-in REST/API loop type and no `{query_api:...}` tag in 1.12.3. To loop over external API data in this version, register a custom object type via the `bricks/query/run_fake` + `bricks/query/fake_result` filters instead (see `includes/query.php:948-952`):
```php
add_filter( 'bricks/query/run_fake', function( $fake_result, $query ) {
    if ( $query->object_type === 'my_api_source' ) {
        $fake_result = wp_remote_retrieve_body( wp_remote_get( 'https://api.example.com/data' ) );
        $fake_result = json_decode( $fake_result, true )['items'] ?? [];
    }
    return $fake_result;
}, 10, 2 );
```
```jsonc
"query": { "objectType": "my_api_source" }
```

## Loop Iteration Tags

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — tính năng của bản 2.x, xác nhận qua grep source không thấy. Giữ lại tham khảo nếu site nâng cấp sau này.
> `{loop_index}` is not a registered dynamic-data tag in 1.12.3 -- grepped every `provider-*.php` file under `includes/integrations/dynamic-data/providers/` for `index` and found zero tag registrations. The loop position exists internally as `Query::$loop_index` / `Query::get_loop_index( $query_id = '' )` (`includes/query.php:44`, `:1891`) but is not exposed as a `{...}` tag; to print it, register a custom tag via the `bricks/dynamic_data/render_tag` recipe in `dynamic-data.md` and call `\Bricks\Query::get_loop_index( $query_id )` inside it (or whitelist it for `{echo:}`, see `dynamic-data.md`).

- `{query_results_count}`: total results in the loop. Confirmed: `includes/integrations/dynamic-data/providers/provider-wp.php:260` (registration) and `:959` (`case 'query_results_count':`).
- `{post_title}`, `{post_url}`, etc.: Resolve against current loop item.

## Pagination Element

```jsonc
"settings": {
  "queryId":   "abc123", // element ID of the loop
  "ajax":      true,
  "midSize":   2,
  "endSize":   1
}
```
Use `queryId: "main"` to paginate the global WordPress query.

## Infinite Scroll & Load More

- **Infinite scroll**: Set `query.infinite_scroll: true` on the loop element (key fixed -- see note above; confirmed at `includes/elements/base.php:3817` `$settings['query']['infinite_scroll']`, and `includes/query.php:318-319`). Related keys `infinite_scroll_margin` / `infinite_scroll_delay` live under the same `query` object (`base.php:3864-3876`).
- **Load more button**: Use an interaction on a button (confirmed `loadMore` action + `loadMoreQuery` key in `includes/interactions.php:173/209/503`):
  ```jsonc
  { "trigger": "click", "action": "loadMore", "loadMoreQuery": "abc123" }
  ```

## Query Filters

Filter elements (`filter-checkbox`, `filter-select`, `filter-search`, etc.) require **Query Filters** to be enabled in Bricks Settings.

🔧 **Corrected control key.** The key that targets a filter at a query is **`filterQueryId`**, not `queryId` (`queryId` is only used by the `pagination` and `query-results-summary` elements to target a query, see `includes/elements/pagination.php:16` and `includes/elements/query-results-summary.php:21`). Filter elements read `filterQueryId` exclusively -- confirmed throughout `includes/elements/filter-base.php` (e.g. `:45`, `:971` control registration) and `includes/elements/filter-checkbox.php:54/64`. `filterUpdateUrl` was not found anywhere in `includes/elements/filter-base.php` or `includes/query-filters.php` and does not appear to exist in 1.12.3; the real per-filter URL-parameter key is `filterNiceName` (`filter-base.php:995`, "@since 1.11").

```jsonc
"settings": {
  "filterQueryId": "abc123",
  "filterSource": "taxonomy",
  "filterTaxonomy": "category"
}
```

## Programmatic Hooks

```php
// Modify query arguments
// Confirmed includes/query.php:553 -- actual filter passes 4 args: ($query_vars, $settings, $element_id, $element_name)
add_filter( 'bricks/posts/query_vars', function( $query_vars, $settings, $element_id, $element_name ) {
    if ( $element_id === 'abc123' ) {
        $query_vars['author'] = 1;
    }
    return $query_vars;
}, 10, 4 );
```

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — tính năng của bản 2.x, xác nhận qua grep source không thấy. Giữ lại tham khảo nếu site nâng cấp sau này.
> `bricks/query/array` is not a real filter -- grepped `includes/query.php` for `query/array` and found nothing. To feed a custom array into a loop in 1.12.3, use `bricks/query/run_fake` (return the array) together with `bricks/query/fake_result`, both confirmed at `includes/query.php:948-952`:
> ```php
> add_filter( 'bricks/query/run_fake', function( $fake_result, $query ) {
>     if ( $query->object_type === 'my_custom_type' ) {
>         return [ [ 'id' => 1, 'name' => 'Item 1' ] ];
>     }
>     return $fake_result;
> }, 10, 2 );
> ```

## No-Results State

> ⚠️ **Không tồn tại trong Bricks 1.12.3 (site này)** — tính năng của bản 2.x, xác nhận qua grep source không thấy. Giữ lại tham khảo nếu site nâng cấp sau này.
> The `query_result_count` condition key does not exist -- `includes/conditions.php`'s condition switch only implements `post_*`, `user_*`, `woo_product_*`, `dynamic_data`, `browser`, `operating_system`, `referer`, `current_url` (see the `case` list starting at `conditions.php:903`). There is no built-in "results count" condition key. Use the `dynamic_data` condition against the real `{query_results_count}` tag instead (see `dynamic-data.md` for the correct `dynamic_data`/`compare`/`value` field names):
```jsonc
{
  "name": "text-basic",
  "settings": {
    "text": "Nothing found.",
    "_conditions": [[ { "key": "dynamic_data", "dynamic_data": "{query_results_count}", "compare": "==", "value": "0" } ]]
  }
}
```
*Note: Some elements like `posts` have a built-in "No results" template setting (`query.no_results_template` / `query.no_results_text`, confirmed `includes/query.php:1634/2210-2211`).*
