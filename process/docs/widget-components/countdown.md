# countdown

Có: dựng được. Nhận dạng tự động: chưa có rule.

Tên khác: đếm ngược

Hình để sau này nhận: hàng ngang các đơn vị thời gian, số ở trên nhãn ở dưới, cách nhau bằng dấu hai chấm.

Không nhận: ngày đích và múi giờ không có trên Figma. Thiếu ngày thì Bricks hiện placeholder. Thiếu múi giờ thì đếm theo UTC+00:00. Các đơn vị phải giống nhau.

Dựng: `process/modules/write-bricks/components/countdown.mjs`
Element: `countdown` (`includes/elements/countdown.php`)

## Hợp đồng

- Nhận: horizontal row of time units (a number text above a label text) separated by a colon text; the designer's "countdown unit" component
- Phần: `fields` [{ node, format }] (required), `date` "YYYY-MM-DD HH:mm", `timezone` "UTC+07:00", `separator`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: the target date and time zone are not in Figma (without a date Bricks shows a placeholder, without a zone it counts in UTC+00:00); units must be identical; the "Date reached" action is the Bricks default
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
