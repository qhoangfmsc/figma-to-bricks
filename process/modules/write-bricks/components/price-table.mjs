// A price table whose plan carries a Service Pricing id.
// One drawn pill, one drawn card and one drawn info row stay. Query loops repeat them.
// Text that equals a cell of the loaded table becomes {vnx_sp_*}. Other text stays.
// Bricks 1.12.3 reads hasLoop + query.objectType on block/div (container.php).
// The plugin resolves vnxsp_{pkg|cycle|row}__{id} and {vnx_sp_*} at request time.
import { PartKind, isKind } from '../../recognize-parts/kinds.mjs';
import { FillType, isText, isType } from '../../recognize-parts/node-type.mjs';
import { visibleKids, hidden, flexDirectionCss, svgIcon } from '../../write-bricks/components/helpers.mjs';
import { tabsChromeCss } from '../../write-bricks/components/tabs-chrome.mjs';
import { queryType } from '../../write-bricks/components/price-data.mjs';
import { cssColor, px } from '../../write-bricks/render/utils/css.mjs';
import { linearGradientCss } from '../../write-bricks/render/utils/gradient.mjs';
import { peekOf } from '../../write-bricks/render/utils/peek-scroll.mjs';
import { ComponentState, componentState } from '../../write-bricks/components/states.mjs';
import { selectOptionHost, selectScript, selectShell } from '../../write-bricks/components/select.mjs';
import { showsPrice } from '../../recognize-parts/rules/layout-only.mjs';
import tabSwitch, { activeTitle } from '../../write-bricks/components/tab-switch.mjs';
import { compareFrames } from '../../write-bricks/components/compare-table.mjs';

const cache = new WeakMap();
const claimedHosts = new WeakMap();
const norm = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => norm(value).toLocaleLowerCase('vi');
const shown = (value) => fold(String(value ?? '').replaceAll('/', '|'));
const same = (drawn, cell) => {
  const left = fold(drawn);
  const right = fold(cell);
  return !!left && !!right && (left === right || left === shown(cell));
};
const digits = (value) => String(value ?? '').replace(/\D/g, '');
const sameAmount = (drawn, cell) => {
  const left = digits(drawn);
  const right = digits(cell);
  return left.length >= 3 && left === right;
};
const struck = (textNode) => textNode.text?.decoration === 'STRIKETHROUGH' || (textNode.text?.runs ?? []).some((run) => run.style?.textDecoration === 'STRIKETHROUGH');
const unitShape = (word) => /^\/\S{1,12}$/.test(norm(word));
const percentShape = (word) => /^[-+]?\d+(?:[.,]\d+)?%$/.test(norm(word));

// The drawn percent is the chip's look. The number is the table tag when that cell is filled,
// otherwise the gap between the old price and the sale price.
export function discountPercent(regular, sale) {
  const left = Number(String(regular ?? '').replace(/\D/g, ''));
  const right = Number(String(sale ?? '').replace(/\D/g, ''));
  if (!left || !right || left <= right) return 0;
  return Math.round(((left - right) / left) * 100);
}

function textsIn(node, out = []) {
  if (!node || node.visible === false) return out;
  if (isText(node) && !node.svg && node.text?.characters) out.push(node);
  for (const child of node.children ?? []) textsIn(child, out);
  return out;
}

function hasWords(node, pred) {
  return textsIn(node).some((text) => pred(norm(text.text.characters)));
}

function parentOf(root, id) {
  let found = null;
  const walk = (node) => {
    for (const child of node?.children ?? []) {
      if (!child) continue;
      if (child.id === id) { found = node; return; }
      walk(child);
      if (found) return;
    }
  };
  walk(root);
  return found;
}

function contains(node, id) {
  return !!node && (node.id === id || visibleKids(node).some((child) => contains(child, id)));
}

function bestGroup(scope, pred, min = 1) {
  let found = null;
  const walk = (node) => {
    const items = visibleKids(node).filter(pred);
    if (items.length >= min && (!found || items.length > found.items.length)) found = { host: node, items };
    visibleKids(node).forEach(walk);
  };
  if (scope) walk(scope);
  return found;
}

function climb(start, root, pred, min) {
  let current = start;
  let found = null;
  while (current) {
    const group = bestGroup(current, pred, min);
    if (group && (!found || group.items.length > found.items.length)) found = group;
    if (!root || current.id === root.id) break;
    current = parentOf(root, current.id);
  }
  return found;
}

