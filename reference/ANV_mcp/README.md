# ANV_mcp

Hệ thống tự động chuyển thiết kế **Figma → Bricks Builder (WordPress)** bằng AI agent (Claude Code), qua MCP (Model Context Protocol). Đọc thiết kế trực tiếp từ Figma (hoặc từ mô tả prompt), build JSON đúng schema Bricks, upload qua bridge plugin, và tự chấm điểm đối chiếu pixel trước khi báo hoàn thành.

## Cách hoạt động

1. Điền yêu cầu (link Figma node hoặc mô tả prompt) vào [`infor_todo.md`](infor_todo.md), đặt `Quy trình yêu cầu thực thi: Do`.
2. Agent đọc [`AGENTS.md`](AGENTS.md) — bản đồ hệ thống, luồng **PLAN → DO → DONE**:
   - **PLAN**: quét Figma, viết plan chi tiết vào `todo/plans/`.
   - **DO**: build từng section theo 4 phase (Skeleton → Content → Styling → Responsive), qua các gate G1 (JSON hợp lệ) → G2 (CSS compiled) → G2.5 (cấu trúc) → G3 (screenshot) → G4 (đối chiếu Figma theo rubric ≥98%) → hard gate mobile overflow.
   - **DONE**: cập nhật `infor_todo.md` với kết quả, chờ review.
3. Kết thúc phiên, chạy cleanup ([`skills/bricks-skills/CLEANUP.md`](skills/bricks-skills/CLEANUP.md)) để xoá output tạm và reset trạng thái cho phiên sau.

## Cấu trúc thư mục

```
AGENTS.md                  Bản đồ hệ thống — đọc đầu tiên mỗi phiên
infor_todo.md               Entry point: nơi điền yêu cầu + trạng thái phiên hiện tại
skills/
  bricks-skills/            Quy tắc element/control Bricks, pattern JSON mẫu, rubric G4, cleanup
  figma-skills/              Quy tắc đọc & ánh xạ Figma Auto Layout → CSS/Bricks
  figma-bricks/schema/       Schema IR lịch sử (Flow 1B, đã deprecated — giữ tham khảo)
todo/
  rules/                    Quy tắc bắt buộc: general_rules.md, bricks_rules.md, figma_rules.md,
                            prompt_mode_rules.md (chế độ prompt — mốc nghiệm thu thay G4)
  scripts/                  Công cụ Python: validate G1-G4, screenshot, diff, rehost asset...
  plans/ bricks-json/ assets/ scratch/   Output phiên làm việc (gitignored, xoá bởi cleanup)
plugins/bricks-mcp-bridge/   WordPress plugin bridge (MCP server phía site đích)
image/                      Ảnh đính kèm ghi chú trong infor_todo.md
```

## Yêu cầu

- WordPress + [Bricks Builder](https://bricksbuilder.io/) đã cài, plugin `plugins/bricks-mcp-bridge` **Active** (>= 1.3.0 để có tool `upload_media`).
- Figma Desktop mở trên máy build (ảnh export phục vụ qua `localhost:3845`).
- Python 3 + Playwright (`.venv/`) cho các script screenshot/validate.
- Claude Code (hoặc client MCP tương thích) với MCP server Figma + bricks-bridge cấu hình trong `.mcp.json`.

## Cài đặt

```bash
cp .env.example .env      # điền WP_URL, WP_USER, WP_PASS, BRICKS_MCP_TOKEN, FIGMA_ACCESS_TOKEN
python3 -m venv .venv && .venv/bin/pip install playwright pillow
.venv/bin/playwright install chromium
```

Cấu hình `.mcp.json` (không commit — xem `.gitignore`) trỏ tới MCP server Figma và bridge WordPress, dùng token lấy tại **WP Admin → Bricks MCP Bridge**.

## Lưu ý bảo mật

`.env`, `.mcp.json`, `.claude/settings.local.json` chứa secret (token, mật khẩu WP) — đã nằm trong `.gitignore`, **không commit**. Dùng `.env.example` làm mẫu tham khảo.

## Tài liệu chi tiết

Xem [`AGENTS.md`](AGENTS.md) mục 1 để biết nên đọc file nào trước khi bắt đầu — đây là điểm khởi đầu bắt buộc cho mọi phiên làm việc.
