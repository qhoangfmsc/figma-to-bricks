# search

Có: có

Tên khác: ô tìm kiếm

Nhận, một trong hai hình:

- Ô ngang rộng ít nhất bốn lần chiều cao, một chữ, một icon nhỏ.
- Hàng ngang gồm một ô placeholder và một nút có chữ Tìm kiếm hoặc Search. Tên lớp search cũng đủ. Ô và nút không bị nhận thêm thành button.

Không nhận: nút kêu gọi như Xem chi tiết, dù rộng và có icon. Ô này nằm trong [form](form.md) thì thuộc form. Trang kết quả tìm kiếm là [template-search.md](template-search.md), không phải ô này.

Dựng: `process/modules/write-bricks/components/search.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/media.mjs`
Element: `search` (`includes/elements/search.php`, `searchform.php`)

Nút là `<button type="submit">`, bấm là gửi form. `actionURL` để trống thì WordPress nhận ở trang chủ (`/?s=`). Plan có địa chỉ http thì ghi vào `actionURL`. Không bịa URL.

Ô có chữ tên miền, hoặc một bảng giá (từ hai thẻ có giá `đ` / `/tháng` / `/năm`), không thành search và không thành link. Hai thứ đó chỉ dựng layout. Hành động nằm ở plugin vietnix-center, ngoài dự án này.
