# NGUYÊN TẮC THIẾT KẾ CHUNG (GENERAL_RULES.MD)

Tài liệu này định nghĩa các nguyên lý thiết kế và cấu trúc DOM tối ưu khi chuyển đổi thiết kế sang web để đảm bảo mã nguồn sạch, dễ bảo trì và chuẩn SEO.

---

## 1. Cấu trúc DOM ngữ nghĩa & Tối giản (Semantic & Flat DOM)
- **Quy tắc cốt lõi**: **Tránh lồng ghép thẻ DOM quá sâu (Avoid excessive nesting)**. Chỉ tạo thẻ HTML khi thực sự cần thiết cho bố cục (flex/grid), căn chỉnh lề (padding) hoặc khoảng cách (gap).
- **Thẻ ngữ nghĩa (Semantic HTML)**:
  - Khối chính của một phần trên trang phải là `<section>`.
  - Không bao giờ lồng một thẻ `<section>` bên trong một thẻ khác (trừ container/block).
  - Sử dụng `<header>` cho phần đầu trang, `<footer>` cho chân trang, và `<main>` cho khu vực nội dung chính.
  - Sử dụng `<article>` hoặc `<section>` cho các thẻ card/item con.
- **Tiêu đề Heading**:
  - Chỉ duy nhất **1 thẻ `<h1>`** trên mỗi trang (thường là tiêu đề chính ở Hero Section).
  - Các cấp tiêu đề con phải giảm dần theo thứ tự logic: `<h2>` -> `<h3>` -> `<h4>`. Không nhảy cóc cấp tiêu đề (ví dụ: `<h2>` nhảy trực tiếp xuống `<h4>`).

## 2. Quy tắc Naming & Labeling
- Mọi Template tạo trên WordPress phải được đặt tên (label) rõ ràng và đồng bộ theo định dạng: `[Tên Trang] - [Tên Section]` (Ví dụ: `Homepage - Hero Section`).
- Các lớp CSS toàn cục (Global Classes) hoặc BEM class phải tuân thủ chuẩn đặt tên nhất quán: `block__element--modifier`.

## 3. Quản lý Tài nguyên Tĩnh (Assets Management) & Quy tắc Hình ảnh
- **Đường dẫn tuyệt đối**: Mọi hình ảnh, SVG, video hoặc icon được nhúng từ Figma phải được chuyển thành URL tuyệt đối ổn định.
- **Không dùng ID trần từ môi trường khác**: Không sử dụng ID ảnh của WordPress Media Library (không kèm `url`) khi import thiết kế qua JSON, vì ID đó không tồn tại hoặc bị đổi số trên website đích. Lúc build luôn dùng tùy chọn ảnh External (URL Figma cache).
- **Vòng đời asset (CHUNG mọi môi trường — không phân biệt site local hay remote)**: build bằng URL Figma cache (`localhost:3845`) → trước khi công bố trang cho khách thật, chạy `rehost_assets.py --apply` để chuyển ảnh về Media Library của CHÍNH site đích (URL/ID lúc này thuộc site đích nên hợp lệ) → re-upload JSON. Xem `bricks_rules.md` §11.
- **Quy tắc bọc Div cho Hình ảnh**: Mọi phần tử hình ảnh (`image`) khi dịch từ Figma sang Bricks bắt buộc phải được bọc bên trong một thẻ `div` hoặc `block` làm wrapper. 
  - Các thuộc tính kích thước như `width`, `height`, hoặc `aspect-ratio` đo từ Figma phải được thiết lập trên thẻ `div` wrapper này. 
  - Phần tử `image` con bên trong sẽ được thiết lập kích thước `width: 100%` và `height: 100%` (hoặc `object-fit: cover`/`object-fit: contain` tùy thuộc nhu cầu layout) để đảm bảo hình ảnh luôn tự động co giãn full 100% khung bọc và không bị méo.

## 4. Xử lý Header, Footer & Menu trong Bản Thiết Kế
- **Loại trừ Header/Footer toàn trang**: Các section đại diện cho Header chính hoặc Footer chính của trang sẽ không được ghi nhận hay tạo dựng trong quy trình build layout nội dung trang.
- **Xác nhận Menu**: Nếu có thiết kế Menu (Navigation Menu) xuất hiện trong các section:
  - AI phải gắn nhãn cảnh báo `[MENU DETECTED]` và hiển thị yêu cầu xác nhận của người dùng trong file kế hoạch.
  - Phải có sự đồng ý phê duyệt từ người dùng mới tiến hành dựng Menu đó; nếu người dùng không phê duyệt, phần Menu đó sẽ bị loại bỏ khỏi danh sách build.

## 5. Quy trình Dựng Layout Từng Section (Section-by-Section Workflow)
- **Bước 1: Khởi tạo Template trên Bricks (Làm 1 lần)**:
  - Dùng `bricks-mcp` tool `create_template` để tạo template trống loại `section` tương ứng.
  - Ghi lại Template ID được trả về để dùng trong các bước tiếp theo.
