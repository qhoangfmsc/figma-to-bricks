# switch

Có: có

Tên khác: toggle, pill, công tắc

Nhận: viên thuốc bo tròn, một núm, một nhãn. Núm qua giữa rãnh, hoặc `Pressed=True`, thì checked.

Hai trạng thái lấy từ hai lần vẽ cùng viên thuốc (cùng tên và cùng kích thước). Tắt giữ màu rãnh lúc núm ở đầu. Bật (`:checked`) dùng màu rãnh lúc núm ở cuối. Không có lần vẽ kia thì không bịa màu thứ hai.

Chữ cạnh viên thuốc là value. Lúc tắt hiện chữ của `Pressed=False` (ở file này là `Tắt`). Lúc bật hiện chữ của `Pressed=True` (ở file này là `Bật`). Thiếu một lần vẽ thì giữ chữ đang có. Nút, switch và chữ đó dùng con trỏ `pointer`.

Không nhận: ba gạch xếp dọc. Cái đó là [hamburger](hamburger.md). Element `toggle` của Bricks là hamburger, không phải switch.

Dựng: `process/modules/write-bricks/components/switch.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/choice.mjs`
Element: field checkbox của `form`. Input phải `appearance: none` và đúng rộng, cao, bo góc của viên thuốc. Ô vuông mặc định của checkbox là sai. Theme không có element switch.

## Hợp đồng

- Nhận: a row with one fully rounded pill, one knob, and one label (`rules/choice.mjs`)
- Phần: `label`, `labelNode`, `checked`, `markW`, `markH`, `markRadius`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: Bricks 1.12.3 has no switch element (`toggle-mode` is not in this theme). The pill size is element CSS compiled into the external post CSS file. Same submit-button limit as `checkbox`
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
