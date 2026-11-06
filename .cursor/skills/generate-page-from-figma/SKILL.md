---
name: generate-page-from-figma
description: Build a WordPress page of Bricks 1.12.3 templates from a Figma URL with node process/auto.mjs and the Plan gate. Use when the user runs /generate-page-from-figma or asks to turn a Figma page into a WordPress page in this repo.
---

# Generate a page from Figma

The procedure is `.claude/commands/generate-page-from-figma.md`. Read that file and follow it. The first token of the user message is the Figma URL. Anything after it is an extra requirement.

Reply in Vietnamese. Short. Do the step, then stop. Do not invent a link, alt, or FAQ answer.

This builds the page. `auto.mjs` splits the Figma frame into sections, finds each section's tablet and mobile frames, and writes one `jobs/<section>.json`. It stops once for the Plan. After the owner confirms, run `node process/auto.mjs` again: it builds every section, Playwright screenshots each frame once, and names the part on every differing region. Then the page is assembled and one report is written. If a twin frame is missing, leave that slot blank. Do not invent a breakpoint URL. Do not start a second chat per section.

Engine steps stay fetch, tree, detect, export, build, push, verify, summary. Name regex is a hint. Repeated shape plus the frame picture is the evidence. A part the rules do not claim is written to `detections.json` (`source: "ai"`, cite from `tree.md`) only after the Plan is confirmed.

No whack-a-mole. A miss on one section is a shared rule in `process/modules/recognize-parts/` or `process/modules/write-bricks/`, checked on another section with the same shape, with a test. Do not add a name regex for one file. Figma's render or the Docker Playwright shot says what the group is. The tree supplies the numbers.

Every section generate keeps undesigned widths inside the window. Layout changes at sm 640, md 768, lg 1024, xl 1280 and 2xl 1536. That lives in `process/modules/build-steps/05-build.mjs`, not in one section.

Do not follow `reference/Brick-Build-Page` skills. Do not call `get_design_context`. Do not hand-write Bricks JSON.
