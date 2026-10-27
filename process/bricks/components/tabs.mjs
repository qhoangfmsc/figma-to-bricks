// COMPONENT tabs (basic): [tab bar with >= 2 titles] + [content frame holding the pane(s)].
// Bricks 1.9.8: `tabs-nested`, children: block.tab-menu > div.tab-title (one per tab) and block.tab-content > block.tab-pane (one per tab).
//   source: includes/elements/tabs-nested.php (get_nestable_children)
// BASIC: Figma normally draws ONE open pane. Missing panes become EMPTY panes (never invented text) and are warned.
// The first tab is the open one (Bricks default); styling of the active title is not read.
import { CONTAINER, visibleKids, hidden } from './helpers.mjs';

export default {
  id: 'tabs',
  status: 'implemented',
  label: 'Tabs (basic)',
  figma: 'a container with exactly two visible children: the tab bar (>= 2 title frames) and the content frame (the pane(s))',
  bricks: '`tabs-nested`: tab-menu > tab-title divs, tab-content > tab-pane blocks',
  limits: 'panes that Figma does not draw are empty; the active-title style and which tab is open in Figma are not read (first tab opens)',
  kind: () => 'tabs-nested',

  check(node) {
    const kids = visibleKids(node);
    if (kids.length !== 2) return { ok: false, reason: `needs exactly 2 visible children (tab bar + content), found ${kids.length}` };
    const [bar, content] = kids;
    const titles = visibleKids(bar), panes = visibleKids(content);
    if (titles.length < 2) return { ok: false, reason: `the tab bar "${bar.name}" has ${titles.length} visible titles, needs >= 2` };
    const flat = titles.find((t) => !CONTAINER.has(t.type));
    if (flat) return { ok: false, reason: `title "${flat.name}" (${flat.id}) is a ${flat.type}: each title must be a frame holding the text` };
    if (panes.length < 1) return { ok: false, reason: 'the content frame has no visible pane' };
    if (panes.length > titles.length) return { ok: false, reason: `${panes.length} panes for ${titles.length} titles` };
    const warnings = panes.length < titles.length ? [`Figma draws ${panes.length} pane(s) for ${titles.length} tabs: ${titles.length - panes.length} empty pane(s) are created, their content is not in Figma`] : [];
    return { ok: true, warnings };
  },

  descendants(node) {
    const [bar, content] = visibleKids(node);
    const titles = visibleKids(bar), panes = visibleKids(content);
    const out = {
      [bar.id]: { kind: 'block', settings: hidden('tab-menu') },
      [content.id]: { kind: 'block', settings: hidden('tab-content'), extraChildren: Array.from({ length: titles.length - panes.length }, (_, i) => ({ name: 'block', label: `Pane ${panes.length + i + 1} (empty: not in Figma)`, settings: hidden('tab-pane') })) },
    };
    for (const t of titles) out[t.id] = { kind: 'div', settings: hidden('tab-title') };
    for (const p of panes) out[p.id] = { kind: 'block', settings: hidden('tab-pane') };
    return out;
  },
};
