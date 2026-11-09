# checkbox

Có: có

Tên khác: consent, ô vuông, check

Nhận: một ô vuông nhỏ cạnh một nhãn. Dấu trong ô, hoặc tên checkbox, tăng độ chắc. Chỉ có hình thì vẫn đề xuất.

Không nhận: icon svg hoặc icon font không có hộp nét. Checkbox nằm trong [form](form.md) thì là field của form đó.

Dựng: `process/modules/write-bricks/components/checkbox.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/choice.mjs`
Element: một field checkbox của `form` (`includes/elements/form.php`). Theme không có element checkbox đứng riêng.

Nút submit mà `form.php` luôn vẽ thì bị ẩn. Kích thước ô là CSS của element, file CSS ngoài.
