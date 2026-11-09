# carousel

Có: có

Tên khác: slider, slide

Nhận: hàng thẻ giống nhau bị cắt, có tên slider, có mũi tên, hoặc mỗi thẻ thuộc component Slider. Hàng TLD tên Frame vẫn là slider khi các con là Slider Item.

Không nhận: desktop không có khung mobile vẫn là slider. Không đổi thành hàng kéo ngang.

Dựng: `process/modules/write-bricks/components/carousel.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/carousel.mjs`
Element: `slider-nested` (`includes/elements/slider-nested.php`). Không dùng element `slider`.

Loop bật. Autoplay bắt đầu 3 giây khi plan để trống. Plan tắt được.
