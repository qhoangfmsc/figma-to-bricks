# checkbox

Có: có

Tên khác: consent, ô vuông, check

Nhận: một ô vuông nhỏ cạnh một nhãn. Dấu trong ô, hoặc tên checkbox, tăng độ chắc. Chỉ có hình thì vẫn đề xuất.

Không nhận: icon svg hoặc icon font không có hộp nét. Checkbox nằm trong [form](form.md) thì là field của form đó.

Dựng: `process/modules/write-bricks/components/checkbox.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/choice.mjs`
Element: một field checkbox của `form` (`includes/elements/form.php`). Theme không có element checkbox đứng riêng.

Nút submit mà `form.php` luôn vẽ thì bị ẩn. Kích thước ô là CSS của element, file CSS ngoài.

## Hợp đồng

- Nhận: a row with one small square and one label (`rules/choice.mjs`). A mark inside the square, or a checkbox name, is high confidence. Shape only stays proposed
- Phần: `label`, `labelNode`, `checked`, `markW`, `markH`, `markRadius`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: Bricks 1.12.3 has no standalone checkbox. The size has no form control, so it is element CSS and Bricks compiles it into the external post CSS file. The submit button `form.php` always renders is hidden the same way. A checkbox inside a form stays a field of that form. Theme styles are not changed
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
