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
import { linearGradientCss } from '../../write-bricks/render/utils/gradient.mjs';
import { activeLook, markSettings, nodeAt } from '../../write-bricks/components/states.mjs';

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
// A line or a hairline vector between titles is a divider, not a title.
function isSeparator(n) {
  if (!n || n.visible === false || hasText(n)) return false;
  if (n.type === 'LINE') return true;
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  if (n.type === 'VECTOR' || n.type === 'ELLIPSE') return w <= 16 || h <= 2;
  return w <= 2 || h <= 2;
}

function textLabels(n) {
  const labels = [];
  (function walk(node) {
    if (!node || node.visible === false) return;
    if (node.type === 'TEXT' && !node.svg && node.text?.characters?.trim()) labels.push(node.text.characters.trim());
    for (const child of node.children ?? []) walk(child);
  })(n);
  return labels;
}

// A trigger carries one label. A short badge beside that label is still the trigger.
// A card carries a title, a price and a feature list, so it is not a trigger.
function isTrigger(n) {
  if (!n || !BOX.has(n.type)) return false;
  const labels = textLabels(n);
  if (labels.length === 1) return true;
  return labels.length === 2 && labels.some((label) => label.length <= 6);
}

// Titles are the boxes that carry one label. Dividers stay in the row and are not titles.
export function rowTitles(n) {
  return visibleKids(n).filter(isTrigger);
}

// A divider sits between two triggers. It is optional. When it is there, the row is a segmented control.
export function dividerOf(n, titles = rowTitles(n)) {
  const ids = new Set(titles.map((t) => t.id));
  const kids = visibleKids(n);
  let seen = false;
  for (let i = 0; i < kids.length; i++) {
    if (ids.has(kids[i].id)) { seen = true; continue; }
    if (seen && isSeparator(kids[i]) && kids.slice(i + 1).some((c) => ids.has(c.id))) return kids[i];
  }
  return null;
}

export function hasDivider(n, titles = rowTitles(n)) {
  return !!dividerOf(n, titles);
}

function gapsAreSeparators(n, titles) {
  const ids = new Set(titles.map((t) => t.id));
  return visibleKids(n).filter((k) => !ids.has(k.id)).every(isSeparator);
}

export function isNamedTabBar(n) {
  const titles = rowTitles(n);
  return !!n && n.layout?.mode === 'HORIZONTAL' && titles.length >= 2 && titles.every(isSingleTab) && gapsAreSeparators(n, titles) && !isTabList(n);
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
  const titles = rowTitles(n);
  if (!n || n.layout?.mode !== 'HORIZONTAL' || titles.length < 2 || !gapsAreSeparators(n, titles)) return false;
  return LIST.test(n.name ?? '') || titles.every((k) => /^tab$/i.test(String(k.name ?? '').trim()));
}

function regionUnder(host, list) {
  const kids = visibleKids(host);
  const index = kids.findIndex((child) => child.id === list.id || contains(child, list.id));
  if (index < 0) return null;
  const below = kids.slice(index + 1).filter((child) => {
    if (!list.box || !child.box || child.box.absY == null || list.box.absY == null) return true;
    return child.box.absY >= list.box.absY + list.box.h - 1;
  });
  const titles = visibleKids(list);
  const panesOf = (nodes) => {
    const named = nodes.filter((node) => PANEL.test(node.name ?? ''));
    if (named.length === titles.length || named.length === 1) return named;
    return null;
  };
  if (below.length === 1) {
    const direct = panesOf(visibleKids(below[0]));
    return { host, panels: direct ?? [below[0]] };
  }
  const direct = panesOf(below);
  return direct ? { host, panels: direct } : null;
}

function namedPanelInside(node) {
  if (!node) return false;
  if (PANEL.test(node.name ?? '')) return true;
  return visibleKids(node).some(namedPanelInside);
}

