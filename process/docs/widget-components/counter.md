# counter

Có: dựng được. Nhận dạng tự động: chưa có rule.

Tên khác: count, số đếm

Hình để sau này nhận: một chữ là số, ví dụ `80,000+` hoặc `97%`.

Dựng: `process/modules/write-bricks/components/counter.mjs`
Element: `counter`. Thời gian đếm là mặc định của Bricks.

## Hợp đồng

- Nhận: a TEXT with a number ("80,000+", "97%")
- Phần: không có params bắt buộc, trừ khi phần mô tả phía trên nói có
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: not a heading any more; duration = Bricks default
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
