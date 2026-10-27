// Figma effects -> Bricks `_boxShadow` (one shadow) or `box-shadow` custom css (several). DROP_SHADOW / INNER_SHADOW.
// A TEXT node's drop shadow follows the glyphs in Figma: it becomes `text-shadow` (every drop shadow, no spread: Figma has none for text), never a
// box shadow of the text's box (that drew a line under every speaker name in the Hero run). An inner shadow on text is warned.
// Blur has its own module (blur.mjs); any other effect type is warned, never guessed.
import { addCustomCss, colorObj, cssColor, px } from './css.mjs';
import { applyBlur, isBlur } from './blur.mjs';

export function applyEffects(ctx) {
  const { node, s, warn } = ctx;
  if (node.type === 'TEXT' && !node.svg) {
    const drops = (node.effects ?? []).filter((e) => e.type === 'DROP_SHADOW');
    if (drops.length) addCustomCss(s, `text-shadow: ${drops.map((e) => `${px(e.x)} ${px(e.y)} ${px(e.blur)} ${cssColor(e)}`).join(', ')};`);
    if ((node.effects ?? []).some((e) => e.type === 'INNER_SHADOW')) warn(node, 'inner shadow on text is not supported');
    if ((node.effects ?? []).some((e) => e.spread)) warn(node, 'text shadow spread is not applicable to text-shadow: ignored');
    applyBlur(ctx);
    for (const e of node.effects ?? []) if (!e.hex && !isBlur(e)) warn(node, `effect ${e.type} is not supported yet`);
    return;
  }
  const shadows = (node.effects ?? []).filter((e) => e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW');
  const fromStroke = ctx.strokeShadows ?? []; // OUTSIDE / CENTER stroke (stroke.mjs), drawn above the node's own shadows
  if (fromStroke.length) {
    const own = shadows.map((e) => `${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${px(e.x)} ${px(e.y)} ${px(e.blur)} ${px(e.spread ?? 0)} ${cssColor(e)}`);
    addCustomCss(s, `box-shadow: ${[...fromStroke, ...own].join(', ')};`);
  } else if (shadows.length > 1) {
    // Bricks' shadow control holds one shadow: several go to `box-shadow` as a list, in Figma's order (first = on top, like CSS)
    addCustomCss(s, `box-shadow: ${shadows.map((e) => `${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${px(e.x)} ${px(e.y)} ${px(e.blur)} ${px(e.spread ?? 0)} ${cssColor(e)}`).join(', ')};`);
  } else if (shadows.length) {
    const e = shadows[0];
    s._boxShadow = { values: { offsetX: String(e.x), offsetY: String(e.y), blur: String(e.blur), spread: String(e.spread) }, color: colorObj(e), ...(e.type === 'INNER_SHADOW' && { inset: true }) };
  }
  applyBlur(ctx);
  for (const e of node.effects ?? []) if (!e.hex && !isBlur(e)) warn(node, `effect ${e.type} is not supported yet`);
}
