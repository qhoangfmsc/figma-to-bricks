---
name: generate-template-from-figma
description: Build one Bricks 1.12.3 template from a Desktop Figma URL, with optional Widescreen, Tablet portrait, Mobile landscape and Mobile portrait URLs. Use when the user runs /generate-template-from-figma or asks for a single template. Asks for missing breakpoint links, writes plan.md, then creates the template on WP_URL. No upload confirmation. Does not assemble a WordPress page.
---

# Generate one template from Figma

The procedure is `.claude/commands/generate-template-from-figma.md`. Read that file and follow it. Component choice follows `.cursor/skills/pipeline/SKILL.md` and `process/modules/write-bricks/components/README.md`. Which doc to open is `process/docs/INDEX.md`. One component is `process/docs/widget-components/<id>.md`. The installed Bricks 1.12.3 theme decides the setting key.

Reply in Vietnamese. Short. Do the step, then stop.

Desktop is required. If widescreen, tablet, landscape, or mobile is missing, ask once and wait. Do not invent a URL.

`read` is engine steps 1–3. It saves `look.png` and writes `plan.md`, which is not ready until `node process/template.mjs look` records the picture reading. Do not paste the form into the chat. Point to `plan.md` only after that look says ready. Then build. The plan headings are **Loại Template**, **Component Detected**, **Cần User quyết định**, and **Kết quả cần đạt được**. A plain block lists kind, Figma link, and `Kết quả mong muốn` (`expect:<id>`). A component the owner keeps or drops is under Cần User quyết định: `Quyết định dựng <loại>` (`part:<id>`), then the same kết quả line. Fields Figma drew are filled. `[Chưa có value]` is where Figma has no value. `note:plan` is the free comment. Read the `` `key`: value `` lines and write `choices.json` with one enum per line. Blank stays the default. The template is created on `WP_URL`. No upload confirmation. A Figma value already on an answer or pane line becomes `{ choice: 'text', text }` with that text. `[Chưa có value]` and a blank line are the default. "xóa" on a component line is drop. `expect` `slider` (or tab, menu, form, accordion, button, block) is that component. The build reads the enum, not the sentence. `build` is steps 4–8 and stays on the site in `WP_URL`. Then look at the verify pictures once. Do not offer a second upload to another site.

Name regex is a hint. A repeated shape plus the frame picture is the evidence. Figma's render or the headless Playwright shot says what the group is. `tree.md` supplies the numbers. Do not measure pixels off the picture.

During `read` and `build`, do not edit `process/` or the theme. A miss or a doubt is a question in `plan.md`. A rule change is a later task the owner asks for. The owner still confirms the plan once.

A component follows `process/modules/write-bricks/components/README.md` and `CATALOG.md`. Do not follow `reference/Brick-Build-Page`. Do not call `get_design_context`. Do not hand-write Bricks JSON.
