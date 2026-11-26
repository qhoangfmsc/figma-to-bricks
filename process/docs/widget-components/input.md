# input

Có: có

Tên khác: field, ô nhập, placeholder, email, tel, select, textarea, datepicker

Nhận: khung có nền đặc, cao 28–140, rộng từ 120, đúng một dòng chữ placeholder. Icon trong ô không tính là chữ.

Loại ô, đọc từ chữ hoặc tên:

| Dấu | type |
|---|---|
| email | `email` |
| điện thoại, phone, zalo, tel, sđt | `tel` |
| select, dropdown, combo, chọn | `select` |
| radio | `radio` |
| date, ngày sinh, calendar | `datepicker` |
| lời nhắn, nội dung, ghi chú, message, comment, cao hơn 100, hoặc từ hai dòng | `textarea` |
| còn lại | `text` |

Dấu `*` hoặc một text `*` cạnh nhãn thì required. Ô này thuộc [form.md](form.md). Không bịa email người nhận.

Con trỏ của ô chữ và textarea là `text`. Select là `pointer`.

Nhận dạng: `isInputLike` và `fieldType` trong `process/modules/recognize-parts/rules/form.mjs`

## Hợp đồng

- Nhận: khung có nền đặc, cao 28–140, rộng từ 120, đúng một dòng chữ placeholder. Icon trong ô không tính là chữ.
- Phần: không có params bắt buộc, trừ khi phần mô tả phía trên nói có
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: theo phần mô tả phía trên của file này
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
