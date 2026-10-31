# Component catalog: which Bricks element for which Figma pattern, and where the recipe comes from

Status (2026-10-29): inventory written first (stage 0); since then **accordion, tabs, slider and menu are built** from the Figma structure (section 11). The rest is still the inventory.
Registry of what is built today: [README.md](README.md). This file is the wider inventory it grows from.

Why this exists: the build is accurate to the eye but most of a page is `block` / `div` (50 to 70 % of the elements in the saved
sections). A page a user can use needs the real Bricks element for each part (an FAQ is an accordion, a card row with arrows is a
slider, the menu is a `nav`). This catalog lists every candidate, takes what is useful from the reference project and says which
source wins for each one.

## Sources and how far each is trusted

| Source | What it is | What we take | What we never take |
|---|---|---|---|
| Bricks 1.9.8 theme (`wp-content/themes/bricks/includes/elements/*.php`, `assets/css/frontend.min.css`, `assets/js/bricks.min.js`) | The only authority for what exists and how it behaves | Element names, control keys, nestable structure (`get_nestable_children()`), default CSS | Anything the docs website says that is not in these files (it describes newer versions) |
| `reference/Brick-Build-Page` (production project, written for Bricks 2.3.6 / 2.4.2) | 48 pattern JSON files, `snippets/widget-map.md` (Figma signal → widget), `snippets/css-custom.md`, pitfall table of `figma-section-analyze`, `infer_role()` in `scripts/lib/figma_spec.py` | Recognition signals, the structure of each widget, CSS that repairs a known Bricks quirk | Their sample values (colours, sizes, spacing), the G4 "98 % similar" gate, remote Figma asset URLs, any setting that 1.9.8 does not have (list at the end) |
| This project (`process/bricks/components/*.mjs`) | 14 registered components, exact values from Figma | Keep when its numbers equal or beat the saved baseline | – |

Values (numbers, colours, texts) always come from Figma or from the owner's answers in the Plan. A pattern from the reference is a
shape to copy, never a value.

## Rule for choosing the source (how much the Figma design deviates from the standard widget)

| Figma against the standard widget | Use | Example |
|---|---|---|
| Same structure as a Bricks widget (title + body, tab bar + panes, row of slides) | The native 1.9.8 widget, structure from its `get_nestable_children()` | FAQ → `accordion-nested`, tabs → `tabs-nested`, menu → `nav-nested` |
| Same structure, free content inside each item (image + text + button cards) | The nested widget, the item keeps the blocks built from Figma | Cards in a slider → `slider-nested` > `block` |
| 1.9.8 can do it but needs a display fix | Native widget + repair CSS from the reference (arrows under the track, hide dots, peek width, scroll row) | Slider that shows part of the next slide on mobile |
| We already have a component and its numbers are equal or better than the saved baseline | Ours | `button`, `form`, `counter`, `countdown`, `breadcrumbs`, `icon-list` |
| Too custom for any widget, or 1.9.8 lacks the feature | Block with the semantic tag (`ul > li`, `a`, `figure`) and a line in the limits table | Photo collage, grid with borders crossing |

Detection priority when several signals agree: the designer's own component variant in Figma (`State=Collapsed`) > repeated
structure in the tree > layer name > geometry. Every signal must be measurable in `tree.json` and cited like `detect/cite.mjs` requires.

## 1. Page structure and basic content

