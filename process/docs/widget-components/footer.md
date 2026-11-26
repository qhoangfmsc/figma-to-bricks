# footer

Có: có

Tên khác: chân trang

Nhận: có dòng bản quyền trong khung cao hơn 140. Hoặc từ hai cột link trên khung cao từ 180.

Không nhận: chỉ có tên footer thì độ chắc thấp.

Dựng: loại template `footer`
Nhận dạng: `process/modules/recognize-parts/rules/template-type.mjs`

## Hợp đồng

- Nhận: có dòng bản quyền trong khung cao hơn 140. Hoặc từ hai cột link trên khung cao từ 180.
- Phần: không có params bắt buộc, trừ khi phần mô tả phía trên nói có
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: theo phần mô tả phía trên của file này
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
