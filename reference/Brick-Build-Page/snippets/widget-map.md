# Figma → Bricks widget map

Đọc kèm `rule_for_flow.md` (rule 11–12), **`bricks-skills/MAPPING-FIGMA-FLOW.md`**, **`bricks-skills/references/elements.md`**.

> **Nguyên tắc:** chiến lược và widget map **theo layout Figma mobile** — không ép `carousel-dual` trừ khi Figma mobile là **scroll row thuần** (không Splide). Còn lại xử lý đúng layout Figma (`breakpoint-only`, `slider-responsive`, `dual-block`…).

> **Phân vai:** `snippets/` = chiến lược responsive · `bricks-skills/` = widget name + JSON settings shape.

Ghi **`### Cấu trúc element`** + **`### Settings snapshot`** + **`### Mobile diff`** trong plan — **không** liệt kê `Desktop widgets` / `Mobile widgets` song song (trừ `carousel-dual` / `dual-block`).

## Cách ghi plan (thay Desktop + Mobile widgets song song)

**Một section = một cây DOM + một bảng settings.** Mobile không phải “bản kế hoạch thứ hai”.

| Block plan | Nội dung | Ai đọc khi DO |
|------------|----------|---------------|
| **Chiến lược mobile** | `breakpoint-only` \| `slider-responsive` \| … | Chọn pattern builder |
| **Cấu trúc element** | Cây DOM (desktop). Ghi id gợi ý nếu cần | Shape JSON |
| **Measurements** | Số từ Figma desktop (gap, padding, font) | Settings desktop |
| **Mobile diff** | 2–5 bullet: *chỉ* thay đổi @991px | Map → `:tablet_portrait` keys |
| **Settings snapshot** | Desktop + mọi key `:tablet_portrait` | **Nguồn sự thật duy nhất** — builder copy verbatim |
| **G4 checklist** | 1 dòng / bullet Mobile diff + layout desktop | So ảnh, không đọc lại widgets |

**Quy tắc:**

- **`slider-responsive` / `breakpoint-only`:** **một** cây DOM. Mobile = snapshot keys, **không** block “Mobile widgets”.
- **`carousel-dual` / `dual-block`:** **hai nhánh** trong *cùng* cây (`evds01` ẩn @991 · `evmb01` ẩn desktop) — ghi trong cấu trúc element, **không** tách hai list widget.
- **Cấm** thêm `Critical rules` — trùng snapshot, dễ mâu thuẫn snapshot.

**Ví dụ `slider-responsive` (Events):**

```markdown
### Cấu trúc element
section → container → title block → slider-nested → slide×3 (image + text)

### Mobile diff (@991px)
- perPage 1 · slide max-width 80% (peek)
- arrows dưới track (giữ như desktop)

### Settings snapshot
- sld: perPage 3 · gap 24 · type slide · start 0
- sld: perPage:tablet_portrait 1 · gap:tablet_portrait 16
- slide: _widthMax:tablet_portrait 80%
- arrows: true (desktop + tablet_portrait)
```

**Ví dụ `carousel-dual` (scroll row mobile):**

```markdown
### Cấu trúc element
section → container
  → block evds01 [desktop] → slider-nested
  → block evmb01 [mobile @991] → div scroll → card×N

### Mobile diff (@991px)
- ẩn evds01 · hiện evmb01 · scroll-x · card 286px

### Settings snapshot
- evds01: _cssCustom ẩn @991
- evmb01: _cssCustom hiện @991 · evrow1 overflow-x auto
```

## Nhận diện từ Figma (PLAN)

| Dấu hiệu Figma | Widget Bricks | Viewport |
|----------------|---------------|----------|
| Hàng card + **nút prev/next** (mũi tên tròn) hoặc dots | **`slider-nested`** | Desktop — xem `elements.md`, `patterns/sections/testimonials-slider.json` |
| Mobile vẫn **carousel** (1 card + peek mép card kế, swipe) — **không** có nút nav | Cùng slider + breakpoint (`perPage:1`, ẩn arrows, card `widthMax:80%`) | Mobile ≤991px |
| Mobile **scroll row thuần** (không Splide), card cố định px, kéo tay | `div` hoặc `block` + scroll (`overflow-x:auto`) | Mobile ≤991px — **`carousel-dual`** |
| Grid cố định, không nav | `block` + flex/grid | Desktop |
| Grid → chỉ scroll ngang trên mobile, desktop giữ grid | `breakpoint-only` hoặc `dual-block` | — |
| Collage nhiều ảnh → 1 ảnh mobile | `dual-block` | — |
| Accordion / FAQ | **`accordion-nested`** | Both — `patterns/sections/faq-accordion.json` |
| Form | `form` | Both |
| Heading + icon dot | `heading` + `icon` | Both |
| Card = image + text | `block` → `image` + `text-basic` / `heading` | Trong slide hoặc scroll row |

**Quy tắc carousel (user):** Figma **desktop** có điều hướng (prev/next) → slider. Figma **mobile** quyết định chiến lược:

