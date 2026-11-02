---
name: generate-template-from-figma
description: Build one Bricks 1.9.8 template from a Desktop Figma URL, with optional Tablet, Mobile and Widescreen URLs. Use when the user runs /generate-template-from-figma, asks for a single template, or mentions the Vietnix Tools screen. Does not assemble a WordPress page.
---

# Generate one template from Figma

The procedure is `.claude/commands/generate-template-from-figma.md`. Read that file and follow it.

Desktop is required. Tablet, Mobile and Widescreen are optional and are the URLs the user pasted, not frames discovered from the file. The template is pushed. The user attaches it. Do not assemble a page.

Do not follow `reference/Brick-Build-Page` skills. Do not call `get_design_context`. Do not hand-write Bricks JSON.
