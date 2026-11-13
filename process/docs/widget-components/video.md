# video

Có: có

Tên khác: player, play

Nhận: ảnh có một vòng play gần giữa. Vòng đó có thể là nét vector, không cần bo góc trên layer. Ảnh có thể nằm trong mask bên trong.

Không nhận: chưa có URL thì giữ ảnh. Không bịa URL. Autoplay tắt.

Dựng: `process/modules/write-bricks/components/video.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/media.mjs`
Element: `video` (`includes/elements/video.php`). YouTube và Vimeo dùng source đó. URL http khác là file.
