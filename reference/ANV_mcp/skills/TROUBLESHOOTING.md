# Hướng dẫn Xử lý lỗi & Khắc phục (Troubleshooting Guide)

Tài liệu này liệt kê các lỗi thường gặp trong quá trình chuyển đổi từ Figma sang Bricks Builder và cách hệ thống xử lý để đảm bảo chất lượng đầu ra.

> Link đã kiểm tra/sửa lại — 2026-07-14 (`theme-styles.md`/`style-settings.md` không tồn tại, đã trỏ đúng file thật trong `skills/bricks-skills/references/`).

---

## 1. Lỗi Cấu trúc & Layout (Structural Errors)

| Lỗi thường gặp | Nguyên nhân | Hướng giải quyết của AI |
| :--- | :--- | :--- |
| **Cấu trúc lồng nhau quá mức** | Figma có quá nhiều Group/Frame chồng chéo. | Tự động làm phẳng (Flatten) cấu trúc, đưa về chuẩn: `Section > Container > Block > Element`. |
| **Thiếu thẻ Semantic (HTML5)** | Quên thiết lập thẻ `section`, `header`, `footer` hoặc `main`. | Luôn kiểm tra Phase 4: Ép kiểu `tag` trong settings của element root. |
| **Sai lệch Grid/Flex** | Thông số Auto Layout trong Figma không tương thích trực tiếp với CSS Grid/Flex. | Sử dụng `bricks-skills/references/containers-and-layout.md` / `layout-recipes.md` để tái cấu trúc lại logic hiển thị. |

---

## 2. Lỗi Hiển thị & Visual (Visual Errors)

| Lỗi thường gặp | Nguyên nhân | Hướng giải quyết của AI |
| :--- | :--- | :--- |
| **Sai lệch mã màu/Font** | Lấy nhầm mã màu của Layer mask hoặc Font chưa được cài trên Web. | Đối chiếu mã HEX với `bricks-skills/references/theme-styles-and-globals.md`. Sử dụng Font-family chuẩn từ `bricks-skills/references/element-base-controls.md`. |
| **Spacing không nhất quán** | Figma dùng số lẻ (ví dụ: 13.5px) hoặc khoảng cách không đều. | Làm tròn số theo hệ thống (ví dụ: 4px, 8px, 16px) và kiểm tra lại bằng `dump_figma_spacings.py` (đọc số Figma) + `diff_screenshots.py` (so ảnh). |
| **Hiệu ứng không hỗ trợ** | Các hiệu ứng Blur, Gradient phức tạp của Figma không có CSS tương đương. | Chuyển đổi thành CSS Custom hoặc đề xuất xuất (export) element đó thành file ảnh (PNG/SVG). |
| **Border / bo góc “mất” trên WP** | Dùng `_borderRadius` top-level (không tồn tại 1.12.3) thay vì `_border.radius`. | G1 + `validate_g4_preflight.py` FAIL nếu còn key trap. Fix: radius trong `_border.radius`. |
| **`"Chỉ từ"` xuống dòng Chi/từ** | Flex co text không `white-space: nowrap`. | Preflight bắt prefix; typography/cssCustom `nowrap` + `flex-shrink:0` trên prefix/value/unit. |
| **Card mobile co / tràn** | Dùng `_minWidth` (sai) thay `_widthMin`; hoặc thiếu lock width. | G1 FAIL trên `_minWidth`; lock `_width` + `_widthMin`/`_widthMax` (vd. 280px). |
| **G4 false-PASS (≥98% sớm)** | Chỉ so full-page gestalt, bỏ qua zoom CTA/border/giá. | HARD GATE trong `rubric.md`: preflight + checklist Z1–Z5 trước DONE. |

---

## 3. Lỗi Kỹ thuật & Tích hợp (Technical Errors)

| Lỗi thường gặp | Nguyên nhân | Hướng giải quyết của AI |
| :--- | :--- | :--- |
| **Lỗi cú pháp JSON** | Thiếu dấu phẩy, thừa dấu ngoặc trong quá trình tạo file. | **Bắt buộc**: Chạy script `todo/scripts/validate_template_json.py` trước khi thực thi (Gate G1). |
| **Xung đột ID (ID Conflict)** | Bricks yêu cầu ID 6 ký tự duy nhất, đôi khi bị trùng hoặc sai định dạng. | Sử dụng `generate_random_id.py` để tạo ID mới đảm bảo tính duy nhất và đúng định dạng `alphanumeric`. |
| **Lỗi kết nối MCP/Upload** | Website bị chặn hoặc MCP không thể ghi đè dữ liệu. | **Fallback**: Cung cấp file JSON hoàn chỉnh để người dùng có thể Import thủ công qua Bricks Template. |
| **Ảnh hiển thị OK lúc build nhưng VỠ khi người khác xem** | URL Figma cache (`localhost:3845`) chỉ sống trên máy build khi Figma Desktop mở — trình duyệt của khách không bao giờ thấy được. | Chạy `python3 scripts/rehost_assets.py <json> --apply` (chuyển ảnh về WP Media qua bridge `upload_media`) → re-upload JSON. Xem `bricks_rules.md` §11. G1 có cảnh báo gộp nhắc bước này. |

---

## 4. Lỗi Responsive (Mobile/Tablet)

| Lỗi thường gặp | Nguyên nhân | Hướng giải quyết của AI |
| :--- | :--- | :--- |
| **Tràn màn hình (Overflow)** | Element có chiều rộng cố định (Fixed width) lớn hơn chiều rộng màn hình mobile. | Ép kiểu `max-width: 100%` và kiểm tra tại breakpoint 375px. |
| **Thứ tự hiển thị sai** | Trên Desktop là ngang (Row), trên Mobile cần đảo ngược thứ tự (Reverse). | Sử dụng `_direction: column-reverse` dựa trên phân tích logic nội dung. |

---

## 5. Quy trình 3 bước Khắc phục lỗi (Refix Flow)

Khi phát hiện lỗi thông qua **Rubric (G4)** hoặc **Visual Review (G5)**, hệ thống thực hiện:

1.  **Phân tích Delta**: Xác định chính xác "Điểm lệch" (ví dụ: lệch 5px padding).
2.  **Cập nhật Patch**: Không viết lại toàn bộ, chỉ sửa đúng dòng code bị lỗi trong file JSON.
3.  **Xác minh lại (Re-verify)**: Chụp lại ảnh hoặc chạy lại script kiểm tra cho đến khi lỗi biến mất hoàn toàn.

---

## 6. Anti false-PASS (G4)

Session đã gặp: agent báo DONE/≥98% từ full-page, user annotate mới lộ schema + typography.

| Gate | Script / tài liệu | Chặn gì |
| :--- | :--- | :--- |
| G1 | `validate_template_json.py` | `_borderRadius`, `_minWidth`/`_maxWidth`, `_gap` nestable |
| G4 preflight | `validate_g4_preflight.py` | schema + `Chỉ từ` nowrap + evidence PNG + CSS `border-radius` |
| G4 human/agent | `review-skill/rubric.md` HARD GATE | Zoom Z1–Z5; cấm DONE nếu preflight FAIL |

```bash
# từ thư mục todo/
python3 scripts/validate_template_json.py bricks-json/<sec>.json
python3 scripts/validate_g4_preflight.py bricks-json/<sec>.json \
  --template-id <ID> \
  --desktop scratch/g3/<sec>-desktop.png \
  --mobile scratch/g3/<sec>-mobile.png
```

---
*Tài liệu này được lưu tại `skills/TROUBLESHOOTING.md` để AI tham chiếu trong mọi phiên làm việc.*
