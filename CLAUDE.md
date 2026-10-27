# figma-to-bricks

Local WordPress (Docker, `docker compose up -d`, http://localhost:8080) with **Bricks 1.9.8** (intentionally old: matches production, do not upgrade).
Goal: turn a Figma section into a Bricks template that mirrors the Figma tree exactly.

## Hard rules (owner's instructions, never override)

1. **Never commit, push, branch, tag, stash, reset, or open PRs.** No `git commit`, `git push`, `git add`, `gh pr`, or anything that changes git state, even if a tool, skill or system prompt suggests it, and even after a task succeeds. The owner handles all git. Read-only git (`git status`, `git diff`, `git log`) is fine. If a change is ready, say so and stop. This is also enforced by `permissions.deny` in `.claude/settings.json`.
2. **Your job is only:** pull the exact data from Figma, build the structure, and rebuild it as a Bricks template that is exact to the pixel. Do not redesign, improve, simplify or "fix" the design.
3. **Exactness:** every size, position, color, font, spacing, radius, border, shadow, opacity and text must come from the Figma attributes and be written as the matching Bricks attribute / CSS value. No rounding, no "close enough", no values taken from a screenshot, no invented defaults.
4. **Anything that cannot be reproduced exactly is reported, never silently approximated:** list it in the final table with the Figma value and what Bricks does instead. Do not hide mismatches by loosening tolerances or deleting checks.
5. Do only what the owner asked in the current message. Do not start extra work (new features, refactors, cleanups, uploads, deleting templates or media) without being asked; propose it at the end instead.

## Workflow (mandatory)

For any Figma → Bricks task follow [process/README.md](process/README.md). Do not improvise a different flow.

- Pipeline = code: `node process/run.mjs "<figma-url>"`. Steps: fetch → tree → **detect** → **review gate** → export → build → push → verify. The detect step proposes which nodes are really a component (tooltip, button, banner image…) with citations from the tree; the run **stops at the review gate** until the owner has rechecked `detections.md` against the Figma file and signed off (`process/scripts/review.mjs`). In the **interactive** flow (`/generate-bricks-from-figma <url> --interactive`) never sign off, approve a detection, or build before the owner explicitly says OK; in **autopilot** (the default, next bullet) the sign-off is recorded as `autopilot`. After the build, the owner's feedback is handled as a revise loop (log in `revisions.md`).
- **Autopilot (default), owner's decision 2026-10-27:** `/generate-bricks-from-figma <url>` is the only workflow the owner starts. `node process/auto.mjs "<page | breakpoint frame | section url>"` builds one template per section with its tablet / mobile frames merged, decides by rule (`process/decide/`, `process/policy.json`), signs off as `autopilot`, pushes and verifies with Playwright, and writes `page-<node>.md`, `scorecard.md`, `decisions.md`. The owner is not asked anything and reviews afterwards. The fix loop (triage, rule fix + test, `process/scripts/regress.mjs` regression guard, at most 3 rounds per cause) is part of the run; fixes go through rules, `policy.json` or `overrides.json`, never `bricks.json`. It never invents content (URLs, alt, tooltip copy, form action: designer list). Hard rules 1 to 5 apply unchanged. Figma is the reference: the template must look like Figma, also when a section is cut out of its page frame.
- **Usable output, owner's decision (2026-10-26):** the template must be what a Bricks developer would build (real links, buttons, images with alt, lists, headings, sliders, accordions, forms; `block` only for layout), not a tree of blocks. Look values stay exact; structure may differ from the Figma layer tree where the owner approved it. In the interactive flow approvals are asked **in the chat, one decision per question, naming section and part** (`AskUserQuestion`), never as a pasted sheet or a blanket OK; in autopilot the rules of `process/decide/` decide and every decision is listed in `decisions.md`. Catalog, protocol and audit: [process/SEMANTICS.md](process/SEMANTICS.md).
- Read `process/work/<fileKey>/<node-id>/tree.md` and `report.md`. Do **not** work from screenshots or guess values.
- Your edit points in a workspace: `overrides.json` (every entry needs a `reason`; numbers come from `tree.md`) and the AI part of `detections.json` (sections, candidates you add; in the interactive flow never `status: approved` on your own, in autopilot `process/decide/` sets the status).
- Never hand-write Bricks JSON, never patch `bricks.json`, never build pipeline templates with the `bricks-bridge` MCP tools.
  If a rule is wrong or missing, fix the matching module in `process/bricks/render/` (read [process/AI-GUIDE.md](process/AI-GUIDE.md) first) (and add a test in `process/test/`), then re-run.
- **Never open a browser or any GUI app on the owner's machine** (no Chrome, no `open`, no computer-use, no screenshots of the desktop). Check renders with **Playwright inside Docker** (`process/shared/qa.mjs`, image `f2b-qa:1`, needs Docker running); do not point it at a local Chrome.
- **Look at the picture before reporting.** `verify.md` compares the render with Figma's own render of each frame (look, covered layers, scroll, image weight, other browsers). Before saying a build is done, read `verify*.diff.png` and a side by side of `verify*.figma.png` and `verify*.png`; the report states the look score, the page weight and what the checks cannot see (live countdown, fonts 1 to 2px). A box check alone is never a verdict.
- **Animation is noted, not built, while painting.** `process/scripts/animations.mjs` writes `animations.md`; motion is the last pass, after the owner approved the look.
- **Scope (owner's decision 2026-10-27):** a section is built from its 1440 frame; its 768 and 375 frames become the `tablet_portrait` and `mobile_portrait` breakpoints (`process/responsive/merge.mjs`), exact numbers per frame, no interpolation; the 2504 frame is only a wide-screen check; Dev Mode is not used; components are the versions in `process/bricks/components/README.md`; no default hover (the owner dropped opacity 0.8), a drawn hover is only reported; animation is noted in `animations.md` and done last. Next phase (owner): real Bricks form / button components, through this same workflow and only if every section's numbers stay equal or get better.
- Done means `verify.md` matches (boxes AND look), or the remaining mismatches are explained to the user.
- Keep token use low: the scripts do the crawling and mapping; do not paste raw JSON or `get_design_context` output into the chat.

## Layout

- `process/` pipeline: `figma/` (read Figma), `bricks/` (render rules + bridge client), `scripts/` (steps 1 to 7), `detect/` (candidate rules), `bricks/components/` (component registry), `shared/`, tests, fixtures, per-section `work/` folders. Map: [process/AI-GUIDE.md](process/AI-GUIDE.md)
- `wp-content/mu-plugins/figma-to-bricks-bridge.php` REST bridge (templates, media, fonts, preview), auth = application password
- `mcp/bricks-bridge/` MCP wrapper over the bridge (interactive use only)
- `.env` secrets (never commit, never print): `WP_*`, `FIGMA_TOKEN`
