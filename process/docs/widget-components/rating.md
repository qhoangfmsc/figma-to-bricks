# rating

Có: có

Tên khác: sao, star

Nhận: một hàng cùng một dấu sao, từ bốn dấu.

Không nhận: các icon khác nhau. Không bịa tên icon.

Dựng: `process/modules/write-bricks/components/production.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/production-widgets.mjs`
Element: `rating` (`includes/elements/rating.php`)

## Hợp đồng

- Nhận: a row of the same star mark, at least four
- Phần: `rating`, `maxRating`, `gap`, `iconSize`, `color`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: the icon name is not invented. Different icons are not a rating
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
