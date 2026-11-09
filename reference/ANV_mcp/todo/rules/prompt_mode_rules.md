# QUY TẮC CHẾ ĐỘ PROMPT (PROMPT_MODE_RULES.MD)

Tài liệu này định nghĩa quy trình và tiêu chí nghiệm thu khi **Chế độ thiết kế = `prompt`** trong `infor_todo.md` — tức build trang từ mô tả bằng chữ, KHÔNG có file Figma làm mốc so khớp.

> **Vì sao có file này (2026-09-04)**: trước đó chế độ `prompt` gần như không được document — grep toàn bộ `todo/rules/` + `skills/` không ra dòng nào, nó chỉ được nhắc rải rác 3 chỗ trong `AGENTS.md` (§3, §5). Toàn bộ `figma_rules.md`, `MAPPING-FIGMA-FLOW.md`, `rubric.md` đều viết cho luồng Figma. File này lấp khoảng trống đó.

---

## 1. Khác biệt cốt lõi so với chế độ `figma`

| Gate | Chế độ `figma` | Chế độ `prompt` |
|------|----------------|-----------------|
| G1 `validate_template_json.py` | ✅ | ✅ dùng nguyên |
| G2 `validate_css_compiled.py` | ✅ | ✅ dùng nguyên |
| G2.5 `validate_section_structure.py` | ✅ | ✅ dùng nguyên |
| G3 `screenshot_templates.py` | ✅ | ✅ dùng nguyên |
| **G4 pixel ≥98% (`rubric.md`)** | ✅ mốc = Figma | ❌ **KHÔNG áp dụng** |
| `validate_mobile_overflow.py` | ✅ | ✅ **hard gate** |
| `validate_line_clamp.py` | phụ trợ | ✅ **hard gate** |

**Hệ quả bắt buộc nhớ**: ở chế độ `prompt`, `rubric.md` (thang 100 điểm) **vô nghĩa** — không có ảnh Figma để so. Mọi con số kiểu "98%", "95% similarity" **cấm xuất hiện** trong báo cáo chế độ `prompt`; viết ra là bịa số. `diff_screenshots.py` cũng không dùng được (không có ảnh mốc).

---

## 2. Mốc nghiệm thu = PLAN ĐÃ DUYỆT (quyết định của user, 2026-09-04)

Thay cho Figma, **mốc nghiệm thu là checklist trong `todo/plans/<page>.md` tại thời điểm user duyệt**.

### 2.1 Bẫy phải phòng: agent vừa ra đề vừa chấm bài

Ở chế độ `figma`, mốc so sánh đến từ **bên ngoài** (file Figma do user thiết kế, agent không sửa được). Ở chế độ `prompt`, plan do **chính agent viết** → nếu agent vừa đặt tiêu chí vừa tự chấm thì rất dễ: build lệch → diễn giải lại tiêu chí cho khớp thứ vừa build → tự tuyên bố PASS.

Repo này đã dính đúng lỗi họ hàng với nó — `AGENTS.md` §5b ghi lý do sinh ra `diff_screenshots.py`:

> *"G4 trước đây 100% dựa vào agent tự nhìn ảnh rồi tự chấm điểm — cùng 1 agent vừa build vừa chấm bài mình, không có đối trọng khách quan."*

Ở `prompt` mode mức độ nặng hơn: không chỉ việc **chấm**, mà cả **mốc so sánh** cũng do agent tạo ra.

### 2.2 Bốn quy tắc bịt lỗ hổng (BẮT BUỘC)

**(1) Checklist phải viết ở dạng ĐO ĐƯỢC, không cảm tính.**

| ❌ Cấm viết | ✅ Phải viết |
|---|---|
| "Hero trông cân đối" | "Hero: h1 48px, 1 nút CTA, ảnh phải 50% width" |
| "Grid hiển thị đẹp" | "Grid 3 cột desktop → 1 cột @991px, gap 24px" |
| "Màu đúng brand" | "Nền section `#0B3D2E`, chữ `#FFFFFF`" |

Tiêu chí phải kiểm chứng được đúng/sai bằng cách nhìn số, không diễn giải lệch được lúc chấm.

**(2) Plan đã duyệt là BẤT BIẾN.** Sau khi user gật đầu, agent **KHÔNG được sửa checklist**. Nếu lúc build phát hiện tiêu chí sai hoặc bất khả thi → **DỪNG, hỏi user**, tuyệt đối không tự hạ tiêu chí xuống cho vừa thứ đã làm. Đây là quy tắc quan trọng nhất của file này.

