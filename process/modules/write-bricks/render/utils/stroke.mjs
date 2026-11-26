// Figma strokes. INSIDE becomes a CSS border when padding can absorb it, otherwise an inset shadow.
// OUTSIDE and CENTER take no layout space, so a uniform solid stroke becomes a shadow.
import { addCustomCss, colorObj, cssColor, px } from '../../../write-bricks/render/utils/css.mjs';
import { linearGradientCss } from '../../../write-bricks/render/utils/gradient.mjs';

export const strokeWidths = (stroke) => stroke.weights ?? { top: stroke.weight, right: stroke.weight, bottom: stroke.weight, left: stroke.weight };

const uniform = (widths) => widths.top === widths.right && widths.right === widths.bottom && widths.bottom === widths.left;

export const isGradientRing = (node) => {
  const stroke = node.stroke;
  if (!stroke || stroke.paints.length !== 1 || stroke.paints[0].type !== 'GRADIENT_LINEAR' || stroke.dashes) return false;
  return uniform(strokeWidths(stroke));
};

export function strokeMode(node) {
  const stroke = node.stroke;
  if (!stroke) return null;
  const top = stroke.paints.at(-1);
  if (top.type !== 'SOLID' || stroke.align !== 'INSIDE' || stroke.inLayout || stroke.dashes) return 'border';
  const widths = strokeWidths(stroke);
  const padOk = node.layout && ['top', 'right', 'bottom', 'left'].every((side) => node.layout.padding[side] >= widths[side]);
  if (padOk) return 'border';
  const hasShadow = (node.effects ?? []).some((effect) => effect.hex);
  return hasShadow ? 'border' : 'inset';
}

function writeGradientRing(node, settings) {
  const stroke = node.stroke;
  const widths = strokeWidths(stroke);
  const top = stroke.paints.at(-1);
  const out = stroke.align === 'OUTSIDE' ? widths.top : stroke.align === 'CENTER' ? widths.top / 2 : 0;
  const radius = (node.radius ?? [0, 0, 0, 0]).map((value) => (value > 0 ? value + out : 0));
  if (settings._position !== 'absolute') settings._position ??= 'relative';
  addCustomCss(settings, `content: ""; position: absolute; inset: ${px(-out)}; padding: ${px(widths.top)}; border-radius: ${radius.map(px).join(' ')}; background: ${linearGradientCss(top, node.box.w + 2 * out, node.box.h + 2 * out)}; -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none;`, '::before');
}

function writeOutsideShadow(stroke, widths, color) {
  if (stroke.align === 'OUTSIDE') return [`0 0 0 ${px(widths.top)} ${color}`];
  return [`0 0 0 ${px(widths.top / 2)} ${color}`, `inset 0 0 0 ${px(widths.top / 2)} ${color}`];
}

function writeInset(node, stroke, widths, settings, expect) {
  const top = stroke.paints.at(-1);
  if (uniform(widths)) {
    settings._boxShadow = { values: { offsetX: '0', offsetY: '0', blur: '0', spread: String(widths.top) }, color: colorObj(top), inset: true };
    expect['box-shadow'] = `${cssColor(top)} 0px 0px 0px ${px(widths.top)} inset`;
    return;
  }
  const sides = [[widths.left, widths.left, 0], [widths.right, -widths.right, 0], [widths.top, 0, widths.top], [widths.bottom, 0, -widths.bottom]].filter(([weight]) => weight > 0);
  const color = cssColor(top);
  const list = (paint) => sides.map(([, x, y]) => paint(x, y)).join(', ');
  addCustomCss(settings, `box-shadow: ${list((x, y) => `inset ${px(x)} ${px(y)} 0 0 ${color}`)};`);
  expect['box-shadow'] = list((x, y) => `${color} ${px(x)} ${px(y)} 0px 0px inset`);
}

function writeBorder(stroke, widths, border, expect) {
  const top = stroke.paints.at(-1);
  border.width = { top: px(widths.top), right: px(widths.right), bottom: px(widths.bottom), left: px(widths.left) };
  border.style = stroke.dashes ? 'dashed' : 'solid';
  border.color = colorObj(top);
  expect['border-top-width'] = px(widths.top);
  expect['border-left-width'] = px(widths.left);
  expect['border-top-color'] = cssColor(top);
}

export function applyStroke(ctx, border) {
  const { node, s, css, warn } = ctx;
  if (!node.stroke) return;
  const stroke = node.stroke;
  const top = stroke.paints.at(-1);
  const widths = strokeWidths(stroke);
  if (isGradientRing(node)) {
    writeGradientRing(node, s);
    if (stroke.inLayout && stroke.align === 'OUTSIDE') warn(node, 'stroke outside AND included in layout: its outer space is not added');
    return;
  }
  if (stroke.align !== 'INSIDE' && top.type === 'SOLID' && uniform(widths) && !stroke.dashes && stroke.paints.length === 1) {
    ctx.strokeShadows = writeOutsideShadow(stroke, widths, cssColor(top));
    return;
  }
  if (top.type !== 'SOLID') warn(node, `stroke type ${top.type} is not supported yet`);
  else if (strokeMode(node) === 'inset') writeInset(node, stroke, widths, s, css);
  else writeBorder(stroke, widths, border, css);
  if (stroke.align !== 'INSIDE') warn(node, `stroke align ${stroke.align}: CSS border is always inside the box (approximation)`);
  if (stroke.paints.length > 1) warn(node, 'multiple strokes: only the top one is applied');
}
