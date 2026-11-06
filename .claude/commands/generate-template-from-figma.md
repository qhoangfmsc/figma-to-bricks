---
description: One Figma frame -> one Bricks template. Desktop is required. Tablet, Mobile and Widescreen are optional. No WordPress page.
argument-hint: --desktop <url> [--widescreen <url>] [--tablet <url>] [--landscape <url>] [--mobile <url>]
---

Build **one template** for: $ARGUMENTS

The owner attaches the template in Bricks. This does not assemble a page. That is `/generate-page-from-figma`.

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

Look before you point at the file. Order: `repeats[]` (same child shape), then the frame picture (Figma render under `assets/`, or a Docker Playwright shot), then a layer name. Compare picture and tree the way a Figma hover does: the selected layer is the box on the canvas. A row that shares a child shape is one component even when the layer is `Frame 12` or `Service Card`. A name match the picture contradicts does not stay under **Component sẽ dựng**. Fix the shared rule, then `read` again so `plan.md` matches. Do not measure pixels off the picture. Do not approve a component the picture does not support.

No whack-a-mole. If a group is missed, the fix is a shared rule in `process/modules/recognize-parts/` or `process/modules/write-bricks/` that also fits another section of the same shape, plus a test. Do not add a name regex for this file. Do that before pointing at the plan. The owner confirms once, then build.

The file, in this order:

- Title, frame name, width. Then `Gộp` with each pasted variant and its width, or omit that line.
- `Xác nhận: không`. The owner changes it to `Xác nhận: có`.
- **Component sẽ dựng.** One heading per `parts[]` item, including a component the rules approved on their own: kind and name in the heading, Figma link, then one line per field. The line is the label and `` `key`: value ``. No hint sentence and no "Đang có". An image line is `Ghi alt cho ảnh "<layer>"`. Tabs and tab-switch: every pane, and a line to paste the Figma link of a pane that is not drawn. Empty `parts`: `Không nhận ra component nào.` `bỏ` on that component's line sets it `rejected` before build.
- **Đoán, chưa gắn.** Only when `open[]` has a row. One line: name, Figma link, the evidence sentence. `gắn` sets it `approved`. `bỏ` sets it `rejected`. No row: omit the section.
- **Ô cùng hình, chưa gắn.** Only when `repeats[]` has a row that is still unnamed. One line: count, item name, sample text, Figma link. The owner leaves `chưa gắn`, or names it slider, tab, menu, form, accordion, or nút. A name becomes one human detection on that node, `approved`, before build. Do not write any of these into `detections.json` before they confirm. No row: omit the section.
- `Sửa:` only when the owner already typed one. Blank means keep the values shown.

A new `read` keeps typed values and resets `Xác nhận` to `không`.

Blank stays the safe default. Never invent content. A value that fails the check: quote that line and wait. A Figma link in a field is read again and reduced to the part the question asked for. A tab bar still in that read, or two item groups of the same size, stops the run.

## 3. Build — only after `Xác nhận: có`

Read `plan.md`. If the line is still `Xác nhận: không`, point at the file and stop. Parse the `` `key`: value `` lines. Apply `Sửa:` when it is not blank: `detections.json` with `source: "ai"` and a cite that exists in `tree.md`, or `overrides.json` with a `reason` quoting them. Do not add a name regex for this file.

`node process/template.mjs build --desktop "<url>" --answers '<json>'`

Sign-off is `owner (chat)`. Then look at `verify.figma.png`, `verify.png`, and `verify.diff.png` for each frame. One wrong component: fix that detection and build this template once more. Then stop.

Report: title, `Mở template trong Bricks` (`builderUrl`), one line per frame (`lệch N%` and the review notes), `Template đã nằm trong Bricks. Bạn tự gắn nó vào trang.`, designer list. No page assemble.

## Pixels

`fitSoloTemplate` then `fitFluid` in `process/modules/build-steps/05-build.mjs`. A pasted frame keeps its own numbers. Undesigned widths stay inside the window. A row becomes a column only at sm 640, md 768, lg 1024, xl 1280, or 2xl 1536. A pasted phone frame holds until 768. Do not patch `bricks.json`.

Values come from the Figma attributes. The picture decides what a group is. The tree supplies the numbers. Components follow `process/modules/write-bricks/components/README.md` and `CATALOG.md`. Another file with the same crop is `sources` at that breakpoint. A crop that moves keeps that frame's own element.
