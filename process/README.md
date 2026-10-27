# Figma → Bricks workflow

One fixed flow for every section. **Code does the work; AI only fills a small, reviewable decision file.**
Bricks always mirrors the Figma tree, with every value copied from Figma, never estimated from a picture.

```
Figma URL
   │ 1 fetch    REST API: raw node JSON + every image + every vector as SVG           (code)
   ▼
 raw.json · assets/                         ← source of truth, untouched
   │ 2 tree     normalize to a tree, print it as markdown                              (code)
   ▼
 tree.json · tree.md                        ← READ THIS to know what the design is
   │            overrides.json               ← the ONLY place for human/AI decisions
   │ 3 detect   facts + which nodes are really a tooltip / button / …, each with a citation (rules + AI)
   ▼
 facts.md · detections.json · detections.md  ← proposed → approved/rejected by the owner
   ⏸ REVIEW GATE: the owner rechecks detections.md against Figma and signs off (review.json). No sign-off, no export/build/push/verify.
   │ (change the tree or a decision later and the sign-off is void)
   │ 4 export   Figma renders the nodes approved as a flat image (banner) → assets/flat (code)
   │ 5 build    deterministic mapping rules → Bricks elements                          (code)
   ▼
 bricks.json · mapping.json · report.md     ← report.md lists everything NOT mapped
   │ 6 push     upload images (sha256 de-dupe), create/update the template             (code)
   ▼
 WordPress / Bricks template
   │ 7 verify   Playwright IN DOCKER at every frame width: boxes, LOOK vs Figma's own render, covered layers,
   ▼          horizontal scroll, image weight, hidden images, WebKit + Firefox                  (code)
 verify.md · verify.png · verify.diff.png   ← pass = the values match AND the picture matches Figma, not "looks right"
```

## Folders

```
process/
  run.mjs            entry point: runs the steps below for one Figma node
  scripts/           the steps, one file each (01-fetch … 08-summary); only wiring, no rules
  facts/             step 3: the deterministic inventory (components, repeats, headings, prototype, styles)
  review/            the review gate: sign-off bound to tree + decisions; every step after detect checks it
  detect/            step 3: candidate rules (tooltip, button, sections), detections.json merge/validate, the review sheet
  figma/             everything that READS Figma: REST api, url parsing, raw → tree (normalize), tree.md renderer
  bricks/            everything that WRITES Bricks
    bridge.mjs         client of the WordPress REST bridge (templates, media, fonts, preview)
    render/            tree → Bricks elements (the rules): index, size, layout, text, style + utils/ (one file per Figma property)
    components/        registry of real Bricks components (tooltip, button, planned: form, carousel…) + README with the Figma signals
  shared/            env, workspace paths, image info, headless Chromium in a Docker container (cdp)
  test/  fixtures/   offline tests and a saved Figma fixture
  work/              one folder per Figma section (generated + overrides.json)
```

Adding or changing a rule (rotation, blur, a new fill type…): read [AI-GUIDE.md](AI-GUIDE.md).

## Run

In Claude Code, the easy way: `/generate-bricks-from-figma <figma-url> [extra requirements]`
([.claude/commands/generate-bricks-from-figma.md](../.claude/commands/generate-bricks-from-figma.md)). It runs the steps below, writes
`overrides.json` for what the rules cannot decide, re-runs, and reports from `summary.md` (step 6: ✅ done, ✗ wrong, ❓ missing,
⚠ not supported, ⏭ skipped, ◌ not measured). By hand:

```bash
node process/run.mjs "<figma-url>"                    # all steps
node process/run.mjs "<figma-url>" --from=build       # after editing overrides.json
node process/run.mjs "<figma-url>" --strict           # fail on any warning / unhandled property
node process/run.mjs "<figma-url>" --fixture process/fixtures/award   # offline, no token
npm test --prefix process                             # offline unit tests
```

Each step is also a standalone script (`scripts/01-fetch.mjs` … `scripts/08-summary.mjs`, argument: URL or workspace dir).

Needs in `.env`: `FIGMA_TOKEN` (Figma → Settings → Security → Personal access tokens, scope `file_content:read`),
plus `WP_URL`, `WP_USER`, `WP_APP_PASSWORD` (already set for the local site).
The URL must contain `node-id`: in Figma, right click the frame → *Copy link to selection*.

## Workspace

`process/work/<fileKey>/<node-id>/` holds everything for one section:

