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
