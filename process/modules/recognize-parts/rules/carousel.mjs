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
// Pagination is the dash or dot row of a slider, not its own component.
// One card with that row on the same frame is the slider. The row is its pagination.
// A dash or dot row is one active mark and any number of idle marks of one size. Five items are four idle marks and one active mark. Two items are one idle mark and one active mark. The total is the slide count.
// A Figma component named Pagination counts the same, Dash or Dot. The switches that are on are the slide count.
// Three marks of one size are not that row. A short frame whose name merely contains "dash" is not evidence.
const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const sig = (n) => `${n.type}[${visibleKids(n).map(sig).join(',')}]`;
const NAME = /slider|carousel|swiper|slides?\b/i;
const PAGINATION = /^(pagination|dots|pager)$/i;
const NAV_FRAME = /^(navigation|arrows?|controls)$/i;
const stem = (name) => String(name ?? '').trim().toLowerCase().replace(/[\s._-]*\d+$/, '');
const GENERIC = /^(text|frame|group|rectangle|instance|container|image|vector|ellipse|line)$/;
import { detectMenus } from '../../recognize-parts/rules/menu.mjs';
import { paginationMarks } from '../../write-bricks/components/carousel.mjs';

const isPagination = (n) => !!(n && (PAGINATION.test(n.name ?? '') || PAGINATION.test(n.componentSet ?? '')));

// The cite is the component identity. A name that only contains "dash" or "dot" is not an identity.
function paginationCite(n) {
  if (!n) return null;
  if (PAGINATION.test(n.componentSet ?? '')) return { node: n.id, field: 'componentSet', equals: n.componentSet };
  if (PAGINATION.test(n.name ?? '')) return { node: n.id, field: 'name' };
  return null;
}

function solidPaint(n) {
  const f = (n.fills ?? []).find((x) => x.visible !== false && x.type === 'SOLID');
  return { hex: String(f?.hex ?? '').toLowerCase(), alpha: f?.opacity ?? f?.alpha ?? 1 };
}

function darkness(hex) {
  const h = hex.replace('#', '');
  if (h.length < 6) return 0;
  const n = Number.parseInt(h.slice(0, 6), 16);
  return 255 - (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255));
}

// One active mark (longer or darker) and any number of idle marks of one size. The total is the slide count.
// Three marks of one size are not this row. The layer name is not the evidence.
function markRow(n) {
  if (!n) return null;
  const marks = visibleKids(n).filter((c) => c.box && c.type !== 'TEXT' && !visibleKids(c).some((k) => k.type === 'TEXT'));
  if (marks.length < 2) return null;
  if (!marks.every((c) => {
    const short = Math.min(c.box.w, c.box.h);
    const long = Math.max(c.box.w, c.box.h);
    const dash = short <= 8 && long <= 40;
    const dot = long <= 16 && short >= 4 && (long - short) / long <= 0.25;
    return dash || dot;
  })) return null;
  const described = marks.map((c) => ({ c, long: Math.max(c.box.w, c.box.h), ...solidPaint(c) }));
  const same = (a, b) => Math.abs(a.long - b.long) / Math.max(a.long, 1) <= 0.25 && a.hex === b.hex && Math.abs(a.alpha - b.alpha) <= 0.05;
  const groups = [];
  for (const m of described) {
    const g = groups.find((row) => same(row[0], m));
    if (g) g.push(m);
    else groups.push([m]);
  }
  if (groups.length !== 2) return null;
  groups.sort((a, b) => b.length - a.length);
  const [idle, active] = groups;
  if (idle.length < 1 || active.length !== 1) return null;
  const on = active[0];
  const off = idle[0];
  const longer = on.long > off.long * 1.15;
  const darker = on.alpha > off.alpha + 0.15 || (on.hex !== off.hex && darkness(on.hex) > darkness(off.hex) + 20);
  if (!longer && !darker) return null;
  return { count: marks.length, active: on.c, idle: off.c };
}

// One svg of the dashes is the same row as child marks: one active stroke, longer or darker, and idle strokes of one style.
// Equal strokes are not a row. The layer name is not the evidence. The count is the slide count.
export function dashRowFromSvg(text) {
  const marks = text && paginationMarks(text);
  if (!marks || marks.items.length < 2) return null;
  const key = (m) => `${m.w}|${m.h}|${m.alpha}|${m.hex}`;
  const styles = new Set(marks.items.map(key));
  if (styles.size !== 2) return null;
  const idleKey = key(marks.idle);
  const active = marks.items.filter((m) => key(m) !== idleKey);
  if (active.length !== 1) return null;
  const on = active[0];
  const off = marks.idle;
  const longer = on.w > off.w * 1.15 || on.h > off.h * 1.15;
  const darker = on.alpha > off.alpha + 0.15 || (on.hex !== off.hex && darkness(on.hex) > darkness(off.hex) + 20);
  if (!longer && !darker) return null;
  return { count: marks.items.length };
}

