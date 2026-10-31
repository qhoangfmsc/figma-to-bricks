# Templates

Template export format (`"type": …`) — import via **Bricks → Templates → Import**. Each file ships its `templateSettings.templateConditions`; adjust them after import if the site needs narrower targeting.

| File | Format | Demonstrates |
|------|--------|--------------|
| [header-template.json](header-template.json) | template (header) | nav-nested + dropdown, sticky header settings, blur backdrop, slide-up-after |
| [footer-template.json](footer-template.json) | template (footer) | 4-col grid, link classes with hover, social-icons, `{current_date:Y}` copyright |
| [popup-newsletter.json](popup-newsletter.json) | template (popup) | popup settings (width/backdrop/limits), embedded form, show-once via localStorage limit |
| [single-post.json](single-post.json) | template (single) | `post-taxonomy`, `post-title`, `post-meta` repeater, `post-reading-time`, featured image via `{featured_image}`, `post-excerpt` lead, `post-content`, `post-author` box, `post-navigation` (same category), `post-comments`; condition `postType: post` |
| [archive.json](archive.json) | template (archive) | `breadcrumbs`, `{archive_title}` / `{archive_description}`, legacy `posts` element on the main query (`is_archive_main_query`) with responsive `columns` + `fields` repeater, main-query `pagination`; condition `archiveType: any` |
| [search-results.json](search-results.json) | template (search) | `{search_term}` heading, refine `search` element, `query-results-summary` with no-results text, loop with `is_archive_main_query`, pagination; condition `search` |
| [404.json](404.json) | template (error) | Big error code, `search` element, home button, 3 latest posts loop rendered as `ul/li`; condition `error` |
