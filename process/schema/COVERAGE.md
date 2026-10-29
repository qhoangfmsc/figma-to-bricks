# What the pipeline does with every property Figma can send

Generated from the Figma REST spec 0.46.0 (`figma-openapi-0.46.0.yaml`) and `handling.json`. The test `handling: every property ... is classified` fails when a property is missing here.

| | read | ignored (with reason) | limit | gap |
|---|---|---|---|---|
| node properties (124) | 70 | 44 | 9 | 1 |
| text style properties (34) | 22 | 5 | 7 | 0 |

`limit` = visual, cannot be reproduced exactly, reported when a node really uses it. `gap` = visual and reproducible, not built yet, reported the same way.

## Node: gaps (to build)

| property | default | why |
|---|---|---|
| `itemReverseZIndex` | `false` | stacking order of auto-layout children (first on top instead of last on top): not applied, the DOM order decides |

## Node: limits (reported)

| property | default | why |
|---|---|---|
| `arcData` | `{"startingAngle":0,"endingAngle":6.283185307179586,"innerRadius":0}` | arc / donut of an ellipse: border-radius cannot draw a partial ellipse |
| `explicitVariableModes` | `{}` | variable mode picked for a frame (mobile / desktop values of font size etc.): the REST node holds values of ONE mode, the render of the other can differ (Banner mobile button 14px, REST says 16) |
| `isFixed` | `false` | layer fixed while the page scrolls (position: fixed): not reproduced |
| `isMaskOutline` | `false` | mask drawn as outline: not reproduced |
| `maskType` | (absent) | kind of mask (ALPHA / VECTOR / LUMINANCE): masks are only handled as a flat picture by Figma export |
| `overflowDirection` | `"NONE"` | scrolling overflow of a frame (prototype scroll area): not built as a scroll container |
| `strokeCap` | `"NONE"` | end shape of an open stroke (ROUND, ARROW...): lines are drawn as a box + border, they have no cap |
| `strokeJoin` | `"MITER"` | corner shape of a stroke (MITER default): CSS borders have square corners and shadows follow the radius |
| `strokeMiterAngle` | `28.96` | miter limit of a stroke |

## Text style: limits (reported)

| property | default | why |
|---|---|---|
| `fontVariations` | `[]` | variable-font axes (opsz, wdth, slnt...): the page loads the static weights from Google Fonts |
| `hangingList` | `false` | list markers hanging outside the text box, see node.lineTypes |
| `hangingPunctuation` | `false` | punctuation hanging outside the text box: CSS hanging-punctuation is not supported by Chromium |
| `hyperlink` | (absent) | a link on a text run: the build has no per-run link (links are decided per element, URL is a designer-list item) |
| `leadingTrim` | `"NONE"` | trims the text box to the cap height / baseline: changes the box height, not written |
| `listSpacing` | `0` | spacing between list items of a list text; lists are not built (see node.lineTypes) |
| `opentypeFlags` | `{}` | OpenType features (ligatures, tabular numbers, small caps...): not written to font-feature-settings |

## Enum values with a decision (reported when a node has them)

| value | status | why |
|---|---|---|
| `textCase` = SMALL_CAPS | gap | small capitals for lower-case letters (OpenType smcp): reproducible with font-variant-caps: small-caps, not mapped yet |
| `textCase` = SMALL_CAPS_FORCED | gap | small capitals for every letter: reproducible with font-variant-caps: all-small-caps, not mapped yet |
| `textAutoResize` = TRUNCATE | gap | deprecated Figma value for a text box that truncates with an ellipsis (the same as textTruncation ENDING): not mapped to the line clamp yet |
| `textAlignVertical` = BOTTOM | limit | text pinned to the bottom of a fixed-height box: text.mjs reports it, flex alignment of the text inside its own box is not written |
| `maskType` = ALPHA | limit | alpha mask: masked groups are only reproduced as the flat picture Figma exports |
| `maskType` = LUMINANCE | limit | luminance mask: masked groups are only reproduced as the flat picture Figma exports |

## Enum values that no code names

A value listed here is not mapped anywhere: when a design uses it the build does what it does for an unknown value. Each needs a rule or a `limit` entry.

| property | values |
|---|---|
| `strokeCap` | ROUND, SQUARE, LINE_ARROW, TRIANGLE_ARROW, DIAMOND_FILLED, CIRCLE_FILLED, TRIANGLE_FILLED, WASHI_TAPE_1, WASHI_TAPE_2, WASHI_TAPE_3, WASHI_TAPE_4, WASHI_TAPE_5, WASHI_TAPE_6 |
| `strokeJoin` | MITER, BEVEL, ROUND |
| `textTruncation` | DISABLED |
