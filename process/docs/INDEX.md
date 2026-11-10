# Mục lục

Chuẩn là `process/` và theme `wp-content/themes/bricks` (Bricks **1.12.3**). Mỗi component một file trong [widget-components/](widget-components/). Tên file là id. Dòng `Có` trong file đó nói đã dựng chưa và đã tự nhận chưa.

Kệ ANV: [SHELF.md](SHELF.md). `history/notes/` không vào git. Lệch một lần dựng ghi `history/notes/gaps.md`. Lỗi đọc Figma ghi `history/notes/read-errors.md`.

## Component

### Node cơ bản

| | |
|---|---|
| [section](widget-components/section.md) | khung gốc |
| [block](widget-components/block.md) | flex, grid, absolute, clip |
| [heading](widget-components/heading.md) | H1–H6 |
| [text](widget-components/text.md) | chữ thường |
| [image](widget-components/image.md) | ảnh lá |
| [svg](widget-components/svg.md) | vector, icon font |

### Đã nhận và đã dựng

| | |
|---|---|
| [button](widget-components/button.md) | nút |
| [input](widget-components/input.md) | ô nhập, loại field |
| [form](widget-components/form.md) | form |
| [checkbox](widget-components/checkbox.md) | ô vuông |
| [radio](widget-components/radio.md) | hình tròn |
| [switch](widget-components/switch.md) | viên thuốc |
| [accordion](widget-components/accordion.md) | FAQ |
| [tabs](widget-components/tabs.md) | tab |
| [tab-switch](widget-components/tab-switch.md) | tab có mục lặp |
| [menu](widget-components/menu.md) | hàng link |
| [menu-slider](widget-components/menu-slider.md) | hàng link tràn |
| [carousel](widget-components/carousel.md) | slider |
| [readmore](widget-components/readmore.md) | xem thêm |
| [search](widget-components/search.md) | ô tìm |
| [video](widget-components/video.md) | video |
| [divider](widget-components/divider.md) | gạch |
| [tooltip](widget-components/tooltip.md) | chú thích |
| [flat-image](widget-components/flat-image.md) | ảnh gộp |
| [gallery](widget-components/gallery.md) | lưới ảnh |
| [scroll](widget-components/scroll.md) | list cuộn |
| [progress](widget-components/progress.md) | thanh % |
| [rating](widget-components/rating.md) | sao |
| [alert](widget-components/alert.md) | thanh báo |
| [logo](widget-components/logo.md) | logo |
| [hamburger](widget-components/hamburger.md) | ba gạch |
| [dropdown](widget-components/dropdown.md) | danh sách xổ |
| [offcanvas](widget-components/offcanvas.md) | panel mép |
| [link](widget-components/link.md) | text-link |
| [semantic](widget-components/semantic.md) | ul > li |

### Dựng được, chưa tự nhận

| | |
|---|---|
| [icon-list](widget-components/icon-list.md) | hàng icon + chữ |
| [breadcrumbs](widget-components/breadcrumbs.md) | breadcrumb |
| [counter](widget-components/counter.md) | số đếm |
| [countdown](widget-components/countdown.md) | đếm ngược |

### Loại template

| | |
|---|---|
| [popup](widget-components/popup.md) | modal, lightbox |
| [header](widget-components/header.md) | thanh trên |
| [footer](widget-components/footer.md) | chân trang |
| [error](widget-components/error.md) | 404 |
| [archive](widget-components/archive.md) | danh sách thẻ |
| [content](widget-components/content.md) | single |
| [template-search](widget-components/template-search.md) | trang kết quả tìm |

### Dùng chung

| | |
|---|---|
| [state](widget-components/state.md) | hover, active, open, focus, disabled, pressed |

### Để riêng, gọi khi plan cần

Không đi vào detect. Module: `process/modules/standby/`.

| | |
|---|---|
| [posts](widget-components/posts.md) | vòng lặp bài viết |
| [woocommerce](widget-components/woocommerce.md) | shop |
| [dynamic-data](widget-components/dynamic-data.md) | ACF, meta, tag Woo |
| [conditions](widget-components/conditions.md) | hiện theo điều kiện |
| [masonry](widget-components/masonry.md) | lưới xếp gạch |
| [shape-divider](widget-components/shape-divider.md) | hình mép section |

### Chưa có

| | |
|---|---|
| [nav-menu](widget-components/nav-menu.md) | cần id menu |
| [posts](widget-components/posts.md) | cần vòng lặp |
| [woocommerce](widget-components/woocommerce.md) | cần shop |
| [map](widget-components/map.md) | cần địa chỉ |
| [audio](widget-components/audio.md) | cần nguồn |
| [social-icons](widget-components/social-icons.md) | cần tên icon |
| [ticker](widget-components/ticker.md) | không có trong theme |
| [icon](widget-components/icon.md) | svg giữ là svg |

## Việc khác

| Việc | Mở |
|---|---|
| Kệ ANV | [SHELF.md](SHELF.md) |
| Số và key Bricks | `components/<id>.mjs`, rồi PHP trong `wp-content/themes/bricks/includes/` |
| Plan, choice | `process/modules/missing-content/choices.mjs` |
| CSS, fill, chữ, layout | `process/modules/write-bricks/render/` và [AI-GUIDE.md](AI-GUIDE.md) |
| Property Figma chưa đọc | `process/schema/handling.json` |
| Breakpoint | `process/modules/breakpoints/` |
| Lỗi đọc | `process/modules/common/read-errors.mjs` |
| Chạy một template | `.cursor/skills/generate-template-from-figma/SKILL.md` |
| MCP staging | `wp-content/plugins/f2b-mcp/` |
| Rule pipeline | `.cursor/skills/pipeline/SKILL.md` |

Sửa một component thì sửa file cùng tên trong `widget-components/`, sửa file `.mjs`, rồi thêm test trong `process/test/`.
