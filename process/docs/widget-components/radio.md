# radio

Có: có

Tên khác: radio, hình tròn chọn

Nhận: một hình tròn nhỏ cạnh một nhãn. Dấu trong vòng, hoặc tên radio, tăng độ chắc.

Không nhận: icon bo tròn không có vòng nét. Radio nằm trong [form](form.md) thì là field của form đó.

Dựng: `process/modules/write-bricks/components/radio.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/choice.mjs`
Element: một field radio của `form` (`includes/elements/form.php`). Theme không có element radio đứng riêng.

## Hợp đồng

- Nhận: a row with one small circle and one label (`rules/choice.mjs`). A mark inside the circle, or a radio name, is high confidence. Shape only stays proposed
- Phần: `label`, `labelNode`, `checked`, `markW`, `markH`, `markRadius`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: Bricks 1.12.3 has no standalone radio. Same external-file CSS and submit-button limit as `checkbox`. A radio inside a form stays a field of that form
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
