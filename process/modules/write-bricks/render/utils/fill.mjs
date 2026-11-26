// Figma fills, listed bottom to top. One function per fill type.
// SOLID -> background color. GRADIENT_LINEAR -> Bricks gradient. IMAGE on a parent -> background image.
import { addCustomCss, colorObj, cssColor, r4 } from '../../../write-bricks/render/utils/css.mjs';
import { linearGradientCss, linearGradientControl } from '../../../write-bricks/render/utils/gradient.mjs';

// An opaque solid covers every fill under it. Those fills are not painted.
function visibleFills(fills) {
  for (let i = fills.length - 1; i > 0; i--) {
    if (fills[i].type === 'SOLID' && (fills[i].alpha ?? 1) >= 1 && !fills[i].blendMode) return fills.slice(i);
  }
  return fills;
}

// A translucent solid does not replace the gradient under it.
function bodyFill(painted) {
  const top = painted.at(-1);
  if (top.type === 'SOLID' && (top.alpha ?? 1) < 1) {
    const under = painted.slice(0, -1).findLast((fill) => fill.type === 'GRADIENT_LINEAR');
    if (under) return under;
  }
  return top;
}

function writeSolid(fill, settings, expect) {
  settings._background = { color: colorObj(fill) };
  expect['background-color'] = cssColor(fill);
}

function writeGradient(node, fill, settings) {
  const fills = node.fills ?? [];
  const imageAt = fills.findLastIndex((item) => item.type === 'IMAGE');
  const gradientAt = fills.indexOf(fill);
  if (imageAt > gradientAt) return;
  if (imageAt >= 0 && node.children?.length) {
    if (settings._position !== 'absolute') settings._position = settings._position || 'relative';
    addCustomCss(settings, 'isolation: isolate;');
    addCustomCss(settings, `content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; background-image: ${linearGradientCss(fill, node.box.w, node.box.h)};`, '::before');
    return;
  }
  settings._gradient = linearGradientControl(fill, node.box.w, node.box.h);
}

function writeImage(node, fill, settings, warn) {
  const transform = fill.imageTransform;
  const cropped = fill.scaleMode === 'STRETCH' && transform && (
    Math.abs(transform[0][0] - 1) > 1e-4 || Math.abs(transform[1][1] - 1) > 1e-4
    || Math.abs(transform[0][2]) > 1e-4 || Math.abs(transform[1][2]) > 1e-4
  );
  if (cropped) {
    const axis = (scale, shift) => (Math.abs(scale - 1) < 1e-4 ? '0%' : `${r4((-shift / (scale - 1)) * 100)}%`);
    if (Math.abs(transform[0][0] - 1) < 1e-4 && Math.abs(transform[0][2]) > 1e-3) warn(node, 'background image shifted on an axis it is not scaled on: shift not applied');
    if (Math.abs(transform[1][1] - 1) < 1e-4 && Math.abs(transform[1][2]) > 1e-3) warn(node, 'background image shifted on an axis it is not scaled on: shift not applied');
    settings._background = { ...(settings._background ?? {}), image: { $asset: fill.asset.file, size: 'full' }, repeat: 'no-repeat' };
    addCustomCss(settings, `background-size: ${r4(100 / transform[0][0])}% ${r4(100 / transform[1][1])}%; background-position: ${axis(transform[0][0], transform[0][2])} ${axis(transform[1][1], transform[1][2])}; background-repeat: no-repeat;`);
    return true;
  }
  const size = { FILL: 'cover', FIT: 'contain', STRETCH: '100% 100%' }[fill.scaleMode];
  if (!size) warn(node, `background image scaleMode ${fill.scaleMode} approximated as cover`);
  settings._background = {
    ...(settings._background ?? {}),
    image: { $asset: fill.asset.file, size: 'full' },
    size: size ?? 'cover',
    position: 'center center',
    repeat: fill.scaleMode === 'TILE' ? 'repeat' : 'no-repeat',
  };
  return false;
}

export function applyFill({ node, s, css, warn }, { skipFill = false } = {}) {
  const fills = visibleFills(node.fills ?? []);
  const painted = skipFill ? [] : fills.filter((fill) => fill.type !== 'IMAGE');
  if (painted.length) {
    const top = bodyFill(painted);
    if (painted.length > 1 && top === painted.at(-1)) warn(node, `${painted.length} fills: only the top one is applied`);
    if (top.type === 'SOLID') writeSolid(top, s, css);
    else if (top.type === 'GRADIENT_LINEAR') writeGradient(node, top, s);
    else warn(node, `fill type ${top.type} is not supported yet (skipped)`);
  }
  const images = fills.filter((fill) => fill.type === 'IMAGE');
  if (images.length > 1) warn(node, `${images.length} image fills: only the top one is applied`);
  const image = images.at(-1);
  if (image && !skipFill && node.children?.length) writeImage(node, image, s, warn);
}
