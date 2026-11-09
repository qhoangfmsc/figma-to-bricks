# AGENTS.md — Bản đồ hệ thống ANV_mcp

> Hệ thống tự động chuyển **Figma → Bricks Builder** (WordPress). Phiên bản Bricks: **đọc từ `get_site_info` ở đầu phiên** — đừng tin số ghi cứng trong tài liệu.
> ℹ️ **2026-10-12 — Site đích hiện tại (theo `.env`) chạy Bricks 1.12.3** (production, đã xác nhận bằng `get_site_info`) — đúng phiên bản gốc của bộ rules. Ghi chú 2.x bên dưới chỉ áp dụng nếu site đích lên lại 2.x.
> ✅ **2026-07-23 — (site cũ) Bricks 2.3.9, re-verify chính đã XONG** (`bricks_rules.md` §0): mọi trap then chốt (`_gap`, `_borderRadius`, `_minWidth`, `_color`, `objectFit`, `%root%`, default width container/block) hành xử **y hệt 1.12.3** — bộ rules hiện hành dùng nguyên trạng. Khác biệt 2.x duy nhất đã ghi nhận: CSS Bricks nằm trong `@layer bricks` (xem §0 mục 0g). Vẫn sinh JSON shape 1.x; KHÔNG dùng key 2.x-only (`slots`, `styleVariants`) cho tới khi có rule verified.
> Đây là điểm khởi đầu cho mọi phiên làm việc. Đọc file này trước, rồi mở tài liệu chi tiết theo bảng bên dưới.

---

## 1. Đọc gì trước khi làm

| Cần biết | Đọc file |
|----------|----------|
| Nhiệm vụ phiên hiện tại (Figma URL, Title, trạng thái) | `infor_todo.md` ← **entry point** |
| Luồng thực thi tổng quát G1→G4 | Mục 3 + 5 bên dưới (file `autonomous_workflow.md` cũ đã gộp vào đây 2026-07-14) |
| Pipeline PLAN→DO→DONE + bản đồ tài liệu (SPEC/Flow 1B đã deprecated, xem mục 5 dưới) | `skills/bricks-skills/MAPPING-FIGMA-FLOW.md` |
| Quy tắc thiết kế chung (DOM, naming, cleanup, session) | `todo/rules/general_rules.md` |
| Shape JSON Bricks 1.12.3 + phase-based build + scripts | `todo/rules/bricks_rules.md` |
| Ánh xạ Figma Auto Layout → CSS/Bricks | `todo/rules/figma_rules.md` |
| **Chế độ `prompt`** (không có Figma): mốc nghiệm thu, gate thay G4 | `todo/rules/prompt_mode_rules.md` |
| Đọc Figma qua MCP (scan→zoom→build) | `skills/figma-skills/SKILL.md` |
| Element/control keys Bricks (chống hallucination) | `skills/bricks-skills/SKILL.md` + `references/` |
| Chấm điểm review G4 (rubric ≥98đ) | `skills/bricks-skills/review-skill/rubric.md` |
| Schema IR spec (lịch sử — Flow 1B deprecated, không dùng) | `skills/figma-bricks/schema/layout-spec.schema.json` |
| Xử lý lỗi thường gặp | `skills/TROUBLESHOOTING.md` |

> ⚠️ Các file `skills/**/SKILL.md` và `CLAUDE.md` là định dạng Claude Code — **Cursor không tự nạp**. Phải chủ động đọc.

---

## 2. Quy tắc vàng (BẮT BUỘC)

- **Phiên bản Bricks**: xác nhận bằng `get_site_info` đầu phiên (hiện tại: **1.12.3** — 2026-10-12; trước đó từng chạy 2.3.9, đã re-verify — `bricks_rules.md` §0). Sinh JSON theo shape 1.x (nếu site lên 2.x thì vẫn tương thích ngược, mọi trap đã probe giữ nguyên); **chưa dùng** key 2.x-only (`slots`, `styleVariants`, utility classes của Style Manager) vì chưa có rule verified cho chúng. Style bị đè "vô cớ" trên 2.x → nghi `@layer` trước (CSS Bricks nằm trong `@layer bricks`, CSS unlayered ngoài Bricks luôn thắng — §0 mục 0g).
- **Element ID** đúng regex `^[a-z0-9]{6}$`, duy nhất; `parent`/`children` ràng buộc 2 chiều.
- **Đơn vị `px`** là chủ đạo (giữ nguyên từ Figma); tỷ lệ dùng `%`. Giá trị luôn là chuỗi kèm đơn vị.
- **Ảnh (quy tắc CHUNG mọi môi trường — không phân biệt site local hay remote)**: lúc build dùng URL external Figma cache (`localhost:3845/assets/...`) — KHÔNG dùng WP media ID trần (id không có url không resolve khi ghi JSON trực tiếp). URL Figma cache chỉ sống trên máy build khi Figma Desktop mở, nên **trước khi công bố trang cho khách thật** phải chạy `rehost_assets.py --apply` (chuyển ảnh về WP Media qua bridge `upload_media`) rồi re-upload JSON — G1 sẽ nhắc bằng cảnh báo gộp khi còn URL Figma cache.
- **DOM phẳng & ngữ nghĩa**: `section > container > block/element`; 1 `<h1>`/trang; không lồng `section`.
- **Header/Footer toàn trang**: bỏ qua khi build nội dung. Menu → cần user phê duyệt (`[MENU DETECTED]`).
- **Global Classes** cho style lặp lại; chỉ dùng CSS variable đã tồn tại trên site.
- **Sửa lệch ở G4**: sửa **trực tiếp** `bricks-json/<sec>.json` theo delta rồi re-upload (Flow 1B/`spec.json` đã deprecated — không còn tầng mapper trung gian, xem mục 5).
- **`sync_css=True`** sau mỗi upload (site dùng External CSS files).

