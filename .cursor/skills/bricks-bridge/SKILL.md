---
name: bricks-bridge
description: >-
  Operate the connected Bricks site through the bricks-bridge MCP: read site
  info, list or read pages and templates, create a page or template, replace
  Bricks element content, merge page settings, upload media, and regenerate
  CSS. Use when the user asks to inspect or change a WordPress page or Bricks
  template on the connected site, or upload an image into the Media Library.
  Never call regenerate_css. Leave generate-template-from-figma on process/.
---

# bricks-bridge

The connected server is the staging Bricks MCP. Call `get_site_info` once at the start of a session before any write.

Element content is a JSON string: a flat array of `{id, name, parent, children, settings}`, or a `bricksCopiedElements` clipboard payload `{content, globalClasses}`. Each element `id` is 6 alphanumeric characters. A clipboard payload merges its global classes. `global_classes_json` is a separate array of `{id, name, settings}` merged into the site registry by id.

A write replaces the whole element tree. Read the target first when the user asked to change part of it.

## Tools

| Tool | Does |
| --- | --- |
| `get_site_info` | Read WordPress and Bricks info. Confirms the connection. No arguments. |
| `list_pages` | List pages and whether each is built with Bricks. Optional `search`, `status` (`publish`, `draft`, `any`; default `any`), `per_page` (default 20). |
| `get_page` | Read one page or post, including its Bricks element tree. Requires `page_id`. |
| `create_page` | Create a page, turn on the Bricks editor, and optionally set elements. Requires `title`. Optional `slug`, `status` (default `draft`), `elements_json`. |
| `set_page_content` | Replace the Bricks elements of a page or post and turn the Bricks editor on. Requires `page_id`, `elements_json`. Optional `global_classes_json`, `page_settings_json`, `sync_css` / `generate_css`. |
| `set_page_settings` | Edit the Settings panel of one template or page: the Bricks page settings stored in `_bricks_page_settings`. Requires `page_settings_json`. Pass `template_id` for a template, or `page_id` for a page. Merges into the settings already saved. |
| `list_templates` | List Bricks templates. Optional `type`: `header`, `footer`, `content`, `section`, `archive`, `search`, `error`, `popup`. |
| `get_template` | Read one template, including its element tree and template settings. Requires `template_id`. |
| `create_template` | Create a template and optionally set elements. Requires `title` and `type` (same type list as `list_templates`). Optional `elements_json`. |
| `set_template_content` | Replace a template's elements. The meta key (header, footer, or content) follows the template type. Requires `template_id`, `elements_json`. Optional `global_classes_json`, `page_settings_json`, `sync_css` / `generate_css`. |
| `generate_css_file` | Regenerate `post-{id}.min.css` for one page or template. Pass `post_id` or `template_id`. Use after a content write when CSS loading is External files. |
| `regenerate_css` | Do not call. It regenerates every external CSS file on the site. |
| `upload_media` | Upload PNG, JPG, WEBP, SVG, or GIF from base64 into the Media Library. Requires `filename` (with extension) and `content_base64` (raw base64, no `data:` prefix). Returns `attachment_id` and `url`. |

## Writes

- New pages stay `draft` unless the user asked to publish.
- After `set_page_content` or `set_template_content`, pass `sync_css: true` when the site uses External files. `generate_css` is the same flag. Inline CSS is a no-op and still succeeds.
- `page_settings_json` merges into the existing settings. `headerDisabled` and `footerDisabled` hide the site header and footer.
- Never call `regenerate_css`. One page or template uses `generate_css_file` only.

## Custom code

Behavior that belongs to one template lives in that template's Page settings → Custom code, written with `set_page_settings`. A popup that sets a cookie is this case. Put the script in the template's page settings. Leave the Code element out of the element tree.

| Key | Panel label | Where it prints |
| --- | --- | --- |
| `customCss` | Custom CSS | Inline CSS in `<head>` |
| `customScriptsHeader` | Header scripts | Before `</head>` |
| `customScriptsBodyHeader` | Body (header) scripts | After `<body>` |
| `customScriptsBodyFooter` | Body (footer) scripts | Before `</body>` |

```json
{"customScriptsBodyFooter":"<script>/* cookie or popup behavior */</script>"}
```

## Pipeline

`/generate-template-from-figma` stays on `process/`. This skill does not build that run and does not patch `bricks.json`.
