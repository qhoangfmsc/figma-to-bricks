# Brick-Build-Page — Figma → Bricks Builder

This project converts Figma designs into Bricks Builder (WordPress) pages and section templates.
The rules below are the single source of truth (same as `.cursor/rules/figma-to-bricks.mdc`).

@rule_for_flow.md

## Workflow

- Step-by-step process: `flow_figma_to_bricks.md` (PLAN → DO → DONE, gates G0–G4). Read it by section, not all at once.
- Live input and status: `work_info.md`. Never overwrite or reset it.
- For a Figma → Bricks task, use the `figma-to-bricks` skill (in `.claude/skills/`), which routes to
  `figma-section-analyze`, `figma-design-to-code`, `bricks` and `review-skill`.
- A message containing `Tên template: <name>` means template-only mode: build section templates, never create or edit a page.

## Tooling

- Python scripts: `python3 scripts/<name>.py`, `python3 -m scripts.<module>`; dependencies are in `requirements.txt`; secrets are in `.env`.
- Bricks is reached only through the `bricks-mcp` MCP server (`.mcp.json`, local WordPress at localhost:8080). Never use wp-cli or direct database access.
