// COMPONENT accordion (basic): a list of items, each = a title row + a content block (the closed items often have their content hidden).
// Bricks 1.9.8: `accordion-nested`. Its script needs two class names on each item's children: accordion-title-wrapper and
// accordion-content-wrapper (set through the hidden `_hidden._cssClasses`, like the element's own template does).
//   source: includes/elements/accordion-nested.php (get_nestable_item)
// BASIC: structure only. An item whose content is hidden in Figma gets an EMPTY content block (never invented text) and a warning.
// `expandFirstItem` is on when the first item's content is visible in Figma. Icons do not rotate. A strict majority icon,
// the closed title and the expand gap are shared by every item unless the Plan says otherwise (`params.sync`, blank = share).
// params: independent (default true: items open and close without closing the others, Bricks `independentToggle`) ·
//         content.answers { itemNodeId: text } (what the owner typed in the Plan for an item Figma draws closed: the new content block takes the
//         settings of the drawn open item's content, the text takes the typography of its text; without a drawn open item it keeps Bricks defaults).
import { px, cssColor } from '../../write-bricks/render/utils/css.mjs';
import { visibleKids, hidden, firstText, svgNode, ZERO, flexDirectionCss } from '../../write-bricks/components/helpers.mjs';

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
const fold = (s) => String(s ?? '').trim().toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ');
const SYNC_KIND = [['icon', /\bicon\b|\bdau\b/], ['title', /\bchu\b|\bmau\b|\btext\b|\bxanh\b/], ['gap', /\bkhoang\b|\bgap\b|\banimation\b|hieu ung/]];
const SYNC_WHY = 'không hiểu. «làm các mục giống nhau» cho mọi mục hoạt động như nhau, «không sửa» giữ nguyên Figma, hoặc «chỉ đồng bộ chữ», «đừng đổi icon».';

// "đồng bộ" (and a blank, from an older Plan) makes every item behave the same. "không sửa" keeps each item as Figma drew it.
// A sentence may turn one part off or limit the sync to the parts it names.
export function readSync(text) {
  const raw = String(text ?? '').trim();
  const v = fold(raw);
  if (!v || /^(dong bo( het| moi muc)?|lam cac muc giong nhau)$/.test(v)) return { ok: true, icon: true, title: true, gap: true };
  if (/^(khong sua( gi( ca)?)?|giu nguyen( het)?|khong dong bo( gi( ca)?)?|giu nhu figma)$/.test(v)) return { ok: true, icon: false, title: false, gap: false };
  const parts = v.split(/\s*(?:,|;|\bva\b)\s*/).filter(Boolean);
  const only = /\bchi\b/.test(v);
  const mentioned = new Set(), denied = new Set();
  for (const part of parts) {
    const kinds = SYNC_KIND.filter(([, re]) => re.test(part)).map(([k]) => k);
    if (!kinds.length) return { ok: false, why: SYNC_WHY };
    const deny = /\b(dung|khong|giu)\b/.test(part) && !/\bchi\b/.test(part);
    for (const k of kinds) (deny ? denied : mentioned).add(k);
  }
  if (![...mentioned, ...denied].length) return { ok: false, why: SYNC_WHY };
  if (only) return { ok: true, icon: mentioned.has('icon') && !denied.has('icon'), title: mentioned.has('title') && !denied.has('title'), gap: mentioned.has('gap') && !denied.has('gap') };
  return { ok: true, icon: !denied.has('icon'), title: !denied.has('title'), gap: !denied.has('gap') };
}

// What the items do not share, in the words the Plan shows. Empty = nothing to ask, the build still shares whatever is already the same.
export function syncNotes(node) {
  const items = visibleKids(node);
  const notes = [];
  const icons = items.map(toggleIcon).filter((icon) => icon?.svg?.file);
  const ranked = [...icons.reduce((m, icon) => m.set(glyphOf(icon), (m.get(glyphOf(icon)) ?? 0) + 1), new Map()).entries()].sort((a, b) => b[1] - a[1]);
  const [glyph, count] = ranked[0] ?? [];
  if (glyph && count * 2 > icons.length && count < icons.length) notes.push(`${count}/${icons.length} mục dùng icon «${glyph}»`);
  const openItem = items.find((i) => visibleKids(i).length === 2);
  const closedItem = items.find((i) => visibleKids(i).length < 2);
  const active = titleDecl(openItem && firstText(visibleKids(openItem)[0]));
  const closed = titleDecl(closedItem && firstText(visibleKids(closedItem)[0]));
  if (active && closed && active !== closed) notes.push('mục đang mở có chữ khác các mục đóng');
  if (openItem?.layout && closedItem?.layout && openItem.layout.gap != null && closedItem.layout.gap != null && openItem.layout.gap !== closedItem.layout.gap) notes.push(`khoảng cách mục đóng ${closedItem.layout.gap}px, mục mở ${openItem.layout.gap}px`);
  return notes;
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
  limits: 'the answers of closed items are not in Figma: they come from the Plan, a blank one is an empty content block (Bricks hides it) + warning; no chevron animation; the open title is the item Figma draws open and the closed title is the others, swapped with .brx-open; an icon a strict majority of items share replaces the rest',
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
    // An icon a strict majority of the items share (3 pluses, 1 minus) is the icon of every item, open or closed.
    const icons = items.map(toggleIcon).filter((icon) => icon?.svg?.file);
    const counts = new Map();
    for (const icon of icons) counts.set(glyphOf(icon), (counts.get(glyphOf(icon)) ?? 0) + 1);
    const [commonGlyph, commonCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (sync.icon && commonGlyph && commonCount * 2 > icons.length) {
      const source = icons.find((icon) => glyphOf(icon) === commonGlyph);
      for (const icon of icons) {
        if (glyphOf(icon) === commonGlyph) continue;
        const prev = out[icon.id] ?? {};
        out[icon.id] = { ...prev, settings: { ...(prev.settings ?? {}), file: { $asset: source.svg.file, size: 'full' } } };
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
