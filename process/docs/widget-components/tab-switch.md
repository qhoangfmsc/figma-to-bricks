# tab-switch

Có: có

Tên khác: tab, switcher

Nhận: hàng nút cùng cấu trúc, mỗi nút một nhãn, đúng một nút đang chọn. Chọn bằng variant (`State=Active`), một nền khác các nút còn lại, hoặc gạch chân (dạng line). Chiều cao của nút không quyết định. Tên layer không quyết định. Vạch ngăn giữa các nút có thể có hoặc không; khi có, vạch đó là một tín hiệu của hàng tab và không phải một nút. Hàng có thể nằm trong khối tiêu đề. Khung nội dung là vùng ngay bên dưới khối đó, hoặc các pane cùng cấu trúc xếp sau hàng. Tabs bar và tabs data là hai phần của component này, cùng tên với tabs. Plan ghi node của từng phần, hoặc không khi khung không vẽ. Các section sau của trang không phải pane đó. Hàng link gạch chân mà có pane bên dưới là tab line; hàng đó không có pane thì vẫn là menu.

Không nhận: hai nút cùng active, hoặc hai nhóm mục bằng nhau, thì hỏi, không đoán.

Dựng: `process/modules/write-bricks/components/tab-switch.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/tab-switch.mjs`
Element: `tabs-nested` (`includes/elements/tabs-nested.php`)

State: so title đang chọn với title nghỉ (`activeLook`). Nền, viền, màu chữ và dấu chỉ có ở biến thể đã chọn đi theo `brx-open`. Chữ và icon riêng của từng tab giữ nguyên. Control trong title mở có `aria-checked="true"`. Pane cùng index với title mở là data đang hiện. Pane Figma không vẽ để trống.

HTML: một block bọc hai block. Block thứ nhất là `tab-menu` (các `tab-title`, title mở thêm `brx-open`). Block thứ hai chứa các `tab-pane`, cùng thứ tự với title, pane đang mở thêm `brx-open`. Icon hoặc vạch giữa các title không nhận class tab.

Tab chưa có mục thì plan hỏi một link Figma.