| file | made by | purpose |
|---|---|---|
| `raw.json` | 1 | exact Figma REST response for the node |
| `assets/` | 1 | `images/<imageRef>.png\|jpg`, `svg/<node>.svg`, `flat/<node>.png` (step 4, approved flat images), `manifest.json` (sha256, natural size) |
| `tree.json` / `tree.md` | 2 | normalized tree / the same tree for reading; hidden nodes shown as `HIDDEN` |
| `facts.json` / `facts.md` | 3 | deterministic inventory: components + properties, repeats, heading outline, prototype, styles |
| `review.json` / `revisions.md` | **owner** | sign-off bound to a fingerprint of tree + decisions / log of owner feedback after a build |
| `detections.json` / `detections.md` | 3 + **owner/AI** | candidate sections and components with `status` (proposed / approved / rejected); `.md` is the review sheet. Committed |
| `overrides.json` | **human / AI** | decisions the rules cannot make (see below), committed |
| `bricks.json` | 5 | elements pushed to Bricks (`{ $asset }` placeholders for images) |
| `mapping.json` | 5 | Figma node id → Bricks element id + expected position and CSS |
| `report.md` | 5 | warnings, skipped nodes, fonts, full Figma → Bricks table |
| `fonts.json`, `state.json` | 5, 6 | fonts to load; template/media ids (not committed) |
| `verify.md` / `verify.png` | 7 | measured vs Figma, screenshot |

## Autopilot: one link in, Bricks out

`node process/auto.mjs "<figma url of a section frame>" [--first-section] [--no-responsive] [--no-cross]` runs the whole pipeline without questions:
fetch, tree, detect, `decide/index.mjs` (headings from text size, ul/li for repeated groups, flat-image only for text-free decoration, icons decorative,
alt left empty and listed for the designer), `figma/discover.mjs` (the same section in the other breakpoint frames of the file), sign-off recorded as
`autopilot`, build / push / verify. Output per section: `scorecard.md` (frames, look vs Figma, image weight, other browsers, known limits),
`decisions.md` (every decision taken by a rule, why, confidence), the designer list. `--first-section` makes the section title the page's `h1`.
To change a decision: edit `detections.json` / `overrides.json` (or `policy.json` for a project-wide default) and re-run `run.mjs ... --from=build`.
`/generate-bricks-from-figma <url>` runs this by default (owner decision 2026-10-27, written into `CLAUDE.md` and the command); `--interactive` keeps the old question-by-question flow.
The fix loop after a run is part of the workflow: `scripts/triage.mjs <workspace>` (worst picture regions -> Figma nodes -> likely cause), a rule fix with a test,
then `scripts/regress.mjs <fileKey>` (rebuilds every section and compares with `baseline.json`; `--save` after a good round).

## Checks (step 7) and the QA image

Step 7 runs Playwright (Chromium, Firefox, WebKit) **inside Docker** (`shared/qa.mjs` + `qa/check.mjs`; the first run builds the image `f2b-qa:1` from
`qa/Dockerfile`; the pipeline itself still has no npm dependency). The page is rendered at the width of each Figma frame with the clock frozen and
animations off, and compared with **Figma's own render of that frame** (REST export). A mismatch is any of: a box / css value off by more than 1px, a
region of the picture clearly different from Figma (80px cells, both pictures blurred 3x3 first, live parts masked), a text / button / image with an alt
that is not on top at its own center, horizontal scroll, images heavier than `qa/budgets.json`, an image hidden by CSS that is still downloaded,
a failed request, more than one visible `h1`. Differences in the width / x of text (and of boxes that hug text) up to 2.5px, and picture regions lying on such text, are the "text-engine" class: Figma and the browser lay text out slightly differently (measured -1.2..+1.6px on 6 strings); they are listed in their own table and do not fail the run. Heights and line breaks never fall in that class. `--no-cross` skips WebKit / Firefox. `shared/cdp.mjs` is the older CDP client and is no longer used by verify.

