# block

Có: có

Tên khác: frame, auto layout, flex, grid, container

Nhận: khung auto layout thành flex. `_direction` là row hoặc column. Khoảng cách là `_columnGap` và `_rowGap`. Khung grid lấy track từ Figma. Absolute lấy `_position`, top và left từ cây. `clipsContent` thành `_overflow: hidden`.

Không nhận: không xóa frame chỉ có một con. Không dùng key `_gap`.

Dựng: `process/modules/write-bricks/render/layout.mjs`, `render/size.mjs`, `render/style.mjs`
Element: `block` (`includes/elements/container.php`)
