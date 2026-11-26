# tooltip

Có: có

Tên khác: hint, popover, info, hỏi

Nhận: icon info hoặc hỏi cạnh một nhãn. Chữ lấy từ node popup tên tooltip / hint / popover nếu có.

Không nhận: popup vẽ sẵn không dựng thành một khung riêng. Chữ của popup là nội dung bong bóng.

Dựng: `process/modules/write-bricks/components/tooltip.mjs`, `tooltip-style.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/tooltip.mjs`
Element: icon được bọc bởi `.f2b-tip-wrap`. `.f2b-tip` nằm trong khung đó, hiện khi hover. Vị trí: phía trên icon, cách 4px, mép phải bong bóng trùng mép phải icon nên bong bóng chạy sang trái, `z-index: 50`. Khung cha trong bảng được `overflow: visible` để bong bóng không bị cắt. Nền `#007cfc`, chữ trắng, radius 4px, padding 8px. `max-width` mặc định `150px`. Bong bóng đã vẽ thì lấy `maxWidth` hoặc bề rộng của khung đó.

## Hợp đồng

- Nhận: info / question icon next to a label; text from a popup node named tooltip / hint / popover if there is one
- Phần: `text` (required), `position` (top, top-left, top-right, bottom, bottom-left, bottom-right, left, right)
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: bubble is blue `#007cfc`, white text, radius 4px, padding 8px, offset `top: 20px; left: -145px`
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
