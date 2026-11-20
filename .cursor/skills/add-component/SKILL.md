---
name: add-component
description: Add one Bricks component to the figma-to-bricks catalog. Use when a repeated Figma structure should become a real Bricks element. One id, in kinds.mjs only. A missing optional part does not cancel the component.
---

# Add a component

The only catalog is `process/modules/recognize-parts/kinds.mjs`. Do not add the id in a second list, a skill, or a run.

## Steps

1. Add one `PartKind` key and one `SIGNAL_RULES` row. `shape` is the structure. `childComponent` lists parts that may be null. `id` and `param` are the same string. No pixel, count, or word from one file in `shape`.
2. Add `process/modules/write-bricks/components/<id>.mjs`. Its `id` is `PartKind.<KEY>`. A decision for that kind is its own function and checks `isKind(entry, PartKind.<KEY>)`. Do not compare `component` to a quoted string. Register it in `components/index.mjs`.
3. Add a row in `components/README.md` and `process/docs/widget-components/<id>.md`.
4. The builder reads the picture line: `kind`, `node`, `selected`, `children`. It copies layout numbers from that node. A null child is not rendered and the component still builds.
5. Add a test with words that are not from a real Figma file in this repo. The picture names `kind`. One case has a child node. One case has that child `null` and the component still builds.

`node --test process/test/look.test.mjs` must still show one catalog: every `PartKind` id has a builder, and no part id is a kind.

Then run `.cursor/skills/check-template/SKILL.md` for the new id.