| Component | Figma signal (measurable) | Reference pattern | Bricks 1.9.8 | Ours today | Chosen source | To do |
|---|---|---|---|---|---|---|
| Section wrapper | Top frame of a section | all `sections/*` (`section > container > block`) | `section` (flex column, centred, 100 %), `container` (1100 px wide by default), `block` (flex column, 100 %), `div` (no default CSS at all). Tags: div, section, a, article, nav, ol, ul, li, aside, address, figure, custom (header / footer / main need `custom` + `customTag`) | yes (`section`, `block`, `div`, `semantic`) | Ours | Use `div` where a theme default would leak; header / footer / main via `custom` tag |
| Heading | Text style H1 to H6, else largest text of the section | `heading` with `tag` | `heading` (h1 to h6, default h3, margin 0) | yes (`decide` rules) | Ours | – |
| Paragraph / label | Text | `text-basic`, `text` for rich text | `text-basic` (div, p, span, figcaption, address, figure), `text` (rich) | yes | Ours | – |
| Text link | A TEXT used as a link, menu item, breadcrumb | `text-link` in `bem-card-grid`, header, footer | `text-link` (a, span without link, icon, gap) | `link` | Ours | Use as the leaf of `nav-nested` and footer link columns |
| Button | Frame with one label, fill or stroke, radius | `button` with `style`, `size`, `icon` | `button` (a when linked, span otherwise, `tag` if no link, `size`, `style`, `circle`, `outline`, `icon`, `iconPosition`, `iconGap`). Theme defaults to override: `gap:10px`, `letter-spacing:.5px`, `padding:.5em 1em` | yes (no icon yet) | Ours | Add icon inside the button (`icon`, `iconPosition`, `iconGap`) |
| Image | Image fill | `image` with `altText`, `loading` | `image` (alt, loading, `sources` for another image per breakpoint, lightbox, `_objectFit`) | yes | Ours | Use `sources` when the tablet / mobile frame uses a different picture |
| Decorative vector | Pure vector | `svg` | `svg` (file / dynamic / code, width, height, fill, stroke). No `iconSet` source | yes | Ours | – |
| Icon list | Rows of one icon + one text | `list` (`pricing-table`, `bem-pricing`) | `list` (items with title, icon, separator) | `icon-list` | Ours | – |
| Icon + title + text | Repeated small blocks | `icon-box` (`contact-section`) | `icon-box` (direction, icon, content). Brings its own CSS (icon 40 px, margin 20 px) | no | Native, only when the Figma matches the layout; otherwise `div` + `icon` + `heading` + `text-basic` (the reference skill itself advises this) | Phase 2 |
| Divider | Line, optionally with an icon in the middle | `divider` | `divider` | no | `div` with a border is exact; native only if an icon sits in the line | Phase 2 |
| Link card | The whole card is clickable | `link` on a card block | `block` with `tag: a` + `link` | `semantic` (`link`) | Ours | – |
| List / grid of items | Sibling frames with the same structure, no controls | `feature-grid`, `logo-strip` (plain grid) | `block` with `tag: ul`, items `tag: li` | `semantic` | Ours | – |

## 2. Interactive widgets (the point of this plan)

| Component | Figma signal (measurable) | Reference pattern | Bricks 1.9.8 | Ours today | Chosen source | To do |
|---|---|---|---|---|---|---|
| **Accordion / FAQ** | (1) instances whose variant says `State=Collapsed / Expand`; (2) at least 2 sibling items each = title row + icon (+ body); (3) layer or text hints (FAQ, a question mark). Items with 1 visible child instead of 2 = answer not drawn | `sections/faq-accordion.json` | `accordion-nested`: item `block` > `block.accordion-title-wrapper` (heading + icon) + `block.accordion-content-wrapper`. Keys: `expandFirstItem`, `independentToggle`, `transition`. Theme CSS: title `padding:15px 0`, `margin-bottom:-1px`; content `padding:0 0 15px`, `animation:height .5s`, hidden while closed, **empty content block is hidden (`:empty`)**. Not in 1.9.8: `faqSchema`, `isAccordionIcon` | `accordion` (structure only, empty content + warning); **no detect rule** | Native widget structure + ours | New detect rule; answers come from the owner's Plan; override the theme paddings with Figma values; icon turn on open = CSS (not verified how the theme turns the stock icon, check `frontend.min.css` before relying on it) |
| **Tabs** | Tab bar with at least 2 titles next to a pane area; a variant property like `Active` | `elements/tabs-section.json` | `tabs-nested`: `block.tab-menu` > `div.tab-title` × N, `block.tab-content` > `block.tab-pane` × N; titles = panes. The script clicks the first title on load (or the one named in the URL hash). **No `openTab` / `openTabOn` setting in 1.9.8**: another tab active by default is not possible with a setting | `tabs` (structure, empty pane + warning); **no detect rule** | Native + ours | New detect rule; pane texts from the Plan; if Figma shows tab 2 active, say so in the limits |
| **Carousel / slider** | Horizontal row of 3 or more identical items plus one of: items cut by the frame, `clip`, layer named slider / carousel, arrows or a thin dots strip next to it, tablet / mobile frame showing the next item peeking | `sections/testimonials-slider.json`, strategies in `widget-map.md` (`slider-responsive`, `carousel-dual`) | `slider-nested` (Splide): `type` loop / slide / fade (**default is loop**, set `slide` unless Figma loops), `perPage`, `perMove`, `gap`, `speed`, `autoplay`, `interval`, `pauseOnHover`, `rewind`, `arrows`, `pagination`, `height`, `autoHeight`, `start`, plus `arrow*` and `pagination*` styling and `:tablet_portrait` variants. Each slide = `block` with free content. Legacy `carousel` is for images or posts only | `carousel` → `slider-nested` (slides, pagination on / off, gap, perPage) | Native + ours + reference CSS | Fix false positive on text-only rows (menus); arrows, autoplay, loop from Figma nodes or the Plan; arrows under the track, hidden dots and peek width as configurable CSS; never default to loop |
| Offcanvas / mobile panel | A panel that slides in, hamburger frame beside it in the mobile frame | `elements/offcanvas-menu.json` | `offcanvas` (nestable: content block `brx-offcanvas-inner` with a close `toggle`, backdrop block `brx-offcanvas-backdrop`) opened by a `toggle`. `transitionDuration` is not in 1.9.8 | no | Native | Phase 2, after `nav-nested` |
| Dropdown | A menu item with a sub list | `templates/header-template.json` | `dropdown` (`text`, `link`, `tag`, icon, caret, content `div.brx-dropdown-content` > `ul` > `li` / `text-link`) | no | Native | With `nav-nested` |
| Toggle (hamburger) | Three-line icon frame in the mobile frame | `offcanvas-menu`, `header-template` | `toggle` (animation, `toggleSelector`, `toggleAttribute`, icon) | no | Native | With `nav-nested` |
| Tooltip | Icon beside a label + popup node | none in the reference | `data-balloon` attributes | `tooltip`, `tooltip-style` | Ours | – |

