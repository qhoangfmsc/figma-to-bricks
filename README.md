# Figma → Bricks

Một frame Figma thành một template Bricks 1.12.3. Làm và xem trên local. Đẩy lên site khác chỉ khi cần.

## Stack

| Phần | Ghi chú |
|---|---|
| Node.js | 22 trở lên. Pipeline không cài package |
| Docker | WordPress + MariaDB 11, chỉ cho máy local |
| Bricks | 1.12.3, theme trong `wp-content/themes/bricks`. Không lên 2.x |
| CSS | External files. Mỗi lần lưu template ghi `post-{id}.min.css` |

Chưa có Node 22:

```bash
nvm install 22
nvm use 22
```

Không có nvm thì cài bản 22 LTS tại https://nodejs.org. Chưa có Docker thì cài Docker Desktop. Không chạy `yarn` hay `npm install` cho pipeline.

## Local

`.env` ở gốc repo. Không commit, không dán vào chat. Bốn khóa này luôn trỏ máy mình để test:

```text
FIGMA_TOKEN
WP_URL=http://localhost:8080
WP_USER
WP_APP_PASSWORD
```

`WP_USER` là user WordPress local. `WP_APP_PASSWORD` là application password của user đó. Docker đọc thêm `.env.local` (cổng, database).

```bash
node local/up.mjs        # bật
node local/up.mjs stop   # dừng, giữ database
node local/up.mjs down   # xóa container và database
```

Lần đầu mở `WP_URL` và cài WordPress nếu còn màn hình cài đặt. Ảnh so với Figma do Playwright trong Docker chụp. Không cần Chrome trên máy.

## Đẩy lên site khác

Không đổi bốn khóa local. Thêm hai khóa, trỏ staging hoặc site cần nhận template. Site đó phải cài và bật plugin `wp-content/plugins/f2b-mcp`.

```text
STAGING_MCP_URL
STAGING_MCP_TOKEN
```

`STAGING_MCP_URL` dạng `https://site/wp-json/f2b-mcp/v1/mcp`. Token lấy ở WordPress của site đó: Settings → F2B MCP.

Trong chat, cả tin nhắn chỉ là câu này thì mới đẩy:

```text
Xác nhận lên staging
```

Câu khác không đẩy. Template trên local không bị sửa.

## Một template

Trong chat:

```text
/generate-template-from-figma
```

Dán link Desktop, link phải có `node-id`. Có Widescreen, Tablet, Mobile thì dán thêm. Thiếu link nào, chat hỏi một lần. Trả lời "không" nếu không có.

Chat ghi `plan.md` rồi dừng. Sửa file đó, đổi `Xác nhận: không` thành `Xác nhận: có`, nhắn chạy tiếp. Máy build, đẩy lên Bricks local, chụp và so với Figma. Bạn tự gắn template vào trang.

Plan, ảnh so và báo cáo nằm trong `history/runs/<fileKey>/` (không vào git). Ghi chú lệch nằm ở `history/notes/`.

Chi tiết cho người sửa code: [process/README.md](process/README.md).
