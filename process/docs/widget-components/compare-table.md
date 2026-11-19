# compare-table

Bắt buộc có id. Bảng so sánh chỉ render dynamic data của id đó. Không có id thì không dựng. Chữ Figma vẽ là ô, không phải nguồn dữ liệu.

Tên khác: Comparison tables, bảng so sánh

Khi nào dùng: user đưa id, ví dụ `test-section`. Build đọc bảng đó trên `WP_URL`.

Mỗi lần build, khi plan đã có id, component tự gắn. Không cần nhớ cuộc chat, không chép một template đã có. Gồm: query loop, tag `{vnx_cmp_*}`, tooltip từ `{vnx_cmp_row_desc}`, icon yes/no, nút mua với giá `raw`, Xem thêm khi nhóm sau có hơn 4 dòng, nhóm đầu mở hết. Không có khung tablet thì ba gói trở xuống chia đều khung, tên mục một hàng, giá trị các gói hàng dưới. Nút chuyển gói nằm ở hàng các gói và chỉ hiện khi có hơn ba gói.

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
| Tablet không có khung riêng | Ba gói trở xuống hiện đủ cột, không tràn khung. Tên mục là một hàng. Hàng ngay dưới là giá trị của các gói, chia đều. Nút chuyển gói nằm trong hàng heading của các gói, chỉ hiện khi có hơn ba gói. Không dùng component carousel. |

Một cột gói, một nhóm, một dòng và một ô là mẫu lặp. Đầu bảng lặp gói. Thân bảng lặp nhóm, rồi dòng, rồi gói cho từng ô. Mọi breakpoint dùng cùng id và cùng tag. Khung hẹp vẽ tên mục một hàng, hàng dưới là giá trị các gói, vẫn là bảng đó: query, tooltip và Xem thêm gắn trên khung đó. Giá và đơn vị viết chung một chữ vẫn là tag giá và tag đơn vị. Nút chỉ có chữ giá là link mua.

Không có id, hoặc id không đúng chữ thường và dấu gạch, thì build dừng. Không gắn tag và không giữ chữ đã vẽ làm dữ liệu.
