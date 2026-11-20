import { NodeType, FillType, isType, isText } from '../node-type.mjs';
// Shared shape tests. A layer name is not an input here.
// Popup, form, menu, and choice all read the same box, fill, and icon facts.

export const visibleKids = (n) => (n?.children ?? []).filter((c) => c && c.visible !== false);

export function textsOf(n, out = []) {
  if (!n || n.visible === false) return out;
  if (isText(n) && !n.svg && n.text?.characters?.trim()) out.push(n);
  visibleKids(n).forEach((c) => textsOf(c, out));
  return out;
}

export function dimFill(n) {
  const fill = (n?.fills ?? []).find((f) => isType(f, FillType.SOLID) || isType(f, FillType.GRADIENT_LINEAR));
  if (!fill) return false;
  return (fill.alpha ?? 1) * (n.opacity ?? 1) <= 0.75;
}

export function covers(child, root) {
  if (!child?.box || !root?.box) return false;
  return child.box.w >= root.box.w * 0.85 && child.box.h >= root.box.h * 0.85 && child.box.x <= root.box.w * 0.08;
}

export function centeredCard(card, root) {
  if (!card?.box || !root?.box || card.box.w > root.box.w * 0.85 || card.box.h > root.box.h * 0.92) return false;
  const left = card.box.x;
  const right = root.box.w - (card.box.x + card.box.w);
  return left >= root.box.w * 0.08 && right >= root.box.w * 0.08;
}

function isCloseMark(n, parent) {
  if (!n?.box || !parent?.box) return false;
  const { w, h, x, y } = n.box;
  const limit = Math.min(parent.box.w, parent.box.h);
  if (limit <= 0 || w < limit * 0.02 || h < limit * 0.02 || w > limit * 0.18 || h > limit * 0.18) return false;
  const cornerReach = Math.min(parent.box.w, parent.box.h) * 0.16;
  const corner = (x + w > parent.box.w - cornerReach && y < cornerReach) || (x < cornerReach && y < cornerReach);
  if (!corner) return false;
  const label = textsOf(n).map((t) => t.text.characters.trim()).join('');
  if (/^[×xX✕✖]$/.test(label)) return true;
  const name = `${n.name ?? ''} ${n.component ?? ''} ${n.svg?.file ?? ''}`;
  if (/\b(close|dismiss|times)\b/i.test(name) || /\bx\b/i.test(name)) return true;
  return isType(n, NodeType.VECTOR) && !n.svg;
}

// The mark may sit inside a header. Coordinates are added up from this frame.
function closeMarksIn(frame) {
  const ids = [];
  const walk = (n, ox, oy) => {
    for (const c of visibleKids(n)) {
      const x = ox + (c.box?.x ?? 0);
      const y = oy + (c.box?.y ?? 0);
      const placed = c.box ? { ...c, box: { ...c.box, x, y } } : c;
      if (isCloseMark(placed, frame)) ids.push(c.id);
      walk(c, x, y);
    }
  };
  walk(frame, 0, 0);
  return ids;
}

export function hasClose(root) {
  return closeMarksIn(root).length > 0;
}

// A dim artboard with one centered card is the Bricks popup backdrop plus the card.
// The card is the template content. The dim fill is the backdrop, not a second frame.
export function popupCard(root) {
  if (!dimFill(root)) return null;
  const card = visibleKids(root).find((c) => centeredCard(c, root));
  if (!card?.box) return null;
  const fill = (root.fills ?? []).find((f) => isType(f, FillType.SOLID) || isType(f, FillType.GRADIENT_LINEAR));
  const backdrop = isType(fill, FillType.SOLID) && fill.hex ? { hex: fill.hex, alpha: (fill.alpha ?? 1) * (root.opacity ?? 1) } : null;
  return { card, backdrop, width: Math.round(card.box.w) };
}

// The X on a dim frame, and the X in the corner of the card on that frame.
export function closeMarkIds(root) {
  const ids = closeMarksIn(root);
  for (const c of visibleKids(root)) {
    if (centeredCard(c, root) || dimFill(root)) ids.push(...closeMarksIn(c));
  }
  return [...new Set(ids)];
}

function radiusMin(n) {
  return Array.isArray(n?.radius) && n.radius.length ? Math.min(...n.radius) : 0;
}

// An exported icon, or an icon font, is a glyph. A checkbox drawn as a stroked box is not.
export function isGlyph(n) {
  if (!n || n.visible === false) return false;
  if (n.svg) return true;
  const font = n.text?.fontFamily ?? '';
  if (isText(n) && /awesome|material icons/i.test(font)) return true;
  return visibleKids(n).some(isGlyph);
}

export function isIconMark(n) {
  if (!n || n.stroke) return false;
  return isGlyph(n);
}

function isTrack(n) {
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  if (h <= 0 || w < h * 1.55 || w > h * 2.9) return false;
  return radiusMin(n) >= h / 2 - 1;
}

function knobOf(track) {
  return visibleKids(track).find((c) => {
    const w = c.box?.w ?? 0;
    const h = c.box?.h ?? 0;
    const th = track.box?.h ?? 0;
    return w > 0 && h > 0 && Math.abs(w - h) / Math.max(w, h) <= 0.2 && w >= th * 0.45 && w <= th;
  });
}

export function containsChoice(n) {
  if (!n || n.visible === false) return false;
  if (isTrack(n) && knobOf(n) && !isIconMark(n)) return true;
  return visibleKids(n).some(containsChoice);
}

// A compact filled or stroked control. A plain text link has neither.
export function isPressable(n) {
  if (!n?.box || isText(n) || textsOf(n).length !== 1) return false;
  const text = textsOf(n)[0];
  const textH = text?.box?.h ?? 0;
  const boxH = n.box.h ?? 0;
  if (textH > 0 && boxH > textH * 2.5) return false;
  const filled = (n.fills ?? []).some((f) => isType(f, FillType.SOLID) && (f.alpha ?? 1) > 0.5);
  return filled || !!n.stroke;
}
