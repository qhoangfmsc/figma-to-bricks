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

## Hợp đồng

- Nhận: a horizontal field at least four times as wide as it is tall, with one text and one small icon (`rules/media.mjs`). A search name is high confidence. Shape only stays proposed
- Phần: `placeholder`, `labelNode`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: The drawn icon is not copied onto the search button. The form uses the WordPress home URL. A field inside a form stays part of that form
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
