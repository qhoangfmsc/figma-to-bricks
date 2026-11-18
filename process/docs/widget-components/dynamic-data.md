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
- `show`: lớp bị ẩn trong instance được dựng. Lớp đó lấy màu / viền / ảnh glyph của cùng lớp component đang hiện ở instance khác (lớp ẩn giữ màu mặc định, Figma không xuất ảnh của lớp ẩn).
- `icons` nhận `className` cố định khi glyph ẩn ở mọi bản (không có ảnh). Glyph vẽ bằng chữ icon-font giữ cỡ, màu, line-height, canh lề.
- `text` gắn tag thì bỏ khung px cố định của chữ mẫu (vd "2" trong ô 62 x 30): chữ thật tự định kích thước.
- `twin`: bản vẽ có giao diện riêng (cột nổi bật) cũng lặp theo cùng query, chỉ hiện ở vị trí nó được vẽ (đếm trong các bản vẽ của loop). Bản thường ẩn ở vị trí đó. Thứ tự giữ bằng flex `order`.
- `collapse`: nhóm lặp chỉ hiện `keep` dòng lặp đầu tới khi script gắn `className`. `more` hiện khi đóng, `less` khi mở, cả hai ẩn khi nhóm không còn dòng. `open`: vị trí nhóm vẽ mở (không nút).
- `columns`: cột lặp của một hàng. `share`: co giãn từ bề rộng vẽ cùng các cột khác của hàng. `scroll`: giữ tối thiểu bề rộng vẽ, giãn để lấp hàng.
- `slider`: khung trượt ngang khi hàng rộng hơn khung (cột `scroll`). Hàng rộng theo min-content, ít nhất bằng khung. `pin`: lớp đứng yên ở mép trái với bề rộng khung (`100cqw`).
- Vị trí trong loop viết bằng chuỗi `~` (`.a ~ .a ~ .a`), không dùng `:nth-child(n of S)`: LiteSpeed nén `3 of` thành `3of` và trình duyệt bỏ cả rule.

## Nhiều section trong một template: `into.json`

`process/modules/write-bricks/template-group.mjs`. Section được bổ sung vào template đã có ghi `into.json` trong workspace của nó: `{ "host": "<fileKey>/<node-id>", "order": 1, "reason": "..." }`. Mỗi section vẫn build và verify riêng. Push của bất kỳ section nào đẩy cả nhóm vào template của host: phần tử của host trước, rồi từng section theo `order`. Id phần tử trùng thì push dừng.
- `twin.index` (từ 0): owner chọn vị trí nổi bật khác vị trí vẽ.
- `icons.paintFrom`: màu glyph lấy từ bản vẽ khác khi khung này giữ màu mặc định của component.
- `hoverShow`: lớp HUG trong Figma co theo chữ nguồn. `flipUp: <row loop>` mở lên trên ở dòng cuối (và dòng cuối nhóm đang thu gọn). `copy: true` chép lớp vẽ ở khung khác vào cạnh trigger (dưới ô cha, ở padding trái). Trigger căn giữa hàng thì vị trí tính từ giữa ô. Khi hiện, ô chứa nâng `z-index: 2`.
- Viền gradient (`render/utils/stroke.mjs`): một hoặc vài cạnh, cả đứt nét theo một chiều, vẽ bằng `::before` + mask.
