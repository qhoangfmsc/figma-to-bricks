# Bricks Native Elements Catalog

> Verified against Bricks 1.12.3 source (theme path: .../themes/bricks) — 2026-07-14. Corrected: WooCommerce element names (were 2.x/invented names, now match `includes/woocommerce.php`).

Every element name corresponds to a PHP file in `{template_dir}/includes/elements/` (registry: `includes/elements.php`, `Elements::init_elements()`).

## Layout (Nestable)
- `section`: Top-level semantic section.
- `container`: Flex/Grid primitive.
- `block`: Lightweight div.
- `div`: Minimal wrapper.
*Key controls: `tag`, `_display`, `_direction`, `_justifyContent`, `_alignItems`, `_columnGap`/`_rowGap` (no generic `_gap` on these — see `references/containers-and-layout.md`).*

## Basic Elements
- `heading`: `text`, `tag` (h1-h6).
- `text`: Editor-based rich text.
- `text-basic`: Plain text.
- `button`: `text`, `link`, `style`.
- `icon`: `icon` picker, `iconSize`.
- `image`: `image` object, `altText` (not `alt` — confirmed `includes/elements/image.php` line 177).
- `video`: no single `source`/`videoUrl` pair. Real controls (`includes/elements/video.php`): `videoType` (select: file/youtube/vimeo), then per-type fields — `fileUrl`/`media` for uploaded file, `youTubeId` (+ `youtube*` options), `vimeoId` (+ `vimeo*` options).

## Complex Elements
- `accordion`: `accordions` repeater.
- `tabs`: `tabs` repeater.
- `slider`: `items` repeater.
- `image-gallery`: `items` repeater (not `images` — confirmed `includes/elements/image-gallery.php` line 43), plus `layout`, `columns`, `gutter`.
- `nav-menu`: `menu` (ID). No `mobileMenuEffect` key — mobile behavior is controlled by a large set of `mobileMenu*`-prefixed controls (`mobileMenu`, `mobileMenuPosition`, `mobileMenuAlignment`, `mobileMenuBackground`, etc. — confirmed `includes/elements/nav-menu.php` ~line 850-1450).
- `form`: `fields` repeater, `actions`.
- `posts`: Query-based post loop.

## WordPress Elements
- `post-title`, `post-excerpt`, `post-content`, `post-meta`.
- `post-taxonomy`, `post-author`, `post-comments`.
- `breadcrumbs`.

## WooCommerce Elements
Real element names (confirmed in `includes/woocommerce.php` `$woo_elements` array, ~line 883-943; files live in `includes/woocommerce/elements/`):
- `product-title`, `product-price`, `product-add-to-cart`, `product-content`, `product-gallery`, `product-meta`, `product-rating`, `product-related`, `product-reviews`, `product-stock`, `product-tabs`, `product-upsells`, `product-additional-information`, `product-short-description`.
- `woocommerce-cart-items`, `woocommerce-cart-collaterals`, `woocommerce-cart-coupon`.
- `woocommerce-checkout-coupon`, `woocommerce-checkout-login`, `woocommerce-checkout-customer-details`, `woocommerce-checkout-order-review`, `woocommerce-checkout-thankyou`, `woocommerce-checkout-order-table`, `woocommerce-checkout-order-payment`.
- `woocommerce-products`, `woocommerce-products-pagination`, `woocommerce-products-orderby`, `woocommerce-products-total-results`, `woocommerce-products-filter`, `woocommerce-products-archive-description`.
- `woocommerce-notice`, `woocommerce-breadcrumbs`, `woocommerce-mini-cart`, `woocommerce-account-page` (+ `woocommerce-account-*` sub-elements).

(There is no `woo-product-title` / `woo-cart` / `woo-checkout` naming scheme in 1.12.3 — that was wrong in a prior version of this doc.)

## Component Instances
```jsonc
{
  "id": "abc123",
  "cid": "comp_abc", // Component definition ID
  "instanceId": "1",
  "name": "container",
  "settings": { /* Overrides */ }
}
```

## Control Types (for Custom Elements)
- `text`, `textarea`, `editor`, `code`.
- `number` (with `units: true`).
- `select` (with `options`).
- `color`, `gradient`, `image`, `icon`, `link`.
- `typography`, `spacing`, `border`, `box-shadow`.
- `repeater` (with `fields`).
- `query`.
