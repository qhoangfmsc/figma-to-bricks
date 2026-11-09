# popup

Có: có

Tên khác: modal, dialog, overlay, lightbox, newsletter

Nhận, trong `rules/template-type.mjs`:

- Lớp phủ mờ kín khung và một thẻ nằm giữa.
- Khung gốc phủ mờ và một thẻ nằm giữa.
- Nút đóng trên khung, khung không phải header.
- Nút đóng nằm trong một thẻ nhỏ hơn khung.
- Ảnh gần kín khung và một nút đóng.
- Khung hẹp, có chữ email, và nút đóng.

Chỉ có tên popup thì độ chắc thấp. Hai loại cùng độ chắc thì giữ section.

Không nhận: panel sát mé trái hoặc phải là [offcanvas](offcanvas.md).

Dựng: `process/modules/write-bricks/components/popup-settings.mjs`
Element: template type `popup`. Key lấy từ `wp-content/themes/bricks/includes/popups.php`. Mở bằng interaction `action: show`, `target: popup`, `templateId`.

Popup có hai kiểu. Action (cài đặt, CRUD): có switch hoặc ô nhập và nút `Lưu`. Cả thẻ là một form, nút đó là submit lưu submission, layout của thẻ giữ nguyên. Notice: không có ô. Nút đóng, xác nhận, chấp nhận chỉ tắt popup.

Switch là checkbox của form đó. Chữ `Tắt` / `Bật` đổi theo trạng thái. Con trỏ trên nút và switch là `pointer`. Dấu X không nhận `aria-hidden`, vì nó là nút.

Nội dung template là thẻ giữa. Khung 1440 phủ mờ không dựng thành section bên trong. Màu phủ ghi vào `popupBackground`. `popupContentWidth` là bề rộng thẻ. Thiếu key này thì `popups.php` thêm class `brxe-container`, và class đó là một khung 1100px bọc ngoài thẻ.

Popup được gắn điều kiện Entire website (`templateConditions` `main: any`) và nằm ẩn ở footer. Nút ở template khác mở nó bằng `templateId`. Không có điều kiện thì popup chỉ có trên trang preview của chính nó, nút kia không tìm thấy.

Không bịa limit, z-index, hay màu nền lớp phủ. Theme này không có `popupDisableOnMobile`.
