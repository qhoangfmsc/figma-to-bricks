# dynamic-data

Có: module riêng, chưa tự nhận

Tên khác: ACF, meta, tag

Khi nào dùng: plan ghi tên field. Chữ vẽ trong Figma không đổi thành tag.

Module: `process/modules/standby/dynamic.mjs`

| Hàm | Tag | Nguồn |
|---|---|---|
| `acfTag(name)` | `{acf_<name>}` | `provider-acf.php` |
| `metaTag(key)` | `{cf_<key>}` | `provider-wp.php` |
| `wooTag(name)` | `{woo_<name>}` | `provider-woo.php` |

Thiếu tên field thì hàm từ chối. 1.12.3 không có tag `{shortcode:}`.
