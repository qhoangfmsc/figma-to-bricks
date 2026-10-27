// Figma LINE (a stroke on a box with zero thickness) -> a zero-thickness block that keeps Figma's layout footprint, with the stroke drawn
// by a ::before. A CSS border cannot do it: on a 0 x 34 box it paints on all four sides and adds the stroke width twice.
// Figma: LINE of length L, rotation 0 / pi (horizontal) or +-pi/2 (vertical); stroke SOLID, weight w, align CENTER (the stroke straddles the line).
//   The layout box is the rotated bounding box (horizontal L x 0, vertical 0 x L), strokes take no layout space.
// Bricks: the block keeps node.box (width / height from size.mjs), `position: relative` unless it is placed absolutely, and
//   `::before { position:absolute; <across>:-w/2; <along>:0; <across size>:w; <along size>:100%; background:<stroke color> }`.
// Not supported (returns false, the generic stroke / rotation rules run and warn): other angles, dashes, gradient / several strokes,
//   stroke align INSIDE / OUTSIDE (the line would move by w/2).
import { addCustomCss, cssColor, px } from './css.mjs';

const near = (a, b) => Math.abs(a - b) < 1e-3;

export function applyLine({ node, s, warn }) {
  if (node.type !== 'LINE' || !node.stroke) return false;
  const st = node.stroke;
  const top = st.paints[st.paints.length - 1];
  if (st.paints.length !== 1 || top.type !== 'SOLID' || st.dashes || st.align !== 'CENTER') return false;
  const rot = Math.abs(node.rotation ?? 0) % Math.PI;
  const horizontal = near(rot, 0) || near(rot, Math.PI);
  const vertical = near(rot, Math.PI / 2);
  if (!horizontal && !vertical) return false;
  if (node.place !== 'ABSOLUTE') s._position = 'relative';
  const w = st.weight;
  const color = cssColor(top);
  const decl = vertical
    ? `content: ""; position: absolute; left: ${px(-w / 2)}; top: 0; width: ${px(w)}; height: 100%; background: ${color};`
    : `content: ""; position: absolute; top: ${px(-w / 2)}; left: 0; height: ${px(w)}; width: 100%; background: ${color};`;
  addCustomCss(s, decl, '::before');
  return true;
}
