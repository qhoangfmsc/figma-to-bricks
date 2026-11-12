---
name: pipeline
description: Rules for this figma-to-bricks project. Use when adding a component, changing detection, or deciding which Bricks 1.12.3 element a frame becomes. Also use when moving a piece out of reference/ANV_mcp.
---

# This project is the rule

`process/` and the installed theme `wp-content/themes/bricks` (Bricks **1.12.3**) are the authority. A shape in `process/modules/recognize-parts/kinds.mjs`, a component under `process/modules/write-bricks/components/`, and a check in `process/test/` are the rule. Do not reopen one because another folder says something else.

The map of our docs is `process/docs/INDEX.md`. Each component is one file in `process/docs/widget-components/<id>.md`. Each ANV file and where its content lives now is `process/docs/SHELF.md`. After a piece is in SHELF, edit our file. Do not edit the shelf to update a rule.

`reference/Brick-Build-Page` is Bricks 2.x. Do not use it for a build.

## Locks that stay until the owner changes them

- A content picture keeps the Figma box on its wrapper (`_width` and `_height`, or `flex-basis` plus `_height`). The image child stays 100% by 100% with `object-fit: cover`. The wrapper does not `flex-grow` or `flex-shrink`. It becomes width 100% and `aspect-ratio` only when the window is narrower than that box. A crop keeps `fill` on the inner crop frame. An absolute backdrop is not a picture. A frame that also holds text is not a picture; only the inner image box is.
- A darker thumb on a lighter track is a scroll, for repeated items or for one text block, on every frame that has that pair and at every width that frame's breakpoint covers. The scrollport is `width: 100%` of its parent. It does not keep the drawn px as `_width` or `_widthMax`. The height stays the drawn window. The two shapes are not a divider and are not a line block. The text box does not have to be taller than the frame when that pair is drawn on it. `thumb_scroll` and `track_scroll` are children of scroll in `SIGNAL_RULES`. They are not elements. The browser scrollbar uses their colors and shows only while the content overflows. A clipped horizontal row of the same card is a carousel when a card sits outside the frame. A fade shape that is not that card is not a slide. Prev and next may sit on the row or on the sibling above or below, and a missing pair does not cancel the carousel. The same cards fully inside the frame, with no clip, no buttons, and no dash row, stay a grid. A frame with one or two drawn slides owns that row when the row is its last child, or the next sibling in a column. A column that still has another section after the row does not own it. Each such frame is its own slider. One mark is active: darker or longer. Every other mark is the same idle mark. The idle count is whatever the frame draws, so five items are four idle marks and one active mark, and two items are one of each. The total is the slide count. A Figma component named Pagination is the same signal, whether its variant says Dash or Dot, and the switches that are on are the number of slides. The same row exported as one svg is the same signal as those child marks. That row is the carousel child `pagination_carousel`. The plan names the carousel, that row, and each arrow button, or không when the frame does not draw it. A child is not its own element and not its own plan question. A layer name that only contains "dash" is not evidence. Marks of one size and one color are not this row. A strip that is not on a card is not a block.
- A wrapping container takes `_width: 100%` and `_widthMax` at the frame it wraps. An inner block Figma set to Fill is 100% of that parent and does not keep the drawn px as `_width` or `_widthMax`. Hug content is `_width: auto`. A fixed picture keeps its box. Do not put a max-width on a text block just because Figma measured it at one width.
- A desktop slider stays a slider when that screen has no frame. Do not turn it into a horizontal scroll row.
- A screen with no frame uses this project's step-down. A leftover px width becomes 100%, capped at the Figma px.
- Do not invent an icon-font name, a URL, alt text, or an FAQ answer. An svg stays an svg.
- Menu of short links is `ul > li > text-link`. `nav-menu` needs a WordPress menu id.
- Do not write theme styles. CSS loading stays External files.
- A domain lookup and a price table are layout only. Their actions belong to the vietnix-center plugin.
- Plan text stays free. Code switches on the enum in `choices.json`.
- During a generate run, do not edit `process/` or the theme. A miss goes to `history/notes/gaps.md`.

## The old copy is a shelf

`reference/ANV_mcp` is an older copy kept so its content can move here. It will go stale. Do not run its scripts, do not follow its agent flow, and do not hand-write Bricks JSON the way that copy does.

Move one small piece at a time:

