// Figma GRADIENT_LINEAR -> CSS linear-gradient() for a w x h box. Used by fill.mjs (frames) and text.mjs (gradient text).
// Handles are normalized to the box; the Figma gradient line runs handle0 -> handle1, the CSS line is centered with
// length |w sin| + |h cos|, so each stop is re-projected onto it. Radial / angular / diamond gradients are not done yet.
import { cssColor, pct, r4 } from './css.mjs';

// the angle and the stops (colour + position on the CSS gradient line) of a Figma linear gradient for a w x h box
function linearParts(paint, w, h) {
  const [p0, p1] = paint.handles.map((p) => [p.x * w, p.y * h]);
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len; // unit vector along the gradient (CSS: 0deg = up, clockwise)
  const angle = (Math.atan2(ux, -uy) * 180) / Math.PI;
  const cssLen = Math.abs(w * ux) + Math.abs(h * uy);
  const startX = w / 2 - (ux * cssLen) / 2, startY = h / 2 - (uy * cssLen) / 2;
  const offset = (p0[0] - startX) * ux + (p0[1] - startY) * uy;
  const stops = paint.stops.map((s) => ({ color: cssColor({ hex: s.hex, alpha: r4(s.alpha * (paint.alpha ?? 1)) }), position: pct(((offset + s.position * len) / cssLen) * 100) }));
  return { angle: r4(angle), stops };
}

export function linearGradientCss(paint, w, h) {
  const { angle, stops } = linearParts(paint, w, h);
  return `linear-gradient(${angle}deg, ${stops.map((x) => `${x.color} ${x.position}`).join(', ')})`;
}

// the same gradient as the Bricks `_gradient` control (Style > Gradient): Bricks writes `background-image: linear-gradient(<angle>deg, <color> <stop>, ...)`
// applyTo: 'background' | 'text' (text also gets background-clip / transparent fill from Bricks)
export function linearGradientControl(paint, w, h, applyTo = 'background') {
  const { angle, stops } = linearParts(paint, w, h);
  return { gradientType: 'linear', angle, applyTo, colors: stops.map((x) => ({ color: x.color.startsWith('#') ? { hex: x.color } : { rgb: x.color }, stop: x.position })) };
}
