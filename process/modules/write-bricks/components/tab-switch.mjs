// COMPONENT tab-switch: a Tab List and a Tab Panel that are not the two children of one frame.
// The price table draws the pill ("VPS NVMe" / "VPS SSD") inside _Period, next to the period bar, and the
// panel under the card. Bricks 1.9.8 tabs-nested still switches them: titles are siblings, panes are siblings,
// and both sit inside one `.brxe-tabs-nested` (includes/elements/tabs-nested.php, assets/js/bricks.min.js).
// The script always opens the first title. The drawn pill (the title with the solid fill) is that look, moved
// with `.brx-open`, because a fill left on the title element would stay put when the other title is clicked.
// params: content.panes { titleNodeId: text } for a tab whose panel Figma does not draw.
import { visibleKids, hidden, firstText, flexDirectionCss, textSnippet } from '../../write-bricks/components/helpers.mjs';
import { tabsChromeCss } from '../../write-bricks/components/tabs-chrome.mjs';
import { cssColor } from '../../write-bricks/render/utils/css.mjs';

const LIST = /tab\s*list/i;
const PANEL = /tab\s*panel/i;
const TAB_WORD = /\btab\b/i;
const BOX = new Set(['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT']);
const hasText = (n) => (n.type === 'TEXT' && !n.svg && n.text?.characters?.trim()) || visibleKids(n).some(hasText);
const solid = (n) => (n?.fills ?? []).filter((f) => f.type === 'SOLID' && f.visible !== false).at(-1);
const contains = (n, id) => !!n && (n.id === id || visibleKids(n).some((c) => contains(c, id)));

// A frame named "Linux tab" (or any single tab), not a bar that holds several tabs.
export function isSingleTab(n) {
  if (!n || n.visible === false || !BOX.has(n.type) || !TAB_WORD.test(n.name ?? '')) return false;
  const kids = visibleKids(n);
  if (kids.length >= 2 && kids.every((k) => TAB_WORD.test(k.name ?? ''))) return false;
  return hasText(n);
}

// A horizontal row whose children are those tab frames. "Tab List" stays with isTabList.
export function isNamedTabBar(n) {
  const kids = visibleKids(n);
  return !!n && n.layout?.mode === 'HORIZONTAL' && kids.length >= 2 && kids.every(isSingleTab) && !isTabList(n);
}

function parentIn(root, id) {
  const walk = (n) => {
    for (const c of n.children ?? []) {
      if (c.id === id) return n;
      const hit = walk(c);
      if (hit) return hit;
    }
    return null;
  };
  return walk(root);
}

function drawnOf(n) {
  if (!n) return '';
  const text = textSnippet(n);
  if (text) return text;
  const art = (x) => {
    if (!x || x.visible === false || x.type === 'TEXT') return false;
    if (x.svg) return true;
    if (x.type === 'VECTOR' || x.type === 'ELLIPSE' || x.type === 'LINE') return true;
    if (x.type === 'RECTANGLE' && ((x.fills ?? []).some((f) => f.visible !== false && f.type !== 'SOLID') || x.svg)) return true;
    if (x.svg && !BOX.has(x.type)) return true;
    return (x.children ?? []).some(art);
  };
  return art(n) ? 'đã vẽ' : '';
}

function underlineDecl(title) {
  const bottom = title?.stroke?.weights?.bottom ?? 0;
  const paint = (title?.stroke?.paints ?? []).filter((p) => p.visible !== false && p.type === 'SOLID').at(-1);
  if (!(bottom > 0) || !paint?.hex) return '';
  return `box-shadow: inset 0 -${bottom}px 0 ${cssColor(paint)};`;
}

export function isTabList(n) {
  const kids = visibleKids(n);
  if (n.layout?.mode !== 'HORIZONTAL' || kids.length < 2) return false;
  if (!kids.every((k) => BOX.has(k.type) && hasText(k))) return false;
  return LIST.test(n.name ?? '') || kids.every((k) => /^tab$/i.test(String(k.name ?? '').trim()));
}

function collectPanels(n, listId, out) {
  if (n.id === listId) return;
  if (PANEL.test(n.name ?? '')) out.push(n);
  for (const c of visibleKids(n)) collectPanels(c, listId, out);
}

