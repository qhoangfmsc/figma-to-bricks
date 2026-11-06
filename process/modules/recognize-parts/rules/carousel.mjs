// Candidate carousels: a row of similar cards, plus at least one carousel sign.
//   - the cards overflow the row (the next slides are cut off)
//   - the layer is named slider / carousel / swiper
//   - a pagination (the component, or a thin strip of dashes) sits on it
//   - prev / next buttons are drawn (Navigation Position=Left/Right, or an angle-left / angle-right glyph)
// Cards count as similar when their trees match, or when their names match once a trailing number is removed
// ("_award-card 1" and "_award-card"): the picture inside is sometimes a frame and sometimes a rectangle.
// A navigation row and the pagination are controls, not slides. A plain row of cards that all fit, with none of the signs, is a grid.
// A row of short links that rules/menu.mjs claims is a menu stays a menu, even when the frame cuts it off.
// One drawn slide plus arrow buttons (a benchmark image) is a slider too: the other slides are not in the frame.
const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const sig = (n) => `${n.type}[${visibleKids(n).map(sig).join(',')}]`;
const NAME = /slider|carousel|swiper|slides?\b/i;
const PAGINATION = /^(pagination|dots|pager)$/i;
const NAV_FRAME = /^(navigation|arrows?|controls)$/i;
const stem = (name) => String(name ?? '').trim().toLowerCase().replace(/[\s._-]*\d+$/, '');
const GENERIC = /^(text|frame|group|rectangle|instance|container|image|vector|ellipse|line)$/;
import { detectMenus } from '../../recognize-parts/rules/menu.mjs';

const isPagination = (n) => !!(n && (PAGINATION.test(n.name ?? '') || PAGINATION.test(n.componentSet ?? '')));

// The icon font is exported as an svg, so the glyph name is still on the text node. Only this button's own label counts:
// a navigation frame contains both arrows, and the first glyph inside it must not make the whole frame "prev".
function arrowSide(n) {
  const pos = String(n.props?.Position ?? '');
  if (/^left$/i.test(pos)) return 'prev';
  if (/^right$/i.test(pos)) return 'next';
  const g = [n, ...(n.children ?? [])].filter((c) => c.type === 'TEXT').map((c) => c.text?.characters ?? '').join(' ').toLowerCase();
  if (/angle-left|chevron-left|arrow-left|caret-left/.test(g)) return 'prev';
  if (/angle-right|chevron-right|arrow-right|caret-right/.test(g)) return 'next';
  return null;
}

function isNavFrame(n) {
  return NAV_FRAME.test(n.name ?? '') || n.componentSet === 'Navigation' && arrowSide(n);
}

// prev / next anywhere in these nodes: a navigation frame holds the two buttons, or the buttons sit in the row.
function arrowPair(nodes) {
  const found = [];
  for (const n of nodes) {
    const own = arrowSide(n);
    if (own) found.push({ n, side: own });
    else if (NAV_FRAME.test(n.name ?? '')) for (const c of visibleKids(n)) { const s = arrowSide(c); if (s) found.push({ n: c, side: s }); }
  }
  if (!found.some((a) => a.side === 'prev') || !found.some((a) => a.side === 'next')) return null;
  return { prev: found.find((a) => a.side === 'prev').n, next: found.find((a) => a.side === 'next').n };
}

function similar(slides) {
  if (slides.length < 2) return false;
  if (new Set(slides.map(sig)).size === 1) return true;
  const stems = slides.map((s) => stem(s.name)).filter(Boolean);
  // "Text" / "Frame 12" is not a repeated card. "_award-card 1" and "_award-card" are.
  return stems.length === slides.length && new Set(stems).size === 1 && !GENERIC.test(stems[0]);
}

