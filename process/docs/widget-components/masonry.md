# masonry

Có: module riêng, chưa tự nhận

Khi nào dùng: Figma vẽ một lưới xếp gạch, chiều cao thẻ không đều. Lưới đều vẫn là grid trong [block](block.md).

Module: `process/modules/standby/layout-extra.mjs`

`masonrySettings({ columns, gutter })` ghi `_useMasonry`, `_masonryColumn`, `_masonryGutter` (`includes/elements/base.php`). `columns` lấy từ số cột của khung. Không có số cột thì không dựng.
