// A pasted breakpoint frame that stays whole (its root is another kind than the desktop root, merge.mjs) is the
// layout of that screen. Its px are that screen's px, not desktop px, so the fit passes (solo.mjs), which read
// unkeyed values as desktop values and stack wide rows, skip it. The frame is shown only up to its breakpoint
// (merge.mjs writes the min-width display:none on its root).
//
// A row that frame draws past a clipping frame is the list the designer drew cut by the screen edge: it scrolls
// sideways instead of being cut (owner decision 2026-11-13, a clipped card row on the phone is a horizontal list).

const pxNum = (v) => (typeof v === 'string' && /^-?\d+(\.\d+)?px$/.test(v.trim()) ? parseFloat(v) : null);
const isRoot = (e) => e.parent === 0 || e.parent === '0';

// Takes the subtrees of the given roots out of template.content. restore() puts them back in their places.
export function setAsideFrames(template, rootIds) {
  const roots = new Set(rootIds.filter(Boolean));
  const order = new Map(template.content.map((e, i) => [e.id, i]));
  const kids = new Map();
  for (const e of template.content) {
    if (!kids.has(e.parent)) kids.set(e.parent, []);
    kids.get(e.parent).push(e);
  }
  const aside = new Set();
  const walk = (id) => { aside.add(id); for (const c of kids.get(id) ?? []) walk(c.id); };
  for (const e of template.content) if (roots.has(e.id) && isRoot(e)) walk(e.id);
  const kept = template.content.filter((e) => aside.has(e.id));
  template.content = template.content.filter((e) => !aside.has(e.id));
  return {
    elements: kept,
    restore() {
      template.content = [...template.content, ...kept].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity));
    },
  };
}

// Elements under root (any order in the list: a wrapper a component adds can come before its parent).
export function subtreeOf(elements, rootId) {
  const kids = new Map();
  for (const e of elements) {
    if (!kids.has(e.parent)) kids.set(e.parent, []);
    kids.get(e.parent).push(e);
  }
  const out = [];
  const walk = (e) => { out.push(e); for (const c of kids.get(e.id) ?? []) walk(c); };
  const root = elements.find((e) => e.id === rootId);
  if (root) walk(root);
  return out;
}

const spanOf = (s = {}) => pxNum(s._width) ?? pxNum(s._flexBasis) ?? pxNum(s._widthMin) ?? null;
const sidePad = (s = {}) => (pxNum(s._padding?.left) ?? 0) + (pxNum(s._padding?.right) ?? 0);

// Rows of one whole frame whose drawn items run past the frame inside a clip: overflow auto, items keep their width.
export function scrollClippedRows(elements, frameWidth) {
  if (!(frameWidth > 0)) return [];
  const byId = new Map(elements.map((e) => [e.id, e]));
  const kids = new Map();
  for (const e of elements) {
    if (!kids.has(e.parent)) kids.set(e.parent, []);
    kids.get(e.parent).push(e);
  }
  const rows = [];
  for (const e of elements) {
    const s = e.settings ?? {};
    if (s._direction !== 'row') continue;
    const items = (kids.get(e.id) ?? []).filter((c) => c.settings?._position !== 'absolute');
    if (items.length < 2) continue;
    const widths = items.map((c) => spanOf(c.settings));
    if (widths.some((w) => w == null)) continue;
    const gap = pxNum(s._columnGap) ?? 0;
    const drawn = widths.reduce((n, w) => n + w, 0) + gap * (items.length - 1) + sidePad(s);
    const clipped = s._overflow === 'hidden' || byId.get(e.parent)?.settings?._overflow === 'hidden';
    if (!clipped || drawn <= frameWidth) continue;
    s._overflow = 'auto';
    s._flexWrap = 'nowrap';
    // The list starts at its first item. A centred row past its box cuts the first item off out of reach.
    s._justifyContent = 'flex-start';
    for (const c of items) c.settings._flexShrink = 0;
    rows.push({ id: e.id, drawn });
  }
  return rows;
}