Images are pushed as **WebP** (`shared/qa.mjs` `optimizeAssets`, cached in `assets/optimized/`; photos capped at 1600px, flat exports keep their size).
Project-wide defaults with their reasons live in `policy.json` (e.g. line heights are written as Figma lays them out, whole pixels).
Motion is never built while painting: `node process/scripts/animations.mjs <workspace> [--page=<page workspace>]` writes `animations.md` (the
designer's motion spec verbatim + prototype interactions), a backlog for the last pass.

## Responsive (breakpoint variants)

A design with several frames (desktop 1440 / tablet 768 / mobile 375) is built as ONE template: the base frame is a normal run, every other frame has its own
workspace (fetch, tree, detect, decisions carried by name with `scripts/carry.mjs`, sign-off) and is listed in the base workspace's `responsive.json`
(`key`, `workspace`, `maxWidth`, aliases for renamed nodes). Step 5 builds each variant with the normal renderer and `responsive/merge.mjs` merges it:
changed values become `<key>:<breakpoint>` settings or `@media` css, nodes that exist in one frame only are hidden where Figma has none, a wrapper a
variant dropped becomes `display: contents`. Step 7 measures the same template at every frame's width (`verify.<key>.md`). Rules and limits:
the header of [responsive/merge.mjs](responsive/merge.mjs); owner decisions: `work/<file>/<section>/responsive-decisions.md`.

## Usable output and the interview

Matching the pixels is not enough: the template must be what a Bricks developer would build (links, buttons, images with alt, lists,
headings, sliders, accordions, forms; `block` only for layout). The catalog, the question protocol (asked in the chat, section by section,
one decision per question) and the usable-output audit are in [SEMANTICS.md](SEMANTICS.md). Read it before step 3.

## Detection and components (step 3)

The Figma files are not always built cleanly (a tooltip is an icon next to a label, a form is boxes + text + inputs). Step 3 finds the
nodes that are really a Bricks component, but **a human decides**: `detections.json` lists candidates as `proposed`; the owner sets
each to `approved` (the build turns it into the component, e.g. tooltip → `data-balloon` attributes, button → `button` element) or
`rejected` (stays a block). `detections.md` is the sheet to review. Components and their status: [bricks/components/README.md](bricks/components/README.md).

## The mapping rules (step 5)

They live in the header of [bricks/render/index.mjs](bricks/render/index.mjs) (rules) and the modules next to it. Summary:

| Figma | Bricks |
|---|---|
| root frame | `section` (width 100%: the artboard is a viewport) |
| TEXT, text style `H<n>/…` | `heading` (tag `h<n>`) |
| TEXT, anything else | `text-basic` |
| rectangle/frame with image fill and no children | `image` (`FILL`→cover, `FIT`→contain) |
| image fill `CROP` | `block` wrapper (overflow hidden) + absolutely positioned `image`, percentages computed from `imageTransform` |
| subtree made only of vectors, or text in an icon font (Font Awesome…) | `svg` (file uploaded to the media library, rendered by Figma) |
| every other node | `block` |
| hidden node | not built (listed in report) |
| size FIXED / HUG / FILL | `px` / `auto` / `flex:1 1 <Figma px>` on the main axis, `align-self:stretch` on the cross axis |
| auto layout | flex: direction, gap, justify/align, padding, wrap, always written explicitly |
| no auto layout | `position:relative` parent, children `absolute` with `left/top/width/height` |
| INSIDE stroke | `_border` + padding reduced by the stroke if the padding can absorb it, else inset `box-shadow` (Figma strokes take no layout space) |
| fill, stroke, radius, shadow, opacity, clip | `_background`, `_border`, `_boxShadow`, `_opacity`, `_overflow` |
| text | font family/size/weight, line-height px, letter-spacing, align, case, decoration, color; mixed styles → `<span>`; paragraph spacing/indent → one block `<span>` per paragraph |

Linear gradients (frames and text) are done. Anything without a Bricks equivalent yet (radial/angular gradients, multiple fills/shadows, rotation, masks, blur, OUTSIDE/CENTER strokes…)
is **not guessed**: it is printed in `report.md` as a warning. `--strict` makes that a failure.

## overrides.json: the only place for decisions

```jsonc
{
  "template": { "title": "Award - Vietnix", "type": "section" },
  "nodes": {
    "<figma node id>": {
      "element": "slider-nested",          // use another Bricks element than the rule picked
      "tag": "h2",                          // html tag (e.g. text style is H4 but the page needs h2)
      "settings": { "perPage": 5 },         // deep-merged over the generated settings
      "dropSettings": ["_padding"],         // remove generated keys
      "skip": true,                         // do not build this node (e.g. replaced by a slider's own pagination)
      "alt": "…", "label": "…", "cssClasses": "…", "verify": false,
      "reason": "why, so the next person understands"   // always fill this
    }
  }
}
```

Rules for overrides: only for semantics the Figma data cannot express (tag, carousel, skip); numbers must be copied from
`tree.md`, never invented; every entry has a `reason`. Responsive values are not in Figma, so they are not generated.

## What AI is for

**AI never commits.** No `git commit/add/push/branch/stash/reset`, no PRs: the owner handles all git. AI's whole job is to pull the exact
data from Figma, build the structure, and rebuild it as a Bricks template that is exact to the pixel, with every value taken from the
Figma attributes and written as the matching Bricks attribute / CSS value. Anything that cannot be reproduced exactly is reported in
the summary table, never silently approximated. (Enforced by [CLAUDE.md](../CLAUDE.md) and the slash command.)

1. Read `tree.md` and `report.md`, **not the screenshot**.
2. Write or edit `overrides.json` for the warnings and semantics the rules cannot decide.
3. Run `--from=build`, read `verify.md`, fix with overrides. Never edit `bricks.json` by hand and never create Bricks elements
   with the MCP tools for pipeline work: the output must be reproducible from `raw.json` + `overrides.json`.

## Known limits (be aware)

- **Verify is blind to some things:** skipped nodes (e.g. the pagination dashes replaced by the slider's pagination) are not
  measured, image *content* is not compared, and a slider shows only the pages it really has (Figma's 7 dashes need 7 pages).
- Fonts: Google Fonts only (loaded by the bridge). Other families must be added on the site manually; the report lists them.
- Variables and styles are kept as names/ids; they are not turned into Bricks global classes or CSS variables yet.
- `fixtures/award` is **synthetic** (built from `get_design_context` values, not the real REST JSON). Run step 1 with a token
  to get the true raw data and compare.
