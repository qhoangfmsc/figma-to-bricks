// COMPONENT accordion (basic): a list of items, each = a title row + a content block (the closed items often have their content hidden).
// Bricks 1.9.8: `accordion-nested`. Its script needs two class names on each item's children: accordion-title-wrapper and
// accordion-content-wrapper (set through the hidden `_hidden._cssClasses`, like the element's own template does).
//   source: includes/elements/accordion-nested.php (get_nestable_item)
// BASIC: structure only. An item whose content is hidden in Figma gets an EMPTY content block (never invented text) and a warning.
// `expandFirstItem` is on when the first item's content is visible in Figma. Icons do not rotate.
// A variant State is a state of the same item, not a different item: Hover paint is :hover, Expand paint and the
// open glyph (minus against a closed plus) swap with .brx-open. A strict majority icon is shared only when it is
// not that open/closed pair. The Plan (`params.sync`, blank = share) can turn each part off.
// params: independent (default true: items open and close without closing the others, Bricks `independentToggle`) ·
//         content.answers { itemNodeId: text } (what the owner typed in the Plan for an item Figma draws closed: the new content block takes the
//         settings of the drawn open item's content, the text takes the typography of its text; without a drawn open item it keeps Bricks defaults).
import { px, cssColor } from '../../write-bricks/render/utils/css.mjs';
import { visibleKids, hidden, firstText, svgNode, ZERO, flexDirectionCss } from '../../write-bricks/components/helpers.mjs';
import { ComponentState, componentState } from '../../write-bricks/components/states.mjs';

// The theme gives the title row `padding: 15px 0; margin-bottom: -1px` and the content `padding: 0 0 15px` (frontend.min.css): not Figma values. Every row and content
// block starts from zero; a padding or margin the Figma frame has is written by the build and wins over these defaults.
// A content block's own `display` (flex, from the Figma auto layout) is an id selector in the compiled css and beats the theme's `.accordion-content-wrapper { display: none }`:
// the block could never close. The display is given back only while the item is open (`.brx-open`), through the css of the item.
const displayOf = (c) => (['HORIZONTAL', 'VERTICAL'].includes(c?.layout?.mode) ? 'flex' : c?.layout?.mode === 'GRID' ? 'grid' : null);
const openCss = (c) => (displayOf(c) ? [{ decl: `display: ${displayOf(c)};`, suffix: '.brx-open > .accordion-content-wrapper' }] : []);
const THEME_RESET = { defaults: { _padding: { ...ZERO }, _margin: { ...ZERO } } };
// Title look. The closed rule beats the text's own id selector; the open rule beats the closed one.
// Bricks adds `brx-open` only after the height animation, so a difference that must hold for the whole animation cannot wait for that class.
const TITLE = ' .accordion-title-wrapper :is(.brxe-text-basic, .brxe-heading)';
const OPEN_TITLE = `.brx-open${TITLE}`;
const titleDecl = (textNode) => {
  if (!textNode?.text) return '';
  const t = textNode.text;
  const fill = (textNode.fills ?? []).filter((f) => f.type === 'SOLID').at(-1);
  return [
    fill && `color: ${cssColor(fill)};`,
    t.fontFamily && `font-family: "${t.fontFamily}";`,
    t.fontSize != null && `font-size: ${px(t.fontSize)};`,
    t.fontWeight != null && `font-weight: ${t.fontWeight};`,
    t.lineHeightPx != null && `line-height: ${px(t.lineHeightPx)};`,
  ].filter(Boolean).join(' ');
};
const glyphOf = (icon) => icon?.text?.characters || icon?.name || '';
const toggleIcon = (item) => svgNode(visibleKids(item)[0] ?? item);
const solidFill = (n) => (n?.fills ?? []).filter((f) => f.type === 'SOLID').at(-1) ?? null;
const fillKey = (f) => (f ? `${f.hex}:${f.alpha ?? 1}` : '');
// Named State comes from the shared enum. A row with no State still counts as open when its answer is drawn.
const itemState = (item) => {
  const declared = componentState(item);
  if (declared === ComponentState.HOVER || declared === ComponentState.OPEN || declared === ComponentState.REST) return declared;
  return visibleKids(item).length >= 2 ? ComponentState.OPEN : ComponentState.REST;
};
const iconPlace = (item) => {
  const title = visibleKids(item)[0] ?? item;
  const walk = (n, parent) => {
    if (!n || n.visible === false) return null;
    if (n.svg?.file) return { icon: n, host: parent ?? title };
    for (const c of n.children ?? []) { const hit = walk(c, n); if (hit) return hit; }
    return null;
  };
  return walk(title, null);
};
export const SyncChoice = { ALL: 'all', UNCHANGED: 'unchanged', TEXT: 'text', NO_ICON: 'no-icon' };

