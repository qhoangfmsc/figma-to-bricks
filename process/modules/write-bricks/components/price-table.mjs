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
// A line through the whole text: the text's own decoration, or one run style that covers every character.
// A tag replaces the runs, so the line is written on the element.
function struck(textNode) {
  const text = textNode?.text;
  if (!text) return false;
  if (text.decoration === 'STRIKETHROUGH') return true;
  const runs = (text.runs ?? []).filter((run) => run.text);
  return runs.length > 0 && runs.every((run) => run.style?.textDecoration === 'STRIKETHROUGH')
    && runs.map((run) => run.text).join('') === text.characters;
}
// A drawn amount: the number with thousands marks, and at most one short currency mark
// (a currency sign or up to three letters) before or after it. A percent or a sign is not a mark.
const MONEY = /^([\p{Sc}\p{L}]{1,3}\s?)?(\d(?:[\d\s.,]*\d)?)(\s?[\p{Sc}\p{L}]{1,3})?$/u;
const digitsOf = (value) => String(value ?? '').replace(/\D/g, '');
// The tag for a drawn amount whose digits equal one cell's digits, or null.
// The tag prints the cell, so a mark the cell already carries is not added again.
function moneyTag(drawn, cells, tag) {
  const match = norm(drawn).match(MONEY);
  if (!match) return null;
  const digits = digitsOf(match[2]);
  const cell = cells.find((value) => digitsOf(value) && digitsOf(value) === digits);
  if (cell == null) return null;
  const carried = (mark) => !mark || fold(cell).includes(fold(mark));
  const before = match[1] ?? '';
  const after = match[3] ?? '';
  return `${carried(before) ? '' : before}${tag}${carried(after) ? '' : after}`;
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

function pickCyclePair(items, selectedId) {
  const peers = items.filter((item) => !hoverState(item));
  const pool = peers.length >= 2 ? peers : items;
  const named = selectedId ? items.find((item) => item.id === selectedId) : null;
  const found = activeTitle(pool);
  const active = named ?? (found.clear && Number.isInteger(found.index) ? pool[found.index] : null);
  // The loop repeats one resting pill. The fullest one (a badge beside the label) carries every part a cycle may show.
  const resting = pool.filter((item) => item !== active && [ComponentState.REST, null, undefined].includes(componentState(item)));
  const fullest = resting.reduce((best, item) => (!best || textsIn(item).length > textsIn(best).length ? item : best), null);
  const rest = fullest
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

function bindPrice(node, table, id, root, attrs, selectedId, shown) {
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
      // A looped pill carries the popular cycle flag: the tool's script opens that cycle starting from the first tab
      // (a fixed open index left both tabs open). The drawn open pill still decides which prices the card shows.
      settings: { openTab: String(cycleProto && !cycleField ? 0 : openAt) },
      css: [...flexDirectionCss(hostNode), ...tabsChromeCss({ keepTitleWidth: cycleProto?.sizing?.h === 'FIXED' })],
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
  // One drawn card sits in a shell the others do not have (a top tag, its own fill and stroke). That is the
  // highlighted package. The tool's popular flag picks the package, so the looped card carries the shell as a
  // state: the tag shows and the shell look applies only when {vnx_sp_popular} is 1. Values are the drawn shell's.
  // The shell has its own paint (fill or stroke) and its mark is a written label. A bare mark beside a card is not this.
  const highlighted = (item) => (item.fills ?? []).some((fill) => fill.visible !== false) || (item.stroke?.paints ?? []).some((paint) => paint.visible !== false);
  const shelled = card.type !== 'TEXT'
    ? cards.items.find((item) => item.id !== card.id && highlighted(item) && shellMarks(item).some((mark) => textsIn(mark).length))
    : null;
  if (shelled) {
    const marks = shellMarks(shelled);
    const popular = [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_popular}', compare: '==', value: '1' }]];
    for (const mark of marks) put(mark.id, { settings: { _conditions: popular }, rawCss: '%class% { order: -1; }' });
    const paints = (shelled.fills ?? []).filter((fill) => fill.type === 'SOLID' && fill.visible !== false);
    const layers = paints.slice(1).reverse().map((fill) => `linear-gradient(${cssColor(fill)}, ${cssColor(fill)})`);
    const stroke = (shelled.stroke?.paints ?? []).find((paint) => paint.type === 'SOLID' && paint.visible !== false);
    const pad = shelled.layout?.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const radius = shelled.radius ?? [0, 0, 0, 0];
    const decls = [
      `flex-direction: ${shelled.layout?.mode === 'HORIZONTAL' ? 'row' : 'column'};`,
      `padding: ${px(pad.top)} ${px(pad.right)} ${px(pad.bottom)} ${px(pad.left)};`,
      ...(shelled.sizing?.h === 'FIXED' && shelled.box?.w ? [`width: ${px(shelled.box.w)};`] : []),
      ...(paints.length ? [`background: ${[...layers, cssColor(paints[0])].join(', ')};`] : []),
      ...(stroke ? [`border: ${px(shelled.stroke.weight ?? 1)} solid ${cssColor(stroke)};`] : []),
      `border-radius: ${radius.map((value) => px(value)).join(' ')};`,
      ...(shelled.clip ? ['overflow: hidden;'] : []),
    ];
    // The drawn body inside the shell: its own stroke (none when the shell draws the edge).
    const shellBody = visibleKids(shelled).find((child) => !marks.includes(child));
    const bodyStroke = (shellBody?.stroke?.paints ?? []).find((paint) => paint.type === 'SOLID' && paint.visible !== false);
    const bodyDecl = bodyStroke ? `border: ${px(shellBody.stroke.weight ?? 1)} solid ${cssColor(bodyStroke)};` : 'border-style: none;';
    put(card.id, {
      adopt: marks.map((mark) => mark.id),
      settings: { _attributes: [...(patches[card.id]?.settings?._attributes ?? []), { name: 'data-vnx-sp-popular', value: '{vnx_sp_popular}' }] },
      rawCss: [patches[card.id]?.rawCss, `%class%[data-vnx-sp-popular="1"] { ${decls.join(' ')} }`, `%class%[data-vnx-sp-popular="1"] > :not([data-vnx-sp-mark]) { ${bodyDecl} }`].filter(Boolean).join('\n'),
    });
    for (const mark of marks) put(mark.id, { settings: { _attributes: [{ name: 'data-vnx-sp-mark', value: '1' }] } });
  }
  if (flanks.prev) put(flanks.prev.id, { settings: { _attributes: [{ name: 'data-vnx-sp-prev', value: '1' }] } });
  if (flanks.next) put(flanks.next.id, { settings: { _attributes: [{ name: 'data-vnx-sp-next', value: '1' }] } });
  if (rows && rows.items[0].type !== 'TEXT') put(rows.items[0].id, { settings: loop('row', id) });
  // A text with a trailing mark drawn right after the looped rows is a show-more control: the rows past the drawn count
  // (or the planned count) stay closed until it is clicked, and it is hidden when a package has no more rows than that.
  if (rows && rows.host.id !== card.id) {
    const shelf = parentOf(card, rows.host.id);
    const kids = shelf ? visibleKids(shelf) : [];
    const control = kids[kids.indexOf(rows.host) + 1];
    const parts = control && control.type !== 'TEXT' ? visibleKids(control) : [];
    const trailingMark = parts.length === 2 && parts[0].type === 'TEXT' && textsIn(parts[1]).length === 0 && hasSvg(parts[1]);
    const words = trailingMark ? norm(parts[0].text.characters) : '';
    const isInfo = words && pack.info.some((info) => same(words, info.text));
    if (trailingMark && words && !isInfo) {
      const planned = Number(shown);
      const count = Number.isInteger(planned) && planned > 0 ? planned : rows.items.length;
      const next = count + 1;
      put(control.id, {
        settings: {
          tag: 'button',
          _cssClasses: 'vnx-sp-more',
          _interactions: [{ id: `vnxspmore${next}`, trigger: 'click', action: 'toggleAttribute', target: 'self', actionAttributeKey: 'class', actionAttributeValue: 'vnx-sp-more-open' }],
        },
        dropSettings: ['link'],
      });
      put(rows.host.id, {
        rawCss: [
          patches[rows.host.id]?.rawCss,
          `%class%:not(:has(~ .vnx-sp-more-open)) > :nth-child(n+${next}) { display: none !important; }`,
          `%class%:not(:has(> :nth-child(${next}))) ~ .vnx-sp-more { display: none !important; }`,
          `%class% ~ .vnx-sp-more-open svg { transform: rotate(180deg); }`,
        ].filter(Boolean).join('\n'),
      });
    }
  }

  const assign = (textNode, tag) => tagText(patches, textNode.id, tag);
  const used = new Set();
  const take = (textNode, tag) => { assign(textNode, tag); used.add(textNode.id); };
  const takeStruck = (textNode) => {
    take(textNode, '{vnx_sp_regular}');
    if (textNode.text?.decoration !== 'STRIKETHROUGH') put(textNode.id, { settings: { _typography: { 'text-decoration': 'line-through' } } });
  };
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
    if (!cycleField) {
      // The badge frame Figma drew around the text shows only for a cycle that has a badge.
      const host = parentOf(cycleProto, textNode.id);
      put(host && host.id !== cycleProto.id ? host.id : textNode.id, { settings: { _conditions: showBadge } });
    }
    if (cycleField) {
      const host = parentOf(cycleField, textNode.id);
      const badgeHost = host && host.id !== cycleField.id ? host.id : textNode.id;
      put(badgeHost, { settings: { _conditions: showBadge, _hidden: { _cssClasses: 'f2b-select-badge' } } });
      taggedBadge = true;
    }
  }
  // A mark laid over one pill only (absolute, no cycle word in it) is the popular cycle's mark: the looped pill carries it and
  // it shows on the cycle the table flags popular, whichever cycle the drawing put it on. The popular cycle opens on page load
  // (the tool's script reads data-vnx-sp-open-tab); without a flag the first tab opens.
  if (cycles && cycleProto && !cycleField) {
    const adopt = [];
    for (const pill of cycles.items) {
      if (pill.id === cycleProto.id) continue;
      const word = textsIn(pill).map((text) => text.text.characters).find((value) => table.cycles.some((cycle) => same(value, cycle.label)));
      if (!word) continue;
      for (const mark of visibleKids(pill)) {
        if (mark.place !== 'ABSOLUTE') continue;
        if (textsIn(mark).some((text) => table.cycles.some((item) => same(text.text.characters, item.label)))) continue;
        adopt.push(mark.id);
        put(mark.id, { settings: { _conditions: [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_cycle_popular}', compare: '==', value: '1' }]] } });
      }
    }
    if (adopt.length) put(cycleProto.id, { adopt });
  }
  if (tabsHost && cycleProto && !cycleField) {
    put(cycleProto.id, { settings: { _attributes: [...(patches[cycleProto.id]?.settings?._attributes ?? []), { name: 'data-vnx-sp-open-tab', value: '{vnx_sp_cycle_popular}' }] } });
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
    // The Service Pricing tool stores either a yes / no / highlight mark or a font class per info line.
    const marks = new Set(['yes', 'no', 'highlight', '']);
    const classIcons = table.packages.some((item) => item.info.some((info) => !marks.has(String(info.icon ?? '').trim())));
    if (icon && classIcons) {
      const size = Math.max(icon.box?.w || 0, icon.box?.h || 0);
      put(icon.id, {
        kind: 'div',
        skipChildren: true,
        dropSettings: ['text'],
        iconSvg: icon.svg?.file ?? null,
        settings: {
          tag: 'custom',
          customTag: 'i',
          _attributes: [{ name: 'class', value: '{vnx_sp_info_icon_class}' }],
          _conditions: [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_info_icon_class}', compare: 'empty_not' }]],
          ...(size ? { _typography: { 'font-size': px(size), 'line-height': px(icon.box?.h || size), 'text-align': 'center' } } : {}),
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
  // A percent mark drawn on the card is the package's own tag for the open cycle (the price cell's tag), not a number worked out
  // from the prices or the cycle badge. The drawn badge around it shows only when that package has a tag in that cycle.
  const percentOff = (word) => norm(word).match(/^-\s?(\d{1,3})\s?%$/)?.[1] ?? '';
  const takeTag = (textNode) => {
    take(textNode, '{vnx_sp_tag}');
    const host = parentOf(card, textNode.id);
    const lone = host && host.id !== card.id && textsIn(host).length === 1;
    put(lone ? host.id : textNode.id, { settings: { _conditions: [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_tag}', compare: 'empty_not' }]] } });
  };
  // The card draws the open cycle, so its sale and regular numbers come first. Another cycle's number is the fallback.
  const drawnMoney = (word) => moneyTag(word, [price.sale], '{vnx_sp_sale}')
    ?? moneyTag(word, [price.regular], '{vnx_sp_regular}')
    ?? moneyTag(word, pack.prices.map((item) => item.sale), '{vnx_sp_sale}')
    ?? moneyTag(word, pack.prices.map((item) => item.regular), '{vnx_sp_regular}');
  for (const textNode of textsIn(card)) {
    if (used.has(textNode.id)) continue;
    if (rows && rows.items.some((item) => contains(item, textNode.id))) continue;
    const word = textNode.text.characters;
    if (same(word, pack.name)) take(textNode, '{vnx_sp_name}');
    else if (struck(textNode)) takeStruck(textNode);
    else if (percentOff(word) || same(word, price.tag) || pack.prices.some((item) => same(word, item.tag))) takeTag(textNode);
    else if (same(word, price.sale)) take(textNode, '{vnx_sp_sale}');
    else if (same(word, price.regular)) take(textNode, '{vnx_sp_regular}');
    else if (pack.prices.some((item) => same(word, item.sale))) take(textNode, '{vnx_sp_sale}');
    else if (drawnMoney(word)) take(textNode, drawnMoney(word));
    else if (same(word, price.total)) take(textNode, '{vnx_sp_total}');
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
  // A sentence that carries the open cycle's total or saving: the number becomes that tag and the words stay.
  // The saving is (regular - sale) for every billed unit of the total. The open cycle's label in that sentence is the cycle.
  const savingOf = (cell) => {
    const regular = Number(digitsOf(cell.regular));
    const sale = Number(digitsOf(cell.sale));
    const total = Number(digitsOf(cell.total));
    if (!regular || !sale || !total || regular <= sale || total % sale) return '';
    return String((regular - sale) * (total / sale));
  };
  const sums = [[digitsOf(price.total), '{vnx_sp_total}'], [savingOf(price), '{vnx_sp_saving}']].filter(([digits]) => digits);
  const cycleLabel = table.cycles[openAt]?.label ?? '';
  for (const textNode of textsIn(card)) {
    if (used.has(textNode.id) || !sums.length) continue;
    if (rows && rows.items.some((item) => contains(item, textNode.id))) continue;
    const words = textNode.text.characters;
    if (!/\p{L}/u.test(words)) continue;
    let changed = false;
    let out = words.replace(/\d{1,3}(?:[.,\s]\d{3})+|\d+/g, (token) => {
      const hit = sums.find(([digits]) => digits === digitsOf(token));
      if (!hit) return token;
      changed = true;
      return hit[1];
    });
    if (!changed) continue;
    if (cycleLabel) {
      const at = out.toLocaleLowerCase('vi').indexOf(cycleLabel.toLocaleLowerCase('vi'));
      if (at >= 0) out = out.slice(0, at) + '{vnx_sp_cycle}' + out.slice(at + cycleLabel.length);
    }
    take(textNode, out);
    // The sentence is about that number: with no saving (or total) for the open cycle it is not shown.
    const bound = sums.filter(([, tag]) => out.includes(tag)).map(([, tag]) => [{ key: 'dynamic_data', dynamic_data: tag, compare: 'empty_not' }]);
    if (bound.length) put(textNode.id, { settings: { _conditions: [bound.flat()] } });
  }
  // A text another card draws right before its info rows, where the looped card draws none, is that package's specs title.
  // The looped card carries it first in the block that holds its rows, and it shows only when the package has a specs title.
  if (rows && cards.items.length > 1) {
    const shelf = parentOf(card, rows.host.id);
    const headingOf = (scope) => {
      const group = bestGroup(scope, infoItemShape, 2);
      const parent = group ? parentOf(scope, group.host.id) : null;
      if (!parent) return null;
      const kids = visibleKids(parent);
      const prev = kids[kids.indexOf(group.host) - 1];
      return prev && prev.type === 'TEXT' && !prev.svg && /\p{L}/u.test(prev.text.characters) ? prev : null;
    };
    const heading = shelf && shelf.id !== card.id && !headingOf(card)
      ? cards.items.filter((item) => item.id !== card.id).map(headingOf).find(Boolean)
      : null;
    if (heading) {
      put(shelf.id, { adopt: [...(patches[shelf.id]?.adopt ?? []), heading.id] });
      put(heading.id, {
        settings: { text: '{vnx_sp_specs_title}', _conditions: [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_specs_title}', compare: 'empty_not' }]] },
        rawCss: [patches[heading.id]?.rawCss, '%class% { order: -1; }'].filter(Boolean).join('\n'),
      });
    }
  }
  // With no button label in the table, the card's call to action is the painted frame holding one text, drawn below the price.
  // Its words stay as drawn, the package name in them becomes the name, and it links to the open cycle's sign-up.
  if (!table.meta.button && pack.links.some(Boolean)) {
    const yOf = (item) => item.box?.absY ?? item.box?.y ?? 0;
    const priced = textsIn(card).filter((textNode) => /\{vnx_sp_(sale|regular)\}/.test(patches[textNode.id]?.settings?.text ?? ''));
    const priceY = priced.length ? Math.max(...priced.map(yOf)) : null;
    const actions = priceY === null ? [] : textsIn(card).filter((textNode) => {
      if (used.has(textNode.id) || !/\p{L}/u.test(textNode.text.characters) || yOf(textNode) <= priceY) return false;
      if (rows && rows.items.some((item) => contains(item, textNode.id))) return false;
      const host = parentOf(card, textNode.id);
      return !!host && host.id !== card.id && highlighted(host) && textsIn(host).length === 1;
    }).sort((a, b) => yOf(b) - yOf(a));
    const action = actions[0];
    if (action) {
      const words = action.text.characters;
      const at = pack.name ? words.toLocaleLowerCase('vi').indexOf(pack.name.toLocaleLowerCase('vi')) : -1;
      const out = at >= 0 ? words.slice(0, at) + '{vnx_sp_name}' + words.slice(at + pack.name.length) : words;
      take(action, out);
      put(parentOf(card, action.id).id, { settings: registerButton(out, attrs) });
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
    // A written unit (a slash and words) and a percent mark are not a promo sentence or a code.
    const notPromo = (text) => /^\/\s?\p{L}/u.test(norm(text.text.characters)) || /%$/.test(norm(text.text.characters));
    const texts = textsIn(current).filter((text) => !used.has(text.id) && !notPromo(text));
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
      if (struck(textNode)) takeStruck(textNode);
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
  const value = bindPrice(node, det?.params?.table, det?.params?.id, scope, det?.params?.buttonAttrs, det?.params?.selected, det?.params?.shown);
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
    const patches = bound(node, det, ctx?.root ?? node).patches;
    // A font icon replaces a drawn svg. Its color is the svg's own paint.
    for (const patch of Object.values(patches)) {
      if (!patch.iconSvg || !ctx?.readAsset || patch.settings?._typography?.color) continue;
      let svg = '';
      try { svg = ctx.readAsset(patch.iconSvg) ?? ''; } catch { svg = ''; }
      const paint = [...String(svg).matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]{6})"/g)].map((match) => match[1].toLowerCase())[0];
      if (paint) patch.settings._typography = { ...(patch.settings._typography ?? {}), color: { hex: paint } };
    }
    return patches;
  },
  mergedNodes(det, node) {
    return bound(node, det).omit;
  },
  pageScript() {
    return `${tabSwitch.pageScript()}\n${selectScript()}\n${priceCardScript()}`;
  },
};
