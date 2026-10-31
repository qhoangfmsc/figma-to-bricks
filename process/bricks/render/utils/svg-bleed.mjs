// A node whose svg was exported with an outset effect (drop shadow): Figma's svg is bigger than the node box, the node box sits inside it.
// Placing that svg in the node box scales the whole picture down (Pagepeed vnx-service: a 92.43px bubble in a 107px svg drew 13.6% too small).
//
// Extent of a drop shadow on each side: blur + spread -/+ offset (>= 0). The svg size is the box plus both sides, rounded UP to whole px, and the
// rounding remainder is split evenly over both sides. Measured on 11 exported svgs of 3 shadow families, all within 0.1px of the
// svg width / height Figma wrote and of the circle centres inside the svgs:
//   (x0 y4 blur4 spread0)           box 180.16 x 61.93 -> svg 189 x 70      (sides 4 / 4 / 0 / 8)
//   (x0 y1 blur3 spread0)           box 129 x 64       -> svg 135 x 70      (3 / 3 / 2 / 4)
//   (x0 y2 blur12 spread0)          box 36 x 36        -> svg 60 x 60       (12 / 12 / 10 / 14)
//   (x0 y4.7663 blur9.5327 spread-2.3832) box 92.4264   -> svg 107 x 107, circle centre (53.5, 48.72): left 7.29, top 2.51
//   (x0 y7.4624 blur14.9247 spread-3.7312) box 58.5736  -> svg 81 x 81,   circle centre (40.5, 33.03): left 11.21, top 3.75
// Returns { left, top, right, bottom, w, h } (px the svg sticks out of the box, and its own size) or null when the svg is the box size or the
// numbers do not add up (then the old behaviour, the Figma box, stays and nothing is guessed).
export function svgBleed(node) {
  const svg = node.svg;
  if (!svg?.width || !svg?.height || node.box.w < 0.5 || node.box.h < 0.5 || node.rotation) return null; // a rotated node is placed by rotation.mjs around its own box
  const shadows = (node.effects ?? []).filter((e) => e.type === 'DROP_SHADOW');
  if (!shadows.length) return null;
  const side = (f) => Math.max(0, ...shadows.map(f));
  const ext = { left: side((e) => e.blur + e.spread - e.x), right: side((e) => e.blur + e.spread + e.x), top: side((e) => e.blur + e.spread - e.y), bottom: side((e) => e.blur + e.spread + e.y) };
  const w = node.box.w + ext.left + ext.right;
  const h = node.box.h + ext.top + ext.bottom;
  const extraX = svg.width - w;
  const extraY = svg.height - h;
  if (extraX < -0.01 || extraX >= 1 || extraY < -0.01 || extraY >= 1) return null; // not explained by the drop shadows alone
  if (svg.width - node.box.w < 0.5 && svg.height - node.box.h < 0.5) return null;
  const left = ext.left + extraX / 2;
  const top = ext.top + extraY / 2;
  return { left, top, right: svg.width - node.box.w - left, bottom: svg.height - node.box.h - top, w: svg.width, h: svg.height };
}