1. Read that one piece in the shelf.
2. Rewrite it in this repo: a shape rule, the 1.12.3 key verified in the theme PHP, a row in `kinds.mjs`, a test.
3. Write one line in `history/notes/components.md`: where it lives now, and what changed while copying (key name, or a lock above).
4. After that line, the local file is the rule. Do not go back to the shelf to override it.

Skip site plans, scratch scripts, and sample JSON. Do not copy sample colors, localhost image URLs, or a guessed mobile percent.

The shelf in `history/notes/components.md` is closed. Do not open `reference/ANV_mcp` to override a rule that file already records.

## Widgets already here

`gallery`, `progress`, `rating`, `alert`, `logo`, `hamburger`, `dropdown`, `offcanvas`, `scroll`. Shape: `process/modules/recognize-parts/rules/production-widgets.mjs` and `rules/scroll.mjs`. Output: `process/modules/write-bricks/components/production.mjs` and `components/scroll.mjs`. The readable card for each one is `process/docs/widget-components/<id>.md`.

A component is done when a fresh `detections.json` (no earlier `expect`) goes through detect, then decide, then the plan lists it. A test that only calls the detector is not that check. `process/test/scroll-list.test.mjs` renders that plan for the horizontal bar.

The generate pipeline stays on the `f2b` mu-plugin and `WP_URL`. One `.env` is one site: `WP_URL`, `WP_USER`, `WP_PASSWORD`, and `MCP_TOKEN` all belong to that site. Point them at local, staging, or production. There is no second upload to another site. Do not put the token in a committed file.

`posts`, WooCommerce, dynamic tags, element conditions, masonry, and shape dividers live in `process/modules/standby/`. They are not part of detection. Call a builder only when the plan has the value that function requires. `map`, `audio`, and `social-icons` still wait for an address or an icon name. Do not invent that value.

## States

`ComponentState` in `process/modules/write-bricks/components/states.mjs` is the only enum: `rest`, `hover`, `active`, `open`, `focus`, `disabled`, `pressed`. It reads the variant property `State`, or the variant name `State=Hover`, or a selected variant such as `Checked=True`. A layer name is not a state.

A state is CSS, HTML, and JS together. Paint copied onto one item that stays after another item is chosen is not a state.

Compare the selected item with a resting item. Fill, stroke, text color, and a mark that exists only on the selected variant move with the state. Words and icons that identify the item stay. The class the component toggles (`brx-open`, `is-active`) and the control attribute (`aria-checked`, `checked`) move together. A pane or answer that belongs to the state is the region that shows. A region Figma does not draw stays empty. JS, when the component has it, is what moves the class and the attribute.

`activeLook` is that comparison. Tabs use it: the open title is `brx-open`, its check is `aria-checked="true"`, and the matching pane is `brx-open`. Accordion and menu own their open and active behaviour the same way and are not painted twice. A Hover / Focus / Pressed sibling still contributes its selector (`:hover`, `:focus-visible`, `:active`) on top of the resting look.

A tab row is one-label triggers of the same structure. Height does not decide, and the layer name does not decide. One trigger is open: a variant, a fill, one peer painted differently, or a line under that trigger. A divider between triggers is optional; when it is there, it counts. The content is the region under the row, or peer panes that follow the row. Later sections of a page are not that content. An underlined row with that content is a line tab. The same row without a pane stays a menu.

## Look

A plan conclusion needs three records in the desktop workspace: `look.png` (Figma's render of the section), the code detection, and `look.json` `ai` (one `{ node, kind, see }` per signal, `kind` from `SIGNAL_RULES`, a `childComponent` id of that component, or `block`). `read` saves the picture and the code signals first. The chat reads `look.png`, writes the reading, then `node process/template.mjs look --desktop URL --ai <file>`. That command reviews the code against the picture and the Figma cite. Trust needs all three to name the same kind. A different kind stays a block. A detected child stays nghi ngờ. The result is the `Component Detected` section. Do not measure pixels off the picture. Do not point the owner at the plan before that command.

## Popup

Popup keys are the controls in `wp-content/themes/bricks/includes/popups.php`. The list lives on `process/modules/write-bricks/components/popup-settings.mjs`. A popup opens through an interaction (`action: show`, `target: popup`, `templateId`). This theme has no `bricks/template/id` filter and no `popupDisableOnMobile`. Do not invent a limit, a z-index, or a backdrop colour.

## Read errors

A Figma read that fails is one line in `history/notes/read-errors.md` (`process/modules/common/read-errors.mjs`): the step, the file, the node, and the error text. A null prototype action is skipped. A flat image Figma cannot render stays elements. The section is not aborted for that node.
