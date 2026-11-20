// A price table whose plan carries a Service Pricing id.
// One drawn pill, one drawn card and one drawn info row stay. Query loops repeat them.
// Text that equals a cell of the loaded table becomes {vnx_sp_*}. Other text stays.
// Bricks 1.12.3 reads hasLoop + query.objectType on block/div (container.php).
// The plugin resolves vnxsp_{pkg|cycle|row}__{id} and {vnx_sp_*} at request time.
import { PartKind, isKind } from '../../recognize-parts/kinds.mjs';
import { FillType, isText, isType } from '../../recognize-parts/node-type.mjs';
import { visibleKids, hidden, flexDirectionCss } from '../../write-bricks/components/helpers.mjs';
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
const unitShape = (word) => /^\/\S{1,12}$/.test(norm(word));

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

function pickCyclePair(items, selectedId) {
  const peers = items.filter((item) => !hoverState(item));
  const pool = peers.length >= 2 ? peers : items;
  const named = selectedId ? items.find((item) => item.id === selectedId) : null;
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

function bindPrice(node, table, id, root, attrs, selectedId) {
  const empty = { tabsHost: null, card: null, patches: {}, omit: [], warnings: [], skip: false };
  if (!table?.packages?.length || !table.cycles?.length || !id) return empty;
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
  if (!cards) return { ...empty, warnings: ['no drawn card matches a package name in this table'] };
  const claims = claimedHosts.get(scopeRoot) ?? new Set();
  claimedHosts.set(scopeRoot, claims);
  if (claims.has(cards.host.id)) return { ...empty, skip: true, card: cards.items[0] };
  claims.add(cards.host.id);

  const shellMarks = (item) => {
    const kids = visibleKids(item);
    const bodies = kids.filter((child) => isPackage(child) && textsIn(child).length >= 3);
    if (!bodies.length) return [];
    return kids.filter((child) => !bodies.includes(child));
  };
  let card = cards.items.find((item) => !shellMarks(item).length) ?? cards.items[0];
  // One visible card: the grouped node is the price block. The loop is the whole card, so the title and the list stay.
  const titleBeside = visibleKids(cards.host).some((kid) => kid.id !== card.id && hasTitle(kid) && !showsPrice(kid) && !isCycle(kid));
  if (cards.items.length === 1 && card.id !== cards.host.id && priceHeavy(card) && titleBeside && contains(cards.host, card.id)) {
    card = cards.host;
  }
  const pack = packOf(card) ?? table.packages[0];
  let openAt = 0;
  const infoItemShape = (item) => (hasSvg(item) || hasWords(item, (word) => pack.info.some((info) => same(word, info.text)))) && textsIn(item).length >= 1;
  const rows = bestGroup(card, infoItemShape, 2) ?? bestGroup(card, infoItemShape, 1);

  const patches = {};
  const put = (nodeId, patch) => {
    const prev = patches[nodeId] ?? {};
    patches[nodeId] = {
      ...prev,
      ...patch,
      settings: { ...(prev.settings ?? {}), ...(patch.settings ?? {}) },
      css: [...(prev.css ?? []), ...(patch.css ?? [])],
      ...(patch.extraChildren ? { extraChildren: [...(prev.extraChildren ?? []), ...patch.extraChildren] } : {}),
      ...(patch.wrapChildren ? { wrapChildren: patch.wrapChildren } : {}),
    };
  };
  const omit = [];
  const warnings = [];
  const pair = cycles ? pickCyclePair(cycles.items, selectedId) : { active: null, rest: null };
  const cycleProto = pair.rest ?? cycles?.items[0];
  const cycleActive = pair.active;
  if (cycleActive) {
    const label = textsIn(cycleActive).map((text) => text.text.characters).find((word) => table.cycles.some((cycle) => same(word, cycle.label)));
    const index = table.cycles.findIndex((cycle) => same(label, cycle.label));
    if (index >= 0) openAt = index;
  }
  if (cycleField) {
    const label = textsIn(cycleField).map((text) => text.text.characters).find((word) => table.cycles.some((cycle) => same(word, cycle.label)));
    const index = table.cycles.findIndex((cycle) => same(label, cycle.label));
    if (index >= 0) openAt = index;
  }
  const price = pack.prices[openAt] ?? {};
  if (cycles && cycleProto && !cycleField) {
    const kids = visibleKids(cycles.host);
    const pillsOnly = kids.every((item) => item.id === cycleProto.id || !contains(item, card?.id));
    const extras = pillsOnly ? kids : cycles.items;
    for (const item of extras) {
      if (item.id !== cycleProto.id) omit.push(item.id);
    }
  }
  if (card.id !== cards.host.id) cards.items.filter((item) => item.id !== card.id).forEach((item) => omit.push(item.id));
  if (cards.items.length === 1 && cards.items[0].id !== cards.host.id && card.id !== cards.host.id) {
    visibleKids(cards.host).forEach((child) => {
      if (child.id !== card.id && !contains(child, card.id) && isPackage(child)) omit.push(child.id);
    });
  }
  if (rows) rows.items.slice(1).forEach((item) => omit.push(item.id));
  if (!cycles) warnings.push('no cycle labels from this table are drawn here, so the first cycle is used');

  const kids = visibleKids(cards.host);
  const cardIndex = kids.findIndex((child) => child.id === card.id || contains(child, card.id));
  const sideControl = (item) => item && item.id !== card.id && !contains(item, card.id) && !isPackage(item) && !isCycle(item) && textsIn(item).length <= 1;
  const flanks = cards.items.length === 1
    ? { prev: sideControl(kids[cardIndex - 1]) ? kids[cardIndex - 1] : null, next: sideControl(kids[cardIndex + 1]) ? kids[cardIndex + 1] : null }
    : { prev: null, next: null };
  const moveCards = !!(flanks.prev || flanks.next);

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

  if (tabsHost) {
    const hostNode = tabsNode ?? cards.host;
    put(tabsHost, {
      kind: 'tabs-nested',
      settings: { openTab: String(openAt) },
      css: [...flexDirectionCss(hostNode), ...tabsChromeCss()],
    });
    const activeCss = [];
    if (cycleActive && cycleProto && cycleActive.id !== cycleProto.id) {
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
    }
    const scrollNode = (() => {
      let current = cards.host;
      while (current) {
        if (rowScrolls(current, scopeRoot)) return current;
        if (!scopeRoot || current.id === scopeRoot.id) break;
        current = parentOf(scopeRoot, current.id);
      }
      return null;
    })();
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
      put(cycles.host.id, { settings: { ...hidden('tab-menu'), _attributes: [{ name: 'data-vnx-sp-dropdown', value: '1' }] }, css: activeCss });
      if (cycleProto?.type !== 'TEXT') put(cycleProto.id, { settings: { ...hidden('tab-title'), ...loop('cycle', id) } });
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
          ...(moveCards ? { _overflow: 'auto' } : {}),
        },
        ...(scrollHere ? { css: [{ decl: 'width: max-content; flex-wrap: nowrap;', suffix: '' }] } : {}),
        ...(moveCards && !scrollHere ? { css: [{ decl: 'overflow-x: auto; flex-wrap: nowrap;', suffix: '' }] } : {}),
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
  const peeked = peekOf(cards.host, scopeRoot);
  if (card.type !== 'TEXT') {
    put(card.id, {
      settings: {
        ...loop('pkg', id),
        ...(moveCards ? { _attributes: [{ name: 'data-vnx-sp-card', value: '1' }] } : {}),
        ...(spills(card) ? { _overflow: 'hidden' } : {}),
        ...(peeked && card.box ? { _width: px(card.box.w), _flexShrink: 0, _widthMax: 'none' } : {}),
      },
    });
  }
  if (moveCards && !tabsHost) put(cards.host.id, { settings: { _attributes: [{ name: 'data-vnx-sp-deck', value: '1' }] } });
  if (flanks.prev) put(flanks.prev.id, { settings: { _attributes: [{ name: 'data-vnx-sp-prev', value: '1' }] } });
  if (flanks.next) put(flanks.next.id, { settings: { _attributes: [{ name: 'data-vnx-sp-next', value: '1' }] } });
  if (rows && rows.items[0].type !== 'TEXT') put(rows.items[0].id, { settings: loop('row', id) });

  const assign = (textNode, tag) => tagText(patches, textNode.id, tag);
  const used = new Set();
  const take = (textNode, tag) => { assign(textNode, tag); used.add(textNode.id); };
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
  const infoItem = rows?.items[0];
  if (infoItem) {
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
    if (icon) {
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
  for (const textNode of textsIn(card)) {
    if (used.has(textNode.id)) continue;
    if (rows && rows.items.some((item) => contains(item, textNode.id))) continue;
    const word = textNode.text.characters;
    if (same(word, pack.name)) take(textNode, '{vnx_sp_name}');
    else if (textNode.text?.decoration === 'STRIKETHROUGH') take(textNode, '{vnx_sp_regular}');
    else if (same(word, price.sale) || pack.prices.some((item) => same(word, item.sale))) take(textNode, '{vnx_sp_sale}');
    else if (same(word, price.regular)) take(textNode, '{vnx_sp_regular}');
    else if (same(word, price.total)) take(textNode, '{vnx_sp_total}');
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
    return digits.length >= 3 && /^[\d\s.,]+$/.test(raw);
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
  let promo = null;
  const walkPromo = (current) => {
    if (rows && (current.id === rows.host.id || rows.items.some((item) => contains(item, current.id) || item.id === current.id))) return;
    const texts = textsIn(current).filter((text) => !used.has(text.id));
    if (texts.length === 2) promo = texts;
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
      if (textNode.text?.decoration === 'STRIKETHROUGH') take(textNode, '{vnx_sp_regular}');
      else take(textNode, '{vnx_sp_sale}');
    }
  }
  if (promo) {
    const [code, sentence] = fold(promo[0].text.characters).includes(' ') ? [promo[1], promo[0]] : [promo[0], promo[1]];
    take(sentence, '{vnx_sp_promo_text}');
    take(code, '{vnx_sp_code}');
    put(code.id, { settings: { text: '{vnx_sp_code}', _attributes: [{ name: 'data-vnx-sp-copy', value: '{vnx_sp_code}' }], _conditions: [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_code}', compare: 'empty_not' }]] } });
  }

  if (price.special) {
    const image = textsIn(card).length && findImage(card);
    if (image) {
      const prev = patches[image.id] ?? {};
      patches[image.id] = { ...prev, settings: { ...(prev.settings ?? {}), image: { useDynamicData: '{vnx_sp_label}' } } };
    }
  }

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

function priceCardScript() {
  return `(function(){${stepPriceCard.toString()}document.addEventListener("click",function(event){var button=event.target&&event.target.closest&&event.target.closest("[data-vnx-sp-prev],[data-vnx-sp-next]");if(!button)return;stepPriceCard(button,button.hasAttribute("data-vnx-sp-prev")?-1:1);});})();`;
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
  const value = bindPrice(node, det?.params?.table, det?.params?.id, scope, det?.params?.buttonAttrs, det?.params?.selected);
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
  return [
    ...priceFrames(tree).filter((frame) => !loaded(PartKind.PRICE_TABLE, frame.id)).map((frame) => gap(PartKind.PRICE_TABLE, frame)),
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