function hostOf(root, list) {
  const found = [];
  let current = parentIn(root, list.id);
  while (current) {
    const region = regionUnder(current, list);
    if (region) found.push(region);
    if (current.id === root.id) break;
    current = parentIn(root, current.id);
  }
  return found.find((region) => region.panels.some(namedPanelInside)) ?? found[0] ?? null;
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

function barInside(node, depth = 0) {
  if (!node || node.visible === false || depth > 8) return null;
  if (isActionBar(node)) return node;
  for (const child of visibleKids(node)) {
    const hit = barInside(child, depth + 1);
    if (hit) return hit;
  }
  return null;
}

// After the bar, one region is the open pane. Several regions of the same structure are one pane each.
// A hero, then a features block, then a price block, are later sections of the page.
function followingContent(kids, index) {
  const rest = kids.slice(index + 1);
  if (!rest.length) return null;
  if (rest.length === 1) return { content: rest[0], panels: null };
  if (rest.every((n) => BOX.has(n.type)) && new Set(rest.map(shapeKey)).size === 1) return { content: null, panels: rest };
  return null;
}

// The bar may sit inside the title block. The pane is the region under that block, not a sibling of the chips.
function pickBar(node) {
  const kids = visibleKids(node);
  for (let i = 0; i < kids.length; i++) {
    const bar = barInside(kids[i]);
    const follow = followingContent(kids, i);
    if (!bar || !follow) continue;
    const content = follow.content;
    if (content && (isSingleTab(content) || isNamedTabBar(content) || isActionBar(content))) continue;
    const below = content ?? follow.panels[0];
    if (!below?.box || !bar.box || below.box.absY < bar.box.absY + bar.box.h - 1) continue;
    if (content && !visibleKids(content).length && !(content.box.h > 0)) continue;
    const titles = rowTitles(bar);
    const active = activeTitle(titles, bar);
    const named = isNamedTabBar(bar) || isTabList(bar);
    const asked = /nhiều tab/.test(active.reason ?? '');
    if (!active.clear && !named && !asked) continue;
    return { bar, content, panels: follow.panels };
  }
  return null;
}

// A horizontal row of controls, one of them drawn open, with the data frame under it.
// The layer name is not required. Stacked title + content rows stay blocks.
function looseInspect(node) {
  const picked = pickBar(node);
  if (!picked) return null;
  const { bar, content, panels: directPanels } = picked;
  const titles = rowTitles(bar);
  const active = activeTitle(titles, bar);
  if (directPanels) {
    return { list: bar, titles, panels: directPanels, paneParent: node, active: active.index ?? 0, activeClear: active.clear };
  }
  if (isSingleTab(content) || isNamedTabBar(content)) return null;
  const inner = visibleKids(content);
  const named = inner.filter((n) => PANEL.test(n.name ?? ''));
  if (named.length === titles.length || named.length === 1) return { list: bar, titles, panels: named, paneParent: content, active: active.index ?? 0, activeClear: active.clear };
  const data = repeatedSet(inner);
  // Five matching cards are the open tab's data, not five panes. Bricks keeps one pane open
  // (tabs-nested.php: tab-content > tab-pane siblings; .tab-pane is hidden until .brx-open).
  if (data.ambiguous) {
    return { list: bar, titles, panels: [], ambiguous: data.groups, paneParent: content, active: active.index, activeClear: active.clear };
  }
  if (data.items.length >= 2) {
    return { list: bar, titles, panels: [], dataItems: data.items, paneParent: content, active: active.index, activeClear: active.clear };
  }
  // Two peer frames, one per title, are panes. A card plus a button under the open title is one region.
  const peers = inner.map(shapeKey);
  const onePaneEach = peers.length === inner.length && new Set(peers).size === 1;
  if (inner.length === titles.length && inner.length > 0 && onePaneEach) {
    return { list: bar, titles, panels: inner, paneParent: null, active: active.index ?? 0, activeClear: active.clear };
  }
  return { list: bar, titles, panels: [], paneParent: content, active: active.index, activeClear: active.clear };
}

const SELECTED = /^(selected|active|current|on|true)$/i;

function markedOpen(title) {
  for (const [key, value] of Object.entries(title.props ?? {})) {
    if (!/state|active|selected|property\s*1/i.test(key)) continue;
    if (value === true || SELECTED.test(String(value))) return true;
  }
  return false;
}

// The open trigger and the resting triggers are the same control. One extra badge is still that control.
// The layer name is not the comparison. A submit button with an icon is a different structure.
function samePeers(titles) {
  const counts = new Map();
  for (const title of titles) {
    const key = shapeKey(title);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const best = Math.max(0, ...counts.values());
  return best >= titles.length - 1 && best >= 2;
}

function similarWidth(titles) {
  const widths = titles.map((t) => t.box?.w ?? 0);
  if (widths.some((w) => w <= 0)) return false;
  return Math.max(...widths) / Math.min(...widths) <= 1.4;
}

function paintKey(n) {
  const fills = (n.fills ?? []).filter((f) => f.visible !== false);
  const fill = fills.map((f) => {
    if (f.type === 'SOLID') return `s:${f.hex}:${f.alpha ?? 1}`;
    if (String(f.type).startsWith('GRADIENT')) return `g:${(f.stops ?? []).map((s) => `${s.hex}:${s.position}`).join(',')}`;
    return f.type ?? '';
  }).join('|') || 'none';
  const ink = solid(firstText(n));
  return `${fill}/${ink ? `${ink.hex}:${ink.alpha ?? 1}` : ''}`;
}

function paintRank(title) {
  const fills = (title.fills ?? []).filter((f) => f.visible !== false);
  if (fills.some((f) => String(f.type).startsWith('GRADIENT'))) return 2;
  const solidFill = fills.find((f) => f.type === 'SOLID');
  return solidFill ? (solidFill.alpha ?? 1) : 0;
}

function majorityShape(nodes) {
  const counts = new Map();
  for (const n of nodes) {
    const key = shapeKey(n);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

// One trigger uses another fill while the rest share one look.
// Two triggers need a divider between them. A primary button beside a secondary button has no divider.
function paintedOpen(titles, { min = 3 } = {}) {
  if (titles.length < min || !samePeers(titles)) return null;
  if (titles.length > 2 && !similarWidth(titles)) return null;
  const groups = new Map();
  titles.forEach((title, i) => {
    const key = paintKey(title);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(i);
  });
  const sizes = [...groups.values()].sort((a, b) => b.length - a.length);
  if (titles.length === 2 && sizes.length === 2) {
    const [a, b] = titles.map(paintRank);
    if (a === b) return null;
    const index = a > b ? 0 : 1;
    if (shapeKey(titles[index]) !== shapeKey(titles[index === 0 ? 1 : 0])) return null;
    return { index, clear: true, reason: 'paint' };
  }
  if (sizes.length === 2 && sizes[0].length === titles.length - 1 && sizes[1].length === 1) {
    const index = sizes[1][0];
    const resting = sizes[0].map((i) => titles[i]);
    if (shapeKey(titles[index]) !== majorityShape(resting)) return null;
    return { index, clear: true, reason: 'paint' };
  }
  return null;
}

// One tab is open. A selected variant, else a bottom stroke, else one solid fill, else one peer painted differently.
// A divider lets two peers count. Two of the same mark, or none, is not a guess: the screen asks.
export function activeTitle(titles, row = null) {
  const marked = titles.map((t, i) => (markedOpen(t) ? i : -1)).filter((i) => i >= 0);
  if (marked.length === 1) return { index: marked[0], clear: true, reason: 'variant' };
  if (marked.length > 1) return { index: null, clear: false, reason: 'nhiều tab đang chọn' };
  const lined = titles.map((t, i) => ((t.stroke?.weights?.bottom ?? 0) > 0 ? i : -1)).filter((i) => i >= 0);
  if (lined.length === 1) return { index: lined[0], clear: true, reason: 'stroke' };
  if (lined.length > 1) return { index: null, clear: false, reason: 'nhiều tab có gạch chân' };
  const paintedAt = (title) => (title.fills ?? []).some((f) => f.visible !== false && (f.type === 'SOLID' || String(f.type).startsWith('GRADIENT')));
  const filled = titles.map((t, i) => (paintedAt(t) ? i : -1)).filter((i) => i >= 0);
  if (filled.length === 1 && samePeers(titles)) return { index: filled[0], clear: true, reason: 'fill' };
  const painted = paintedOpen(titles);
  if (painted) return painted;
  if (row && hasDivider(row, titles)) {
    const split = paintedOpen(titles, { min: 2 });
    if (split) return split;
  }
  if (filled.length > 1) return { index: null, clear: false, reason: 'nhiều tab có nền' };
  return { index: null, clear: false, reason: 'không thấy tab nào đang mở' };
}

// The row the visitor clicks. A name that says "tab" is a hint. The row is the control when one title is drawn open.
export function isActionBar(n) {
  const titles = rowTitles(n);
  if (!n || n.layout?.mode !== 'HORIZONTAL' || titles.length < 2 || !gapsAreSeparators(n, titles)) return false;
  if (isTabList(n) || isNamedTabBar(n)) return true;
  const active = activeTitle(titles, n);
  return active.clear === true && Number.isInteger(active.index);
}

function shapeKey(n) {
  const kids = visibleKids(n).map((c) => (c.type === 'TEXT' ? 'text' : c.svg ? 'svg' : c.type));
  return kids.join('+') || n.type;
}

// Siblings that share a structure. The layer name is not the group.
// A strictly larger group is the data. Two groups of the same size are not a guess.
export function repeatedSet(nodes) {
  const kids = (nodes ?? []).filter((n) => n && n.visible !== false);
  const rank = (groups) => {
    const sized = [...groups.values()].filter((g) => g.length >= 2).sort((a, b) => b.length - a.length);
    if (!sized.length) return null;
    if (sized.length > 1 && sized[0].length === sized[1].length) return { items: [], groups: sized, ambiguous: true };
    return { items: sized[0], groups: sized, ambiguous: false, name: sized[0][0].name };
  };
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

export function inspectClassic(node, list = listsIn(node)[0]) {
  return classicInspect(node, list);
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
    if (!found.panels.length && found.paneParent && found.activeClear && i === found.active) {
      return { title, label, drawn: drawnOf(found.paneParent), active: true };
    }
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
  figma: 'a row of controls with one drawn open, and the data frame under that row',
  bricks: '`tabs-nested` on the frame that holds both; the list is the tab menu, each Tab is a title, each Tab Panel is a pane',
  limits: 'The drawn open title is openTab (1.12.3, index from 0) and gets brx-open. A panel Figma does not draw comes from the Plan, blank stays empty. The open title carries every paint difference from the resting title (fill, text colour, stroke, a checked control and its mark). Bricks moves brx-open; the footer script sets aria-checked and input.checked from that class',
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
    const backgroundDecl = (title, suffix) => {
      const gradient = (title?.fills ?? []).filter((f) => f.visible !== false && f.type === 'GRADIENT_LINEAR').at(-1);
      if (gradient?.stops?.length && title.box?.w && title.box?.h) {
        return { decl: `background-image: ${linearGradientCss(gradient, title.box.w, title.box.h)}; background-color: transparent;`, suffix };
      }
      return { decl: `background-color: ${solid(title) ? cssColor(solid(title)) : 'transparent'};`, suffix };
    };
    const parent = (id) => {
      const walk = (n) => { for (const c of visibleKids(n)) { if (c.id === id) return n; const hit = walk(c); if (hit) return hit; } return null; };
      return walk(node);
    };
    const paneParent = panels[0] ? parent(panels[0].id) : (found.paneParent ?? null);
    const sample = panels[0];
    const sampleText = sample && firstText(sample);
    const titleCss = [
      backgroundDecl(idle, ' .tab-title'),
      backgroundDecl(on, ' .tab-title.brx-open'),
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
      out[title.id] = { settings: hidden(i === openAt ? 'tab-title brx-open' : 'tab-title'), dropSettings: line ? ['_background', '_gradient', '_border', '_boxShadow'] : ['_background', '_gradient'] };
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
    stampActive(out, titles, openAt);
    if (paneParent && paneParent.id !== node.id) {
      // The content frame is the pane parent. It has to be a block: an empty frame exported as svg does not render its children.
      out[paneParent.id] = { ...(out[paneParent.id] ?? {}), kind: 'block', settings: { ...(out[paneParent.id]?.settings ?? {}), ...hidden('tab-content') }, ...(missing.length ? { extraChildren } : {}) };
    } else if (paneParent && paneParent.id === node.id && missing.length && list) {
      out[node.id].extraChildren = extraChildren;
    }
    return out;
  },

  pageScript() {
    return '(function(){function sync(root){root.querySelectorAll("[data-f2b-check]").forEach(function(el){var title=el.closest(".tab-title");var on=!!(title&&title.classList.contains("brx-open"));el.setAttribute("aria-checked",on?"true":"false");var input=el.matches("input")?el:el.querySelector("input[type=radio],input[type=checkbox]");if(input)input.checked=on;});}document.querySelectorAll(".brxe-tabs-nested").forEach(function(root){sync(root);var obs=new MutationObserver(function(){sync(root);});root.querySelectorAll(".tab-title").forEach(function(title){obs.observe(title,{attributes:true,attributeFilter:["class"]});});});})();';
  },
};

function mergePatch(out, id, patch) {
  const prev = out[id] ?? {};
  const settings = { ...(prev.settings ?? {}) };
  if (patch.settings) Object.assign(settings, patch.settings);
  if (prev.settings?._cssClasses || patch.settings?._cssClasses) {
    settings._cssClasses = [prev.settings?._cssClasses, patch.settings?._cssClasses].filter(Boolean).join(' ');
  }
  if (prev.settings?._attributes || patch.settings?._attributes) {
    settings._attributes = [...(prev.settings?._attributes ?? []), ...(patch.settings?._attributes ?? [])];
  }
  out[id] = {
    ...prev,
    settings,
    css: [...(prev.css ?? []), ...(patch.css ?? [])],
    extraChildren: [...(prev.extraChildren ?? []), ...(patch.extraChildren ?? [])],
  };
}

// The resting title and the open title differ in more than the pill fill. Those differences
// follow brx-open, and a checked control is aria-checked only while its title is open.
function stampActive(out, titles, openAt) {
  const on = titles[openAt];
  const idle = titles.find((_, i) => i !== openAt);
  if (!on || !idle) return;
  const look = activeLook(idle, on, '.brx-open');
  if (!look.css.length && !look.controls.length && !look.clones.length) return;
  for (const title of titles) {
    mergePatch(out, title.id, { css: look.css });
    const open = title.id === on.id;
    for (const slot of look.classes) {
      const hit = nodeAt(title, slot.path);
      if (hit) mergePatch(out, hit.id, { settings: { _cssClasses: slot.className } });
    }
    for (const clone of look.clones) {
      if (nodeAt(title, clone.path)) continue;
      const parent = nodeAt(title, clone.parentPath);
      if (!parent) continue;
      mergePatch(out, parent.id, {
        settings: { _position: 'relative' },
        extraChildren: [{ name: clone.name, label: clone.label, like: clone.like, settings: markSettings(clone) }],
      });
    }
    for (const control of look.controls) {
      const hit = nodeAt(title, control.path);
      if (!hit) continue;
      mergePatch(out, hit.id, {
        settings: {
          _attributes: [
            { name: 'role', value: control.role },
            { name: 'aria-checked', value: open ? 'true' : 'false' },
            { name: 'data-f2b-check', value: control.role },
          ],
        },
      });
    }
  }
}
