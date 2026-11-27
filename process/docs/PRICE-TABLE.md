# Bảng giá (price-table): quy trình và hợp đồng cấu trúc

Áp dụng cho MỌI Figma có bảng giá, không riêng section nào. Điều kiện tiên quyết, theo thứ tự:

1. **Giao diện và bố cục giống Figma** (số đo, màu, chữ, thứ tự, khung nổi bật, nhãn).
2. **Dữ liệu luôn động**: đổi bảng trên server thì mọi thứ phụ thuộc dữ liệu đổi theo (giá, % giảm của thẻ và tab, tiết kiệm, danh sách quyền lợi, gói và chu kỳ nổi bật, số gói, số chu kỳ). Mọi ô dữ liệu đều tùy chọn: có thì điền, thiếu thì giao diện vẫn đúng như Figma.

Không có quy tắc theo tên layer, chữ, số hay id của một file. Cấu trúc được nhận ra bằng hình dạng (icon cộng chữ, khung có nền, chữ cạnh giá…).

## Quy trình mỗi lần dựng

1. **Nhìn Figma, lập danh sách thành phần** (bảng dưới). Với từng thành phần ghi nguồn: dữ liệu, tính từ dữ liệu, hoặc Figma.
2. **Xác định khuôn**: một thẻ mẫu, một pill mẫu, một hàng quyền lợi mẫu. Mọi chỗ thẻ vẽ khác khuôn là biến thể.
3. **Dựng**: vòng lặp theo dữ liệu (`vnxsp_cycle__id`, `vnxsp_pkg__id`, `vnxsp_row__id`), biến thể gắn theo TÊN gói và NHÃN chu kỳ (không theo vị trí), cờ nổi bật từ dữ liệu thắng thiết kế mặc định.
4. **Kiểm** (bắt buộc): bấm từng tab chu kỳ ở từng khung (desktop, mobile), đối chiếu giá gốc, chip %, giá bán, câu tổng, tiết kiệm, danh sách với bảng dữ liệu; giả lập cờ nổi bật bằng thuộc tính và xem khung, dải, nút, nhãn tab chuyển đúng; so ảnh với Figma cả trang (không chỉ 900px đầu).

## Thành phần và nguồn

| Thành phần | Nguồn | Ghi chú |
|---|---|---|
| Pill chu kỳ, nhãn chu kỳ | dữ liệu: nhãn của chu kỳ | tabs loop; số pill theo dữ liệu |
| Chip % trên pill | dữ liệu: badge của chu kỳ | `chipCycle`: pill mẫu là pill có vẽ chip |
| Pill đang bật mặc định | Figma (pill có nền) | tìm theo chữ (`selectedLabel`) để dùng ở mọi khung; mở bằng CSS vì tab từ vòng lặp không có `brx-open` |
| Nhãn "Phổ biến" trên pill | cờ `{vnx_sp_cycle_label}` của chu kỳ; thiếu cờ thì pill vẽ nó trong Figma | theo nhãn chu kỳ; có cờ nào thì thiết kế mặc định tắt |
| Thẻ gói, số thẻ | dữ liệu: cột gói | loop theo gói |
| Tên gói | dữ liệu `{vnx_sp_name}` | |
| Mô tả dưới tên, chữ nút riêng, dòng đầu danh sách riêng | Figma, theo tên gói | bảng chưa có ô; biến thể hiện đúng gói |
| Giá gốc, giá bán, đơn vị | dữ liệu `{vnx_sp_regular}`, `{vnx_sp_sale}`, `{vnx_sp_unit}` | giữ ký hiệu tiền đã vẽ (`exactPrice`) |
| Chip % của gói | dữ liệu `{vnx_sp_tag}`; thiếu tag thì tính `(gốc - bán) / gốc` | chip trống ẩn bằng CSS tới khi có số |
| Câu tổng ("Thanh toán X/chu kỳ") | dữ liệu `{vnx_sp_total}` và `{vnx_sp_cycle}` | chữ chu kỳ vẽ trong câu thành thẻ chu kỳ |
| Tiết kiệm | tính: `gốc × số tháng - tổng`, số tháng = tổng / bán | cạnh câu tổng; số không có trong bảng và không cạnh câu tổng thì ẩn |
| Khuyến mãi, mã | dữ liệu `{vnx_sp_promo_text}`, `{vnx_sp_code}` | hiện khi có |
| Danh sách quyền lợi | dữ liệu: hàng của gói (chữ, phụ, icon) | vài hàng đầu, còn lại sau "Xem thêm" |
| Hộp lưu ý và nút | Figma (kiểu); nút `{vnx_sp_link}` và thuộc tính | luôn thành một cụm ở đáy thẻ |
| Gói nổi bật | cờ `{vnx_sp_label}` của gói; thiếu cờ thì thẻ vẽ có dải trong Figma | kiểu = khác biệt giữa thẻ vẽ có dải và thẻ mẫu (khung, dải, nút); theo tên gói |
| Thẻ ngoài bảng (vd. gói liên hệ) | Figma, tĩnh | cùng khuôn |

## Quy tắc kỹ thuật bắt buộc (học từ lỗi thật)

- CSS đặt ở phần tử cha ngoài vòng lặp (gốc bảng hoặc hàng pill); CSS của phần tử trong vòng lặp không được Bricks xuất ra file.
- Không có dấu `{` hoặc `}` trong bộ chọn CSS (bộ rút gọn của Bricks cắt mất phần sau). Thẻ chưa được plugin thay giá trị kiểm bằng `*="vnx_sp_"`.
- Script chèn vào trang không được có dấu `\` (site bỏ hết). Có test chặn.
- Điều kiện `not_contains` của Bricks 1.12.3 không có tác dụng: ẩn/hiện qua thuộc tính và CSS.
- Ẩn phần tử có gradient SVG bằng `visibility`, không bằng `display:none`.
- `put` gộp `_attributes` theo tên; không ghi đè.
- Hàng có con chữ cố định rộng hơn chỗ chứa phải cho chữ xuống dòng, không tạo khung cuộn.
- Ảnh verify phải là cả trang; chip, tiết kiệm và nhãn phụ thuộc script, kiểm cả trước và sau khi script chạy (LiteSpeed có thể trì hoãn).

## Tham số của detection (chỉ ở bảng giá)

Từ nay workflow tự nhận theo hình dạng Figma, không cần ghi tay:
- `chipCycle`: có pill vẽ chip % thì pill đó là pill mẫu. `false` để tắt.
- `exactPrice`: thẻ vẽ câu tổng ("Thanh toán X/chu kỳ") thì giữ ký hiệu tiền, tính tiết kiệm, ẩn chip trống. `false` để tắt.
- `selectedLabel`: `look` lưu chữ của pill đang chọn để khung khác (mobile) tìm đúng pill.

Còn lại: `selected` (pill đang bật), `popularBand` (mặc định bật), `buttonAttrs`.
