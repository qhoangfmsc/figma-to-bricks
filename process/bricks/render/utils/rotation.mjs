// Figma node rotation -> CSS transform.
// Figma: `rotation` (rad) plus, from geometry=paths, the unrotated `size` and `relativeTransform` [[a c e],[b d f]] (parent coordinates).
// Bricks: the UNROTATED box is placed (left/top = e/f, width/height = size) with transform-origin 0 0, so the browser's rotated bounding box
// equals Figma's absoluteBoundingBox. The turn itself is written where the owner can see it:
//   pure rotation by a whole number of degrees -> Style > Transform (`_transform.rotateZ`, `_transformOrigin`); Bricks 1.9.8 keeps only whole degrees (intval)
//   anything else (fractional angle, flip, skew)  -> Style > CSS > Custom CSS: `transform: matrix(a b c d 0 0)`, the same matrix Figma uses (both y-down)
// An svg element (the node is exported as a file) is not turned at all: the file has the rotation baked in.
// Not supported (warns): rotated nodes that are not absolutely placed (auto-layout flow decides their position from the rotated box), and
// rotation without the transform data (old raw.json fetched before geometry=paths).
import { px, addCustomCss } from './css.mjs';

export function applyRotation({ node, s, css, warn }) {
  if (!node.rotation) return;
  // an svg exported by Figma for a rotated node already has the turn in it (a 162×2 line turned 90° is a 2×162 file, the node's bounding box): the element is
  // placed by that bounding box and not turned a second time (Review: the scrollbar became a squashed 162×2 stroke)
  if (node.svg) return;
  const r = node.rotate;
  if (!r || node.place !== 'ABSOLUTE') {
    warn(node, `rotation ${node.rotation} rad is not applied${r ? ' (only absolutely placed nodes are supported)' : ' (no size / relativeTransform in raw.json: fetch again)'}`);
    return;
  }
  Object.assign(s, { _left: px(r.x), _top: px(r.y), _width: px(r.w), _height: px(r.h) });
  Object.assign(css, { width: px(r.w), height: px(r.h) });
  const [a, b, c, d] = r.m;
  const deg = (Math.atan2(b, a) * 180) / Math.PI;
  const pure = Math.abs(a - d) < 1e-6 && Math.abs(b + c) < 1e-6 && Math.abs(a * a + b * b - 1) < 1e-6;
  if (pure && Math.abs(deg - Math.round(deg)) < 1e-4) {
    s._transform = { rotateZ: String(Math.round(deg)) };
    s._transformOrigin = '0 0';
  } else {
    addCustomCss(s, `transform: matrix(${r.m.join(', ')}, 0, 0); transform-origin: 0 0;`);
  }
}
