// Figma strokes -> Bricks `_border` / inset `_boxShadow`.
// How an INSIDE stroke is drawn so that the layout matches Figma (where strokes never take space):
//  'border' CSS border (+ padding reduced by the stroke, see layout.mjs) when every padding side can absorb it,
//  'inset'  inset box-shadow (takes no space) otherwise, e.g. a 2px stroke on a frame with 0 padding.
// Not supported yet: gradient strokes, OUTSIDE/CENTER (approximated as inside, warned), several strokes (top one wins).
import { addCustomCss, colorObj, cssColor, px } from './css.mjs';

export const strokeWidths = (st) => st.weights ?? { top: st.weight, right: st.weight, bottom: st.weight, left: st.weight };

export function strokeMode(node) {
  const st = node.stroke;
  if (!st) return null;
  const top = st.paints[st.paints.length - 1];
  if (top.type !== 'SOLID' || st.align !== 'INSIDE' || st.inLayout || st.dashes) return 'border';
  const w = strokeWidths(st);
  const padOk = node.layout && ['top', 'right', 'bottom', 'left'].every((k) => node.layout.padding[k] >= w[k]);
  if (padOk) return 'border';
  const hasShadow = (node.effects ?? []).some((e) => e.hex);
  return hasShadow ? 'border' : 'inset';
}

// `border` is the shared `_border` object being collected by style.mjs (stroke and radius both write into it)
export function applyStroke(ctx, border) {
  const { node, s, css, warn } = ctx;
  if (!node.stroke) return;
  const st = node.stroke;
  const top = st.paints[st.paints.length - 1];
  const w = strokeWidths(st);
  // OUTSIDE / CENTER: Figma's stroke takes no layout space and lies (partly) outside the box, which a CSS border cannot do (it sits inside and grows
  // the box: Gifts section, a 498px box became 504px and everything after it moved). A uniform solid stroke becomes shadows: outside = `0 0 0 w`,
  // center = half outside + half inside. effects.mjs lists them first (on top) together with the node's own shadows.
  const uniform = w.top === w.right && w.right === w.bottom && w.bottom === w.left;
  if (st.align !== 'INSIDE' && top.type === 'SOLID' && uniform && !st.dashes && st.paints.length === 1) {
    const c = cssColor(top);
    ctx.strokeShadows = st.align === 'OUTSIDE' ? [`0 0 0 ${px(w.top)} ${c}`] : [`0 0 0 ${px(w.top / 2)} ${c}`, `inset 0 0 0 ${px(w.top / 2)} ${c}`];
    return;
  }
  if (top.type !== 'SOLID') warn(node, `stroke type ${top.type} is not supported yet`);
  else if (strokeMode(node) === 'inset') {
    const uniform = w.top === w.right && w.right === w.bottom && w.bottom === w.left;
    if (uniform) {
      s._boxShadow = { values: { offsetX: '0', offsetY: '0', blur: '0', spread: String(w.top) }, color: colorObj(top), inset: true };
      css['box-shadow'] = `${cssColor(top)} 0px 0px 0px ${px(w.top)} inset`;
    } else {
      // different weight per side: one inset shadow per side (the Bricks shadow control holds only one value)
      const sides = [[w.left, w.left, 0], [w.right, -w.right, 0], [w.top, 0, w.top], [w.bottom, 0, -w.bottom]].filter(([wt]) => wt > 0);
      const col = cssColor(top);
      const list = (fn) => sides.map(([, x, y]) => fn(x, y)).join(', ');
      addCustomCss(s, `box-shadow: ${list((x, y) => `inset ${px(x)} ${px(y)} 0 0 ${col}`)};`);
      css['box-shadow'] = list((x, y) => `${col} ${px(x)} ${px(y)} 0px 0px inset`);
    }
  } else {
    border.width = { top: px(w.top), right: px(w.right), bottom: px(w.bottom), left: px(w.left) };
    border.style = st.dashes ? 'dashed' : 'solid';
    border.color = colorObj(top);
    css['border-top-width'] = px(w.top);
    css['border-left-width'] = px(w.left);
    css['border-top-color'] = cssColor(top);
  }
  if (st.align !== 'INSIDE') warn(node, `stroke align ${st.align}: CSS border is always inside the box (approximation)`);
  if (st.paints.length > 1) warn(node, 'multiple strokes: only the top one is applied');
}
