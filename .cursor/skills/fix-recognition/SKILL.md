---
name: fix-recognition
description: Fix a wrong Figma-to-Bricks detection or a built template that does not match the frame. Use when a component kind is wrong, a node is wrong, tabs or a table or a slider misbehave, dynamic data is missing, or the render does not look like Figma. Do not add a word, pixel, or layer name from the failing file.
---

# Fix a miss

The catalog is `process/modules/recognize-parts/kinds.mjs`. The check after a fix is `.cursor/skills/check-template/SKILL.md`. During a generate run, do not edit `process/`. Write the miss in `history/notes/gaps.md`.

## Name the miss

One of these, and only the one that failed:

- Kind. The picture shows one `PartKind` and the build used another, or a block.
- Node. The kind is right and the frame that was built is the wrong box.
- Part. The component exists and a child that Figma drew is missing, or a child that Figma did not draw was invented. A null child is not a miss.
- Behavior. The element is the right kind and a visitor cannot do what that kind does (switch a tab, move a slide, open a list).
- Data. A bound component does not render the source it was given, or a slot that the source has is empty.
- Layout. The kind and the data are right and a size, gap, direction, or order does not match that frame.

## Where to edit

- Kind: the saved reading line (`kind`, `node`, `selected`, `children`, `see`). The check is `isKind(entry, PartKind.<KEY>)`. Do not add the failing file's words to `kinds.mjs`, and do not compare a component to a quoted string.
- Node: the finder inside that kind's builder, limited to the node the picture named. Widen one step. Two equal candidates stay a plan question.
- Part: `children` on the reading. A missing pagination, arrow, pane, or list stays null and the component still builds.
- Behavior: the component module under `process/modules/write-bricks/components/`. State is the class, the attribute, and the script together.
- Data: the binding for that id. Do not paste the words Figma drew in as a second source.
- Layout: `process/modules/write-bricks/render/` or the component module. Do not patch `bricks.json`.

## What the user just said

Pick one route.

Detection is wrong. The picture shows a kind this catalog already has, and the build used another kind or the wrong box. Fix the reading line, or the finder for that kind. Add a test whose words are not the words of this file. Rebuild this template. Do not add this file's words, pixels, or layer names to the catalog.

This file is an odd case and it still has to be right. Name the structure in one sentence that stays true if this file is deleted. If that sentence exists, add it to that kind and add a second example. If it does not, leave `process/` alone. Satisfy this section in its plan or `overrides.json`, with a reason that quotes the user. Say that the catalog was not changed.

The UI number is wrong. The kind is right and one size, gap, color, or order does not match the frame. Copy that Figma property in the render module. The number comes from the tree. Rebuild and read the verify pictures. Do not add a component and do not add a word list.

## Proof

Add a test whose copy is not the copy of the failing file. Keep the existing tests of that kind. Then run the check skill on the section that failed.