function hostOf(root, list) {
  let host = null;
  let panels = [];
  (function walk(n) {
    for (const c of visibleKids(n)) walk(c);
    if (host || n.id === list.id) return;
    const found = [];
    collectPanels(n, list.id, found);
    if (found.length && contains(n, list.id)) { host = n; panels = found; }
  })(root);
  return host && { host, panels };
}

// A pair of two children (the list and a frame that holds the panel) is the tabs component, not this one.
function coveredByTabs(host, list, panels) {
  const kids = visibleKids(host);
  return kids.length === 2 && kids.some((k) => k.id === list.id) && kids.some((k) => panels.every((p) => contains(k, p.id)));
}

export function listsIn(node, out = []) {
  if (isTabList(node)) out.push(node);
  else for (const c of visibleKids(node)) listsIn(c, out);
  return out;
}

function classicInspect(node, list = listsIn(node)[0]) {
  if (!list || !contains(node, list.id)) return null;
  const found = hostOf(node, list);
  if (!found || found.host.id !== node.id) return null;
  const titles = visibleKids(list);
  const filled = titles.map((t) => !!solid(t));
  const active = filled.filter(Boolean).length === 1 ? filled.indexOf(true) : 0;
  return { list, titles, panels: found.panels, active };
}

// A horizontal bar of frames named "tab", with the content frame under it (Operating System on desktop).
// Stacked title + content rows are not a switch: a mobile frame that draws them in the flow stays blocks.
function looseInspect(node) {
  const kids = visibleKids(node);
  const bar = kids.find(isNamedTabBar);
  if (!bar) return null;
  const content = kids[kids.findIndex((c) => c.id === bar.id) + 1];
  const below = content && content.box && bar.box && content.box.absY >= bar.box.absY + bar.box.h - 1;
  if (!below || isSingleTab(content) || isNamedTabBar(content)) return null;
  const inner = visibleKids(content);
  const titles = visibleKids(bar);
  const active = activeTitle(titles);
  const named = inner.filter((n) => PANEL.test(n.name ?? ''));
  if (named.length) return { list: bar, titles, panels: named, paneParent: content, active: active.index ?? 0, activeClear: active.clear };
  const data = repeatedSet(inner);
  // Five matching cards are the open tab's data, not five panes. Bricks keeps one pane open
  // (tabs-nested.php: tab-content > tab-pane siblings; .tab-pane is hidden until .brx-open).
  if (data.ambiguous) {
    return { list: bar, titles, panels: [], ambiguous: data.groups, paneParent: content, active: active.index, activeClear: active.clear };
  }
  if (data.items.length >= 2) {
    return { list: bar, titles, panels: [], dataItems: data.items, paneParent: content, active: active.index, activeClear: active.clear };
  }
  if (inner.length === titles.length && inner.length > 0) {
    return { list: bar, titles, panels: inner, paneParent: null, active: active.index ?? 0, activeClear: active.clear };
  }
  return { list: bar, titles, panels: [], paneParent: content, active: active.index, activeClear: active.clear };
}

// One tab is open. A bottom stroke, else one solid fill. Two marks, or none, is not a guess: the screen asks.
export function activeTitle(titles) {
  const lined = titles.map((t, i) => ((t.stroke?.weights?.bottom ?? 0) > 0 ? i : -1)).filter((i) => i >= 0);
  if (lined.length === 1) return { index: lined[0], clear: true };
  if (lined.length > 1) return { index: null, clear: false, reason: 'nhiều tab có gạch chân' };
  const filled = titles.map((t, i) => (solid(t) ? i : -1)).filter((i) => i >= 0);
  if (filled.length === 1) return { index: filled[0], clear: true };
  if (filled.length > 1) return { index: null, clear: false, reason: 'nhiều tab có nền' };
  return { index: null, clear: false, reason: 'không thấy tab nào đang mở' };
}

function activeOf(titles) {
  return activeTitle(titles).index ?? 0;
}

const itemName = (n) => String(n?.name ?? '').trim().toLowerCase();

function shapeKey(n) {
  const kids = visibleKids(n).map((c) => (c.type === 'TEXT' ? 'text' : c.svg ? 'svg' : c.type));
  return kids.join('+') || n.type;
}

