# Usable output: what a Bricks developer would build, and how the owner decides it

A template that is only nested `block`s is a picture, not a page. The target is **the template a developer would have built by hand
in Bricks**: real links, buttons, images with alt text, lists, headings in order, sliders, accordions, tabs, forms. The look stays
exact to the pixel (CLAUDE.md rules 2 to 4); the **structure** is allowed to differ from the Figma layer tree wherever the Figma tree is
only a drawing (a row of frames that is really a `ul`, three frames + an arrow that are really a slider).

`block` is for layout wrappers only. A `block` that directly holds visible text, an image or a click target is a defect to explain.

## 1. The inventory pass (before any question)

For every section in `detections.json`, walk the tree (`tree.md` + `facts.md`) and write down every part that falls in one of the
rows of the catalog below. Nothing is skipped because it "looks fine as blocks". The output is the list of questions in section 3.

## 2. Catalog: Figma pattern → Bricks element

"Today" is what the pipeline can build **now**. When it says *gap*, the question for the owner must offer the missing-component choices
(section 4); never silently fall back to blocks.

| Pattern (Figma evidence) | Bricks 1.12.3 element | Today | Must be asked |
|---|---|---|---|
| Section wrapper (full-width frame) | `section` / `block` with `tag` header, footer, nav, article, aside | `tag` via `overrides.json` on a node | which HTML tag; is it the page's `<header>` / `<footer>` / `<nav>` |
| Text with style H1..H6, or looks like a title | `heading` | built from text style only | tag per heading; exactly one H1 for the page; heading order |
| Paragraph / body copy | `text-basic` (`text` for rich text) | yes | only if it is a link or has inline links |
| Button (frame/instance, one label) | `button` + `link` | `button` component (no icon inside) | link URL, target (`_blank`), rel; button with icon = gap |
| Text that is a link (breadcrumb, "Xem thêm", footer link) | `text-link` | basic, never proposed by a rule | URL, target; or is it a plain label |
| Whole card is clickable | `block` with `tag: a` + `link` | gap (no rule) | card URL |
| Image (content) | `image` with `altText`, `link`, `loading` | yes. Another file on a pasted tablet or phone frame, same crop, is `sources` at that breakpoint. A moved crop stays that frame's own element | alt text (never the layer name), link, lazy or eager (above the fold = eager) |
| Image (decoration / background) | `_background` image, or `svg`, no alt | partly | confirm decorative |
| Logo | `logo` / `image` with link to home | gap | is it a link, URL |
| Icon (vector or icon font) | `svg` (decorative, no text) or `icon` | `svg` | decorative or meaningful (needs a label) |
| Row/grid of similar items, no controls | `block` with `tag: ul` + items `tag: li`, or Bricks `list` | tag via `overrides.json` | list or just layout; columns; which items |
| Checklist (icon + text rows) | `list` (icon list) or `ul/li` | built: `icon-list` (one text per row, the Figma svg) | which rows are the list |
| Menu / on-page anchors / sub-menu | `nav > ul > li > text-link` (component `menu`) when the items fit. When they run past the frame, component `menu-slider`: a `slider-nested` of those links (each keeps its width, type slide, drag and arrows, no loop, no autoplay). A click moves the drawn Active look. `nav-nested` only when Figma draws the hamburger / open panel | built: `rules/menu.mjs`, `components/menu.mjs`, `components/menu-slider.mjs` | URLs (the Plan asks); mobile menu only if Figma draws it |
| Breadcrumbs | `breadcrumbs` | built: home label, separator icon, current page follows WordPress | static or dynamic |
| Row of slides + arrows + dots | `slider-nested` (arrows, pagination, autoplay, loop) | built: slides, gap, pagination, arrows from the drawn nodes; autoplay / loop from the Plan | what is a slide, arrows (which Figma nodes), dots, autoplay, loop, slides per view |
| Title rows with open/closed state (FAQ) | `accordion-nested` | built: `rules/accordion.mjs`. Closed content shows only while `.brx-open`. Direction and gap are custom css. Theme padding starts at zero. Answers are copied onto every breakpoint that has the same item | answers of the closed ones (the Plan asks); a breakpoint that already answered keeps its text. Icons do not rotate |
| Tab bar + panes | `tabs-nested` | built: `rules/tabs.mjs` when the bar and the panes are the two children; `rules/tab-switch.mjs` reads the buttons first, then the repeated items under them as the one open tab's data. Chrome is `tabs-chrome.mjs`. Below desktop, `responsive/solo.mjs` stacks every pane of that widget the same way | every button is listed; the open tab keeps those items; a tab without them asks for a Figma link, read the same way; typed text only when nothing is drawn; the same data is copied to a breakpoint that has the tab |
| Form (inputs, labels, submit) | `form` | built: fields the Plan lists, each field's width and height, first-field look, submit look, theme label and gap overridden. Submit action is Save submission. Form name is the Figma file, the section and the form frame. A select lists the drawn lines. The same fields are copied onto a breakpoint that has the form | email recipient is not invented. Save submission records only after the Bricks site setting is on |
| Stat numbers ("80,000+") | `counter` | built: `countTo`, separator, prefix / suffix. Duration stays the Bricks default | count up or static |
| Rating stars + score | `text` + `svg` row (no native element) or `testimonials` | gap | static is fine? schema markup? |
| Testimonial cards | `testimonials` / `slider-nested` + cards | gap | slider or grid; real content (CMS)? |
| Post cards (title, excerpt, date, image) | `posts` query loop | gap | dynamic from posts, or static cards |
| Gallery / video thumb | `image-gallery` (lightbox) / `video` | gap | lightbox; video URL |
| Tooltip | `data-balloon` attributes | yes | the text |
| Banner drawn as many layers | `image` (flat export) | yes, refuses when the export size differs from the box | alt, link; or rebuild as layers |
| Pricing table | `pricing-tables` or blocks | gap | native element or blocks |
| Hover/active/focus variants | per-element hover settings | owner default opacity 0.8 only | real hover values from the variant |