---

## 3. Luồng thực thi

```
PLAN ──⏸️user xác nhận──▶ DO (từng section, 4 phase) ──▶ DONE
```

- **PLAN**: đọc `infor_todo.md` → quét Figma (`get_metadata`) → viết `todo/plans/<page>.md` → tạo page & template.
- **DO** (mỗi section): trước khi build, đọc sâu Figma section bằng `get_design_context` + `get_variable_defs` (ghi số liệu thẳng vào plan/JSON — **không** qua bước `spec.json` trung gian, xem mục 5); build theo 4 phase **Skeleton → Content → Styling → Responsive**, qua các gate:
  - **G1** `validate_template_json.py` → **Upload** `set_template_content` (sync_css) → **G2** `validate_css_compiled.py`
  - **G2.5** `validate_section_structure.py` → **G3** `screenshot_templates.py` → **G4** so Figma theo `rubric.md` (≥98%)
  - **G4 PREFLIGHT** `validate_g4_preflight.py` (schema trap + evidence D+M) **PASS trước** khi tuyên bố ≥98% — full-page gestalt **không đủ**; bắt buộc zoom-checklist trong `rubric.md` (HARD GATE). Khuyến nghị chạy `diff_screenshots.py` trước và truyền `--diff-report-*` vào preflight (§5b) — tín hiệu khách quan bổ trợ, không thay rubric.
  - Diff bắt buộc ở Phase 3 (desktop) và Phase 4 (mobile).
  - **Sau khi assemble page thật** (không phải từng section riêng): chạy `validate_mobile_overflow.py --page-id <id> --viewport 390` — đo `scrollWidth` thật, **không** chỉ xem screenshot bằng mắt (bài học sự cố 2026-07-22, xem `bricks_rules.md` §21/§23). Áp dụng cho cả chế độ `figma` lẫn `prompt` (chế độ `prompt` không có G4 pixel-diff nên đây là gate mobile khách quan duy nhất).
- **DONE**: chụp full-page, báo cáo %, cập nhật `infor_todo.md` — **cấm** viết DONE nếu G4 preflight FAIL (chế độ `figma`) hoặc nếu `validate_mobile_overflow.py` FAIL (mọi chế độ).
- **Chế độ `prompt`**: G4/rubric/diff **không áp dụng** (không có mốc Figma) — mốc nghiệm thu là **checklist trong plan đã được user duyệt**, khoá bất biến sau khi duyệt. Đọc `todo/rules/prompt_mode_rules.md` trước khi PLAN; cấm viết số kiểu "98%"/"similarity" ở chế độ này.
- **Trước khi công bố/bàn giao trang cho khách thật** (sau DONE): `rehost_assets.py --apply` cho mọi JSON còn URL Figma cache → re-upload JSON → screenshot xác nhận lại. Bước này áp dụng chung mọi môi trường (URL `localhost:3845` không sống ngoài máy build).

---

## 4. Kết nối & cấu hình

- **Site đích đọc duy nhất từ `.env` (`WP_URL`)** — hệ thống KHÔNG phân biệt local hay remote: đổi site chỉ cần đổi `.env` (+ `.mcp.json` cho MCP client), mọi script/gate tự theo. Không hardcode URL site trong script/tài liệu.
- **`.env`** (đã cấu hình): `WP_URL`, `WP_USER`, `WP_PASS`, `BRICKS_MCP_URL`, `BRICKS_MCP_TOKEN`, `FIGMA_ACCESS_TOKEN`, `FIGMA_FILE_KEY` (optional cho script inspect/dump).
  Site có lớp bảo vệ trước form login (vd. Basic Auth openresty + slug login ẩn): thêm `WP_FIREWALL` (URL trang login, thay `/wp-login.php`), `WP_FIREWALL_USER`, `WP_FIREWALL_PASS` (HTTP Basic Auth). Mọi script Playwright đăng nhập qua `todo/scripts/lib/wp_login.py` (tự đọc 3 biến này, bỏ trống = login thường; báo lỗi nếu không có cookie `wordpress_logged_in_*`).
