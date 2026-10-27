// COMPONENT accordion (basic): a list of items, each = a title row + a content block (the closed items often have their content hidden).
// Bricks 1.9.8: `accordion-nested`. Its script needs two class names on each item's children: accordion-title-wrapper and
// accordion-content-wrapper (set through the hidden `_hidden._cssClasses`, like the element's own template does).
//   source: includes/elements/accordion-nested.php (get_nestable_item)
// BASIC: structure only. An item whose content is hidden in Figma gets an EMPTY content block (never invented text) and a warning.
// `expandFirstItem` is on when the first item's content is visible in Figma. Icons stay as drawn (svg), they do not rotate.
// params: independent (default true: items open and close without closing the others, Bricks `independentToggle`).
import { visibleKids, hidden } from './helpers.mjs';

export default {
  id: 'accordion',
  status: 'implemented',
  label: 'Accordion (basic)',
  figma: 'a container of >= 2 items, each with a title row and (when open) a content block',
  bricks: '`accordion-nested`; items stay blocks, title / content blocks get the accordion-* classes',
  limits: 'content of closed items is not in Figma (empty content block + warning); no chevron animation; no active-state styles',
  kind: () => 'accordion-nested',

  check(node) {
    const items = visibleKids(node);
    if (items.length < 2) return { ok: false, reason: `needs at least 2 items, found ${items.length}` };
    const bad = items.find((i) => visibleKids(i).length < 1 || visibleKids(i).length > 2);
    if (bad) return { ok: false, reason: `item "${bad.name}" (${bad.id}) must have a title and at most one content block, it has ${visibleKids(bad).length} visible children` };
    const warnings = items.filter((i) => visibleKids(i).length === 1).map((i) => `item "${i.name}" has no visible content in Figma: an empty content block is created`);
    return { ok: true, warnings };
  },

  descendants(node, det) {
    const out = {};
    for (const item of visibleKids(node)) {
      const [title, content] = visibleKids(item);
      out[title.id] = { settings: hidden('accordion-title-wrapper') };
      if (content) out[content.id] = { settings: hidden('accordion-content-wrapper') };
      else out[item.id] = { extraChildren: [{ name: 'block', label: 'Content (empty: not in Figma)', settings: hidden('accordion-content-wrapper') }] };
    }
    // the item drawn open: the first one -> expandFirstItem, any other -> its own `brx-open` class (the class Bricks' script toggles)
    const items = visibleKids(node);
    const open = items.findIndex((i) => visibleKids(i).length === 2);
    if (open > 0) out[items[open].id] = { ...(out[items[open].id] ?? {}), settings: { _cssClasses: 'brx-open' } };
    out[node.id] = { settings: { ...(open === 0 && { expandFirstItem: true }), ...(det.params?.independent !== false && { independentToggle: true }) } };
    return out;
  },
};
