# Bricks components: Figma pattern → real Bricks component

The Figma files we get are not clean: a tooltip is an icon next to a label, a form is boxes + text + inputs, a button is a frame
with a text. A tree of blocks reproduces the picture but is not what a Bricks developer wants to edit. This folder holds the
**list of components we know how to build**, so the same pattern is always built the same way.

How a node becomes a component (never automatic):

1. `scripts/03-detect.mjs` proposes candidates (rules in `detect/rules/`, plus the AI pass) → `detections.json` / `detections.md`.
2. A **human** checks each one in Figma and sets `status`: `approved` or `rejected` (and fills `params`, e.g. the tooltip text).
3. `scripts/04-export.mjs` downloads the Figma render of every approved `flat-image` (the only step that needs the network after detect).
4. `scripts/05-build.mjs` turns only the **approved** ones into the component. Proposed / rejected stay blocks. An approved one that
   cannot be built (missing params, wrong shape) stays a block and is listed as a warning.
5. `scripts/07-verify.mjs` checks the result (box, css, and component specifics such as the `data-balloon` attribute in the DOM).

Source of truth for Bricks behaviour is the **installed theme (1.9.8)** in `wp-content/themes/bricks/`, not the docs website
(the website describes newer versions; e.g. the "Components" feature does not exist in 1.9.8).

## Registry

| id | status | Figma signal | Bricks output | params | limits |
|---|---|---|---|---|---|
| `tooltip` | implemented | info / question icon (icon font) next to a label, possibly wrapped alone in an "Icon" frame; text from a popup node named tooltip / hint / popover if there is one | custom attributes `data-balloon` + `data-balloon-pos` on the trigger (`includes/assets.php:226`, `assets/css/libs/tooltips.min.css`) | `text` (required), `position` (top, top-left, top-right, bottom, bottom-left, bottom-right, left, right) | plain text with the theme tooltip look; a drawn Figma popup (colors, padding) is not reproduced |
| `button` | implemented | frame / instance named button / btn whose only visible child is a text | `button` element (`includes/elements/button.php`): text, label typography, frame look; label merged | `link`, `tag` | icons inside the button, hover / state variants, mixed-style labels are not supported (detection not applied) |
| `flat-image` | implemented | container of mostly artwork (images, vectors, rotation / blur), hand-placed (no auto layout), text and buttons drawn inside | `image` element with ONE png that Figma renders for the node (`scripts/04-export.mjs`, 2x); `altText` = visible texts (unique, tree order); whole subtree merged. Banner that is a link: set `link` | `alt`, `link`, `scale` (default 2) | not editable, text not selectable; effects spilling outside the node box make the export bigger than the box: not applied. verify only measures the image box |
| `carousel` | implemented (basic) | horizontal auto-layout row of >= 2 similar items, optional pagination row | `slider-nested`: type slide, perPage = slides fitting the row, gap = auto layout gap, `pagination` on/off (`includes/elements/slider-nested.php`) | `perPage`, `pagination` (node id, merged), `settings` | arrows / autoplay / loop / pagination look are not in Figma (Bricks defaults) |
| `form` | implemented (basic) | container with labeled input frames + a submit button frame, listed by the AI pass / owner in `params.fields` + `params.submit` (with citations) | `form` element: `fields` repeater, look of the first field and the submit button (`includes/elements/form.php`); subtree merged | `fields` [{ node, type, label, placeholder, required, labelNode }], `submit`, `settings` | action / recipient / messages not in Figma; field sizes follow Bricks CSS; solid fills only |
| `accordion` | implemented (basic) | container of >= 2 items, each a title row + a content block | `accordion-nested`; title / content get `accordion-title-wrapper` / `accordion-content-wrapper`; `expandFirstItem` if the first is open in Figma | none | closed items' content is not in Figma (empty content block + warning); no chevron animation |
| `tabs` | implemented (basic) | container with exactly 2 visible children: tab bar (>= 2 title frames) + content (pane(s)) | `tabs-nested`: tab-menu > tab-title divs, tab-content > tab-pane blocks | none | panes not drawn in Figma are empty; active-title style not read |
| `semantic` | implemented | a container a developer would write as ul/ol > li, dl > dt/dd, figure > figcaption, article, nav, a (link card) | `tag` / custom tag (and `link`, `_cssId`) on the block and its children; look untouched; image alt from figcaption | `tag`, `itemTag`, `childTags`, `link`, `itemLink`, `id`, `alts`, `caption` | tags only; no new element; link without URL = `#` |
| `tooltip-style` | implemented | a tooltip bubble drawn once (fill, radius, padding, one text, shadow) | CSS on the template root: `--bricks-tooltip-bg` / `--bricks-tooltip-text` and `[data-balloon]:after`; the bubble itself is not built | none | caret = theme triangle; position = Bricks default |
| `icon-list` | implemented | vertical container of rows = one svg icon + one text (checklists, reasons) | `list` element: `items` (title + svg icon), `titleTypography`, icon gap, separator off | none | one text per row; icons are the Figma svg files |
| `breadcrumbs` | implemented | a row: home text + separator icon + current-page text | `breadcrumbs` element: `homeLabel`, item / current typography, `separatorIcon`, `gap` | none | dynamic: the current page text follows WordPress |
| `counter` | implemented | a TEXT with a number ("80,000+", "97%") | `counter`: `countTo`, thousand separator, prefix / suffix, typography | none | not a heading any more; duration = Bricks default |
| `countdown` | implemented | horizontal row of time units (a number text above a label text) separated by a colon text; the designer's "countdown unit" component | `countdown` element (`includes/elements/countdown.php`): `fields` (format %D %H %M %S + label as suffix), `date`, `timezone`, number / label typography; unit box and gap on `.field`, the colon is `.field:not(:last-child)::after`; units and separators merged | `fields` [{ node, format }] (required), `date` "YYYY-MM-DD HH:mm", `timezone` "UTC+07:00", `separator` | the target date and time zone are not in Figma (without a date Bricks shows a placeholder, without a zone it counts in UTC+00:00); units must be identical; the "Date reached" action is the Bricks default |
| `link` | implemented (basic) | a TEXT node used as a link | `text-link`: text + url + hover fade (`includes/elements/text-link.php`) | `link` (required) | URL not in Figma; text only |

"(basic)" = the simplest useful version: structure and the values Figma gives, nothing invented. Responsive is out of scope for now (one desktop design at a time). `planned` = known need, not built: approving it only produces a warning, the node stays a block (none left at the moment).

## Add a component

1. Read how Bricks 1.9.8 does it in `wp-content/themes/bricks/includes/elements/<element>.php` (controls, `render()`), and the
   theme CSS that element gets by default (`assets/css/frontend.min.css`): theme defaults leak unless you override them explicitly.
2. Copy `tooltip.mjs` (attributes on an existing element) or `button.mjs` (a different element, merging children). Fill `check()`
   (can this node become it? return the reason if not) and `apply(ctx, det)` (write `ctx.s`; return `{ attrs }` for DOM checks).
3. Register it in `index.mjs` and add a row above.
4. Add a candidate rule in `detect/rules/` if it can be recognized from the tree (rules only propose; keep them conservative).
5. Add tests in `test/pipeline.test.mjs`, then try it on a real section: approve one candidate in a **copy** of the workspace's
   `detections.json`, run `--from=detect`, read `verify.md`. Theme-default leaks show up as mismatches (this is how the button's
   `gap` and `letter-spacing` were found).
6. Update this table, the "limits" column, and `process/AI-GUIDE.md` if the workflow changed.
