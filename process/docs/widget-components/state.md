# state

Có: có. Đây là enum dùng chung, không phải một element.

Tên khác: hover, active, open, focus, disabled, pressed, State

Nhận: property `State` hoặc `state`, hoặc tên variant `State=Hover`. Tên lớp thường không phải state.

| Giá trị | Selector |
|---|---|
| Default, Collapsed, Closed, Rest | mặt nghỉ. Anh em đồng bộ về mặt này |
| Hover | `:hover` |
| Active, Selected, Current | `.is-active` |
| Expand, Open | `.brx-open` |
| Focus | `:focus-visible` |
| Disabled | `.is-disabled` |
| Pressed | `:active` |

Nền đặc của anh em đặc biệt chuyển sang selector đó. Mặt nghỉ bỏ `_background`.

Accordion, menu, menu-slider, tab và tab-switch tự vẽ open và active, không bị tô lần nữa.

Code: `process/modules/write-bricks/components/states.mjs`

## Hợp đồng

- Nhận: property `State` hoặc `state`, hoặc tên variant `State=Hover`. Tên lớp thường không phải state.
- Phần: không có params bắt buộc, trừ khi phần mô tả phía trên nói có
- Data: không bịa URL, alt, câu trả lời, pane. Chữ Figma là ô khi kind đã gắn nguồn.
- Hành vi: theo phần mô tả phía trên của file này
- Breakpoint: desktop và mobile là cùng element, cùng nguồn. Không có khung tablet thì dùng layout mobile đến 991px.
- Look: size, gap, fill, blur, ảnh, shadow lấy từ `write-bricks/render/`.
- Xong khi: element đúng kind, còn bấm được, slot đã gắn nguồn không còn chữ vẽ, và ảnh Figma đã được so với preview. Chưa đo ảnh thì chưa xong.
- Cấm: hạ component thành block, in chữ Figma khi đã có nguồn, sửa `.mjs` trong chính lần dựng.
