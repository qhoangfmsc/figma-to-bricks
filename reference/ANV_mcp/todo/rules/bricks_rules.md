# QUY TẮC CẤU HÌNH BRICKS BUILDER (BRICKS_RULES.MD)

> **Site target**: đọc từ `.env` (`WP_URL`) — quy trình dùng CHUNG cho mọi môi trường, không phân biệt local/remote · Bricks: **xem §0 (đang chuyển 2.x)** · PHP 7.4 · CSS loading: **External files** (`sync_css=True` bắt buộc sau mỗi upload)

Tài liệu này chứa các quy tắc kỹ thuật bắt buộc phải tuân theo khi tạo hoặc sửa đổi chuỗi JSON Bricks để đảm bảo cấu trúc JSON hợp lệ và không bị builder từ chối.

---

## 0. ⚠️ CHUYỂN ĐỔI BRICKS 2.x — checklist re-verify BẮT BUỘC trước section đầu tiên (2026-07-23)

**Bối cảnh**: site đích chạy 1.9.8, không lấy được bản 1.12.3 → user quyết định update lên **2.x**. Mọi mục "(xác thực từ source)" trong file này được grep từ source **1.12.3** — trên 2.x một số hành vi **chắc chắn hoặc có khả năng khác**. Nguyên tắc quá độ: **vẫn sinh JSON shape 1.x** (2.x đọc ngược được), chưa dùng key 2.x-only (`slots`, `styleVariants`, utility class Style Manager) cho tới khi từng mục dưới đây được verify lại.

**Kết quả re-verify (2026-07-23, site đã lên Bricks 2.3.9 — probe template id 68 "ANV 2.x probe — safe to delete", CSS compile đọc thật từ `post-68.min.css`):**

| # | Mục cần re-verify | Kết quả | Trạng thái |
|---|---|---|---|
| 0a | Bridge hoạt động trên 2.3.9 | `get_site_info`/`create_template`/`set_template_content`/`generate_css_file` đều OK — entry point `\Bricks\Assets_Files::generate_post_css_file` vẫn tồn tại y nguyên | ✅ 2026-07-23 |
| 0b | §21 `.brxe-container{width:1100px}` + §18 `.brxe-block{width:100%}` | **GIỮ NGUYÊN cả hai** (grep cả `frontend.min.css` lẫn `frontend-light-layer.min.css` đang được site load) — rule §18/§21 tiếp tục bắt buộc | ✅ 2026-07-23 |
| 0c | `_gap` trên nestable | **VẪN KHÔNG compile** (probe `_gap:17px` không ra CSS; `_columnGap:19px`/`_rowGap:23px` ra đúng) — trap G1 GIỮ NGUYÊN mức error | ✅ 2026-07-23 |
| 0d | Shapes `_borderRadius`/`_minWidth`/`_objectFit`/`_gradient`/`_color` | Probe thực nghiệm: `_borderRadius` ❌ (dùng `_border.radius` ✅) · `_minWidth` ❌ (dùng `_widthMin` ✅) · `objectFit` không gạch ❌ (`_objectFit` ✅) · `_gradient` ✅ compile · `_color` ❌ (dùng `_typography.color` ✅) — **mọi trap §15 giữ nguyên trên 2.3.9** | ✅ 2026-07-23 (empirical) |
| 0e | `%root%` phía server | **VẪN KHÔNG được thay** — chuỗi `%root%` nguyên văn nằm trong CSS compile ra → tiếp tục tự replace `#brxe-{id}` khi sinh JSON (§13) | ✅ 2026-07-23 (empirical) |
| 0f | Element `code` (signature) + workaround `customScripts*` page settings | Chưa test — probe khi build page đầu tiên trên 2.x (workaround page settings là đường chính, element `code` vẫn tránh dùng) | ☐ |
| 0g | Thứ tự cascade §22 | **PHÁT HIỆN MỚI 2.x**: toàn bộ CSS Bricks giờ nằm trong **`@layer bricks`** (post-CSS bọc `@layer bricks{...}`; theme load `frontend-light-layer.min.css` với sub-layers `bricks.reset, bricks.gutenberg, bricks.icons`). Hệ quả: CSS **unlayered** từ plugin/nguồn ngoài sẽ THẮNG mọi CSS Bricks bất kể specificity (kể cả `#brxe-`) — site hiện tại không load bundle unlayered nào nên chưa ảnh hưởng, nhưng khi thấy style "bị đè vô cớ" hãy nghi layer trước. Thứ tự bucket đầy đủ bên trong layer: cần source (chưa chặn việc build) | 🟡 partial |
| 0h | §14 preview template + §16 `_display: contents` | Chưa re-verify — workaround page tạm (§14) không phụ thuộc chi tiết source, tiếp tục dùng; `display:contents` probe khi gặp carousel-dual đầu tiên | ☐ |
| 0i | Clipboard `version` + key 2.x-only | Bridge bỏ qua field `version` khi upload (đã xác nhận qua source plugin) — giữ hoặc đổi "2.3.9" đều được; khi paste tay trong builder dùng "2.3.9". `slots`/`styleVariants`/utility classes: **vẫn chưa dùng** cho tới khi có rule verified | ✅ 2026-07-23 |
| 0j | Re-audit `references/*` | Làm dần khi build thật — các trap chính đã probe ở 0c/0d nên rủi ro còn lại thấp | ☐ ongoing |

**Kết luận sau probe**: bộ rules hiện hành (shape 1.x) **dùng được nguyên trạng trên 2.3.9** — mọi trap then chốt hành xử y hệt. 3 mục còn lại (0f/0h/0j) không chặn build, xử lý khi chạm tới trong phiên thực tế. Nguồn source 2.x (nếu cần grep sâu thêm): thư mục theme local `vietnix.vn/wp-content/themes/bricks` vẫn là 1.12.3, KHÔNG đại diện cho site.

---

## 1. Định dạng JSON Node (Bricks Element Shape)

Mỗi phần tử (node) trong mảng `content` của Bricks phải có cấu trúc như sau:

```json
{
  "id": "abc123", // Đúng 6 ký tự alphanumeric (Chữ và số, không ký tự đặc biệt, không dùng ký tự lạ)
  "name": "heading", // Tên element hợp lệ (ví dụ: section, container, block, heading, text-basic...)
  "parent": "xyz789", // ID của node cha, hoặc "0" nếu là root
  "children": [], // Mảng chứa ID các node con trực tiếp
  "settings": {}, // Các thông số cấu hình và CSS
  "label": "Nhãn cấu trúc" // Nhãn hiển thị trong bảng điều khiển của Bricks
}
```

