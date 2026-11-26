# accordion

Có: có

Tên khác: faq, expand, collapsed

Nhận: từ hai hàng cùng rộng. Mỗi hàng một tiêu đề và có thể một thân. Variant State=Collapsed / Expand tăng độ chắc.

Không nhận: một thẻ không cùng khổ.

Dựng: `process/modules/write-bricks/components/accordion.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/accordion.mjs`
Element: `accordion-nested` (`includes/elements/accordion-nested.php`). Không dùng element `accordion`.

State: Hover thành `:hover` trên từng item. Mở là dấu trừ, đóng là dấu cộng, đổi bằng `.brx-open`. Câu trả lời nhìn thấy trên Figma được điền. Câu của item đóng lấy từ plan, trống thì để trống. Xem [state.md](state.md).

## Hợp đồng

- Nhận: container of >= 2 items, each a title row + a content block; found by `detect/rules/accordion.mjs` (designer variants State=Collapsed / Expand, a name, or only the shape: then the Plan asks)
- Phần: `independent`, `sync`, `content.answers` { itemNodeId: text }
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: closed answers come from the Plan and are copied onto every breakpoint that has the same item; a breakpoint that already answered keeps its text; blank stays an empty block. Icons do not rotate. A shared icon, closed-title colour or expand gap follows the majority unless the Plan says not to
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
