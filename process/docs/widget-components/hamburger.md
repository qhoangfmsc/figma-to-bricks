# hamburger

Có: có

Tên khác: toggle, menu button, ba gạch

Nhận: ba gạch trong một ô vuông nhỏ.

Không nhận: viên thuốc một núm là [switch](switch.md).

Dựng: `process/modules/write-bricks/components/production.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/production-widgets.mjs`
Element: `toggle` (`includes/elements/toggle.php`). Ba gạch vẽ sẵn được thay bằng thanh của Bricks.

## Hợp đồng

- Nhận: three stacked lines in a small square
- Phần: không có params bắt buộc, trừ khi phần mô tả phía trên nói có
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: this is the menu button, not a switch. The drawn lines are replaced by the Bricks bars
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
