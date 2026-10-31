# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository **is a skill for authoring Bricks Builder (WordPress) designs as JSON** — sections, full pages, templates, query loops, dynamic data, conditions, interactions, and popups. Everything is verified against the Bricks 2.3.6 theme source.

Start at [SKILL.md](SKILL.md) — it routes to per-topic references and ready-to-paste patterns.

## Working in this repo

- **Any Bricks task** (generate a layout, fix pasted JSON, build a template, wire ACF data): follow [SKILL.md](SKILL.md). Its rules — verified value shapes, the `key:breakpoint:pseudo` grammar, flat-tree integrity, the validation checklist — override anything you'd guess from memory.
- **Editing the skill itself**: keep SKILL.md slim (routing + rules); put depth in `references/`. Every settings key or JSON shape added to a reference must be verified against the Bricks theme source (kept locally at `~/Downloads/bricks/` or wherever the user points you), not inferred.
- **Pattern files** (`patterns/<group>/*.json`) must pass `python3 scripts/validate_pattern.py patterns/` (parse, tree reciprocity, element names, class references, query references, format keys) and be listed in their group's `INDEX.md` before committing.

## Layout

| Path | Contents |
|------|----------|
| `SKILL.md` | Router + authoring workflow + non-negotiable rules |
| `references/json-formats.md` | Clipboard / template / postmeta formats, option keys, validation script |
| `references/style-settings.md` | Universal `_` settings + exact value shapes (the accuracy backbone) |
| `references/elements.md` | Element catalog incl. nestable structures (`_hidden._cssClasses`) |
| `references/layout-recipes.md` | Composition patterns for real designs |
| `references/query-loops.md`, `query-filters.md` | Loops + faceted filtering |
| `references/dynamic-data.md`, `acf-providers.md` | Tags, args, ACF/Meta Box/etc. |
| `references/conditions.md`, `interactions.md`, `popups.md` | Conditional rendering, animations, popups |
| `references/templates.md`, `components-classes.md`, `theme-styles.md` | Template system, reusables, site-wide styling |
| `references/external-assets.md` | Referencing remote images/video/SVG/icons from a reference URL (hotlink vs re-host) |
| `references/forms.md`, `woocommerce.md`, `hooks.md`, `custom-elements.md`, `assets-permissions.md` | Forms, Woo, PHP extension points |
| `patterns/` | Validated paste/import-ready JSON in `sections/`, `templates/`, `query/`, `bem/`, `elements/`; `INDEX.md` links each group's INDEX |
| `scripts/validate_pattern.py` | Structural integrity check for pattern files (file or folder) |

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
