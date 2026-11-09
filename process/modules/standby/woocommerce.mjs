// WooCommerce element file names in includes/woocommerce/elements, minus base.php
// and woocommerce-template-hook.php (that file is not an element).
// Template type strings are WooCommerce::get_woo_templates() in includes/woocommerce.php.
// A drawn price card is not one of these. Call wooElement only for a shop frame.

export const WOO_ELEMENTS = [
  'product-add-to-cart',
  'product-additional-information',
  'product-content',
  'product-gallery',
  'product-meta',
  'product-price',
  'product-rating',
  'product-related',
  'product-reviews',
  'product-short-description',
  'product-stock',
  'product-tabs',
  'product-title',
  'product-upsells',
  'woocommerce-account-addresses',
  'woocommerce-account-downloads',
  'woocommerce-account-form-edit-account',
  'woocommerce-account-form-edit-address',
  'woocommerce-account-form-login',
  'woocommerce-account-form-lost-password',
  'woocommerce-account-form-register',
  'woocommerce-account-form-reset-password',
  'woocommerce-account-orders',
  'woocommerce-account-page',
  'woocommerce-account-view-order',
  'woocommerce-breadcrumbs',
  'woocommerce-cart-collaterals',
  'woocommerce-cart-coupon',
  'woocommerce-cart-items',
  'woocommerce-checkout-coupon',
  'woocommerce-checkout-customer-details',
  'woocommerce-checkout-login',
  'woocommerce-checkout-order-payment',
  'woocommerce-checkout-order-review',
  'woocommerce-checkout-order-table',
  'woocommerce-checkout-thankyou',
  'woocommerce-mini-cart',
  'woocommerce-notice',
  'woocommerce-products',
  'woocommerce-products-archive-description',
  'woocommerce-products-filter',
  'woocommerce-products-orderby',
  'woocommerce-products-pagination',
  'woocommerce-products-total-results',
];

export const WOO_TEMPLATES = [
  'wc_archive',
  'wc_product',
  'wc_cart',
  'wc_cart_empty',
  'wc_form_checkout',
  'wc_form_pay',
  'wc_thankyou',
  'wc_order_receipt',
  'wc_account_form_login',
  'wc_account_form_lost_password',
  'wc_account_form_lost_password_confirmation',
  'wc_account_reset_password',
  'wc_account_dashboard',
  'wc_account_orders',
  'wc_account_view_order',
  'wc_account_downloads',
  'wc_account_addresses',
  'wc_account_form_edit_address',
  'wc_account_form_edit_account',
];

const NAMES = new Set(WOO_ELEMENTS);

export function wooElement(name) {
  if (!NAMES.has(name)) throw new Error(`${name} is not a WooCommerce element in Bricks 1.12.3`);
  return { name, settings: {} };
}
