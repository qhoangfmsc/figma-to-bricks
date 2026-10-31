# Kế hoạch mở rộng `patterns/`

> **Trạng thái (03/10/2026):** đã hoàn thành bước 1–7 của mục 7. Còn mở: dán/import thử trên site Bricks thật (mục 6 bước 4) và các hạng mục ở mục 5.

## 1. Mục tiêu

- Nguồn chuẩn: registry trong `references/elements.md` — **Bricks 2.4.2**, đối chiếu với `includes/elements.php` trong source tại `vnx-website/wp-content/themes/bricks`, gồm **85 element** (không tính WooCommerce).
- Trừ danh sách loại trừ ở mục 4.3 (8 element), **77 element còn lại** mỗi element có ít nhất một pattern tham chiếu.
- Chia folder theo nhóm để agent tìm mẫu nhanh, `INDEX.md` không phình to.
- Mọi pattern phải qua integrity check (mục 6) trước khi thêm vào INDEX.

> Nếu nâng cấp Bricks lên version mới hơn: cập nhật registry trong `references/elements.md` trước, rồi mới cập nhật con số và danh sách trong plan này.

## 2. Cách agent nhận biết pattern

1. Skill `bricks` (`SKILL.md`) được kích hoạt nhờ `description` trong frontmatter.
2. `SKILL.md` trỏ tới `patterns/INDEX.md`.
3. `INDEX.md` là bảng tra cứu; agent chọn nhóm, hoặc tra bảng "Find by element", rồi chọn file theo cột "Demonstrates" trong INDEX của nhóm.

=> Pattern không có trong INDEX thì agent không tìm thấy. Mỗi pattern mới bắt buộc được thêm vào INDEX của nhóm và bảng "Find by element".

## 3. Cấu trúc folder mới

```
patterns/
  INDEX.md        chỉ mục chính: bảng nhóm + bảng "Find by element"
  PLAN.md
  sections/       hero-centered, hero-split-image, logo-strip, feature-grid,
                  pricing-table, testimonials-slider, faq-accordion,
                  cta-section, contact-section
  templates/      header-template, footer-template, popup-newsletter,
                  single-post, archive, search-results, 404
  query/          team-grid-acf, blog-archive-filters, filter-sidebar
  bem/            bem-hero, bem-card-grid, bem-pricing
  elements/       26 file cho các element còn lại
```

Mỗi folder nhóm có `INDEX.md` riêng.

### Cập nhật khi di chuyển file

`.cursor/skills/bricks` là symlink tới `bricks-skills/`, nên mọi tham chiếu dưới đây đều phải sửa:

- [x] `bricks-skills/SKILL.md` – đường dẫn tới `patterns/` + checklist chạy validator
- [x] `bricks-skills/README.md` – sơ đồ cây và mục Patterns
- [x] `bricks-skills/CLAUDE.md` – bảng thư mục + quy tắc validator
- [x] `bricks-skills/MAPPING-FIGMA-FLOW.md` – bảng "Pattern index nhanh"
- [x] `bricks-skills/references/layout-recipes.md` – chỉ trỏ tới `patterns/` chung, không cần sửa
- [x] `bricks-skills/patterns/INDEX.md` – tách thành INDEX chính + INDEX từng nhóm
- [x] `flow_figma_to_bricks.md` (dòng 388, 580)
- [x] `rule_for_flow.md` (dòng 46) – chỉ trỏ tới `patterns/` chung, không cần sửa
- [x] `snippets/widget-map.md` (dòng 67, 73)
- [x] `plans/_plan-template.md` (dòng 103)

Đã grep tên từng file pattern cũ trên toàn repo: không còn đường dẫn `patterns/<file>.json` thiếu thư mục nhóm.

## 4. Pattern cần tạo

### 4.1 Ưu tiên cao (30 element) — xong

| Nhóm | Element | File |
|------|---------|------|
| Tab, overlay | `tabs-nested`, `offcanvas` | `elements/tabs-section.json`, `elements/offcanvas-menu.json` |
| Số liệu | `counter`, `progress-bar`, `countdown` | `elements/stats-counter.json`, `elements/progress-countdown.json` |
| Media | `video`, `image-gallery` | `elements/video-section.json`, `elements/gallery-section.json` |
| Điều hướng | `breadcrumbs`, `nav-menu`, `search` | `elements/breadcrumbs.json`, `elements/nav-menu.json`, `elements/search.json` |
| Filter | `filter-checkbox`, `filter-radio`, `filter-range`, `filter-datepicker`, `filter-active-filters`, `filter-submit` | `query/filter-sidebar.json` |
| Single post | `post-title`, `post-content`, `post-excerpt`, `post-meta`, `post-taxonomy`, `post-author`, `post-comments`, `post-navigation`, `post-reading-time` | `templates/single-post.json` |
| Post bổ sung | `post-toc`, `post-reading-progress-bar`, `post-sharing` | `elements/post-extras.json` |
| Danh sách post | `posts`, `related-posts` | `templates/archive.json`, `elements/related-posts.json` |

Đã có thêm `templates/search-results.json` và `templates/404.json` để đủ bộ template type.

### 4.2 Ưu tiên thấp (23 element) — xong

