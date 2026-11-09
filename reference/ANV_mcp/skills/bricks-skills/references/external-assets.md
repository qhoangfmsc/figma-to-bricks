# Referencing External Assets (from a reference URL)

> Verified against Bricks 1.12.3 source (theme path: `.../themes/bricks`) — 2026-07-14, via `includes/elements/video.php`, `includes/elements/svg.php`, `includes/templates.php`. **Correction 2026-07-16** (re-read `svg.php` `render()` after a real build failure): the `svg` element is the **one exception** to "every media control accepts a plain url" below — see the corrected row and the `svg` element note further down.

When the user gives a **reference URL** — "build this like `https://…`", "use the images/video from that page", or just pastes a link — Bricks designs can reference *any* remotely-hosted media by its absolute URL. No WordPress attachment is required: nearly every media control accepts a plain `url` (or `external`) string. This makes the skill **host-independent** for images/video — it works with assets from the reference site, a CDN, an image API (Unsplash/Pexels), YouTube/Vimeo, or any public URL. **The standalone `svg` element does not follow this pattern** — see below.

All value shapes below are the same ones verified in [style-settings.md](style-settings.md) and [elements.md](elements.md) — this file just maps *page asset → Bricks element/shape*.

## Workflow

1. **Fetch & inventory.** Pull the reference page (WebFetch or equivalent) and list every asset with its source:
   - `<img src>`, `srcset`, `<picture><source>`
   - CSS `background-image: url(…)` (inline `style=` and stylesheets)
   - `<video>` / `<source>`, and YouTube/Vimeo `<iframe>` embeds → extract the **video id**
   - `<svg>` inline markup, `.svg` files, icon sprites
   - `<audio>` / `<source>`
   - `<link rel="icon">`, logo images, Open Graph `og:image`
2. **Resolve to absolute URLs.** Convert relative paths (`/img/hero.jpg`, `./a.png`, protocol-relative `//cdn…`) against the reference origin so the URL works off-site. Pick the **largest** candidate from `srcset` for heroes.
3. **Map each asset** to the right element + shape (tables below).
4. **Decide hotlink vs. re-host** (see below) and note the choice in the final summary.
5. **Capture metadata** — `alt` text, captions, and the asset's purpose — so the rebuilt element stays accessible.

## Asset → Bricks mapping

| Page asset | Bricks target | External shape |
|------------|---------------|----------------|
| `<img>` content image | `image` element | `"image": { "url": "https://…/photo.jpg" }` (add `"size": "full"`) |
| Decorative / section background image | any container's `_background` | `"_background": { "image": { "url": "https://…" }, "size": "cover", "position": "center center", "repeat": "no-repeat" }` |
| Looping background video (mp4/webm) | `section`/`container`/`block`/`div` `_background` | `"_background": { "videoUrl": "https://…/bg.mp4", "videoLoop": "1", "videoPlayOnMobile": false }` |
| Self-hosted `<video>` | `video` element | `{ "videoType": "file", "fileUrl": "https://…/clip.mp4", "fileControls": true, "fileLoop": true, "fileMute": true }` |
| YouTube embed | `video` element | `{ "videoType": "youtube", "youTubeId": "dQw4w9WgXcQ" }` (+ `"previewImage"`/`"overlay"` for a facade) |
| Vimeo embed | `video` element | `{ "videoType": "vimeo", "vimeoId": "76979871" }` |

> 🔧 **Sửa theo 1.12.3** — key chọn loại nguồn video là `videoType` (options: `youtube`, `vimeo`, `media`, `file`, `meta` — confirmed `includes/elements/video.php:33-47`), KHÔNG phải `media`. `media` là một control key riêng biệt (type `video`, chỉ hiện khi `videoType == 'media'`, dùng cho video chọn từ Media Library — `video.php:286-291`), không phải công tắc chọn loại nguồn.
| `.svg` file, any purpose (icon, decorative shape) | `image` element (**not** `svg` — see below) | `{ "external": true, "url": "https://…/icon.svg", "size": "full" }` — same shape as a raster photo; renders as a plain `<img src>` |
| `.svg` used as an icon on a `button`/`icon-box`/etc. `icon` **picker control** (different from the standalone `svg` element) | icon control | `{ "library": "svg", "svg": { "url": "https://…/icon.svg" } }` — same-origin required, see `bricks_rules.md` §5 |
| `<audio>` | `audio` element | external `url` on its media control |
| Logo | `logo` element / `image` | `"logo": { "url": "https://…/logo.svg" }` |
| Click-to-zoom image | `image` + link | `"link": { "type": "lightbox", "lightboxImage": { "url": "https://…/full.jpg" } }` |
| Image gallery / slider | `image-gallery` / `carousel` | each item carries its own `url` (no `id`) |

