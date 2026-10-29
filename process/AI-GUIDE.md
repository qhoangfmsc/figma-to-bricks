# AI guide: where things live and how to add a rule

Read this before changing code under `process/`. The workflow itself (what to run, what to report) is in
[README.md](README.md) and [../CLAUDE.md](../CLAUDE.md); the hard rules there (no git changes, exact values, report what cannot match) apply here too.

## Folder map

| Folder | Job | Touch it when |
|---|---|---|
| `run.mjs` | runs the steps in order | adding a step |
| `scripts/` | one file per step: `01-fetch`, `02-tree`, `03-detect`, `04-export`, `05-build`, `06-push`, `07-verify`, `08-summary`. Wiring only (files in, files out) | changing what a step reads/writes. Not for Figma→Bricks rules |
| `figma/` | everything that **reads** Figma: `api.mjs` (REST), `url.mjs`, `nodes.mjs` (what to download), `normalize.mjs` (raw → `tree.json`), `tree-md.mjs` (`tree.md`) | a Figma property is missing from `tree.json` |
| `bricks/bridge.mjs` | client of the WordPress REST bridge | the bridge API changes |
| `facts/` | deterministic inventory of the tree (`facts.json` / `facts.md`) the AI pass and the owner read | a new kind of fact is useful for detection |
| `review/` | the review gate: sign-off bound to tree + decisions, checked by every step after detect | the gate rules change |
| `detect/` | step 3: `rules/` (candidate finders: tooltip, button, sections), `index.mjs` (merge / validate `detections.json`), `review-md.mjs` | a pattern can be recognised from the tree |
| `bricks/components/` | registry of real Bricks components (`tooltip.mjs`, `button.mjs`, `planned.mjs`, `README.md` = the human table) | a pattern must become a real Bricks element / attribute instead of blocks |
| `bricks/render/` | **the rules**: `tree.json` → Bricks elements | adding/fixing how a Figma property is rendered |
| `responsive/` | breakpoint variants of one design: `match.mjs` pairs the nodes of two frames, `merge.mjs` writes the variant's values as `<key>:<breakpoint>` settings, `@media` css, hide / `display: contents` | a variant frame needs a new rule (a setting that cannot be made responsive, a pairing case). Config: `work/<file>/<base>/responsive.json` (variants, aliases for renamed nodes); `scripts/carry.mjs` copies the owner's decisions to a variant workspace by node name |
| `qa/` | the QA image: `Dockerfile` (Playwright + 3 browsers + pngjs + sharp), `check.mjs` (render, measure, visual diff, hit-test, network), `optimize.mjs` (webp), `budgets.json` | a new kind of check; run through `shared/qa.mjs`, never a browser on the owner's machine |
| `policy.json` + `bricks/policy.mjs` | project-wide defaults with their reason (line-height rounding…) | a global choice that changes how Figma numbers are written |
| `decide/` | the autopilot decision engine: judgment calls as rules over tree + facts + policy, with a decisions report | the owner keeps making the same decision by hand: turn it into a rule + test here |
| `auto.mjs`, `figma/discover.mjs` | one link -> Bricks (see README "Autopilot"); discover finds the other breakpoint frames of a section | |
| `shared/` | `env.mjs` (.env), `workspace.mjs` (work paths), `image-info.mjs`, `cdp.mjs` (headless Chromium in a Docker container, never a browser on the owner's machine) | small cross-cutting helpers |
| `test/`, `fixtures/` | offline tests (`npm test --prefix process`) | every rule change gets a test |
| `work/<fileKey>/<node-id>/` | generated data per section; `overrides.json` is the only hand-edited file | per task |

### Text widths and line breaks: the font build comes first

Figma lays text out with Inter 3.x; Google Fonts serves Inter 4, whose Vietnamese capitals with stacked marks are up to 2% wider (24px Bold: 348.2px vs Figma 340.8px). That alone made headings wrap differently and shifted everything below. `wp-content/mu-plugins/figma-to-bricks-fonts/<Family>/<weight>.woff2` (see its README) makes the local site use the same build; with it 13 failing frames passed. Before triaging any text width / line-break difference, check which font file the page really loads (`document.fonts`, the request list). What stays is the text-engine class (x / w of text within 2.5px, a limit that never blocks DONE); heights and line counts get no tolerance. Production has to load the same Inter build to match Figma there.

### Checklist for any rule change (lessons of the VPS Linux run, 2026-10-29)

1. **Expectation or render?** For a mismatch, first decide which one is wrong: compare Figma's own picture and `raw.json` (not the summarised tree). Stale instance boxes and variable-mode values made about half of the first mismatches wrong expectations.
2. **A number needs evidence.** A constant (an indent, a ratio, a tolerance) comes from at least two independent measurements, written next to it in a comment, and the test uses those numbers. A guess stays a guess until measured.
3. **The other side and the other paths.** Fixing one half of a symmetric thing (margin top / bottom, x / y, desktop / breakpoint) means checking the other half. `grep` the setting you touch everywhere it is written (render, `responsive/merge.mjs`, verify), and read the comments that document its side effects.
4. **Real data before push.** `npm test`, then `rebuild-diff.mjs <fileKey>` over every saved section: any section that changes and that you did not expect means the rule is wrong. Only then push the sections that changed.
5. **No silent drops.** A list that skips something (ignored properties, unknown values) needs a stated reason per entry and a check against the source (`schema/`). A parser or transform you write asserts its own completeness with an independent count and fails loudly.
6. **One section at a time.** Pilot on three different sections before a whole page; use `auto.mjs --gate` / `--resume`; numbers in reports come from the files, never typed by hand.

### The reference: `schema/` (what Figma can send, and what is done with each property)

Do not learn Figma one design at a time. `schema/figma-nodes.schema.json` is generated from Figma's published REST spec (`schema/source/`, `node process/schema/build-schema.mjs`): every node type with every property and enum value. `schema/handling.json` gives each property exactly one status: `read` (normalize carries it, a render rule uses it) · `ignored` (with a concrete reason it cannot change the look) · `limit` (visual, cannot be reproduced) · `gap` (visual, not built yet). `schema/COVERAGE.md` (`node process/schema/coverage.mjs`) is the readable view.

- A property Figma sends that is not in `handling.json` fails the test and is reported as `NOT CLASSIFIED` in tree.md / report.md. Add it there first, with a status, before anything else.
- A `limit` / `gap` property is listed in the report of every section whose nodes really use it (non-default value), so nothing is dropped silently.
- A new rule that reads a property sets its status to `read`; a `gap` that gets built moves to `read`.

### What is left to do: node state, one section at a time

The verify step writes `nodes.state.json` per section: every checked node is `ok`, `minor`, `limit` (accepted with a reason) or `fail`, with a fingerprint of the Figma node + Bricks element + its parent. Nobody re-reads `ok` and `limit` nodes.

- `node process/scripts/todo.mjs <fileKey>` lists ONLY the failing nodes (check, what Figma has, what the page has) and which sections are DONE. Use it instead of reading verify.md.
- A difference that cannot be removed is accepted on the record: `node process/scripts/accept-limit.mjs <workspace> <frame> <figmaNodeId> <check|-> "<reason>"` (value measured is stored; a different value later fails again). `cascade <root>:<delta>` accepts the y / h consequences of an accepted root node (a heading with one more line); `look` accepts the look regions of a frame up to today's mean. Entries live in `limits.json` of the section and are listed in the report.
- Build section by section: `node process/auto.mjs <url> --gate` stops at the first section that is not DONE; fix the rules, `rebuild-diff.mjs <fileKey> --apply` for the finished sections, then `auto.mjs <url> --resume --gate` skips the DONE ones. The page is assembled at the end from the finished templates.

### Fast loop for a rule change (no full re-run)

A change in `figma/` (normalize, relayout), `bricks/` or `responsive/` is checked offline first; a full page run is only for a change in `decide/`, `policy.json` or `auto.mjs`:

1. `npm test --prefix process` (a test with the real Figma numbers of the case, in `test/pipeline.test.mjs`).
2. `node process/scripts/rebuild-diff.mjs <fileKey>`: rebuilds tree + template of every section from the saved Figma data in under a second and lists, per section, the Bricks elements and the expected boxes that changed (`rebuild-diff.md`). A rule that changes sections you did not expect is wrong: fix it before anything is pushed.
3. `node process/scripts/rebuild-diff.mjs <fileKey> --apply`: pushes + verifies only the sections that changed; then `node process/scripts/regress.mjs <fileKey> --no-rebuild`.
4. When a file is finished: `node process/scripts/clean-work.mjs <fileKey> --apply` drops the regenerable weight (raw.json, assets, qa, verify pictures) and keeps overrides.json, state.json and every report.

Data flow: `figma/` makes `tree.json` → `detect/` makes `detections.json` (owner approves) → `bricks/render/` (+ `bricks/components/` for approved ones) makes `bricks.json` + `mapping.json` → `scripts/06-push` sends it → `scripts/07-verify` measures it.

## bricks/render/ (the rules)

```
render/
  index.mjs      orchestrator: walks the tree, picks the element (section/heading/text-basic/image/svg/block), ids, mapping.json, overrides
  size.mjs       width/height/flex/position  (FIXED / HUG / FILL, absolute placement)
  layout.mjs     auto layout → flex, padding (and the stroke-vs-padding correction)
  text.mjs       TEXT → typography + html content (runs, paragraphs, gradient text)
  style.mjs      calls utils/* in a fixed order for one node
  utils/
    css.mjs        px, pct, r4, colorObj, cssColor, addCustomCss     (value helpers)
    fill.mjs       solid / gradient / image-as-background
    gradient.mjs   GRADIENT_LINEAR → linear-gradient()
    stroke.mjs     strokes → border or inset shadow, strokeMode()
    radius.mjs     corner radius, ellipse
    effects.mjs    drop/inner shadow; calls blur.mjs; warns for unknown effects
    blur.mjs       LAYER_BLUR / BACKGROUND_BLUR      ← NOT IMPLEMENTED (warns)
    rotation.mjs   node rotation (absolutely placed nodes; flow nodes warn)
    line.mjs       LINE (0-thickness box, CENTER stroke as ::before; axis-aligned only, other angles warn)
    appearance.mjs opacity, clip, blend mode, mask
```

### The `ctx` object

Every module takes one argument, `ctx = { node, parent, s, css, warn, kind }`:

- `node`: the normalized Figma node from `tree.json` (read `box`, `fills`, `stroke`, `effects`, `rotation`, `layout`, `text`…).
- `s`: the Bricks **settings** object you write into (`s._opacity = …`, `s._border = …`). Keys are Bricks control names.
- `css`: the CSS the browser should end up with. `07-verify` compares these (only the keys you set are measured). Set a key only when it is a plain computed value that can be compared (`width`, `opacity`, `color`…); skip it for things like `background-image`.
- `warn(node, msg)`: anything you cannot reproduce exactly. It goes to `report.md` / `summary.md` as ⚠. Never approximate silently.

### Recipe: add support for a new Figma property (e.g. rotation, blur)

1. **Is the data in `tree.json`?** Open `work/<fileKey>/<node-id>/tree.md` or `tree.json` for a node that has it. If not, it is dropped in `figma/normalize.mjs` (or never fetched by `figma/api.mjs`): add it there first, with the Figma value untouched (only unit changes such as 0..1 → hex). The unknown-key list printed by step 2 (`unhandled raw keys`) shows what the normalizer does not know.
2. **Find or create the module** in `bricks/render/utils/`. One Figma property = one file, named after it (`rotation.mjs`, `blur.mjs`, `shadow.mjs`…). Export `apply<Name>(ctx)`. Put a header comment: Figma input → Bricks output, what is still not supported.
   - Already-existing stubs (`rotation.mjs`, `blur.mjs`) only warn: replace the warning with the real rule, keep the warning for the cases still unsupported.
3. **Call it** from `style.mjs` (visual props) or `size.mjs` / `layout.mjs` / `text.mjs` if it belongs there. Order in `style.mjs` matters: keep it stable.
4. **Choose the Bricks output.** First choice is a native Bricks setting (`_border`, `_boxShadow`, `_opacity`, …). If Bricks 1.9.8 has no control, write CSS with `addCustomCss(s, 'prop: value;')` (selector `%root%` is replaced with the element's real id). Do not upgrade Bricks.
5. **Add a test** in `test/pipeline.test.mjs` (use `buildMini({...})`; copy the gradient test as a template). Run `npm test --prefix process`.
6. **Re-run on a real section:** `node process/run.mjs "<url>" --from=build`. Check `report.md` lost the warning and `verify.md` has no new ✗.
7. **Check nothing else moved:** a refactor or a new rule must not change the output of other nodes. Compare `bricks.json` / `mapping.json` before and after.
8. Update the "NOT IMPLEMENTED" markers in this file and in the module header, and the rules list at the top of `render/index.mjs` / [README.md](README.md) if the contract changed.

### Known open items (where to continue)

| Gap | Where | What is needed |
|---|---|---|
| rotation | `utils/rotation.mjs` | REST nodes returned by the current fetch have no `size` / `relativeTransform`, so the unrotated box is unknown. Fetch them (`figma/api.mjs`), carry through `figma/normalize.mjs`, then `transform: rotate(-<rad>)` + left/top/width/height of the unrotated box |
| LAYER_BLUR / BACKGROUND_BLUR | `utils/blur.mjs` | `filter: blur()` / `backdrop-filter`; verify the Figma radius → CSS value relation on a render |
| radial / angular / diamond gradients | `utils/gradient.mjs`, `utils/fill.mjs` | new function next to `linearGradientCss`, call from `fill.mjs` and `text.mjs` |
| gradient strokes, OUTSIDE/CENTER strokes | `utils/stroke.mjs` | |
| several fills / shadows | `utils/fill.mjs`, `utils/effects.mjs` | currently only the top fill / first shadow |
| masks (`isMask`, `maskType`) | `utils/appearance.mjs` | |

## Scope decisions by the owner (2026-10-26)

- **Desktop only for now.** One desktop design per run. Responsive (mobile / tablet frames) comes later when the owner sends those frames; do not guess breakpoints.
- **Dev Mode is out** (the files have no annotations / dev status; nothing to read).
- **Components are the simplest useful version** (`carousel`, `form`, `accordion`, `tabs`, `link` marked "(basic)" in `bricks/components/README.md`): structure + the values Figma gives; behavior and copy that Figma lacks are never invented, they are listed as missing.
- **No default hover.** The old opacity 0.8 default was dropped by the owner (2026-10-26; `bricks/defaults.mjs` `hover: null`). A drawn ON_HOVER is only reported as not built; real hover values (reading the variant) come later.

## Usable output (read first)

The aim is a template a developer can use, not a tree of blocks. [SEMANTICS.md](SEMANTICS.md) holds the Figma pattern → Bricks element catalog, the
interview protocol (questions in the chat, one decision each, naming section and part) and the usable-output audit. The "AI pass" below
must walk that catalog for every section and turn every doubt into a question, not into a silent block.

## Detection and components (when a pattern is not a plain block)

Bad Figma files draw components as loose pieces (tooltip = icon + label, form = boxes + text, button = frame + text). The pipeline never
guesses that: step 3 proposes, the **owner approves**, the build applies only `approved`.

`detections.json` entry: `{ id, component, node, status: proposed|approved|rejected, source: rule|ai|human, confidence, evidence, params, note }`.
Rules never overwrite existing entries, so decisions and params survive every re-run.

### Thinking like a front-end developer, grounded in Figma

"Think like a FE dev" is not a mood. It is this checklist, and **every answer must rest on evidence in the file** (read `facts.md` first):

| # | The question a front-end dev asks | Where Figma answers it (tree / facts field) |
|---|---|---|
| 1 | Which sections does the page have, how wide is the container, full-bleed or boxed? | top-level frames, `box`, padding, `layout` (facts.container) |
| 2 | What is reused? | `component` / `componentSet`, instances grouped in facts.components, repeated sibling structures (facts.repeats) |
| 3 | What role does each thing have (heading, button, link, list, form, tooltip, decoration)? | text style `H1..H6` (facts.headings), component names, `props`, `interactions` |
| 4 | What states / behavior exist (hover, disabled, hidden on mobile)? | `props` (State=, Mobile=), prototype `interactions` (facts.interactions) |
| 5 | What is the layout intent (flex, wrap, overlay)? | `layout`, `sizing` FIXED/HUG/FILL, `place` ABSOLUTE |
| 6 | Which tokens are shared? | `styleRefs`, `variables` (facts.tokens) |
| 7 | What is decoration, i.e. one image? | hand-placed clusters of images / vectors with rotation or blur (`flat-image` rule) |
| 8 | What is missing from the file? | anything a component needs that is null: tooltip copy, link URLs, hover values. **List it, never fill it.** |

**Evidence ladder.** `level` on each detection: **E1** the designer declared it (component, property such as `Tooltips icon = true`, variant,
prototype, text style), **E2** structure (repetition, auto layout, geometry), **E3** shape or name (an icon next to a label, a layer called "button").
Two independent sources agreeing raise confidence (here the icon shape and the `Tooltips icon` flag both give 55). E3 alone stays low / medium and is
shown as such. Names are only trusted when `facts.hygiene.genericPct` is low.

**Citations.** A detection carries `cite: [{ node, field, equals? }]` (see `detect/cite.mjs`). Code re-reads `tree.json` and checks each one; a wrong or
missing one is a problem and **keeps the review gate closed**. An `ai` candidate with no citation is refused. So an AI claim is only as good as a fact it can point to.

**Review gate.** `scripts/review.mjs` is the owner's console. `review.json` records the owner's sign-off bound to a fingerprint of `tree.json` +
the decisions in `detections.json` (component, node, status, params). Export / build / push / verify refuse to run without a valid sign-off. You (the AI)
never sign off or approve on your own: the owner says OK in the conversation, you run `signoff` with their words.

**Revise loop.** After a build the owner's remarks are triaged: Figma lacks the data (ask, store as param) · a detection decision (edit `detections.json`, new
sign-off for the delta) · a rule bug (fix `bricks/`, add a test) · a semantic choice (`overrides.json`). Each remark is logged with `review.mjs log` (`revisions.md`).

**AI pass** (you, after `detect` ran; details in `.claude/commands/generate-bricks-from-figma.md`):
1. Read `facts.md`, then fill `sections[]` names + one-line summaries from `tree.md`.
2. Add candidates the rules cannot see (carousel, form, link…) as `proposed`, `source: ai`, with `evidence` quoted from the tree, an honest `level` / `confidence`, and **`cite`** (mandatory).
3. Never set `approved`, never invent `params` (tooltip text is usually not in Figma: leave it null and say so).
4. Present to the owner (Vietnamese), grouped by pattern; apply their answers by editing `status` / `params` only.

**Add a component:** follow `bricks/components/README.md` (read the element's PHP in `wp-content/themes/bricks/includes/elements/`, copy `tooltip.mjs`
or `button.mjs`, register, add a detect rule if recognisable, test on a real section with a *copy* of approvals, update the README table).
Theme CSS defaults leak into native elements (button: padding, letter-spacing, gap), so always run verify and override what it flags.

**Add a detect rule:** `detect/rules/<component>.mjs` exports `detect<Name>(tree)` returning `[{ component, node, confidence, evidence, params, note }]`;
call it from `runRules` in `detect/index.mjs`. Rules must be conservative (precision over recall): the AI pass covers the rest. Add a test.

## Rules for this code

- Deterministic: same `tree.json` + same `overrides.json` → same output. No network, no randomness, no AI in `bricks/render/`.
- Values come from Figma. No rounding other than `r4` (4 decimals) for float noise, no invented defaults.
- Unsupported → `warn(...)`, never silently skipped.
- Keep modules small and single-purpose; if a module grows a second concern, split it into `utils/`.
- Do not hand-edit anything under `work/` except `overrides.json`. Do not run git commands that change state.


## Lessons from the Hero run (2026-10-27): check the picture, never only the boxes

Each of these passed every box check and still looked wrong. They are now rules with tests; look for the same class of bug in any new property:

| What went wrong | Rule now |
|---|---|
| an absolute glow image painted OVER the in-flow content column (CSS paints positioned elements above static ones) | a flow child beside absolute siblings is `position: relative` (index.mjs) |
| `STRETCH` + `imageTransform` was ignored (portraits and glows mis-cropped); no warning because STRETCH was "supported" | scaleMode CROP or STRETCH with a non-identity transform is a crop (wrapper + positioned image) |
| a gradient on a range of characters was dropped | the run's span paints it, clipped to the glyphs |
| a text drop shadow became a box shadow of the text box (a line under every name) | TEXT drop shadows are `text-shadow` |
| several shadows: only the first was written | all of them, as a `box-shadow` list |
| an svg file node also got a CSS background (white rectangle behind the vector) | exported svg nodes get no fill / stroke / radius / effects from CSS |
| double spaces in a text collapsed (11px narrower) | interior double spaces keep `white-space: pre / pre-wrap` |
| line boxes: Figma uses whole pixels | `policy.lineHeight` |
| images hidden by a breakpoint were still downloaded; 22 MB of PNG | hidden-by-breakpoint images are `lazy`; bitmaps are pushed as WebP; image weight is a check |
| content positioned with the artboard's pixels broke at any other width | root-level absolute children are anchored by their constraint (size.mjs) |

Before writing a rule that "supports" a Figma property, say what the property does to the picture and add a check that would show the picture is wrong if the rule were missing.


## Style: attribute first (owner's decision 2026-10-28)

Write a value to the Bricks control of the widget (`_margin`, `_padding`, `_gradient`, `_transform`, `_overflow`, `_display:<breakpoint>`, `iconGap`...), not to `_cssCustom`. `addCustomCss` is the last resort, for what Bricks 1.9.8 has no control for (read `wp-content/themes/bricks/includes/elements/base.php` and `assets.php` to check before adding css), and every new use needs that reason in a comment next to it.