- **bricks-mcp**: WordPress plugin `plugins/bricks-mcp-bridge/` (phải Active, **>= 1.3.0** để có tool `upload_media` cho re-host). Client Python: `todo/scripts/lib/bricks_mcp.py`. Token đổi được tại WP Admin → Bricks MCP Bridge (nút regenerate) — sau khi đổi phải cập nhật `.env` + `.mcp.json`.
- **Figma MCP**: cần Figma Desktop mở **trên máy build** (ảnh export serve tại `localhost:3845` — chỉ máy build thấy được, vì vậy có bước re-host ở mục 3).
- **Screenshot**: Playwright (trong `.venv`) — headless Chromium, tự login WP theo `WP_URL`/`WP_USER`/`WP_PASS`.
- **Chạy script từ thư mục `todo/`** (không phải gốc project).

---

## 5. Công cụ hiện có (`todo/scripts/`)

`validate_template_json.py` (G1, gồm rule ảnh phải có `url` + cảnh báo gộp nhắc re-host) · `validate_css_compiled.py` (G2) · `validate_section_structure.py` (G2.5)
`validate_g4_preflight.py` (G4 anti false-PASS, `--site` mặc định đọc `WP_URL` từ `.env`) · `capture_zoom_evidence.py` (crop evidence Z1-Z5, bắt buộc trước G4)
`diff_screenshots.py` (2026-07-20, tín hiệu diff khách quan bổ trợ G4 — % pixel lệch + heatmap, không hard-block, xem §5b)
`review_gates.py` (chạy gộp G1+G2+G2.5; G2 cần `--template-id` hoặc entry trong `template_mapping.json`) · `screenshot_templates.py` (bắt buộc có `url` page tạm trong mapping — không có fallback preview) · `capture_screenshot_logged_in.py`
`validate_mobile_overflow.py` (2026-07-22, đo `scrollWidth` thật trên page đã assemble — hard gate trước DONE, xem mục 3 + `bricks_rules.md` §21/§23)
`validate_line_clamp.py` (check cắt chữ/line-clamp trên page thật — dùng nhiều ở chế độ `prompt`)
`rehost_assets.py` (2026-07-23, chuyển ảnh Figma cache → WP Media qua bridge `upload_media` — bước bắt buộc trước khi công bố, xem mục 2/3)
`inspect_figma_nodes.py` · `inspect_figma_children.py` · `dump_figma_spacings.py` (cả 3 nhận `--file-key`/`--node` qua CLI hoặc `FIGMA_FILE_KEY` trong `.env` — không còn hardcode phiên cũ)
`check_docs_links.py` (quét tài liệu tìm tham chiếu file gãy — chạy sau mỗi lần dọn/đổi tên) · `smoke_test_scripts.py` (mọi script chạy được `--help` không Traceback)
`generate_random_id.py` · `lib/bricks_mcp.py` · `lib/wp_login.py` (đăng nhập WP dùng chung cho script Playwright, hỗ trợ `WP_FIREWALL*`) · `lib/brix.py` (2026-07-22, helper Python dựng element tree cho pipeline `prompt`-mode — token/màu/font truyền vào từ build script của phiên, xem `upload_section.py` làm ví dụ upload)

> **2026-07-14**: `validate_json.py`, `validate_structure.py`, `capture_screenshot.py` đã bị xoá — là bản nháp sớm hơn, trùng chức năng với `validate_template_json.py`/`validate_section_structure.py`/`capture_screenshot_logged_in.py` (bản sau đầy đủ hơn: có `--strict`, biết đọc plan file, có login WP). Nếu thấy tài liệu cũ nào còn nhắc 3 tên này, đó là tham chiếu lỗi thời.

### 5b. `diff_screenshots.py` — tín hiệu diff khách quan cho G4 (mới, 2026-07-20)

**Vì sao có**: G4 trước đây 100% dựa vào agent tự nhìn ảnh rồi tự chấm điểm — cùng 1 agent vừa build vừa chấm bài mình, không có đối trọng khách quan. Script này KHÔNG thay `rubric.md`/agent review (không hiểu ngữ nghĩa — nội dung thật khác placeholder vẫn ra diff cao mà không phải lỗi), chỉ cộng thêm 1 con số đo được (% pixel lệch + heatmap khoanh vùng + top vùng lệch nhiều nhất) để agent tự đối chiếu trước khi tuyên bố ≥98%. **Không hard-block** — luôn exit 0, chỉ in cảnh báo.

