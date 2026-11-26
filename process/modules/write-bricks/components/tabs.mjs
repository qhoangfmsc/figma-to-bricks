// COMPONENT tabs (basic): [tab bar with >= 2 titles] + [content frame holding the pane(s)].
// Bricks 1.12.3 nestable children: tabs-nested > block.tab-menu > div.tab-title, and tabs-nested > block.tab-content > block.tab-pane.
//   source: includes/elements/tabs-nested.php (get_nestable_children). Selectors are `> .tab-menu` and `> .tab-content`.
// BASIC: Figma normally draws ONE open pane. Missing panes become EMPTY panes (never invented text) and are warned.
// The first tab is the open one (Bricks default); styling of the active title is not read.
// params: content.panes { titleNodeId: text } (what the owner typed in the Plan for a tab whose pane Figma does not draw: a pane block with the settings of the
//         drawn pane and a text with the typography of its first text)
import { PartKind } from '../../recognize-parts/kinds.mjs';
import { activeTitle, stampActive } from '../../write-bricks/components/tab-switch.mjs';
import { CONTAINER, visibleKids, hidden, firstText, flexDirectionCss, textSnippet } from '../../write-bricks/components/helpers.mjs';
import { tabsChromeCss } from '../../write-bricks/components/tabs-chrome.mjs';

// the tabs Figma draws no pane for, with the title text: what the Plan asks the content of
const tabLabel = (title) => firstText(title)?.text?.characters?.replace(/\s+/g, ' ').trim() || title.name;

// Children that sit side by side inside one content frame are regions of the one open pane.
// Each child of a stacked content frame is its own pane.
export function paneNodes(content, titles) {
  const kids = content ? visibleKids(content) : [];
  const sideBySide = content?.layout?.mode === 'HORIZONTAL'
    && kids.length > 1
    && kids.length < (titles?.length ?? 0)
    && content.box
    && kids.every((kid) => kid.box && kid.box.w < content.box.w - 1);
  return sideBySide ? { panes: [], one: true } : { panes: kids, one: false };
}

export function tabInventory(node) {
  const [bar, content] = visibleKids(node);
  if (!bar) return [];
  const titles = visibleKids(bar);
  const { panes, one } = paneNodes(content, titles);
  const drawn = one ? 1 : panes.length;
  return titles.map((title, i) => ({ title, label: tabLabel(title), drawn: i < drawn ? (textSnippet(one ? content : panes[i]) || 'đã vẽ') : '' }));
}

// A chip is one label in a row of the same shape. The other panes reuse that shape.
function chipOf(content) {
  let found = null;
  (function walk(node, parent) {
    if (found || !node) return;
    const kids = visibleKids(node);
    for (const child of kids) walk(child, node);
    const texts = kids.filter((child) => child.type === 'TEXT');
    if (!parent || kids.length !== 1 || texts.length !== 1) return;
    if (!node.fills?.some((fill) => fill.type === 'SOLID')) return;
    const siblings = visibleKids(parent).filter((child) => child.type === node.type);
    if (siblings.length < 3 || parent?.layout?.mode !== 'HORIZONTAL') return;
    found = { id: node.id, textId: texts[0].id, parentGap: parent.layout?.gap ?? 0 };
  })(content, null);
  return found;
}

export function emptyTabs(node) {
  return tabInventory(node).filter((row) => !row.drawn).map((row) => ({ title: row.title, label: row.label }));
}

function blankPane(index, drawn, titles, det, chip, sample, sampleText) {
  const text = det?.params?.content?.panes?.[titles[drawn + index].id];
  const items = String(text ?? '').split(' · ').map((item) => item.trim()).filter(Boolean);
  if (text && chip && items.length > 1) {
    const gap = chip.parentGap ?? 0;
    return {
      name: 'block', label: `Pane ${drawn + index + 1}`, settings: hidden('tab-pane'),
      children: [{
        name: 'block', label: 'Tags',
        settings: { _display: 'flex', _direction: 'row', _flexWrap: 'wrap', _alignItems: 'flex-start', _columnGap: `${gap}px`, _rowGap: `${gap}px`, _width: '100%' },
        children: items.map((item) => ({
          name: 'block', label: item, like: chip.id, drop: ['_width', '_widthMin', '_widthMax', '_flexBasis', '_flexGrow'],
          settings: { _width: 'auto' },
          children: [{ name: 'text-basic', label: item, like: chip.textId, settings: {}, text: item }],
        })),
      }],
    };
  }
  return text
    ? { name: 'block', label: `Pane ${drawn + index + 1}`, settings: hidden('tab-pane'), like: sample.id, drop: ['_display'], children: [{ name: 'text-basic', label: 'Content', settings: {}, ...(sampleText && { like: sampleText.id }), text }] }
    : { name: 'block', label: `Pane ${drawn + index + 1} (empty: not in Figma)`, settings: hidden('tab-pane') };
}

