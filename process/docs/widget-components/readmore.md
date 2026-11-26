# readmore

Có: có

Tên khác: xem thêm, read more, expand

Nhận: khung bị cắt, nội dung cao hơn khung, và một nút phía sau.

Dựng: `process/modules/write-bricks/components/readmore.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/readmore.mjs`
Element: `button` cộng interaction `toggleAttribute` (`includes/interactions.php`)

Nút không có nền. Khi mở, nhãn luôn là “Rút gọn” và mũi tên quay lên.

## Hợp đồng

- Nhận: a clipped frame (`clip`, variant Expand=No) whose content runs past its height, with a button "Xem thêm" / "Read more" after it (`detect/rules/readmore.mjs`)
- Phần: `button`, `buttonMode`, `expand`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: the button has no fill. Open, the label is "Rút gọn" and the caret turns up. Extra open text or a Figma frame is copied onto a breakpoint that has the same read-more. The open class is the same in every frame
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
