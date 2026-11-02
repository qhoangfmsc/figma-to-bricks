---
description: One Figma frame -> one Bricks template. Desktop is required. Tablet, Mobile and Widescreen are optional. No WordPress page.
argument-hint: --desktop <url> [--tablet <url>] [--mobile <url>] [--widescreen <url>]
---

Build **one template** for: $ARGUMENTS

The owner attaches the template in Bricks. This command does not split a page into sections and does not assemble a WordPress page. That is `/generate-page-from-figma`.

The same job has a screen: WordPress admin → **Vietnix Tools** (one page, three steps: links, confirm, result). When the owner is already in that screen, do not also run this command.

## What the arguments are

- `--desktop` is required. It is the frame that becomes the template.
- `--tablet` and `--mobile` are that same frame at the other widths. They are merged as `tablet_portrait` and `mobile_portrait`. They are not discovered from the file.
- `--widescreen` is recorded only. Bricks 1.9.8 has no breakpoint wider than the desktop frame, so it is not merged. Say that in the report.

Every URL needs a `node-id`. All of them must be the same Figma file and different nodes.

## Steps

1. **Pre-flight.** `.env` has `FIGMA_TOKEN`. `docker compose ps` shows WordPress. Playwright stays in Docker. Do not open a browser on this machine.
2. **Read.** `node process/template.mjs read --desktop "<url>" [--tablet "<url>"] [--mobile "<url>"] [--widescreen "<url>"]`. It fetches the frames, decides by the same rules as the page workflow, and prints the questions (link, alt, FAQ answer, tab pane, autoplay, loop, accordion confirm). It does not build.
3. **Confirm.** The owner fills the values. Blank stays the safe default (`#`, empty alt, empty answer). Never invent one. A value that fails the check stops the run: report that line and wait. Write the answers as JSON and run `node process/template.mjs build --desktop "<url>" --answers '<json>'`. The click on Vietnix Tools is the same confirmation (`owner (vietnix tools)`).
4. **Result.** The command pushes one template and verifies it (Chromium). Report the template link, the look score, and what is left (designer list, widescreen not merged, a verify miss). Do not run `assemble-page.mjs`. Do not start the page fix loop unless the owner asks to change a rule.

## Rules

Same as the page workflow where they are about the pixels: exact Figma values, no hand-written `bricks.json`, no git writes, no invented content, no local browser.
