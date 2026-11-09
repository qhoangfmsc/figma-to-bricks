# CLEANUP.md — Quy Trình Dọn Dẹp Phiên Làm Việc

> Đọc file này khi `infor_todo.md` có **Dọn dẹp phiên làm việc cũ (Cleanup): yes**

---

## 🔍 Bước 1 — Kiểm tra điều kiện

Đọc `infor_todo.md`. Nếu:
- `Dọn dẹp phiên làm việc cũ (Cleanup): yes` → **Thực hiện cleanup bên dưới**
- `Dọn dẹp phiên làm việc cũ (Cleanup): no` → **Bỏ qua, không làm gì**

---

## 🗑️ Bước 2 — XÓA các file output của phiên cũ

Những file này gắn với nội dung phiên thực thi cụ thể, **không có giá trị tái dùng**:

### `todo/plans/` — Xóa toàn bộ output phiên:
- `*.png` — ảnh chụp màn hình (page_desktop.png, page_mobile.png, ...)
- `*.json` — file mapping/output (assets_mapping.json, template_mapping.json, ldp_test_page.json, ...)
- `*.txt` — dữ liệu dump phiên (figma_spacings.txt, ...)
- `*.md` — plan/report phiên cụ thể (template-for-ldp.md, test-ldp.md, ...)

### `todo/bricks-json/` — Xóa toàn bộ:
- `*.json` — JSON Bricks output của phiên (sec100-service-list.json, ...)

### `todo/scripts/` — Xóa script phụ thuộc phiên:
- `build_*.py` — script build layout (ví dụ: build_ldp_layout.py, build_homepage.py, build_cuahang.py, build_sanpham.py, build_chitietsanpham.py — hardcode nội dung/copy của 1 phiên cụ thể)
- `upload_*.py` — script upload gắn nội dung phiên cụ thể (upload_assets.py, upload_template.py, upload_single_section.py) — **ngoại lệ: `upload_section.py` không xóa, xem Bước 3**
- `setup_*.py` — script setup trang (setup_page_with_templates.py)
- `section_*.py` — script autofix section (section_autofix_loop.py)
- `sanitize_*.py` — script xử lý JSON tạm (sanitize_json_ids.py)
- `validate_plan_g0.py` — validate plan phiên cụ thể

### `scratch/` — Xóa toàn bộ file tạm:
- Tất cả file trong `scratch/` (gồm cả `todo/scratch/` nếu có)

### `todo/assets/` — Xóa toàn bộ:
- Asset tải tạm của phiên (ảnh export, file trung gian)

---

## ✅ Bước 3 — GIỮ LẠI các công cụ vận hành chung

Những file này là **công cụ tái dùng qua nhiều phiên**, không xóa:

