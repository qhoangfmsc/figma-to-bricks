---
name: check-template
description: Check a built Figma section for detection, behavior, Figma layout, and dynamic data. Use after a build or a fix, for every component in kinds.mjs, including tabs, tables, price tables, sliders, dropdowns, and the rest.
---

# Check a built section

The catalog is `process/modules/recognize-parts/kinds.mjs`. Read `look.png` or `verify.figma.png` beside `verify.png` for each frame, desktop and mobile. Report lệch percent from `verify.md`. “Chưa đo được” is not a pass. A box check alone is not the verdict.

Compare layout, text, images, blur, and shadow. The component still clicks. A bound slot does not still print the words Figma drew. A miss that is one Figma file stays a note. A miss that is a shared Figma attribute is a later kernel change, with a test whose copy is not that file.

## Every kind

- The built element is that `PartKind`, not a plain block, unless the reading said `block`.
- `selected` is the item that looks chosen on that frame. Zero chosen items is a miss when the picture shows one.
- Each `children` node is rendered. Each `null` child is absent, and the component still exists.
- Layout numbers on that frame match the tree: size, gap, direction, order. The phone frame keeps its own direction and order.

## Behavior

- `tabs`, `tab-switch`: one title and its pane are open. A click moves `brx-open` to the clicked title and its pane. No pane (`tabs_data` null) stays an empty pane, and the row is still tabs.
- `accordion`: the open row shows its body. A click opens the clicked row.
- `carousel`: a control moves to another slide. `pagination_carousel`, `carousel_prev`, and `carousel_next` render only when the reading has a node. Null does not make it a grid.
- `menu-slider`, `scroll`: the row or the text moves inside the frame. The drawn thumb and track are not extra elements.
- `dropdown`, `select`: the control is the element. A drawn list opens. A null list is a plan question, and the control remains.
- `checkbox`, `radio`, `switch`: the drawn checked item is checked. The others are not.
- `readmore`: a click shows the rest of the clipped text.
- `hamburger`, `offcanvas`: the control opens the panel.
- `menu`, `breadcrumbs`, `link`, `button`: the control is that element. A missing URL stays `#` and is listed as missing. It is not invented.

## Dynamic data

`price-table` and `compare-table` only:

- The frame's layout is the Figma layout. The words Figma drew are slots.
- The id from the plan is the source. Cycles, packages, rows, and cells render from that source.
- A price slot shows the source price. An info row shows the source row. The register or buy control uses the source link.
- List every source field the render left empty. Do not fill it with the drawn words.
- No id: the section is not built.

`form`, `video`, `countdown`, `tooltip`, `counter`: the layout matches the frame. A value the picture does not contain stays empty and is listed. It is not invented.

## The rest

`alert`, `divider`, `flat-image`, `gallery`, `icon-list`, `logo`, `progress`, `rating`, `search`, `semantic`, `tooltip-style`: the element matches the kind and the frame's boxes. A repeated row uses one item as the pattern.

## Report

One line per frame: lệch percent, and whether each kind on that frame passed detection, behavior, layout, and data. Then the missing list. Do not call the section done on a box check alone.