- **Không trùng lặp**: Mọi ID trong mảng phải là duy nhất. Dùng script [generate_random_id.py](<file:///Users/truongduylinh/Documents/Web%20Project/MCP/ANV_mcp/todo/scripts/generate_random_id.py>) để sinh ID ngẫu nhiên cho từng element (`sanitize_json_ids.py` không tồn tại — cố ý không viết, xem `AGENTS.md` §5).
- **Ràng buộc hai chiều**: Nếu node A có con là B (`children: ["B"]`), thì thuộc tính `parent` của B phải là A (`parent: "A"`).

## 2. Quy cách đặt giá trị thuộc tính (Value Shapes)

- **Đơn vị kích thước**: Sử dụng **`px` làm đơn vị chủ đạo** cho tất cả các thông số kích thước, khoảng cách (ví dụ: `"24px"`, `"16px"`, `"120px"`), ngoại trừ các trường hợp tỷ lệ phần trăm (ví dụ: `"100%"`, `"50%"`). Luôn truyền giá trị kèm đơn vị dạng chuỗi (không dùng số trần như `24`).
- **Màu sắc (Colors)**:
  - Nếu dùng Hex/RGBA trực tiếp: `{"hex": "#1a73e8"}` hoặc `{"hex": "rgba(26, 115, 232, 1)"}`.
  - Nếu dùng biến CSS toàn cục: `{"raw": "var(--color-primary)"}`.
- **Typography (Kiểu chữ)**: Khai báo bằng các thuộc tính CSS chuẩn làm key viết trong dấu gạch ngang (không dùng camelCase):
  ```json
  "_typography": {
    "font-family": "Inter",
    "font-size": "18px",
    "font-weight": "600",
    "line-height": "28px"
  }
  ```
- **Bóng đổ (Box Shadow)**: Các thông số kích thước của bóng đổ phải nằm trong đối tượng `values`:
  ```json
  "_boxShadow": {
    "values": {
      "offsetX": "0",
      "offsetY": "8",
      "blur": "16",
      "spread": "0"
    },
    "color": { "hex": "rgba(0,0,0,0.1)" }
  }
  ```
- **⚠️ Gap (KHOẢNG CÁCH FLEX/GRID) — KHÔNG dùng `_gap` cho container**: Bricks 1.12.3 **không compile** `_gap` cho các element dạng container (`block`, `container`, `div`, grid) — CSS sẽ bị bỏ silently, khiến các item dính nhau (0px). Chỉ riêng element `button` mới nhận `_gap`. Bắt buộc dùng các key riêng:
  - Flex/grid ngang: `_columnGap` → `column-gap`
  - Flex/grid dọc: `_rowGap` → `row-gap`
  - Grid shorthand: `_gridGap`

  ```json
  "_display": "flex", "_direction": "row", "_columnGap": "8px"
  "_display": "flex", "_direction": "column", "_rowGap": "16px"
  "_display": "grid", "_gridTemplateColumns": "371px 1fr 1fr", "_columnGap": "16px", "_rowGap": "16px"
  ```

  Đặt cả `_columnGap` + `_rowGap` cùng giá trị là cách an toàn nhất vì hoạt động đúng cho cả flex (row/column) lẫn grid ở mọi breakpoint. Vẫn tuân thủ cú pháp responsive (`_columnGap:tablet_portrait`).

## 3. Quy tắc Responsive & Pseudo States (Responsive Grammar)

Bricks sử dụng định dạng khóa `thuộc_tính:breakpoint:pseudo` phân tách bởi dấu hai chấm `:`:

- **Cú pháp cơ bản**: `_padding:tablet_portrait`, `_background:hover`, `_margin:mobile_portrait:hover`.
- **Tên breakpoint mặc định**:
  - Desktop: Không cần thêm breakpoint suffix (bare key).
  - Tablet Portrait (Dưới 991px): `:tablet_portrait`
  - Mobile Landscape (Dưới 767px): `:mobile_landscape`
  - Mobile Portrait (Dưới 478px): `:mobile_portrait`

## 4. Đồng bộ Class toàn cục (Global Classes)

- Bất kỳ class nào được tham chiếu trong mảng `_cssGlobalClasses` của một element phải có định nghĩa đầy đủ (gồm ID, tên class, và settings của class đó) nằm trong mảng `globalClasses` cấp cao nhất của chuỗi JSON clipboard.

## 5. Quy tắc phân phối tài nguyên (Asset Origin Rule)

- Mọi tài nguyên đồ họa dạng **SVG media** (`icon.svg.id`, ảnh SVG upload lên Media Library) dùng làm icon cho phần tử `button` nguyên bản bắt buộc phải được lưu trữ trực tiếp trên máy chủ WordPress cùng tên miền (Same-Origin) trong thư mục `wp-content/uploads/...` để tránh lỗi bảo mật CORS khi trình duyệt biên dịch và inlined SVG.
- **Icon-font (`icon.icon` + `icon.library`, xem mục 5b) KHÔNG bị ràng buộc này** — nó render ra `<i class="...">`, không fetch file riêng, nên không có vấn đề CORS. Ưu tiên dùng icon-font khi Figma icon match được với 1 icon có sẵn trong `ionicons`/`themify`/`fontawesomeBrands`.

### 5b. Control `icon` cho element `button` (xác thực từ Bricks core source `includes/elements/button.php`)

Đã grep trực tiếp source PHP của theme Bricks (không phải đoán): `button.php` định nghĩa control `icon` (type `icon`), `iconPosition` (`left`/`right`, mặc định `right` nếu bỏ trống), `iconGap`, `iconSpace`, `iconTypography`. Shape giá trị `settings.icon` có 2 dạng, xác thực qua `render_icon()` (`includes/elements/base.php`) và ví dụ thật trong `accordion.php`/`icon.php`:

- **Icon-font** (khuyến nghị, không CORS):
  ```json
  "icon": { "icon": "ion-ios-arrow-forward", "library": "ionicons" },
  "iconPosition": "right"
  ```
- **SVG media** (bắt buộc same-origin, xem mục 5):
  ```json
  "icon": { "svg": { "id": 123, "url": "...", "filename": "arrow.svg" }, "fill": true, "stroke": false }
  ```

`iconPosition` chỉ nhận `"left"` hoặc `"right"`; bỏ trống mặc định là `"right"` (phù hợp cho mũi tên cuối nút CTA). Đây thay thế cách né tránh trước đây là chèn ký tự unicode "→" vào text — dùng icon control thật sẽ khớp đúng font-icon/kích thước/gap như thiết kế Figma.

## 6. Kinh nghiệm căn lề & kiểu chữ di động thực tế (Mobile Grid & Typography Alignment)

- **Căn thẳng hàng lề đứng di động (Consistent Left Alignment)**:
  - Tránh để container (`cnt200`) sử dụng padding mặc định không kiểm soát của Bricks. Hãy ghi đè rõ ràng: `_padding:mobile_portrait: { left: "0px", right: "0px" }`.
  - Đối với mọi phần tử tiêu đề và khối chữ có độ rộng cố định từ Figma (ví dụ: `343px`), hãy thiết lập: `_widthMax:mobile_portrait: "343px"` và `_width:mobile_portrait: "100%"`. Khi container có `align-items: center`, các khối này tự động căn giữa và lề trái sẽ thẳng tắp cùng một tọa độ (ví dụ: `x=23.5px` trên viewport `390px`).
  - Đối với các khối cuộn ngang (như thẻ card chứng chỉ `grd220`), hãy đặt padding trái/phải trên di động đúng bằng khoảng cách lề (ví dụ: `24px`) để điểm bắt đầu của thẻ card đầu tiên thẳng hàng tuyệt đối với lề của các phần tử tiêu đề ở trên.
- **Tránh giới hạn chiều rộng Desktop tùy tiện**: Không thiết lập max-width (ví dụ: `900px`) cho khối văn bản mô tả trên desktop nếu Figma để mặc định, để tránh làm thay đổi nhịp xuống dòng tự nhiên của phông chữ.
- **Quản lý phông chữ (Font-Family)**: Khai báo rõ phông chữ nhận diện thiết kế (ví dụ: `"Roboto"`) trên các cài đặt typography của Bricks.
- **Đoạn văn bản HTML sạch**: Không nhúng các class Tailwind inline (như `leading-[28px]`) vào thẻ `<p>` trong dữ liệu HTML. Hãy viết HTML sạch và sử dụng cài đặt CSS Custom của Bricks (`_cssCustom` nhắm mục tiêu `root p`) để kiểm soát font, line-height, margin đoạn văn một cách trực quan và responsive.

## 7. Cấu hình Slider với `splideJson` (Slider-Nested Advanced)

Khi cần tùy chỉnh slider vượt ngoài settings mặc định của Bricks (đặc biệt cho ticker, carousel responsive, hoặc sync slider), sử dụng key `splideJson` để truyền raw Splide.js config:

- **Kích hoạt**: Trong builder → đổi **Options type = "Custom"** → paste JSON vào field `splideJson`.
- **JSON phải hợp lệ tuyệt đối**: Double quotes cho tất cả key/value string, không trailing comma.
- **Breakpoints trong splideJson**: Dùng số nguyên px làm key (KHÔNG dùng Bricks `:tablet_portrait`):
  ```json
  {
    "type": "loop",
    "perPage": 3,
    "gap": "24px",
    "autoplay": true,
    "interval": 4000,
    "pauseOnHover": true,
    "speed": 600,
    "breakpoints": {
      "991": { "perPage": 2 },
      "767": { "perPage": 1 }
    }
  }
  ```
- **Ticker (continuous scroll) KHÔNG có sẵn trong Bricks**: Phải load thêm `splide-extension-auto-scroll.min.js` và dùng Code element để mount extension:
  ```javascript
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      const inst = window.bricksData?.splideInstances['brxe-ELEMENT_ID'];
      if (inst) {
        inst.destroy(true);
        inst.mount({ AutoScroll: window.splide.Extensions.AutoScroll });
      }
    }, 200);
  });
  ```
- **Truy cập API Splide**: `window.bricksData.splideInstances['brxe-ELEMENT_ID']` → `.go()`, `.on('move', fn)`.

## 8. Format Upload bricksCopiedElements (Bricks 1.12.3)

Khi gọi MCP tool `set_template_content`, sử dụng **bricksCopiedElements clipboard payload** tương thích với 1.x:

```json
{
  "content": [ /* elements array */ ],
  "source": "bricksCopiedElements",
  "sourceUrl": "http://localhost:8000",
  "version": "1.12.3",
  "globalClasses": [ /* full class objects */ ],
  "globalElements": []
}
```

**⚠️ Lưu ý cho bản 1.12.3**:

- Đảm bảo `version` luôn là `"1.12.3"`.
- `globalClasses` phải chứa đầy đủ các class được tham chiếu trong `_cssGlobalClasses` của các element.
- **Tuyệt đối KHÔNG** sinh các key `slots` hoặc `styleVariants` (đây là tính năng của bản 2.x, bản 1.x sẽ gây lỗi render).

## 9. Quản lý Style & Design Tokens (Bricks 1.12.3 Logic)

Vì Bricks 1.12.3 chưa có Style Manager tập trung (v2.2+), quy trình quản lý style phải tuân thủ:

- **Ưu tiên Global Classes**: Mọi style lặp lại (nút, tiêu đề, khoảng cách chuẩn) phải được lưu vào Global Class thay vì style trực tiếp trên element ID.
  - *Ghi chú lịch sử*: `autonomous_workflow.md` (đã gộp vào `AGENTS.md`, xem đầu file) từng đề xuất tiền tố `anv-` cho mọi Global Class, nhưng quy ước này chưa từng được dùng trong build thực tế (grep toàn project không thấy) — không bắt buộc, chỉ ghi lại để không mất thông tin khi dọn file cũ.
  - **Naming convention khi dùng Global Class** (tham khảo cross-check 2026-07-22 từ hệ sinh thái skill Bricks bên ngoài, không phải phát hiện qua source): kebab-case chữ thường (`.card`, `.hero-text`), tách **base + modifier riêng** thay vì gộp cứng (`.button` + `.button--red`, không viết `.button-red`) — dễ tái dùng/mở rộng hơn khi số lượng class tăng.
- **Theme Styles làm Gốc**: Sử dụng Theme Styles để định nghĩa Typography toàn cục (h1-h6, text-basic). AI chỉ ghi đè style trên element khi thiết kế Figma Diverge (khác biệt) so với Theme.
- **CSS Variables (Thủ công)**:
  - Nếu cần dùng Variable, hãy định nghĩa chúng trong **Bricks > Settings > Custom CSS** hoặc dùng plugin quản lý biến.
  - Trong JSON, gọi biến qua: `{"raw": "var(--color-primary)"}`.
- **Xử lý Spacing & Color (Fallback)**:
  - Nếu web chưa có hệ thống Variable, sử dụng mã màu `hex` và `px` trực tiếp.
  - Luôn ghi chú trong Plan nếu sử dụng các giá trị hardcode để dễ dàng migrate lên class sau này.
- **Cấm tự ý tạo Variables mới**: AI chỉ được phép dùng các biến CSS hiện có trên site (quét qua `get_site_info`). Nếu không có, bắt buộc dùng `hex/px` hoặc tạo Global Class mới.

---

## 10. Scripts Workflow (Python) — Công cụ tái dùng

Các scripts trong `todo/scripts/` — chạy từ thư mục `todo/`:

### Spec IR (Flow 1B) — DEPRECATED, không dùng

> **Quyết định 2026-07-20**: Flow 1B (SPEC-driven) bị loại bỏ khỏi quy trình chính thức. `validate_spec.py` và `spec_to_elements.py` không tồn tại và **sẽ không được viết** — đánh giá lại cho thấy không đáng xây (bottleneck thật là review G4 bằng mắt, không phải bước sinh JSON; xem `AGENTS.md` §5 để biết lý do đầy đủ). Schema IR (`skills/figma-bricks/schema/`) giữ lại làm tài liệu lịch sử.
>
> **Dùng Flow trực tiếp thay thế**: viết JSON bằng Python script build thủ công (hoặc viết tay) theo `elements-catalog.md`/`element-base-controls.md`, như các phiên build gần đây đã làm.
>
> Khi G4 thấy lệch → **sửa trực tiếp** `bricks-json/<sec>.json` theo delta → re-upload. Không có tầng spec.json trung gian.

### Build & Validate (Flow DO)

| Script                                | Lệnh                                                                                                                                                                                            | Khi nào                                                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Validate JSON**               | `python3 scripts/validate_template_json.py bricks-json/sec100.json`                                                                                                                            | Sau mỗi Phase                                                                                                                 |
| **Validate structure**          | `python3 scripts/validate_section_structure.py sec100 plans/<slug>.md bricks-json/sec100.json`                                                                                                 | Sau Phase 1                                                                                                                                           |
| **Zoom evidence (per-element)** | `python3 scripts/capture_zoom_evidence.py --url <page_url> --viewport desktop --out-dir scratch/g3/zoom --element <brxe_id>:<label> [--element ...]`                                           | Trước G4 preflight — chạy 1 lần cho desktop, 1 lần cho mobile, chọn element theo checklist Z1-Z5 (`review-skill/rubric.md`)                  |
| **Diff khách quan (khuyến nghị)** | `python3 scripts/diff_screenshots.py --figma scratch/g3/figma-sec100-desktop.png --wp scratch/g3/sec100-desktop.png --out-dir scratch/g3/diff --label sec100-desktop` | Trước G4 preflight — tín hiệu % pixel lệch + heatmap bổ trợ rubric, không hard-block (2026-07-20) |
| **G4 preflight (hard gate)**    | `python3 scripts/validate_g4_preflight.py bricks-json/sec100.json --template-id <ID> --desktop scratch/g3/sec100-desktop.png --mobile scratch/g3/sec100-mobile.png --zoom-dir scratch/g3/zoom --diff-report-desktop scratch/g3/diff/sec100-desktop-report.json` | **BẮT BUỘC trước khi ghi G4 PASS/DONE** — FAIL nếu thiếu `--zoom-dir`/evidence. Xem mục 17 và `review-skill/rubric.md` §HARD GATE |
| **Run all gates**               | `python3 scripts/review_gates.py sec100 plans/<slug>.md bricks-json/sec100.json`                                                                                                               | Kiểm tra tổng hợp                                                                                                                                  |
| **Screenshot**                  | `python3 scripts/screenshot_templates.py --all-sections --full-page`                                                                                                                           | Cuối mỗi Phase                                                                                                                                      |
| **Mobile overflow (hard gate)** | `python3 scripts/validate_mobile_overflow.py --page-id <page_id> --viewport 390`                                                                                                                | **BẮT BUỘC trên trang thật** sau khi assemble page, trước DONE — đo `scrollWidth` thay vì nhìn mắt. Xem mục 21, 23 |
| **Inspect Figma node**          | `python3 scripts/inspect_figma_nodes.py --file-key <key> --node <node_id>`                                                                                                                     | Đọc Figma (file-key có thể đặt `FIGMA_FILE_KEY` trong `.env`)                                                                                     |
| **Dump spacings**               | `python3 scripts/dump_figma_spacings.py --file-key <key> --node sec100=<node_id>`                                                                                                              | Đọc spacing Figma                                                                                                                                   |
| **Re-host assets (trước công bố)** | `python3 scripts/rehost_assets.py bricks-json/<sec>.json --apply`                                                                                                                           | Chuyển ảnh Figma cache → WP Media, thay URL trong JSON (xem mục 11) — sau đó re-upload JSON                                                        |
| **Gen random ID**               | `python3 scripts/generate_random_id.py`                                                                                                                                                        | Sinh ID ngẫu nhiên cho element                                                                                                                     |

**Upload lên Bricks** — dùng `bricks-mcp` tool (không dùng script):

```
bricks-mcp: set_template_content(template_id, elements_json)
```

**Gộp section template thành 1 page thật** (bước còn thiếu trong tài liệu cũ — xác nhận qua `references/popups-and-templates.md` + dùng thành công 4 lần trong phiên 2026-07-22): sau khi mỗi section đã là 1 `bricks_template` (type `section`) riêng qua G1→G2.5, **không** copy nội dung element trực tiếp vào page — dùng element `template` tham chiếu ID:

```json
{ "id": "aaa100", "name": "template", "parent": "0", "children": [], "settings": { "template": "9130" }, "label": "Hero Banner" }
```

Page thật = 1 mảng phẳng gồm N element `template` (mỗi cái parent `"0"`, `settings.template` = ID của 1 section template), thứ tự trong mảng quyết định thứ tự hiển thị. Upload bằng `set_page_content(page_id, elements)`. Ưu điểm: sửa 1 section sau này chỉ cần `set_template_content` lại đúng ID đó, không phải đụng vào page.

**Import Python client** (trong script khác):

```python
from scripts.lib.bricks_mcp import get_site_info, set_template_content, SECTION_REVIEW_PAGE_SETTINGS
```

---

## 11. Assets — Figma Export Cache + Re-host (quy tắc CHUNG mọi môi trường)

- **Figma Desktop App** chạy local server tại `localhost:3845` — serve ảnh export tự động. **URL format**: `http://localhost:3845/assets/<hash>.<ext>` (png, jpg, svg, webp).
- **Trong lúc BUILD**: dùng trực tiếp URL này cho `image.url` / `background.image.url` — mọi gate/screenshot đều chạy trên máy build (nơi Figma Desktop mở) nên hoạt động giống hệt nhau bất kể site WP đặt ở đâu. **⚠️ Figma Desktop phải đang chạy.**
- **Trước khi CÔNG BỐ trang cho khách thật** (bất kể site local hay remote — trình duyệt của người khác không bao giờ thấy `localhost:3845` của máy build):
  ```bash
  python3 scripts/rehost_assets.py bricks-json/<sec>.json --apply   # tải từ Figma cache → upload WP Media (bridge upload_media, plugin >= 1.3.0) → thay URL trong JSON
  # sau đó re-upload JSON (upload_section.py / set_template_content) + screenshot xác nhận lại
  ```
  G1 (`validate_template_json.py`) in cảnh báo gộp khi JSON còn URL Figma cache để bước này không bị quên.
- **KHÔNG dùng WP media `id` trần (không có `url`)** trong JSON — id không resolve khi ghi trực tiếp qua `set_template_content`. Sau khi re-host, JSON dùng URL của chính site (kèm `id` nếu có) là hợp lệ.

---

## 12. Quy tắc Build theo Phase (Phase-based Build Rule)

> **KHÔNG batch toàn bộ 1 lần. KHÔNG screenshot từng widget (tốn token, không scalable với 100+ widgets).
> Phải build theo 4 phase — mỗi phase kết thúc bằng local JSON validation + screenshot + diff (khi cần).**

### Workflow tổng quát:

```
Đọc Figma → Phân tích toàn bộ hierarchy (1 lần, không build)
     ↓
Phase 1: SKELETON   → validate.py → screenshot #1 → kiểm tra mắt (layout/sizing)
     ↓
Phase 2: CONTENT    → validate.py → screenshot #2 → kiểm tra mắt (text/image placement)
     ↓
Phase 3: STYLING    → validate.py → screenshot #3 → DIFF vs Figma desktop ← BẮT BUỘC
     ↓
Phase 4: RESPONSIVE → validate.py → screenshot #4 → DIFF vs Figma mobile ← BẮT BUỘC
     ↓
Done (nếu diff đạt ngưỡng ≥ 95%)
```

### Chi tiết từng Phase:

**Phase 1 — SKELETON** *(containers/wrappers, không có content)*

- Tạo toàn bộ containers, blocks, rows, grids với đúng flex/grid settings
- Chưa thêm: text, heading, image, button
- Verify: **nhìn mắt** — layout structure, flex-direction, gap, sizing đúng chưa
- ❌ Chưa cần diff (chưa có visual styling, diff chưa có ý nghĩa)

**Phase 2 — CONTENT** *(thêm text, heading, image vào skeleton)*

- Fill nội dung: heading text, paragraph, image URL, button label
- Chưa thêm: màu sắc, gradient, shadow, border-radius
- Verify: **nhìn mắt** — content đúng vị trí, typography size, image hiển thị
- ❌ Chưa cần diff (màu chưa có, diff sẽ cho kết quả thấp giả)

**Phase 3 — STYLING** *(visual: màu, border, shadow, gradient)* ← **QUAN TRỌNG NHẤT**

- Apply: background color/gradient, border, box-shadow, border-radius, opacity
- Apply: typography color, font-weight, letter-spacing
- Verify: **BẮT BUỘC chạy diff** so với Figma desktop screenshot
- ✅ Nếu diff ≥ 95% → sang Phase 4
- ❌ Nếu diff < 95% → refix styling rồi diff lại (không sang Phase 4)

**Phase 4 — RESPONSIVE** *(breakpoints tablet/mobile)*

- Thêm tất cả `:tablet_portrait`, `:mobile_portrait` settings
- Verify: **BẮT BUỘC chạy diff** so với Figma mobile screenshot
- ✅ Nếu layout responsive đúng → Done
- ❌ Nếu sai → refix breakpoints rồi screenshot lại

### Nguyên tắc Diff:

- **Khi nào dùng diff**: Phase 3 (sau khi có đủ styling) và Phase 4 (mobile viewport)
- **Khi nào không dùng diff**: Phase 1, 2 (chưa có visual → diff cho kết quả giả thấp)
- **Tool**: `diff_screenshots.py` (pixel diff + heatmap, xem `AGENTS.md` §5b) với Figma screenshot làm reference (`compare_spacings.py` đã xóa 2026-07-23 — bản cũ hardcode dữ liệu phiên cũ, chết theo file build đã dọn)
- **Ngưỡng chấp nhận**: ≥ 95% similarity trước khi chuyển phase / upload

### Nguyên tắc Local Validation (thay thế screenshot trung gian):

```python
# Chạy script trước khi screenshot — bắt 80% lỗi cấu trúc, 0 token screenshot
python3 scripts/validate_template_json.py bricks-json/sec100.json
python3 scripts/validate_section_structure.py bricks-json/sec100.json
```

- ✅ Check parent-child relationships
- ✅ Check ID unique, đúng 6 ký tự
- ✅ Check required properties (display, flexDirection...)
- ✅ Check responsive key syntax (:tablet_portrait)
- ✅ Check CSS property names hợp lệ

### Kết quả so sánh:

| Cách                             | Screenshots | Diff                  | Token                | Khả năng lỗi                   |
| --------------------------------- | ----------- | --------------------- | -------------------- | --------------------------------- |
| Batch 1 lần                      | 1           | Cuối                 | Ít                  | Cascading error, debug mò        |
| Widget by widget                  | 100+        | Mỗi widget           | Rất nhiều          | Ít nhưng không scalable        |
| **Phase-based (rule này)** | **4** | **Phase 3 & 4** | **Vừa phải** | **Thấp, phát hiện sớm** |

---

## 13. `%root%` trong `_cssCustom` — Cơ chế xác thực từ Bricks Core Source

Đã grep trực tiếp source theme Bricks (`includes/`) để xác định root cause thật của việc `%root%` không được thay thế khi ghi JSON qua REST API (thay vì qua UI builder):

- **`%root%` KHÔNG có logic thay thế ở phía PHP.** Toàn bộ cơ chế nằm trong bundle JS của builder (`assets/js/main.min.js`), cụ thể trong component code-editor của field `_cssCustom`: khi người dùng gõ/rời khỏi ô CodeMirror, hàm `getValue()` gọi `$_replaceCustomCssRoot("%root%", cssId, code)` để thay `%root%` bằng selector thật **trước khi** giá trị được lưu vào `settings._cssCustom` và POST lên server. Không có `save_post` hook hay hàm nào ở `includes/assets.php` / `includes/helpers.php` / `includes/assets/files.php` xử lý lại chuỗi `%root%` — `_cssCustom` được server coi là chuỗi đã resolve sẵn, chỉ validate cân bằng dấu `{}` (`Helpers::parse_css()`).
- **Hệ quả**: Bất kỳ pipeline nào ghi element JSON thẳng qua REST API (bỏ qua UI builder) — như `bricks-mcp-bridge` — sẽ luôn để lại `%root%` chết trong CSS compile ra. **Đây là lỗi cấu trúc của pipeline ghi trực tiếp, không phải bug ngẫu nhiên** — không có cách nào fix từ phía server, bắt buộc phải tự thay thế `%root%` bằng selector thật ngay trong script sinh JSON trước khi upload.
- **Selector đúng để thay thế** (theo `cssId` computed property trong JS, khớp với default selector convention ở PHP `Helpers::get_element_attribute_id()` / `includes/assets.php`):
  - Element thường (không phải Component, không phải bên trong query-loop): `%root%` → **`#brxe-{elementId}`** (ID selector).
  - Bên trong Component (child của 1 Component gốc): `%root%` → `.brxe-{cid}` (class selector).
  - Bên trong query-loop: element bị lặp nhiều lần nên PHP tự đổi `#brxe-{id}` → `.brxe-{id}` (class) vì ID phải unique trên trang.
  - Đang sửa 1 Global Class: `%root%` → `.{tên-class}`.
- **Tại sao phải dùng ID selector (`#brxe-`) chứ không phải class (`.brxe-`)**: site này load 1 bundle Tailwind CSS toàn cục (`vnx-bricks-tailwind-base-css`) **sau** file CSS của Bricks trong `<head>`, dùng `!important` rộng rãi. Với class selector, độ đặc hiệu (specificity) bằng nhau + load sau → Tailwind thắng, style custom bị ghi đè vô hình (không lỗi, chỉ im lặng không áp dụng). ID selector có specificity cao hơn nên luôn thắng bất kể thứ tự load — đây cũng chính là quy ước mặc định của Bricks core cho element thường, không phải "hack" ngoài chuẩn.
- **Áp dụng trong script Python**: mọi `_cssCustom` (và `_cssCustom:<breakpoint>`) viết bằng `%root%` như bình thường cho dễ đọc, nhưng phải chạy `.replace("%root%", f"#brxe-{element_id}")` ngay khi tạo element (element `id` được giữ nguyên qua `set_page_content`/`set_template_content`, đã xác thực qua `get_page`) — **không** để nguyên `%root%` trong payload upload.

> 🔒 **Đã nâng thành lỗi cứng ở G1 (2026-07-31)**: rule này từng bị quên trong lúc viết build script và **không gate nào bắt được** — JSON hợp lệ, file CSS vẫn sinh ra và vẫn có nội dung, nên G1/G2/G2.5 đều PASS; chỉ lộ khi soi computed style trên trang thật (mất nền gradient nút, mất chữ gradient, mất mask, mất `nowrap`). Nay `validate_template_json.py` có `check_css_custom_root()` báo lỗi cứng nếu còn `%root%` trong bất kỳ key `_cssCustom*` nào. Bài học chung: **rule đúng mà không có gate thì vẫn sẽ bị quên** — mỗi khi phát hiện một lớp lỗi câm, thêm check vào validator chứ đừng chỉ ghi thêm chữ vào tài liệu.

## 14. Preview URL cho Section Template — Xác thực từ Core Source

Đã grep `includes/templates.php`, `includes/frontend.php`, `includes/builder.php`, `includes/database.php` để xác định vì sao permalink của 1 `bricks_template` (type `section`) redirect 301 về trang chủ khi truy cập không đăng nhập:

- CPT `bricks_template` đăng ký `public => true` + `rewrite slug 'template'` (`includes/templates.php:51-89`) → permalink `/template/{slug}/` **có** route hợp lệ, CPT không hề bị chặn ở tầng routing.
- Chặn thật nằm ở `Frontend::template_redirect()` (`includes/frontend.php:874-883`, hook `template_redirect`): **mọi** truy cập `is_singular('bricks_template')` bởi user không có quyền builder (`Capabilities::current_user_can_use_builder()`) và setting global `publicTemplates` chưa bật → `wp_safe_redirect(site_url(), 301)`. Không có điều kiện riêng nào cho `type=section` — hành vi giống hệt mọi loại template khác (trừ `header`/`footer`/`popup` chỉ khác ở cách *render nội dung*, không phải ở routing).
- **`bricks_template_preview` không tồn tại** trong source (0 kết quả grep toàn theme) — đây không phải tên query var thật của Bricks core, có lẽ là ghi chú sai/nhầm lẫn từ tài liệu cũ.
- Cách bật preview công khai đúng chuẩn: Bricks Settings → **"Public templates"** checkbox (lưu vào setting `publicTemplates`, `includes/admin/admin-screen-settings.php:921-922`) — bật cái này thì MỌI `bricks_template` sẽ public không cần đăng nhập. Đây là switch toàn cục, ảnh hưởng tất cả template trên site, không bật/tắt được theo từng template riêng lẻ.
- **Kết luận**: Workaround hiện tại (tạo `page` tạm với `page_settings_json: {"headerDisabled":true,"footerDisabled":true}` rồi screenshot permalink của page đó) là **đúng và là cách thực dụng nhất** — vì `page` không đi qua `template_redirect()`'s CPT check nên không bị 301. Phương án thay thế (bật `publicTemplates` global) tồn tại nhưng đánh đổi bảo mật (lộ toàn bộ template trên site ra public) nên KHÔNG khuyến nghị dùng cho mục đích chỉ screenshot review nội bộ.

## 15. Shape control Image / Background / Gradient / Border-Radius — Xác thực từ Core Source

Đã grep `includes/elements/base.php`, `includes/elements/image.php`, `includes/assets.php` để xác thực các key đã dùng theo suy luận. **2 lỗi thật đã phát hiện** (không chỉ là thiếu tài liệu — đây là key sai khiến CSS không compile, tương tự lỗi `_gap` đã biết ở mục 2):

- **❌ `objectFit` SAI, đúng phải là `_objectFit`** (có dấu gạch dưới, `includes/elements/image.php:149-160`) → CSS `object-fit`. Tương tự `_objectPosition` (không phải `objectPosition`) cho `object-position` (image.php:162-173, giá trị text thường như `"center top"`, không phải object). **Bất kỳ script nào đã dùng `"objectFit": "cover"` (thiếu gạch dưới) trên element `image` đều bị Bricks bỏ qua silently** — object-fit sẽ không áp dụng, ảnh có thể bị stretch/méo thay vì crop đúng như Figma.
- **❌ `_borderRadius` (top-level) SAI — không tồn tại control này.** Bo góc là sub-key `radius` nằm TRONG control `_border` (base.php:1316-1326), không phải key riêng. Cấu trúc đúng:
  ```json
  "_border": {
    "radius": { "top": "20px", "right": "20px", "bottom": "20px", "left": "20px" },
    "width": { "top": "0px", "right": "0px", "bottom": "0px", "left": "0px" },
    "style": "solid",
    "color": { "hex": "#000000" }
  }
  ```

  Nếu chỉ cần bo góc (không cần border), vẫn phải bọc trong `_border: {radius: {...}}` — dùng key `_borderRadius` độc lập sẽ bị Bricks bỏ qua hoàn toàn, không báo lỗi.
- **`_background` chỉ xử lý color/image/attachment/blendMode/repeat/position/size — KHÔNG có gradient.** Gradient là control riêng `_gradient` (base.php:1303-1312, CSS property `background-image`), là sibling key ngang hàng với `_background`, không phải nested bên trong. (Việc dùng `_cssCustom` để viết raw `background: radial-gradient(...)` như đã làm trong session này vẫn hoạt động đúng và là lựa chọn hợp lệ, nhưng nếu muốn dùng đúng control native của Bricks thì phải là `settings["_gradient"]`, không phải nhét gradient vào `_background.color`).
  - `_background.color`: `{"hex": "#rrggbb"}` (đúng như đã dùng).
  - `_background.image`: `{"url": "...", "id": ..., "size": "full"}`; `_background.size`: `"cover"|"contain"|"custom"` (nếu `"custom"` thì thêm `_background.custom`); `_background.position`: `"center center"` hoặc `"custom"` + `positionX`/`positionY`. Mặc định `size` là `cover` nếu có `image.url` mà không set `size`.
- **`image` element** (nguồn ảnh chính): key `"image"` đúng như đã dùng — `{"id": 123, "url": "...", "size": "full"}` (WP media) hoặc `{"external": true, "url": "...", "size": "full"}` (URL ngoài, ví dụ Figma asset `localhost:3845`).
- **Absolute positioning đã dùng ĐÚNG 100%**: `_position` (`static|relative|absolute|fixed|sticky`), `_top`/`_right`/`_bottom`/`_left` (chuỗi có đơn vị như `"56.46px"`), `_zIndex` — tất cả xác thực khớp `base.php:462-560`, không cần sửa.

## 16. Kỹ thuật "carousel-dual" (`_display:breakpoint:"contents"`) — Xác thực an toàn từ Core Source

Kỹ thuật flatten wrapper responsive (dùng `"_display:tablet_portrait": "contents"` để card thoát khỏi grid cha, xếp thành hàng ngang cuộn mobile) đã được xác thực an toàn để tiếp tục dùng:

- **`"contents"` KHÔNG có trong danh sách option chính thức của dropdown Display** trong builder UI (`includes/elements/container.php:150-159` chỉ liệt kê `flex, grid, block, inline-block, inline, none`). Tuy nhiên control này có `'add' => true` → cho phép builder UI nhận giá trị tự gõ tùy ý, nên `"contents"` vẫn là giá trị **hợp lệ, tới được qua UI, chỉ là không nằm trong dropdown** — không phải "hack ngoài chuẩn" nguy hiểm.
- **CSS generation xử lý `_display` như passthrough thuần túy** (`includes/assets.php` ~dòng 2459): chỉ render `display: <value>;`, không có switch/case đặc biệt nào theo giá trị. Các sub-control flex/grid (`_flexDirection`, `_gridTemplateColumns`...) đều gate bằng `required: ['_display','=','flex'|'grid']` nên tự động vô hiệu khi giá trị là `contents` — không xung đột.
- **Core Bricks KHÔNG có primitive "flatten responsive"/carousel không-JS nào khác** — 2 element carousel có sẵn (`carousel.php`, `slider-nested.php`) đều bắt buộc Swiper JS. Kỹ thuật `display:contents` hiện tại là cách hợp lý nhất cho carousel-dual (1 DOM, không JS, escape nested grid ở mobile).
- **Lưu ý duy nhất cần nhớ**: 1 khi wrapper có `display:contents`, chính wrapper đó **mất khả năng style/animate** (background, border, padding, box-shadow, hover state đều vô hiệu vì không còn box) — chỉ style được lên children. Không có `:where()` selector nào của Bricks core áp đặt lên children nên không lo xung đột CSS ẩn.

---

## 17. Overflow-Safety cho Text ngắn trong Flex Row (BẮT BUỘC — bài học từ sự cố 2026-07-14)

**Sự cố**: Section `vnx-service` tự báo **G4 PASS ≥98%** dựa trên diff ảnh full-page, nhưng user tự kiểm tra live site mới phát hiện 3 lỗi mà full-page diff không bắt được: hàng giá `"Chỉ từ 392.000 VNĐ/ Tháng"` bị xuống dòng giữa số khi flex co hẹp (mobile/card hẹp), border-radius sai schema (`_borderRadius` thay vì `_border.radius` — xem mục 15), và card mobile bị co `min-width`. **Full-page "trông giống" không đủ nhạy để phát hiện lỗi xuống dòng cục bộ trên 1 hàng text nhỏ** — điểm diff tổng thể vẫn có thể ≥98% dù 1 dòng chữ bị vỡ.

**Quy tắc chủ động (áp dụng ngay khi BUILD, không chờ G4 phát hiện)**:

- Mọi text ngắn mang tính "nhãn/số liệu không được phép vỡ dòng" — giá tiền (`"Chỉ từ 392.000 VNĐ/ Tháng"`), badge, đơn vị, số liệu thống kê — đặt trong **flex row cùng hàng với sibling khác** (icon, label khác) → PHẢI có:
  ```json
  "_typography": { "white-space": "nowrap" },
  "_cssCustom": "%root%{flex-shrink:0;}"
  ```
- Container cha của các hàng này (đặc biệt trong card hẹp / mobile scroll-row) nên có `_flexWrap: "nowrap"` tường minh — không dựa vào mặc định trình duyệt.
- Đây là rule **chủ động khi viết script build**, không phải chỉ chờ `validate_g4_preflight.py` bắt lỗi sau — script preflight chỉ là lưới an toàn cuối, không phải nguồn kiến thức đầu tiên.

**Gate bắt buộc trước khi ghi `G4 PASS`/`DONE` vào `infor_todo.md`** (xem `review-skill/rubric.md` §HARD GATE):

1. `python3 scripts/capture_zoom_evidence.py --url <page_url> --viewport <desktop|mobile> --out-dir scratch/g3/zoom --element <id>:<label> ...` — chụp CROP THẬT cho từng vùng Z1–Z5 (không phải zoom bằng mắt suông).
2. `python3 scripts/validate_g4_preflight.py <json> --template-id <ID> --desktop <png> --mobile <png> --zoom-dir scratch/g3/zoom` phải exit 0 — script **FAIL cứng** nếu thiếu `--zoom-dir` hoặc thiếu file crop, không cho phép chỉ "tự khai đã zoom-compare".
3. Full-page diff ≥98% **không phải điều kiện đủ** để tuyên bố PASS — bằng chứng crop per-element (Z1–Z5) mới quyết định các lỗi cục bộ (wrap, radius, width).

---

## 18. Default `width:100%` trên `block`/`div` — bẫy CSS core (bài học từ sự cố 2026-07-15/16, lặp lại 2 lần)

**Sự cố**: 2 phiên build liên tiếp (Section 1 "tab filter", Section 2 header "Xem tất cả") đều bị lỗi visual giống nhau: phần tử lẽ ra phải **co theo nội dung** (icon+label, link+chevron, badge) lại **giãn hết chiều rộng hàng**, đẩy/đè lên sibling. Nguyên nhân xác nhận qua `assets/css/frontend.min.css`: `.brxe-block{...;width:100%}` là default core của MỌI `block`/`div` không khai báo `_width` riêng. Việc này càng tệ hơn khi có thêm `"_flexShrink": 0` (theo rule 17 ở trên) mà thiếu `_width` — phần tử khóa cứng ở basis 100% sai thay vì co lại.

**Quy tắc bắt buộc**: bất kỳ `block`/`div` nào đóng vai trò "cụm nội dung co giãn theo chữ" (không phải cột/card full-width) — đặc biệt khi đã có `_flexShrink: 0` — PHẢI có `"_width": "auto"` tường minh:

```json
{ "_display": "flex", "_direction": "row", "_alignItems": "center", "_columnGap": "8px", "_width": "auto", "_flexShrink": 0 }
```

Chi tiết đầy đủ + ví dụ: `containers-and-layout.md` §"Default width:100% trên block/div".

**Lưu ý**: `_flexShrink: 0` KHÔNG bắt buộc phải luôn đi kèm — chỉ cần khi phần tử thuộc diện "không được vỡ dòng" theo rule 17 (giá tiền, badge, số liệu ngắn trong hàng chật). Nếu hàng đủ rộng hoặc co lại một chút không ảnh hưởng, có thể bỏ `_flexShrink` (mặc định trình duyệt `1`) và chỉ cần `_width: "auto"` để chống bẫy giãn full-width này. Chỉ khi thật sự cần `_flexShrink: 0` (chống co/vỡ dòng) thì `_width: "auto"` mới trở thành bắt buộc đi kèm.

**Cách phát hiện chủ động khi nghi ngờ hàng bị lệch spacing dù CSS `justify-content`/`gap` đã đúng**: đo `getBoundingClientRect().width` qua Playwright cho từng phần tử con trong hàng — nếu 1 phần tử báo width gần bằng row cha thay vì bằng nội dung, đây chính là bẫy này.

## 19. `svg` element KHÔNG hotlink được URL ngoài — dùng `image` thay thế (xác nhận qua source `includes/elements/svg.php`, 2026-07-16)

**Sự cố**: build ban đầu dùng element `svg` với `{"file": {"url": "http://localhost:3845/assets/....svg"}}` để hiển thị icon từ Figma — icon không hiển thị (silent fail, không báo lỗi).

**Nguyên nhân xác nhận qua source** (`svg.php`, hàm `render()`):

- `source: "file"` (mặc định) chỉ đọc SVG qua `get_attached_file($settings['file']['id'])` — **cần `id` là attachment thật trong WP Media Library**, không đọc được `url` ngoài. Không có `id` → không có SVG → không render gì cả (không placeholder, không lỗi).
- `source: "code"` (inline SVG) yêu cầu `settings.signature` hợp lệ, được `Helpers::sanitize_element_php_code()` xác thực — chữ ký này chỉ được builder UI tạo khi người dùng thật sự gõ/lưu code trong trình duyệt. Ghi JSON thẳng qua REST API (bỏ qua UI) sẽ luôn thiếu signature hợp lệ → bị chặn.
- Kết luận: **không có cách nào hotlink URL ngoài vào element `svg` khi ghi JSON trực tiếp qua `set_template_content`/`set_page_content`** — khác với gợi ý cũ trong `external-assets.md`.

**Quy tắc bắt buộc**: mọi icon/SVG lấy từ Figma (`localhost:3845/assets/*.svg`) khi build qua pipeline ghi JSON trực tiếp phải dùng element **`image`** (không phải `svg`), giống hệt cách dùng cho ảnh raster:

```json
{
  "name": "image",
  "settings": {
    "image": { "external": true, "url": "http://localhost:3845/assets/....svg", "size": "full" },
    "_width": "16px", "_height": "16px"
  }
}
```

Trình duyệt render `<img src="....svg">` bình thường, không có giới hạn CORS/signature nào áp dụng cho thẻ `<img>` cơ bản. Xem `external-assets.md` (đã sửa) cho bảng mapping đầy đủ.

## 20. Element `code` (executeCode) KHÔNG dùng được trong pipeline ghi JSON trực tiếp — dùng page settings `customScripts*`/`customCss` thay thế (xác nhận qua source `includes/elements/code.php` + `helpers.php`, 2026-07-22)

**Vấn đề**: element `code` chỉ thực sự output HTML/CSS/JS ra trang khi `settings.executeCode` được bật (`code.php:169-291`). Khi đó Bricks bắt buộc xác thực `settings.signature` qua `Helpers::sanitize_element_php_code()` → `verify_code_signature($signature, $code)` so khớp `$signature === wp_hash($code)` (`helpers.php:1672-1679`) — `wp_hash()` dùng salt bí mật của site (`wp_salt()`), chỉ builder UI tính được khi user thật gõ/lưu code trong trình duyệt. Ghi JSON thẳng qua `set_template_content`/`set_page_content` (bỏ qua UI) sẽ luôn thiếu signature hợp lệ → `render_element_placeholder` báo lỗi "Invalid signature"/"No signature", không render gì. Nếu KHÔNG bật `executeCode`, element `code` chỉ hiển thị code dưới dạng text đã escape (`<pre><code>`) qua `get_code_snippet()` (`code.php:295-313`) — cũng không dùng được để nhúng HTML/JS thật. **Kết luận: element `code` không dùng được để nhúng HTML/CSS/JS tuỳ ý trong pipeline ghi JSON trực tiếp, tương tự hạn chế đã biết của `svg` source=code (mục 19).**

**Lối thoát đã xác nhận an toàn**: `customCss`, `customScriptsHeader`, `customScriptsBodyHeader`, `customScriptsBodyFooter` ở **page settings** (`_bricks_page_settings`, xem `json-formats.md`) render thẳng ra `<head>`/body qua `frontend.php` (dòng 73-78, 308-334) và `assets.php:413` — **không có bất kỳ check signature nào** (grep toàn theme xác nhận). Đây là field hợp lệ, dùng được qua tool MCP `set_page_content`/`set_template_content` (param `page_settings_json`) hoặc `set_page_settings`:

```json
{
  "customScriptsHeader": "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link href=\"...\" rel=\"stylesheet\">",
  "customScriptsBodyFooter": "<script>/* vanilla JS tương tác, vd filter tab */</script>"
}
```

**Phạm vi**: đây là **page setting** (áp cho 1 page/template cụ thể qua `post_id`), không phải Bricks Settings global — nếu cần load 1 lần cho toàn site (vd Google Fonts dùng chung nhiều trang), phải lặp lại field này trên từng page liên quan (không có tool MCP nào ghi `bricks_global_settings` site-wide).

> **Cross-check 2026-07-22**: tài liệu/skill cộng đồng cho Bricks 2.x mô tả Code element "raw mode" (không bật `executeCode`) là *"HTML/CSS/JS emitted at element position, không PHP gate"*. Đọc source 1.12.3 thật (như trên) thì raw mode chỉ **escape thành text hiển thị** qua `get_code_snippet()` — không render HTML thật. **1.12.3 nghiêm ngặt hơn 2.x ở điểm này** — xác nhận lại kết luận trên là đúng cho site này, không phải đọc nhầm; đừng tin theo tài liệu cộng đồng viết cho bản mới hơn nếu chưa tự grep source thật.

## 21. Element `container` mặc định `width: 1100px` CỐ ĐỊNH — PHẢI set `_width: "100%"` tường minh, không chỉ `_widthMax` (bài học từ sự cố 2026-07-22, vỡ layout mobile toàn bộ 4 trang)

**Sự cố**: Build 4 trang (16-17 section) đều dùng pattern `section > container > ...`, mỗi `container` chỉ set `_widthMax` (vd `"1100px"`) để giới hạn bề rộng nội dung, KHÔNG set `_width`. Kết quả: **toàn bộ trang bị tràn ngang nghiêm trọng trên mobile** (viewport 390px nhưng nội dung render ở ~1100-1140px, `document.scrollWidth` ≈ 1164px) — full-page screenshot mobile bị giãn ngang gấp ~3 lần, do Playwright vẫn chụp đúng nhưng nội dung thực sự tràn khỏi khung hình.

**Nguyên nhân xác nhận qua compiled CSS core** (`assets/css/frontend.min.css`):
```css
.brxe-container{align-items:flex-start;display:flex;flex-direction:column;margin-left:auto;margin-right:auto;width:1100px}
@media (max-width:767px){.brxe-container{flex-wrap:wrap}} /* chỉ đổi flex-wrap, KHÔNG đổi width */
```
`.brxe-container` có default **`width: 1100px` cố định** (không phải `100%` như `.brxe-block`, xem mục 18) và **không có bất kỳ media query nào ghi đè width** ở breakpoint hẹp hơn. Nếu JSON chỉ set `_widthMax` (compile ra `max-width`), giá trị `max-width` chỉ có tác dụng CAP khi `width` tính toán lớn hơn nó — nhưng vì `width` đã là con số cố định 1100px (không phải `auto`/`100%`), kết quả cuối luôn là `min(1100px, widthMax)` ở **MỌI breakpoint, kể cả 390px** — container hoàn toàn không phản hồi viewport.

**Quy tắc bắt buộc**: mọi element `container` PHẢI có `"_width": "100%"` tường minh (không dựa vào mặc định core), dùng `_widthMax` chỉ để giới hạn bề rộng tối đa trên màn hình lớn:
```json
{ "_width": "100%", "_widthMax": "1100px", "_display": "flex", "_direction": "column", "_rowGap": "40px" }
```
Đây là bẫy ngược lại với mục 18 (`block`/`div` mặc định `width:100%` nên KHÔNG cần set, còn `container` mặc định `width:1100px` nên BẮT BUỘC phải set `_width:100%`) — hai element dễ nhầm lẫn vì cùng họ layout nhưng default width ngược nhau hoàn toàn.

**Cách phát hiện chủ động**: đo `document.documentElement.scrollWidth` so với viewport width qua Playwright ngay sau khi build — nếu `scrollWidth` > viewport đáng kể (không phải do 1 phần tử lẻ tràn mà do hàng loạt `container`), gần như chắc chắn là lỗi này. Kiểm tra nhanh: `getBoundingClientRect().width` của node `.brxe-container` — nếu ra đúng giá trị `_widthMax` (hoặc 1100px mặc định) bất kể viewport, xác nhận lỗi.

> **2026-07-22 — nâng thành gate chính thức**: việc "phát hiện chủ động" ở trên đã bị bỏ sót thực tế trong phiên build 4 trang SohmaLead (chỉ xem screenshot bằng mắt, không đo số) — user phải tự phát hiện qua review. Xem mục 23 để biết script + quy tắc gate bắt buộc thay thế.

## 22. Thứ tự CSS Cascade thật của Bricks 1.12.3 — 11 bucket, KHÔNG giống tài liệu cộng đồng cho bản 2.x (xác nhận qua source `includes/assets.php`, 2026-07-22, đã tự soát lại 1 lần vì đếm nhầm ở bản đầu)

**Bối cảnh**: một số tài liệu/skill cộng đồng (viết cho Bricks 2.x, có Style Manager) mô tả thứ tự cascade gồm 12 bucket kể cả "utility classes". Grep trực tiếp `Assets::generate_css_file()` trong `includes/assets.php` (~dòng 495-582) trên site 1.12.3 thật cho thứ tự **11 bucket sau** (đúng theo thứ tự nối chuỗi CSS, bucket sau thắng khi specificity ngang nhau):

```
1.  GLOBAL VARIABLES CSS  (:root, biến CSS)
2.  THEME STYLE CSS       (Theme Styles — h1-h6, text-basic mặc định)
3.  GLOBAL CLASSES CSS    (Global Classes toàn site)
4.  GLOBAL CSS            (Bricks Settings → Custom CSS, field `customCss` global)
5.  COLOR VARS
6.  PAGE CSS              (custom CSS riêng của page đang render, page settings tab)
7.  HEADER CSS            (nội dung template header)
8.  CONTENT CSS           (★ nội dung chính — nơi `_cssCustom` element của page/section-template nằm)
9.  FOOTER CSS            (nội dung template footer)
10. POPUP CSS
11. TEMPLATE CSS          (⚠️ nạp SAU CÙNG — CSS ở tab Settings riêng của template HEADER đang active,
                            không phải CSS nội dung header/footer/content ở trên)
```

**Không có bucket "utility classes"** — đó là tính năng Style Manager chỉ có ở Bricks 2.2+, 1.12.3 không có.

**Điểm dễ hiểu nhầm nhất**: bucket 11 "TEMPLATE CSS" nạp **sau cả Popup CSS** (`assets.php` dòng ~578-581: `$template_css` được gán từ đầu hàm nhưng chỉ append vào `$inline_css` ở cuối cùng) — nghĩa là CSS trong tab Settings của **template Header đang active** có specificity-tie-break cao nhất toàn site, cao hơn cả CONTENT CSS của page bạn đang build. Nếu nghi ngờ style bị đè "vô cớ" dù đã dùng `#brxe-{id}`, kiểm tra tab Settings của Header template trước khi nghi ngờ chỗ khác.

**Hệ quả thực dụng cho pipeline này**: `GLOBAL CSS` (site-wide, bucket 4) load **TRƯỚC** `PAGE CSS`/`CONTENT CSS` (bucket 6, 8) — nghĩa là `_cssCustom` viết trên element của page/template (chỗ pipeline này ghi hầu hết style) luôn nằm **sau** CSS global site-wide theo thứ tự nguồn, nên thắng specificity ngang nhau. Đây là lý do kỹ thuật `%root%` → `#brxe-{id}` (ID selector, xem mục 13) hoạt động ổn định để đè cả Global CSS lẫn Tailwind base của site — không chỉ nhờ độ đặc hiệu ID cao hơn class, mà còn nhờ đúng thứ tự bucket.

## 23. Gate bắt buộc: đo `scrollWidth` mobile thật bằng script, không "mở DevTools nhìn mắt" (bài học từ sự cố mục 21, 2026-07-22)

**Vấn đề với cách cũ**: `review-skill/rubric.md` tiêu chí F2 ("Không overflow ngang trên mobile") trước đây chỉ hướng dẫn *"Mở DevTools → Toggle device toolbar → 390px → check horizontal scroll"* — hoàn toàn dựa vào agent tự nhìn, không có bằng chứng đo được. Sự cố mục 21 (container tràn ~3 lần trên mobile toàn bộ 4 trang) lọt qua chính vì bước này chỉ xem ảnh full-page chụp bằng Playwright (ảnh vẫn chụp đúng, chỉ là nội dung bên trong tràn) mà không đo `scrollWidth`.

**Script chính thức**: `todo/scripts/validate_mobile_overflow.py` — đo `document.documentElement.scrollWidth` thật qua Playwright, so với viewport, liệt kê top phần tử tràn nếu FAIL:

```bash
python3 scripts/validate_mobile_overflow.py --page-id <ID> --viewport 390
# nhiều viewport 1 lần:
python3 scripts/validate_mobile_overflow.py --page-id <ID> --viewport 390 --viewport 768
```

**Quy tắc bắt buộc**: chạy script này cho **mỗi trang thật** (không phải từng section riêng — overflow thường chỉ lộ ra khi ghép đủ layout) ngay sau khi `set_page_content` assemble xong, **trước khi báo DONE hoặc ghi G4 PASS**. Tolerance mặc định 20px (chừa cho phần header/nav có sẵn của site, ngoài phạm vi build — xem mục "Header/Footer toàn trang" `general_rules.md` §4). FAIL → tra cứu phần tử tràn theo `#id`/`.class` script in ra, đối chiếu mục 18 (`block` mặc định OK) và mục 21 (`container` là thủ phạm phổ biến nhất) trước khi tìm nguyên nhân khác.

---

## 24. Viết breakpoint suffix BÊN TRONG chuỗi `_cssCustom` KHÔNG có tác dụng — phải dùng key `_cssCustom:breakpoint` riêng (bài học từ sự cố 2026-07-23, section `vps-service`)

**Sự cố**: build hàng scroll ngang mobile (3 card fixed-width trong 1 row `overflow-x:auto` ở `:tablet_portrait`) — viết `_cssCustom: "#brxe-{id}:tablet_portrait{overflow-x:auto;}"` (tức nhét literal `:tablet_portrait` vào NGAY TRONG chuỗi CSS/selector). Rule không hề bắt lỗi (JSON hợp lệ, G1/G2/G2.5/G4 preflight đều PASS, screenshot viewport-crop "trông đúng" vì Playwright chỉ chụp đúng khung nhìn yêu cầu) — chỉ `validate_mobile_overflow.py` mới lộ ra: `scrollWidth=902px` trên viewport 390 (đúng bằng tổng chiều rộng 3 card không hề được clip).

**Nguyên nhân**: `_cssCustom` là **1 control duy nhất, không tự nhận cú pháp breakpoint bên trong nội dung CSS của nó** — `:tablet_portrait` không phải pseudo-class CSS hợp lệ, nên `#brxe-xxxxx:tablet_portrait{...}` là một selector KHÔNG BAO GIỜ match bất kỳ phần tử nào (trình duyệt âm thầm bỏ qua rule, không báo lỗi). Cú pháp responsive `key:breakpoint` (mục 3 file này) chỉ áp dụng cho **tên key JSON** (`"_cssCustom:tablet_portrait"`), không áp dụng cho nội dung chuỗi bên trong giá trị của key đó.

**Quy tắc bắt buộc**: khi cần `_cssCustom` chỉ áp dụng ở 1 breakpoint, phải tạo **key JSON riêng** `_cssCustom:tablet_portrait` (hoặc `:mobile_landscape`, `:mobile_portrait`) với nội dung CSS thuần (không có breakpoint suffix trong selector):

```json
// ❌ SAI — không có tác dụng, không lỗi, im lặng bỏ qua
"_cssCustom": "#brxe-abc123:tablet_portrait{overflow-x:auto;}"

// ✅ ĐÚNG — key JSON mang breakpoint, nội dung CSS chỉ có selector thuần
"_cssCustom:tablet_portrait": "#brxe-abc123{overflow-x:auto;}"
```

Nếu dùng helper `brix.py`'s `B.set_css(eid, template)` — hàm này CHỈ ghi vào key `_cssCustom` (desktop, không breakpoint). Muốn scope theo breakpoint phải tự gán trực tiếp `b._by_id[eid]["settings"]["_cssCustom:tablet_portrait"] = "#brxe-{eid}{...}"` (xem ví dụ `icon_overlay` trong `scratch/build_vps_service.py` phiên 2026-07-23, đã làm đúng cách này cho `transform:rotate()`, chỉ riêng dòng `overflow-x:auto` của cards-row là làm sai lúc đầu — file này đã bị xóa theo cleanup phiên, tham chiếu chỉ mang tính lịch sử).

**Cách phát hiện chủ động**: bất kỳ `_cssCustom` nào có mục đích "chỉ áp dụng 1 breakpoint" (overflow-x scroll row, ẩn/hiện theo màn hình, transform chỉ đổi ở mobile...) — kiểm tra lại tên KEY JSON có đúng hậu tố `:breakpoint` không, đừng kiểm tra bằng cách đọc nội dung chuỗi CSS (dễ nhầm vì đọc "có vẻ đúng"). `validate_mobile_overflow.py` là lưới an toàn cuối cùng bắt được lớp lỗi này (không phải G1-G4 preflight) — luôn chạy trước khi báo DONE.

---

## 25. Bricks core ép `flex-wrap: wrap` cho MỌI `.brxe-block` dưới 767px — hàng ngang icon+text tự vỡ dòng trên mobile (sự cố 2026-07-31, section `sec-vps-list`)

**Sự cố**: build xong desktop đẹp, sang mobile thì **mọi hàng ngang bị tách 2 dòng**: icon check nằm một dòng, text tính năng rớt xuống dòng dưới; nút "Nhận tư vấn" và ảnh avatar (đáng lẽ cạnh nhau) xếp chồng. JSON hợp lệ, G1/G2/G2.5 đều PASS, `validate_mobile_overflow` cũng PASS (không tràn ngang — chỉ cao thêm), nên **không gate nào bắt được**; chỉ nhìn screenshot mobile mới lộ.

**Nguyên nhân xác nhận qua compiled CSS core** (`assets/css/frontend.min.css`):
```css
@media (max-width:767px){.brxe-section{flex-wrap:wrap}}
@media (max-width:767px){.brxe-container{flex-wrap:wrap}}
@media (max-width:767px){.brxe-block{flex-wrap:wrap}}
```
Đây **không phải mặc định trình duyệt** (`flex-wrap` mặc định của CSS là `nowrap`) mà là rule do chính Bricks core thêm vào dưới 767px. Với `_direction: row` + con có `_flexGrow:1`, chỉ cần flex-basis nội dung vượt chỗ trống là con nhảy xuống dòng mới — `_widthMin: 0px` KHÔNG cứu được vì `wrap` quyết định trước khi shrink.

**Quy tắc bắt buộc**: mọi `block` có `_direction: "row"` mà các con phải nằm cùng một dòng (icon + label, nút + ảnh, tiêu đề + badge, giá + đơn vị) PHẢI khai báo `_flexWrap: "nowrap"` **tường minh**:

```json
{ "_display": "flex", "_direction": "row", "_alignItems": "center",
  "_columnGap": "8px", "_flexWrap": "nowrap", "_width": "100%" }
```

Đây chính là điều §17 đã dặn ("nên có `_flexWrap: nowrap` tường minh — không dựa vào mặc định trình duyệt") nhưng chưa nói rõ **vì sao**: thủ phạm là media query của Bricks core, không phải trình duyệt. Nâng từ "nên" lên **bắt buộc**.

**Cách phát hiện chủ động**: sau khi build xong Phase 4, luôn chụp screenshot mobile thật và soi các hàng icon+text — hoặc đo bằng script: nếu `getBoundingClientRect().height` của 1 hàng ngang ở mobile lớn hơn ~2× chiều cao mong đợi, gần như chắc chắn là hàng đó đã wrap.

### 25b. Hai bẫy nhỏ đi kèm (cùng phiên)

- **Stroke INNER của Figma KHÔNG cộng kích thước, `_border` của CSS thì CÓ.** Khung `height:auto` dựng bằng `_border: {width:1px}` sẽ cao/rộng hơn Figma đúng 2px mỗi chiều (cộng dồn 8px/trang trong phiên này). Dựng stroke inner bằng `_cssCustom: "%root%{box-shadow:inset 0 0 0 1px <color>;}"` thay cho `_border.width` — giữ `_border.radius` như bình thường. Xem `figma_rules.md` §7.4.
- **Ảnh/khối có kích thước tuyệt đối lớn hơn cột cha bị CSS theme kẹp về bề rộng cột** (`img{max-width:100%}`): vector trang trí 1149px bị ép còn 351px (méo còn 30%). Mọi ảnh/khối absolute cố ý tràn khỏi cha phải kèm `_cssCustom: "%root%{max-width:none;}"`.
- **Line-height không đủ để ép chiều cao khối chữ trộn cỡ**: khối giá `Chỉ từ <strong>270.000đ</strong>` (16px + 28px) vẫn cao 36px dù đã set `line-height:32px`, do strut của element cha cộng với inline box của `<strong>` lệch baseline. Muốn khớp đúng khung Figma thì set thẳng `_height` cho element chữ đó.

---

## 26. Plugin tối ưu (LiteSpeed Cache) hoãn/gỡ tài nguyên — 3 lỗi câm khi build (sự cố 2026-07-31, section `sec-uu-dai`)

Site này bật LiteSpeed Cache. Nó can thiệp vào HTML **sau khi** Bricks render, nên mọi thứ ở phía Bricks đều "đúng" mà kết quả trên trang vẫn sai. Không gate nào (G1→G4 preflight) bắt được — phải kiểm chứng trên trang thật.

### 26a. LiteSpeed hoãn JS → Bricks Interactions MẤT CÚ CLICK ĐẦU TIÊN

LiteSpeed đổi `<script>` thành `type="litespeed/javascript"` (chạy trễ tới lúc người dùng tương tác lần đầu) — **kể cả `bricks.min.js`**. Hệ quả: mọi `_interactions` (show/hide/scrollTo/javascript/toggle...) **không phản hồi cú click đầu tiên**; phải click lần 2 mới chạy. Đo được: `typeof window.<jsFunction>` = `undefined` ở click 1, `function` ở click 2.

- Thêm `data-no-optimize="1" data-no-defer="1" data-cfasync="false"` vào `<script>` của mình (trong `customScripts*`) → LiteSpeed/Cloudflare bỏ qua, script chạy ngay khi parse. **Nhưng cách này KHÔNG cứu được `bricks.min.js`** (không sửa được thẻ script do core enqueue).
- **Với tương tác quan trọng (nút copy, nút CTA có JS), đừng dựa vào `_interactions`.** Tự gắn listener uỷ quyền trong script `data-no-optimize` của mình:
  ```js
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest && ev.target.closest('.my-btn');
    if (el) { ev.preventDefault(); myHandler(el); }
  });
  ```
- Cách phát hiện: test click bằng Playwright và **kiểm tra ngay ở click ĐẦU TIÊN** (không chỉ click 1 lần rồi đọc kết quả — dễ nhầm vì lần 2 chạy đúng).

### 26b. LiteSpeed GỠ thẻ `<link>` Google Fonts → chữ rơi về serif mà không báo lỗi

Thẻ `<link rel="stylesheet" href="fonts.googleapis.com/...">` bị gỡ sạch (chỉ chừa lại `<link rel="preconnect">` gây hiểu nhầm là "font có nạp"). Chữ render bằng serif mặc định của trình duyệt.

- ⚠️ **`document.fonts.check('700 24px Inter')` trả `true` GIẢ** — nó chỉ báo "vẽ được bằng font nào đó", không phải "đã nạp đúng font". Đừng dùng làm bằng chứng.
- **Cách đo đúng**: so bề rộng render của cùng chuỗi giữa font cần kiểm và `serif`/`sans-serif`. Nếu `width(Inter) == width(serif)` → font KHÔNG nạp.
  ```js
  const mk = ff => { const s=document.createElement('span'); s.textContent='VIETNIX_WELCOME10';
    s.style.cssText='position:absolute;font-size:24px;font-weight:700;font-family:'+ff;
    document.body.appendChild(s); const w=s.getBoundingClientRect().width; s.remove(); return w; };
  ({Inter: mk('Inter'), serif: mk('serif'), sans: mk('sans-serif')})
  ```
- **Cách xử lý (đã dùng, ổn định)**: self-host font. Bridge **chặn upload `.woff2`** (`File type not allowed`), nhưng thư mục `wp-content/uploads/` mount ra host nên copy thẳng file vào `uploads/fonts/` rồi khai `@font-face` trong `_cssCustom` của section (→ nằm trong `post-<id>.min.css`, đi theo template, không phụ thuộc mạng ngoài). Inter có **variable font**: chỉ cần 2 file (normal + italic) cho dải weight 100–900, nhân với subset `latin` + `vietnamese` = 4 file ≈ 121KB.

### 26c. `customScriptsHeader` của TEMPLATE KHÔNG đi theo template, `customScriptsBodyFooter` thì CÓ

`Assets::get_page_settings_scripts()` (`assets.php:900`) lặp qua **cả mảng** `Assets::$page_settings_post_ids`, và template tự đẩy ID của nó vào mảng đó khi render (`templates.php:343`, `assets.php:3118`). Nhưng:

- `customScriptsHeader` xuất ở `wp_head` — chạy **TRƯỚC** lúc body render template → lúc đó mảng chưa có template ID → **không xuất gì**.
- `customScriptsBodyFooter` xuất ở `wp_footer` — chạy **SAU** khi body render xong → **có xuất**, đi theo template sang bất kỳ trang nào chèn nó.

→ Mọi thứ cần đi kèm template (script, link font) phải đặt ở **`customScriptsBodyFooter`**, không đặt ở `customScriptsHeader`. (Chỉ đúng khi chèn dạng tham chiếu — Template element / shortcode. Copy-paste rời phần tử thì page settings không đi theo.)

## 27. `background-clip: text` + `text-shadow` = bóng vẽ ĐÈ LÊN mặt chữ (sự cố 2026-07-31)

Chữ gradient dựng bằng `background:linear-gradient(...)` + `background-clip:text` + `-webkit-text-fill-color:transparent`: phần gradient bị clip nằm ở **lớp background**, tức **DƯỚI** `text-shadow`. Nên bóng (nhất là bóng tối `rgba(0,0,0,.25)`) phủ lên chính mặt chữ, làm chữ xỉn hẳn — đo được vùng title lệch **29%** so Figma, nhìn ra màu xanh rêu thay vì trắng-xanh. Figma vẽ bóng nằm dưới chữ.

**Sửa**: bỏ `text-shadow`, dùng `filter: drop-shadow(...)` — filter áp lên kết quả đã render (gồm cả chữ đã clip) và đặt bóng phía sau:
```css
#brxe-{id}{
  background:linear-gradient(180deg,#fafcfd 0%,#71dffa 100%);
  -webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;color:transparent;
  filter:drop-shadow(0 4px 4px rgba(0,0,0,.25)) drop-shadow(.5px 0 0 #05a9dc);
}
```
Sau khi sửa: vùng title từ 29% lệch còn 12.5%, similarity toàn desktop 95.98% → 97.1%.

> Mẹo phụ: texture ảnh dùng làm nền chữ gradient thường **không cần tải về làm asset** — lấy mẫu màu theo trục dọc của ảnh rồi dựng lại bằng `linear-gradient` CSS. Ở phiên này ảnh texture 483×38 đo được `#f9fbfd → #4dd7f9`; cộng lớp phủ trắng 20% của Figma (`c×0.8 + 51`) ra `#fafcfd → #71dffa`, khớp mắt thường, bớt 1 request.

## 28. Bricks Interactions `action: "javascript"` — 2 chi tiết bắt buộc (xác thực từ `bricks.min.js`, 2026-07-31)

Interactions **không** bị cổng signature như element `code` (§20) — grep `verify_code_signature|sanitize_element_php_code` toàn `includes/` chỉ khớp `elements/code.php`, `query.php`, `admin-screen-settings.php`. Nên `_interactions` ghi thẳng qua REST là hợp lệ. Hai bẫy khi dùng:

1. **Mỗi item `jsFunctionArgs` BẮT BUỘC có `id`.** Runtime lọc `if (arg?.jsFunctionArg && arg?.id)`; thiếu `id` thì mảng args rỗng → hàm bị gọi **không tham số** (`w()`), không có lỗi nào.
   ```json
   "jsFunctionArgs": [{ "id": "brxarg", "jsFunctionArg": "%brx%" }]
   ```
2. **`%brx%` truyền vào một OBJECT, không phải element**: `{source, targets, target}` — `source` là element gắn interaction, `target` là phần tử đích hiện tại. Viết `function(el){ el.closest(...) }` sẽ hỏng; phải `function(brx){ var el = brx.source || brx.target; }`.

`target` bỏ trống mặc định `"self"` → `targets = [element]`, vòng lặp chạy đúng 1 lần.

> ⚠️ Dù hợp lệ, vẫn cân nhắc §26a trước khi chọn `_interactions` cho tương tác quan trọng.

---

## 29. `_columnGap`/`_rowGap` COMPILE bình thường trên `_display:"grid"` — không cần fallback `_cssCustom` (xác nhận thực nghiệm, 2026-08-17, section `sec-doi-tac`, Bricks 1.12.3)

Mục 16 phía trên khẳng định các sub-control gate bằng `required: ['_display','=','flex'|'grid']` "đều vô hiệu khi giá trị là `contents`" — điều đó đúng, nhưng dễ đọc nhầm thành `_columnGap`/`_rowGap` (định nghĩa ở `container.php` kèm `required: ['_display','=','flex']`) chỉ compile khi `_display:"flex"`, KHÔNG compile khi `"grid"`.

**Xác nhận qua source** (`includes/assets.php:1567-1568`): việc match `required` chỉ xảy ra khi control đó nằm trong mảng `css` của **chính control key đang xét** — `_columnGap`/`_rowGap` không tự khai `required` bên trong định nghĩa `css` của chúng (chỉ khai ở cấp control ngoài, cấp này **không** được vòng lặp sinh CSS kiểm tra). Kết quả: 2 control này compile ra `column-gap`/`row-gap` bất kể `_display` là `flex` hay `grid`.

**Probe thực nghiệm** (grep `post-9216.min.css` sau khi upload `_display:"grid", _columnGap:"12px", _rowGap:"14px"`):
```css
#brxe-uaxhn5{display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));column-gap:12px;row-gap:14px;width:100%}
```
→ `column-gap`/`row-gap` có mặt đầy đủ, không cần viết `_cssCustom` thay thế cho layout grid.

**Lưu ý phân biệt với mục 2/0c**: bẫy `_gap` KHÔNG compile (dùng `_columnGap`/`_rowGap` thay) vẫn đúng và không đổi — mục này chỉ xác nhận `_columnGap`/`_rowGap` (đã đúng key) hoạt động trên cả hai giá trị `_display`, không phải chỉ `flex`.

---

## 30. Tabs (Nestable) `tabs-nested` — khung con + 3 bẫy + vá LiteSpeed (xác thực source `tabs-nested.php` + `bricks.min.js`, 2026-10-05, template 9274)

**Khung con bắt buộc** (đúng `get_nestable_children()`; JS tìm theo class nên KHÔNG đổi tên): root `tabs-nested` > `block` class `tab-menu` > N × `div` class `tab-title` (> `text-basic`) ; `block` class `tab-content` > N × `block` class `tab-pane`. Class gắn qua `"_hidden": {"_cssClasses": "tab-title"}` như core (builder nhận diện). `role`/`aria-*` do `enhance_accessibility()` server tự thêm — không tự viết `_attributes`. Hướng root: control `direction` (`"row"`, `"direction:tablet_portrait": "column"`) — compile ra `flex-direction`. Tab mở sẵn: `openTab` (index, mặc định 0) → `data-open-tab`.

**3 bẫy (đều câm — G1/G2/G2.5 PASS):**
1. **Mọi pane hiện cùng lúc** nếu pane là `block` có `_display:flex` (mặc định của `brix.block`): CSS cấp ID `#brxe-{pane}{display:flex}` đè `.brxe-tabs-nested .tab-pane{display:none}` của core. Ẩn lại bằng selector mạnh hơn: `#brxe-{sec} .tab-pane{display:none}` + `#brxe-{sec} .tab-pane.brx-open{display:flex}`.
2. **`tab-title` (element `div`) bị core ép `width:auto`** (`.brxe-tabs-nested .tab-title{width:auto}`) — menu dọc sẽ co theo chữ. Cần `width:100%` tường minh khi muốn tab full chiều ngang.
3. **`brx-open` CHỈ do JS gắn** (server không render class này) → nếu `bricks.min.js` bị LiteSpeed hoãn (§26a) thì lúc tải trang KHÔNG pane nào hiện và cú click đầu có thể mất.

**Vá LiteSpeed (đã test bằng giả lập: chặn `bricks.min.js` → click → nạp lại + bắn `DOMContentLoaded` giả):**
- CSS trạng thái mặc định khi chưa có `brx-open`: `.vps-feat:not(:has(.tab-pane.brx-open)) .tab-pane:first-child{display:flex}` (tương tự cho `.tab-title:first-child` để tô active).
- Script lưới an toàn trong `customScriptsBodyFooter` (`data-no-optimize="1" data-no-defer="1"`, §26c): click uỷ quyền trên `.tab-title` → đổi `brx-open`/`aria-selected`/`tabindex` y hệt `bricksTabsFn` (idempotent khi cả hai cùng chạy) **và ghi `data-open-tab` = index vừa chọn** — vì `bricksTabsFn` khi init chỉ `add('brx-open')` cho index `data-open-tab` mà không gỡ ở tab khác ⇒ thiếu bước này sẽ thành 2 pane mở cùng lúc.
- Test logged-in KHÔNG phản ánh LiteSpeed (admin không bị hoãn JS: `typeof bricksTabsFn` = `object` ngay khi tải) — phải giả lập như trên hoặc test bằng khách trên page đã publish.

---

## 31. Ẩn `<br>` theo breakpoint → 2 từ DÍNH LIỀN nếu viết `A<br>B` (sự cố 2026-10-07, template 9319)

Heading desktop xuống dòng cố định bằng `<br>`, tablet/mobile ẩn đi bằng `_cssCustom:tablet_portrait: "#brxe-{id} br{display:none}"` để chữ tự chảy. Viết `"VIỆT NAM<br>TỐC"` thì khi `<br>` bị ẩn **không còn ký tự trắng nào** giữa 2 từ → hiển thị `NAMTỐC`. Mọi gate (G1/G2/G2.5/G4 preflight/mobile overflow) đều PASS, diff pixel gần như không đổi — chỉ lộ khi đọc chữ trên screenshot.

**Quy tắc**: luôn viết `A <br>B` (có dấu cách trước `<br>`). Khi `<br>` hiện, dấu cách cuối dòng bị trình duyệt nuốt (desktop không đổi); khi ẩn, nó thành khoảng trắng giữa 2 từ.

🔒 **Đã có gate**: `validate_template_json.py` → `check_hidden_br_word_gap()` báo lỗi cứng khi element có `_cssCustom*` ẩn `br` mà `text` chứa `\S<br>\S`.

## 32. `_cssId` (ID tuỳ chỉnh, vd anchor) ĐỔI id render → `#brxe-{id}` trong `_cssCustom` chết im lặng (sự cố 2026-10-12, LDP Grow Smarter)

Đặt `_cssId: "dang-ky"` cho section để làm anchor cho CTA → Bricks render `id="dang-ky"` **thay cho** `id="brxe-{id}"` (`Helpers::get_element_attribute_id`, helpers.php ~1984). CSS Bricks tự sinh (padding, background control…) đi theo ID mới nên vẫn đúng, nhưng `_cssCustom` đã thay `%root%` → `#brxe-{id}` (§13) thì **không khớp phần tử nào** → toàn bộ khối CSS tuỳ biến (ở đây: ảnh nền section) bị bỏ qua. G1/G2/G2.5/G4 preflight đều PASS; chỉ lộ khi so ảnh (nền trơn).

**Quy tắc**: element có `_cssId` → thay `%root%` bằng `#<_cssId>`. Helper build (`gs.css()` phiên này) tự chọn selector theo `_cssId`.

🔒 **Đã có gate**: `validate_template_json.py` → `check_css_id_vs_root_selector()` báo lỗi cứng khi element có `_cssId` mà `_cssCustom*` còn dùng `#brxe-{id}`.

Bẫy kèm theo (cùng phiên): field `type: hidden` của element `form` render 1 `<div>` rỗng **không class** làm con trực tiếp của `<form>` — nếu form dùng `display:flex;row-gap` thì div rỗng vẫn ăn thêm 1 khoảng gap. Ẩn bằng `#form > div:not([class]){display:none}`.
