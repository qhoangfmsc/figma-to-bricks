# Figma → Bricks

Máy local chạy WordPress + Bricks 1.12.3. Bạn làm trong chat Cursor. Phiên bản này chỉ có một lệnh: một template. Cả trang để sau.

Site: http://localhost:8080

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

- **Component sẽ dựng** — mỗi component một mục. Đổi `giữ` thành `bỏ` thì khối đó chỉ là layout.
- **Đoán, chưa gắn** — chỉ hiện khi có. Mỗi dòng một khối, kèm link Figma và vì sao đoán. Ghi `gắn` hoặc `bỏ`.
- **Ô cùng hình, chưa gắn** — chỉ hiện khi có ô giống nhau chưa gọi tên. Ghi `slider`, `tab`, `menu`, `form`, `accordion` hoặc `nút`.
- Ô cần điền: URL, alt, câu trả lời, nội dung tab chưa vẽ. Trống thì link `#`, alt trống, câu trả lời trống.

Đổi `Xác nhận: không` thành `Xác nhận: có`, rồi nhắn chạy tiếp. Máy build, đẩy template lên Bricks, chụp và so với ảnh Figma. Bạn tự gắn template vào trang.

## Kết quả nằm ở đâu

Plan, ảnh so (`verify.png`, `verify.figma.png`, `verify.diff.png`) và báo cáo nằm trong thư mục tạm của hệ điều hành: `figma-to-bricks/<fileKey>/`. Template và trang thì nằm trên site http://localhost:8080.

`verify.md` ghi tên phần nằm trên từng vùng ảnh lệch.

Chi tiết cho người sửa code: [process/README.md](process/README.md).
