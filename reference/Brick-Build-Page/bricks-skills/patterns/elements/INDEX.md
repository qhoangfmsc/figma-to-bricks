# Elements

One small clipboard file per element (or a tight group of related elements) not already shown in `sections/`, `templates/` or `query/`. Control keys were checked against the Bricks 2.4.2 element sources with `scripts/validate_pattern.py --bricks-source`.

**Placeholders** — files marked ⚠ need a site-specific value after paste: an API key/token in Bricks → Settings → API keys, a WordPress menu/sidebar/template selection, a CPT/field name, or a real URL.

| File | Elements | Demonstrates |
|------|----------|--------------|
| [tabs-section.json](tabs-section.json) | `tabs-nested` | 3 tabs with required `_hidden` classes (`tab-menu` / `tab-title` / `tab-content` / `tab-pane`), underline active state via `titleActiveBorder`, `openTab: "0"` |
| [offcanvas-menu.json](offcanvas-menu.json) | `offcanvas`, `toggle` | Mobile menu: open `toggle` in the header + close `toggle` inside, both targeting `#mobile-menu` (`_cssId`) through `toggleSelector`; `brx-offcanvas-inner` / `brx-offcanvas-backdrop` children, `noScrollBody`, `width` |
| [stats-counter.json](stats-counter.json) | `counter` | 4-up stats band, `countTo` with suffix, thousand separator, BEM-ish `stat__number` / `stat__label` classes |
| [progress-countdown.json](progress-countdown.json) | `progress-bar`, `countdown` | `bars` repeater with per-bar color; countdown `date` + `timezone`, `fields` repeater (`%D %H %M %S` + suffix), `action: text` on finish, `gutter` spacing object |
| [video-section.json](video-section.json) | `video` | YouTube with click-to-load facade (`previewImage`, `overlayIcon`, `youtubeDoNotTrack`) and a muted autoplay loop from a file URL (`videoType: file`); `aspectRatio: "16/9"` |
| [gallery-section.json](gallery-section.json) | `image-gallery` | ⚠ `items.images` from external URLs (swap for media-library images), grid 3→2→1 via `columns:breakpoint`, `imageRatio`, lightbox with thumbnails |
| [breadcrumbs.json](breadcrumbs.json) | `breadcrumbs` | Home icon, icon separator, per-post-type trail via `singularStructure` (posts show category, pages show parents) |
| [nav-menu.json](nav-menu.json) | `nav-menu` | ⚠ WordPress menu (`menu` left empty — select after paste), active/sub-menu styling, built-in mobile menu at `tablet_portrait` |
| [search.json](search.json) | `search` | Inline input limited to posts via `additionalParams`, and icon + fullscreen overlay variant |
| [post-extras.json](post-extras.json) | `post-reading-progress-bar`, `post-toc`, `post-sharing` | For single templates: fixed top progress bar, sticky TOC sidebar reading `h2, h3` from `.brxe-post-content`, brand-colored share buttons |
| [related-posts.json](related-posts.json) | `related-posts` | Shared category/tag, 3 random posts, responsive `columns`, `content` repeater with `dynamicTypography` |
| [carousel-posts.json](carousel-posts.json) | `carousel` | Swiper carousel of latest posts (`type: posts` + `query` + `fields`), `slidesToShow:breakpoint`, autoplay, arrows + dots |
| [toggle-mode.json](toggle-mode.json) | `toggle-mode` | Light/dark switch with separate light/dark icons — needs a palette with dark-mode values |
| [pie-chart-rating.json](pie-chart-rating.json) | `pie-chart`, `rating` | Pie charts showing percent / icon / text; star rating with Product review schema |
| [alert.json](alert.json) | `alert` | `info`, dismissable `success`, `warning` with inline link |
| [animated-typing.json](animated-typing.json) | `animated-typing` | `h1` hero headline with prefix + rotating `strings`, speed/delay tuning |
| [media-files.json](media-files.json) | `audio`, `file`, `svg` | ⚠ Audio from external MP3, PDF download button (`file`, `source: external`), SVG from icon set (unsigned SVG `code` would not render) |
| [map-google.json](map-google.json) | `map` | ⚠ Iframe mode with single `address` (no API key) and API mode with `addresses` lat/lng + marker clustering (API key required) |
| [map-leaflet.json](map-leaflet.json) | `map-leaflet` | OpenStreetMap tiles `layers`, 3 `markers`, `center` + `zoom`, scroll zoom only on center |
| [map-query-sync.json](map-query-sync.json) | `map`, `map-connector` | ⚠ Store locator: map `syncQuery` → `store` CPT loop holding `map-connector` with ACF lat/lng (API key + CPT/fields required) |
| [back-to-top.json](back-to-top.json) | `back-to-top` | Fixed round button, appears after 600px, smooth scroll + focus to top |
| [divider.json](divider.json) | `divider` | Plain, dashed with centered icon, and vertical divider between inline items |
| [code-html-shortcode.json](code-html-shortcode.json) | `code`, `html`, `shortcode` | ⚠ Display-only code snippet (no `executeCode`), raw HTML `<details>`, plugin shortcode placeholder |
| [sidebar-widgets.json](sidebar-widgets.json) | `wordpress`, `sidebar` | ⚠ Core widgets (categories with counts, recent posts with thumbnails) + registered sidebar (select after paste) |
| [template-embed.json](template-embed.json) | `template` | ⚠ Embeds a section template (`template` left empty — select after paste), `noRoot` |
| [social-feeds.json](social-feeds.json) | `instagram-feed`, `facebook-page` | ⚠ Instagram grid (token in API keys), Facebook page plugin (replace `href`) |
