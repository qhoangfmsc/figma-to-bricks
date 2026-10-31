# Backlog: what is NOT done after the "usable widgets + Plan" work (2026-10-29)

Done: the Plan (`plan-<node>.md`, asked in the chat), FAQ = `accordion-nested`, tabs = `tabs-nested`, menu = `nav > ul > li > text-link`, slider approved by structure,
`scripts/interact.mjs` (clicks a built page in Docker). Details: `process/README.md` (Autopilot), `process/bricks/components/CATALOG.md` section 11, `process/AI-GUIDE.md` (lessons).
Everything below is **not built**, in the order the owner is likely to care about.

## 1. "Xem thêm" (read more) on the SEO Text sections: BUILT (2026-10-29), limits

Component `readmore` (`detect/rules/readmore.mjs`, `bricks/components/readmore.mjs`): the clipped frame gets a class, the button becomes a real `<button>` with a Bricks click interaction
(`toggleAttribute` on `class`, no JS) and one css rule gives the open frame `height: auto`; the fade over the bottom edge hides while open. Clicked in the Docker browser on 2 sections:
desktop 300px -> 790px and back; mobile 300px -> 886px and back (NcaL 2209-5171). Limits: the label does not change to "Thu gọn", the caret does not turn; two read-more frames with the same section,
frame and button names on one page share a class and open together; the other two SEO Text sections (4Fg9 1606-18276 is the mobile frame of 1604-18648, NcaL 2209-5882 of 2209-5171) are built with their section.

## 2. Things the Plan does not ask yet (they stay on the designer list)

- Form: where it sends (action, recipient), success message, required fields, consent. Bricks 1.9.8 only has actions custom, email, redirect, mailchimp, sendgrid, login, registration, lost-password, reset-password.
- Tooltip text: tooltip candidates are still rejected in autopilot (`decide/index.mjs`). The Plan could ask the text and approve with it.
- Image alt is asked only for content images (not names like glow / background / bg).
- The label and URL of anything that is not a button, a menu item or a link (e.g. a card that is a link).

## 3. Widgets built but with known limits

- **Accordion:** an answer left blank gives an empty content block and Bricks hides it, the item opens nothing. The icon does not turn when an item opens (CSS, later). The rule that guesses an accordion from its
  shape alone never fired on the 117 saved trees (only the designer-variant path is tested on real data); the confirm question exists and is unit-tested.
- **Tabs:** Bricks 1.9.8 has no `openTab`: the first tab always opens, even if Figma draws another one active. A pane is matched to a tab by position. Detection needs an active variant or a name with "tab".
  Only one real candidate exists in the saved trees (the `_price-table` period switch, NcaL 4007-5375).
- **Slider:** the rule does not find the arrow buttons by itself (they come from `params.prev` / `params.next`, set by hand in the earlier interview); a mobile "peek" (next slide partly visible) is not derived;
  autoplay and loop come from the Plan. Only the FAQ was click-tested; sliders were not (`interact.mjs` supports them).
- **Menu:** no hamburger, mobile panel or dropdown (Figma does not draw them; `nav-nested` is the element when it does). The `_sub-menu` row is wider than its frame and has two arrow buttons that scroll it:
  that needs a few lines of JS, not Bricks alone (owner's earlier decision), not built. URLs come from the Plan.

## 4. Components of the catalog not built (CATALOG.md sections 1 to 6)

`nav-nested` + `dropdown` + `toggle` + `offcanvas`, `logo`, `video`, `image-gallery`, `social-icons`, `icon-box`, `progress-bar`, `pie-chart`, `search`, `divider`, button with an icon, text links inside a paragraph.
Order proposed in CATALOG.md section 10.

## 5. Process notes and traps for the next session

- The page workspace `1587-4864` (the first whole-page build from the interview flow) was **not re-run**: its accordion and sliders come from the interview and keep the old structure.
- `--no-responsive` on a section whose workspace already has `responsive.json` stops the build (the variant workspaces are not fetched). `auto.mjs` now reports such a crash; before, an old `verify.json` hid it.
- The "Banner" section: my first check of the Plan flow claimed it was rebuilt with the same numbers; the build had in fact crashed on that flag and nothing was rebuilt. It is rebuilt by the next normal run.
- A confirmation is single use: after a build the stamp is removed, the next run of the same link shows the Plan again with the earlier values filled in.
- Existing mismatches that were already in the baseline and were not touched: e.g. `Pain` mobile 15.5 look, `f-w` (the one with 101 mismatches on mobile), `Frame 1000002419` base 7.3.
- Anything a component writes must be checked against `wp-content/themes/bricks/includes/elements/*.php` (see CATALOG.md section 8 and AI-GUIDE: a control is not on every element).