function paginationNear(n, parent) {
  const inside = visibleKids(n).find(isPagination);
  if (inside) return inside;
  if (!parent) return null;
  const sibs = visibleKids(parent);
  const next = sibs[sibs.indexOf(n) + 1];
  if (isPagination(next)) return next;
  // a thin strip of dashes that is not named Pagination (the old signal)
  if (next?.box && n.box && next.box.h <= 16 && next.box.w <= n.box.w + 1 && next.box.absY >= n.box.absY + n.box.h - 1 && (next.svg || next.type === 'INSTANCE' || visibleKids(next).length >= 3)) return next;
  return null;
}

export function detectCarousels(tree) {
  const found = [];
  const menuRows = new Set(detectMenus(tree).map((m) => m.node));
  (function walk(n, parent) {
    if (n.visible === false) return;
    const kids = visibleKids(n);
    const named = NAME.test(n.name) || NAME.test(n.componentSet ?? '');
    if (!named && menuRows.has(n.id)) { kids.forEach((c) => walk(c, n)); return; }
    const controls = kids.filter((c) => isNavFrame(c) || isPagination(c) || NAV_FRAME.test(c.name ?? ''));
    const slides = kids.filter((c) => !controls.includes(c));
    const arrows = arrowPair(kids);
    const pag = paginationNear(n, parent);
    const pagInside = !!(pag && kids.includes(pag));
    const last = slides.at(-1);
    // A few pixels past the frame is a label sticking out, not the next slide.
    const overflow = !!(last?.box && n.box && last.box.x + last.box.w > n.box.w + 40);
    const row = n.layout?.mode === 'HORIZONTAL' && !n.layout.wrap && slides.length >= 3 && similar(slides) && (overflow || named || pag || arrows);
    // Mobile draws one card plus the same arrows. Two cards and arrows is still that slider.
    const oneRow = n.layout?.mode === 'HORIZONTAL' && !n.layout.wrap && arrows && slides.length >= 1 && slides.length < 3 && (slides.length === 1 || similar(slides));
    // one drawn slide + arrows, stacked (the image, then the arrow row). A pagination that is a child of this frame cannot stay beside the slider (every child becomes a slide), so that shape is left as drawn.
    const single = n.layout?.mode === 'VERTICAL' && slides.length === 1 && arrows && !pagInside;
    if (row || oneRow || single) {
      const signs = [overflow, named, !!pag, !!arrows].filter(Boolean).length;
      const navFrames = controls.filter((c) => NAV_FRAME.test(c.name ?? '') && !arrowSide(c)).map((c) => c.id);
      found.push({
        component: 'carousel', node: n.id, level: named ? 'E1' : 'E2', confidence: signs >= 2 ? 'high' : 'medium',
        cite: [
          { node: n.id, field: 'layout.mode', equals: n.layout.mode },
          ...(named ? [{ node: n.id, field: 'name' }] : []),
          ...(pag ? [{ node: pag.id, field: 'name' }] : []),
          ...(arrows ? [arrows.prev.props?.Position != null ? { node: arrows.prev.id, field: 'props.Position' } : { node: arrows.prev.id, field: 'name' }] : []),
        ],
        evidence: [
          `"${n.name}" ${single || slides.length < 2 ? 'shows one slide' : `is a row of ${slides.length} similar "${slides[0].name}" items`}`,
          overflow && `the row is ${Math.round(n.box.w)}px wide but its items end at ${Math.round(last.box.x + last.box.w)}px (cut off)`,
          named && 'the layer is named like a slider',
          pag && `pagination "${pag.name}" (${Math.round(pag.box.w)}×${Math.round(pag.box.h)})`,
          arrows && `arrows "${arrows.prev.name}" and "${arrows.next.name}"`,
        ].filter(Boolean).join('; '),
        params: {
          ...(pag && { pagination: pag.id }),
          ...(arrows && { prev: arrows.prev.id, next: arrows.next.id }),
          ...(navFrames.length && { controls: navFrames }),
          ...((single || (oneRow && slides.length < 2)) && { allowSingle: true }),
        },
        note: pag ? 'params.pagination was found by the Pagination layer: check it really is the pagination' : 'is there a pagination row? link it with params.pagination=<node id>',
      });
      return;
    }
    kids.forEach((c) => walk(c, n));
  })(tree, null);
  return found;
}