- **Bước 2: Xây dựng và duyệt từng Section theo Phase-based Workflow** (xem `bricks_rules.md` Rule 12):
  - Đối với từng Section trong danh sách thiết kế (ví dụ: `sec100`, `sec200`,...):
    1. **Phase 1 SKELETON** → validate JSON → screenshot #1
    2. **Phase 2 CONTENT** → validate JSON → screenshot #2
    3. **Phase 3 STYLING** → validate JSON → screenshot #3
    4. **Phase 4 RESPONSIVE** → validate JSON → screenshot #4
    5. **Upload** → dùng `bricks-mcp` tool `set_template_content` với template ID tương ứng.
  - Chỉ khi Section hiện tại đạt tiêu chuẩn hoàn thiện tuyệt đối (G4 >= 98%) mới chuyển sang xây dựng Section tiếp theo.

## 6. Quy tắc dọn dẹp phiên làm việc cũ (Cleanup Rule)
- Khi trường `Dọn dẹp phiên làm việc cũ (Cleanup)` trong file `infor_todo.md` được thiết lập là `Yes`:
  - AI bắt buộc phải tự động dọn dẹp và xóa các tệp tin tạm thời không thuộc core của dự án, bao gồm:
    - Tệp tin JSON biên dịch tạm `todo/plans/ldp_test_page.json`.
    - Toàn bộ hình ảnh tải tạm `.png`, `.svg` trong thư mục `todo/scripts/`.
    - Các script nháp, tệp tin phụ trong thư mục `scratch/` của artifacts.
  - AI phải reset toàn bộ các trường thông tin thiết kế (Figma URL, Title) trong [infor_todo.md](file:///Users/truongduylinh/Documents/Web%20Project/MCP/ANV_mcp/infor_todo.md) về rỗng, chuyển trạng thái về `TODO`, và đặt `Dọn dẹp phiên làm việc cũ (Cleanup)` về `No` để tránh việc AI tự động lấy thông tin cũ chạy lại.
  - Luôn đảm bảo thư mục code sạch sẽ để tránh xung đột trong các lần thực thi tiếp theo.

## 7. Quy tắc TUYỆT ĐỐI khi thực hiện Cleanup

> **Không được tự ý quyết định giữ lại bất kỳ file nào ngoài danh sách cho phép trong `CLEANUP.md`.**

- **CLEANUP.md là quy chuẩn duy nhất**. Khi thực hiện cleanup, AI chỉ được giữ lại các file/thư mục được liệt kê rõ ràng trong `skills/bricks-skills/CLEANUP.md` mục "Bước 3 — GIỮ LẠI".
- **Cấm tự phán xét "file này hữu ích"**: AI không được tự ý giữ lại file vì nghĩ rằng nó "có thể hữu ích sau này", "là reference tốt", hay "đã tốn công tạo ra". Đây là quyết định của user, không phải của AI.
- **Nếu muốn bảo tồn file kiến thức** (ví dụ: guidelines, learnings): phải hỏi user trước, và nếu được đồng ý thì chuyển vào `skills/` hoặc `todo/rules/` TRƯỚC KHI chạy cleanup — không phải giữ lại trong `todo/plans/`.
- **Phải kiểm tra toàn bộ thư mục con**: Khi xóa, không chỉ xóa thư mục chỉ định mà phải `find` toàn bộ để không bỏ sót file trong các subdirectory như `todo/screenshots/`, `rules/screenshots/`, v.v.
- **Báo cáo trung thực**: Sau cleanup chỉ báo cáo những gì thực sự đã xóa và đã giữ — không thêm vào "đã giữ lại vì ..." nếu không có trong CLEANUP.md.

## 8. Quy tắc Phiên Thực Thi Mới (Fresh Execution Session Rule)

> **Mỗi lần user cập nhật thông tin mới vào `infor_todo.md` = phải bắt đầu một phiên thực thi hoàn toàn mới.**

- **Điều kiện kích hoạt**: Khi `infor_todo.md` có thông tin mới (Figma URL mới, Title mới, hoặc Workflow = `Do`) → đây là tín hiệu bắt đầu phiên mới, không phải tiếp tục phiên cũ.
- **File phải được lưu xuống disk trước**: Mọi file JSON, plan, asset phải được user **save** trước khi AI thực thi. Nếu file chưa tồn tại trên disk → **dừng lại, thông báo user save file trước**.
- **Không kế thừa giả định từ phiên cũ**: AI không được dùng thông tin từ session trước (template ID cũ, file JSON cũ, screenshot cũ) trừ khi đọc lại từ file thực tế trên disk.
- **Đọc lại toàn bộ context**: Ở đầu mỗi phiên mới:
  1. Đọc `infor_todo.md` để lấy thông tin nhiệm vụ
  2. Đọc Figma (Desktop + Mobile) để lấy hierarchy mới
  3. Kiểm tra template đã tồn tại chưa (dùng `list_templates`)
  4. Kiểm tra file JSON đã tồn tại trên disk chưa
- **Thứ tự ưu tiên**: `infor_todo.md` → Figma → disk → Bricks builder (không suy đoán)

