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