### `todo/scripts/` — Giữ công cụ chung:
- `capture_screenshot_logged_in.py` — công cụ chụp ảnh có đăng nhập (bản không-đăng-nhập `capture_screenshot.py` đã xoá 2026-07-14 vì trùng chức năng, site luôn cần login cho page/template draft)
- `dump_figma_spacings.py` — công cụ dump spacing từ Figma
- `inspect_figma_children.py` — công cụ inspect Figma
- `inspect_figma_nodes.py` — công cụ inspect Figma nodes
- `validate_css_compiled.py` — validator CSS chung
- `validate_template_json.py` — validator template JSON (Gate G1)
- `validate_section_structure.py` — validator cấu trúc section (Gate G2.5)
- `validate_g4_preflight.py` — hard gate chống false-PASS G4 (schema traps, nowrap, evidence) — xem `bricks_rules.md` §10, `review-skill/rubric.md`
- `capture_zoom_evidence.py` — chụp crop-screenshot per-element (`#brxe-{id}`) làm bằng chứng zoom-compare Z1-Z5, bắt buộc cho `validate_g4_preflight.py --zoom-dir`
- `diff_screenshots.py` — diff pixel Figma vs WP + heatmap, tín hiệu khách quan bổ trợ G4 (2026-07-20, xem `AGENTS.md` §5b)
- `generate_random_id.py` — sinh Bricks element ID ngẫu nhiên
- `screenshot_templates.py` — chụp ảnh templates
- `review_gates.py` — chạy tổng hợp tất cả gates
- `validate_mobile_overflow.py` — (2026-07-22) hard gate đo `scrollWidth` thật trên page đã assemble, dùng chung mọi phiên (`--page-id` truyền vào, không hardcode nội dung phiên) — xem `bricks_rules.md` §21/§23, `AGENTS.md` §3/§5
- `upload_section.py` — (2026-07-22, giữ theo yêu cầu user) CLI mỏng đọc `<json_file>` trên đĩa rồi gọi `set_template_content(<template_id>, ...)` — không hardcode nội dung phiên, dùng để upload section lớn mà không phải dán JSON qua chat. Khác với các `upload_*.py` khác trong danh sách xóa (những cái đó hardcode asset/template ID của 1 phiên cụ thể)
- `rehost_assets.py` — (2026-07-23) chuyển ảnh Figma cache → WP Media qua bridge `upload_media`, bước bắt buộc trước công bố (xem `bricks_rules.md` §11)
- `validate_line_clamp.py` — check cắt chữ/line-clamp trên page thật (nhận `--url`, không hardcode phiên)
- `check_docs_links.py` — (2026-07-23) quét tài liệu tìm tham chiếu file gãy — chạy ở Bước 5 bên dưới
- `smoke_test_scripts.py` — (2026-07-23) kiểm tra mọi script còn chạy được (`--help` không Traceback) — chạy ở Bước 5 bên dưới
- `lib/bricks_mcp.py` — Python client cho bricks-mcp (core library)
- `lib/brix.py` — (2026-07-22, dọn tokens 2026-07-23) helper Python dựng element tree Bricks dùng chung cho pipeline `prompt`-mode — token/màu/font của phiên truyền vào qua `root_vars_css()`/`google_fonts_links_html()`, tuyệt đối không hardcode vào lib — xem `AGENTS.md` §5

### Luôn giữ nguyên (không bao giờ xóa):
- `todo/rules/` — toàn bộ rule files
- `skills/` — toàn bộ skill files (bao gồm file này)
- `plugins/` — toàn bộ plugin files
- `.env` / `.env.example` — cấu hình môi trường

---

## 🔄 Bước 4 — Reset infor_todo.md

Sau khi xóa xong, cập nhật `infor_todo.md` về trạng thái mặc định:

```markdown
- **Chế độ thiết kế**: figma           ← reset về figma (mặc định)
- **Figma Desktop Node URL**:          ← xóa URL cũ, để trống
- **Figma Mobile Node URL**:           ← xóa URL cũ, để trống
- **Tên trang / Template (Title)**:    ← xóa tên cũ, để trống
- **Loại nội dung**: page              ← giữ nguyên
- (mục "✍️ THIẾT KẾ KHÔNG DÙNG FIGMA (Prompt-based)") ← xóa nội dung đã dán trong khối ``` ```, trả về rỗng
- **Quy trình yêu cầu thực thi**: `Wait`   ← reset về Wait
- **Trạng thái công việc hiện tại**: `Ready` ← reset về Ready
- **Dọn dẹp phiên làm việc cũ (Cleanup)**: no  ← reset về no
```

---

## ✅ Bước 5 — Kiểm tra sau dọn dẹp (bắt buộc, 2026-07-23)

Chạy 2 lệnh sau (từ thư mục `todo/`) để chắc chắn việc xóa không làm gãy công cụ/tài liệu còn lại — đây chính là loại lỗi từng tích tụ nhiều lần (tài liệu trỏ file đã xóa, script import file đã dọn):

```bash
python3 scripts/smoke_test_scripts.py   # mọi script còn chạy được
python3 scripts/check_docs_links.py     # tài liệu không trỏ file đã xóa
```

Nếu FAIL → sửa tài liệu/script tương ứng NGAY trong lượt cleanup, không để lại cho phiên sau.

---

## ⚠️ Lưu ý

- Không xóa file nào trong `skills/` hoặc `todo/rules/` — đây là kiến thức hệ thống
- **Nếu không chắc file có thuộc phiên cũ không → Hỏi user** (không tự ý giữ lại, xem `general_rules.md` Rule 7)
- Sau cleanup, báo cáo trung thực danh sách file đã xóa và đã giữ lại
