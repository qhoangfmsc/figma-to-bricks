# posts

Có: module riêng, chưa tự nhận

Tên khác: query loop, vòng lặp bài viết

Khi nào dùng: plan nói khung này là danh sách bài viết và ghi loại bài (`post`, `product`, …). Không dùng cho một hàng thẻ vẽ sẵn trong Figma.

Module: `process/modules/standby/query.mjs`

Element: `posts`. Query nằm ở `settings.query` (`includes/query.php`). Không có key `_query`.

`postQuery({ postType, perPage })` cần `postType` từ plan. Thiếu thì không dựng. `postsElement(query)` trả element `posts`.

Danh sách thẻ tĩnh vẫn là block hoặc [carousel](carousel.md). Loại template danh sách là [archive](archive.md).