## 3. Navigation and header

| Component | Figma signal | Reference pattern | Bricks 1.9.8 | Ours today | Chosen source | To do |
|---|---|---|---|---|---|---|
| **Menu** | Section or layer named menu / header / nav; row of at least 3 items with only text (and a caret); in the mobile frame a hamburger | `templates/header-template.json` (`logo` + `nav-nested` + `dropdown` + CTA button) | `nav-nested`: `nav` > `ul.brx-nav-nested-items` > `text-link` / `dropdown`, + `toggle` open and close; `mobileMenu` = breakpoint where it collapses | blocks; `_menu` row is mis-read as a carousel | Native | New `menu` detect rule + `nav-nested` component; labels cut off in Figma and URLs from the Plan |
| Logo | Image or vector at the left of the header / footer | `logo` | `logo` (`logo`, `logoInverse`, size, `logoText`, `logoUrl`) | no | Native | Phase 2 |
| Breadcrumbs | Home + separator + current | `breadcrumbs` | `breadcrumbs` (`homeLabel`, separator, gap). Not in 1.9.8: `homeIcon`, `singularStructure` | yes | Ours | – |
| WordPress menu | – | `nav-menu` | `nav-menu` (reads Appearance > Menus) | no | Not used (the reference also prefers `nav-nested`) | – |
| Social icons | Row of brand icons | `templates/footer-template.json` | `social-icons` (repeater `icons`; top-level `iconColor` / `iconSize` of the pattern are not in 1.9.8, set per icon) | no | Native | Phase 2 |

## 4. Numbers, time, charts

| Component | Figma signal | Reference | Bricks 1.9.8 | Ours today | Chosen source | To do |
|---|---|---|---|---|---|---|
| Counter | TEXT with a number (`80,000+`, `97%`) | `elements/stats-counter.json` | `counter` | yes | Ours | – |
| Countdown | Row of units with a colon | `progress-countdown.json` | `countdown` | yes | Ours | – |
| Progress bar | Bars with a label and a percent | same | `progress-bar` (repeater `bars`) | no | Native when it looks like a bar chart | Phase 2 |
| Pie chart | Ring with a percent | `pie-chart-rating.json` | `pie-chart` | no | Native | Phase 2 |
| Rating stars | Star row + score | `pie-chart-rating.json` | **no `rating` element in 1.9.8** | no | `div` row of `svg` | – |
| Animated typing | Rotating word | `animated-typing.json` | `animated-typing` | no | Native, last pass with animation | later |

## 5. Forms and search

