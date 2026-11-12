# scroll

Có: có

Tên khác: thanh scroll, scroll ngang, scroll dọc

Nhận: một nút kéo đậm hơn nằm trên một thanh kéo nhạt hơn. Cặp đó có thể là một frame riêng cạnh list mục lặp, hoặc nằm trên chính khung chữ. Ngang hay dọc đều cùng một rule, trên mọi frame có cặp đó. Khung chữ không cần cao hơn khung chứa: cặp nét đã vẽ là scroll. Nút kéo và thanh kéo là `childComponent` của scroll, không phải element. Plan ghi node của từng phần. Khung cuộn là `width: 100%` của cột cha ở mọi bề rộng của breakpoint đó. Không giữ px bản vẽ làm `_width` hay `_widthMax`. Hai nét đó không phải divider và không thành thẻ line. Thanh trình duyệt dùng đúng hai màu đó và chỉ hiện khi nội dung dài hơn khung.

Không nhận: lưới ảnh. Hàng có mũi tên là slider. "Xem thêm" là readmore. Hai khối cùng màu không phải scroll. Thanh riêng cạnh list mà list không tràn thì không gắn vào list đó. Không phải thanh phần trăm.

Dựng: `process/modules/write-bricks/components/scroll.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/scroll.mjs`
Element: `block`. Đưa chuột vào khung rồi lăn chuột, hoặc vuốt trackpad, là các mục chạy. Thanh trình duyệt dùng màu của cặp nét và tự ẩn khi chữ đã vừa khung.
