// Figma fills -> Bricks `_background` (+ expected css for verify).
//   SOLID            _background.color
//   GRADIENT_LINEAR  background-image through _cssCustom (see gradient.mjs)
//   IMAGE on a node with children -> _background.image (a leaf with an image fill becomes an `image` element instead, see index.mjs)
// Not supported yet (warned, never guessed): radial/angular/diamond gradients, several fills (top one wins).
import { addCustomCss, colorObj, cssColor, r4 } from './css.mjs';
import { linearGradientCss } from './gradient.mjs';

// Fills are listed bottom to top. An opaque normal-blend SOLID covers everything under it, so those fills are invisible in Figma and must not be painted
// (Benefits section: image under a #0b36b2 solid showed as flat blue in Figma, the image was drawn on top of the color here).
function visibleFills(fills) {
  for (let i = fills.length - 1; i > 0; i--) if (fills[i].type === 'SOLID' && (fills[i].alpha ?? 1) >= 1 && !fills[i].blendMode) return fills.slice(i);
  return fills;
}

export function applyFill({ node, s, css, warn }, { skipFill = false } = {}) {
  const fills = visibleFills(node.fills ?? []);
  const painted = skipFill ? [] : fills.filter((f) => f.type !== 'IMAGE');
  if (painted.length) {
    const top = painted[painted.length - 1];
    if (painted.length > 1) warn(node, `${painted.length} fills: only the top one is applied`);
    if (top.type === 'SOLID') {
      s._background = { color: colorObj(top) };
      css['background-color'] = cssColor(top);
    } else if (top.type === 'GRADIENT_LINEAR') {
      addCustomCss(s, `background-image: ${linearGradientCss(top, node.box.w, node.box.h)};`);
    } else {
      warn(node, `fill type ${top.type} is not supported yet (skipped)`);
    }
  }
  const img = fills.find((f) => f.type === 'IMAGE');
  if (img && !skipFill && node.children?.length) {
    const T = img.imageTransform;
    const cropped = img.scaleMode === 'STRETCH' && T && (Math.abs(T[0][0] - 1) > 1e-4 || Math.abs(T[1][1] - 1) > 1e-4 || Math.abs(T[0][2]) > 1e-4 || Math.abs(T[1][2]) > 1e-4);
    if (cropped) {
      // Figma crops a STRETCH image with imageTransform (the image shows from t to t + s of its own size on each axis): the image is drawn 1/s times the
      // box and shifted by -t/s of the box. CSS percentage positions are relative to (box - image), so p = -t / (s - 1); an axis with s = 1 needs no shift.
      const axis = (sc, tr) => (Math.abs(sc - 1) < 1e-4 ? '0%' : `${r4((-tr / (sc - 1)) * 100)}%`);
      if (Math.abs(T[0][0] - 1) < 1e-4 && Math.abs(T[0][2]) > 1e-3) warn(node, 'background image shifted on an axis it is not scaled on: shift not applied');
      if (Math.abs(T[1][1] - 1) < 1e-4 && Math.abs(T[1][2]) > 1e-3) warn(node, 'background image shifted on an axis it is not scaled on: shift not applied');
      s._background = { ...(s._background ?? {}), image: { $asset: img.asset.file, size: 'full' }, repeat: 'no-repeat' };
      addCustomCss(s, `background-size: ${r4(100 / T[0][0])}% ${r4(100 / T[1][1])}%; background-position: ${axis(T[0][0], T[0][2])} ${axis(T[1][1], T[1][2])}; background-repeat: no-repeat;`);
      return;
    }
    const size = { FILL: 'cover', FIT: 'contain', STRETCH: '100% 100%' }[img.scaleMode];
    if (!size) warn(node, `background image scaleMode ${img.scaleMode} approximated as cover`);
    s._background = { ...(s._background ?? {}), image: { $asset: img.asset.file, size: 'full' }, size: size ?? 'cover', position: 'center center', repeat: img.scaleMode === 'TILE' ? 'repeat' : 'no-repeat' };
  }
}