| Component | Figma signal | Reference | Bricks 1.9.8 | Ours today | Chosen source | To do |
|---|---|---|---|---|---|---|
| Form | At least 2 input-like frames + a submit | `sections/contact-section.json`, `templates/popup-newsletter.json` | `form` (field types email, text, textarea, tel, number, url, checkbox, select, radio, file, datepicker, password, html, hidden; field `width`; actions custom, email, redirect, mailchimp, sendgrid, login, registration, lost-password, reset-password. Not in 1.9.8: `webhook`, `save-submission`, `confirmation-email`, `create-post`) | yes | Ours | Ask action / recipient / success message / required / consent in the Plan |
| Search box | Input with a magnifier | `elements/search.json` | `search` | no | Native if drawn | Phase 2 |
| Alert | Coloured message box | `alert.json` | `alert` | no | `block` unless it has to be dismissible | – |

## 6. Media

| Component | Figma signal | Reference | Bricks 1.9.8 | Ours today | Chosen source | To do |
|---|---|---|---|---|---|---|
| Video | Frame with a play button over a picture | `video-section.json` | `video` (youtube, vimeo, media, file URL, dynamic, overlay). Not in 1.9.8: `aspectRatio`, `previewImageSize` keys | no | Native; the URL comes from the Plan | Phase 2 |
| Gallery / lightbox | Grid of pictures | `gallery-section.json` | `image-gallery` (layout, columns, gutter, lightbox). Not in 1.9.8: `lightboxThumbnails`, `lightboxCaption` | no | Native only if the Figma is a plain grid | Phase 2 |
| Flat artwork | Many art layers drawn by hand | – | – | `flat-image` | Ours | – |
| Map | Map picture | `map-google.json` | `map` (Google, API key). Not in 1.9.8: `renderMode`, `markerCluster`, `syncQuery`, `map-leaflet`, `map-connector` | no | Picture, unless the owner names the spot | – |
| Audio, Instagram, Facebook page | – | `media-files`, `social-feeds` | `audio`, `instagram-feed`, `facebook-page` (need accounts / tokens) | no | Only on the owner's request | – |

## 7. Dynamic WordPress content (not detected from a static Figma section)

`posts`, `pagination`, `related-posts`, `post-title`, `post-excerpt`, `post-content`, `post-meta`, `post-taxonomy`, `post-author`,
`post-comments`, `post-navigation`, `post-sharing`, `post-toc`, `post-reading-time`, `post-reading-progress-bar`, `wordpress`,
`sidebar`, `template`, `shortcode`, `code`, `html` (deprecated), the `filter-*` family (their `filter*` keys live in
`filter-base.php`, not re-verified) and the loop builder (`hasLoop` + `query`, in `base.php`). The reference ships patterns for
them; a Figma section only becomes one on the owner's explicit request. Not in 1.9.8: `query-results-summary`,
`filter-active-filters`, `post-reading-time` `calculationMethod`.

## 8. Repair CSS in the reference worth looking at (check each on 1.9.8 before porting)

| Quirk | Reference fix (`snippets/css-custom.md`, pitfall table) | Verdict for us |
|---|---|---|
| Slider arrows below the track, hide dots, show the next slide partly on mobile | `.splide__arrow { top:auto; bottom:-68px }`, `.splide__pagination { display:none }`, slide `_widthMax:80%` on `:tablet_portrait` | Port as configurable CSS in the carousel component, numbers from Figma |
| Row that scrolls sideways on mobile | `overflow-x:auto` row of cards, two blocks shown / hidden by breakpoint | Only if the mobile frame is a plain scroll row; one slider otherwise |
| `div` has no `display:flex` | They write `display:flex` in `_cssCustom` | Consistent with 1.9.8: `.brxe-div` has no rule, `.brxe-block` has. Whether `render/` already writes `display:flex` for a `div` is **not checked yet**; check before the first build that relies on it |

