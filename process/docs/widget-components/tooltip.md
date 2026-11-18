# tooltip

Có: có

Tên khác: hint, popover, info, hỏi

Nhận: icon info hoặc hỏi cạnh một nhãn. Chữ lấy từ node popup tên tooltip / hint / popover nếu có.

Không nhận: popup vẽ sẵn không dựng thành một khung riêng. Chữ của popup là nội dung bong bóng.

Dựng: `process/modules/write-bricks/components/tooltip.mjs`, `tooltip-style.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/tooltip.mjs`
Element: icon được bọc bởi `.f2b-tip-wrap`. `.f2b-tip` nằm trong khung đó, hiện khi hover. Vị trí: phía trên icon, cách 4px, mép phải bong bóng trùng mép phải icon nên bong bóng chạy sang trái, `z-index: 50`. Khung cha trong bảng được `overflow: visible` để bong bóng không bị cắt. Nền `#007cfc`, chữ trắng, radius 4px, padding 8px. `max-width` mặc định `150px`. Bong bóng đã vẽ thì lấy `maxWidth` hoặc bề rộng của khung đó.