## 3. The interview (questions in chat, never a document dump)

The owner is asked **in the chat**, with `AskUserQuestion`, section by section, **as many questions as the inventory produces**.
A summary table first (at most one screen: section, what it contains, what a dev would build), then the questions.

Every question must:

- start with **where**: `Section s6 "Form tư vấn" (Figma link) · phần "Form 5 ô" (node "1", 1665:6191)`;
- say **what the part is in Figma** (evidence: component, property, text, size) and **what the choices build in Bricks**;
- offer 2 to 4 options, the recommended one first, each option saying what the template will look like or what is lost;
- be one decision only, never "approve all", never "ok?";
- group identical repeats (55 tooltips = one question, one list of copy for the designer), but list the node ids.

Fixed checklist per section (ask each that applies):

1. Wrapper: HTML tag (section / header / footer / nav / article); the page-level H1 (once for the whole page).
2. Every heading: level. Every title-like text that is not a heading: confirm.
3. Every button and link-like text: is it a link, URL, target, rel; button or text-link.
4. Every image: content or decoration, alt text, link, eager or lazy, flat export or real layers.
5. Every repeated group: list / grid / cards / slider / accordion / tabs; what is item, what is control.
6. Every slider: arrows (which nodes), dots, autoplay, loop, slides per view, item content.
7. Every collapsible: open state, content of the closed items, icon, one open at a time.
8. Every form: each field (name, type, required, placeholder, label), submit, action, recipient, success and error messages, consent checkbox.
9. Every menu: anchors or pages, URLs, sticky.
10. Every icon: decorative or labelled. Every number block: counter or static.
11. Every state Figma draws (hover, active, expanded, disabled): real values from the variant, or the default.
12. Dynamic content (posts, comments, reviews): static copy or CMS.
13. Anything that matches no row of the catalog: see section 4.

