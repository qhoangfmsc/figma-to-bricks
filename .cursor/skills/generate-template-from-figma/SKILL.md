---
name: generate-template-from-figma
description: Build one Bricks 1.12.3 template from a Desktop Figma URL, with optional Widescreen, Tablet portrait, Mobile landscape and Mobile portrait URLs. Use when the user runs /generate-template-from-figma, asks for a single template, or mentions the Vietnix Tools screen. Does not assemble a WordPress page.
---

# Generate one template from Figma

The procedure is `.claude/commands/generate-template-from-figma.md`. Read that file and follow it.

Desktop is required. Widescreen, Tablet portrait, Mobile landscape and Mobile portrait are optional and are the URLs the user pasted, not frames discovered from the file. A blank slot is skipped. A filled slot is merged. The template is pushed. The user attaches it. Do not assemble a page.

Every generate, including desktop-only, keeps undesigned widths inside the window. Layout changes at sm 640, md 768, lg 1024, xl 1280 and 2xl 1536. A pasted phone frame holds until 768. That lives in `process/scripts/05-build.mjs`, not in one template.

A Figma link the owner pastes on the confirm screen is read again with the same structure rules as the desktop frame. Keep the part that matches the question. Do not paste the whole link. If that read still finds a tab bar, or two item groups of the same size, stop.

A component follows `process/bricks/components/README.md` and `CATALOG.md`. Check each image on every pasted frame. Another file with the same crop is `sources` at that breakpoint. A crop that moves keeps that frame's own picture.

Do not follow `reference/Brick-Build-Page` skills. Do not call `get_design_context`. Do not hand-write Bricks JSON.
