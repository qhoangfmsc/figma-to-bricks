---
description: One Figma frame -> one Bricks template. Desktop is required. Tablet, Mobile and Widescreen are optional. No WordPress page.
argument-hint: --desktop <url> [--widescreen <url>] [--tablet <url>] [--landscape <url>] [--mobile <url>]
---

Build **one template** for: $ARGUMENTS

The owner attaches the template in Bricks. A page is several of these templates. Split the Figma tree into sections in chat, then run this command once per section.

Reply in Vietnamese. Short. Do the step, then stop. Do not recap these rules. Do not guess a missing link, alt, FAQ answer, or tab pane.

## Eight steps

The engine stays these eight. Chat only gates them.

1. fetch
2. tree
3. detect — name regex (`tab`, `menu`, `nav`, `button`) is a hint. Shape plus the frame picture is the evidence. Layer names are not reliable.
4. export
5. build
6. push
7. verify
8. summary

`read` runs 1–3 and decide. It does not build. `build` runs 4–8, after the owner confirms. Recheck of a pasted Figma link happens inside `build`, before export.

## 1. Liên kết

Desktop is required and needs `node-id`. Widescreen, Tablet portrait, Mobile landscape, Mobile portrait are optional and are not discovered.

If any optional slot is absent from the message, ask once, in one line, which of those four links they have. Wait. A "không" is a blank slot. Do not invent a URL. Do not start `read` before that answer.

Pre-flight: `.env` has `FIGMA_TOKEN`. `docker compose ps` shows WordPress. Playwright stays in Docker. No browser on this machine.

Then run:

`node process/template.mjs read --desktop "<url>" [--widescreen "<url>"] [--tablet "<url>"] [--landscape "<url>"] [--mobile "<url>"]`

A link changed after this read makes the plan stale. Read again. Do not build on the old read.

## 2. Plan — stop

`read` writes `plan.md` in the desktop workspace (`planFile`). That file is the form. Do not paste the form into the chat. Point to the file, then stop. Do not build in the same turn.

Look before you point at the file. Order: `repeats[]` (same child shape), then the frame picture (Figma render under `assets/`, or a Docker Playwright shot), then a layer name. Compare picture and tree the way a Figma hover does: the selected layer is the box on the canvas. A row that shares a child shape is one component even when the layer is `Frame 12` or `Service Card`. A name match the picture contradicts does not stay as that component. Leave it as a block with an empty `expect` line and do not edit the rule in this run. Do not measure pixels off the picture. Do not approve a component the picture does not support.

During this run, do not edit `process/` or the theme. A group the rules are unsure about stays a question in `plan.md`. A rule change is a later task. The owner confirms once, then build. Never write Bricks theme styles. CSS loading stays External files.

The file, in this order:

- Title, frame name, width. Then `Gộp` with each pasted variant and its width, or omit that line.
- `Xác nhận: không`. The owner changes it to `Xác nhận: có`.
- **Loại template.** One line `` `type:<node>`: section ``. section, header, footer, popup, content, archive, search, or error. A sure header, footer, or popup is already filled. A weak guess stays section and the line above says why.
- **Component Detected.** One block per recognized component, including a plain block. Kind on its own line, then the Figma link, then each field on its own lines. A value Figma drew is filled. A value Figma does not have is `[Chưa có value]`. `expect:<id>` is the owner's override. `note:plan` is the free note. Tabs and tab-switch still list every pane.
- **Chưa chắc** and **Nhóm lặp** only when a row is not already inside a section above.
- `Sửa:` only when the owner already typed one. Blank means keep the values shown.

A new `read` keeps typed values and resets `Xác nhận` to `không`.

Blank stays the safe default. Never invent content. The owner writes any words. Before build, read `plan.md` and write `choices.json`. Map each sentence to one enum in `process/modules/missing-content/choices.mjs` by what it means. `part` and `guess` are keep or drop: "xóa", "bỏ", "đừng dựng" are drop. A blank line is the default, not a sentence. Do not add those words to the code. A sentence you cannot map is a question in the same turn. Do not edit `process/` because the words differ. A Figma link in a field is read again and reduced to the part the question asked for. A tab bar still in that read, or two item groups of the same size, stops the run. A miss during the run goes to `history/notes/gaps.md`.

## 3. Build — only after `Xác nhận: có`

Read `plan.md`. If the line is still `Xác nhận: không`, point at the file and stop. Parse the `` `key`: value `` lines. Apply `Sửa:` when it is not blank: `detections.json` with `source: "ai"` and a cite that exists in `tree.md`, or `overrides.json` with a `reason` quoting them. Do not add a name regex for this file.

`node process/template.mjs build --desktop "<url>" --answers '<json>'`

Sign-off is `owner (chat)`. Then look at `verify.figma.png`, `verify.png`, and `verify.diff.png` for each frame. One wrong component: fix that detection and build this template once more. Then stop.

Report: title, `Mở template trong Bricks` (`builderUrl`), one line per frame (`lệch N%` and the review notes), `Template đã nằm trong Bricks. Bạn tự gắn nó vào trang.`, designer list. No page assemble.

## Pixels

`fitSoloTemplate` then `fitFluid` in `process/modules/build-steps/05-build.mjs`. A pasted frame keeps its own numbers. Undesigned widths stay inside the window. A row becomes a column only at sm 640, md 768, lg 1024, xl 1280, or 2xl 1536. A pasted phone frame holds until 768. Do not patch `bricks.json`.

Values come from the Figma attributes. The picture decides what a group is. The tree supplies the numbers. Components follow `process/modules/write-bricks/components/README.md` and `CATALOG.md`. Another file with the same crop is `sources` at that breakpoint. A crop that moves keeps that frame's own element.