// The chat already chose one of these. A sentence is not a choice.
export function readSync(choice) {
  switch (choice) {
    case undefined:
    case null:
    case '':
    case SyncChoice.ALL:
      return { ok: true, icon: true, title: true, gap: true };
    case SyncChoice.UNCHANGED:
      return { ok: true, icon: false, title: false, gap: false };
    case SyncChoice.TEXT:
      return { ok: true, icon: false, title: true, gap: false };
    case SyncChoice.NO_ICON:
      return { ok: true, icon: false, title: true, gap: true };
    default:
      return { ok: false, why: 'choice must be all, unchanged, text, or no-icon' };
  }
}

// What the items do not share, in the words the Plan shows. Empty = nothing to ask, the build still shares whatever is already the same.
export function syncNotes(node) {
  const items = visibleKids(node);
  const notes = [];
  const placed = items.map((item) => ({ item, place: iconPlace(item) })).filter((row) => row.place?.icon?.svg?.file);
  const openGlyph = glyphOf(placed.find((row) => itemState(row.item) === 'open')?.place.icon);
  const closedGlyph = glyphOf(placed.find((row) => itemState(row.item) !== 'open')?.place.icon);
  if (openGlyph && closedGlyph && openGlyph !== closedGlyph) notes.push(`icon mở «${openGlyph}», icon đóng «${closedGlyph}»`);
  else {
    const icons = placed.map((row) => row.place.icon);
    const ranked = [...icons.reduce((m, icon) => m.set(glyphOf(icon), (m.get(glyphOf(icon)) ?? 0) + 1), new Map()).entries()].sort((a, b) => b[1] - a[1]);
    const [glyph, count] = ranked[0] ?? [];
    if (glyph && count * 2 > icons.length && count < icons.length) notes.push(`${count}/${icons.length} mục dùng icon «${glyph}»`);
  }
  const restItem = items.find((i) => itemState(i) === 'rest');
  const hoverItem = items.find((i) => itemState(i) === 'hover');
  const hoverFill = solidFill(hoverItem);
  if (hoverFill && fillKey(hoverFill) !== fillKey(solidFill(restItem))) notes.push(`nền khi rê chuột ${cssColor(hoverFill)}`);
  const openItem = items.find((i) => visibleKids(i).length === 2);
  const closedItem = items.find((i) => visibleKids(i).length < 2);
  const active = titleDecl(openItem && firstText(visibleKids(openItem)[0]));
  const closed = titleDecl(closedItem && firstText(visibleKids(closedItem)[0]));
  if (active && closed && active !== closed) notes.push('mục đang mở có chữ khác các mục đóng');
  if (openItem?.layout && closedItem?.layout && openItem.layout.gap != null && closedItem.layout.gap != null && openItem.layout.gap !== closedItem.layout.gap) notes.push(`khoảng cách mục đóng ${closedItem.layout.gap}px, mục mở ${openItem.layout.gap}px`);
  return notes;
}

// Text Figma drew for this item besides the question, including a description frame the collapsed variant hides.
export function drawnAnswer(item) {
  const titleNode = visibleKids(item)[0];
  const title = (firstText(titleNode)?.text?.characters ?? '').replace(/\s+/g, ' ').trim();
  const texts = [];
  const walk = (n) => {
    if (!n || n.visible === false) return;
    if (n.type === 'TEXT' && !n.svg && n.text?.characters?.trim()) {
      const raw = n.text.characters.replace(/\r\n/g, '\n').trim();
      if (raw.replace(/\s+/g, ' ').trim() !== title) texts.push(raw);
      return;
    }
    for (const c of n.children ?? []) walk(c);
  };
  for (const c of item.children ?? []) if (c !== titleNode) walk(c);
  return texts.join('\n\n');
}

// the items Figma draws closed (title only), with their question text: what the Plan asks answers for
export function closedItems(node) {
  return visibleKids(node).filter((i) => visibleKids(i).length === 1).map((i) => ({ item: i, question: firstText(visibleKids(i)[0])?.text.characters.replace(/\s+/g, ' ').trim() ?? i.name }));
}