Examples (drop straight into a node's `settings`):

```json
"image": { "url": "https://cdn.example.com/hero@2x.jpg", "size": "full" }
```
```json
"_background": { "image": { "url": "https://cdn.example.com/grid.png" }, "size": "cover", "position": "center center", "repeat": "no-repeat" }
```
```json
"_background": { "videoUrl": "https://cdn.example.com/loop.mp4", "videoLoop": "1", "videoScale": true }
```

For dynamic/CMS-driven media, swap the static `url` for `"external": "{acf_url}"` or `"useDynamicData": "{featured_image}"` (see [dynamic-data.md](dynamic-data.md) / [acf-providers.md](acf-providers.md)).

## Hotlink vs. re-host

`id` (WP attachment id) never resolves on another site — **always include a real absolute `url`**, and rely on `url`/`external`, not `id`.

| Format | Behavior | Use when |
|--------|----------|----------|
| **Clipboard paste** (`bricksCopiedElements`) | external `url`s **hotlink** — they stay remote and load from the source host | fast prototyping / wireframing |
| **Template import** (`.json` template) | Bricks downloads `image` controls that have a `url` into the Media Library **only if the "Import images" checkbox is ticked** in the import dialog (`importImages` POST param, confirmed `includes/admin.php:362` + `includes/templates.php: import_image()`) — if left unchecked, the import keeps a remote placeholder instead | production builds you want self-hosted (tick "Import images") |

For production, re-host third-party media in the Media Library and reference it by its uploaded `url` (with `id`). Hotlinking risks broken images (hotlink protection, CORS), layout shift, and licensing problems.

## Robustness & licensing rules

- **Absolute URLs only** — resolve relatives; never emit `/wp-content/...` from another origin.
- **Don't hotlink copyrighted/brand assets into production.** For mimicking a competitor's layout, follow the **wireframe-first default** ([layout-recipes.md](layout-recipes.md)): reproduce structure/spacing/typography but substitute the actual photos/logos with the user's own assets, neutral placeholders (Unsplash/Pexels with attribution), or pure-CSS stand-ins. Flag any asset whose license you can't confirm.
- **The standalone `svg` element cannot hotlink an external URL at all** (confirmed against `svg.php` `render()`, 2026-07-16): `source: "file"` only reads a real WP Media Library attachment via `get_attached_file($settings['file']['id'])` — a bare `url` with no `id` silently renders nothing. `source: "code"` (inline SVG) requires `settings.signature`, verified by `Helpers::sanitize_element_php_code()` — a signature only the builder UI can produce when a human types/saves the code in-browser; any pipeline that writes element JSON directly via `set_template_content`/`set_page_content` (bypassing the UI) will never have a valid one, and the element renders nothing. **Use the `image` element instead** for every hotlinked `.svg` (icon or decorative shape) in a direct-JSON-write pipeline — see the corrected mapping row above. This guidance ("use `svg`'s `code` source, it avoids CORS") only holds for someone hand-building inside the Bricks builder UI, not for scripted uploads.
- **Prefer CSS to images for decoration** — gradients, shapes, and `_gradient`/`clip-path` beat hotlinking a decorative PNG.
- **Accessibility** — carry over `alt`/captions; mark purely-decorative images so they don't add noise to the tree.
- **Verify reachability** — if a URL 404s or blocks hotlinking, fall back to a placeholder and say so in the summary.

See also: [assets-permissions.md](assets-permissions.md) (how Bricks *loads* assets/CSS, not external referencing).
