# select

Có: có

Tên: Dropdown

Nhận: khung ngang, thấp, có viền, một chữ, một dấu nhỏ ở phía sau chữ. Label phía trên là tuỳ chọn. Danh sách không được vẽ.

Không nhận: dropdown đã vẽ sẵn danh sách dọc. Cái đó là [dropdown](dropdown.md).

Dựng: `process/modules/write-bricks/components/select.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/select.mjs`
Element: block `f2b-select`. Đây là default. Nút là control đã vẽ: chữ bên trái, mũi tên chỉ ở nút. Danh sách là một block `f2b-select-values`, `position: absolute`, ngay dưới nút. Mục không có viền và không có mũi tên. Mục đang chọn có dấu check. Bảng giá dùng đúng shell này, chỉ đổ vòng lặp chu kỳ vào danh sách.

Plan hỏi các mục, mỗi mục một dòng. Trống thì ô giữ chữ đang vẽ và chưa có menu.
