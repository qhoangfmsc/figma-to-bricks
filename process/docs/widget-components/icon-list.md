# icon-list

Có: dựng được. Nhận dạng tự động: chưa có rule.

Tên khác: checklist, list

Hình để sau này nhận: cột các hàng, mỗi hàng một svg và một chữ.

Không nhận: quá một chữ mỗi hàng, hoặc chữ nhiều style trong một hàng.

Dựng: `process/modules/write-bricks/components/icon-list.mjs`
Element: `list`. Icon là file svg của Figma.

## Hợp đồng

- Nhận: vertical container of rows = one svg icon + one text (checklists, reasons)
- Phần: không có params bắt buộc, trừ khi phần mô tả phía trên nói có
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: one text per row; icons are the Figma svg files
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
