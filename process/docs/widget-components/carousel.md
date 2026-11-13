# carousel

Có: có

Tên khác: slider, slide

Nhận: hàng ngang các thẻ cùng một cây. Frame hoặc khung cha bật clip và có thẻ nằm ngoài hàng, hoặc có cặp nút trong hàng hay ngay trên hoặc dưới, hoặc có dải chấm thật. Slider thường là một hàng, hàng đó là một slide. Hai hàng trở lên của cùng thẻ, mọi hàng nằm trọn trong khung, cộng dải chấm, vẫn là một trang: các hàng là bố cục của trang, không phải từng slide. Nút trước và nút sau là mũi tên trái phải vẽ trong icon, hoặc cặp icon nằm sát hàng. Lớp mờ ở mép không phải thẻ. Thiếu nút vẫn là carousel. Hàng thẻ nằm trọn trong khung, không clip, không nút, không dải chấm, là lưới. Hàng TLD tên Frame vẫn là slider khi các con là Slider Item.

Không nhận: desktop không có khung mobile vẫn là slider. Không đổi thành hàng kéo ngang.

Dựng: `process/modules/write-bricks/components/carousel.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/carousel.mjs`
Element: `slider-nested` (`includes/elements/slider-nested.php`). Không dùng element `slider`.

Loop bật. Autoplay bắt đầu 3 giây khi plan để trống. Plan tắt được.
