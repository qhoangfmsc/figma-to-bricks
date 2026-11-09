# QUY TẮC DỊCH THUẬT FIGMA (FIGMA_RULES.MD)

Tài liệu này chứa các quy tắc ánh xạ và chuyển đổi thuộc tính từ thiết kế Figma (Auto Layout, Variables) sang các thuộc tính CSS tương thích với Bricks Builder.

---

## 1. Ánh xạ Auto Layout sang CSS Flexbox

### 1.1 Hướng (Direction)
- Figma **Horizontal** -> CSS `_direction: "row"`
- Figma **Vertical** -> CSS `_direction: "column"`

### 1.2 Khoảng cách (Gap / Item Spacing)
- Figma `itemSpacing` -> CSS `_gap` (Giữ nguyên đơn vị `px` trực tiếp từ Figma, ví dụ: `"24px"`).

### 1.3 Căn lề trục (Alignment)
- **Trục chính (primaryAxisAlignItems)**:
  - `MIN` -> `justify-content: "flex-start"`
  - `CENTER` -> `justify-content: "center"`
  - `MAX` -> `justify-content: "flex-end"`
  - `SPACE_BETWEEN` -> `justify-content: "space-between"`
- **Trục phụ (counterAxisAlignItems)**:
  - `MIN` -> `align-items: "flex-start"`
  - `CENTER` -> `align-items: "center"`
  - `MAX` -> `align-items: "flex-end"`
  - `STRETCH` -> `align-items: "stretch"`

---

## 2. Quy tắc Co giãn Kích thước (Resizing Constraints)

### 2.1 Chiều rộng (Width)
- **Fixed Width**: Giữ nguyên giá trị pixel tuyệt đối từ Figma (ví dụ: `"320px"`).
- **Hug Contents**: Không khai báo thuộc tính `_width`, hoặc đặt là `auto`/`fit-content`.
- **Fill Container**: 
  - Nếu ở trong Flex Row: Thiết lập `_flexGrow: "1"`.
  - Nếu ở các trường hợp thông thường: Thiết lập `_width: "100%"`.

### 2.2 Chiều cao (Height)
- Thông thường chiều cao nên tự động (`Hug contents`) để tránh vỡ chữ khi màn hình nhỏ lại hoặc chữ xuống dòng.
- Chỉ dùng `Fixed Height` cho các phần tử đặc biệt: Avatar, Icon, Banner tỷ lệ cố định, nút bấm tiêu chuẩn.

---

## 3. Đồng bộ hóa Typography & Border
- **Font size & Spacing**: Toàn bộ kích thước chữ, padding, margin đo được từ Figma bằng px phải được **giữ nguyên đơn vị là `px`** trực tiếp (Ví dụ: 18px -> `"18px"`, 24px -> `"24px"`) thay vì quy đổi sang rem.
- **Bo góc & Đường viền (Border Radius & Border)**:
  - Figma Border Radius -> Map vào `_border.radius.top/right/bottom/left`.
  - Figma Stroke -> Map vào `_border.width` và `_border.style` cùng `_border.color`.

---

## 4. Xử lý khi thiếu thiết kế Mobile (Single Desktop Frame)
Trường hợp chỉ nhận được duy nhất 1 link Figma Desktop và không có link Figma Mobile, AI bắt buộc phải tự triển khai Responsive như sau:
- **Tự động xếp chồng (Vertical Stack)**: Tại breakpoint `:tablet_portrait` (hoặc tối muộn là `:mobile_landscape`), toàn bộ các hàng Flexbox đa cột (`_direction: "row"`) có kích thước cột nhỏ hơn 50% màn hình phải được đổi sang chiều dọc (`_direction: "column"`) để đảm bảo không bị tràn chữ.
- **Tự động co giãn kích thước (Width Auto)**: Các block có chiều rộng cố định (Fixed Width) ở Desktop khi thu nhỏ xuống Mobile phải được chuyển sang `_width: "100%"` hoặc `_width: "auto"` để tránh bể layout.
- **Tự động giảm font-size và padding**: 
  - Typography: Giảm tỷ lệ chữ ở breakpoint di động từ 15% - 25% đối với các tiêu đề lớn (`heading` h1, h2, h3).
  - Spacing: Các khoảng padding lớn của container/section (>60px) phải giảm xuống 30px - 40px trên di động.
- **Kế hoạch tự động**: Phải mô tả rõ các hành động responsive tự động này trong file kế hoạch [todo/plans/<page-slug>.md] để người dùng nắm thông tin ở bước phê duyệt.

---

## 5. Quy tắc gộp Button (Button Consolidation)
Trong Figma, một nút bấm (Button) thường được vẽ bằng một Auto Layout Frame (chứa màu nền, bo góc, padding) và bên trong chứa 1 layer chữ (Text) cùng 1 layer Icon (Vector/SVG).

- **LỖI THƯỜNG GẶP**: Dịch 1-đến-1 thành 3 elements trong Bricks: `block` (Làm wrapper nút) -> chứa `text-basic` + `icon/svg` (Làm con). Việc này gây phình DOM (Gate G2.5 cảnh báo) và khó quản lý hover/active.