| Nhóm | Element | File | Ghi chú |
|------|---------|------|---------|
| Slider | `carousel` | `elements/carousel-posts.json` | |
| Toggle | `toggle`, `toggle-mode` | `elements/offcanvas-menu.json`, `elements/toggle-mode.json` | |
| Trạng thái | `pie-chart`, `rating`, `alert`, `animated-typing` | `elements/pie-chart-rating.json`, `elements/alert.json`, `elements/animated-typing.json` | |
| Media | `audio`, `svg`, `file` | `elements/media-files.json` | `svg` dùng `iconSet` vì code SVG bị ký (signed) |
| Bản đồ | `map`, `map-leaflet`, `map-connector` | `elements/map-google.json`, `elements/map-leaflet.json`, `elements/map-query-sync.json` | `map` chế độ API cần Google API key |
| Điều hướng | `back-to-top`, `divider` | `elements/back-to-top.json`, `elements/divider.json` | |
| Nhúng | `code`, `html`, `shortcode`, `sidebar`, `wordpress`, `template`, `instagram-feed`, `facebook-page` | `elements/code-html-shortcode.json`, `elements/sidebar-widgets.json`, `elements/template-embed.json`, `elements/social-feeds.json` | `template`, `sidebar`, `nav-menu` để trống giá trị (chọn sau khi dán) thay vì ID giả, tránh nhúng nhầm template có sẵn; `instagram-feed` cần token |

Pattern dùng placeholder được đánh dấu ⚠ trong `elements/INDEX.md`.

### 4.3 Loại trừ (8 element)

| Element | Lý do |
|---------|-------|
| `pricing-tables`, `team-members`, `testimonials` | Legacy; đã có pattern dựng bằng element cơ bản |
| `accordion`, `tabs`, `slider` | Legacy; `elements.md` khuyến cáo dùng bản `-nested`. Có pattern sẽ khiến agent chọn nhầm |
| `slot` | Chỉ dùng bên trong Component – làm cùng mục 5 |
| `form-checkbox` | Ẩn khỏi panel (`panel_condition` never), chỉ sinh ra bởi WooCommerce Checkout – làm cùng mục 5 |

### 4.4 Đã có pattern từ trước (24 element)

`section`, `container`, `block`, `div`, `heading`, `text-basic`, `text`, `text-link`, `button`, `icon`, `image`, `logo`, `list`, `icon-box`, `social-icons`, `form`, `accordion-nested`, `slider-nested`, `nav-nested`, `dropdown`, `filter-search`, `filter-select`, `pagination`, `query-results-summary`.

Kiểm tra tổng: 24 + 30 + 23 + 8 = 85.

## 5. Ngoài phạm vi element (làm sau)

- WooCommerce: product archive, single product, cart, checkout (kèm `form-checkbox`)
- Component dùng lại (kèm `slot`)
- Interactions ngoài `enterView`
- Conditions

## 6. Quy trình cho mỗi pattern

1. Đọc `references/elements.md` (và `forms.md`, `query-filters.md`, `templates.md` khi liên quan) để lấy đúng control keys. Element nào `elements.md` chưa mô tả đủ thì bổ sung vào `elements.md` trước, đối chiếu `includes/elements/<name>.php`.
2. Viết JSON theo format trong `references/json-formats.md`. Template `single`, `archive`, `search`, `error` đặt element trong key `content` và khai báo `templateSettings.templateConditions` theo `templates.md`.
3. Chạy `python3 scripts/validate_pattern.py <file|folder> --bricks-source <theme bricks>`: parse, tree reciprocity, tên element, class references, query references, format keys, và control key có trong source PHP.
4. Với nhóm ưu tiên cao: dán/import thử vào một site Bricks thật – validator không kiểm tra **giá trị** (vd. `aspectRatio: "16/9"` hay `"16:9"`) và không kiểm tra key bên trong repeater. **Chưa làm.**
5. Thêm dòng vào INDEX của nhóm (file, elements, demonstrates) và bảng "Find by element" trong INDEX chính.
6. Cập nhật số lượng pattern trong `README.md`.

## 7. Thứ tự thực hiện

1. [x] Tách script integrity check thành `scripts/validate_pattern.py`: nhận file hoặc folder, hỗ trợ key `content`, `header`, `footer`; thêm tùy chọn `--bricks-source` kiểm tra control key.
2. [x] Chia folder, cập nhật toàn bộ tham chiếu ở mục 3, tách INDEX. Validator pass trên toàn bộ pattern cũ.
3. [x] Template: `single-post`, `archive`, `404`, `search-results`.
4. [x] Element ưu tiên cao: tabs, offcanvas, counter, video, gallery, breadcrumbs, nav-menu, search, post-extras, related-posts.
5. [x] `query/filter-sidebar.json`.
6. [x] Element ưu tiên thấp.
7. [x] Rà soát cuối: registry 85 element = 77 có pattern + 8 loại trừ, không còn element nào thiếu.

## 8. Sửa reference phát sinh trong quá trình làm

Đối chiếu source 2.4.2 phát hiện các mô tả sai, đã sửa:

- `video`: chọn nguồn bằng `videoType` (không phải `media`); `aspectRatio` dạng `"16/9"`. Sửa cả `external-assets.md`.
- `offcanvas`: key thật là `effect`, `closeOn`, `noScrollBody`…; children bắt buộc `brx-offcanvas-inner` + `brx-offcanvas-backdrop`.
- `toggle`: `toggleSelector` / `toggleAttribute` / `toggleValue` (không phải `selector`).
- `posts`: repeater là `fields`; `related-posts` dùng `content`.
- `countdown`: `fields` = `{prefix, format, suffix}`, `gutter` là spacing object.
- `filter-range`: `displayMode` (không phải `mode`), không có setting `min`/`max`.
- `filter-submit`: thêm `filterButtonType` (`apply` / `reset`), `hideOnNoFilter`.
- `map`: chế độ `iframe` dùng key `address` đơn.
- Thêm mục "Single post elements" vào `elements.md`.