function storedDashRow(n) {
  if (n?.svgMarks?.count >= 2) return { count: n.svgMarks.count };
  if (typeof n?.svgText === 'string') return dashRowFromSvg(n.svgText);
  return null;
}

// Drawn marks, the Dash / Dot switches that are on, or the same row exported as one svg. That number is the slide count.
function slideCount(n) {
  const drawn = n && markRow(n);
  if (drawn) return drawn.count;
  const props = n?.props ?? {};
  const on = Object.keys(props).filter((k) => /^(dash|dot)\s*\d+$/i.test(k) && props[k] === true);
  if (on.length) return on.length;
  return storedDashRow(n)?.count ?? null;
}

// The icon font is exported as an svg, so the glyph name is still on the text node. Only this button's own label counts:
// a navigation frame contains both arrows, and the first glyph inside it must not make the whole frame "prev".
// A filled chevron: the tip is the side whose points span less height than the open side.
export function chevronSide(svg) {
  if (!svg) return null;
  const filled = [...String(svg).matchAll(/<path\b([^>]*)\/?>/g)].map((m) => m[1])
    .filter((attrs) => /fill\s*=\s*["'](?!none)/i.test(attrs));
  const d = filled.map((attrs) => /d\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? '').join(' ');
  const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  if (pts.length < 3) return null;
  const xs = pts.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const w = maxX - minX;
  if (!(w > 0)) return null;
  const span = (list) => (list.length ? Math.max(...list) - Math.min(...list) : 0);
  const left = pts.filter((p) => p.x <= minX + w * 0.25).map((p) => p.y);
  const right = pts.filter((p) => p.x >= maxX - w * 0.25).map((p) => p.y);
  if (!left.length || !right.length) return null;
  if (span(left) < span(right) * 0.6) return 'prev';
  if (span(right) < span(left) * 0.6) return 'next';
  return null;
}

function arrowSide(n) {
  if (n?.arrow === 'prev' || n?.arrow === 'next') return n.arrow;
  const drawn = chevronSide(n?.svgText);
  if (drawn) return drawn;
  const pos = String(n?.props?.Position ?? '');
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

// The repeated card is one tree, however many times it is drawn. A fade rectangle has no children, so it is not a card.
function treeSig(n) {
  return `${n.type}[${visibleKids(n).map(treeSig).join(',')}]`;
}

function repeatedCards(nodes) {
  const groups = new Map();
  for (const n of nodes) {
    if (!visibleKids(n).length && n.type !== 'TEXT') continue;
    const key = treeSig(n);
    const list = groups.get(key) ?? [];
    list.push(n);
    groups.set(key, list);
  }
  let best = [];
  for (const list of groups.values()) if (list.length > best.length) best = list;
  return best.length >= 2 ? best : [];
}

// The card is partly outside a clipped row. One pixel is the same tolerance the box check already uses.
function crosses(frame, child) {
  if (!frame?.box || !child?.box) return false;
  return child.box.x < -1 || child.box.x + child.box.w > frame.box.w + 1;
}

function iconButton(n) {
  if (arrowSide(n)) return true;
  if (/icon\s*btn\s*=\s*yes/i.test(`${n.component ?? ''} ${n.componentSet ?? ''}`)) return true;
  const hasText = [n, ...visibleKids(n)].some((c) => c.type === 'TEXT' && String(c.text?.characters ?? '').trim());
  return !!(n.svg || n.svgText) && !hasText;
}

// Two icon buttons in their own row, left then right. They may sit above or below the cards.
function iconPair(frame) {
  if (frame?.layout?.mode !== 'HORIZONTAL') return null;
  const kids = visibleKids(frame);
  if (kids.length !== 2 || !kids.every(iconButton)) return null;
  const key = (n) => n.componentSet || n.component || stem(n.name);
  if (key(kids[0]) && key(kids[0]) !== key(kids[1]) && !(arrowSide(kids[0]) && arrowSide(kids[1]))) return null;
  const sides = kids.map(arrowSide);
  if (sides.includes('prev') && sides.includes('next')) {
    return { prev: kids[sides.indexOf('prev')], next: kids[sides.indexOf('next')] };
  }
  const [prev, next] = [...kids].sort((a, b) => (a.box?.x ?? 0) - (b.box?.x ?? 0));
  return { prev, next };
}

function isDashRow(n) {
  if (!n) return false;
  return !!(markRow(n) || storedDashRow(n));
}

function realPagination(n) {
  if (!n) return false;
  if (PAGINATION.test(n.componentSet ?? '')) return true;
  return !!slideCount(n);
}

function tailControl(frame, pag) {
  const kids = visibleKids(frame);
  const at = kids.indexOf(pag);
  if (at < 0) return false;
  return kids.slice(at + 1).every((c) => isPagination(c) || isDashRow(c) || isNavFrame(c));
}

function paginationNear(n, parent) {
  const inside = visibleKids(n).find((c) => isPagination(c) || isDashRow(c));
  if (inside) return inside;
  if (!parent) return null;
  const sibs = visibleKids(parent);
  const next = sibs[sibs.indexOf(n) + 1];
  if (isPagination(next)) return next;
  if (isDashRow(next)) return next;
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
    const controls = kids.filter((c) => isNavFrame(c) || isPagination(c) || isDashRow(c) || NAV_FRAME.test(c.name ?? ''));
    const slides = kids.filter((c) => !controls.includes(c));
    const cards = repeatedCards(slides);
    const arrows = arrowPair(kids);
    // A clipped row hides the next cards on purpose. A card outside that row is the rest of the set.
    const peek = n.clip === true && cards.some((c) => crosses(n, c));
    const pag = paginationNear(n, parent);
    const pagInside = !!(pag && kids.includes(pag));
    const last = slides.at(-1);
    // A few pixels past the frame is a label sticking out, not the next slide.
    const overflow = !!(last?.box && n.box && last.box.x + last.box.w > n.box.w + 40);
    // The row itself may be "Frame 12". The repeated child component "Slider Item …" is the slider.
    const slideNamed = slides.length >= 2 && slides.every((s) => NAME.test(`${s.componentSet ?? ''} ${s.component ?? ''}`));
    const onlyArrows = slides.length > 0 && slides.every((s) => iconButton(s));
    const row = n.layout?.mode === 'HORIZONTAL' && !n.layout.wrap && !onlyArrows && (
      (slides.length >= 3 && similar(slides) && (overflow || named || pag || arrows || slideNamed))
      || peek
    );
    // Mobile draws one card plus the same arrows. Two cards and arrows is still that slider.
    const oneRow = n.layout?.mode === 'HORIZONTAL' && !n.layout.wrap && !onlyArrows && arrows && slides.length >= 1 && slides.length < 3 && (slides.length === 1 || similar(slides));
    // one drawn slide + arrows, stacked (the image, then the arrow row).
    const single = n.layout?.mode === 'VERTICAL' && slides.length === 1 && arrows && !pagInside;
    // One or two drawn slides, and the dash or dot row of that frame. The row is the last child, or the next sibling when a column places it under the frame. A column that still has another section after the row does not own it.
    const namedPag = !!(pag && isPagination(pag));
    const inner = slides.length === 1 ? visibleKids(slides[0]).filter((c) => !isPagination(c) && !isNavFrame(c)) : [];
    const innerRow = slides.length === 1 && slides[0].layout?.mode === 'HORIZONTAL' && inner.length >= 3;
    const pagTail = pagInside && tailControl(n, pag) && realPagination(pag);
    const pagSibling = !!(pag && !pagInside && realPagination(pag));
    const holdsRealRow = slides.some((s) => s.layout?.mode === 'HORIZONTAL' && visibleKids(s).filter((c) => !isPagination(c) && !isNavFrame(c)).length >= 3);
    const paged = slides.length >= 1 && slides.length < 3 && (pagTail || pagSibling) && !arrows && !innerRow && !holdsRealRow;
    if (row || oneRow || single || paged) {
      const onlyPaged = paged && !row && !oneRow && !single;
      const signs = [overflow, named, !!pag, !!arrows, peek].filter(Boolean).length;
      const shown = peek && !similar(slides) ? cards : slides;
      const navFrames = controls.filter((c) => NAV_FRAME.test(c.name ?? '') && !arrowSide(c)).map((c) => c.id);
      found.push({
        component: 'carousel', node: n.id, level: named ? 'E1' : 'E2', confidence: onlyPaged ? 'medium' : (signs >= 2 ? 'high' : 'medium'),
        cite: [
          { node: n.id, field: 'layout.mode', equals: n.layout.mode },
          ...(peek ? [{ node: n.id, field: 'clip', equals: true }] : []),
          ...(named ? [{ node: n.id, field: 'name' }] : []),
          ...(paginationCite(pag) ? [paginationCite(pag)] : []),
          ...(arrows ? [arrows.prev.props?.Position != null ? { node: arrows.prev.id, field: 'props.Position' } : { node: arrows.prev.id, field: 'name' }] : []),
        ],
        evidence: [
          `"${n.name}" ${single || shown.length < 2 ? 'shows one slide' : `is a row of ${shown.length} similar "${shown[0].name}" items`}`,
          overflow && `the row is ${Math.round(n.box.w)}px wide but its items end at ${Math.round(last.box.x + last.box.w)}px (cut off)`,
          peek && 'the frame clips and one of those cards sits outside it',
          named && 'the layer is named like a slider',
          pag && `pagination "${pag.componentSet || pag.name}" (${Math.round(pag.box.w)}×${Math.round(pag.box.h)})`,
          onlyPaged && `${slides.length} drawn ${slides.length === 1 ? 'slide' : 'slides'} plus this ${pag.props?.Type || 'dash or dot'} row is the slider`,
          arrows && `arrows "${arrows.prev.name}" and "${arrows.next.name}"`,
          slideNamed && 'each item belongs to a Slider component',
        ].filter(Boolean).join('; '),
        params: {
          ...(pag && { pagination: pag.id }),
          ...(pag && slideCount(pag) && { itemCount: slideCount(pag) }),
          ...(arrows && { prev: arrows.prev.id, next: arrows.next.id }),
          ...(navFrames.length && { controls: navFrames }),
          ...((single || (oneRow && slides.length < 2) || (onlyPaged && slides.length < 2)) && { allowSingle: true }),
        },
        note: pag ? 'params.pagination was found by the Pagination layer: check it really is the pagination' : 'is there a pagination row? link it with params.pagination=<node id>',
      });
      return;
    }
    kids.forEach((c) => walk(c, n));
  })(tree, null);
  // One icon pair belongs to the carousel above it, or the one below when that is the only neighbor.
  const byNode = new Map(found.filter((c) => c.component === 'carousel').map((c) => [c.node, c]));
  (function claim(n) {
    if (n?.layout?.mode === 'VERTICAL') {
      const kids = visibleKids(n);
      kids.forEach((child, i) => {
        const pair = iconPair(child);
        const owner = pair && (byNode.get(kids[i - 1]?.id) || byNode.get(kids[i + 1]?.id));
        if (!owner || owner.params.prev || owner.params.next) return;
        owner.params.prev = pair.prev.id;
        owner.params.next = pair.next.id;
        owner.confidence = 'high';
        owner.cite.push({ node: pair.prev.id, field: 'name' }, { node: pair.next.id, field: 'name' });
        owner.evidence += `; arrows "${pair.prev.name}" and "${pair.next.name}"`;
      });
    }
    visibleKids(n).forEach(claim);
  })(tree);
  const used = new Set(found.map((c) => c.params?.pagination).filter(Boolean));
  const sliders = new Set(found.filter((c) => c.component === 'carousel' && c.confidence !== 'low').map((c) => c.node));
  (function stray(n, inSlider) {
    if (!n || n.visible === false) return;
    const host = inSlider || sliders.has(n.id);
    const cite = paginationCite(n);
    const drawn = markRow(n);
    const marks = drawn || storedDashRow(n);
    if (!host && !used.has(n.id) && (cite || marks)) {
      found.push({
        component: 'pagination_carousel',
        node: n.id,
        level: 'E2',
        confidence: 'low',
        cite: cite ? [cite] : drawn
          ? [{ node: drawn.active.id, field: 'type', equals: drawn.active.type }]
          : [{ node: n.id, field: 'svg' }],
        evidence: cite
          ? `component "${n.componentSet || n.name}" is the slider dash row, not its own component, so the plan asks`
          : `"${n.name}" has one active mark and ${marks.count - 1} thinner marks (${marks.count} items) and is not on a slider, so the plan asks`,
        params: { hold: true, of: 'carousel', ...(marks && { itemCount: marks.count }) },
        note: null,
      });
      return;
    }
    visibleKids(n).forEach((c) => stray(c, host));
  })(tree, false);
  return found;
}
