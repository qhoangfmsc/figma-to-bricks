# tooltip

Có: có

Tên khác: hint, popover, info, hỏi

Nhận: icon info hoặc hỏi cạnh một nhãn. Chữ lấy từ node popup tên tooltip / hint / popover nếu có.

Không nhận: popup vẽ sẵn (màu, padding) không dựng lại thành bong bóng. Bong bóng vẽ một lần chỉ lấy màu nền và màu chữ cho CSS `--bricks-tooltip-bg` / `--bricks-tooltip-text` (`tooltip-style.mjs`).

Dựng: `process/modules/write-bricks/components/tooltip.mjs`, `tooltip-style.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/tooltip.mjs`
Element: attribute `data-balloon` (`includes/assets.php`)
