# accordion

Có: có

Tên khác: faq, expand, collapsed

Nhận: từ hai hàng cùng rộng. Mỗi hàng một tiêu đề và có thể một thân. Variant State=Collapsed / Expand tăng độ chắc.

Không nhận: một thẻ không cùng khổ.

Dựng: `process/modules/write-bricks/components/accordion.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/accordion.mjs`
Element: `accordion-nested` (`includes/elements/accordion-nested.php`). Không dùng element `accordion`.

State: Hover thành `:hover` trên từng item. Mở là dấu trừ, đóng là dấu cộng, đổi bằng `.brx-open`. Câu trả lời nhìn thấy trên Figma được điền. Câu của item đóng lấy từ plan, trống thì để trống. Xem [state.md](state.md).
