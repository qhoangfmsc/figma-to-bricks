// Figma effects -> Bricks `_boxShadow` (one shadow) or `box-shadow` custom css (several). DROP_SHADOW / INNER_SHADOW.
// A TEXT node's drop shadow follows the glyphs in Figma: it becomes `text-shadow` (every drop shadow, no spread: Figma has none for text), never a
// box shadow of the text's box (that drew a line under every speaker name in the Hero run). An inner shadow on text is warned.
// A GROUP has no fill of its own: Figma draws its drop shadow around the shape of the children together. A box-shadow of the group's rectangle darkened the
// square around a round badge (Pagepeed vnx-service "12 YEARS", 159px circle) and left the circle itself unshaded -> `filter: drop-shadow()` (follows the
// painted shape; Bricks 1.9.8 has no control for it, custom css). drop-shadow() has no spread: a non-zero spread is warned, not guessed.
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
  let shadows = (node.effects ?? []).filter((e) => e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW');
  if (node.type === 'GROUP' && !node.svg && !(node.fills ?? []).length && !node.stroke) {
    const drops = shadows.filter((e) => e.type === 'DROP_SHADOW');
    if (drops.length) {
      addCustomCss(s, `filter: ${drops.map((e) => `drop-shadow(${px(e.x)} ${px(e.y)} ${px(e.blur)} ${cssColor(e)})`).join(' ')};`);
      if (drops.some((e) => e.spread)) warn(node, `group drop shadow spread ${drops.map((e) => e.spread).join(' / ')}px is not applicable to filter: drop-shadow(): ignored (limit)`);
      shadows = shadows.filter((e) => e.type !== 'DROP_SHADOW');
    }
  }
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
