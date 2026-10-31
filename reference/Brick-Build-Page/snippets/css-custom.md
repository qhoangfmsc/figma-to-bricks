# Snippets — `_cssCustom` patterns (tái sử dụng)

> Dùng khi Bricks settings native không đủ fidelity. Thay `#brxe-{elementId}` bằng id thực tế.

## Layout `div` / `block` — luôn khai báo `display:flex`

Bricks settings `_direction: row` **không đảm bảo** CSS compile có `display:flex`. Mọi widget `div`/`block` dùng flex (row/column, gap, order) phải ghi rõ trong `_cssCustom`:

```css
#brxe-{divId}{
  display:flex;
  flex-direction:row;
  align-items:center;
  justify-content:space-between;
  column-gap:24px;
  width:100%;
}
```

Thiếu `display:flex` → `flex-direction`, `order`, `justify-content` **không có tác dụng** (layout stack sai, đặc biệt header mobile icon/title).

## Section background gradient — mirror trong `_cssCustom`

Bricks `_background.gradient` trên `section` **thường không compile** ra file CSS ngoài (G2 thấy chỉ padding, không có `linear-gradient`). Ghi thêm trên **section root** (`#brxe-{secId}`):

```css
#brxe-cmsec1{
  background:linear-gradient(180deg,rgba(242,243,245,0) 0%,#f2f3f5 50%);
}
```

Sau upload: `validate_css_compiled.py --template-id … --rule linear-gradient`. Autofix: `python3 scripts/section_autofix_loop.py --plan … --page-id …`.

## CTA pill — mũi tên trong vòng tròn trắng

Áp dụng trên element `button` (suffix icon):

```css
#brxe-{btnId}{
  padding-right:12px !important;
}
#brxe-{btnId} .bricks-button-icon{
  background:#fff;
  border-radius:50%;
  width:32px;
  height:32px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
#brxe-{btnId} .bricks-button-icon i,
#brxe-{btnId} .bricks-button-icon svg{
  color:#007cfc;
}
```

## Glass card (Workshop / glassmorphism)

```css
#brxe-{boxId}{
  width:100%;
  backdrop-filter:blur(5px);
  background:rgba(255,255,255,.1);
  border-radius:16px;
  padding:32px;
}
```

## Grid 2×2 với border + overlay giao điểm (Thực Chiến)

Parent grid:

```css
#brxe-{gridId}{
  display:grid;
  grid-template-columns:1fr 1fr;
  position:relative;
}
#brxe-{gridId}>.brxe-block:not(.overlay){
  border-top:1px solid #dbeafe;
}
#brxe-{gridId}>.brxe-block:nth-child(odd):not(.overlay){
  border-right:1px solid #dbeafe;
}
#brxe-{gridId}>.brxe-block:nth-child(n+3):not(.overlay){
  border-bottom:1px solid #dbeafe;
}
```

Overlay trắng 48×48 tại giao điểm (element `div` con):

```css
#brxe-{ovId}{
  position:absolute;
  left:50%;
  transform:translateX(-50%);
  width:48px;
  height:48px;
  background:#fff;
  z-index:2;
  pointer-events:none;
}
```

## Decor image — crop như Figma (object overflow)

Container (parent `_cssCustom`):

```css
#brxe-{imgWrapId}{
  overflow:hidden;
}
#brxe-{imgWrapId} img{
  object-fit:cover;
  object-position:left top;
  width:120%;
  height:360%;
  max-width:none;
  position:relative;
  left:-20%;
  top:0;
}
```

## Slider responsive — desktop arrows + mobile peek (một widget)

Dùng khi plan ghi **`slider-responsive`**: desktop 3 card + prev/next dưới track; mobile 1 card ~80% width + peek mép card kế, **không** nút nav — vẫn swipe Splide. Tham chiếu: section 「Sự kiện đã tham gia」.

**Trên slider root** — desktop: mũi tên căn giữa dưới track. **Mobile:** ẩn/hiện arrows theo **Settings snapshot** / Mobile diff của section (8108 Figma có arrows mobile → không ẩn mặc định):

```css
#brxe-{sliderId} { overflow: visible; }
#brxe-{sliderId} .splide__track { overflow: hidden; }
#brxe-{sliderId} .splide__pagination { display: none !important; }
#brxe-{sliderId} .splide__arrow {
  top: auto !important;
  bottom: -68px !important;
  transform: none !important;
}
#brxe-{sliderId} .splide__arrow--prev {
  left: calc(50% - 52px) !important;
  right: auto !important;
}
#brxe-{sliderId} .splide__arrow--next {
  right: auto !important;
  left: calc(50% + 4px) !important;
}
```