const paneDisplay = (node) => (['HORIZONTAL', 'VERTICAL'].includes(node.layout?.mode) ? 'flex' : node.layout?.mode === 'GRID' ? 'grid' : null);

export default {
  id: PartKind.TABS,
  status: 'implemented',
  label: 'Tabs (basic)',
  figma: 'a container with exactly two visible children: the tab bar (>= 2 title frames) and the content frame (the pane(s))',
  bricks: '`tabs-nested` > `tab-menu` > `tab-title`, and `tab-content` > `tab-pane`',
  limits: 'panes that Figma does not draw come from the Plan (blank = empty pane); the active-title style and which tab is open in Figma are not read (Bricks 1.9.8 opens the first tab, there is no openTab setting)',
  kind: () => 'tabs-nested',

  check(node, det) {
    const kids = visibleKids(node);
    if (kids.length !== 2) return { ok: false, reason: `needs exactly 2 visible children (tab bar + content), found ${kids.length}` };
    const [bar, content] = kids;
    const titles = visibleKids(bar);
    const { panes, one } = paneNodes(content, titles);
    const drawn = one ? 1 : panes.length;
    if (titles.length < 2) return { ok: false, reason: `the tab bar "${bar.name}" has ${titles.length} visible titles, needs >= 2` };
    const flat = titles.find((t) => !CONTAINER.has(t.type));
    if (flat) return { ok: false, reason: `title "${flat.name}" (${flat.id}) is a ${flat.type}: each title must be a frame holding the text` };
    if (!one && panes.length < 1) return { ok: false, reason: 'the content frame has no visible pane' };
    if (drawn > titles.length) return { ok: false, reason: `${drawn} panes for ${titles.length} titles` };
    const unanswered = emptyTabs(node).filter((e) => !det?.params?.content?.panes?.[e.title.id]);
    const warnings = unanswered.length ? [`Figma draws ${drawn} pane(s) for ${titles.length} tabs: ${unanswered.length} empty pane(s) are created, their content is not in Figma and not in the Plan`] : [];
    return { ok: true, warnings };
  },

  descendants(node, det) {
    const [bar, content] = visibleKids(node);
    const titles = visibleKids(bar);
    const { panes, one } = paneNodes(content, titles);
    const drawn = one ? 1 : panes.length;
    const sample = one ? content : panes[0];
    const sampleText = sample && firstText(sample);
    const chip = chipOf(one ? content : sample);
    const blanks = Array.from({ length: titles.length - drawn }, (_, index) => blankPane(index, drawn, titles, det, chip, sample, sampleText));
    const out = {
      // The theme root is a column. A horizontal bar beside the panes needs a row. The pane rules keep one pane open.
      [node.id]: { css: [...(node.layout?.mode === 'HORIZONTAL' ? flexDirectionCss(node) : []), ...tabsChromeCss()], bundle: [bar.id, content.id] },
      [bar.id]: { kind: 'block', settings: hidden('tab-menu') },
      [content.id]: {
        kind: 'block',
        settings: hidden('tab-content'),
        extraChildren: blanks,
        // The open pane is the whole row (picture beside the tags). Its children are not separate panes.
        ...(one ? {
          dropSettings: ['_direction', '_columnGap', '_rowGap'],
          settings: { ...hidden('tab-content'), _direction: 'column' },
          wrapChildren: {
            label: 'Pane 1',
            settings: hidden('tab-pane brx-open'),
            css: [...flexDirectionCss(content), { decl: 'display: flex;', suffix: '.brx-open' }],
          },
        } : {}),
      },
    };
    const marked = activeTitle(titles);
    const openAt = marked.clear ? marked.index : 0;
    out[node.id].settings = { ...(out[node.id].settings ?? {}), openTab: String(openAt) };
    for (const [index, title] of titles.entries()) out[title.id] = { kind: 'div', settings: hidden(index === openAt ? 'tab-title brx-open' : 'tab-title') };
    stampActive(out, titles, openAt);
    // a pane's own `display` (flex, from the Figma auto layout) is an id selector in the compiled css and beats the theme's `.tab-pane { display: none }`: every pane would show at
    // once. The display is given back only to the open pane (`.brx-open`).
    for (const [index, pane] of panes.entries()) {
      const display = paneDisplay(pane);
      out[pane.id] = { kind: 'block', settings: hidden(index === openAt ? 'tab-pane brx-open' : 'tab-pane'), ...(display && { dropSettings: ['_display'], css: [{ decl: `display: ${display};`, suffix: '.brx-open' }] }) };
    }
    return out;
  },
};
