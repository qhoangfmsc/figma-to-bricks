# video

Có: có

Tên khác: player, play

Nhận: ảnh có một vòng play gần giữa. Vòng đó có thể là nét vector, không cần bo góc trên layer. Ảnh có thể nằm trong mask bên trong.

Không nhận: chưa có URL thì giữ ảnh. Không bịa URL. Autoplay tắt.

Dựng: `process/modules/write-bricks/components/video.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/media.mjs`
Element: `video` (`includes/elements/video.php`). YouTube và Vimeo dùng source đó. URL http khác là file.

## Hợp đồng

- Nhận: a picture frame with one play circle near the centre (`rules/media.mjs`)
- Phần: `url`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: Until the address is filled the frame stays the picture Figma drew. Autoplay stays off
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
