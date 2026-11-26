// Two cases that sit BESIDE the default stacking rules (solo.mjs). They do not change what the default does for any other row.
// Both read what is already in the template (settings and css). No layer name, no number from one file.

const escapeId = (id) => String(id).replace(/[^\w-]/g, '');

// A row the phone frame drew as a wrapping row keeps that layout wherever the phone layout holds (owner rule: a tablet with no frame of its
// own is the phone). The default stack rule (`body #id { flex-direction: column }` inside a band) would turn that row into a column, so
// it is taken out for this row. The wrap that the phone frame drew then lays the cards out.
export function keepPhoneWrap(template, { keep = [] } = {}) {
  if (!keep.includes('mobile_portrait')) return template;
  for (const e of template.content ?? []) {
    const s = e.settings;
    if (!s || s['_flexWrap:mobile_portrait'] !== 'wrap' || !s._cssCustom) continue;
    const id = escapeId(e.id);
    const column = new RegExp(`@media[^{}]*\\{\\s*body #brxe-${id} \\{[^{}]*flex-direction: column[^{}]*\\}\\s*\\}`, 'g');
    s._cssCustom = String(s._cssCustom).replace(column, '').replace(/\s{2,}/g, ' ').trim();
    if (!s._cssCustom) delete s._cssCustom;
  }
  return template;
}

const px = (v) => {
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(String(v ?? '').trim());
  return m ? Number(m[1]) : null;
};

// In a column, flex-basis is a height and a child with `_width: auto` collapses to nothing, so what hangs off it (a card with a left
// offset) lands outside the window. When a row is stacked by the default rule, a child that sizes itself by a px flex-basis gets that px
// as its width in the same band, never wider than its parent. The basis stays as it was.
export function pinStackedBasis(template) {
  const byId = new Map((template.content ?? []).map((e) => [e.id, e]));
  for (const row of template.content ?? []) {
    const css = String(row.settings?._cssCustom ?? '');
    const stack = new RegExp(`(@media[^{}]*)\\{\\s*body #brxe-${escapeId(row.id)} \\{[^{}]*flex-direction: column`, 'g');
    const queries = [...css.matchAll(stack)].map((m) => m[1].trim());
    if (!queries.length) continue;
    // A stretched column already gives each child the full width. Only a column that centers or aligns its children collapses them.
    const align = row.settings?._alignItems;
    if (!align || align === 'stretch' || align === 'normal') continue;
    for (const child of (template.content ?? []).filter((c) => c.parent === row.id)) {
      const cs = child.settings ?? {};
      if (cs._position === 'absolute' || cs._display === 'none') continue;
      const basis = px(cs._flexBasis);
      const widthPx = px(cs._width);
      if (basis == null || basis < 160 || widthPx != null) continue; // a drawn px width already holds the card
      const mark = `pin-basis-${escapeId(row.id)}`;
      if (String(cs._cssCustom ?? '').includes(mark)) continue;
      const rules = queries.map((q) => `${q} { #brxe-${escapeId(child.id)} { width: 100%; max-width: ${basis}px; flex-basis: auto; } }`).join(' ');
      cs._cssCustom = [cs._cssCustom, `/* ${mark} */ ${rules}`].filter(Boolean).join(' ');
      child.settings = cs;
    }
  }
  return template;
}

// A phone frame that wraps equal cards so that they fill its row (2 cards of 163.5px with a 16px gap fill 343px) drew a grid of N columns.
// Where the phone layout holds on a wider screen (a tablet with no frame of its own), the cards keep that N columns by taking an equal share
// of the row instead of the phone's fixed px width. N comes from the phone frame's own row width (`phoneRow`: Bricks id -> width in px).
export function keepPhoneColumns(template, { keep = [], phoneRow = new Map() } = {}) {
  if (!keep.includes('mobile_portrait') || keep.includes('tablet_portrait')) return template;
  const query = '@media (max-width: 991px) and (min-width: 479px)';
  for (const row of template.content ?? []) {
    const s = row.settings;
    if (!s || s['_flexWrap:mobile_portrait'] !== 'wrap') continue;
    const rowWidth = Number(phoneRow.get(row.id));
    if (!(rowWidth > 0)) continue;
    const gap = px(s['_columnGap:mobile_portrait']) ?? px(s._columnGap) ?? 0;
    const cards = (template.content ?? []).filter((c) => c.parent === row.id && c.settings?._position !== 'absolute' && c.settings?._display !== 'none');
    const widths = cards.map((c) => px(c.settings?.['_width:mobile_portrait']));
    if (cards.length < 2 || widths.some((w) => w == null) || Math.max(...widths) - Math.min(...widths) > 1) continue;
    const n = Math.round((rowWidth + gap) / (widths[0] + gap));
    if (n < 2 || Math.abs(n * widths[0] + (n - 1) * gap - rowWidth) > 1) continue; // the cards do not fill the phone row evenly: not a grid
    const share = `calc((100% - ${(n - 1) * gap}px) / ${n})`;
    for (const card of cards) {
      const mark = `phone-columns-${escapeId(card.id)}`;
      if (String(card.settings._cssCustom ?? '').includes(mark)) continue;
      card.settings._cssCustom = [card.settings._cssCustom, `/* ${mark} */ ${query} { body #brxe-${escapeId(card.id)} { width: ${share}; flex-basis: auto; flex-grow: 0; } }`].filter(Boolean).join(' ');
    }
  }
  return template;
}

// FILL means "share what is left". The build writes it as grow 1 with the measured px as flex-basis, because every step before this one
// reads that px as the drawn size. As the very last step the desktop value becomes basis 0: the same width at the frame it was drawn in
// (nothing is left over), and fluid at every other width. Only a flex row whose own width is not hugging: a hugging parent takes its
// size from this child. A stacked row's children get `flex-basis: auto` in pinStackedBasis, so a column keeps its height.
export function fluidFill(template) {
  const byId = new Map((template.content ?? []).map((e) => [e.id, e]));
  for (const e of template.content ?? []) {
    const s = e.settings;
    if (!s || Number(s._flexGrow) !== 1 || px(s._flexBasis) == null) continue;
    const parent = byId.get(e.parent)?.settings;
    if (!parent || parent._direction !== 'row') continue;
    if (!parent._width || parent._width === 'auto') continue; // a hugging parent needs the px
    s._flexBasis = '0px';
  }
  return template;
}
