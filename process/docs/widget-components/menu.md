# menu

Có: có

Tên khác: nav, link row, thanh menu

Nhận: hàng ngang các nhãn link ngắn, không ảnh, nằm trong khung.

Không nhận: tiêu đề cộng badge. Hàng có [switch](switch.md). Hàng toàn nút đặc. Chữ tràn khung thì là [menu-slider](menu-slider.md). Không dùng `nav-menu` khi chưa có id menu WordPress. Xem [nav-menu.md](nav-menu.md).

Dựng: `process/modules/write-bricks/components/menu.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/menu.mjs`
Element: `ul > li > text-link`. Khối ngoài là `nav`.

State: mục Active là `.is-active`. URL lấy từ plan, thiếu thì `#`.

## Hợp đồng

- Nhận: a horizontal row of >= 2 link-like items (one short text each, no picture) that fits in a frame named like a menu (`rules/menu.mjs`)
- Phần: `links` { textNodeId: url }
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: no hamburger / mobile panel / dropdown (`nav-nested` is for that case). URLs come from the Plan, missing = `#`, and the same URLs are copied onto a breakpoint menu. A row whose items run past the frame is `menu-slider`, not this
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
