# dynamic-data

Có: module riêng, chưa tự nhận

Tên khác: ACF, meta, tag

Khi nào dùng: plan ghi tên field. Chữ vẽ trong Figma không đổi thành tag.

Module: `process/modules/write-bricks/standby/dynamic.mjs`

| Hàm | Tag | Nguồn |
|---|---|---|
| `acfTag(name)` | `{acf_<name>}` | `provider-acf.php` |
| `metaTag(key)` | `{cf_<key>}` | `provider-wp.php` |
| `wooTag(name)` | `{woo_<name>}` | `provider-woo.php` |

Thiếu tên field thì hàm từ chối. 1.12.3 không có tag `{shortcode:}`.

## Hợp đồng

- Nhận: xem phần mô tả phía trên của file này
- Phần: không có params bắt buộc, trừ khi phần mô tả phía trên nói có
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: theo phần mô tả phía trên của file này
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
