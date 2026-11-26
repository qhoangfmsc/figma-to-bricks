# divider

Có: có

Tên khác: line, gạch, separator

Nhận: một cạnh tối đa 2px, cạnh kia từ 40px.

Không nhận: nét không phải fill đặc thì không chép màu. Không thêm icon.

Dựng: `process/modules/write-bricks/components/divider.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/divider.mjs`
Element: `divider` (`includes/elements/divider.php`)

## Hợp đồng

- Nhận: a line: one side at most 2px, the other at least 40px (`rules/divider.mjs`)
- Phần: `direction`, `length`, `thickness`, `color`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: A stroke that is not a solid fill is not copied. No icon is added
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
