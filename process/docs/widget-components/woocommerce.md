# woocommerce

Có: module riêng, chưa tự nhận

Tên khác: product, cart, checkout, shop

Khi nào dùng: khung là trang shop, sản phẩm, giỏ, thanh toán hoặc tài khoản. Một thẻ giá vẽ trong Figma không phải element Woo.

Module: `process/modules/standby/woocommerce.mjs`

`WOO_ELEMENTS` là tên file trong `includes/woocommerce/elements/` (trừ `base.php` và `woocommerce-template-hook.php`). `wooElement(name)` chỉ nhận tên trong danh sách đó. `woocommerce-account-payment-methods` không có trong 1.12.3.

`WOO_TEMPLATES` là `WooCommerce::get_woo_templates()`: `wc_archive`, `wc_product`, `wc_cart`, `wc_cart_empty`, `wc_form_checkout`, `wc_form_pay`, `wc_thankyou`, `wc_order_receipt`, và các `wc_account_*`.

Giá tên miền và bảng giá trong landing vẫn là layout. Action nằm ở plugin vietnix-center.
