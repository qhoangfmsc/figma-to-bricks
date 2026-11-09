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