- **QUY TẮC PHÂN BIỆT BẮT BUỘC**:
  1. **Chỉ gộp thành phần tử `button` nguyên bản khi Frame đó thực sự là nút bấm**:
     - Tên layer chứa từ khóa nút: `button`, `btn`, `cta`, `action`...
     - Hoặc có kiểu dáng nút rõ rệt (dạng pill bo góc, màu nền nổi bật/border nét đứt click, và có thuộc tính liên kết `link`).
     - **Thực hiện**: Sử dụng duy nhất phần tử **`button`** nguyên bản của Bricks. Cấu hình chữ trong `"text"`, icon trong cài đặt `"icon"` của button (`iconPosition`, `iconGap`), không tạo thêm con.
     - **Lưu ý về CORS của SVG Icon**: Bricks tải và inline SVG vào nút bấm. Nếu liên kết SVG nằm trên server khác (khác domain/port), trình duyệt sẽ chặn hiển thị do lỗi CORS. Do đó, toàn bộ SVG dùng làm icon cho native button phải được tải lên **thư mục upload cục bộ của WordPress** (ví dụ: `wp-content/uploads/...`) để đảm bảo cùng tên miền (Same-Origin).
  
  2. **KHÔNG gộp các hàng thông tin/danh sách (Non-Button Text + Icon Row)**:
     - Các khối như: Dòng danh sách tính năng (ví dụ: `Feature frame` chứa checkbox và text như hình bạn chụp), dòng thông tin liên hệ (icon phone + text số điện thoại), badge trạng thái... tuy cấu trúc cũng chứa 1 Text + 1 Icon nhưng không có vai trò tương tác click/nút bấm.
     - **Thực hiện**: **Bắt buộc** dịch thành cấu trúc: 1 `block` hoặc `div` (thiết lập `_direction: "row"`, `_alignItems: "center"`, `_gap` phù hợp) bọc ngoài $\rightarrow$ bên trong chứa 2 phần tử con riêng biệt là **`icon`** (hoặc `svg`) và **`text-basic`**. Thiết lập thẻ tag HTML cho block cha là `div` hoặc `li` (nếu nằm trong thẻ danh sách `ul`).

---

## 6. Quy tắc Xử lý Hình ảnh & SVG (Image & SVG Rules)
Để tối ưu hóa tính responsive, tránh hiện tượng vỡ tỷ lệ ảnh (Aspect Ratio Shift) và dễ dàng kiểm soát kích thước:
- **Bắt buộc bọc Div cho ảnh lớn**: Mọi phần tử `image` con đại diện cho ảnh minh họa/banner phải được bọc trong một thẻ `div` hoặc `block` làm khung chứa (wrapper).
- **Phân chia thuộc tính**:
  - **Khung chứa (wrapper `div`/`block`)**: Nhận các thuộc tính chiều rộng `_width` (hoặc `max-width`), chiều cao `_height`, tỷ lệ `_aspectRatio`, và căn lề từ Figma.
  - **Phần tử ảnh (`image` con)**: Luôn đặt kích thước `width: 100%` và `height: 100%`. Thuộc tính `Object fit` được thiết lập trực tiếp trên cài đặt của element image (ví dụ: `cover`, `contain` hoặc `fill` tùy theo thiết kế Figma) để ảnh tự động lấp đầy khung chứa mà không bị méo.
- **Quy tắc gộp nhiều phần tử Vector (Merged Vectors)**:
  - Nếu một icon hoặc minh họa trong Figma được cấu thành từ nhiều phần tử con xếp chồng (ví dụ: bóng chat xanh ở dưới, dấu chấm trắng ở trên), **tuyệt đối không xuất rời rạc** và dựng lồng nhau trên Web.
  - Phải **gộp (export) toàn bộ Frame cha** thành một tệp hình ảnh/SVG duy nhất rồi sử dụng một phần tử `image` duy nhất để hiển thị, đảm bảo DOM phẳng và dễ quản lý.

---

## 7. Xử Lý Node Figma Đặc Biệt

Các loại node Figma không có đối chiếu 1-1 với Bricks elements, cần xử lý theo quy tắc sau:

### 7.1. Absolute Position Node
Node có `layoutPositioning: "ABSOLUTE"` trong Figma (absolute positioned trong Auto Layout):
```json
// Parent phải có:
"_position": "relative"

// Element tuyệt đối:
"_position": "absolute",
"_top": "24px",
"_left": "0px"
// (dùng giá trị x, y từ Figma tính tương đối với parent)
```

### 7.2. CLIP_CONTENT = true
Frame Figma có `clipsContent: true` (tương đương `overflow: hidden`):
```json
"_overflow": "hidden"
// Đặt trên element parent tương ứng
```

### 7.3. COMPONENT / COMPONENT_SET Node
- Treat như Frame thông thường — **không tạo Bricks Component** từ Figma Component
- Chỉ extract visual properties (size, colors, typography, layout)
- Bỏ qua component metadata (variantProperties, componentSetId...)
- Nếu node là một instance của component, lấy computed values (overridden props) thay vì master component values

### 7.4. Stroke Type Mapping
Figma có 3 loại stroke (Inner / Outer / Center) → map khác nhau vào Bricks:

| Figma Stroke | Bricks JSON |
|---|---|
| **Inner** | `_border` với `width`, `style`, `color` |
| **Outer** | `_boxShadow` với `values.spread = stroke-width`, `values.blur = 0`, `inset = false` |
| **Center** | `_cssCustom`: `outline: {width}px solid {color}` |

```json
// Inner stroke → border
"_border": {
  "width": { "top": "1px", "right": "1px", "bottom": "1px", "left": "1px" },
  "style": "solid",
  "color": { "hex": "#E5E7EB" }
}

// Outer stroke → boxShadow
"_boxShadow": {
  "values": { "offsetX": "0", "offsetY": "0", "blur": "0", "spread": "2" },
  "color": { "hex": "#2563EB" }
}
```

### 7.5. Figma SCALE Constraint
Node có constraint `SCALE` (co giãn theo tỷ lệ với parent):
- Nếu SCALE theo chiều ngang → `_width: "100%"` hoặc `_flexGrow: "1"`
- Nếu SCALE theo chiều dọc → không set height cứng (`Hug contents`)
- Nếu SCALE cả 2 → `_width: "100%"` + `_height: "100%"` + `_objectFit: "cover"` (cho image)



