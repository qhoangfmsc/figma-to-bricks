# menu

Có: có

Tên khác: nav, link row, thanh menu

Nhận: hàng ngang các nhãn link ngắn, không ảnh, nằm trong khung.

Không nhận: tiêu đề cộng badge. Hàng có [switch](switch.md). Hàng toàn nút đặc. Chữ tràn khung thì là [menu-slider](menu-slider.md). Không dùng `nav-menu` khi chưa có id menu WordPress. Xem [nav-menu.md](nav-menu.md).

Dựng: `process/modules/write-bricks/components/menu.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/menu.mjs`
Element: `ul > li > text-link`. Khối ngoài là `nav`.

State: mục Active là `.is-active`. URL lấy từ plan, thiếu thì `#`.
