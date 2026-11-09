# Quá trình

Workflow đang chạy không sửa `process/` hay theme. Lệch thì ghi `history/notes/gaps.md`.

## Phase 1 — Khóa cách làm (2026-11-09)

- Chỗ làm việc chuyển từ thư mục tạm của máy sang `history/runs/<fileKey>/`. `history/runs/` và `history/notes/` không vào git.
- Danh sách trang nằm ở `history/urls.md`.
- Plan nhận câu tự do. Câu không hiểu thì hỏi, không bắt đúng một chữ, không sửa code vì một câu chữ khác.
- Chỉ dựng bằng `/generate-template-from-figma`. Một trang được tách section trong chat theo cây Figma.

## Phase 2 — Popup và form (2026-11-09)

Một lớp phủ mờ, hoặc nút đóng ở góc, cùng ít nhất một ô nhập và một nút, là form. Page settings của template popup gọi `bricksOpenPopup` / `bricksClosePopup` và ghi cookie `f2b_popup_<id>`. Nút mở nằm ngoài popup, gắn `data-f2b-open="<id>"`. CSS vẫn là file ngoài.

## Phase 3 — Đối chiếu cách nhận (2026-11-09)

Cách nhận nằm ở `process/modules/recognize-parts/kinds.mjs` và `history/notes/components.md`. Hình dạng quyết định. Tên lớp chỉ tăng độ chắc.

Popup cookie đã dựng: template 528. Rule chưa tự thấy popup vì màu phủ nằm trên khung gốc và nút X nằm sâu trong thẻ. Ghi ở `history/notes/gaps.md`. Chưa dựng 7 trang còn lại trong `history/urls.md`.

## Phase 4 — Widget (2026-11-09)

Tám widget đã vào detector và renderer, key lấy từ theme 1.12.3: gallery, progress, rating, alert, logo, hamburger, dropdown, offcanvas.

## Phase 5 — Rule của dự án này (2026-11-09)

Chuẩn là `process/` và theme 1.12.3. Bản trong `reference/ANV_mcp` là kệ. Mục lục docs của mình là `process/docs/INDEX.md`. Từng file kệ nằm ở `process/docs/SHELF.md`. Hết một dòng trong SHELF thì không mở file kệ đó nữa. Skill: `.cursor/skills/pipeline/SKILL.md`.

## Phase 6 — Đối chiếu kệ (2026-11-09)

Đã đọc rule Figma, rule Bricks, widget map, CSS, và figma-to-ui. Phần khớp thì nằm trong renderer và `schema-traps.mjs`. Phần lệch khóa của chủ thì ghi `không lấy` trong `history/notes/components.md`. Kệ đóng.

## Còn lại

Chưa dựng trang trong `history/urls.md`. Test section là bước sau. Case popup 368-6512 dựng lại sau các test đó.

- Popup: khung gốc phủ mờ và thẻ giữa là `popup`. Nút đóng nằm trong thẻ vẫn tính.
- Icon (svg hoặc icon font, không có viền hộp) không phải checkbox hay radio.
- Hàng tiêu đề cộng badge, hàng có switch, và hàng toàn nút không phải menu.
- Form vẫn là ô chữ cộng nút. Một ô chữ đủ khi khung là overlay. Panel chỉ có switch giữ từng switch, vì một element form sẽ nuốt cả thẻ.
- Bảy trang trong `history/urls.md` chỉ dựng sau khi rule này ổn.