Rules for the exchange:

- **Fixed, numbered list first.** After the inventory, show the owner the whole list once: total `N`, each question numbered with its section and its recommended answer. Every later message says `Câu x/N`. The list may only grow when an answer directly creates a new decision, and then the new total is announced with the reason. No endless rounds.
- **Always offer the fast path:** accept the recommended answers for all remaining questions, or for all except the numbers the owner names. Say how many questions that leaves.
- Question text is plain Vietnamese (no special symbols that can garble); one decision per question.

- Questions about content only the designer knows (copy, URLs, form action) go to a separate **list for the designer**, shown at the end; they never block the rest.
- A blanket answer ("ok hết", "all good") is not a decision. Apply it only to items I recommended; ask again on every item I marked unsure or recommended rejecting.
- Each answer is stored where the build reads it: `detections.json` (`review.mjs … approve|reject|set`) or `overrides.json` (tag, alt, link, element) with a `reason` that quotes the owner. No sign-off until every question is answered or explicitly parked ("để block, ghi TODO").

## 4. A component does not exist (or cannot do what Figma shows)

Never leave it as blocks without saying so. Ask, per pattern, with these options:

1. **Build the component now** (recommended when the pattern appears more than once or carries content / interaction): read the Bricks PHP in `wp-content/themes/bricks/includes/elements/`, add it to `bricks/components/` (registry + README row), add a detect rule if the pattern is recognisable, add tests, then build. Needs the owner's go-ahead before work starts.
2. **Nearest native element** and list the differences in the report (what Figma has that Bricks cannot do).
3. **Plain blocks, marked**: `cssClasses` / label `TODO-component: <name>`, listed in the final report as not usable yet.
4. **Skip** the part.

## 5. Usable-output audit (after the build, part of the report)

The report states, from `bricks.json`, not from pixels:

- counts per element type, and the number of `block`s that directly hold visible text, an image or a click target (each must have a reason or be fixed);
- links: how many, how many without URL (listed as missing);
- images: how many, how many without a real alt (listed);
- headings: the outline, number of H1 (must be 1), skipped levels;
- lists as `ul/li` / `list`, sliders, accordions, tabs, forms with their field names;
- every catalog gap hit (section 4 choice taken).

Pixel verification (`verify.md`) is a second, separate verdict. A template can match the pixels and still be unusable; both verdicts are reported.

## 6. Gaps in the code (backlog, each starts only when the owner says go)

| # | Gap | Where |
|---|---|---|
| B1 | `ops/09-audit.mjs`: the audit of section 5, failing on a block that holds content directly | new |
| B2 | Detect rules for link, list, checklist, nav/anchor menu, breadcrumbs, slider with arrows/dots, counter, testimonial, post card, gallery, heading/H1 | `detect/rules/` |
| B3 | Image alt policy: nearby text or empty + flagged, never the layer name | `render/index.mjs`, `bricks/components/` |
| B4 | Form per-field width and height, label gap, textarea, gradient submit, checkbox, the drawn select lines, and Save submission (form name from the Figma file, the section and the form frame) are in `form.mjs` | `bricks/components/form.mjs` |
| B5 | Slider: arrows and pagination nodes become Bricks arrows/dots with Figma values; autoplay/loop from answers | `bricks/components/carousel.mjs` |
| B6 | Accordion: content of closed items from answers, icon/title style | `bricks/components/accordion.mjs` |
| B7 | `link`/`card-link` component (text-link, `a` block) fed by answers | `bricks/components/` |
| B8 | Block `tag` (ul/li/nav/header/footer/figure) from answers instead of hand-written overrides | `detect/`, `render/index.mjs` |
| B9 | Components for gap rows of the catalog (counter, testimonials, posts, image-gallery, nav-menu, list) | `bricks/components/` |