// Siblings that share a structure. The same name wins (five frames named "os").
// A strictly larger group is the data. Two groups of the same size are not a guess.
export function repeatedSet(nodes) {
  const kids = (nodes ?? []).filter((n) => n && n.visible !== false);
  const rank = (groups) => {
    const sized = [...groups.values()].filter((g) => g.length >= 2).sort((a, b) => b.length - a.length);
    if (!sized.length) return null;
    if (sized.length > 1 && sized[0].length === sized[1].length) return { items: [], groups: sized, ambiguous: true };
    return { items: sized[0], groups: sized, ambiguous: false, name: sized[0][0].name };
  };
  const byName = new Map();
  for (const n of kids) {
    const name = itemName(n);
    if (!name) continue;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(n);
  }
  const named = rank(byName);
  if (named) return named;
  const byShape = new Map();
  for (const n of kids) {
    const key = shapeKey(n);
    if (!byShape.has(key)) byShape.set(key, []);
    byShape.get(key).push(n);
  }
  return rank(byShape) ?? { items: [], groups: [], ambiguous: false };
}

export function itemSummary(items) {
  const name = String(items[0]?.name ?? 'item').trim() || 'item';
  return `${items.length} item "${name}"`;
}

export function inspect(node, list = listsIn(node)[0]) {
  return classicInspect(node, list) ?? looseInspect(node);
}

export function tabTitles(node) {
  return inspect(node)?.titles ?? [];
}

const labelOf = (title) => firstText(title)?.text?.characters?.replace(/\s+/g, ' ').trim() || title.name;

export function switchInventory(node) {
  const found = inspect(node);
  if (!found) return [];
  return found.titles.map((title, i) => {
    const label = labelOf(title);
    if (found.dataItems?.length && found.activeClear && i === found.active) {
      return { title, label, drawn: itemSummary(found.dataItems), active: true };
    }
    if (found.dataItems?.length) return { title, label, drawn: '', active: false };
    return { title, label, drawn: drawnOf(found.panels[i]), active: i === found.active && found.activeClear };
  });
}

// Asked only when the drawing does not say which tab owns the repeated items.
export function tabQuestions(node) {
  const found = inspect(node);
  if (!found) return [];
  const out = [];
  if (found.dataItems?.length && !found.activeClear) {
    const names = found.titles.map((t) => labelOf(t)).filter(Boolean).join(', ');
    out.push({ group: 'tabopen', label: `Tab đang mở (${found.activeReason}). Data: ${itemSummary(found.dataItems)}. Gõ đúng một tên: ${names}` });
  }
  if (found.ambiguous?.length) {
    const choices = found.ambiguous.map((g) => `${g.length} item "${g[0].name}"`).join(' hoặc ');
    out.push({ group: 'tabdata', label: `Nhóm item của tab đang mở: ${choices}` });
  }
  return out;
}

export function undrawnPanes(node) {
  return switchInventory(node).filter((row) => !row.drawn).map((row) => ({ title: row.title, label: row.label }));
}

const displayOf = (c) => (['HORIZONTAL', 'VERTICAL'].includes(c?.layout?.mode) ? 'flex' : c?.layout?.mode === 'GRID' ? 'grid' : 'block');

