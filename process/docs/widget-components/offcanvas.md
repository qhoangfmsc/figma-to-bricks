# offcanvas

Có: có

Tên khác: drawer, side panel

Nhận: panel cao sát mé trái hoặc phải, có dấu đóng.

Không nhận: icon ở góc mà không phải dấu đóng (dấu ngoặc kép, mũi tên). Thẻ nằm giữa là [popup](popup.md).

Dựng: `process/modules/write-bricks/components/production.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/production-widgets.mjs`
Element: `offcanvas` (`includes/elements/offcanvas.php`). Con đầu là `brx-offcanvas-inner`.

## Hợp đồng

- Nhận: a tall panel on the left or right edge, with a close mark
- Phần: `direction`, `width`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: a centered card is a popup, not a side panel
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
