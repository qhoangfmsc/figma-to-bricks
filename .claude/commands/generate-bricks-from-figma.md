---
description: Figma link -> Bricks templates, automatic (a page, a breakpoint frame or one section), the owner is not asked anything
argument-hint: <figma-url-with-node-id> [--interactive] [extra requirements]
---

Run the Figma → Bricks workflow for: $ARGUMENTS

Owner decision (2026-10-27, confirmed in the chat): **this is the only workflow the owner starts, and it is automatic.** One link in, verified Bricks templates out; every decision follows the recommendation (the rules of `process/decide/` and `process/policy.json`); the owner reviews afterwards. The owner is **not asked questions** and nothing waits for an OK. The old question-by-question flow runs only when the arguments contain `--interactive` (then follow `process/SEMANTICS.md` section 3 and never sign off on your own).

The first token of the arguments is the Figma URL; the rest are extra requirements (e.g. "this row is a slider").

**Figma is the reference.** What the eye sees in Figma is what the template must show, also when a section is cut out of its frame (a transparent section keeps the fill of its page frame). Every check compares with Figma's own render.

## Steps

1. **Pre-flight (the only things that may stop you).** The URL must have `node-id` (otherwise ask for the link of the selected frame). `.env` must have `FIGMA_TOKEN`. `docker compose ps` must show WordPress running; if not, `docker compose up -d`. Docker also runs the Playwright QA (image `f2b-qa:1`, built on first use): never open Chrome or any app on the owner's machine.
2. **Run** `node process/auto.mjs "<url>"`. It works out what the link is (a whole page, one breakpoint frame, one section), builds **one template per section** (Menu, Hero, Problems… in page order), finds the tablet / mobile frames of each section and merges them as breakpoints, decides everything by rule, signs off as `autopilot`, pushes and verifies with Playwright (boxes, look vs Figma's render, covered layers, scroll, image weight, transparent areas, other browsers). `--plan` only lists the sections; `--only=<name>` runs one; a section that stops does not stop the others. A template the owner moved to the WordPress trash is replaced by a new one (not restored, not deleted for good). Output: `process/work/<fileKey>/page-<node>.md` and per section `scorecard.md`, `decisions.md`, `verify*.md`, `verify*.diff.png`. Do not use Figma MCP / `bricks-bridge` tools for this.
3. **Apply the extra requirements** the rules cannot know (a slider, a tag) with an `overrides.json` entry (`reason` quoting the owner), then re-run that section with `node process/run.mjs "<section url>" --from=build`.
4. **Fix loop (no questions; at most 3 rounds per root cause).** For every section whose verdict is FAIL or whose look score is above about 8/255:
   1. `node process/scripts/triage.mjs <section workspace>` → `triage.md`: the worst picture regions with the Figma nodes on them and the property that usually explains it, the real box mismatches grouped by check, structural problems.
   2. **Look at the picture**: `verify*.figma.png` next to `verify*.png` (lay a transparent Figma render over the page-frame fill of `context.json`), and `verify*.diff.png`. A box check alone is never a verdict, and a score is not trusted until the comparison is known to tell a wrong picture from a right one.
   3. Classify each real mismatch:
      - **a rule bug** (a Figma property dropped or mis-mapped: crop, stacking, fills, shadows, sizing, constraints…) → fix the module in `process/bricks/…` (read `process/AI-GUIDE.md` first), add a test in `process/test/`, `npm test --prefix process`, rebuild the section (`run.mjs … --from=build`);
      - **a wrong automatic decision** → fix the rule in `process/decide/` (or a default in `process/policy.json`), with a test;
      - **a limit** (text-engine difference ≤ 2.5px, live countdown, GLASS, an effect Bricks has no control for) → leave it; it stays listed;
      - **content the Figma file does not have** (URL, alt, tooltip copy, form action) → the designer list, never invented.
   4. **Regression guard after every rule change:** `node process/scripts/regress.mjs <fileKey>` rebuilds every section that has a scorecard and compares its numbers with `baseline.json`; a section that got worse means the change is reverted or narrowed. When a round ends well: `node process/scripts/regress.mjs <fileKey> --save`. (First run of a page: `--save` once after step 2 to create the baseline.)
   Never hand-write Bricks JSON or edit `bricks.json`.
5. **Report once, in Vietnamese, short** (the only message the owner reads): a table per section (look score per frame, number of real mismatches, verdict from `verify.md`, template link); the usable-output audit in a few lines (headings and the `h1`, lists, links without URL, images without alt, blocks holding content, from `scorecard.md`); the automatic decisions that matter (link to `decisions.md`); the designer list; what stays as blocks, is not supported or is a limit (with the Figma value and what Bricks does); which rules you changed in this run and the regression result; proposals for extra work. Never claim a match from box checks alone.

## When you may talk to the owner during the run

Only for a real blocker: no `node-id`, no token, Docker or WordPress down and not startable, `auto.mjs` reports BLOCKED (citations the code cannot verify) and you cannot fix it. Do not ask for decisions, do not ask for an OK, do not paste `detections.md`. If something is unclear, take the recommendation and say so in the report.

## Rules (unchanged by autopilot)

- **Never run any git command that changes state** (commit, add, push, branch, stash, reset, PR). The owner does all git. Read-only `git status/diff/log` is fine.
- Exact to the pixel: every value comes from the Figma attributes. No screenshot-based values, no invented defaults. Anything that cannot be reproduced exactly goes in the report with the Figma value, never silently approximated. Tolerances are never loosened to make a check pass; the only documented classification is the **text-engine** class of `07-verify` (width / x of text, and the picture regions on it, within 2.5px), listed separately.
- Never invent content: link URLs, alt text, tooltip copy, form actions go to the designer list; the template gets the safe default (`#`, empty alt).
- Animation is noted in `animations.md` (`process/scripts/animations.mjs`), never built while painting.
- Usable output: `block` is for layout wrappers only; real headings, lists, buttons, images with alt where the rules decided them. Real Bricks components (form, buttons…) are the next phase: when it is built it must go through this same workflow and may only make a section's numbers better (the regression guard checks it).
- Never print `.env` values. Do only what was asked; propose extra work at the end instead of doing it.