export default {
  id: 'tab-switch',
  status: 'implemented',
  label: 'Tab switch',
  figma: 'a Tab List of >= 2 titles and a Tab Panel that is not the list\'s sibling (a period bar or a title can sit between them)',
  bricks: '`tabs-nested` on the frame that holds both; the list is the tab menu, each Tab is a title, each Tab Panel is a pane',
  limits: 'The drawn open title is openTab (1.12.3, index from 0) and gets brx-open. A panel Figma does not draw comes from the Plan, blank stays empty. The moving pill is the solid fill and the text color of the drawn titles',
  kind: () => 'tabs-nested',

  check(node, det) {
    const found = inspect(node);
    if (!found) return { ok: false, reason: 'needs a Tab List and a Tab Panel inside this frame' };
    if (found.titles.length < 2) return { ok: false, reason: `needs at least 2 tabs, found ${found.titles.length}` };
    const warnings = [];
    if (!Number.isInteger(found.active)) warnings.push('Figma does not show one open title, so tab 0 stays open');
    const missing = undrawnPanes(node).filter((e) => !det?.params?.content?.panes?.[e.title.id]);
    if (missing.length) warnings.push(`Figma draws ${found.panels.length} panel(s) for ${found.titles.length} tabs: ${missing.length} empty pane(s), their content is not in Figma and not in the Plan`);
    return { ok: true, warnings };
  },

  descendants(node, det) {
    const found = inspect(node);
    const { list, titles, panels, active } = found;
    const openAt = Number.isInteger(active) ? active : 0;
    const idle = titles.find((_, i) => i !== active) ?? titles[0];
    const on = titles[active] ?? titles[0];
    const idleColor = solid(firstText(idle));
    const onColor = solid(firstText(on));
    const line = underlineDecl(on);
    const parent = (id) => {
      const walk = (n) => { for (const c of visibleKids(n)) { if (c.id === id) return n; const hit = walk(c); if (hit) return hit; } return null; };
      return walk(node);
    };
    const paneParent = panels[0] ? parent(panels[0].id) : (found.paneParent ?? null);
    const sample = panels[0];
    const sampleText = sample && firstText(sample);
    const titleCss = [
      { decl: `background-color: ${solid(idle) ? cssColor(solid(idle)) : 'transparent'};`, suffix: ' .tab-title' },
      { decl: `background-color: ${solid(on) ? cssColor(solid(on)) : 'transparent'};`, suffix: ' .tab-title.brx-open' },
      ...(idleColor ? [{ decl: `color: ${cssColor(idleColor)};`, suffix: ' .tab-title :is(.brxe-text-basic, .brxe-heading)' }] : []),
      ...(onColor ? [{ decl: `color: ${cssColor(onColor)};`, suffix: ' .tab-title.brx-open :is(.brxe-text-basic, .brxe-heading)' }] : []),
      ...(line ? [{ decl: line, suffix: ' .tab-title.brx-open' }] : []),
    ];
    const missing = titles.slice(panels.length);
    const extraChildren = missing.map((title, i) => {
      const text = det?.params?.content?.panes?.[title.id];
      const open = panels.length + i === openAt ? 'tab-pane brx-open' : 'tab-pane';
      return text
        ? { name: 'block', label: `Pane ${panels.length + i + 1}`, settings: hidden(open), ...(sample && { like: sample.id, drop: ['_display'] }), children: [{ name: 'text-basic', label: 'Content', settings: {}, ...(sampleText && { like: sampleText.id }), text }] }
        : { name: 'block', label: `Pane ${panels.length + i + 1} (empty: not in Figma)`, settings: hidden(open) };
    });
    const out = {
      [node.id]: { settings: { openTab: String(openAt) }, css: [...flexDirectionCss(node), ...tabsChromeCss(), ...(list ? [] : titleCss)] },
    };
    if (!list && missing.length && (!paneParent || paneParent.id === node.id)) out[node.id].extraChildren = extraChildren;
    if (list) out[list.id] = { settings: hidden('tab-menu'), css: titleCss };
    titles.forEach((title, i) => {
      out[title.id] = { settings: hidden(i === openAt ? 'tab-title brx-open' : 'tab-title'), dropSettings: line ? ['_background', '_border', '_boxShadow'] : ['_background'] };
    });
    panels.forEach((pane, i) => {
      const text = !drawnOf(pane) ? det?.params?.content?.panes?.[titles[i]?.id] : '';
      out[pane.id] = {
        settings: hidden(i === openAt ? 'tab-pane brx-open' : 'tab-pane'),
        dropSettings: ['_display'],
        css: [{ decl: `display: ${displayOf(pane)};`, suffix: '.brx-open' }],
        ...(text ? { extraChildren: [{ name: 'text-basic', label: 'Content', settings: {}, text }] } : {}),
      };
    });
    if (paneParent && paneParent.id !== node.id) {
      // The content frame is the pane parent. It has to be a block: an empty frame exported as svg does not render its children.
      out[paneParent.id] = { ...(out[paneParent.id] ?? {}), kind: 'block', settings: { ...(out[paneParent.id]?.settings ?? {}), ...hidden('tab-content') }, ...(missing.length ? { extraChildren } : {}) };
    } else if (paneParent && paneParent.id === node.id && missing.length && list) {
      out[node.id].extraChildren = extraChildren;
    }
    return out;
  },
};