| Mobile Figma | Chiến lược | Lý do |
|--------------|------------|-------|
| 1 card + **peek** mép card kế, swipe ngang (vẫn carousel) | **`slider-responsive`** | Một slider — đổi `perPage` + slide width trong **Settings snapshot** |
| Scroll ngang thuần, card `flex:0 0 Npx`, **không** dùng Splide | **`carousel-dual`** | Desktop `slider-nested` + mobile `div` scroll — hai khối ẩn/hiện @991px |

> Tham chiếu thực tế: section **「Sự kiện đã tham gia」** — `slider-responsive` (template `2026-v3-author-dang-tuan-su-kien-da-tham-gia`).

## Chiến lược `slider-responsive` (ưu tiên khi mobile vẫn là carousel)

Một **`slider-nested`** — **không** duplicate card sang block mobile. Settings: `elements.md` § slider-nested.

```
section
└── container
    ├── block (heading row: icon 18×18 + text-basic title)
    └── slider-nested
        └── block (slide) × N  → image + text-basic
```

Settings chính — ghi vào **Settings snapshot** (một bảng, cột `:tablet_portrait` khi khác desktop):

| Setting | Desktop | @991px (`:tablet_portrait`) |
|---------|---------|-------------------------------|
| `perPage` | 3 (hoặc theo Figma) | `1` |
| `perMove` | 1 | 1 |
| `gap` | 24 | 16 |
| `arrows` | theo Figma | theo Figma (ghi rõ trong Mobile diff — **không** mặc định ẩn) |
| `pagination` | `false` | `false` |
| slide `_widthMax` | — | `80%` (peek) |

Trên slide: typography mobile chỉ thêm key `:tablet_portrait` nếu Figma đổi size.

Pattern CSS: `snippets/css-custom.md` → *Slider responsive (desktop arrows + mobile peek)*.

> Review mobile ở đúng bề rộng frame Figma mobile (375/390/414… — rule 46). Bật mobile từ **`:tablet_portrait` (991px)** — không chỉ `:mobile_portrait` (478px), trừ khi plan ghi rõ chỉ cần 478px.

## Chiến lược `carousel-dual`

> **Chỉ khi Figma mobile** là scroll row thuần — card cố định px, kéo tay, **không** Splide/peek carousel. G0 bắt buộc widget Mobile có `div`/`block` + scroll.

```
section
└── container
    ├── heading row (title + icon)
    ├── block DESKTOP  evds01   ← ẩn @991px
    │   └── slider-nested evsl01
    │       └── block (slide) × N  → image + text
    └── block MOBILE   evmb01    ← ẩn desktop
        └── div evrow1  (flex nowrap + overflow-x:auto)
            └── block (card) × N
```

- Desktop: bật **arrows** (và dots nếu Figma có) trên `slider-nested`.
- Mobile: **ẩn** slider + nav pill desktop; row scroll — pattern `snippets/css-custom.md` → *Horizontal scroll row*.
- Swap: `_cssCustom` `@media (max-width:991px) { display:none }` trên `evds01` và inverse trên `evmb01` (chỉ hiện mobile block).

## Mẫu ghi plan (`carousel-dual` — **ngoại lệ** hai nhánh DOM)

```markdown
- Chiến lược mobile: `carousel-dual`

### Cấu trúc element
section → container
  → block evds01 → slider-nested → slide×N
  → block evmb01 → div scroll → card×N

### Mobile diff (@991px)
- ẩn evds01 · hiện evmb01 · card flex 0 0 286px · scroll-x

### Settings snapshot
- (evds01, evmb01, slider, scroll row — một bảng)
```

> Các chiến lược khác **không** dùng mẫu Desktop/Mobile widgets riêng — xem § Cách ghi plan ở đầu file.

## Các chiến lược khác (tóm tắt)

| Chiến lược | Khi nào | Widget chính |
|------------|---------|--------------|
| `breakpoint-only` | Cùng DOM, chỉ đổi size/padding/stack | `block`, `container`, settings `:tablet_portrait` |
| `slider-responsive` | Desktop slider + mobile carousel peek (cùng slider) | Một `slider-nested` + breakpoint |
| `dual-block` | DOM khác (grid→list, collage→1 ảnh) | Hai `block` con, `display:none` |
| `carousel-dual` | Desktop slider + mobile **scroll row** (không Splide) | `slider-nested` + `div` scroll |
| `n/a` | Không có Figma mobile | Desktop + rule 10 tối thiểu |

## Anti-patterns

| Sai | Đúng |
|-----|------|
| Desktop có mũi tên prev/next mà chỉ dùng `block` + flex | `slider-nested` — `elements.md` |
| Mobile peek carousel mà ép `carousel-dual` + duplicate 4 card | `slider-responsive` — một slider, snapshot |
| Hai list Desktop/Mobile widgets + Critical rules | Một cây + Mobile diff + Settings snapshot |
| Mobile scroll row thuần mà giữ Splide + arrows | `carousel-dual` — tách block mobile |
| Một row `overflow-x` cho cả desktop có nav arrows | `carousel-dual` hoặc `slider-responsive` tùy mobile |
