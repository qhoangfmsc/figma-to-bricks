# Query loops & filters

Clipboard format. Filters require **Bricks → Settings → Query Filters** enabled, and a reindex after adding filters on custom fields.

| File | Format | Demonstrates |
|------|--------|--------------|
| [team-grid-acf.json](team-grid-acf.json) | clipboard | ACF repeater query loop (`acf_team_members`), dynamic image + `@fallback` |
| [blog-archive-filters.json](blog-archive-filters.json) | clipboard | Query loop + live search + taxonomy filter + sort + results summary + AJAX pagination |
| [filter-sidebar.json](filter-sidebar.json) | clipboard | Sticky filter sidebar for a `course` CPT: `filter-checkbox` (taxonomy, hierarchical, OR), `filter-radio` (custom field `difficulty` as buttons + custom label mapping), `filter-range` (`price` slider), `filter-datepicker` (`start_date` range), `filter-submit` apply + reset (all filters `filterApplyOn: click`), `filter-active-filters` chips, AJAX pagination. Rename `course` / `course_category` / field keys to the site's own |
