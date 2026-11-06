---
name: generate-template-from-figma
description: Build one Bricks 1.12.3 template from a Desktop Figma URL, with optional Widescreen, Tablet portrait, Mobile landscape and Mobile portrait URLs. Use when the user runs /generate-template-from-figma or asks for a single template. Asks for missing breakpoint links, writes plan.md for the owner to fill, and builds only after Xác nhận: có. Does not assemble a WordPress page.
---

# Generate one template from Figma

The procedure is `.claude/commands/generate-template-from-figma.md`. Read that file and follow it.

Reply in Vietnamese. Short. Do the step, then stop.

Desktop is required. If widescreen, tablet, landscape, or mobile is missing, ask once and wait. Do not invent a URL.

`read` is engine steps 1–3. It writes `plan.md` in the desktop workspace. Point to that file and stop. Do not paste the form into the chat. **Component sẽ dựng** is one heading per approved component, then its fields. **Đoán, chưa gắn** is `open`, and only when a row exists: Figma link plus the evidence. **Ô cùng hình, chưa gắn** is `repeats`, and only when a row exists. The owner fills the `` `key`: value `` lines and sets `Xác nhận: có`. Build only after that. `build` is steps 4–8. Then look at the verify pictures once.

Name regex is a hint. A repeated shape plus the frame picture is the evidence. Figma's render or the Docker Playwright shot says what the group is. `tree.md` supplies the numbers. Do not measure pixels off the picture.

No whack-a-mole. A miss is a gap in `process/modules/recognize-parts/` or `process/modules/write-bricks/`, checked against another section with the same shape, with a test. Do not add a name regex for one file. The owner still confirms the plan once. Do that work first, then show the plan and wait.

A component follows `process/modules/write-bricks/components/README.md` and `CATALOG.md`. Do not follow `reference/Brick-Build-Page`. Do not call `get_design_context`. Do not hand-write Bricks JSON.