function findById(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function hasSvg(node) {
  if (!node || node.visible === false) return false;
  if (node.svg) return true;
  return visibleKids(node).some(hasSvg);
}

function flowSettings(node) {
  const layout = node?.layout ?? {};
  if (layout.mode !== 'HORIZONTAL' && layout.mode !== 'VERTICAL') return { _display: 'flex' };
  const horizontal = layout.mode === 'HORIZONTAL';
  const align = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', BASELINE: 'baseline' }[layout.counterAlign] ?? 'flex-start';
  return {
    _display: 'flex',
    _direction: horizontal ? 'row' : 'column',
    _alignItems: align,
    _flexWrap: layout.wrap ? 'wrap' : 'nowrap',
    ...(typeof layout.gap === 'number' ? { [horizontal ? '_columnGap' : '_rowGap']: `${layout.gap}px` } : {}),
  };
}

// The loop repeats one pill, so the selected fill cannot stay on that node.
// Whatever fill that pill has is copied. The fill type is not how the open pill is chosen.
function titleBackground(title) {
  const gradient = (title?.fills ?? []).filter((fill) => fill.visible !== false && fill.type === 'GRADIENT_LINEAR').at(-1);
  if (gradient?.stops?.length && title.box?.w && title.box?.h) {
    return `background-image: ${linearGradientCss(gradient, title.box.w, title.box.h)}; background-color: transparent;`;
  }
  const fill = solidFill(title);
  return `background-color: ${fill ? cssColor(fill) : 'transparent'};`;
}

function hoverState(item) {
  const state = componentState(item);
  return state === ComponentState.HOVER || state === ComponentState.FOCUS || state === ComponentState.PRESSED;
}

function pickCyclePair(items, selectedId, selectedLabel = '') {
  const peers = items.filter((item) => !hoverState(item));
  const pool = peers.length >= 2 ? peers : items;
  // The open pill is named by its id in the frame it was chosen in, and by its words in any other frame of the same table.
  const named = (selectedId ? items.find((item) => item.id === selectedId) : null)
    ?? (selectedLabel ? items.find((item) => textsIn(item).some((word) => same(word.text.characters, selectedLabel))) : null);
  const found = activeTitle(pool);
  const active = named ?? (found.clear && Number.isInteger(found.index) ? pool[found.index] : null);
  const rest = pool.find((item) => item !== active && componentState(item) === ComponentState.REST)
    ?? pool.find((item) => item !== active)
    ?? items.find((item) => item !== active);
  return { active, rest };
}

function rowScrolls(node, root) {
  if (!node || node.layout?.mode !== 'HORIZONTAL' || visibleKids(node).length < 2) return false;
  if (node.clip) return true;
  let parent = parentOf(root, node.id);
  while (parent) {
    if (parent.clip && parent.box && node.box && node.box.w > parent.box.w + 0.5) return true;
    if (!root || parent.id === root.id) break;
    parent = parentOf(root, parent.id);
  }
  return false;
}

function spills(parent) {
  const walk = (node) => (node.children ?? []).some((child) => {
    if (!child || child.visible === false) return false;
    const box = child.box;
    const host = node.box;
    if (box && host && (box.x < -0.5 || box.y < -0.5 || box.x + box.w > host.w + 0.5 || box.y + box.h > host.h + 0.5)) return true;
    return walk(child);
  });
  return walk(parent);
}

const solidFill = (node) => (node?.fills ?? []).filter((fill) => fill.type === 'SOLID' && fill.visible !== false).at(-1);

function loop(kind, id) {
  return { hasLoop: true, query: { objectType: queryType(kind, id) } };
}

// One list for the plan and the render. A filled plan line replaces the default.
// data-product-category has no cell in the table, so its default stays empty.
export const REGISTER_BUTTON_FIELDS = [
  { id: 'href', value: '{vnx_sp_link}', slot: 'href' },
  { id: 'rel', value: 'nofollow', slot: 'rel' },
  { id: 'class', value: 'vnx-button vnx-btn-conversion vnx-button-register', slot: 'class' },
  { id: 'data-price', value: '{vnx_sp_sale:raw}', slot: 'data' },
  { id: 'data-period', value: '{vnx_sp_cycle}', slot: 'data' },
  { id: 'data-product-name', value: '{vnx_sp_name}', slot: 'data' },
  { id: 'data-product-category', value: '', slot: 'data' },
];

export const registerAttrKey = (node, id) => `pattr:${node}|${id}`;

function registerValue(attrs, field) {
  const typed = attrs?.[field.id];
  if (typeof typed === 'string' && typed.trim()) return typed.trim();
  return field.value;
}

function registerButton(text, attrs) {
  const href = registerValue(attrs, REGISTER_BUTTON_FIELDS.find((field) => field.slot === 'href'));
  const rel = registerValue(attrs, REGISTER_BUTTON_FIELDS.find((field) => field.slot === 'rel'));
  const css = registerValue(attrs, REGISTER_BUTTON_FIELDS.find((field) => field.slot === 'class'));
  const data = REGISTER_BUTTON_FIELDS.filter((field) => field.slot === 'data')
    .map((field) => ({ name: field.id, value: registerValue(attrs, field) }))
    .filter((attr) => attr.value);
  return {
    text,
    tag: 'a',
    link: { type: 'external', url: href, ...(rel ? { rel } : {}) },
    ...(css ? { _cssClasses: css } : {}),
    ...(data.length ? { _attributes: data } : {}),
  };
}

function tagText(patches, id, tag) {
  const prev = patches[id] ?? {};
  patches[id] = { ...prev, settings: { ...(prev.settings ?? {}), text: tag } };
}

function priceScene(node, table, id, root) {
  const empty = { tabsHost: null, card: null, patches: {}, omit: [], warnings: [], skip: false };
  if (!table?.packages?.length || !table.cycles?.length || !id) return { stop: empty };
  const scopeRoot = root ?? node;
  const packOf = (item) => table.packages.find((itemPack) => hasWords(item, (word) => same(word, itemPack.name)));
  const isPackage = (item) => !!packOf(item) || showsPrice(item);
  const hasTitle = (item) => textsIn(item).some((text) => {
    const word = norm(text.text.characters);
    return word && !unitShape(word) && !showsPrice(text) && !/^[\d\s.,]+$/.test(word);
  });
  const inFlow = (item) => item.place !== 'ABSOLUTE';
  const many = climb(node, scopeRoot, (item) => inFlow(item) && isPackage(item), 2);
  let cards = many;
  if (!cards) {
    let one = null;
    const walkOne = (current) => {
      if (current && inFlow(current) && isPackage(current) && textsIn(current).length >= 3) one = current;
      visibleKids(current).forEach(walkOne);
    };
    walkOne(scopeRoot);
    if (one) {
      let row = parentOf(scopeRoot, one.id);
      if (row && visibleKids(row).length < 2) row = parentOf(scopeRoot, row.id) ?? row;
      cards = { host: row ?? one, items: [one] };
    }
  }
  const priceHeavy = (item) => {
    const words = textsIn(item).map((text) => norm(text.text.characters)).filter(Boolean);
    const prices = words.filter((word) => unitShape(word) || showsPrice({ type: 'TEXT', text: { characters: word }, children: [] }) || /^[\d\s.,]+$/.test(word));
    return prices.length >= 2 && prices.length >= words.length - 1;
  };
  // A frame that already shows a price is a card, not a cycle pill. A cycle word inside that card is not a second pill row.
  const isCycle = (item) => !isPackage(item) && hasWords(item, (word) => table.cycles.some((cycle) => same(word, cycle.label)));
  const closedCycleField = (scope) => {
    let found = null;
    const walk = (current) => {
      if (!current || current.visible === false) return;
      const labels = textsIn(current).filter((text) => table.cycles.some((cycle) => same(text.text.characters, cycle.label)));
      const names = new Set(labels.map((text) => fold(text.text.characters)));
      const icon = visibleKids(current).some((child) => textsIn(child).length === 0);
      if (names.size === 1 && icon && !isPackage(current) && (!found || textsIn(current).length < textsIn(found).length)) found = current;
      visibleKids(current).forEach(walk);
    };
    walk(scope);
    return found;
  };
  const cycleRow = bestGroup(scopeRoot, isCycle, 2);
  const cycleField = cycleRow ? null : closedCycleField(scopeRoot);
  const cycles = cycleRow ?? (cycleField ? { host: cycleField, items: [cycleField] } : bestGroup(scopeRoot, isCycle, 1));
  if (!cards) return { stop: { ...empty, warnings: ['no drawn card matches a package name in this table'] } };
  const claims = claimedHosts.get(scopeRoot) ?? new Set();
  claimedHosts.set(scopeRoot, claims);
  if (claims.has(cards.host.id)) return { stop: { ...empty, skip: true, card: cards.items[0] } };
  claims.add(cards.host.id);

  const shellMarks = (item) => {
    const kids = visibleKids(item);
    const bodies = kids.filter((child) => isPackage(child) && textsIn(child).length >= 3);
    if (!bodies.length) return [];
    return kids.filter((child) => !bodies.includes(child));
  };
  let card = cards.items.find((item) => packOf(item) && !shellMarks(item).length)
    ?? cards.items.find((item) => packOf(item))
    ?? cards.items.find((item) => !shellMarks(item).length)
    ?? cards.items[0];
  // One visible card: the grouped node is the price block. The loop is the whole card, so the title and the list stay.
  const titleBeside = visibleKids(cards.host).some((kid) => kid.id !== card.id && hasTitle(kid) && !showsPrice(kid) && !isCycle(kid));
  if (cards.items.length === 1 && card.id !== cards.host.id && priceHeavy(card) && titleBeside && contains(cards.host, card.id)) {
    card = cards.host;
  }
  const pack = packOf(card) ?? table.packages[0];
  const infoItemShape = (item) => (hasSvg(item) || hasWords(item, (word) => pack.info.some((info) => same(word, info.text)))) && textsIn(item).length >= 1;
  const rows = bestGroup(card, infoItemShape, 2) ?? bestGroup(card, infoItemShape, 1);
  return { scopeRoot, packOf, isPackage, isCycle, cards, cycles, cycleField, card, pack, rows };
}

function openCycle(table, cycles, cycleField, selectedId, chipCycle, selectedLabel = '') {
  let openAt = 0;
  const pair = cycles ? pickCyclePair(cycles.items, selectedId, selectedLabel) : { active: null, rest: null };
  // A pill that draws a percent chip is the loop pill, so the chip takes the cycle's tag from the table for every cycle. The shape decides;
  // `chipCycle: false` in the detection turns it off.
  const chipped = chipCycle === false ? null : (cycles?.items ?? []).find((item) => item !== pair.active && !hoverState(item) && textsIn(item).some((word) => percentShape(word.text?.characters)));
  const cycleProto = chipped ?? pair.rest ?? cycles?.items[0];
  const cycleActive = pair.active;
  const indexOf = (item) => {
    const label = textsIn(item).map((text) => text.text.characters).find((word) => table.cycles.some((cycle) => same(word, cycle.label)));
    const index = table.cycles.findIndex((cycle) => same(label, cycle.label));
    return index >= 0 ? index : null;
  };
  if (cycleActive) {
    const index = indexOf(cycleActive);
    if (index != null) openAt = index;
  }
  if (cycleField) {
    const index = indexOf(cycleField);
    if (index != null) openAt = index;
  }
  return { openAt, cycleProto, cycleActive };
}

function omitDrawnCopies(omit, { cards, card, packOf, rows, cycles, cycleProto, cycleField }) {
  if (cycles && cycleProto && !cycleField) {
    const kids = visibleKids(cycles.host);
    const pillsOnly = kids.every((item) => item.id === cycleProto.id || !contains(item, card?.id));
    const extras = pillsOnly ? kids : cycles.items;
    for (const item of extras) {
      if (item.id !== cycleProto.id) omit.push(item.id);
    }
  }
  const inTable = (item) => !!packOf(item);
  if (card.id !== cards.host.id) cards.items.filter((item) => item.id !== card.id && inTable(item)).forEach((item) => omit.push(item.id));
  if (cards.items.length === 1 && cards.items[0].id !== cards.host.id && card.id !== cards.host.id) {
    visibleKids(cards.host).forEach((child) => {
      if (child.id !== card.id && !contains(child, card.id) && inTable(child)) omit.push(child.id);
    });
  }
  if (rows) rows.items.slice(1).forEach((item) => omit.push(item.id));
}

function cardFlanks(cards, card, isPackage, isCycle) {
  const kids = visibleKids(cards.host);
  const cardIndex = kids.findIndex((child) => child.id === card.id || contains(child, card.id));
  const sideControl = (item) => item && item.id !== card.id && !contains(item, card.id) && !isPackage(item) && !isCycle(item) && textsIn(item).length <= 1;
  const flanks = cards.items.length === 1
    ? { prev: sideControl(kids[cardIndex - 1]) ? kids[cardIndex - 1] : null, next: sideControl(kids[cardIndex + 1]) ? kids[cardIndex + 1] : null }
    : { prev: null, next: null };
  return { flanks, moveCards: !!(flanks.prev || flanks.next) };
}

function cycleTabsHost(cards, cycles, scopeRoot) {
  let tabsHost = null;
  if (cycles) {
    let cursor = cards.host;
    while (cursor) {
      if (contains(cursor, cycles.host.id) && contains(cursor, cards.host.id)) tabsHost = cursor.id;
      if (cursor.id === scopeRoot.id) break;
      cursor = parentOf(scopeRoot, cursor.id);
    }
  }
  const tabsNode = tabsHost === cards.host.id ? cards.host : (tabsHost ? findById(scopeRoot, tabsHost) : null);
  return { tabsHost, tabsNode };
}

function cycleScrollHost(cards, scopeRoot) {
  let current = cards.host;
  while (current) {
    if (rowScrolls(current, scopeRoot)) return current;
    if (!scopeRoot || current.id === scopeRoot.id) break;
    current = parentOf(scopeRoot, current.id);
  }
  return null;
}

function cycleActiveCss(table, cycleActive, cycleProto) {
  const activeCss = [];
  if (!cycleActive || !cycleProto || cycleActive.id === cycleProto.id) return activeCss;
  const idleBg = titleBackground(cycleProto);
  const openBg = titleBackground(cycleActive);
  if (idleBg !== openBg) {
    activeCss.push({ decl: idleBg, suffix: ' .tab-title' });
    activeCss.push({ decl: openBg, suffix: ' .tab-title.brx-open' });
  }
  const inkOf = (item) => solidFill(textsIn(item).find((text) => table.cycles.some((cycle) => same(text.text.characters, cycle.label))));
  const idleInk = inkOf(cycleProto);
  const openInk = inkOf(cycleActive);
  if (idleInk && openInk && cssColor(idleInk) !== cssColor(openInk)) {
    activeCss.push({ decl: `color: ${cssColor(idleInk)};`, suffix: ' .tab-title :is(.brxe-text-basic, .brxe-heading)' });
    activeCss.push({ decl: `color: ${cssColor(openInk)};`, suffix: ' .tab-title.brx-open :is(.brxe-text-basic, .brxe-heading)' });
  }
  return activeCss;
}

// Before any tab carries `brx-open` (a loop gives none, and a delayed script gives it late), the cycle that is open at the start is chosen
// by its place, so the first paint already shows it. Once a visitor or the script sets `brx-open`, these rules stop matching.
const NONE_OPEN_PANE = ':not(:has(.tab-pane.brx-open))';
const NONE_OPEN_TITLE = ':not(:has(.tab-title.brx-open))';
function openPaneCss(openAt) {
  if (!(openAt > 0)) return [];
  return [
    { decl: 'display: none;', suffix: `${NONE_OPEN_PANE} .tab-pane:first-child` },
    { decl: 'display: none;', suffix: `${NONE_OPEN_PANE} template + .tab-pane` },
    { decl: 'display: flex;', suffix: `${NONE_OPEN_PANE} .tab-pane:nth-of-type(${openAt + 1})` },
  ];
}
function openTitleCss(activeCss, openAt) {
  if (!(openAt >= 0)) return [];
  return activeCss.filter((rule) => rule.suffix.includes('.tab-title.brx-open')).map((rule) => ({
    decl: rule.decl,
    suffix: rule.suffix.replace(' .tab-title.brx-open', `${NONE_OPEN_TITLE} .tab-title:nth-of-type(${openAt + 1})`),
  }));
}

// A cycle that is flagged popular draws a mark over its pill (an illustration drawn in the pill that is open in Figma). The mark is shown only on
// the pills whose cycle cell carries `{vnx_sp_cycle_label}`, and never when that tag is empty or left unresolved.
const shownCycle = '[data-vnx-sp-cycle-popular]:not([data-vnx-sp-cycle-popular=""]):not([data-vnx-sp-cycle-popular*="vnx_sp_"])';
const CYCLE_POPULAR_SHOWN = [[
  { key: 'dynamic_data', dynamic_data: '{vnx_sp_cycle_label}', compare: 'empty_not' },
  { key: 'dynamic_data', dynamic_data: '{vnx_sp_cycle_label}', compare: 'not_contains', value: '{' },
]];
function bindPopularCycle(put, { cycles, cycleProto, table }) {
  if (!cycles || !cycleProto) return;
  const owner = cycles.items.filter((item) => item !== cycleProto)
    .find((item) => visibleKids(item).some((child) => child.place === 'ABSOLUTE' && child.svg && !textsIn(child).length));
  const mark = owner ? visibleKids(owner).find((child) => child.place === 'ABSOLUTE' && child.svg && !textsIn(child).length) : null;
  // Figma decides which cycle carries the mark: the place of the pill that draws it, among the cycles of the table.
  const label = owner ? textsIn(owner).map((word) => word.text.characters).find((word) => table.cycles.some((cycle) => same(word, cycle.label))) : '';
  const at = table.cycles.findIndex((cycle) => same(label, cycle.label));
  const icon = mark ? svgIcon(mark) : null;
  if (!icon) return;
  // The pill is looped, so its css sits on the row of pills.
  put(cycles.host.id, { css: [{ decl: 'visibility: hidden;', suffix: ' .f2b-popular-cycle' }, { decl: 'visibility: visible;', suffix: ` ${shownCycle} .f2b-popular-cycle` }, ...(at >= 0 ? [{ decl: 'visibility: visible;', suffix: `:not(:has(${shownCycle})) .tab-title[data-vnx-sp-cycle-name="${plain(table.cycles[at].label)}"] .f2b-popular-cycle` }] : [])] });
  put(cycleProto.id, {
    settings: { _position: 'relative', _attributes: [{ name: 'data-vnx-sp-cycle-popular', value: '{vnx_sp_cycle_label}' }, { name: 'data-vnx-sp-cycle-name', value: '{vnx_sp_cycle}' }] },
    extraChildren: [{
      place: 'after',
      name: 'icon',
      label: 'Popular cycle',
      settings: {
        icon,
        _position: 'absolute',
        _left: px(mark.box.x),
        _top: px(mark.box.y),
        _width: px(mark.box.w),
        _height: px(mark.box.h),
        _conditions: CYCLE_POPULAR_SHOWN,
        _hidden: { _cssClasses: 'f2b-popular-cycle' },
      },
    }],
  });
}

function bindCycleShell(put, { table, id, scopeRoot, cards, cycles, cycleField, cycleProto, cycleActive, openAt, moveCards }) {
  const { tabsHost, tabsNode } = cycleTabsHost(cards, cycles, scopeRoot);
  if (tabsHost) {
    const hostNode = tabsNode ?? cards.host;
    put(tabsHost, {
      kind: 'tabs-nested',
      settings: { openTab: String(openAt), _attributes: [{ name: 'data-vnx-sp-open', value: String(openAt) }] },
      css: [...flexDirectionCss(hostNode), ...tabsChromeCss(), ...openPaneCss(openAt)],
    });
    const activeCss = cycleActiveCss(table, cycleActive, cycleProto);
    const scrollNode = cycleScrollHost(cards, scopeRoot);
    const scrollHere = scrollNode?.id === cards.host.id;
    if (cycleField) {
      const menu = parentOf(scopeRoot, cycleField.id);
      const menuId = menu && !contains(menu, cards.host.id) ? menu.id : cycleField.id;
      const line = (cycleField.stroke?.paints ?? []).find((paint) => paint.visible !== false);
      const lineColor = line ? cssColor(line) : 'currentColor';
      const lineWidth = cycleField.stroke?.weight || 1;
      const lineRadius = Array.isArray(cycleField.radius) ? cycleField.radius[0] : 0;
      const drawn = textsIn(cycleField).map((text) => text.text.characters).find((word) => table.cycles.some((cycle) => same(word, cycle.label))) || '';
      const pad = cycleField.layout?.padding;
      const padCss = pad ? `padding:${pad.top}px ${pad.right}px ${pad.bottom}px ${pad.left}px;` : '';
      put(menuId, selectShell({ lineWidth, lineColor, lineRadius, padCss, value: drawn }));
      const option = selectOptionHost();
      put(cycleField.id, {
        ...option,
        settings: { ...option.settings, ...hidden('tab-title'), ...loop('cycle', id) },
      });
    } else {
      put(cycles.host.id, {
        settings: { ...hidden('tab-menu'), _overflow: 'visible', _justifyContent: 'center', _attributes: [{ name: 'data-vnx-sp-dropdown', value: '1' }] },
        css: [...activeCss, ...openTitleCss(activeCss, openAt), { decl: 'overflow: visible; justify-content: center;', suffix: '' }],
      });
      if (cycleProto?.type !== 'TEXT') {
        const room = cycleProto.layout?.padding;
        put(cycleProto.id, {
          settings: {
            ...hidden('tab-title'),
            ...loop('cycle', id),
            _width: 'auto',
            _widthMin: cycleProto.box?.w ? px(cycleProto.box.w) : undefined,
            _widthMax: 'none',
            _flexShrink: 0,
            _justifyContent: 'center',
            ...(room ? { _padding: { top: px(room.top), right: px(room.right), bottom: px(room.bottom), left: px(room.left) } } : {}),
          },
        });
      }
    }
    put(cards.host.id, {
      settings: {
        ...hidden('tab-content'),
        ...(moveCards ? { _attributes: [{ name: 'data-vnx-sp-deck', value: '1' }] } : {}),
        ...(scrollHere ? { _overflow: 'auto', _width: '100%', _flexWrap: 'nowrap' } : {}),
      },
      ...(scrollHere ? { css: [{ decl: 'overflow-x: auto; flex-wrap: nowrap;', suffix: '' }] } : {}),
      wrapChildren: {
        label: 'Cycle',
        settings: {
          ...hidden('tab-pane'),
          ...loop('cycle', id),
          ...flowSettings(cards.host),
          ...(cards.host.layout?.mode === 'HORIZONTAL' && !scrollHere ? { _alignItems: 'stretch', _overflow: 'visible', _flexWrap: 'nowrap', _width: '100%' } : {}),
          ...(moveCards ? { _overflow: 'auto' } : {}),
        },
        css: [
          ...(scrollHere ? [{ decl: 'width: max-content; flex-wrap: nowrap;', suffix: '' }] : []),
          ...(moveCards && !scrollHere ? [{ decl: 'overflow-x: auto; flex-wrap: nowrap;', suffix: '' }] : []),
          ...(cards.host.layout?.mode === 'HORIZONTAL' && !scrollHere ? [{ decl: 'align-items: stretch; flex-wrap: nowrap; overflow: visible; width: 100%;', suffix: '' }] : []),
        ],
      },
    });
    if (scrollNode && !scrollHere) {
      put(scrollNode.id, {
        settings: { _overflow: 'auto', _width: '100%', _flexWrap: 'nowrap' },
        css: [{ decl: 'overflow-x: auto; flex-wrap: nowrap;', suffix: '' }],
      });
    }
  } else if (cycleProto && cycleProto.type !== 'TEXT') {
    put(cycleProto.id, { settings: loop('cycle', id) });
  }
  return tabsHost;
}

function bindCardRow(put, { cards, card, id, omit, flanks, moveCards, tabsHost, isCycle, rows, scopeRoot }) {
  const peeked = peekOf(cards.host, scopeRoot);
  const shareRow = cards.host.layout?.mode === 'HORIZONTAL' && !rowScrolls(cards.host, scopeRoot) && !peeked;
  if (card.type !== 'TEXT') {
    put(card.id, {
      settings: {
        ...loop('pkg', id),
        ...(moveCards ? { _attributes: [{ name: 'data-vnx-sp-card', value: '1' }] } : {}),
        ...(spills(card) ? { _overflow: 'hidden' } : {}),
        ...(peeked && card.box ? { _width: px(card.box.w), _flexShrink: 0, _widthMax: 'none' } : {}),
        ...(shareRow ? { _flexGrow: 1, _flexShrink: 1, _flexBasis: '0', _width: 'auto', _widthMin: '0px', _widthMax: '100%', _alignSelf: 'stretch', _height: 'auto', _overflow: 'visible' } : {}),
        ...(!shareRow && cards.host.layout?.mode === 'HORIZONTAL' ? { _alignSelf: 'stretch', _height: 'auto' } : {}),
      },
      ...(shareRow ? { css: [{ decl: 'flex: 1 1 0; min-width: 0; max-width: 100%; align-self: stretch; height: auto; overflow: visible;', suffix: '' }] } : {}),
      ...(!shareRow && cards.host.layout?.mode === 'HORIZONTAL' ? { css: [{ decl: 'align-self: stretch; height: auto;', suffix: '' }] } : {}),
    });
  }
  const shareCard = (item) => {
    put(item.id, {
      settings: {
        _alignSelf: 'stretch',
        _height: 'auto',
        ...(shareRow ? { _flexGrow: 1, _flexShrink: 1, _flexBasis: '0', _width: 'auto', _widthMin: '0px', _widthMax: '100%', _overflow: 'visible' } : {}),
        ...(item.layout?.mode === 'HORIZONTAL' ? { _alignItems: 'stretch' } : {}),
      },
      css: [{ decl: `${shareRow ? 'flex: 1 1 0; min-width: 0; max-width: 100%; overflow: visible; ' : ''}align-self: stretch; height: auto;${item.layout?.mode === 'HORIZONTAL' ? ' align-items: stretch;' : ''}`, suffix: '' }],
    });
  };
  if (cards.host.layout?.mode === 'HORIZONTAL') {
    put(cards.host.id, { settings: { _alignItems: 'stretch', ...(shareRow ? { _overflow: 'visible', _width: '100%' } : {}) }, css: [{ decl: `align-items: stretch;${shareRow ? ' overflow: visible; width: 100%;' : ''}`, suffix: '' }] });
    for (const sibling of visibleKids(cards.host)) {
      if (omit.includes(sibling.id) || sibling.id === card.id) continue;
      if (sibling.id === flanks.prev?.id || sibling.id === flanks.next?.id || isCycle(sibling)) continue;
      shareCard(sibling);
    }
    if (card.layout?.mode === 'HORIZONTAL') {
      put(card.id, { settings: { _alignItems: 'stretch' }, css: [{ decl: 'align-items: stretch;', suffix: '' }] });
    }
  }
  if (moveCards && !tabsHost) put(cards.host.id, { settings: { _attributes: [{ name: 'data-vnx-sp-deck', value: '1' }] } });
  if (flanks.prev) put(flanks.prev.id, { settings: { _attributes: [{ name: 'data-vnx-sp-prev', value: '1' }] } });
  if (flanks.next) put(flanks.next.id, { settings: { _attributes: [{ name: 'data-vnx-sp-next', value: '1' }] } });
  if (rows && rows.items[0].type !== 'TEXT') put(rows.items[0].id, { settings: loop('row', id) });
}

function bindCycleWords(put, patches, used, { table, cycleProto, cycleField }) {
  const take = (textNode, tag) => { tagText(patches, textNode.id, tag); used.add(textNode.id); };
  const showBadge = [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_cycle_badge}', compare: 'empty_not' }]];
  let taggedBadge = false;
  const badgeWord = (word) => /^[-+]?\d/.test(norm(word)) || /%$/.test(norm(word));
  const protoTexts = textsIn(cycleProto);
  const matchedLabel = protoTexts.find((textNode) => table.cycles.some((cycle) => same(textNode.text.characters, cycle.label)));
  const labelNode = matchedLabel ?? protoTexts.find((textNode) => !badgeWord(textNode.text.characters)) ?? protoTexts[0];
  for (const textNode of protoTexts) {
    if (labelNode && textNode.id === labelNode.id) {
      take(textNode, '{vnx_sp_cycle}');
      continue;
    }
    take(textNode, '{vnx_sp_cycle_badge}');
    const chipInk = solidFill(textNode);
    // The open pill turns its words white; the chip keeps the ink it was drawn with.
    if (chipInk) put(textNode.id, { css: [{ decl: `color: ${cssColor(chipInk)} !important;`, suffix: '' }] });
    if (cycleField) {
      const host = parentOf(cycleField, textNode.id);
      const badgeHost = host && host.id !== cycleField.id ? host.id : textNode.id;
      put(badgeHost, { settings: { _conditions: showBadge, _hidden: { _cssClasses: 'f2b-select-badge' } } });
      taggedBadge = true;
    }
  }
  if (cycleField && !taggedBadge) {
    put(cycleField.id, {
      extraChildren: [{ name: 'text-basic', label: 'Badge', settings: { text: '{vnx_sp_cycle_badge}', _conditions: showBadge, _hidden: { _cssClasses: 'f2b-select-badge' } } }],
    });
  }
}

function bindInfoRow(put, patches, used, { table, pack, rows }) {
  const take = (textNode, tag) => { tagText(patches, textNode.id, tag); used.add(textNode.id); };
  const infoItem = rows?.items[0];
  if (!infoItem) return;
  const labels = new Set(table.rows.map((row) => fold(row.label)).filter(Boolean));
  const descs = new Set(table.rows.map((row) => fold(row.desc)).filter(Boolean));
  const infoValues = new Set(pack.info.map((item) => fold(item.text)).filter(Boolean));
  const extraValues = new Set(pack.info.map((item) => fold(item.extra)).filter(Boolean));
  const infoTexts = textsIn(infoItem);
  for (const textNode of infoTexts) {
    const word = fold(textNode.text.characters);
    if (descs.has(word)) take(textNode, '{vnx_sp_row_desc}');
    else if (labels.has(word) && !infoValues.has(word) && !extraValues.has(word)) take(textNode, '{vnx_sp_row}');
    else if (infoValues.has(word)) take(textNode, '{vnx_sp_info}');
    else if (extraValues.has(word)) take(textNode, '{vnx_sp_info_extra}');
  }
  const open = infoTexts.filter((textNode) => !used.has(textNode.id));
  const infoTagged = infoTexts.some((textNode) => (patches[textNode.id]?.settings?.text) === '{vnx_sp_info}');
  const extraTagged = infoTexts.some((textNode) => (patches[textNode.id]?.settings?.text) === '{vnx_sp_info_extra}');
  if (!infoTagged && open[0]) take(open[0], '{vnx_sp_info}');
  if (!extraTagged && open[1]) take(open[1], '{vnx_sp_info_extra}');
  for (const textNode of infoTexts) {
    if ((patches[textNode.id]?.settings?.text) === '{vnx_sp_info}') {
      put(textNode.id, { settings: { _typography: { 'white-space': 'normal' } } });
    }
  }
  const icon = visibleKids(infoItem).find((child) => hasSvg(child) && !/question|help|tooltip/i.test(child.name || ''));
  const fontIcon = pack.info.some((item) => /^fa[\w-]*\s+fa-|^fa-/.test(item.icon || ''));
  if (icon && fontIcon) {
    put(icon.id, {
      skipChildren: true,
      settings: {
        tag: 'i',
        text: '',
        _cssClasses: '{vnx_sp_info_icon}',
        ...(icon.box?.w ? { _width: px(icon.box.w), _height: px(icon.box.h || icon.box.w) } : {}),
        _conditions: [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_info_icon}', compare: 'empty_not' }]],
      },
    });
  } else if (icon) {
    const glyph = (which, name) => ({
      icon: { library: 'fontawesome', icon: name },
      ...(icon.box?.h ? { iconSize: px(Math.max(icon.box.w || 0, icon.box.h)) } : {}),
      _conditions: [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_info_icon}', compare: '==', value: which }]],
    });
    put(icon.id, { kind: 'icon', skipChildren: true, dropSettings: ['text'], settings: glyph('yes', 'fa-solid fa-check') });
    put(icon.id, { extraChildren: [
      { name: 'icon', label: 'No', settings: glyph('no', 'fa-solid fa-xmark') },
      { name: 'icon', label: 'Highlight', settings: glyph('highlight', 'fa-solid fa-star') },
    ] });
  }
}

function bindCardSlots(put, patches, used, { table, pack, price, card, rows, attrs, exactPrice, rootId }) {
  const take = (textNode, tag) => { tagText(patches, textNode.id, tag); used.add(textNode.id); };
  // Opt-in case (`exactPrice`, with the total inside a sentence below): a drawn amount such as "2.250.000đ" keeps its currency mark, the tag stands for the digits only.
  const currencyAround = (word) => {
    if (!exactPrice) return { before: '', after: '' };
    const found = /^(\D*?)\d[\d.,]*\d?(\D*)$/.exec(String(word ?? '').trim());
    const mark = (part) => (part && part.trim() && [...part.trim()].length <= 2 && !/\p{L}{3,}/u.test(part) ? part : '');
    return found ? { before: mark(found[1]), after: mark(found[2]) } : { before: '', after: '' };
  };
  const markAmount = (textNode, tag) => {
    take(textNode, tag);
    const around = currencyAround(textNode.text.characters);
    if (around.before || around.after) tagText(patches, textNode.id, `${around.before}${tag}${around.after}`);
    const name = tag === '{vnx_sp_regular}' ? 'data-vnx-sp-regular' : tag === '{vnx_sp_sale}' ? 'data-vnx-sp-sale' : '';
    if (name) put(textNode.id, { settings: { _attributes: [{ name, value: '1' }] } });
  };
  const markDiscount = (textNode, root = card) => {
    const sign = /^[+-]/.test(norm(textNode.text.characters)) ? norm(textNode.text.characters)[0] : '0';
    take(textNode, '{vnx_sp_tag}');
    const showTag = [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_tag}', compare: 'empty_not' }]];
    put(textNode.id, { settings: { text: '{vnx_sp_tag}', _attributes: [{ name: 'data-vnx-sp-off', value: sign }], ...(exactPrice ? {} : { _conditions: showTag }) } });
    const chip = parentOf(root, textNode.id);
    if (chip && chip.id !== card.id && textsIn(chip).every((item) => percentShape(item.text.characters))) {
      put(chip.id, { settings: { _attributes: [{ name: 'data-vnx-sp-off-chip', value: '1' }], ...(exactPrice ? {} : { _conditions: showTag }) } });
      // Under `exactPrice` the row that holds the chip keeps its drawn height when a package has no tag, so every card keeps the same rhythm.
      const row = exactPrice ? parentOf(root, chip.id) : null;
      if (row && row.id !== card.id && row.box?.h > 0) put(row.id, { settings: { _heightMin: px(row.box.h) } });
    }
  };
  for (const textNode of textsIn(card)) {
    if (used.has(textNode.id)) continue;
    if (rows && rows.items.some((item) => contains(item, textNode.id))) continue;
    const word = textNode.text.characters;
    if (same(word, pack.name)) take(textNode, '{vnx_sp_name}');
    else if (struck(textNode)) markAmount(textNode, '{vnx_sp_regular}');
    else if (same(word, price.sale) || sameAmount(word, price.sale) || pack.prices.some((item) => same(word, item.sale) || sameAmount(word, item.sale))) markAmount(textNode, '{vnx_sp_sale}');
    else if (same(word, price.regular) || sameAmount(word, price.regular)) markAmount(textNode, '{vnx_sp_regular}');
    else if (same(word, price.total) || sameAmount(word, price.total)) take(textNode, '{vnx_sp_total}');
    else if (percentShape(word) && (same(word, price.tag) || pack.prices.some((item) => same(word, item.tag)))) markDiscount(textNode);
    else if (same(word, price.tag) || pack.prices.some((item) => same(word, item.tag))) take(textNode, '{vnx_sp_tag}');
    else if (same(word, price.promoText) || pack.prices.some((item) => same(word, item.promoText))) take(textNode, '{vnx_sp_promo_text}');
    else if (same(word, price.code) || pack.prices.some((item) => same(word, item.code))) {
      take(textNode, '{vnx_sp_code}');
      put(textNode.id, { settings: { text: '{vnx_sp_code}', _attributes: [{ name: 'data-vnx-sp-copy', value: '{vnx_sp_code}' }], _conditions: [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_code}', compare: 'empty_not' }]] } });
    } else if (table.meta.unit && (same(word, table.meta.unit) || unitShape(word))) take(textNode, '{vnx_sp_unit}');
    else if (table.meta.button && same(word, table.meta.button)) {
      take(textNode, '{vnx_sp_button}');
      const frame = parentOf(card, textNode.id);
      const onlyText = frame && visibleKids(frame).filter((child) => child.type === 'TEXT' && !child.svg).length === 1;
      if (onlyText) put(frame.id, { settings: registerButton('{vnx_sp_button}', attrs) });
    }
  }
  const amount = (word) => {
    const raw = String(word ?? '').trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 3) return false;
    const rest = [...raw.replace(/[\d\s.,]/g, '')];
    return rest.length <= 2;
  };
  const top = (textNode) => textNode.box?.y ?? 0;
  if (![...used].some((id) => patches[id]?.settings?.text === '{vnx_sp_name}')) {
    const marks = textsIn(card).filter((textNode) => amount(textNode.text.characters) || unitShape(textNode.text.characters) || (table.meta.unit && same(textNode.text.characters, table.meta.unit)));
    const priceY = marks.length ? Math.min(...marks.map(top)) : Infinity;
    const open = textsIn(card).filter((textNode) => !used.has(textNode.id) && !amount(textNode.text.characters) && !unitShape(textNode.text.characters) && !(rows && rows.items.some((item) => contains(item, textNode.id))));
    const above = open.filter((textNode) => top(textNode) < priceY).sort((a, b) => top(b) - top(a));
    const nameNode = above[0] ?? open.sort((a, b) => top(a) - top(b))[0];
    if (nameNode) take(nameNode, '{vnx_sp_name}');
  }
  // A sentence that carries the cycle total ("Pay 27.000.000đ for 1 year.") keeps its words, and the number inside it becomes the tag.
  for (const textNode of textsIn(card)) {
    if (used.has(textNode.id) || rows?.items.some((item) => contains(item, textNode.id))) continue;
    const words = norm(textNode.text.characters);
    if (!exactPrice || words.length < 12) continue;
    const number = [...words.matchAll(/\d[\d.,]*\d/g)].find((hit) => pack.prices.some((item) => sameAmount(hit[0], item.total)));
    if (!number) continue;
    // The words of the cycle the sentence was drawn for ("1 year") are the cycle of whichever pane the card is in.
    const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let sentence = `${words.slice(0, number.index)}{vnx_sp_total}${words.slice(number.index + number[0].length)}`;
    for (const cycle of table.cycles) {
      const found = new RegExp(`(?<![\\p{L}\\d])${escape(norm(cycle.label))}(?![\\p{L}\\d])`, 'iu');
      if (found.test(sentence)) { sentence = sentence.replace(found, '{vnx_sp_cycle}'); break; }
    }
    take(textNode, sentence);
    put(textNode.id, { settings: { _attributes: [{ name: 'data-vnx-sp-total-line', value: '1' }] } });
  }
  // Under `exactPrice`, a drawn figure that no cell of the table holds would show the drawn number for every cycle and package. Beside the
  // sentence that carries the total, such a figure is the saving of that cycle: the words stay and the number is computed from the regular price,
  // the sale price and the total (regular x months - total, months = total / sale). Any other loose figure is hidden.
  if (exactPrice) {
    put(card.id, { settings: { _attributes: [{ name: 'data-vnx-sp-pkg', value: '1' }] } });
    const tagged = (node) => textsIn(node).some((word) => String(patches[word.id]?.settings?.text ?? '').includes('{vnx_sp_total}'));
    // A chip whose tag is empty shows nothing until the script has worked out its percent.
    const css = [{ decl: 'display: none;', suffix: ' [data-vnx-sp-off-chip]:has([data-vnx-sp-off]:empty)' }];
    for (const textNode of textsIn(card)) {
      if (used.has(textNode.id) || rows?.items.some((item) => contains(item, textNode.id))) continue;
      const words = norm(textNode.text.characters);
      const figure = [...words.matchAll(/\d[\d.,]*\d/g)].find((hit) => digits(hit[0]).length >= 4);
      if (!figure || percentShape(words)) continue;
      const host = parentOf(card, textNode.id);
      const beside = host && host.id !== card.id && visibleKids(host).some((kid) => kid.id !== textNode.id && tagged(kid));
      if (beside) {
        const text = `${words.slice(0, figure.index)}<span data-vnx-sp-saving></span>${words.slice(figure.index + figure[0].length)}`;
        tagText(patches, textNode.id, text);
        put(textNode.id, { settings: { _attributes: [{ name: 'data-vnx-sp-saving-line', value: '1' }] } });
        if (!css.some((rule) => rule.suffix.includes('saving-line'))) css.push({ decl: 'visibility: hidden;', suffix: ' [data-vnx-sp-saving-line]:not([data-vnx-sp-ready])' });
      } else {
        put(textNode.id, { css: [{ decl: 'display: none;', suffix: '' }] });
      }
      used.add(textNode.id);
    }
    put(rootId, { css });
  }
  let promo = null;
  const walkPromo = (current) => {
    if (rows && (current.id === rows.host.id || rows.items.some((item) => contains(item, current.id) || item.id === current.id))) return;
    const texts = textsIn(current).filter((text) => !used.has(text.id));
    // A promo is a sentence and its code. A pair that holds an amount or a percent is a price, never a promo.
    if (texts.length === 2 && !texts.some((word) => percentShape(word.text.characters) || amount(word.text.characters))) promo = texts;
    visibleKids(current).forEach(walkPromo);
  };
  walkPromo(card);
  let priceCluster = null;
  const seekCluster = (current) => {
    if (!current || current.visible === false) return;
    const texts = textsIn(current);
    const hasUnit = table.meta.unit && texts.some((text) => same(text.text.characters, table.meta.unit) || unitShape(text.text.characters));
    const hasAmount = texts.some((text) => amount(text.text.characters));
    if (hasUnit && hasAmount && (!priceCluster || texts.length < textsIn(priceCluster).length)) priceCluster = current;
    visibleKids(current).forEach(seekCluster);
  };
  seekCluster(card);
  if (priceCluster) {
    for (const textNode of textsIn(priceCluster)) {
      if (used.has(textNode.id)) continue;
      if (!amount(textNode.text.characters)) continue;
      if (struck(textNode)) markAmount(textNode, '{vnx_sp_regular}');
      else markAmount(textNode, '{vnx_sp_sale}');
    }
  }
  const besideAmount = (textNode) => {
    let host = parentOf(card, textNode.id);
    while (host) {
      const words = textsIn(host).filter((item) => item.id !== textNode.id);
      if (words.some((item) => amount(item.text.characters))) return true;
      if (host.id === card.id) break;
      if (words.some((item) => !percentShape(item.text.characters))) return false;
      host = parentOf(card, host.id);
    }
    return false;
  };
  for (const textNode of textsIn(card)) {
    if (used.has(textNode.id) || rows?.items.some((item) => contains(item, textNode.id))) continue;
    const word = textNode.text.characters;
    if (!percentShape(word) || !besideAmount(textNode)) continue;
    markDiscount(textNode);
  }
  if (promo) {
    const [code, sentence] = fold(promo[0].text.characters).includes(' ') ? [promo[1], promo[0]] : [promo[0], promo[1]];
    take(sentence, '{vnx_sp_promo_text}');
    take(code, '{vnx_sp_code}');
    put(code.id, { settings: { text: '{vnx_sp_code}', _attributes: [{ name: 'data-vnx-sp-copy', value: '{vnx_sp_code}' }], _conditions: [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_code}', compare: 'empty_not' }]] } });
  }
}

// A package that is flagged popular looks different in Figma: a frame around the card, a band above it, another buy button. All of that is taken
// from the drawn card that has the band, as the difference to the loop card. The flag is data (`{vnx_sp_label}`, a package cell), so a card is
// popular only when the table says so, and never when the tag is empty or the plugin leaves it unresolved.
// No brace may sit in the selector: Bricks cuts the rest of the file at it. A tag the plugin left unresolved still holds `vnx_sp_`.
// A package is told apart by its name and a cycle by its label, both written by the table itself, so a variant follows its package or cycle when the
// table is reordered or grows. A name that holds a quote or a backslash cannot sit in a selector and is left out.
const plain = (value) => String(value ?? '').replace(/["\\]/g, '');
const byName = (table, at) => `[data-vnx-sp-name="${plain(table.packages[at]?.name)}"]`;
const PACKAGE_MARK = [{ name: 'data-vnx-sp-name', value: '{vnx_sp_name}' }];
const POPULAR = '[data-vnx-sp-popular]:not([data-vnx-sp-popular=""]):not([data-vnx-sp-popular*="vnx_sp_"])';
const POPULAR_SHOWN = [[
  { key: 'dynamic_data', dynamic_data: '{vnx_sp_label}', compare: 'empty_not' },
  { key: 'dynamic_data', dynamic_data: '{vnx_sp_label}', compare: 'not_contains', value: '{' },
]];

function paintCss(node) {
  const fills = (node?.fills ?? []).filter((fill) => fill.visible !== false && fill.type === 'SOLID');
  if (!fills.length) return '';
  const overlays = fills.slice(1).reverse();
  let css = `background-color: ${cssColor(fills[0])};`;
  if (overlays.length) css += ` background-image: ${overlays.map((fill) => `linear-gradient(${cssColor(fill)}, ${cssColor(fill)})`).join(', ')};`;
  return css;
}

function lineCss(node) {
  const paint = (node?.stroke?.paints ?? []).find((item) => item.visible !== false);
  if (!paint) return '';
  return `border: ${node.stroke.weight || 1}px solid ${cssColor(paint)};`;
}

function cornerCss(node) {
  const r = Array.isArray(node?.radius) ? node.radius : null;
  return r && r.some((value) => value > 0) ? `border-radius: ${r.map((value) => `${value}px`).join(' ')};` : '';
}

// The frame that is the buy control: the deepest frame (or instance) that holds one text and a fill or a line.
function buyFrameOf(node) {
  let found = null;
  const walk = (current) => {
    if (!current || current.visible === false) return;
    const inside = textsIn(current);
    if (inside.length === 1 && !isText(current) && (solidFill(current) || current.stroke?.paints?.length)) found = current;
    for (const child of visibleKids(current)) walk(child);
  };
  walk(node);
  return found;
}

function bindPopular(put, { cards, card, rootId, table, packOf }) {
  const leadingBand = (item) => {
    const kids = visibleKids(item).filter((child) => child.place !== 'ABSOLUTE');
    if (kids.length < 2 || textsIn(kids[0]).length !== 1 || textsIn(kids[1]).length < 2) return null;
    return { item, band: kids[0], text: textsIn(kids[0])[0], body: kids[1] };
  };
  const marked = [...cards.items, ...visibleKids(cards.host)].map(leadingBand).find((item) => item && !contains(card, item.band.id));
  if (!marked) return;
  // A band with no fill of its own sits on the frame of the popular card, so it takes that fill.
  const baseFill = (marked.item.fills ?? []).find((paint) => paint.type === 'SOLID' && paint.visible !== false);
  const fill = solidFill(marked.band) ?? baseFill;
  const ink = solidFill(marked.text);
  const pad = marked.band.layout?.padding;
  const bodies = visibleKids(card).filter((child) => child.layout?.mode === 'VERTICAL');
  const body = card.layout?.mode === 'VERTICAL'
    ? card
    : bodies.sort((a, b) => textsIn(b).length - textsIn(a).length)[0] ?? card;
  // The loop card already keeps the room for the band (the drawn card has that much padding above its body), so the band is laid over it.
  const room = card.layout?.padding?.top ?? 0;
  const overlay = room >= (marked.band.box?.h ?? Infinity) - 1;
  const host = overlay || card.layout?.mode === 'VERTICAL' ? card : body;
  const typography = {
    ...(marked.text.text?.fontSize ? { 'font-size': px(marked.text.text.fontSize) } : {}),
    ...(marked.text.text?.fontWeight ? { 'font-weight': String(marked.text.text.fontWeight) } : {}),
    ...(ink?.hex ? { color: ink.alpha >= 1 ? { hex: ink.hex } : { raw: cssColor(ink) } } : {}),
    'text-align': 'center',
  };
  put(host.id, {
    extraChildren: [{
      place: 'before',
      name: 'block',
      label: 'Popular',
      settings: {
        _display: 'flex',
        _direction: 'row',
        _justifyContent: 'center',
        _alignItems: 'center',
        _width: '100%',
        ...(overlay ? { _position: 'absolute', _top: '0px', _left: '0px', _height: px(marked.band.box.h) } : {}),
        // Laid on the card of a padded column, the band reaches the edges of the card again.
        ...(!overlay && host === card && card.layout?.padding && (card.layout.padding.left || card.layout.padding.top)
          ? { _alignSelf: 'stretch', _margin: { top: px(-card.layout.padding.top), right: px(-card.layout.padding.right), bottom: '0px', left: px(-card.layout.padding.left) }, _width: 'auto' }
          : {}),
        ...(fill?.hex ? { _background: { color: fill.alpha >= 1 ? { hex: fill.hex } : { raw: cssColor(fill) } } } : {}),
        ...(pad ? { _padding: { top: px(pad.top), right: px(pad.right), bottom: px(pad.bottom), left: px(pad.left) } } : {}),
        _conditions: POPULAR_SHOWN,
        _hidden: { _cssClasses: 'f2b-popular-band' },
      },
      children: [{
        name: 'text-basic',
        label: 'Popular label',
        text: marked.text.text?.characters ?? '',
        settings: { text: marked.text.text?.characters ?? '', _typography: typography },
      }],
    }],
  });
  // The popular look of the card itself: frame, line and corners of the drawn card; the body loses its own line.
  const frame = [paintCss(marked.item), lineCss(marked.item), cornerCss(marked.item), overlay ? 'position: relative;' : ''].filter(Boolean).join(' ');
  // The rules sit on the element that holds the whole table: Bricks writes the custom css of an element inside a query loop nowhere.
  const scope = ' ';
  // Figma decides which package is the popular one: the place of the drawn card that has the band, among the packages of the table.
  // A table cell can still switch a card on through the attribute.
  const at = table.packages.indexOf(packOf(marked.item));
  const place = at >= 0 ? `.f2b-pkg${byName(table, at)}` : null;
  // While no package of the table carries the flag, the design decides; once one does, the table decides.
  const guard = `:not(:has(${POPULAR}))`;
  const css = [{ decl: 'display: none;', suffix: `${scope}.f2b-popular-band` }, { decl: 'display: flex;', suffix: `${scope}${POPULAR} .f2b-popular-band` }, { decl: frame, suffix: `${scope}${POPULAR}` }];
  if (place) {
    css.push({ decl: 'display: flex;', suffix: `${guard} ${place} .f2b-popular-band` });
    css.push({ decl: frame, suffix: `${guard} ${place}` });
  }
  if (lineCss(body) && !lineCss(marked.body)) {
    css.push({ decl: 'border-color: transparent;', suffix: `${scope}${POPULAR} > :not(.f2b-popular-band)` });
    if (place) css.push({ decl: 'border-color: transparent;', suffix: `${guard} ${place} > :not(.f2b-popular-band)` });
  }
  // The buy control that is drawn differently on the popular card.
  const own = buyFrameOf(card);
  const theirs = buyFrameOf(marked.item);
  if (own && theirs) {
    const buy = [];
    const ownFill = solidFill(own);
    const theirFill = solidFill(theirs);
    if (theirFill && (!ownFill || cssColor(theirFill) !== cssColor(ownFill))) buy.push(`background-color: ${cssColor(theirFill)};`);
    if (own.stroke?.paints?.length && !theirs.stroke?.paints?.length) buy.push('border-color: transparent;');
    else if (theirs.stroke?.paints?.length && lineCss(theirs) !== lineCss(own)) buy.push(lineCss(theirs));
    if (buy.length) {
      css.push({ decl: buy.join(' '), suffix: `${scope}${POPULAR} .f2b-buy` });
      if (place) css.push({ decl: buy.join(' '), suffix: `${guard} ${place} .f2b-buy` });
    }
    const ownInk = solidFill(textsIn(own)[0]);
    const theirInk = solidFill(textsIn(theirs)[0]);
    if (theirInk && (!ownInk || cssColor(theirInk) !== cssColor(ownInk))) {
      css.push({ decl: `color: ${cssColor(theirInk)};`, suffix: `${scope}${POPULAR} .f2b-buy, ${scope}${POPULAR} .f2b-buy :is(.brxe-text-basic, .brxe-heading)` });
      if (place) css.push({ decl: `color: ${cssColor(theirInk)};`, suffix: `${guard} ${place} .f2b-buy, ${guard} ${place} .f2b-buy :is(.brxe-text-basic, .brxe-heading)` });
    }
  }
  put(card.id, { settings: { _attributes: [{ name: 'data-vnx-sp-popular', value: '{vnx_sp_label}' }, ...PACKAGE_MARK], _hidden: { _cssClasses: 'f2b-pkg' } } });
  if (own) put(own.id, { settings: { _hidden: { _cssClasses: 'f2b-buy' } } });
  put(rootId, { css });
}

// The words under the package name are drawn per package and the table has no cell for them: a drawn card whose words there differ from the loop
// card's keeps its own, shown only on that package's place in the loop (as for the buy words below).
function bindPackageDescriptions(put, { cards, card, pack, packOf, table, rootId }) {
  const beside = (item, name) => {
    const host = parentOf(item, name.id);
    return host ? textsIn(host).find((word) => word.id !== name.id) : null;
  };
  const nameOf = (item, owner) => textsIn(item).find((word) => same(word.text.characters, owner.name));
  const ownName = nameOf(card, pack);
  const ownWord = ownName ? beside(card, ownName) : null;
  if (!ownWord) return;
  const protoAt = table.packages.indexOf(pack);
  const variants = [];
  for (const item of [...cards.items, ...visibleKids(cards.host)]) {
    if (item.id === card.id || contains(card, item.id) || contains(item, card.id)) continue;
    const owner = packOf(item);
    const at = table.packages.indexOf(owner);
    if (at < 0 || at === protoAt || variants.some((variant) => variant.at === at)) continue;
    const name = nameOf(item, owner);
    const word = name ? beside(item, name) : null;
    if (!word || norm(word.text.characters) === norm(ownWord.text.characters)) continue;
    variants.push({ at, word });
  }
  if (!variants.length) return;
  const css = [{ decl: 'display: none;', suffix: ' .f2b-pos-desc' }];
  for (const { at } of variants) {
    css.push({ decl: 'display: block;', suffix: ` .f2b-pkg${byName(table, at)} .f2b-pos-desc[data-vnx-sp-pos="${plain(table.packages[at].name)}"]` });
    css.push({ decl: 'display: none;', suffix: ` .f2b-pkg${byName(table, at)} .f2b-proto-desc` });
  }
  put(rootId, { css });
  put(card.id, { settings: { _hidden: { _cssClasses: 'f2b-pkg' }, _attributes: PACKAGE_MARK } });
  put(ownWord.id, { settings: { _hidden: { _cssClasses: 'f2b-proto-desc' } } });
  const host = parentOf(card, ownWord.id);
  put(host.id, {
    extraChildren: variants.map(({ at, word }) => ({
      place: 'after',
      name: 'text-basic',
      label: 'Package description',
      settings: {
        text: word.text.characters,
        _hidden: { _cssClasses: 'f2b-pos-desc' },
        _attributes: [{ name: 'data-vnx-sp-pos', value: plain(table.packages[at].name) }],
        _typography: {
          ...(ownWord.text?.fontSize ? { 'font-size': px(ownWord.text.fontSize) } : {}),
          ...(ownWord.text?.fontWeight ? { 'font-weight': String(ownWord.text.fontWeight) } : {}),
          ...(ownWord.text?.fontFamily ? { 'font-family': ownWord.text.fontFamily } : {}),
          ...(ownWord.text?.lineHeightPx ? { 'line-height': px(ownWord.text.lineHeightPx) } : {}),
          ...(solidFill(ownWord)?.hex ? { color: { hex: solidFill(ownWord).hex } } : {}),
        },
      },
    })),
  });
}

// A drawn card whose buy control reads differently from the loop card's (a package with its own button words) keeps those words: one extra
// text per such package sits in the loop card's control, and a rule on the whole table shows it only on that package's place in the loop,
// hiding the loop card's own word there. The words are the drawn ones; a table cell for them can replace them later.
function bindPackageButtons(put, { cards, card, pack, packOf, table, rootId }) {
  const own = buyFrameOf(card);
  const ownText = own ? textsIn(own)[0] : null;
  if (!ownText) return;
  const protoAt = table.packages.indexOf(pack);
  const variants = [];
  for (const item of [...cards.items, ...visibleKids(cards.host)]) {
    if (item.id === card.id || contains(card, item.id) || contains(item, card.id)) continue;
    const at = table.packages.indexOf(packOf(item));
    if (at < 0 || at === protoAt || variants.some((variant) => variant.at === at)) continue;
    const frame = buyFrameOf(item);
    const word = frame ? textsIn(frame)[0] : null;
    if (!word || norm(word.text.characters) === norm(ownText.text.characters)) continue;
    variants.push({ at, word });
  }
  if (!variants.length) return;
  const css = [{ decl: 'display: none;', suffix: ' .f2b-pos-text' }];
  for (const { at } of variants) {
    css.push({ decl: 'display: block;', suffix: ` .f2b-pkg${byName(table, at)} .f2b-pos-text[data-vnx-sp-pos="${plain(table.packages[at].name)}"]` });
    css.push({ decl: 'display: none;', suffix: ` .f2b-pkg${byName(table, at)} .f2b-proto-text` });
  }
  put(rootId, { css });
  put(card.id, { settings: { _hidden: { _cssClasses: 'f2b-pkg' }, _attributes: PACKAGE_MARK } });
  put(ownText.id, { settings: { _hidden: { _cssClasses: 'f2b-proto-text' } } });
  put(own.id, {
    // The ink is not copied: a drawn white word belongs to a filled control, and the popular look paints that one. Otherwise it follows the loop card's.
    extraChildren: variants.map(({ at, word }) => {
      return {
        place: 'after',
        name: 'text-basic',
        label: 'Package button text',
        settings: {
          text: word.text.characters,
          _hidden: { _cssClasses: 'f2b-pos-text' },
          _attributes: [{ name: 'data-vnx-sp-pos', value: plain(table.packages[at].name) }],
          _typography: {
            ...(word.text?.fontSize ? { 'font-size': px(word.text.fontSize) } : {}),
            ...(word.text?.fontWeight ? { 'font-weight': String(word.text.fontWeight) } : {}),
            ...(word.text?.fontFamily ? { 'font-family': word.text.fontFamily } : {}),
            ...(word.text?.lineHeightPx ? { 'line-height': px(word.text.lineHeightPx) } : {}),
            ...(solidFill(ownText) ? { color: { hex: solidFill(ownText).hex } } : {}),
            'text-align': 'center',
          },
        },
      };
    }),
  });
}

// A drawn card that opens its list with a line of its own (words the table holds nowhere, between the price block and the first row) keeps that
// line: one extra text before the list, shown only on that package's place in the loop. Other packages show no such line.
const amount = (word) => {
  const raw = String(word ?? '').trim();
  const digitsOnly = raw.replace(/\D/g, '');
  return digitsOnly.length >= 3 && [...raw.replace(/[\d\s.,]/g, '')].length <= 2;
};

function bindListLeads(put, { cards, card, rows, pack, packOf, table, rootId }) {
  if (!rows?.host) return;
  const column = rows.host.id === card.id ? card : parentOf(card, rows.host.id);
  if (!column) return;
  const protoAt = table.packages.indexOf(pack);
  const known = (word) => table.packages.some((item) => same(word, item.name) || item.info.some((row) => same(word, row.text)))
    || table.cycles.some((cycle) => same(word, cycle.label)) || (table.meta.unit && same(word, table.meta.unit)) || (table.meta.button && same(word, table.meta.button));
  const variants = [];
  for (const item of [...cards.items, ...visibleKids(cards.host)]) {
    if (item.id === card.id || contains(card, item.id) || contains(item, card.id)) continue;
    const owner = packOf(item);
    const at = table.packages.indexOf(owner);
    if (at < 0 || at === protoAt || variants.some((variant) => variant.at === at)) continue;
    // The first row of the list is found by its shape (an icon beside words), because the words of a drawn row can differ from the table's.
    const rowWords = [];
    const seekRows = (node) => {
      if (!node || node.visible === false) return;
      const kids = visibleKids(node);
      if (kids.length >= 2 && kids.some((kid) => hasSvg(kid) && !textsIn(kid).length) && kids.some((kid) => textsIn(kid).length)) {
        const words = kids.flatMap((kid) => textsIn(kid));
        const price = words.some((word) => amount(word.text.characters) || unitShape(word.text.characters) || percentShape(word.text.characters) || (table.meta.unit && same(word.text.characters, table.meta.unit)));
        if (words.length && !price) rowWords.push(words[0]);
      }
      kids.forEach(seekRows);
    };
    seekRows(item);
    const first = rowWords.sort((a, b) => (a.box?.absY ?? 0) - (b.box?.absY ?? 0))[0]
      ?? textsIn(item).find((word) => owner.info.some((row) => same(word.text.characters, row.text)));
    if (!first) continue;
    const top = first.box?.absY ?? 0;
    const lead = textsIn(item)
      .filter((word) => !known(word.text.characters) && !percentShape(word.text.characters) && !amount(word.text.characters) && !unitShape(word.text.characters))
      .filter((word) => (word.box?.absY ?? -1) < top && (word.box?.absY ?? -1) > top - 90)
      .sort((a, b) => (b.box?.absY ?? 0) - (a.box?.absY ?? 0))[0];
    if (lead) variants.push({ at, word: lead });
  }
  if (!variants.length) return;
  const css = [{ decl: 'display: none;', suffix: ' .f2b-pos-lead' }];
  for (const { at } of variants) css.push({ decl: 'display: block;', suffix: ` .f2b-pkg${byName(table, at)} .f2b-pos-lead[data-vnx-sp-pos="${plain(table.packages[at].name)}"]` });
  put(rootId, { css });
  put(card.id, { settings: { _hidden: { _cssClasses: 'f2b-pkg' }, _attributes: PACKAGE_MARK } });
  put(column.id, {
    extraChildren: variants.map(({ at, word }) => {
      const ink = solidFill(word);
      return {
        place: 'before',
        name: 'text-basic',
        label: 'Package list lead',
        settings: {
          text: word.text.characters,
          _hidden: { _cssClasses: 'f2b-pos-lead' },
          _attributes: [{ name: 'data-vnx-sp-pos', value: plain(table.packages[at].name) }],
          _typography: {
            ...(word.text?.fontSize ? { 'font-size': px(word.text.fontSize) } : {}),
            ...(word.text?.fontWeight ? { 'font-weight': String(word.text.fontWeight) } : {}),
            ...(word.text?.fontFamily ? { 'font-family': word.text.fontFamily } : {}),
            ...(word.text?.lineHeightPx ? { 'line-height': px(word.text.lineHeightPx) } : {}),
            ...(ink?.hex ? { color: ink.alpha >= 1 ? { hex: ink.hex } : { raw: cssColor(ink) } } : {}),
          },
        },
      };
    }),
  });
}

// The notice and the buy control are one group at the bottom of the card: the column that holds the list takes the room that is left, and the
// notice sits at its end, so it stays next to the control whether the list is long or short.
function bindAlertDock(put, { card, rows }) {
  const own = buyFrameOf(card);
  if (!rows?.host || !own) return;
  const column = parentOf(card, rows.host.id);
  if (!column || contains(column, own.id)) return;
  const notice = visibleKids(column).find((kid) => kid.id !== rows.host.id && solidFill(kid) && textsIn(kid).length > 0 && (kid.box?.y ?? 0) > (rows.host.box?.y ?? 0));
  if (!notice) return;
  put(notice.id, { settings: { _margin: { top: 'auto', right: '0px', bottom: '0px', left: '0px' } } });
  let node = column;
  while (node && !contains(node, own.id)) {
    put(node.id, { settings: { _flexGrow: 1, _display: 'flex', _direction: 'column' } });
    node = parentOf(card, node.id);
  }
}

function bindMoreRows(put, patches, used, omit, { id, card, pack, cards, flanks, packOf, isCycle }) {
  const take = (textNode, tag) => { tagText(patches, textNode.id, tag); used.add(textNode.id); };
  const closedRows = 3;
  const revealOf = (item, list) => {
    if (!list?.host) return null;
    let host = list.host;
    while (host && host.id !== item.id) {
      const parent = parentOf(item, host.id);
      if (!parent) return null;
      const kids = visibleKids(parent);
      const index = kids.findIndex((kid) => kid.id === host.id);
      const next = kids[index + 1];
      if (next && textsIn(next).length && (next.box?.h ?? 0) <= 36) return next;
      host = parent;
    }
    return null;
  };
  const armList = (item, itemPack) => {
    const shape = (row) => (hasSvg(row) || hasWords(row, (word) => itemPack.info.some((info) => same(word, info.text)))) && textsIn(row).length >= 1;
    const list = bestGroup(item, shape, 2) ?? bestGroup(item, shape, 1);
    if (!list) return null;
    list.items.slice(1).forEach((row) => { if (!omit.includes(row.id)) omit.push(row.id); });
    if (list.items[0].type !== 'TEXT') {
      put(list.items[0].id, { settings: { ...loop('row', id), _attributes: [{ name: 'data-vnx-sp-row', value: '1' }] } });
    }
    const sample = textsIn(list.items[0]).find((textNode) => textNode.text?.characters && !percentShape(textNode.text.characters));
    if (sample && !used.has(sample.id)) take(sample, '{vnx_sp_info}');
    const icon = visibleKids(list.items[0]).find((child) => hasSvg(child) && !/question|help|tooltip/i.test(child.name || ''));
    if (icon && itemPack.info.some((info) => /^fa[\w-]*\s+fa-|^fa-/.test(info.icon || ''))) {
      put(icon.id, {
        skipChildren: true,
        settings: {
          tag: 'i',
          text: '',
          _cssClasses: '{vnx_sp_info_icon}',
          ...(icon.box?.w ? { _width: px(icon.box.w), _height: px(icon.box.h || icon.box.w) } : {}),
          _conditions: [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_info_icon}', compare: 'empty_not' }]],
        },
      });
    }
    const reveal = revealOf(item, list);
    if (reveal) {
      put(list.host.id, {
        settings: { _attributes: [{ name: 'data-vnx-sp-rows', value: '1' }, { name: 'data-vnx-sp-preview', value: String(closedRows) }], _overflow: 'visible', _height: 'auto' },
        css: [
          { decl: 'display: none;', suffix: ' > :nth-child(n+5)' },
          { decl: 'display: flex;', suffix: '.is-open > :nth-child(n+5)' },
          { decl: 'display: none;', suffix: ' .f2b-price-more' },
          { decl: 'display: flex;', suffix: '.is-open .f2b-price-more' },
        ],
      });
      put(reveal.id, { settings: { tag: 'button', _attributes: [{ name: 'data-vnx-sp-more', value: '1' }] } });
    }
    return list;
  };
  armList(card, pack);
  const pinColumn = (item) => {
    const bodies = visibleKids(item).filter((child) => child.layout?.mode === 'VERTICAL');
    const body = item.layout?.mode === 'VERTICAL' ? item : bodies.sort((a, b) => textsIn(b).length - textsIn(a).length)[0];
    if (!body) return;
    put(body.id, {
      settings: { _display: 'flex', _direction: 'column', _height: '100%', _overflow: 'visible' },
      css: [{ decl: 'display: flex; flex-direction: column; height: 100%; overflow: visible;', suffix: '' }],
    });
    const last = visibleKids(body).at(-1);
    if (last) put(last.id, { css: [{ decl: 'margin-top: auto;', suffix: '' }] });
  };
  pinColumn(card);
  for (const sibling of visibleKids(cards.host)) {
    if (omit.includes(sibling.id) || sibling.id === card.id || isCycle(sibling)) continue;
    if (sibling.id === flanks.prev?.id || sibling.id === flanks.next?.id) continue;
    if (packOf(sibling)) continue;
    pinColumn(sibling);
  }
}

function bindSpecialImage(patches, { price, card }) {
  if (!price.special) return;
  const image = textsIn(card).length && findImage(card);
  if (!image) return;
  const prev = patches[image.id] ?? {};
  patches[image.id] = { ...prev, settings: { ...(prev.settings ?? {}), image: { useDynamicData: '{vnx_sp_label}' } } };
}

function drawsTotalSentence(card, pack, rows) {
  return textsIn(card).some((textNode) => {
    if (rows?.items.some((item) => contains(item, textNode.id))) return false;
    const words = norm(textNode.text.characters);
    return words.length >= 12 && [...words.matchAll(/\d[\d.,]*\d/g)].some((hit) => pack.prices.some((item) => sameAmount(hit[0], item.total)));
  });
}

function bindPrice(node, table, id, root, attrs, selectedId, chipCycle, exactPrice, popularBand = true, selectedLabel = '') {
  const scene = priceScene(node, table, id, root);
  if (scene.stop) return scene.stop;
  const { scopeRoot, packOf, isPackage, isCycle, cards, cycles, cycleField, card, pack, rows } = scene;

  const patches = {};
  const put = (nodeId, patch) => {
    const prev = patches[nodeId] ?? {};
    // Two patches on one node each add attributes: they are joined by name, the later value wins, and none is lost.
    const attrs = [...(prev.settings?._attributes ?? []), ...(patch.settings?._attributes ?? [])];
    const joined = attrs.length ? [...new Map(attrs.map((attr) => [attr.name, attr])).values()] : null;
    patches[nodeId] = {
      ...prev,
      ...patch,
      settings: { ...(prev.settings ?? {}), ...(patch.settings ?? {}), ...(joined ? { _attributes: joined } : {}) },
      css: [...(prev.css ?? []), ...(patch.css ?? [])],
      ...(patch.extraChildren ? { extraChildren: [...(prev.extraChildren ?? []), ...patch.extraChildren] } : {}),
      ...(patch.wrapChildren ? { wrapChildren: patch.wrapChildren } : {}),
    };
  };
  const omit = [];
  const warnings = [];
  const { openAt, cycleProto, cycleActive } = openCycle(table, cycles, cycleField, selectedId, chipCycle, selectedLabel);
  const price = pack.prices[openAt] ?? {};
  // The card draws its cycle total inside a sentence: the shape decides, `exactPrice: false` in the detection turns it off.
  if (exactPrice === undefined) exactPrice = drawsTotalSentence(card, pack, rows);
  // A sibling whose name is not a package stays beside the loop. Only package copies are omitted.
  omitDrawnCopies(omit, { cards, card, packOf, rows, cycles, cycleProto, cycleField });
  if (!cycles) warnings.push('no cycle labels from this table are drawn here, so the first cycle is used');

  const { flanks, moveCards } = cardFlanks(cards, card, isPackage, isCycle);
  const tabsHost = bindCycleShell(put, { table, id, scopeRoot, cards, cycles, cycleField, cycleProto, cycleActive, openAt, moveCards });
  bindCardRow(put, { cards, card, id, omit, flanks, moveCards, tabsHost, isCycle, rows, scopeRoot });

  const used = new Set();
  bindCycleWords(put, patches, used, { table, cycleProto, cycleField });
  bindPopularCycle(put, { cycles, cycleProto, table });
  bindPackageButtons(put, { cards, card, pack, packOf, table, rootId: scopeRoot.id });
  bindPackageDescriptions(put, { cards, card, pack, packOf, table, rootId: scopeRoot.id });
  bindListLeads(put, { cards, card, rows, pack, packOf, table, rootId: scopeRoot.id });
  bindAlertDock(put, { card, rows });
  bindInfoRow(put, patches, used, { table, pack, rows });
  bindCardSlots(put, patches, used, { table, pack, price, card, rows, attrs, exactPrice, rootId: scopeRoot.id });
  // `popularBand: false` leaves the drawn header band out, for a table that has no cell for it (the band would only show its tag).
  if (popularBand) bindPopular(put, { cards, card, rootId: scopeRoot.id, table, packOf });
  bindMoreRows(put, patches, used, omit, { id, card, pack, cards, flanks, packOf, isCycle });
  bindSpecialImage(patches, { price, card });

  return { tabsHost, card, patches, omit, warnings };
}

export function stepPriceCard(button, direction) {
  const root = button.closest?.('[data-vnx-sp-deck]');
  if (!root) return;
  const pane = root.querySelector('.tab-pane.brx-open') || root.querySelector('.tab-pane') || root;
  const cards = [...pane.querySelectorAll('[data-vnx-sp-card]')];
  if (!cards.length) return;
  const left = pane.scrollLeft || 0;
  let index = 0;
  for (let i = 0; i < cards.length; i++) if (cards[i].offsetLeft <= left + 1) index = i;
  const next = Math.min(cards.length - 1, Math.max(0, index + direction));
  pane.scrollTo({ left: cards[next].offsetLeft });
}

// These functions are written into the page as a script, and the site drops every backslash on the way: no regex below may use one.
function cardFigures(card) {
  const number = (node) => Number(((node && node.textContent) || '').replace(/[^0-9]/g, '')) || 0;
  const line = card.querySelector('[data-vnx-sp-total-line]');
  const found = line ? ((line.textContent || '').match(/[0-9][0-9.,]*[0-9]/) || [''])[0] : '';
  return {
    regular: number(card.querySelector('[data-vnx-sp-regular]')),
    sale: number(card.querySelector('[data-vnx-sp-sale]')),
    total: Number(found.replace(/[^0-9]/g, '')) || 0,
  };
}

function paintDiscount(root) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('[data-vnx-sp-off]').forEach((badge) => {
    const written = (badge.textContent || '').trim();
    const chip = badge.closest('[data-vnx-sp-off-chip]') || badge;
    if (!written || written.indexOf('{vnx_sp_') >= 0) {
      // No tag in the table: the chip shows the gap between the regular and the sale price, when there is one.
      const card = badge.closest('[data-vnx-sp-pkg]');
      const f = card ? cardFigures(card) : null;
      if (f && f.regular > f.sale && f.sale > 0) {
        badge.textContent = '-' + Math.round(((f.regular - f.sale) / f.regular) * 100) + '%';
        chip.style.display = '';
        return;
      }
      chip.style.display = 'none';
      return;
    }
    const bare = written.match(/^([+-])?([0-9]+(?:[.,][0-9]+)?)$/);
    if (bare) {
      const sign = bare[1] || badge.getAttribute('data-vnx-sp-off');
      badge.textContent = (sign && sign !== '0' ? sign : '') + bare[2] + '%';
    }
    chip.style.display = '';
  });
}

function paintSavings(root) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('[data-vnx-sp-saving-line]').forEach((line) => {
    const card = line.closest('[data-vnx-sp-pkg]');
    const out = line.querySelector('[data-vnx-sp-saving]');
    const f = card ? cardFigures(card) : null;
    if (!f || !out || !(f.regular > f.sale && f.sale > 0 && f.total > 0)) return;
    const months = Math.round(f.total / f.sale);
    const saving = f.regular * months - f.total;
    if (months < 1 || saving <= 0) return;
    let rest = String(saving);
    let grouped = '';
    while (rest.length > 3) {
      grouped = '.' + rest.slice(-3) + grouped;
      rest = rest.slice(0, -3);
    }
    out.textContent = rest + grouped;
    line.setAttribute('data-vnx-sp-ready', '1');
  });
}

// Tabs built from a query loop get no open state from Bricks (`openTab` only reaches static tabs). The host says which cycle is open
// (`data-vnx-sp-open`), and that pill and pane take `brx-open`, once. A visitor's own click is then handled by Bricks as usual.
function openCycleTab(root) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('[data-vnx-sp-open]').forEach((host) => {
    if (host.getAttribute('data-vnx-sp-opened')) return;
    const at = Number(host.getAttribute('data-vnx-sp-open'));
    const titles = host.querySelectorAll('.tab-menu .tab-title');
    const panes = host.querySelectorAll('.tab-content .tab-pane');
    if (!titles.length || !panes.length || !(at >= 0) || at >= titles.length) return;
    titles.forEach((title, index) => { title.classList.toggle('brx-open', index === at); title.setAttribute('aria-selected', index === at ? 'true' : 'false'); });
    panes.forEach((pane, index) => pane.classList.toggle('brx-open', index === at));
    host.setAttribute('data-vnx-sp-opened', '1');
  });
}

function foldPriceRows(root) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('[data-vnx-sp-rows]').forEach((list) => {
    const preview = Number(list.getAttribute('data-vnx-sp-preview') || '3');
    const open = list.classList.contains('is-open');
    [...list.querySelectorAll('[data-vnx-sp-row]')].forEach((row, index) => {
      row.classList.toggle('f2b-price-more', !open && index >= preview);
    });
  });
}

export function priceCardScript() {
  return `(function(){${cardFigures.toString()}${paintDiscount.toString()}${paintSavings.toString()}${openCycleTab.toString()}${foldPriceRows.toString()}${stepPriceCard.toString()}function run(){paintDiscount(document);paintSavings(document);openCycleTab(document);foldPriceRows(document);}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);else run();window.addEventListener("load",function(){run();setTimeout(run,400)});document.addEventListener("click",function(event){var more=event.target&&event.target.closest&&event.target.closest("[data-vnx-sp-more]");if(more){var list=more.parentElement&&more.parentElement.querySelector("[data-vnx-sp-rows]");if(list){list.classList.toggle("is-open");foldPriceRows(list.parentElement||document);}return;}var button=event.target&&event.target.closest&&event.target.closest("[data-vnx-sp-prev],[data-vnx-sp-next]");if(!button)return;stepPriceCard(button,button.hasAttribute("data-vnx-sp-prev")?-1:1);});})();`;
}

function findImage(node) {
  if (!node || node.visible === false) return null;
  if (!isText(node) && (node.fills ?? []).some((fill) => isType(fill, FillType.IMAGE))) return node;
  for (const child of visibleKids(node)) {
    const found = findImage(child);
    if (found) return found;
  }
  return null;
}

function bound(node, det, root) {
  if (cache.has(det)) return cache.get(det);
  const scope = det?.params?.confirm === 'ok' ? node : (root ?? node);
  const value = bindPrice(node, det?.params?.table, det?.params?.id, scope, det?.params?.buttonAttrs, det?.params?.selected, typeof det?.params?.chipCycle === 'boolean' ? det.params.chipCycle : undefined, typeof det?.params?.exactPrice === 'boolean' ? det.params.exactPrice : undefined, det?.params?.popularBand !== false, String(det?.params?.selectedLabel ?? ''));
  cache.set(det, value);
  return value;
}

export function priceFrames(root) {
  const insideCompare = new Set();
  const mark = (node) => {
    if (!node) return;
    insideCompare.add(node.id);
    visibleKids(node).forEach(mark);
  };
  for (const frame of compareFrames(root)) mark(frame);
  const frames = [];
  const walk = (node) => {
    if (!node || insideCompare.has(node.id)) return;
    const cards = visibleKids(node).filter((child) => showsPrice(child));
    if (cards.length >= 2) frames.push(node);
    visibleKids(node).forEach(walk);
  };
  walk(root);
  return frames.filter((frame) => !frames.some((other) => other !== frame && contains(other, frame.id)));
}

function findId(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findId(child, id);
    if (found) return found;
  }
  return null;
}

function containsId(node, id) {
  if (!node) return false;
  if (node.id === id) return true;
  return (node.children ?? []).some((child) => containsId(child, id));
}

// One id on a section covers every table frame inside that node. Another breakpoint does not ask again.
export function missingBoundTables(tree, detections) {
  const loaded = (kind, frameId) => (detections?.components ?? []).some((item) => {
    if (!isKind(item, kind) || item.status === 'rejected') return false;
    if (!item.params?.id || !item.params?.table?.packages?.length) return false;
    return containsId(findId(tree, item.node), frameId);
  });
  const gap = (kind, frame) => ({ kind, node: frame.id, name: frame.name || frame.id });
  // A dashboard drawn inside a carousel can show amounts. That picture is the slide, not a package row.
  const slide = (detections?.components ?? []).filter((item) => item.status === 'approved' && isKind(item, PartKind.CAROUSEL));
  const insideSlide = (frameId) => slide.some((item) => containsId(findId(tree, item.node), frameId));
  return [
    ...priceFrames(tree).filter((frame) => !insideSlide(frame.id) && !loaded(PartKind.PRICE_TABLE, frame.id)).map((frame) => gap(PartKind.PRICE_TABLE, frame)),
    ...compareFrames(tree).filter((frame) => !loaded(PartKind.COMPARE_TABLE, frame.id)).map((frame) => gap(PartKind.COMPARE_TABLE, frame)),
  ];
}

export default {
  id: PartKind.PRICE_TABLE,
  status: 'implemented',
  label: 'Price table',
  figma: 'a drawn card row whose plan names a Service Pricing table id',
  bricks: 'tabs-nested when cycle labels are drawn, plus query loops vnxsp_cycle, vnxsp_pkg and vnxsp_row. Text is {vnx_sp_*}. A closed cycle field uses the select component shell and only supplies the cycle loop',
  limits: 'One pill, one card and one info row are the loop. The loop copies the card that is only the package body. The same table id is the data on every breakpoint. Without that id the build stops.',
  kind(node, det) {
    return bound(node, det).tabsHost === node.id ? 'tabs-nested' : undefined;
  },
  check(node, det, ctx) {
    if (!det?.params?.table?.packages?.length) return { ok: false, reason: 'price table data is not loaded' };
    const found = bound(node, det, ctx?.root ?? node);
    if (found.skip) return { ok: true, warnings: [] };
    if (!found.card) return { ok: false, reason: found.warnings[0] ?? 'no drawn card matches a package name in this table' };
    return { ok: true, warnings: found.warnings };
  },
  descendants(node, det, ctx) {
    return bound(node, det, ctx?.root ?? node).patches;
  },
  mergedNodes(det, node) {
    return bound(node, det).omit;
  },
  pageScript() {
    return `${tabSwitch.pageScript()}\n${selectScript()}\n${priceCardScript()}`;
  },
};
