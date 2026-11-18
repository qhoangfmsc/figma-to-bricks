# compare-table

Có khi plan ghi id bảng so sánh. Không có id thì khung giữ nguyên hình đã vẽ.

Tên khác: Comparison tables, bảng so sánh

Khi nào dùng: user đưa id, ví dụ `bang-so-sanh-maxspeed`. Build đọc bảng đó trên `WP_URL`.

Module: `process/modules/write-bricks/components/compare-table.mjs`

| Việc | Giá trị |
|---|---|
| Query gói | `vnxcmp_pkg__<id>` |
| Query nhóm | `vnxcmp_group__<id>` |
| Query dòng | `vnxcmp_row__<id>` |
| Chữ | `{vnx_cmp_*}` |
| Tooltip | Icon hỏi được bọc `.f2b-tip-wrap`. `.f2b-tip` chứa `{vnx_cmp_row_desc}`, nằm ngay trên icon, cách 4px, lệch sang trái, `z-index: 50`. Hover hiện. Khung bảng `overflow: visible` để không cắt bong bóng. Desc rỗng thì không dựng. Màu lấy từ khung Tooltip đã vẽ, mặc định nền `#007cfc`. `max-width` lấy từ khung đó, không có khung thì `150px`. |
| Ô yes / no | Dấu có là `fa-check`, size và màu lấy từ dấu đã vẽ. Dấu không là `fa-xmark`, màu `#f62e13`, cùng size. |
| Ô chữ | `{vnx_cmp_value_text}`, hiện khi loại ô là `text` |
| Link mua | thẻ `a`. Plan liệt kê `href`, `rel`, `class`, `data-price`, `data-period`, `data-product-name`, `data-product-category`. `data-price` là `{vnx_cmp_price:raw}` (số không dấu chấm). Chữ giá trên bảng vẫn có dấu chấm. |
| Xem thêm | Nhóm đầu luôn mở, không có nút. Nhóm sau chỉ có nút khi `{vnx_cmp_group_rows}` lớn hơn 4. Figma không vẽ nút thì vẫn thêm nút đó. Đóng thì hiện 4 dòng đầu (`{vnx_cmp_row_index}` 1–4), dòng sau ẩn đến khi nhóm có `is-open`. Nút: `data-vnx-cmp-more`. Đóng: Xem thêm và `fa-angle-down`. Mở: Thu gọn và `fa-angle-up`, màu `#007cfc`. |
| Header | Hàng gói `position: sticky`, `top: 60px` (tablet `40px`), nền trắng, dính đến hết section. |
| Số gói | Khung bảng có `--vnx-cmp-packages`. Một cột lặp và hàng không trượt thì bề rộng cột là `100% / var(--vnx-cmp-packages)`. | 
| Slider | Hàng gói bị cắt thì khung cha có `data-vnx-cmp-slider-root`, hàng trượt ngang (`overflow-x: auto`) có `data-vnx-cmp-slider`, cột có `data-vnx-cmp-col`. Nút hai bên, nếu có, nhận `data-vnx-cmp-prev` và `data-vnx-cmp-next`. Chưa trượt được thì nút ẩn. Nút `is-disabled` thì mờ và không bấm. Script plugin gắn hai class đó. |

Một cột gói, một nhóm, một dòng và một ô là mẫu lặp. Đầu bảng lặp gói. Thân bảng lặp nhóm, rồi dòng, rồi gói cho từng ô. Mọi breakpoint dùng cùng id và cùng tag.

Không có bảng, hoặc id không đúng chữ thường và dấu gạch, thì không gắn tag. Nút mua không có link cho đến khi có id.
