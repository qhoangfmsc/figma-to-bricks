# alert

Có: có

Tên khác: notice, banner ngắn

Nhận: thanh ngắn có màu, một icon, một câu. Có dấu đóng thì bật dismiss.

Không nhận: không đoán info, success, warning, danger từ màu.

Dựng: `process/modules/write-bricks/components/production.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/production-widgets.mjs`
Element: `alert` (`includes/elements/alert.php`)

## Hợp đồng

- Nhận: a short tinted bar, one icon, one sentence
- Phần: `content`, `dismissable`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: info/success/warning/danger is not guessed from the color
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
