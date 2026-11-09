# CSS Custom Workarounds — Bricks Builder

> Kho lưu trữ các kỹ thuật CSS tùy chỉnh hay dùng trong `_cssCustom` của Bricks.
> Dùng khi Bricks settings không đủ để đạt pixel-perfect theo Figma.

---

## 📐 Layout & Spacing

### CSS Grid tùy chỉnh (khi block flex không đủ)

```css
/* 3 cột đều nhau, gap 24px */
display: grid;
grid-template-columns: repeat(3, 1fr);
gap: 24px;

/* Responsive 2 cột tablet, 1 cột mobile */
@media (max-width: 991px) {
  grid-template-columns: repeat(2, 1fr);
}
@media (max-width: 767px) {
  grid-template-columns: 1fr;
}
```

### Bento Grid (các card kích thước khác nhau)

```css
display: grid;
grid-template-columns: repeat(3, 1fr);
grid-template-rows: auto;
gap: 20px;

/* Card lớn chiếm 2 cột */
.card-large { grid-column: span 2; }
/* Card ngang chiếm toàn hàng */
.card-full  { grid-column: 1 / -1; }
```

### Aspect Ratio Box (giữ tỷ lệ khi resize)

```css
aspect-ratio: 16 / 9;
overflow: hidden;
```

---

## 🎨 Background & Overlay

### Gradient overlay trên ảnh nền

```css
/* Overlay tối từ dưới lên */
&::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%);
  pointer-events: none;
}
```

> Nhớ đặt `position: relative` trên parent.

### Background gradient phức tạp

```css
background: radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.15) 0%, transparent 60%),
            linear-gradient(135deg, #0f0c29, #302b63, #24243e);
```

---

## ✍️ Typography

### Giới hạn số dòng văn bản (Line Clamp)

```css
/* Giới hạn 2 dòng */
display: -webkit-box;
-webkit-line-clamp: 2;
-webkit-box-orient: vertical;
overflow: hidden;
```

### Chữ gradient (Text Gradient)

```css
background: linear-gradient(90deg, #6366F1, #8B5CF6);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
```

### Kiểm soát xuống dòng tự nhiên

```css
/* Tránh chữ cuối bị xuống 1 từ lẻ */
text-wrap: balance;
/* Hoặc cho heading */
text-wrap: pretty;
```

---

## 🔲 Cards & Components

### Card hover lift effect

```css
transition: transform 0.25s ease, box-shadow 0.25s ease;

&:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.12);
}
```

### Glassmorphism card

```css
background: rgba(255, 255, 255, 0.08);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border: 1px solid rgba(255, 255, 255, 0.15);
border-radius: 16px;
```

### Card với badge absolute

```css
/* Parent card */
position: relative;

/* Badge */
position: absolute;
top: 16px;
right: 16px;
```

---

## 📱 Mobile Workarounds

### Horizontal scroll row (no scrollbar)

```css
display: flex;
flex-direction: row;
overflow-x: auto;
scroll-snap-type: x mandatory;
gap: 16px;
padding-bottom: 8px;

/* Ẩn scrollbar */
scrollbar-width: none;
&::-webkit-scrollbar { display: none; }

/* Cards snap */
& > * {
  scroll-snap-align: start;
  flex-shrink: 0;
}
```

### Fix padding trái trên mobile (lề thẳng hàng)

```css
/* Container */
padding-left: 0;
padding-right: 0;

/* Áp dụng trong _cssCustom của container ở breakpoint mobile */
```

---

## 🎬 Animation & Interaction

### Fade-in khi scroll vào view (dùng với Bricks Interactions)

```css
/* State ban đầu */
opacity: 0;
transform: translateY(30px);
transition: opacity 0.6s ease, transform 0.6s ease;

/* State sau khi trigger */
&.is-visible {
  opacity: 1;
  transform: translateY(0);
}
```

### Ticker/Marquee effect thuần CSS

```css
@keyframes ticker {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

.ticker-inner {
  display: flex;
  animation: ticker 20s linear infinite;
  width: max-content;
}
```

---

## 🐛 Bug Fixes phổ biến

### Splide slider overflow clip

```css
/* Nếu slide bị cắt ở edge */
overflow: visible !important;
```

### Image bị méo trong flex container

```css
/* Trên element image */
flex-shrink: 0;
object-fit: cover;
```

### Z-index stacking context

```css
/* Khi absolute element bị ẩn sau parent */
isolation: isolate;
/* Đặt trên parent để tạo stacking context mới */
```

### Container width bị giới hạn không mong muốn

```css
/* Override max-width của Bricks container */
max-width: unset !important;
width: 100%;
```

---

## 📋 Template `_cssCustom` chuẩn

```json
"_cssCustom": "/* Tên element — Mục đích */\ndisplay: grid;\ngrid-template-columns: repeat(3, 1fr);\ngap: 24px;\n\n@media (max-width: 991px) {\n  grid-template-columns: repeat(2, 1fr);\n}\n\n@media (max-width: 767px) {\n  grid-template-columns: 1fr;\n}"
```

> ⚠️ Luôn viết comment đầu để biết CSS này dùng cho element nào và mục đích gì.
