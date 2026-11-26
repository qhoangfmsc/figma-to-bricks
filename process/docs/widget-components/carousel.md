# carousel

Có: có

Tên khác: slider, slide

Nhận: hàng ngang các thẻ cùng một cây. Frame hoặc khung cha bật clip và có thẻ nằm ngoài hàng, hoặc có cặp nút trong hàng hay ngay trên hoặc dưới, hoặc có dải chấm thật. Slider thường là một hàng, hàng đó là một slide. Hai hàng trở lên của cùng thẻ, mọi hàng nằm trọn trong khung, cộng dải chấm, vẫn là một trang: các hàng là bố cục của trang, không phải từng slide. Nút trước và nút sau là mũi tên trái phải vẽ trong icon, hoặc cặp icon nằm sát hàng. Lớp mờ ở mép không phải thẻ. Thiếu nút vẫn là carousel. Hàng thẻ nằm trọn trong khung, không clip, không nút, không dải chấm, là lưới. Hàng TLD tên Frame vẫn là slider khi các con là Slider Item.

Không nhận: desktop không có khung mobile vẫn là slider. Không đổi thành hàng kéo ngang.

Dựng: `process/modules/write-bricks/components/carousel.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/carousel.mjs`
Element: `slider-nested` (`includes/elements/slider-nested.php`). Không dùng element `slider`.

Loop bật. Autoplay bắt đầu 3 giây khi plan để trống. Plan tắt được.

## Hợp đồng

- Nhận: horizontal row of similar cards, one slide with arrow buttons, or one card with a Pagination instance inside the frame
- Phần: `perPage`, `pagination`, `prev`, `next`, `controls`, `allowSingle`, `itemCount`, `items`, `autoplay`, `settings`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: two or more slides stay loop. One drawn slide is type slide, because a loop clone moves that card out of the track. Autoplay starts at 3s; the Plan can turn it off. The dash count follows the items, not the dashes Figma drew; the active dash follows the item in front. Slides past the frame come from the Figma link, and that set is copied onto a breakpoint that has the same slider
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
