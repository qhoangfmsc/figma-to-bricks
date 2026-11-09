# button

Có: có

Tên khác: btn, cta, nút

Nhận: khung, instance hoặc component. Một chữ. Tối đa một icon. Cao 32–56. Có nền, viền, bo góc hoặc padding. Tên `button`, `btn`, `cta` chỉ tăng độ chắc. Cùng hình mà tên là Frame vẫn được đề xuất, độ chắc thấp.

Không nhận: hàng icon cộng chữ bị kéo hai đầu. Dòng chữ trong khung trần không có nền, viền, bo góc hay padding.

Dựng: `process/modules/write-bricks/components/button.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/button.mjs`
Element: `button` (`includes/elements/button.php`)

Vai trò, đọc từ chữ trên nút. Bricks 1.12.3: có `link` thì thẻ là `a`. Không có `link` thì thẻ là `span`, mình đặt `button` khi nút không đi trang.

| Vai | Chữ | Bricks |
|---|---|---|
| link | còn lại, kể cả Mua ngay | `<a>`. Chưa có URL thì `#` |
| layout | ô tên miền, nút trong bảng giá | chỉ vẽ. Không link, không submit. Action thuộc vietnix-center |
| close | Đóng, Hủy, Cancel, × | `<button data-f2b-close>`. Đóng popup |
| action | Chấp nhận, Xác nhận, Lưu, Save, Đồng ý, Chỉ Cookie cần thiết | Trong popup: `<button data-f2b-close>`. Trên section: interaction `hide` vào `[data-f2b-dismiss]` của section đó. Không phải link |
| search | Tìm kiếm, Search, khi đứng cạnh một ô | submit của [search](search.md), không dựng button riêng |
| mở popup | nút có `popupId`, ví dụ Tuỳ chỉnh mở popup cài đặt | interaction `show` + `target: popup` + `templateId` |

Dấu X ở góc thẻ popup cũng nhận `data-f2b-close`, kể cả khi nó là svg.

State: anh em Hover / Active lấy từ [state.md](state.md). Nút tự không bịa hover opacity.
