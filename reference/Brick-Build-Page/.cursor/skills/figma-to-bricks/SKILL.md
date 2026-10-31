---
name: figma-to-bricks
description: Convert a Figma design (selected frame or Figma URL) into Bricks Builder pages/section templates using this project's PLAN → DO → DONE flow. Use when the user asks to build, convert, or port a Figma frame/page to Bricks, writes "Tên template:" (template-only, no page), or wants Bricks element JSON from Figma.
---

# Figma → Bricks (project orchestrator)

This skill only routes. The project documents are the source of truth; read them before acting instead of relying on memory.

## Required reading (in order)

Template-only (`Tên template:`): `rule_for_flow.md` (loaded by the project rule) + `figma-section-analyze` is enough for PLAN. Read other documents by section, only when a step needs them — never `cat` the whole flow file.

Full page flow:

1. `work_info.md` — Figma Desktop/Mobile URLs, page name, DONE state. This file is the user's live input and status record: never overwrite or reset it. When a blank structure is needed (new page, comparison), use `templates/work_info.template.md` in this skill folder instead.
2. `flow_figma_to_bricks.md` — PLAN → DO → DONE steps, gates, scripts.
3. `rule_for_flow.md` — mandatory rules (element IDs, tree integrity, responsive, no media upload, section-only templates).
4. `bricks-skills/MAPPING-FIGMA-FLOW.md` and `snippets/widget-map.md` — Figma layout → Bricks widget strategy.
5. `plans/_plan-template.md` — plan schema; output goes to `plans/<page-slug>.md`.

## Skills to combine

- `figma-section-analyze` — **use for every Figma analysis step** (PLAN, template-only): preflight + REST spec script → plan-ready blocks and `spec.json` settings. Faster and more exact than reading design context by hand.
- `figma-design-to-code` — how to call `get_design_context` (screenshot first, sparse-response handling, asset handling, verification). Treat the returned HTML/CSS as a reference, never as final output.
- `bricks` — JSON shapes, settings keys, breakpoint grammar, validation checklist. Its rules override guesses.
- `review-skill` — G0–G4 review during the DO phase (invoke it explicitly).

## Quick path: paste-ready JSON for the selected frame

Use when the user only wants JSON to paste into the Bricks canvas, not a full page build on the site.

1. Call `get_design_context` for the selected node, following `figma-design-to-code`.
2. Map every node to Bricks elements via `snippets/widget-map.md` and `bricks-skills/references/elements.md`; settings via `style-settings.md`.
3. Hierarchy must be `section` → `container` → `block`/`div` → leaf elements, with reciprocal `parent`/`children`, 6-char hex unique IDs.
4. Add tablet (`:tablet_portrait`) overrides whenever the Figma mobile frame differs.
5. Emit the clipboard format described in `bricks-skills/references/json-formats.md` and run its integrity checklist before delivering.
6. Use Figma asset URLs as-is for images (project rule 2 and 27); do not upload to WordPress.

## Template-only path: `Tên template:` in chat

Trigger: the user's message contains a line `Tên template: <name>`. Build section template(s) only; never create or edit a page.

1. Read the Figma URL from the same message. Missing URL or `node-id` → stop and ask.
2. Follow `rule_for_flow.md` rule 55 and the "Chế độ template-only" section of `flow_figma_to_bricks.md`.
3. Analyze with the `figma-section-analyze` skill (preflight → `analyze_figma_section.py` → one parallel MCP batch for assets), then write `plans/template-<slug>.md` from its `## Plan draft` with `- Mode: `template-only`` and no `Page ID` line; scripts rely on this to skip page checks. For a frame holding several sections, run the analyzer per child section node. `plan_from_figma.py --template-name … --create-shell` remains a fallback, but it fetches Figma depth-limited, so its tree/snapshot must be refined before DO.
4. Template name is the user's value verbatim (rule 36 on duplicates). Go straight from PLAN to DO for one or many sections (rule 56); list the templates in the final report.
5. DO with `--template-id <id>` on every command; never `--all`.

## Full path: build on the Bricks site

Follow `flow_figma_to_bricks.md` exactly: PLAN (analyze Desktop + Mobile, write `plans/<slug>.md`) → **PAUSE once** to ask which templates to skip (report `page_id`, links, section table; rule 56) → DO (one template per section, Desktop ≥98% before Mobile, gates G0–G4) → DONE report. Use Bricks MCP only; never wp-cli or direct database access.

## Run to completion (rule 56)

- Full (page) path: pause exactly once after PLAN + shell, report page links and the section table, and ask which templates need no build. Wait for the answer (chat or `work_info.md` → "Các template không cần build layout"; "build hết" = all). Never enter DO before it. Template-only path: never pause between PLAN and DO. In both paths, never pause between templates during DO.
- Run the repo's Python tooling (`python3 scripts/*.py`, `python3 -m scripts.*`, inline `python3 -` snippets importing `scripts.lib`) without asking. If a command is still blocked, request the permission once and continue.
- A section that exhausts rule 39 is recorded as failed and the flow moves on; report pass/fail for every template at the end.
- Stop and ask only on hard blockers: missing Figma URL or `node-id`, preflight failure (Figma token, Bricks MCP), publishing, or overwriting IDs outside the plan.

## Constraints

- New pages are created as `draft`; never overwrite existing pages/templates without an explicit ID.
- Write a fresh build script or MCP calls per page; do not clone artifacts from previous pages (rule 30).
- Read long designs section by section, not the whole page in one call (rule 17).
