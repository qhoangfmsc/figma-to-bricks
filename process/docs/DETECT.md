# Cách đọc

Mỗi component một file trong [widget-components/](widget-components/). Tên file là id. Mục lục là [INDEX.md](INDEX.md).

Hình trên cây quyết định. Tên lớp chỉ tăng độ chắc. Số lấy từ Figma.

Plan chỉ kết luận khi đủ ba thứ: ảnh render của section (`look.png`), nhận dạng từ ảnh đó, và tín hiệu trong cây. Cùng một loại thì dựng. Khác loại, hoặc chỉ có một phía, thì giữ block. Plan chưa có nhận dạng từ ảnh thì chưa phải bản để xác nhận.

Không lấy từ kệ: giảm chữ 15–25%, slider desktop thành hàng kéo, xóa frame một con, key `_gap`, element `icon`, element `accordion` và `slider`. Theme này dùng `accordion-nested` và `slider-nested`.

Tên miền và bảng giá chỉ là layout. Không gắn search, không gắn link. Action của hai thứ đó nằm ở plugin vietnix-center.

`Tìm` cạnh một ô là search, trừ ô tên miền. Popup có switch hoặc ô nhập và nút `Lưu` là một form, nút đó lưu submission. Popup không có ô thì nút `Xác nhận` / `Đóng` chỉ tắt. ANV không có element switch. Switch là checkbox, nhưng vẽ đúng viên thuốc Figma: `appearance: none`, rộng cao và bo góc của rãnh, núm là nền. Hai màu và hai chữ (`Tắt`, `Bật`) lấy từ hai trạng thái đã vẽ.

Con trỏ viết lúc dựng, không chờ nhắc: ô chữ và textarea là `text`, nút, link, submit, select, checkbox, radio và switch là `pointer`.
