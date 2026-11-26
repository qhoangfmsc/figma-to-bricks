# woocommerce

Có: module riêng, chưa tự nhận

Tên khác: product, cart, checkout, shop

Khi nào dùng: khung là trang shop, sản phẩm, giỏ, thanh toán hoặc tài khoản. Một thẻ giá vẽ trong Figma không phải element Woo.

Module: `process/modules/write-bricks/standby/woocommerce.mjs`

`WOO_ELEMENTS` là tên file trong `includes/woocommerce/elements/` (trừ `base.php` và `woocommerce-template-hook.php`). `wooElement(name)` chỉ nhận tên trong danh sách đó. `woocommerce-account-payment-methods` không có trong 1.12.3.

`WOO_TEMPLATES` là `WooCommerce::get_woo_templates()`: `wc_archive`, `wc_product`, `wc_cart`, `wc_cart_empty`, `wc_form_checkout`, `wc_form_pay`, `wc_thankyou`, `wc_order_receipt`, và các `wc_account_*`.

Giá tên miền và bảng giá trong landing vẫn là layout. Action nằm ở plugin vietnix-center.

## Hợp đồng

- Nhận: xem phần mô tả phía trên của file này
- Phần: không có params bắt buộc, trừ khi phần mô tả phía trên nói có
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: theo phần mô tả phía trên của file này
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
