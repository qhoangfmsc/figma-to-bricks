---
name: pipeline
description: Rules for this figma-to-bricks project. Use when adding a component, changing detection, or deciding which Bricks 1.12.3 element a frame becomes. Also use when moving a piece out of reference/ANV_mcp.
---

# This project is the rule

`process/` and the installed theme `wp-content/themes/bricks` (Bricks **1.12.3**) are the authority. A shape in `process/modules/recognize-parts/kinds.mjs`, a component under `process/modules/write-bricks/components/`, and a check in `process/test/` are the rule. Do not reopen one because another folder says something else.

The map of our docs is `process/docs/INDEX.md`. Each component is one file in `process/docs/widget-components/<id>.md`. Each ANV file and where its content lives now is `process/docs/SHELF.md`. After a piece is in SHELF, edit our file. Do not edit the shelf to update a rule.

`reference/Brick-Build-Page` is Bricks 2.x. Do not use it for a build.

## Locks that stay until the owner changes them

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

`gallery`, `progress`, `rating`, `alert`, `logo`, `hamburger`, `dropdown`, `offcanvas`. Shape: `process/modules/recognize-parts/rules/production-widgets.mjs`. Output: `process/modules/write-bricks/components/production.mjs`. The readable card for each one is `process/docs/widget-components/<id>.md`.

The generate pipeline stays on the `f2b` mu-plugin and `WP_URL`. One `.env` is one site: `WP_URL`, `WP_USER`, `WP_PASSWORD`, and `MCP_TOKEN` all belong to that site. Point them at local, staging, or production. There is no second upload to another site. Do not put the token in a committed file.

`posts`, WooCommerce, dynamic tags, element conditions, masonry, and shape dividers live in `process/modules/standby/`. They are not part of detection. Call a builder only when the plan has the value that function requires. `map`, `audio`, and `social-icons` still wait for an address or an icon name. Do not invent that value.

## States

`ComponentState` in `process/modules/write-bricks/components/states.mjs` is the only enum: `rest`, `hover`, `active`, `open`, `focus`, `disabled`, `pressed`. It reads the variant property `State`, or the variant name `State=Hover`. A layer name is not a state.

Siblings of one component set share the resting look. A Hover / Active / Open / Focus / Disabled / Pressed sibling contributes only that state's selector (`:hover`, `.is-active`, `.brx-open`, `:focus-visible`, `.is-disabled`, `:active`). Accordion, menu, and tabs paint their own open and active behaviour and are not painted twice.

## Popup

Popup keys are the controls in `wp-content/themes/bricks/includes/popups.php`. The list lives on `process/modules/write-bricks/components/popup-settings.mjs`. A popup opens through an interaction (`action: show`, `target: popup`, `templateId`). This theme has no `bricks/template/id` filter and no `popupDisableOnMobile`. Do not invent a limit, a z-index, or a backdrop colour.

## Read errors

A Figma read that fails is one line in `history/notes/read-errors.md` (`process/modules/common/read-errors.mjs`): the step, the file, the node, and the error text. A null prototype action is skipped. A flat image Figma cannot render stays elements. The section is not aborted for that node.
