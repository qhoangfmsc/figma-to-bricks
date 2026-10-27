// Figma corner radius / ellipse -> Bricks `_border.radius`. Squircle smoothing has no CSS equivalent (warned).
import { px } from './css.mjs';

export function applyRadius({ node, css, warn }, border) {
  if (node.radius) {
    const [tl, tr, br, bl] = node.radius;
    border.radius = { top: px(tl), right: px(tr), bottom: px(br), left: px(bl) };
    Object.assign(css, { 'border-top-left-radius': px(tl), 'border-top-right-radius': px(tr), 'border-bottom-right-radius': px(br), 'border-bottom-left-radius': px(bl) });
  }
  if (node.type === 'ELLIPSE') border.radius = { top: '50%', right: '50%', bottom: '50%', left: '50%' };
  if (node.cornerSmoothing) warn(node, 'cornerSmoothing (squircle) has no CSS equivalent');
}
