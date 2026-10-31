// COMPONENT accordion (basic): a list of items, each = a title row + a content block (the closed items often have their content hidden).
// Bricks 1.9.8: `accordion-nested`. Its script needs two class names on each item's children: accordion-title-wrapper and
// accordion-content-wrapper (set through the hidden `_hidden._cssClasses`, like the element's own template does).
//   source: includes/elements/accordion-nested.php (get_nestable_item)
// BASIC: structure only. An item whose content is hidden in Figma gets an EMPTY content block (never invented text) and a warning.
// `expandFirstItem` is on when the first item's content is visible in Figma. Icons stay as drawn (svg), they do not rotate.
// params: independent (default true: items open and close without closing the others, Bricks `independentToggle`) ·
//         content.answers { itemNodeId: text } (what the owner typed in the Plan for an item Figma draws closed: the new content block takes the
//         settings of the drawn open item's content, the text takes the typography of its text; without a drawn open item it keeps Bricks defaults).
import { visibleKids, hidden, firstText, ZERO, flexDirectionCss } from './helpers.mjs';

// The theme gives the title row `padding: 15px 0; margin-bottom: -1px` and the content `padding: 0 0 15px` (frontend.min.css): not Figma values. Every row and content
// block starts from zero; a padding or margin the Figma frame has is written by the build and wins over these defaults.
// A content block's own `display` (flex, from the Figma auto layout) is an id selector in the compiled css and beats the theme's `.accordion-content-wrapper { display: none }`:
// the block could never close. The display is given back only while the item is open (`.brx-open`), through the css of the item.
const displayOf = (c) => (['HORIZONTAL', 'VERTICAL'].includes(c?.layout?.mode) ? 'flex' : c?.layout?.mode === 'GRID' ? 'grid' : null);
const openCss = (c) => (displayOf(c) ? [{ decl: `display: ${displayOf(c)};`, suffix: '.brx-open > .accordion-content-wrapper' }] : []);
const THEME_RESET = { defaults: { _padding: { ...ZERO }, _margin: { ...ZERO } } };

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
  limits: 'the answers of closed items are not in Figma: they come from the Plan, a blank one is an empty content block (Bricks hides it) + warning; no chevron animation; no active-state styles',
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
    const drawn = visibleKids(node).map((i) => visibleKids(i)[1]).find(Boolean); // the content block of an item Figma draws open: the look of every answer
    const drawnText = drawn && firstText(drawn);
    for (const item of visibleKids(node)) {
      const [title, content] = visibleKids(item);
      out[title.id] = { settings: hidden('accordion-title-wrapper'), ...THEME_RESET };
      if (content) {
        out[content.id] = { settings: hidden('accordion-content-wrapper'), ...THEME_RESET, ...(displayOf(content) && { dropSettings: ['_display'] }) };
        if (displayOf(content)) out[item.id] = { css: openCss(content) };
      } else {
        const answer = det.params?.content?.answers?.[item.id];
        out[item.id] = { css: answer ? openCss(drawn) : [], extraChildren: [answer
          ? { name: 'block', label: 'Content', settings: { ...hidden('accordion-content-wrapper'), ...(!drawn && { _padding: { ...ZERO } }) }, ...(drawn && { like: drawn.id, drop: ['_display'] }), children: [{ name: 'text-basic', label: 'Answer', settings: {}, ...(drawnText && { like: drawnText.id }), text: answer }] }
          : { name: 'block', label: 'Content (empty: not in Figma)', settings: { ...hidden('accordion-content-wrapper'), _padding: { ...ZERO } } }] };
      }
    }
    // the item drawn open: the first one -> expandFirstItem, any other -> its own `brx-open` class (the class Bricks' script toggles)
    const items = visibleKids(node);
    const open = items.findIndex((i) => visibleKids(i).length === 2);
    if (open > 0) out[items[open].id] = { ...(out[items[open].id] ?? {}), settings: { _cssClasses: 'brx-open' } };
    out[node.id] = { settings: { ...(open === 0 && { expandFirstItem: true }), ...(det.params?.independent !== false && { independentToggle: true }) }, css: flexDirectionCss(node) };
    return out;
  },
};
