# Quy tắc Ánh xạ Figma sang WordPress Bricks Builder (Figma-to-UI Rules)

Tài liệu này trích lọc các nguyên lý thiết kế từ Figma Auto Layout, Code Connect và các tiêu chuẩn Figma-to-Code sạch (như Builder.io, Locofy) để làm bộ quy tắc hướng dẫn AI phân tích và dịch chuyển đổi cấu trúc Figma thành mã JSON chuẩn của Bricks Builder 1.12.3.

> Verified against Bricks 1.12.3 source (theme path: .../themes/bricks) — 2026-07-14. Đã sửa 1 lỗi: element rich-text thật tên là `text` (không phải `rich-text`). Các claim khác (`_position`/`_top`/`_left`, `_overflow`, `_objectFit`, `_flexGrow`, `_gridGap`) đã đối chiếu source, chính xác.

---

## 1. Ánh Xạ Node Figma Sang Bricks Elements (DOM Structure)

Nguyên tắc cốt lõi: **Không lồng ghép DOM quá sâu (Avoid excessive nesting)**. Chỉ tạo thẻ HTML khi thực sự cần thiết cho bố cục, khoảng cách hoặc căn chỉnh.

| Figma Node Type & Đặc điểm | Bricks Element | Cấu hình HTML Tag đề xuất |
| :--- | :--- | :--- |
| **Frame ngoài cùng (Root Frame)** đại diện cho một phần của trang. | `section` | `<section>` (Luôn là root, không lồng trong thẻ khác) |
| **Frame lớn trực tiếp dưới Root**, có Auto Layout dùng để căn lề giới hạn chiều rộng (ví dụ giới hạn 1200px ở giữa trang). | `container` | `<div>` (Mặc định của Bricks container) |
| **Frame nhóm trung gian (Flex Wrapper)**: Gom nhóm các cột, hàng hoặc khối (nhầm nhóm nút bấm, nhóm thông tin tác giả). | `block` hoặc `div` | `<div>` (`block` tối ưu cho flex/width; `div` cho phần tử cực đơn giản) |
| **Frame đại diện cho 1 Card/Item** (Ví dụ: Thẻ dịch vụ, Thẻ sản phẩm). | `block` | `<article>` hoặc `<div>` |
| **Node TEXT** là tiêu đề chính của trang hoặc của section. | `heading` | `<h1>`, `<h2>`, `<h3>` (Mỗi trang duy nhất 1 thẻ `<h1>`) |
| **Node TEXT** là đoạn văn, mô tả ngắn, danh sách. | `text-basic` | `<p>` hoặc `<span>` |
| **Node TEXT** có nhiều định dạng, xuống dòng, liên kết bên trong. | `text` (KHÔNG phải `rich-text` — tên element thật là `text`, xác thực `includes/elements/text.php:9`, đây là element "rich text" của Bricks) | `<div>` (Bọc nội dung HTML) |
| **Node IMAGE** hoặc Frame được Fill bằng ảnh tĩnh. | `image` | `<img>` (Sử dụng URL ảnh Figma Local) |
| **Node VECTOR / BOOLEAN_OPERATION** đại diện cho icon. | `icon` | `<svg>` (Copy mã SVG inline hoặc dùng thư viện icon) |

---

## 2. Dịch Layout Logic: Flexbox vs Grid (Deep Hierarchy Analysis)

AI phải phân tích ý đồ layout của Figma trước khi chọn Element Bricks:

### 2.1. Khi nào dùng Flexbox (Mặc định)
- Dùng cho các hàng hoặc cột đơn giản (Heading + Text, Group of Buttons, Navbar).
- Bricks element: `block` hoặc `div`.
- Mapping: `Auto Layout Direction` (Horizontal/Vertical) $\rightarrow$ `_direction` (row/column).

### 2.2. Khi nào dùng CSS Grid (Bắt buộc)
- Khi Figma có các phần tử con lặp lại với kích thước đều nhau trên nhiều hàng và cột (ví dụ: Service Grid, Team Members).
- Bricks element: `block` (Đặt display = Grid).
- **Quy tắc dịch**:
  - `Gap` trong Figma $\rightarrow$ `_gridGap`.
  - Số cột $\rightarrow$ `_gridTemplateColumns` (ví dụ: `repeat(3, 1fr)`).

### 2.3. Quy tắc "Phẳng hóa DOM" (Flattening Rules)
Để tránh "Div-itis" (lồng quá nhiều thẻ div thừa), AI phải tuân thủ:
- **Bỏ qua Frame trung gian**: Nếu một Frame trong Figma chỉ chứa duy nhất 1 Frame con và không có style riêng (background, border, shadow), AI phải loại bỏ Frame đó và đưa Frame con lên cấp cao hơn.
- **Gộp Group thành Background**: Nếu một Frame chỉ chứa các hình khối làm nền, hãy dịch nó thành `background` của Frame cha thay vì tạo một element riêng.

