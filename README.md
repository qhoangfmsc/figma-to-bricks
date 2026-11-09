# Figma → Bricks

Máy local chạy WordPress + Bricks 1.12.3. Bạn làm trong chat Cursor. Phiên bản này chỉ có một lệnh: một template. Cả trang để sau.

Site: http://localhost:8080

## Stack

| Phần | Phiên bản |
|---|---|
| Node.js | 22 trở lên. Pipeline không cài package. |
| Docker Compose | bản đang có trên máy, để chạy hai container bên dưới |
| WordPress | image `wordpress:latest` |
| MariaDB | image `mariadb:11` |
| Bricks | 1.12.3, nằm sẵn trong `wp-content/themes/bricks`. Không nâng lên 2.x |
| CSS | External files. Bricks mặc định là inline. Bridge ghi `cssLoading = file` rồi viết `post-{id}.min.css` sau mỗi lần lưu template, page preview và page ghép. Không regenerate cả site |

Cài Node 22 nếu `node -v` chưa phải 22:

```bash
# macOS, đã có nvm
nvm install 22
nvm use 22
node -v
```

Chưa có nvm thì tải bản 22 LTS tại https://nodejs.org và cài. Không chạy `yarn` hay `npm install` cho pipeline: `process/package.json` không có dependency.

Cài Docker Desktop (https://www.docker.com/products/docker-desktop/) nếu chưa có lệnh `docker`.

## Docker

Ở thư mục gốc của repo:

```bash
docker compose up -d      # bật site
docker compose stop       # dừng, giữ database
docker compose up -d      # bật lại
docker compose down -v    # xóa sạch, kể cả database
```

Lần đầu mở http://localhost:8080 và cài WordPress nếu trình duyệt còn hiện màn hình cài đặt.

Ảnh so với Figma do Playwright chụp trong Docker. Không cần mở Chrome trên máy. Lần verify đầu sẽ dựng image, nên chậm hơn các lần sau.

## Chuẩn bị

File `.env` ở gốc repo. Không commit, không dán vào chat. Cần `FIGMA_TOKEN`, `WP_URL`, `WP_USER`, `WP_APP_PASSWORD`.

Link Figma phải có `node-id`. Trong Figma: chuột phải frame → Copy link to selection.

## Một template

Trong chat:

```text
/generate-template-from-figma
```

Dán link Desktop. Có thêm Widescreen, Tablet portrait, Mobile landscape, Mobile portrait thì dán luôn. Thiếu link nào, chat hỏi một lần. Trả lời "không" cho link không có. Không đoán URL.

Chat ghi `plan.md` trong thư mục tạm của frame rồi dừng. Mở file đó, điền sau dấu `:` trên dòng có khóa:

- **Loại** — `section` (mặc định), `header`, `footer`, `popup`, `content`, `archive`, `search`, `error`.
- **Component Detected** — danh sách component tool detect được, kể cả khối. Tool điền giá trị đọc được từ Figma. Chỗ Figma không có thì là `[Chưa có value]`.
- **Góp ý** — mỗi phần một dòng. Muốn đổi khối thành slider, tab, menu, form, accordion hoặc button thì viết vào đó.
- **Góp ý thêm** — một dòng cuối file.

AI đọc câu trong plan, ghi enum vào `choices.json`, rồi mới build. Code không đối chiếu chữ "giữ" hay "bỏ".

Đổi `Xác nhận: không` thành `Xác nhận: có`, rồi nhắn chạy tiếp. Máy build, đẩy template lên Bricks, chụp và so với ảnh Figma. Bạn tự gắn template vào trang.

## Kết quả nằm ở đâu

Plan, ảnh so (`verify.png`, `verify.figma.png`, `verify.diff.png`) và báo cáo nằm trong `history/runs/<fileKey>/` (không vào git). Ghi chú lệch nằm ở `history/notes/`. Danh sách trang thử: `history/urls.md`. Template và trang thì nằm trên site http://localhost:8080.

`verify.md` ghi tên phần nằm trên từng vùng ảnh lệch.

Chi tiết cho người sửa code: [process/README.md](process/README.md).
