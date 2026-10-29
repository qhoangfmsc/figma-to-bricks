# Local fonts for the Figma -> Bricks pipeline (optional)

`<Family>/<weight>.woff2` replaces Google Fonts for that family and weight on the pages the pipeline builds. Remove this folder to use Google Fonts only.

- **Inter** = Inter 3.19.3 (npm `inter-ui@3.19.3`, "Inter (web)", unhinted, full glyph set), licence SIL Open Font License 1.1 (https://github.com/rsms/inter).
- Why: Figma lays text out with its own Inter 3.x. Google Fonts serves Inter 4, whose widths differ for Vietnamese capitals with stacked marks (24px Bold "GẶP VỀ DỊCH VỤ TẠI VIETNIX": Figma 340.8px, Inter 4 348.2px, Inter 3.19 341.7px), which changes line breaks.
- Production must load the same Inter build for the page to match Figma there too; this folder only decides what the LOCAL site (and so the verify step) uses.