`_cssCustom:tablet_portrait` (991px — khớp Figma mobile):

```css
#brxe-{sliderId} .splide__arrows.custom {
  display: none !important;
}
#brxe-{sliderId} .splide__list {
  align-items: stretch !important;
  min-height: 300px !important;
}
```

**Trên mỗi slide block** — card + peek mobile:

```json
{
  "_direction": "column",
  "_display": "flex",
  "_rowGap": "16px",
  "_widthMax:tablet_portrait": "80%",
  "_alignSelf": "flex-start",
  "_height": "100%",
  "_cssCustom": "#brxe-{slideId} { box-shadow: inset 0px 0px 24px 0px rgba(0,124,252,0.2); height:100% !important; }"
}
```

Slider settings mẫu:

```json
{
  "perPage": 3,
  "perPage:tablet_portrait": 1,
  "perMove": 1,
  "gap": "24px",
  "gap:tablet_portrait": "16px",
  "arrows": true,
  "pagination": false,
  "autoHeight": true,
  "arrowWidth": "48px",
  "arrowHeight": "48px",
  "arrowDisabledOpacity": 0.2
}
```

> **Sai lầm thường gặp:** nhìn mobile scroll ngang → ngay lập tức `carousel-dual` + duplicate card. Nếu Figma mobile vẫn là carousel peek (1 card lộ mép card kế), dùng **`slider-responsive`** — ít DOM hơn, không sync 2 bộ card.

## Horizontal scroll row (mobile — `carousel-dual` / breakpoint)

Dùng cho **mobile block** khi plan ghi `carousel-dual`: desktop = `slider-nested`, mobile = row scroll (ẩn slider @991px). Xem `snippets/widget-map.md`.

Bricks thường **không compile** `_cssCustom` trên element `container` khi rule có child selector (`>`). Dùng `div` làm row + đặt CSS trên `div` và/hoặc `section`:

```css
#brxe-{rowId}{display:flex;flex-wrap:nowrap;gap:24px;width:100%;}
#brxe-{rowId}>.brxe-text-basic{flex:1;min-width:0;}
@media (max-width:991px){
  #brxe-{rowId}{overflow-x:auto;-webkit-overflow-scrolling:touch;
    scroll-snap-type:x mandatory;gap:16px;padding-bottom:4px;}
  #brxe-{rowId}>.brxe-text-basic{flex:0 0 286px;min-width:286px;scroll-snap-align:start;}
}
```

Review **per-section** (`tpl_*`) trong loop DO; **full page** (`page_*`) khi DONE — `review-skill/SKILL.md`.

**Validate CSS trước upload:** Bricks bỏ **toàn bộ** `_cssCustom` nếu CSS invalid (brace lệch, `{{` trong chuỗi thường). Dùng chuỗi plain `"@media..."` thay vì mix f-string + chuỗi thường có `}}`.

## Dual block desktop/mobile

Dùng khi Figma mobile **đổi component hoặc cấu trúc** (grid → list, collage → 1 ảnh…). Hai `block` con trong cùng `container`; mỗi block chứa layout của một viewport.

**Block desktop** — ẩn khi stack cột (≤991px, khớp Figma mobile):

```css
@media (max-width:991px){
  #brxe-{desktopBlockId}{
    display:none !important;
  }
}
```

**Block mobile** — ẩn trên desktop/tablet:

```css
#brxe-{mobileBlockId}{
  display:none;
}
@media (max-width:991px){
  #brxe-{mobileBlockId}{
    display:block !important;
  }
}
```

Hoặc dùng Bricks settings: `_display: none` trên `:mobile_portrait` (block desktop) và `_display: flex` chỉ trên mobile cho block mobile (kết hợp `_cssCustom` nếu builder không đủ).

> Upload `set_template_content` phải gồm **cả hai block** — REPLACE toàn bộ payload.

## Breakpoint-only (settings native)

Dùng khi mobile chỉ stack/co/đổi size — không đổi DOM. Ví dụ trên `container`:

```json
{
  "_direction": "row",
  "_direction:mobile_portrait": "column",
  "_padding:mobile_portrait": {"top": "16", "right": "16", "bottom": "16", "left": "16"},
  "_typography:mobile_portrait": {"font-size": "32px"}
}
```

Keys Bricks: `:tablet_portrait` (≤991px), `:mobile_portrait` (≤478px). Review mobile ở **390px**.
