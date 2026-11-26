# tabs

Có: có

Tên khác: tab

Nhận: một thanh ngang từ hai tiêu đề và một khung nội dung bên dưới. Tabs bar là hàng đó: một tiêu đề đang chọn và ít nhất một tiêu đề nghỉ. Tabs data là khung ngay dưới hàng. Plan ghi node của từng phần.

Dựng: `process/modules/write-bricks/components/tabs.mjs`, `tabs-chrome.mjs`
Nhận dạng: `process/modules/recognize-parts/rules/tabs.mjs`
Element: `tabs-nested` (`includes/elements/tabs-nested.php`)

Pane đã vẽ thì giữ. Link Figma thay pane đó. Chữ gõ vào plan điền pane chưa vẽ. Trống thì giữ hình đang vẽ.

State: title mở mang `brx-open` và pane cùng index mang `brx-open`. Đổi tab thì class, attribute của control bên trong, và pane đang hiện phải đổi cùng lúc. Chỉ đổi CSS của một title thì chưa phải state.

## Hợp đồng

- Nhận: container with exactly 2 visible children: tab bar (>= 2 title frames) + content (pane(s)); found by `detect/rules/tabs.mjs` (needs an active-variant or a tab name)
- Phần: `content.panes` { titleNodeId: text } and `content.sources` { titleNodeId: { kind: 'figma', url, fileKey, nodeId } }
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: every tab is listed with the content Figma drew; a Figma link replaces that pane; typed text fills a pane that is not drawn; blank keeps the drawing; the same values are copied onto a breakpoint that has that tab; Bricks 1.9.8 opens the first tab (no `openTab`). Every pane of this widget stacks the same way below desktop (`responsive/solo.mjs`)
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
