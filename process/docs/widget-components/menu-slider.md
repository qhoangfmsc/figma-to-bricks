# menu-slider

Có: có

Tên khác: nav tràn, menu kéo

Nhận: cùng hàng link của [menu](menu.md) khi chữ chạy quá khung. Thường có nút mũi tên hai bên.

Không nhận: không phải [carousel](carousel.md). Cái này dừng ở hai đầu, không loop, không autoplay.

Dựng: `process/modules/write-bricks/components/menu-slider.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/menu.mjs`
Element: `slider-nested`, nhãn vẫn `text-link` (`includes/elements/slider-nested.php`)

## Hợp đồng

- Nhận: the same menu row when the items run past the frame, often with arrow buttons beside it (`rules/menu.mjs`)
- Phần: `links` { textNodeId: url }, `prev`, `next`, `controls`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: separate from `carousel` (that one is always loop and autoplay). This one stops at the ends. URLs come from the Plan, missing = `#`, and are copied onto a breakpoint that has the same menu
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
