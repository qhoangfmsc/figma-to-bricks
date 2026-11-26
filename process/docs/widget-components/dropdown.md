# dropdown

Có: có

Tên khác: select list, chevron

Nhận: một nhãn ngắn, một chevron nhỏ, một danh sách dọc.

Không nhận: URL từng dòng chờ plan. Trống thì `#`. Ô chọn trong form là [input](input.md) type `select`, không phải dropdown này.

Dựng: `process/modules/write-bricks/components/production.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/production-widgets.mjs`
Element: `dropdown` (`includes/elements/dropdown.php`). Danh sách là `brx-dropdown-content`.

## Hợp đồng

- Nhận: a short label, a small chevron, and a vertical list
- Phần: `text`, `list`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: item URLs stay # until the plan has them
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
