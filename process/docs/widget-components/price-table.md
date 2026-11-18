# price-table

Có khi plan ghi id bảng giá. Không có id thì khung giữ nguyên hình đã vẽ.

Tên khác: Service Pricing, bảng giá

Khi nào dùng: user đưa id, ví dụ `bang-gia-maxspeed-hosting-thang-10`. Build đọc `widget_data` của id đó trên `WP_URL`.

Module: `process/modules/write-bricks/components/price-table.mjs`

| Việc | Giá trị |
|---|---|
| Query chu kỳ | `vnxsp_cycle__<id>` |
| Query gói | `vnxsp_pkg__<id>` |
| Query dòng | `vnxsp_row__<id>` |
| Chữ | `{vnx_sp_*}` |
| Link đăng ký | `{ type: 'external', url: '{vnx_sp_link}' }` |
| Copy mã | attribute `data-vnx-sp-copy` |

Ba vòng lặp lồng nhau. Khung vẽ một hàng pill thì pill là tab. Khung vẽ một ô đóng (một nhãn chu kỳ và một icon, không có hàng pill) thì ô đó dùng shell mặc định của `select`. Bảng giá chỉ gắn query chu kỳ và tag `{vnx_sp_cycle}` / `{vnx_sp_cycle_badge}`. Bấm một chu kỳ thì Bricks mở pane của chu kỳ đó, nên giá trong thẻ đổi theo. Hàng thẻ nằm ngang và bị cắt thì scroll ngang, không thêm mũi tên. Mọi breakpoint dùng cùng id và cùng tag. Đây là default của bảng giá.

Không có bảng, hoặc id không đúng chữ thường và dấu gạch, thì không gắn tag. Nút trong bảng giá không có link cho đến khi có id.
