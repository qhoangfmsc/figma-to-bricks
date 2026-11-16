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

## Nguồn dữ liệu của plugin (query loop + tag): `bind.json`

Module: `process/modules/data-binding/index.mjs`, gọi trong bước 5 (`05-build.mjs`) khi workspace có `bind.json`.

- `provider` chép nguyên danh sách query type và tag mà nguồn công bố (vd `data.bricks` của API). Tag hay query không có trong danh sách thì build dừng.
- `loops`: node Figma lặp theo query (`hasLoop` + `query.objectType`). `drop` là các bản vẽ lặp lại, bị bỏ khỏi template.
- `text`: chữ của node được thay bằng tag **sau** render, để việc nhận dạng (tab, nút) vẫn chạy trên chữ đã vẽ. `runs` giữ từng style run.
- `links` (link kiểu `meta`), `attrs` (thuộc tính tùy chỉnh), `icons` (`<i class="{tag}">`), `hideEmpty` (`_conditions` key `dynamic_data`, `!=` rỗng).
- Mỗi dòng cần `reason`. Tag thiếu vòng lặp cha mà nó cần thì được liệt kê trong warnings.
