# block

Có: có

Tên khác: frame, auto layout, flex, grid, container

Nhận: khung auto layout thành flex. `_direction` là row hoặc column. Khoảng cách là `_columnGap` và `_rowGap`. Khung grid lấy track từ Figma. Absolute lấy `_position`, top và left từ cây. `clipsContent` thành `_overflow: hidden`.

Không nhận: không xóa frame chỉ có một con. Không dùng key `_gap`.

Dựng: `process/modules/write-bricks/render/layout.mjs`, `render/size.mjs`, `render/style.mjs`
Element: `block` (`includes/elements/container.php`)

## Hợp đồng

- Nhận: khung auto layout thành flex. `_direction` là row hoặc column. Khoảng cách là `_columnGap` và `_rowGap`. Khung grid lấy track từ Figma. Absolute lấy `_position`, top và left từ cây. `clipsContent` thành `_overflow: hidden`.
- Phần: không có params bắt buộc, trừ khi phần mô tả phía trên nói có
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: theo phần mô tả phía trên của file này
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
