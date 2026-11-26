# flat-image

Có: có

Tên khác: artwork, banner vẽ tay

Nhận: khung đặt tay, không auto layout, toàn hình vẽ, ít chữ.

Không nhận: khung auto layout. Chữ trong ảnh không chọn được.

Dựng: `process/modules/write-bricks/components/flat-image.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/flat-image.mjs`
Element: một `image` render từ Figma. Alt là chữ nhìn thấy, theo thứ tự cây.

## Hợp đồng

- Nhận: container of mostly artwork (images, vectors, rotation / blur), hand-placed (no auto layout), text and buttons drawn inside
- Phần: `alt`, `link`, `scale` (default 2)
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: not editable, text not selectable; effects spilling outside the node box make the export bigger than the box: not applied. verify only measures the image box
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