Compatibility rule (owner, 2026-10-29): the reference runs on a different Bricks version than ours. **Bricks 1.9.8 is the only
reference for what is valid.** Every settings key, element, class name and CSS selector a component emits is checked against the
installed theme (`includes/elements/*.php`, `assets/css/frontend.min.css`) and a test fails when a component emits a key the theme
does not have. Anything copied from the reference that fails that check is rewritten for 1.9.8 or dropped, with a line in section 9.
| `_alignSelf: stretch` makes Bricks emit `width:100%` | Drop it, set the parent `_alignItems` | Check against our `render/size.mjs` before changing anything |
| Zero-width SVG line is not painted | Give it `1px` width, `object-fit:fill` | Check against our exact-size rule |
| Pill label wraps | `white-space:nowrap` | Per node, only on a measured mismatch |
| Button arrow inside a white circle | CSS on `.bricks-button-icon` | **That class does not exist in 1.9.8.** Verified in `base.php` `render_icon()` and `frontend.min.css`: the icon is a bare `<i class="icon-font-class">` or an inline `<svg>` (only `fill` / `stroke` classes), no wrapper. Target `#brxe-<id> i` / `#brxe-<id> svg`; the circle is drawn on the icon itself (size, `border-radius`, background from the Figma frame). The theme's own `iconTypography` control uses the same `i` selector |
| Section gradient not compiled | Mirror in `_cssCustom` | Unverified on 1.9.8; our verify step would show it, do not add unless it shows |
| Inter optical size shifts text width | `font-optical-sizing:none` on the section root | Already handled by the local fonts folder (see the Figma Inter 3.x note); do not add |

## 9. Settings in the reference that do not exist in Bricks 1.9.8

Found by comparing every setting of every reference pattern with the controls of the installed element files:
`accordion-nested.faqSchema`, `icon.isAccordionIcon`, `tabs-nested.openTab` / `openTabOn`, `svg` source `iconSet`,
`offcanvas.transitionDuration`, `breadcrumbs.homeIcon` / `homeIconPosition` / `singularStructure`, `social-icons.iconColor` /
`iconSize` (top level), `image-gallery.lightboxThumbnails` / `lightboxCaption` / `loadingAttribute`, `video.aspectRatio` /
`previewImageSize` / `overlayAriaLabel`, `map.renderMode` / `markerCluster` / `syncQuery`, `code.prettify`,
`nav-menu.ariaLabel`, `post-comments.titleTag`; elements `rating`, `back-to-top`, `toggle-mode`, `file`, `map-leaflet`,
`map-connector`, `query-results-summary`, `filter-active-filters`, `slot`; form actions `webhook`, `save-submission`,
`confirmation-email`, `create-post`, `update-post`; container `tag` values header, footer, main.
(`hasLoop`, `query` and the `filter*` keys also show up in that comparison only because they live in `base.php` / `filter-base.php`.)

## 10. Phase order proposed from this catalog

1. Core: accordion + tabs + carousel (detect rules, Plan questions, content params), then the `menu` rule and `nav-nested`.
2. After the Plan has run on real sections: `dropdown` / `toggle` / `offcanvas`, `logo`, `social-icons`, `video`, `image-gallery`, `icon-box`, `progress-bar`, `pie-chart`.
3. Never from a static Figma: section 7.

## 11. Built from this catalog (2026-10-29)

| Component | Detection | Content from the Plan | Verified by |
|---|---|---|---|
| `accordion-nested` (FAQ) | `detect/rules/accordion.mjs`: designer variants State=Collapsed / Expand (E1 high), a name + state (E1 medium), shape only (low: the Plan asks "is this an accordion?"). Scanned 117 saved trees: 5 FAQ found, 0 false positives (the shape-only rule needs equal-width rows: a card is not an accordion) | answers of the closed items | `faq` section: look 6.06 -> 1.98 (desktop), 23.01 -> 2.68 (mobile), mismatches 0 / 73 -> 0; clicked in the Docker browser: items toggle |
| `tabs-nested` | `detect/rules/tabs.mjs`: horizontal tab bar of >= 2 alike titles above a content frame, only with an active-variant or a tab name | content of the undrawn panes | unit tests; the `_price-table` period switch is the one real candidate in the saved trees |
| `slider-nested` | `detect/rules/carousel.mjs` (unchanged signals); a row of links that `rules/menu.mjs` claims is no longer a carousel | autoplay (seconds), loop | the carousels approved earlier keep their numbers |
| `menu` (`nav > ul > li > text-link`) | `detect/rules/menu.mjs`: horizontal row of >= 3 link-like items named like a menu | URL of every item | the three `_sub-menu` sections |

Traps this work found in Bricks 1.9.8 (all in `process/AI-GUIDE.md`): `_direction` / `_rowGap` exist only on container-like elements; an id-selector `display` from Figma stops the theme from hiding
accordion content and tab panes; the theme pads the accordion rows; elements Bricks needs but Figma does not draw must follow their host through the responsive merge.
