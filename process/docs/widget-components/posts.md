# posts

Có: module riêng, chưa tự nhận

Tên khác: query loop, vòng lặp bài viết

Khi nào dùng: plan nói khung này là danh sách bài viết và ghi loại bài (`post`, `product`, …). Không dùng cho một hàng thẻ vẽ sẵn trong Figma.

Module: `process/modules/write-bricks/standby/query.mjs`

Element: `posts`. Query nằm ở `settings.query` (`includes/query.php`). Không có key `_query`.

`postQuery({ postType, perPage })` cần `postType` từ plan. Thiếu thì không dựng. `postsElement(query)` trả element `posts`.

Danh sách thẻ tĩnh vẫn là block hoặc [carousel](carousel.md). Loại template danh sách là [archive](archive.md).

## Hợp đồng

- Nhận: xem phần mô tả phía trên của file này
- Phần: không có params bắt buộc, trừ khi phần mô tả phía trên nói có
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: theo phần mô tả phía trên của file này
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
