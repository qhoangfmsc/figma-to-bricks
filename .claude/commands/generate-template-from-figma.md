---
description: One Figma frame -> one Bricks template. Desktop is required. Tablet, Mobile and Widescreen are optional. No WordPress page.
argument-hint: --desktop <url> [--widescreen <url>] [--tablet <url>] [--landscape <url>] [--mobile <url>]
---

Build **one template** for: $ARGUMENTS

The owner attaches the template in Bricks. This command does not split a page into sections and does not assemble a WordPress page. That is `/generate-page-from-figma`.

The same job has a screen: WordPress admin → **Vietnix Tools** (one page, three steps: links, confirm, result). When the owner is already in that screen, do not also run this command.

## What the arguments are

- `--desktop` is required. It is the frame that becomes the template.
- `--tablet`, `--landscape` and `--mobile` are that same frame at the other widths. They are merged as `tablet_portrait` (991), `mobile_landscape` (767) and `mobile_portrait` (478). They are not discovered from the file.
- `--widescreen` is that same frame at a width above desktop. Bricks 1.12.3 has no widescreen breakpoint, so the differences are written as `@media (min-width: <that frame's width>px)`. A blank slot is skipped.

Every URL needs a `node-id`. All of them must be the same Figma file and different nodes.

## Steps

1. **Pre-flight.** `.env` has `FIGMA_TOKEN`. `docker compose ps` shows WordPress. Playwright stays in Docker. Do not open a browser on this machine.
2. **Read.** `node process/template.mjs read --desktop "<url>" [--widescreen "<url>"] [--tablet "<url>"] [--landscape "<url>"] [--mobile "<url>"]`. It fetches the frames, decides by the same rules as the page workflow, and prints the questions (link, alt, FAQ answer, tab pane, autoplay, loop, accordion confirm). It does not build.
3. **Confirm.** The owner fills the values. Blank stays the safe default (`#`, empty alt, empty answer). Never invent one. A value that fails the check stops the run: report that line and wait. Recheck every owner value the same way the desktop frame was read. A Figma link is fetched and reduced to the part that matches the question (the repeated items, the slide row, the expanded frame). Do not paste the whole link because the owner sent it. If that read still finds a tab bar, or two item groups of the same size, stop and say so. Write the answers as JSON and run `node process/template.mjs build --desktop "<url>" --answers '<json>'`. The click on Vietnix Tools is the same confirmation (`owner (vietnix tools)`).
4. **Result.** The command creates one template, uploads it, and verifies it (Chromium). A heavy miss rebuilds that template only (`--from=build`, at most 3 rounds) and verifies again. The same template file is not uploaded twice. The run does not stop with an error after that check. Report the template link, the look score, and what is left (designer list, a value the wide frame could not write as plain CSS). The link is the template just checked. On Vietnix Tools the result step has a feedback box. A sentence that names a part as a carousel rebuilds that one template with the repeated row as a slider. Do not run `assemble-page.mjs`. Do not rebuild other sections.

## Rules

Every generate runs `fitSoloTemplate` then `fitFluid` inside `process/scripts/05-build.mjs`. A pasted frame keeps the values it drew. A width with no frame stays inside the window. A row switches to a column only at sm 640, md 768, lg 1024, xl 1280 or 2xl 1536, for that whole band. A pasted phone frame holds until 768, so the open 479–767 band keeps that phone layout instead of a third stack. Do not patch one template's `bricks.json` to get this.

Same as the page workflow where they are about the pixels: exact Figma values, no hand-written `bricks.json`, no git writes, no invented content, no local browser. A component is built only as `process/bricks/components/README.md` and `CATALOG.md` say. On every pasted frame, look at each image: another file with the same crop is written as `sources` for that breakpoint; a crop that moves keeps that frame's own element. Do not leave the desktop file in place when the narrower frame shows a different picture.
