# image

Có: có

Tên khác: ảnh, photo, picture

Nhận: ảnh lá. Bọc một `div` đúng kích thước, `image` con rộng 100%.

Dựng: `process/modules/write-bricks/render/index.mjs`
Element: `image` (`includes/elements/image.php`)

## Hợp đồng

- Nhận: ảnh lá. Bọc một `div` đúng kích thước, `image` con rộng 100%.
- Phần: không có params bắt buộc, trừ khi phần mô tả phía trên nói có
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: theo phần mô tả phía trên của file này
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
