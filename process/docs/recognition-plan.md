# Trạng thái: nhận dạng một nguồn

Mục tiêu vẫn là: một section chưa từng thấy được nhận đúng component, dựng element dùng được, và giữ số của đúng frame.

Catalog duy nhất: `process/modules/recognize-parts/kinds.mjs`.
Cách sửa, cách thêm, cách kiểm tra: `.cursor/skills/fix-recognition`, `add-component`, `check-template`.
Bridge và MCP giữ nguyên. Skill tham khảo `.cursor/skills/bricks-bridge` đã bỏ.

## Đã sửa

- `PartKind` trùng bộ builder. `price-table`, `compare-table`, và mọi component đang dựng đều ở đó. Test `the component catalog has one list` khóa việc này.
- Ảnh không được gọi id phần con (`tabs_bar`, `pagination_carousel`, `price_card`) thành một loại. Phần con nằm trong `children`. `null` không hủy component.
- Dòng đọc giữ `selected` và `children`. Bảng giá lấy pill `selected` làm tab mở khi node đó là một pill.
- Giá nhận bằng số ngắn kèm ký hiệu hoặc đơn vị. `8 GB` không phải giá. `tháng` / `năm` không còn là điều kiện.
- Node `confirm: ok` thì bảng giá chỉ tìm thẻ và pill bên trong node đó. Pill đứng ngoài hàng không bị biến thành tab.
- `children` ghi `null` thì param phần đó là `null`. Slider không lấy hàng dấu code tự tìm nếu ảnh nói không có.
- Câu `shape` của nút, divider, gallery, rating không còn số đo. Progress, logo, hamburger, dropdown, offcanvas, breadcrumb, hàng đồng ý, scroll, carousel, menu, checkbox, select, search, video, nút đóng và tooltip cũng không còn cửa pixel. Ô nhập là ô còn chỗ để gõ hoặc có viền. Hàng thẻ giá và hàng chip ngang không phải form. Thanh alert phải trải gần hết khung cha. Tên lớp không đủ để biến một hàng vừa khít thành slider.
- Rule, skill pipeline, skill generate, và lệnh generate trỏ về `kinds.mjs` và ba skill trên. Không chép lại danh sách loại.

- `confirmNode` kiểm tra hàng lặp cho bảng, tab, slider, menu, gallery, icon-list, breadcrumb. Đúng khung thì `ok`. Ảnh chỉ một thẻ thì nới một lần lên hàng và để `proposed`, chưa dựng. Hai nhóm cùng số lượng thì `ask`, không dựng. Loại không phải hàng lặp, node còn trong cây thì `ok`.

- Frame điện thoại: merge chép `_direction` và `_flexWrap` của frame đó. Hàng pill `wrap` không bị ép `nowrap`. Một thẻ và nút đứng ngay trước hoặc sau thì nút đó lùi hoặc tiến thẻ.
- Hàng pill nằm cạnh hàng thẻ giá không thành `tabs` hay `tab-switch` thứ hai.
- Hai pill cùng nền, không có `selected`, mở chu kỳ đầu. Chữ giá trên thẻ không chọn tab.
- `list: null` thì dropdown vẫn dựng và không vẽ danh sách. Slider đã bỏ pagination khi param là `null`.
- Form không vẽ nút gửi vẫn là form. Nút được thêm. Plan hỏi chữ trên nút. Ghi `drop` thì bỏ form. Ô form không còn cửa cao 28–140. Alert không còn cửa cao, rộng, và câu dài 24. Gallery nhận từ 2 ảnh cùng cỡ. Rating nhận từ 2 dấu cùng loại.
- Breadcrumb là vệt bắt đầu và kết thúc bằng nhãn. Không còn trần 8 mục. Ô form không còn cửa rộng 120 và nhãn dài 120. Hàng đồng ý là một dấu nhỏ cộng một câu, không cần chữ "checkbox".

## Chưa sửa

- Output section Price Table trên site là bản build trước các sửa này. `verify.md` desktop: FAIL, lệch 8.88/255. Chưa build lại.
- Switch đọc trạng thái vẽ ở các run cùng file qua `meta.json`. Đường `history/runs/{fileKey}/…` không còn được đọc.
- Bấm thử accordion, tab, slider, dropdown và ô chọn nằm trong `visual-check/interact.mjs`. Chưa chạy trên output đang có của site.

## Việc còn lại

1. Build lại section Price Table khi được yêu cầu, rồi đọc `verify.md` và ảnh lệch.
2. Khi có yêu cầu kiểm output, chạy `node process/modules/visual-check/interact.mjs <url>`. Script đã bấm accordion, tab, slider, dropdown và ô chọn.

Không làm trong các bước này: bịa id bảng, bịa URL, sửa theme, gắn template vào trang, commit.
