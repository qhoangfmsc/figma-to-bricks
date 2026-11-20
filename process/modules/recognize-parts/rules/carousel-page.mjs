// The usual slider is one row of cards. That row is the slide.
// Two or more rows of the same card, every row inside the column, are the special case: one page.
// The next page is the dash count. A row that hangs out of the frame is the next slide, not this page.
import { shapeRole } from '../node-type.mjs';

const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);

function fits(frame, child) {
  if (!frame?.box || !child?.box) return false;
  return child.box.x >= -1 && child.box.y >= -1
    && child.box.x + child.box.w <= frame.box.w + 1
    && child.box.y + child.box.h <= frame.box.h + 1;
}

export function pageCards(frame, slides) {
  if (frame?.layout?.mode !== 'VERTICAL' || !slides || slides.length < 2) return null;
  if (!slides.every((row) => row.layout?.mode === 'HORIZONTAL' && fits(frame, row))) return null;
  const rows = slides.map((row) => visibleKids(row));
  if (rows.some((cards) => cards.length < 2)) return null;
  const cards = rows.flat();
  if (new Set(cards.map((card) => shapeRole(card, visibleKids))).size === 1) return cards;
  return null;
}