---

## 3. Dịch Chế Độ Co Giãn (Resizing & Constraints) - Chuẩn 1.12.3

Ánh xạ chính xác để layout không bị "vỡ" khi thay đổi nội dung hoặc màn hình:

| Figma Resizing | Bricks Setting (Desktop) | Bricks Setting (Mobile) |
| :--- | :--- | :--- |
| **Fixed** | `_width: "{px}"` | `_width: 100%` (nếu {px} > viewport) |
| **Hug contents** | `_width: auto` | `_width: auto` |
| **Fill container** | `_flexGrow: 1` hoặc `_width: 100%` | `_width: 100%` |

- **Quy tắc `min-width`**: Đối với các phần tử chứa văn bản quan trọng, AI nên thiết lập `min-width` tương ứng với giá trị nhỏ nhất có thể đọc được để tránh chữ bị ép quá hẹp.

---

## 4. Xử Lý Spacing & Alignment Thực Dụng

- **Padding/Gap**: Lấy giá trị pixel trực tiếp từ Figma. Nếu giá trị lẻ (ví dụ: `23.7px`), hãy làm tròn về số nguyên gần nhất (`24px`).
- **Căn giữa (Center Alignment)**: 
  - Nếu Frame Figma có `PrimaryAxisAlignItems: CENTER`, hãy đảm bảo element Bricks tương ứng có `justify-content: center`.
  - Luôn kiểm tra `text-align` của các node con để đồng bộ với alignment của container cha.

---

## 5. Quy trình 4 Bước "Deep Context" Cho AI

1.  **Bước 1: Phân tích Hierarchy**: Sử dụng `inspect_figma_nodes` để lấy toàn bộ cây thư mục của node.
2.  **Bước 2: Xác định "Layout Backbone"**: Tìm ra các khung xương chính (Section -> Container -> Grid/Flex).
3.  **Bước 3: Áp dụng Flattening**: Loại bỏ các layer thừa để tối ưu DOM.
4.  **Bước 4: Sinh JSON & Validate G1**: Tạo JSON tuân thủ `bricks_rules.md` (Bản 1.12.3).


---

## 6. Xử Lý Node Figma Đặc Biệt (Special Node Handling)

Một số loại node Figma không có đối chiếu trực tiếp với Bricks elements. Quy tắc xử lý:

### 6.1. Absolute Position (`layoutPositioning: "ABSOLUTE"`)
Node nằm ngoài luồng Auto Layout, có toạ độ tuyệt đối:
- Parent → thêm `"_position": "relative"`
- Node → `"_position": "absolute"` + `"_top"`, `"_left"`, `"_right"`, `"_bottom"` lấy từ Figma x/y tính tương đối với parent

### 6.2. `clipsContent: true` (Clip Content)
Frame Figma có clip content bật → tương đương CSS `overflow: hidden`:
- Thêm `"_overflow": "hidden"` vào settings của element Bricks tương ứng

### 6.3. COMPONENT / COMPONENT_SET Node
- **Không** tạo Bricks Component — treat như Frame thông thường
- Chỉ lấy computed visual properties (kích thước, màu, layout, typography)
- Với component instance: lấy overridden values (props đã được override trên instance), không lấy từ master component

### 6.4. Stroke Type Mapping
Figma phân 3 loại stroke, map sang Bricks khác nhau:

| Figma Stroke Type | Bricks Setting |
|---|---|
| Inner (default) | `_border` → `width` + `style` + `color` |
| Outer | `_boxShadow` → `spread = stroke-width`, `blur = 0` |
| Center | `_cssCustom` → `outline: Npx solid #color` |

### 6.5. Merged Vectors / Multi-layer Illustration
Icon hoặc đồ họa gồm nhiều layer xếp chồng trong Figma:
- **Không** dịch thành nhiều element con lồng nhau
- Export toàn bộ frame cha thành 1 file SVG/PNG duy nhất
- Dùng duy nhất 1 `image` element → DOM phẳng, dễ quản lý

### 6.6. SCALE Constraint
Node có sizing constraint = `SCALE` (co giãn tỷ lệ với parent):
- SCALE ngang → `_width: "100%"` hoặc `_flexGrow: "1"`
- SCALE dọc → không set height (Hug contents)
- SCALE cả 2 (image/video) → `_width: "100%"` + `_height: "100%"` + `_objectFit: "cover"`

