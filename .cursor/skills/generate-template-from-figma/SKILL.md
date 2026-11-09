---
name: generate-template-from-figma
description: Build one Bricks 1.12.3 template from a Desktop Figma URL, with optional Widescreen, Tablet portrait, Mobile landscape and Mobile portrait URLs. Use when the user runs /generate-template-from-figma or asks for a single template. Asks for missing breakpoint links, writes plan.md for the owner to fill, and builds only after Xác nhận: có. Does not assemble a WordPress page.
---

# Generate one template from Figma

The procedure is `.claude/commands/generate-template-from-figma.md`. Read that file and follow it. Component choice follows `.cursor/skills/pipeline/SKILL.md` and `process/modules/write-bricks/components/README.md`. Which doc to open is `process/docs/INDEX.md`. One component is `process/docs/widget-components/<id>.md`. The installed Bricks 1.12.3 theme decides the setting key.

Reply in Vietnamese. Short. Do the step, then stop.

Desktop is required. If widescreen, tablet, landscape, or mobile is missing, ask once and wait. Do not invent a URL.

`read` is engine steps 1–3. It writes `plan.md` in the desktop workspace. Point to that file and stop. Do not paste the form into the chat. The plan heading is **Component Detected**. It lists every recognized component, including a block: kind, Figma link, the fields Figma already filled, and `[Chưa có value]` where Figma has no value. `expect:<id>` is where the owner can name a different component. `note:plan` is free comment. The owner writes any words on the `` `key`: value `` lines and sets `Xác nhận: có`. Before build, read those words and write `choices.json` with one enum per line. A Figma value already on an answer or pane line becomes `{ choice: 'text', text }` with that text. `[Chưa có value]` and a blank line are the default. "xóa" on a component line is drop. `expect` `slider` (or tab, menu, form, accordion, button, block) is that component. The build reads the enum, not the sentence. `build` is steps 4–8. Then look at the verify pictures once.

Name regex is a hint. A repeated shape plus the frame picture is the evidence. Figma's render or the Docker Playwright shot says what the group is. `tree.md` supplies the numbers. Do not measure pixels off the picture.

During `read` and `build`, do not edit `process/` or the theme. A miss or a doubt is a question in `plan.md`. A rule change is a later task the owner asks for. The owner still confirms the plan once.

A component follows `process/modules/write-bricks/components/README.md` and `CATALOG.md`. Do not follow `reference/Brick-Build-Page`. Do not call `get_design_context`. Do not hand-write Bricks JSON.
