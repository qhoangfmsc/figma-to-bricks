# price-table

Figma là layout phải dựng. Data của id trong plan là nguồn phải dựng. Không hardcode số gói, chữ, hay một file.

Bắt buộc có id. Bảng giá chỉ render dynamic data của id đó. Không có id thì không dựng. Chữ Figma vẽ là ô, không phải nguồn dữ liệu.

Tên khác: Service Pricing, bảng giá

Khi nào dùng: user đưa id, ví dụ `bang-gia-maxspeed-hosting-thang-10`. Build đọc `widget_data` của id đó trên `WP_URL`.

Mỗi lần build, khi plan đã có id, component tự gắn query, tag `{vnx_sp_*}`, nút đăng ký với `data-price` là số trần, dropdown chu kỳ, icon yes/no/highlight, và ẩn mã giảm khi không có mã. Không cần nhớ cuộc chat.

Module: `process/modules/write-bricks/components/price-table.mjs`

| Việc | Giá trị |
|---|---|
| Query chu kỳ | `vnxsp_cycle__<id>` |
| Query gói | `vnxsp_pkg__<id>` |
| Query dòng | `vnxsp_row__<id>` |
| Chữ | `{vnx_sp_*}`. Tên dòng là `{vnx_sp_row}`, tooltip là `{vnx_sp_row_desc}`, nội dung gói là `{vnx_sp_info}`, phần cộng thêm là `{vnx_sp_info_extra}`, phần trăm trên giá là `{vnx_sp_tag}`. Icon dòng là element Icon, class `{vnx_sp_info_icon_class}`, ẩn khi `{vnx_sp_info_icon}` rỗng. |
| Link đăng ký | thẻ `a`. Plan liệt kê `href`, `rel`, `class`, `data-price`, `data-period`, `data-product-name`, `data-product-category`. `data-price` là `{vnx_sp_sale:raw}`. `data-product-category` để trống thì không gắn. |
| Chu kỳ mobile | Hàng pill là tab và có `data-vnx-sp-dropdown` để plugin đổi thành dropdown. |
| Icon dòng | `yes` là `fa-check`, `no` là `fa-xmark`, `highlight` là `fa-star`. Ẩn khi ô icon rỗng. |
| Copy mã | attribute `data-vnx-sp-copy` |

Ba vòng lặp lồng nhau. Khung vẽ một hàng pill thì pill là tab. Pill mở là pill không cùng vẻ với các pill còn lại. Nền của nó, loại nào cũng được, đi theo tab mở. Pill hover không phải pill nghỉ. Khung vẽ một ô đóng (một nhãn chu kỳ và một icon, không có hàng pill) thì ô đó dùng shell mặc định của `select`. Bảng giá chỉ gắn query chu kỳ và tag `{vnx_sp_cycle}` / `{vnx_sp_cycle_badge}`. Bấm một chu kỳ thì Bricks mở pane của chu kỳ đó, nên giá trong thẻ đổi theo. Hàng thẻ nằm ngang và bị cắt thì scroll ngang, không thêm mũi tên. Mọi breakpoint dùng cùng id và cùng tag. Đây là default của bảng giá.

Không có id, hoặc id không đúng chữ thường và dấu gạch, thì build dừng. Không gắn tag và không giữ chữ đã vẽ làm dữ liệu.

Output bắt buộc, với mọi file cùng kiểu: query chu kỳ, query gói, và query dòng khi data có dòng. Chu kỳ là tab nếu Figma vẽ hàng pill, là dropdown nếu Figma vẽ một ô đóng. Query gói lặp hết số gói trong data. Figma chỉ chọn layout (đủ hàng, scroll, hay slider). Thiếu một trong những query đó thì build dừng.
