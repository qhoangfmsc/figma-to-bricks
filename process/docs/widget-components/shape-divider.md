# shape-divider

Có: module riêng, chưa tự nhận

Khi nào dùng: mép trên hoặc mép dưới của một section là một hình sóng, zigzag, tam giác do Bricks vẽ. Một svg tự do vẫn là [svg](svg.md).

Module: `process/modules/standby/layout-extra.mjs`

`shapeDivider({ shape, fill })` ghi `_shapeDividers`. `shape` phải nằm trong `SHAPE_NAMES` (`includes/elements/base.php`). `fill` là màu Figma nếu có. Tên lạ thì không dựng.
