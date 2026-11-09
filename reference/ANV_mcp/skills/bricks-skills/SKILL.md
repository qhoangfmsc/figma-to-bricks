---
name: bricks
description: Build, edit, and audit pages, templates, popups, and custom elements for the Bricks Builder WordPress theme. Use for any Bricks task — sections, pages, headers/footers, query loops, ACF/dynamic data, faceted filters, conditions, interactions/animations, popups, WooCommerce templates, custom elements, or hooks. Re-verified against the actual installed Bricks 1.12.3 source on 2026-07-14 (see per-file verification notes in references/) — earlier claims of "2.x" verification were inaccurate.
---

# Bricks Builder -- Authoritative Skill

You are working on the **Bricks Builder** WordPress theme. The parent theme is at {template_dir} and the active child is at {stylesheet_dir}. Custom code goes in the child only.

> **Path placeholders.** This skill uses {template_dir} and {stylesheet_dir} as portable placeholders for the live WordPress paths (get_template_directory() and get_stylesheet_directory()). Resolve them at runtime via **WP-CLI** (wp eval), **Execute PHP**, or by reading wp-config.php.

## 0. Verification (Live vs. Static)

The skill works with whatever access you have. **Live access is authoritative** when it differs from static disk files.

1.  **WP-CLI** (Recommended for shell): wp eval, wp post meta get, wp option get.
2.  **Live PHP / MCP**: Use tools like Execute PHP to run one-liners from references/novamira-verification.md.
3.  **Local Files**: Read {template_dir} / {stylesheet_dir} on disk. functionally equivalent for read-only element verification.

## 1. Mental Model

Bricks stores a **page = flat array of element objects** as a serialized array in the `_bricks_page_content_2` (or similar) meta key. Each element has an `id`, `name` (tag), `parent` ID, and `settings`.

## 2. Global System

- **Global Classes**: Stored in `wp_options` as `bricks_global_classes`. Referenced in elements via the `_cssGlobalClasses` setting array (confirmed `includes/elements/base.php:1733-1734`).
- **Color Palettes**: Stored in `bricks_color_palette` (NOT `bricks_global_colors` — corrected 2026-07-14, confirmed `functions.php:30`).
- **Global Settings**: Stored in `bricks_global_settings` (confirmed `functions.php:32`).

## 3. Workflow (6 Phases)

1.  **Discovery**: Read `wp-config.php`, `functions.php`, and check WP-CLI connectivity.
2.  **Design Analysis**: Analyze Figma/Screenshot. Identify nested structures.
3.  **Data Fetching**: Get existing class IDs or element structures from the DB.
4.  **JSON Generation**: Write the element array. Use strict BEM naming.
5.  **Implementation**: Paste into Bricks or use MCP/WP-CLI to save meta.
6.  **Verification**: Visual check + Audit vs. Rubric.

## 4. Documentation Map

| Area | Authoritative Source |
| :--- | :--- |
| **Verification Recipes** | [novamira-verification.md](references/novamira-verification.md) |
| **Element Catalog & Control Types** | [elements-catalog.md](references/elements-catalog.md) |
| **Style Keys & Value Shapes** | [element-base-controls.md](references/element-base-controls.md) |
| **Layout (Flex/Grid) & Sections** | [containers-and-layout.md](references/containers-and-layout.md) / [layout-recipes.md](references/layout-recipes.md) |
| **Query Loops & Filters** | [query-loop.md](references/query-loop.md) |
| **ACF / Meta Box / Dynamic Data** | [acf-providers.md](references/acf-providers.md) / [dynamic-data.md](references/dynamic-data.md) |
| **Conditions & Logic** | [conditions.md](references/conditions.md) |
| **Interactions & Animations** | [interactions-and-animations.md](references/interactions-and-animations.md) |
| **Popups & Templates** | [popups-and-templates.md](references/popups-and-templates.md) |
| **Custom Elements (PHP Development)** | [custom-elements.md](references/custom-elements.md) |
| **WooCommerce** | [woocommerce.md](references/woocommerce.md) |
| **Ready-to-paste JSON** | [patterns/](patterns/) |

## 5. Production-Readiness Checklist

- [ ] **Structure**: section > container > content. One <h1> per page. Semantic tags used.
- [ ] **Templates**: Header/Footer active and applied.
- [ ] **Naming**: BEM only. No project prefixes.
- [ ] **Responsive**: Verified at 768px and 375px. No horizontal scroll.
- [ ] **Data**: Every control key exists in the element source (Rule: **Verify, don't guess**).
- [ ] **Verification**: Loaded in a real browser (logged out) and confirmed in the Bricks editor panel.

---
*Follow [references/quick-reference.md](references/quick-reference.md) for the fastest start.*
