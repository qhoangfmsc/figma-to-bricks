# shape-divider

Có: module riêng, chưa tự nhận

Khi nào dùng: mép trên hoặc mép dưới của một section là một hình sóng, zigzag, tam giác do Bricks vẽ. Một svg tự do vẫn là [svg](svg.md).

Module: `process/modules/write-bricks/standby/layout-extra.mjs`

`shapeDivider({ shape, fill })` ghi `_shapeDividers`. `shape` phải nằm trong `SHAPE_NAMES` (`includes/elements/base.php`). `fill` là màu Figma nếu có. Tên lạ thì không dựng.

## Hợp đồng

- Nhận: xem phần mô tả phía trên của file này
- Phần: không có params bắt buộc, trừ khi phần mô tả phía trên nói có
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: theo phần mô tả phía trên của file này
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
