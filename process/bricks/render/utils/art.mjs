// Every build sorts a node into one of three roles. The same pixels at the Figma frame width, and a real page on every other width.
//   background  paint (image, gradient, solid, or a group of those — no text) that is at least as wide as its screen.
//               Width is a percentage of that screen, so a wider monitor does not show the page colour on both sides.
//   relative    Figma constraint SCALE or LEFT_RIGHT (size.mjs anchor), or a layer inside a background. It follows its parent.
//   content     text, icons, cards, and any picture narrower than its screen. The Figma pixel size stays.
//               A centered column stays centered; it does not stretch across an ultrawide monitor.
import { addCustomCss, pct, px, r4 } from './css.mjs';

const kids = (node) => (node.children ?? []).filter((c) => c.visible !== false);

function hasText(node) {
  if (!node || node.visible === false) return false;
  if (node.type === 'TEXT') return true;
  return kids(node).some(hasText);
}

function hasImage(node) {
  if (!node || node.visible === false) return false;
  if ((node.fills ?? []).some((f) => f.type === 'IMAGE')) return true;
  return kids(node).some(hasImage);
}

function hasFill(node) {
  if (!node || node.visible === false) return false;
  if ((node.fills ?? []).length) return true;
  return kids(node).some(hasFill);
}

function isPlainShape(node) {
  if (!node || node.visible === false || node.type === 'TEXT' || node.svg) return false;
  const inner = kids(node);
  if (!inner.length) return true;
  return inner.every(isPlainShape);
}

// Paint is anything a designer would put behind or beside the words: pictures and shapes, never a text frame or an icon svg.
export function isPaint(node) {
  if (!node || node.visible === false || node.type === 'TEXT' || node.svg) return false;
  if (node.__paint != null) return node.__paint;
  const inner = kids(node);
  const result = inner.length
    ? !hasText(node) && inner.every((c) => isPaint(c) || isPlainShape(c)) && (hasImage(node) || hasFill(node))
    : (node.fills ?? []).length > 0;
  node.__paint = result;
  return result;
}

// A background covers the screen it sits on. A picture that is narrower than that screen is content, even when it is a direct child of the artboard.
export function isBackdrop(node, parent) {
  if (!parent?.box || !node?.box || node.visible === false || node.type === 'TEXT') return false;
  if (!(parent.box.w > 0) || node.box.w < parent.box.w - 1) return false;
  return !!node.svg || isPaint(node);
}

export function isArtStack(node) {
  if (!node || node.visible === false || node.type === 'TEXT' || node.svg) return false;
  if (node.__art != null) return node.__art;
  const inner = kids(node);
  const result = inner.length
    ? !hasText(node) && hasImage(node) && inner.every((c) => isArtStack(c) || isPlainShape(c))
    : (node.fills ?? []).some((f) => f.type === 'IMAGE');
  node.__art = result;
  return result;
}

function contentBox(parent) {
  const p = parent.layout?.padding ?? {};
  const left = p.left ?? 0, right = p.right ?? 0, top = p.top ?? 0, bottom = p.bottom ?? 0;
  return { x: left, y: top, w: parent.box.w - left - right, h: parent.box.h - top - bottom };
}

export function pinToParent(node, parent, s) {
  const b = node.box;
  const frame = contentBox(parent);
  if (!(frame.w > 0) || !(frame.h > 0)) return;
  s._position = 'absolute';
  s._left = pct((b.x - frame.x) / frame.w * 100);
  s._top = pct((b.y - frame.y) / frame.h * 100);
  s._width = pct(b.w / frame.w * 100);
  s._height = pct(b.h / frame.h * 100);
  s._widthMax = 'none';
  delete s._right;
  node.__fluid = true;
}

export function overflowsParent(node, parent) {
  const b = node.box, p = parent.box;
  if (!p) return false;
  return b.x < -0.5 || b.y < -0.5 || b.x + b.w > p.w + 0.5 || b.y + b.h > p.h + 0.5;
}

// Width is a share of the screen this layer covers. At that screen's Figma width the pixels match.
// min-width keeps a layer that already hangs past the frame from shrinking and uncovering the section.
export function coverOnArtboard(node, parent, s) {
  const b = node.box;
  const W = parent.box.w;
  const H = parent.box.h;
  s._width = pct(b.w / W * 100);
  s._widthMax = 'none';
  s._height = 'auto';
  s._aspectRatio = `${r4(b.w)} / ${r4(b.h)}`;
  if (b.w > W + 0.5) s._widthMin = px(b.w);
  const horizontal = node.constraints?.horizontal ?? 'LEFT';
  if (horizontal === 'LEFT' || horizontal === 'SCALE') s._left = pct(b.x / W * 100);
  if ((node.constraints?.vertical ?? 'TOP') === 'CENTER') {
    const off = (b.y + b.h / 2 - H / 2) / H * 100;
    s._top = Math.abs(off) < 1e-6 ? '50%' : `calc(50% ${off < 0 ? '-' : '+'} ${pct(Math.abs(off))})`;
    if (horizontal === 'CENTER' || (horizontal === 'LEFT' && Math.abs(b.x - (W - b.w) / 2) <= 1)) addCustomCss(s, 'transform: translate(-50%, -50%);');
    else addCustomCss(s, 'transform: translateY(-50%);');
  }
  node.__fluid = true;
}