```bash
python3 scripts/diff_screenshots.py --figma scratch/g3/figma-<sec>-desktop.png \
    --wp scratch/g3/<sec>-desktop.png --out-dir scratch/g3/diff --label <sec>-desktop
# → scratch/g3/diff/<sec>-desktop-report.json (đọc bởi validate_g4_preflight.py --diff-report-desktop)
#   scratch/g3/diff/<sec>-desktop-heatmap.png (ảnh WP với vùng lệch tô đỏ)
```

Gắn vào `validate_g4_preflight.py` qua `--diff-report-desktop`/`--diff-report-mobile` (optional) — nếu similarity < 90% (`--diff-warn-below`), preflight in cảnh báo kèm toạ độ vùng lệch nhiều nhất, buộc agent tự kiểm tra trước khi chấm rubric.

### ⚠️ Flow 1B (SPEC-driven) — ĐÃ NGƯNG, không phải "chờ viết"

**Quyết định 2026-07-20**: Flow 1B (Figma → `spec.json` IR → `validate_spec.py` → `spec_to_elements.py` → auto-generate JSON) từng được tài liệu hoá như một quy trình đang hoạt động, nhưng đánh giá lại cho thấy **không đáng xây**: bottleneck thật của quy trình là review G4 bằng mắt (≥98%), không phải bước viết JSON; xây một compiler spec→JSON đúng hết mọi rule Bricks tốn công ngang việc AI đọc trực tiếp `bricks_rules.md`/`elements-catalog.md` và viết JSON như Flow trực tiếp đang làm — mà lại thêm một tầng code phải bảo trì song song mỗi khi rule Bricks đổi. Dự án hiện tại (single-operator, theo phiên) chưa có khối lượng công việc biện minh cho khoản đầu tư này.

**Kết luận**: dùng **Flow trực tiếp** (mô tả bên dưới) làm chuẩn duy nhất. `validate_spec.py`, `spec_to_elements.py` sẽ **không được viết** — nếu thấy tài liệu nào khác còn mô tả Flow 1B như đang chạy (`skills/bricks-skills/MAPPING-FIGMA-FLOW.md`, `todo/rules/bricks_rules.md` §10), đó là phần đã dọn/đánh dấu deprecated, không phải việc cần làm. Schema IR (`skills/figma-bricks/schema/`) giữ lại làm tài liệu lịch sử, không còn là bước bắt buộc.

Các script glue khác từng được nhắc (`setup_page_with_templates.py`, `upload_assets.py`, `check_assets.py`, `validate_plan_g0.py`, `section_autofix_loop.py`, `sanitize_json_ids.py`, `upload_single_section.py`) — **cố ý không xây**: việc chúng thay thế (tạo page/template qua MCP tool trực tiếp, upload ảnh thủ công, auto-fix loop do agent tự làm trong phiên) đã đủ tốt và rẻ hơn viết + bảo trì script riêng.

G4 tự động chấm điểm/`visual_critic.py` cũng cố ý không xây — vai trò chống false-PASS của nó **đã được thay thế** bởi `validate_g4_preflight.py` + `capture_zoom_evidence.py` + review thủ công theo `rubric.md` HARD GATE — đây là cơ chế G4 chính thức hiện tại, không phải một khoảng trống.

Luồng khả thi hiện tại: tự sinh JSON Bricks (theo `bricks_rules.md` + schema) → `validate_template_json.py` (G1) →
upload qua bricks-mcp `set_template_content` → tạo **page tạm** (`page_settings_json: {"headerDisabled":true,"footerDisabled":true}`) rồi `capture_screenshot_logged_in.py --url "<WP_URL>/?page_id=<ID>"` (G3) — **KHÔNG dùng** `?bricks_template_preview=<ID>` cho section template, query var này không tồn tại/không hoạt động (xem `bricks_rules.md` §14) →
`capture_zoom_evidence.py` (Z1-Z5) → `validate_g4_preflight.py --zoom-dir ...` + review G4 theo `rubric.md` HARD GATE. Tạo template thủ công qua MCP (`setup_page_with_templates.py` không tồn tại — cố ý không viết).

---

## 6. Cleanup

Khi `infor_todo.md` có `Cleanup: yes` → thực hiện theo `skills/bricks-skills/CLEANUP.md`:
chỉ xóa output phiên (`todo/plans/*`, `todo/bricks-json/*`, `scratch/*`, script phụ thuộc phiên);
giữ nguyên `todo/rules/`, `skills/`, `plugins/`, công cụ chung; sau đó reset `infor_todo.md`.
KHÔNG tự ý giữ lại file ngoài danh sách cho phép trong `CLEANUP.md`.
