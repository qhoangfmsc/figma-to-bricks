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