**(3) Báo cáo DONE phải liệt kê TỪNG DÒNG checklist**, không viết chung chung "đạt yêu cầu". Format: dòng nào ✅, dòng nào ❌, dòng lệch thì ghi lệch bao nhiêu px / sai màu nào.

**(4) Hai hard gate kỹ thuật chạy độc lập với plan** — không diễn giải được, không bỏ qua được:
```bash
python3 scripts/validate_mobile_overflow.py --page-id <id> --viewport 390
python3 scripts/validate_line_clamp.py --url "<WP_URL>/?page_id=<id>"
```
FAIL 1 trong 2 → **cấm ghi DONE** (xem `AGENTS.md` §3, `bricks_rules.md` §21/§23).

### 2.3 Giới hạn phải nói thẳng với user

Checklist bắt được **sai lệch đo được**: sai số cột, sai màu, sai spacing, thiếu/thừa element.
Checklist **KHÔNG** bắt được: "trang nhìn xấu", "khoảng trắng chỗ này trông kỳ", nhịp thị giác tổng thể.

→ Thẩm mỹ tổng thể vẫn cần mắt user ở bước review cuối. Khi báo DONE phải nhắc user **xem screenshot**, không duyệt chỉ vì checklist toàn ✅.

---

## 3. Luồng thực thi chế độ `prompt`

```
User dán prompt vào infor_todo.md (mục "THIẾT KẾ KHÔNG DÙNG FIGMA")
        ↓
PLAN — viết todo/plans/<page>.md: chia section, DOM tree, token màu/font/spacing,
       chiến lược mobile, + CHECKLIST NGHIỆM THU đo được (§2.2 quy tắc 1)
        ↓
⏸️  USER DUYỆT PLAN  ← bắt buộc dừng. Từ đây checklist bị KHOÁ (§2.2 quy tắc 2)
        ↓
Tạo page + template rỗng từng section (create_page / create_template)
        ↓
DO — mỗi section: Skeleton → Content → Styling → Responsive
     → G1 → upload (sync_css) → G2 → G2.5 → G3
     → xong section này mới sang section kế
        ↓
Assemble section vào page thật
        ↓
HARD GATE: validate_mobile_overflow.py + validate_line_clamp.py
        ↓
Đối chiếu checklist, báo cáo TỪNG DÒNG ✅/❌ (§2.2 quy tắc 3)
        ↓
DONE — user xem screenshot rồi mới duyệt
```

> **Lưu ý thứ tự**: page được tạo **sớm, ngay sau PLAN** — không phải cuối cùng. Lý do: mỗi section cần một *page tạm* (`{"headerDisabled":true,"footerDisabled":true}`) để screenshot, vì Bricks không preview được template section trực tiếp (`?bricks_template_preview=` không tồn tại — `bricks_rules.md` §14).

---

## 4. Thông tin thiếu trong prompt — HỎI, không tự bịa

Prompt của user thường thiếu thông tin kỹ thuật. Agent **hỏi lại ở bước PLAN**, không tự quyết rồi build:

- Màu chủ đạo / bảng màu
- Font chữ (và font đó đã có trên site chưa)
- `max-width` container
- Nội dung chữ: text thật hay placeholder
- **Ảnh**: chế độ `prompt` KHÔNG có Figma cache (`localhost:3845`) để lấy ảnh
  → hoặc user cung cấp ảnh (upload lên WP Media qua bridge `upload_media`, cần plugin >= 1.3.0)
  → hoặc dùng placeholder, user thay sau — **phải báo trước** để user không bất ngờ khi thấy ảnh xám ở screenshot

Ngoại lệ: các giá trị có default hiển nhiên trong `bricks_rules.md` thì áp default, ghi rõ trong plan là "giả định", không cần hỏi.

---

## 5. MCP Figma không cần thiết ở chế độ này

Chế độ `prompt` **không gọi** `get_design_context` / `get_variable_defs` / `get_metadata`. Figma Desktop không cần mở, MCP server `figma` lỗi kết nối cũng không ảnh hưởng.

Vẫn cần: MCP `bricks-bridge` sống + `get_site_info` đầu phiên (xác nhận version Bricks + bridge >= 1.3.0) theo `AGENTS.md` §2.
