# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository **is a skill for authoring Bricks Builder (WordPress) designs as JSON** — sections, full pages, templates, query loops, dynamic data, conditions, interactions, and popups. Content was originally written against a Bricks 2.3.6 source and was **not** accurate for this project's actual site (Bricks 1.12.3) — a full audit on 2026-07-14 re-verified every file in `references/` against the real 1.12.3 theme source (`wp-content/themes/bricks`) and corrected ~90+ fabricated/version-drifted keys, hooks, and shapes (see the `> Verified against Bricks 1.12.3 source ...` note at the top of each reference file). Always trust the live/installed theme version over any version number mentioned here — re-verify against source rather than assuming prior claims hold.

Start at [SKILL.md](SKILL.md) — it routes to per-topic references and ready-to-paste patterns.

## Working in this repo

- **Any Bricks task** (generate a layout, fix pasted JSON, build a template, wire ACF data): follow [SKILL.md](SKILL.md). Its rules — verified value shapes, the `key:breakpoint:pseudo` grammar, flat-tree integrity, the validation checklist — override anything you'd guess from memory.
- **Editing the skill itself**: keep SKILL.md slim (routing + rules); put depth in `references/`. Every settings key or JSON shape added to a reference must be verified against the Bricks theme source (kept locally at `~/Downloads/bricks/` or wherever the user points you), not inferred.
- **Pattern files** (`patterns/*.json`) must pass the integrity check in [references/json-formats.md](references/json-formats.md) (parse, tree reciprocity, class references, format keys) before committing.

## Layout

| Path | Contents |
|------|----------|
| `SKILL.md` | Router + authoring workflow + non-negotiable rules |
| `references/json-formats.md` | Clipboard / template / postmeta formats, option keys, validation script |
| `references/element-base-controls.md` | Universal `_` settings + exact value shapes (the accuracy backbone) |
| `references/elements-catalog.md` | Element catalog incl. nestable structures |
| `references/containers-and-layout.md`, `layout-recipes.md` | Layout system + composition patterns for real designs |
| `references/query-loop.md` | Loops + faceted filtering |
| `references/dynamic-data.md`, `acf-providers.md` | Tags, args, ACF/Meta Box/etc. |
| `references/conditions.md`, `interactions-and-animations.md`, `popups-and-templates.md` | Conditional rendering, animations, popups + template system |
| `references/theme-styles-and-globals.md` | Theme Styles, global classes/variables, site-wide styling |
| `references/external-assets.md` | Referencing remote images/video/SVG/icons from a reference URL (hotlink vs re-host) |
| `references/forms.md`, `woocommerce.md`, `hooks.md`, `custom-elements.md`, `assets-permissions.md`, `db-schema.md`, `responsive-breakpoints.md`, `novamira-verification.md`, `quick-reference.md` | Forms, Woo, PHP extension points, DB schema, breakpoints, verification recipes |
| `patterns/` | Validated paste/import-ready JSON + INDEX.md (incl. `bem-*.json` class-first examples) |

## Quick facts (full detail in references)

- Element node: `{id, name, parent, children, settings, label?}` in a **flat array**; ids are 6-char alphanumeric.
- Clipboard wrapper: `{content, source: "bricksCopiedElements", sourceUrl, version, globalClasses, globalElements}`.
- Breakpoint/pseudo grammar: `_padding:tablet_portrait`, `_background:hover`, `_margin:mobile_portrait:hover`. Defaults: `tablet_portrait` 991 / `mobile_landscape` 767 / `mobile_portrait` 478.
- Typography keys are CSS property names (`"font-size"`), colors are objects (`{"hex": …}` / `{"raw": "var(--…)"}`), box-shadow offsets nest under `values`, gradients use `colors: [{color, stop}]`.

## WP-CLI

```bash
wp bricks regenerate_assets  # Regenerate CSS files (external-files mode)
```

## Documentation

- Official: https://academy.bricksbuilder.io/
- Developer: https://academy.bricksbuilder.io/collection/developer/
