# Figma → Bricks
Một frame Figma thành một template Bricks 1.12.3. Một lúc một site. Trỏ `.env` vào site đó rồi làm. Người làm tự chịu trách nhiệm trên site mình trỏ.

## Stack
| Phần | Ghi chú |
|---|---|
| Node.js | 22 trở lên. `yarn` trong `process/` cho Playwright và sharp |
| Bricks | 1.12.3 trong `wp-content/themes/bricks`. Không lên 2.x |
| CSS | External files. Lưu template ghi `post-{id}.min.css` |

Chưa có Node 22: `nvm install 22` rồi `nvm use 22`. Không có nvm thì cài bản 22 LTS tại https://nodejs.org.

## Setup
```text
FIGMA_TOKEN
WP_URL
WP_USER
WP_PASSWORD
MCP_TOKEN
```

`WP_URL` là site đang làm. `WP_USER` và `WP_PASSWORD` là user WordPress và application password của user đó. `MCP_TOKEN` lấy ở site đó: WordPress → Settings → F2B MCP. `FIGMA_TOKEN` là personal access token, scope `file_content:read`. Thiếu một trong năm khóa này thì lệnh và MCP dừng, không lấy site khác.

Site phải cài theme Bricks 1.12.3, mu-plugin `figma-to-bricks-bridge`, và plugin `f2b-mcp`.

`WP_URL` là site đang làm. Staging hay local đều là file này. Workflow tạo template trên site đó, không hỏi xác nhận upload.

## Workflow
Trong chat:
```text
/generate-template-from-figma
```

Dán link Desktop, link phải có `node-id`. Có Widescreen, Tablet, Mobile thì dán thêm. Thiếu link nào, chat hỏi một lần. Trả lời "không" nếu không có.

Chat ghi `plan.md` rồi tạo template trên `WP_URL`. Không hỏi xác nhận upload. Bước so với Figma mở nút View on frontend của template đó (`?bricks_preview=`), không mở canvas `?bricks=run`. Bạn tự gắn template vào trang.

Plan, ảnh so và báo cáo nằm trong `history/runs/<fileKey>/` (không vào git).

## MCP
Cursor chạy `node mcp/f2b-mcp.mjs`. File này đọc `WP_URL` và `MCP_TOKEN` trong `.env`, gọi `WP_URL/wp-json/f2b-mcp/v1/mcp`. Đổi site thì sửa `.env` rồi reload MCP.

## CSS dùng chung
Bản CSS của site trong `WP_URL` nằm ở `process/modules/staging/site-css/`: palette màu, biến site, global element, và class trang chủ đang inline.
```bash
node process/modules/staging/site-css.mjs pull    # đọc lại WP_URL
node process/modules/staging/site-css.mjs apply   # chép vào wp-content/uploads/bricks/css
```
`apply` chỉ ghi file trong repo. Máy local nạp các file đó. Class id chỉ nằm trong một template thì vẫn ở CSS của template đó.
Chi tiết cho người sửa code: [process/README.md](process/README.md).
