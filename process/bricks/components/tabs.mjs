// COMPONENT tabs (basic): [tab bar with >= 2 titles] + [content frame holding the pane(s)].
// Bricks 1.9.8: `tabs-nested`, children: block.tab-menu > div.tab-title (one per tab) and block.tab-content > block.tab-pane (one per tab).
//   source: includes/elements/tabs-nested.php (get_nestable_children)
// BASIC: Figma normally draws ONE open pane. Missing panes become EMPTY panes (never invented text) and are warned.
// The first tab is the open one (Bricks default); styling of the active title is not read.
// params: content.panes { titleNodeId: text } (what the owner typed in the Plan for a tab whose pane Figma does not draw: a pane block with the settings of the
//         drawn pane and a text with the typography of its first text)
import { CONTAINER, visibleKids, hidden, firstText, flexDirectionCss } from './helpers.mjs';

// the tabs Figma draws no pane for, with the title text: what the Plan asks the content of
export function emptyTabs(node) {
  const [bar, content] = visibleKids(node);
  const panes = visibleKids(content);
  return visibleKids(bar).slice(panes.length).map((t) => ({ title: t, label: firstText(t)?.text.characters.replace(/\s+/g, ' ').trim() ?? t.name }));
}

export default {
  id: 'tabs',
  status: 'implemented',
  label: 'Tabs (basic)',
  figma: 'a container with exactly two visible children: the tab bar (>= 2 title frames) and the content frame (the pane(s))',
  bricks: '`tabs-nested`: tab-menu > tab-title divs, tab-content > tab-pane blocks',
  limits: 'panes that Figma does not draw come from the Plan (blank = empty pane); the active-title style and which tab is open in Figma are not read (Bricks 1.9.8 opens the first tab, there is no openTab setting)',
  kind: () => 'tabs-nested',

  check(node, det) {
    const kids = visibleKids(node);
    if (kids.length !== 2) return { ok: false, reason: `needs exactly 2 visible children (tab bar + content), found ${kids.length}` };
    const [bar, content] = kids;
    const titles = visibleKids(bar), panes = visibleKids(content);
    if (titles.length < 2) return { ok: false, reason: `the tab bar "${bar.name}" has ${titles.length} visible titles, needs >= 2` };
    const flat = titles.find((t) => !CONTAINER.has(t.type));
    if (flat) return { ok: false, reason: `title "${flat.name}" (${flat.id}) is a ${flat.type}: each title must be a frame holding the text` };
    if (panes.length < 1) return { ok: false, reason: 'the content frame has no visible pane' };
    if (panes.length > titles.length) return { ok: false, reason: `${panes.length} panes for ${titles.length} titles` };
    const unanswered = emptyTabs(node).filter((e) => !det?.params?.content?.panes?.[e.title.id]);
    const warnings = unanswered.length ? [`Figma draws ${panes.length} pane(s) for ${titles.length} tabs: ${unanswered.length} empty pane(s) are created, their content is not in Figma and not in the Plan`] : [];
    return { ok: true, warnings };
  },

  descendants(node, det) {
    const [bar, content] = visibleKids(node);
    const titles = visibleKids(bar), panes = visibleKids(content);
    const sample = panes[0], sampleText = sample && firstText(sample);
    const out = {
      ...(node.layout?.mode === 'HORIZONTAL' && { [node.id]: { css: flexDirectionCss(node) } }), // the theme's root is a column; vertical tabs (bar beside the panes) need a row
      [bar.id]: { kind: 'block', settings: hidden('tab-menu') },
      [content.id]: { kind: 'block', settings: hidden('tab-content'), extraChildren: Array.from({ length: titles.length - panes.length }, (_, i) => {
        const text = det?.params?.content?.panes?.[titles[panes.length + i].id];
        return text
          ? { name: 'block', label: `Pane ${panes.length + i + 1}`, settings: hidden('tab-pane'), like: sample.id, drop: ['_display'], children: [{ name: 'text-basic', label: 'Content', settings: {}, ...(sampleText && { like: sampleText.id }), text }] }
          : { name: 'block', label: `Pane ${panes.length + i + 1} (empty: not in Figma)`, settings: hidden('tab-pane') };
      }) },
    };
    for (const t of titles) out[t.id] = { kind: 'div', settings: hidden('tab-title') };
    // a pane's own `display` (flex, from the Figma auto layout) is an id selector in the compiled css and beats the theme's `.tab-pane { display: none }`: every pane would show at
    // once. The display is given back only to the open pane (`.brx-open`).
    const displayOf = (c) => (['HORIZONTAL', 'VERTICAL'].includes(c.layout?.mode) ? 'flex' : c.layout?.mode === 'GRID' ? 'grid' : null);
    for (const p of panes) out[p.id] = { kind: 'block', settings: hidden('tab-pane'), ...(displayOf(p) && { dropSettings: ['_display'], css: [{ decl: `display: ${displayOf(p)};`, suffix: '.brx-open' }] }) };
    return out;
  },
};
