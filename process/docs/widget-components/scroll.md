# scroll

Có: có

Tên khác: thanh scroll, scroll ngang, scroll dọc

Nhận: một frame có đúng hai khối cùng chiều. Khối dài hơn và nhạt hơn là dải. Khối ngắn hơn và đậm hơn nằm đè lên dải, đó là nút kéo. Cạnh frame đó là một list mục lặp tràn khỏi container. Ngang hay dọc đều cùng một rule.

Không nhận: lưới ảnh. Hàng có mũi tên là slider. "Xem thêm" là readmore. Hai khối cùng màu, hoặc list không tràn, không phải scroll. Không phải thanh phần trăm.

Dựng: `process/modules/write-bricks/components/scroll.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/scroll.mjs`
Element: `block`. Đưa chuột vào khung rồi lăn chuột, hoặc vuốt trackpad, là các mục chạy ngang. Thanh trình duyệt bị ẩn. Nút đậm chạy theo vị trí cuộn. Nút giữ đúng cỡ Figma vẽ.
