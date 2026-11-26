# gallery

Có: có

Tên khác: image-gallery, lưới ảnh

Nhận: từ ba ảnh cùng cỡ, hàng hoặc lưới, không mũi tên.

Không nhận: hàng bị cắt và tràn thì là [carousel](carousel.md). Không đoán masonry.

Dựng: `process/modules/write-bricks/components/production.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/production-widgets.mjs`
Element: `image-gallery` (`includes/elements/image-gallery.php`)

## Hợp đồng

- Nhận: three or more pictures of one size, no arrows (`rules/production-widgets.mjs`)
- Phần: `images`, `columns`, `gutter`, `height`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: a clipped row that overflows stays a slider. Masonry is not guessed
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
