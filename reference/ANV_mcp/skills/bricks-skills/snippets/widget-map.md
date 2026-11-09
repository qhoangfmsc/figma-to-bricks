# Widget Map — Figma Layout → Bricks Element

> Bảng tra cứu nhanh: từ layout Figma → chọn Bricks widget + chiến lược responsive.
> Chi tiết đầy đủ xem tại `bricks-skills/references/elements-catalog.md`.

---

## 🗺️ Tra nhanh theo layout Figma

| Figma Node Type | Mô tả | Bricks Widget | Lưu ý |
|-----------------|-------|---------------|-------|
| Frame (Auto Layout Vertical) | Stack container dọc | `block` (`_direction: column`) | Wrapper thông thường |
| Frame (Auto Layout Horizontal) | Row flex | `block` (`_direction: row`) | Flex row |
| Frame (Grid) | Grid layout | `block` + CSS Grid custom | Dùng `_cssCustom: display:grid` |
| Text (Heading) | H1/H2/H3... | `heading` | Chọn `tag` phù hợp |
| Text (Paragraph/Body) | Đoạn văn | `text-basic` | Không dùng `heading` |
| Image/Photo | Ảnh minh họa | `block` (wrapper) → `image` (con) | Bắt buộc bọc wrapper |
| Vector/SVG Icon | Icon đơn giản | `icon` hoặc `svg` | SVG phải cùng-origin nếu dùng trong button |
| Button Frame | Nút bấm có link | `button` | Không tách thành block+text |
| Non-button Row (icon + text) | Danh sách tính năng | `block` (row) → `icon` + `text-basic` | Không gộp thành button |
| Component (Slider/Carousel) | Slide ảnh/card | `slider-nested` | Cần Splide config |
| Component (Ticker) | Auto-scroll logo | `slider-nested` + AutoScroll ext | Cần thêm JS |
| Component (Accordion/FAQ) | Câu hỏi mở rộng | `accordion` | |
| Form Frame | Biểu mẫu nhập liệu | `form` | |
| Video Frame | Nhúng video | `video` | |
| Map Frame | Google Maps | Dùng HTML/embed | |

---

## 📱 Chiến lược Responsive theo layout Figma

| Điều kiện Figma Mobile | Strategy | Widgets chính |
|------------------------|----------|---------------|
| Không có frame mobile | `n/a` | Desktop only + rule 4 tự động |
| Mobile = desktop, chỉ stack/co | `breakpoint-only` | Cùng DOM, dùng `:tablet_portrait` settings |
| Desktop slider + Mobile peek/swipe (Splide) | `slider-responsive` | 1× `slider-nested` + breakpoint perPage |
| Desktop slider + Mobile scroll div thuần | `carousel-dual` | `slider-nested` (desktop) + `block` overflow-x (mobile) |
| Desktop/Mobile DOM khác hoàn toàn | `dual-block` | 2× `block` + `_conditions` viewport |

---

## 🔧 Widget nhanh — Cấu hình hay dùng

### `block` — Container Flex/Grid

```json
"settings": {
  "_display": "flex",
  "_direction": "row",
  "_alignItems": "center",
  "_justifyContent": "space-between",
  "_gap": "24px",
  "_direction:tablet_portrait": "column"
}
```

### `heading`

```json
"settings": {
  "tag": "h2",
  "text": "Tiêu đề section",
  "_typography": {
    "font-family": "Inter",
    "font-size": "40px",
    "font-weight": "700",
    "line-height": "1.2"
  },
  "_typography:tablet_portrait": { "font-size": "28px" }
}
```

### `image` (trong wrapper)

```json
// Wrapper block:
"settings": {
  "_width": "480px",
  "_height": "360px",
  "_overflow": "hidden"
}

// Image con:
"settings": {
  "image": { "external": true, "url": "http://localhost:3845/assets/xxx.png" },
  "_width": "100%",
  "_height": "100%",
  "_objectFit": "cover"
}
```

### `button`

```json
"settings": {
  "text": "Bắt đầu ngay",
  "link": { "type": "url", "url": "#" },
  "_background": { "color": { "hex": "#2563EB" } },
  "_typography": { "font-size": "16px", "font-weight": "600" },
  "_padding": "14px 28px",
  "_border": { "radius": { "top": "8px", "right": "8px", "bottom": "8px", "left": "8px" } }
}
```

### `slider-nested` (basic responsive)

```json
"settings": {
  "splideJson": "{\"type\":\"loop\",\"perPage\":3,\"gap\":\"24px\",\"autoplay\":true,\"interval\":4000,\"breakpoints\":{\"991\":{\"perPage\":2},\"767\":{\"perPage\":1}}}"
}
```

---

## ⚡ Quy tắc chọn widget nhanh

1. **Text có role click + link** → `button`
2. **Text + icon không click** → `block` (row) + `icon` + `text-basic`
3. **Ảnh minh họa/banner** → `block` (wrapper) + `image`
4. **Icon SVG đơn** → `icon` (nếu simple) hoặc `svg` (nếu complex/multicolor)
5. **Mọi container layout** → `block` (không dùng `container` trừ section top-level)
6. **Section top-level** → `section` + `container` (1 container/section, không nested section)
