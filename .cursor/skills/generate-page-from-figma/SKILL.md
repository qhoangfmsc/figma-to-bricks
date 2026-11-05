---
name: generate-page-from-figma
description: Build a WordPress page of Bricks 1.12.3 templates from a Figma URL with node process/auto.mjs and the Plan gate. Use when the user runs /generate-page-from-figma or asks to turn a Figma page into a WordPress page in this repo.
---

# Generate a page from Figma

The procedure is `.claude/commands/generate-page-from-figma.md`. Read that file and follow it. The first token of the user message is the Figma URL. Anything after it is an extra requirement.

This builds the page (one template per section, then one WordPress page). One template with hand-pasted breakpoint links is `generate-template-from-figma`.

Every section generate keeps undesigned widths inside the window. Layout changes at sm 640, md 768, lg 1024, xl 1280 and 2xl 1536. That lives in `process/scripts/05-build.mjs`, not in one section.

Do not follow `reference/Brick-Build-Page` skills. Do not call `get_design_context`. Do not hand-write Bricks JSON.
