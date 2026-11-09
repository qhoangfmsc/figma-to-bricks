# conditions

Có: module riêng, chưa tự nhận

Tên khác: hiện khi, ẩn khi

Khi nào dùng: plan nói element chỉ hiện với một điều kiện (đã đăng nhập, thứ, URL). Figma không vẽ điều kiện này.

Module: `process/modules/standby/conditions.mjs`

`conditions([[{ key, compare, value }]])` ghi `_conditions`. Mảng ngoài là OR, mảng trong là AND. Không có field `relation`.

Key lấy từ `includes/conditions.php`. Không có `device`, `post_type`, `cookie`, `os`. Key hệ điều hành là `operating_system`. Key referrer là `referer`.

Popup dùng `templateConditions`, không dùng `_conditions`. Xem [popup](popup.md).
