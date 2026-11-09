// Shared shape tests. A layer name is not an input here.
// Popup, form, menu, and choice all read the same box, fill, and icon facts.

export const visibleKids = (n) => (n?.children ?? []).filter((c) => c && c.visible !== false);

export function textsOf(n, out = []) {
  if (!n || n.visible === false) return out;
  if (n.type === 'TEXT' && !n.svg && n.text?.characters?.trim()) out.push(n);
  visibleKids(n).forEach((c) => textsOf(c, out));
  return out;
}

export function dimFill(n) {
  const fill = (n?.fills ?? []).find((f) => f.type === 'SOLID' || f.type === 'GRADIENT_LINEAR');
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
  if (w < 8 || h < 8 || w > 40 || h > 40) return false;
  const corner = (x + w > parent.box.w - 48 && y < 48) || (x < 48 && y < 48);
  if (!corner) return false;
  const label = textsOf(n).map((t) => t.text.characters.trim()).join('');
  if (/^[×xX✕✖]$/.test(label)) return true;
  if (!label && (n.svg || n.type === 'VECTOR' || visibleKids(n).some((c) => c.svg || c.type === 'VECTOR'))) return true;
  return false;
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
  const fill = (root.fills ?? []).find((f) => f.type === 'SOLID' || f.type === 'GRADIENT_LINEAR');
  const backdrop = fill?.type === 'SOLID' && fill.hex ? { hex: fill.hex, alpha: (fill.alpha ?? 1) * (root.opacity ?? 1) } : null;
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
  if (n.type === 'TEXT' && /awesome|material icons/i.test(font)) return true;
  return visibleKids(n).some(isGlyph);
}

export function isIconMark(n) {
  if (!n || n.stroke) return false;
  return isGlyph(n);
}

function isTrack(n) {
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  if (h < 16 || h > 44 || w < h * 1.55 || w > h * 2.9) return false;
  return radiusMin(n) >= h / 2 - 1;
}

function knobOf(track) {
  return visibleKids(track).find((c) => {
    const w = c.box?.w ?? 0;
    const h = c.box?.h ?? 0;
    const th = track.box?.h ?? 0;
    return Math.abs(w - h) <= 4 && w >= th * 0.45 && w <= th;
  });
}

export function containsChoice(n) {
  if (!n || n.visible === false) return false;
  if (isTrack(n) && knobOf(n) && !isIconMark(n)) return true;
  return visibleKids(n).some(containsChoice);
}

// A compact filled or stroked control. A plain text link has neither.
export function isPressable(n) {
  if (!n?.box || n.type === 'TEXT') return false;
  const h = n.box.h ?? 0;
  if (h < 32 || h > 72) return false;
  if (textsOf(n).length !== 1) return false;
  const filled = (n.fills ?? []).some((f) => f.type === 'SOLID' && (f.alpha ?? 1) > 0.5);
  return filled || !!n.stroke;
}
