// Figma LAYER_BLUR / BACKGROUND_BLUR.  NOT IMPLEMENTED YET: only warns, so the report lists it.
// To implement: LAYER_BLUR -> `filter: blur(<radius>px)` (Bricks `_cssFilters` or `_cssCustom`), BACKGROUND_BLUR -> `backdrop-filter`.
// Note the Figma blur `radius` is the CSS blur() value x 2 -> check against a render before trusting it. Add a test in test/.
export const isBlur = (e) => e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR';

export function applyBlur({ node, warn }) {
  for (const e of node.effects ?? []) if (isBlur(e)) warn(node, `effect ${e.type} is not supported yet`);
}
