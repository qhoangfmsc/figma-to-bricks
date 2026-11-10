# tabs

Có: có

Tên khác: tab

Nhận: một thanh ngang từ hai tiêu đề và một khung nội dung bên dưới.

Dựng: `process/modules/write-bricks/components/tabs.mjs`, `tabs-chrome.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/tabs.mjs`
Element: `tabs-nested` (`includes/elements/tabs-nested.php`)

Pane đã vẽ thì giữ. Link Figma thay pane đó. Chữ gõ vào plan điền pane chưa vẽ. Trống thì giữ hình đang vẽ.

State: title mở mang `brx-open` và pane cùng index mang `brx-open`. Đổi tab thì class, attribute của control bên trong, và pane đang hiện phải đổi cùng lúc. Chỉ đổi CSS của một title thì chưa phải state.
