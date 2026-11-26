# progress

Có: có

Tên khác: progress-bar, thanh phần trăm

Nhận: một rãnh và một đoạn tô ngắn hơn. Phần trăm lấy từ chữ có `%`, hoặc từ bề rộng đoạn tô.

Không nhận: không thêm tiêu đề mẫu. Một thanh mỏng cạnh list tràn khỏi khung là scroll, không phải phần trăm.

Dựng: `process/modules/write-bricks/components/production.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/production-widgets.mjs`
Element: `progress-bar` (`includes/elements/progress-bar.php`)

## Hợp đồng

- Nhận: a track and a shorter fill
- Phần: `bars`, `height`, `showPercentage`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: no sample titles are added
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
