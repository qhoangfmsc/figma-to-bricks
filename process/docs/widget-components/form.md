# form

Có: có

Tên khác: form, submit, gửi

Nhận: từ hai [input](input.md) và một nút gửi. Một ô cũng đủ khi khung là lớp phủ mờ hoặc có nút đóng. Nút gửi cao 32–72, một nhãn, tối đa một icon, nhãn và icon không bị kéo hai đầu. Hàng [checkbox](checkbox.md) / consent giữa các ô thành field checkbox.

Không nhận: một thẻ chỉ toàn [switch](switch.md). Ô nút gửi không bị đếm là input.

Dựng: `process/modules/write-bricks/components/form.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/form.mjs`
Element: `form` (`includes/elements/form.php`)

Submit lưu entry (`save-submission`). Tên form lấy từ file Figma, section và khung. Không bịa người nhận email. Không lấy webhook, create-post, multi-step.

`Tìm` cạnh một ô là [search](search.md), trừ ô tên miền.

Popup có hai kiểu. Có switch hoặc ô nhập, và một nút `Lưu` / `Save`: đó là form action. Nút đó là submit, lưu submission. Popup không có ô, chỉ đóng hoặc xác nhận rồi tắt: các nút chỉ đóng, không phải form.

## Hợp đồng

- Nhận: container with labeled input frames + a submit button frame, listed by the AI pass / owner in `params.fields` + `params.submit` (with citations)
- Phần: `fields` [{ node, type, label, placeholder, required, labelNode, error, errorNode, options }], `errorStyle`, `submit`, `actions`, `formName`, `settings`
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: Form name is the Figma file, the section and the form frame. Save submission stays hidden until Bricks → Settings → General → Save form submissions in database is on. No email recipient is invented. A field error is kept only when the designer drew `Error message / X`. A select lists the lines that were drawn or passed in `options`. The same fields are copied onto a breakpoint that has the form
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
