# semantic

Có: có

Tên khác: ul, ol, li, list

Nhận: khung mà mọi con nhìn thấy là các mục lặp cùng cấu trúc. Tag là `ul`, mỗi mục là `li`. Accordion, tab, menu, slider và form đã nhận thì không biến khung đó thành list.

Dựng: `process/modules/write-bricks/components/semantic.mjs`
Nhận dạng: `process/modules/missing-content/decide/index.mjs`
Element: `block` đổi tag. Không thêm element mới. Link không có URL thì `#`.

## Hợp đồng

- Nhận: a container a developer would write as ul/ol > li, dl > dt/dd, figure > figcaption, article, nav, a (link card)
- Phần: `tag`, `itemTag`, `childTags`, `link`, `itemLink`, `id`, `alts`, `caption`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: tags only; no new element; link without URL = `#`
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