export default {
  id: 'accordion',
  status: 'implemented',
  label: 'Accordion (basic)',
  figma: 'a container of >= 2 items, each with a title row and (when open) a content block',
  bricks: '`accordion-nested`; items stay blocks, title / content blocks get the accordion-* classes',
  limits: 'the answers of closed items are not in Figma: they come from the Plan, a blank one is an empty content block (Bricks hides it) + warning; no chevron animation; Hover paint is :hover and Expand paint is .brx-open; a closed plus and an open minus swap with .brx-open; an icon a strict majority shares replaces the rest only when it is not that open/closed pair',
  kind: () => 'accordion-nested',

  check(node, det) {
    const items = visibleKids(node);
    if (items.length < 2) return { ok: false, reason: `needs at least 2 items, found ${items.length}` };
    const bad = items.find((i) => visibleKids(i).length < 1 || visibleKids(i).length > 2);
    if (bad) return { ok: false, reason: `item "${bad.name}" (${bad.id}) must have a title and at most one content block, it has ${visibleKids(bad).length} visible children` };
    const warnings = items.filter((i) => visibleKids(i).length === 1 && !det?.params?.content?.answers?.[i.id]).map((i) => `item "${i.name}" has no visible content in Figma and no answer in the Plan: an empty content block is created`);
    return { ok: true, warnings };
  },

  descendants(node, det) {
    const out = {};
    const items = visibleKids(node);
    const open = items.findIndex((i) => visibleKids(i).length === 2);
    const openItem = open >= 0 ? items[open] : null;
    const openGap = openItem?.layout?.gap ?? 0;
    const drawn = openItem ? visibleKids(openItem)[1] : null; // the content block of an item Figma draws open: the look of every answer
    const drawnText = drawn && firstText(drawn);
    const choice = readSync(det.params?.sync);
    const sync = choice.ok ? choice : { icon: true, title: true, gap: true };
    const activeDecl = titleDecl(openItem && firstText(visibleKids(openItem)[0]));
    const closedItem = items.find((i) => visibleKids(i).length < 2);
    const closedDecl = titleDecl(closedItem && firstText(visibleKids(closedItem)[0]));
    // Closed is the base. Open replaces it only while .brx-open, so shutting the item that Figma drew open returns to the same text as the others.
    const stateCss = sync.title && activeDecl && closedDecl && activeDecl !== closedDecl
      ? [{ decl: closedDecl, suffix: TITLE }, { decl: activeDecl, suffix: OPEN_TITLE }]
      : [];
    // The gap that sits between a title and an answer is the one on the item Figma draws with both (the expand variant: 0).
    // A collapsed item still stores its component itemSpacing (this FAQ: 124) with only the title drawn. Bricks shows the answer and
    // measures its height before it adds .brx-open, so that spacing would flash as a hole for the whole animation. Every item uses the expand gap.
    const targetGap = openItem ? openGap : 0;
    const gapPatch = (item) => {
      const layout = item.layout;
      if (!layout || layout.gap == null || layout.gap === targetGap) return {};
      if (openItem && layout.mode !== openItem.layout?.mode) return {};
      const horizontal = layout.mode === 'HORIZONTAL';
      return {
        settings: { [horizontal ? '_columnGap' : '_rowGap']: px(targetGap) },
        expectCss: { [horizontal ? 'column-gap' : 'row-gap']: px(targetGap) },
      };
    };
    const withGap = (item, patch) => {
      if (!sync.gap) return patch;
      const g = gapPatch(item);
      return { ...patch, ...(g.settings && { settings: { ...(patch.settings ?? {}), ...g.settings } }), ...(g.expectCss && { expectCss: { ...(patch.expectCss ?? {}), ...g.expectCss } }) };
    };
    for (const item of items) {
      const [title, content] = visibleKids(item);
      out[title.id] = { settings: hidden('accordion-title-wrapper'), ...THEME_RESET };
      if (content) {
        out[content.id] = { settings: hidden('accordion-content-wrapper'), ...THEME_RESET, ...(displayOf(content) && { dropSettings: ['_display'] }) };
        out[item.id] = withGap(item, { css: [...openCss(content), ...stateCss] });
      } else {
        const answer = det.params?.content?.answers?.[item.id];
        out[item.id] = withGap(item, {
          css: [...(answer ? openCss(drawn) : []), ...stateCss],
          extraChildren: [answer
            ? { name: 'block', label: 'Content', settings: { ...hidden('accordion-content-wrapper'), ...(!drawn && { _padding: { ...ZERO } }) }, ...(drawn && { like: drawn.id, drop: ['_display'] }), children: [{ name: 'text-basic', label: 'Answer', settings: {}, ...(drawnText && { like: drawnText.id }), text: answer }] }
            : { name: 'block', label: 'Content (empty: not in Figma)', settings: { ...hidden('accordion-content-wrapper'), _padding: { ...ZERO } } }],
        });
      }
    }
    const placed = items.map((item) => ({ item, place: iconPlace(item) })).filter((row) => row.place?.icon?.svg?.file);
    const openRow = placed.find((row) => itemState(row.item) === 'open');
    const closedRow = placed.find((row) => itemState(row.item) !== 'open');
    const openGlyph = glyphOf(openRow?.place.icon);
    const closedGlyph = glyphOf(closedRow?.place.icon);
    const stateIcons = sync.icon && openGlyph && closedGlyph && openGlyph !== closedGlyph;
    const restItem = items.find((i) => itemState(i) === 'rest');
    const hoverItem = items.find((i) => itemState(i) === 'hover');
    const hoverFill = solidFill(hoverItem);
    const openFill = solidFill(openRow?.item);
    const hoverPaint = sync.title && hoverFill && fillKey(hoverFill) !== fillKey(solidFill(restItem));
    const openPaint = sync.title && openFill && fillKey(openFill) !== fillKey(solidFill(restItem));
    const hoverTitle = titleDecl(hoverItem && firstText(visibleKids(hoverItem)[0]));
    const restTitle = titleDecl(restItem && firstText(visibleKids(restItem)[0]));
    const paintCss = [
      ...(hoverPaint ? [{ decl: `background-color: ${cssColor(hoverFill)};`, suffix: ':hover' }] : []),
      ...(openPaint ? [{ decl: `background-color: ${cssColor(openFill)};`, suffix: '.brx-open' }] : []),
      ...(sync.title && hoverTitle && restTitle && hoverTitle !== restTitle ? [{ decl: hoverTitle, suffix: `:hover${TITLE}` }] : []),
    ];
    if (paintCss.length || stateIcons) {
      const iconCss = stateIcons ? [
        { decl: 'display: none !important;', suffix: ' .acc-icon-open' },
        { decl: 'display: block !important;', suffix: '.brx-open .acc-icon-open' },
        { decl: 'display: block !important;', suffix: ' .acc-icon-closed' },
        { decl: 'display: none !important;', suffix: '.brx-open .acc-icon-closed' },
      ] : [];
      for (const item of items) {
        const prev = out[item.id] ?? {};
        out[item.id] = { ...prev, css: [...(prev.css ?? []), ...paintCss, ...iconCss] };
      }
    }
    if (hoverPaint) {
      for (const item of items.filter((i) => itemState(i) === 'hover' && fillKey(solidFill(i)) === fillKey(hoverFill))) {
        const prev = out[item.id] ?? {};
        out[item.id] = { ...prev, dropSettings: [...(prev.dropSettings ?? []), '_background'], expectCss: { ...(prev.expectCss ?? {}), 'background-color': 'rgba(0, 0, 0, 0)' } };
      }
    }
    if (openPaint) {
      for (const item of items.filter((i) => itemState(i) === 'open' && fillKey(solidFill(i)) === fillKey(openFill))) {
        const prev = out[item.id] ?? {};
        const showing = open >= 0 && item.id === items[open].id;
        out[item.id] = { ...prev, dropSettings: [...(prev.dropSettings ?? []), '_background'], expectCss: { ...(prev.expectCss ?? {}), 'background-color': showing ? cssColor(openFill) : 'rgba(0, 0, 0, 0)' } };
      }
    }
    if (stateIcons) {
      for (const row of placed) {
        const glyph = glyphOf(row.place.icon);
        const role = glyph === openGlyph ? 'acc-icon-open' : 'acc-icon-closed';
        const prev = out[row.place.icon.id] ?? {};
        out[row.place.icon.id] = { ...prev, settings: { ...(prev.settings ?? {}), _cssClasses: [prev.settings?._cssClasses, role].filter(Boolean).join(' ') } };
        const other = glyph === openGlyph ? closedRow.place.icon : openRow.place.icon;
        const host = out[row.place.host.id] ?? {};
        out[row.place.host.id] = {
          ...host,
          extraChildren: [...(host.extraChildren ?? []), {
            name: 'svg',
            label: glyph === openGlyph ? 'Closed icon' : 'Open icon',
            like: other.id,
            settings: { _cssClasses: glyph === openGlyph ? 'acc-icon-closed' : 'acc-icon-open' },
          }],
        };
      }
    } else if (sync.icon) {
      const icons = placed.map((row) => row.place.icon);
      const counts = new Map();
      for (const icon of icons) counts.set(glyphOf(icon), (counts.get(glyphOf(icon)) ?? 0) + 1);
      const [commonGlyph, commonCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
      if (commonGlyph && commonCount * 2 > icons.length) {
        const source = icons.find((icon) => glyphOf(icon) === commonGlyph);
        for (const icon of icons) {
          if (glyphOf(icon) === commonGlyph) continue;
          const prev = out[icon.id] ?? {};
          out[icon.id] = { ...prev, settings: { ...(prev.settings ?? {}), file: { $asset: source.svg.file, size: 'full' } } };
        }
      }
    }
    // the item drawn open: the first one -> expandFirstItem, any other -> its own `brx-open` class (the class Bricks' script toggles)
    if (open > 0) {
      const prev = out[items[open].id] ?? {};
      out[items[open].id] = { ...prev, settings: { ...(prev.settings ?? {}), _cssClasses: 'brx-open' } };
    }
    out[node.id] = { settings: { ...(open === 0 && { expandFirstItem: true }), ...(det.params?.independent !== false && { independentToggle: true }) }, css: flexDirectionCss(node) };
    return out;
  },
};
