// A comparison table is a header of package columns plus feature groups.
// Each group has a title and rows. Each row has one cell per package. A cell is a mark or text.
// The lines of a price card stay inside that card. These rows sit outside the columns and line up under them.
// One column, one group, one row and one cell stay. Query loops repeat them.
// The plugin resolves vnxcmp_{pkg|group|row}__{id} and {vnx_cmp_*} at request time.
import { PartKind } from '../../recognize-parts/kinds.mjs';
import { visibleKids } from '../../write-bricks/components/helpers.mjs';
import { queryType } from '../../write-bricks/components/compare-data.mjs';
import { colorObj, px } from '../../write-bricks/render/utils/css.mjs';
import { drawnTipWidth, tipWrap } from '../../write-bricks/components/tooltip.mjs';

const cache = new WeakMap();
const norm = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const fold = (value) => norm(value).toLocaleLowerCase('vi');
const same = (drawn, cell) => {
  const left = fold(drawn);
  const right = fold(cell);
  return !!left && !!right && left === right;
};
const amount = (word) => {
  const raw = norm(word);
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 3 && /^[\d\s.,]+$/.test(raw);
};
// A narrow column draws the price and its unit as one string ("12.000/wk"). A bare year is not a price.
const groupedNumber = (word) => norm(word).match(/\d{1,3}(?:[.,]\d{3})+/)?.[0] ?? '';
const priced = (word) => amount(word) || !!groupedNumber(word);
const sameTail = (rest, field) => {
  const left = fold(rest).replace(/^[/ ]+/, '');
  const right = fold(field).replace(/^[/ ]+/, '');
  return !!left && !!right && left === right;
};
function mixedPrice(word, position, id, table) {
  const raw = norm(word);
  const num = groupedNumber(word);
  if (!num || amount(word)) return '';
  const rest = raw.slice(raw.indexOf(num) + num.length);
  const price = tag('price', position, id);
  if (!rest.trim()) return price;
  const cycle = position ? table.packages[position - 1]?.cycle : (table.packages.every((item) => item.cycle === table.packages[0]?.cycle) ? table.packages[0]?.cycle : '');
  if (sameTail(rest, table.meta?.unit)) return `${price}${tag('unit', position, id)}`;
  if (sameTail(rest, cycle)) return `${price}${rest.match(/^[\s/]+/)?.[0] ?? ''}${tag('cycle', position, id)}`;
  if (table.meta?.unit && /^[\s/]/.test(rest)) return `${price}${tag('unit', position, id)}`;
  return `${price}${rest}`;
}

export const BUY_BUTTON_FIELDS = [
  { id: 'href', value: '{vnx_cmp_link}', slot: 'href' },
  { id: 'rel', value: 'nofollow', slot: 'rel' },
  { id: 'class', value: 'vnx-button vnx-btn-conversion vnx-button-register', slot: 'class' },
  { id: 'data-price', value: '{vnx_cmp_price:raw}', slot: 'data' },
  { id: 'data-period', value: '{vnx_cmp_cycle}', slot: 'data' },
  { id: 'data-product-name', value: '{vnx_cmp_name}', slot: 'data' },
  { id: 'data-product-category', value: '', slot: 'data' },
];

export const buyAttrKey = (node, id) => `pattr:${node}|${id}`;

// Every compare layout in the service-price tool: the first group stays open, and a later group gets "Xem thêm" only when it has more than 4 rows. Rows after the 4th stay hidden until the group is open.
const PREVIEW_ROWS = 4;

function collapsedRowCss() {
  const css = [
    { decl: 'display: none !important;', suffix: ':not(.is-open) .f2b-cmp-row' },
    { decl: 'display: none !important;', suffix: ' .f2b-cmp-less-label' },
    { decl: 'display: none !important;', suffix: ' .f2b-cmp-up' },
    { decl: 'display: none !important;', suffix: '.is-open .f2b-cmp-more-label' },
    { decl: 'display: none !important;', suffix: '.is-open .f2b-cmp-down' },
    { decl: 'display: inline-flex !important; justify-content: center;', suffix: '.is-open .f2b-cmp-less-label' },
    { decl: 'display: inline-flex !important;', suffix: '.is-open .f2b-cmp-up' },
  ];
  for (let index = 1; index <= PREVIEW_ROWS; index += 1) {
    css.push({ decl: 'display: flex !important;', suffix: `:not(.is-open) .f2b-cmp-i-${index}` });
  }
  css.push({ decl: 'display: flex !important;', suffix: '.f2b-cmp-g-1 .f2b-cmp-row' });
  return css;
}

function moreArrow(name, glyph) {
  return {
    name: 'icon',
    label: glyph.endsWith('down') ? 'Down' : 'Up',
    settings: {
      icon: { library: 'fontawesome', icon: glyph },
      iconSize: '14px',
      iconColor: { hex: '#007cfc' },
      _cssClasses: name,
      _margin: { left: '6px' },
    },
  };
}

const tag = (name, position, tableId, extra = []) => {
  const args = [...extra];
  if (tableId) args.push(`t=${tableId}`);
  if (position) args.push(`p=${position}`);
  return `{vnx_cmp_${name}${args.length ? `:${args.join(':')}` : ''}}`;
};
const yesNo = (position, tableId) => [
  [{ key: 'dynamic_data', dynamic_data: tag('value_type', position, tableId), compare: '==', value: 'yes' }],
  [{ key: 'dynamic_data', dynamic_data: tag('value_type', position, tableId), compare: '==', value: 'no' }],
];
const textOnly = (position, tableId) => [[{ key: 'dynamic_data', dynamic_data: tag('value_type', position, tableId), compare: '==', value: 'text' }]];
const top = (node) => node?.box?.absY ?? node?.box?.y ?? 0;

function textsIn(node, out = []) {
  if (!node || node.visible === false) return out;
  if (node.type === 'TEXT' && !node.svg && node.text?.characters) out.push(node);
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

function svgIn(node) {
  if (!node || node.visible === false) return null;
  if (node.svg) return node;
  for (const child of node.children ?? []) {
    const found = svgIn(child);
    if (found) return found;
  }
  return null;
}

function hasSvg(node) {
  if (!node || node.visible === false) return false;
  if (node.svg) return true;
  return visibleKids(node).some(hasSvg);
}

function solidFill(node) {
  if (!node) return null;
  const own = (node.fills ?? []).find((fill) => fill.visible !== false && fill.type === 'SOLID' && fill.hex);
  if (own) return own;
  for (const child of node.children ?? []) {
    const found = solidFill(child);
    if (found) return found;
  }
  return null;
}

function markNode(cell) {
  if (!cell || textsIn(cell).length) return null;
  return cell.svg ? cell : visibleKids(cell).find((child) => hasSvg(child)) ?? null;
}

function drawnMark(groups) {
  for (const group of groups) {
    for (const row of group.rows) {
      for (const cell of row.cells) {
        const node = markNode(cell);
        if (node?.box) return { size: Math.max(node.box.w, node.box.h), fill: solidFill(node) };
      }
    }
  }
  return null;
}

const NO_MARK = { icon: 'fa-solid fa-xmark', hex: '#f62e13' };

function questionIcons(feature) {
  const icons = [];
  const walk = (node) => {
    if (!node || node.visible === false) return;
    if (node.svg) icons.push(node);
    for (const child of node.children ?? []) walk(child);
  };
  for (const lead of feature.lead) walk(lead);
  return icons;
}

function tipBubble(scope, groups, columns) {
  const blocked = (id) => columns.some((col) => col.id === id || contains(col, id))
    || groups.some((group) => group.rows.some((row) => row.node.id === id || contains(row.node, id)));
  let found = null;
  const walk = (node) => {
    if (!node || node.visible === false || blocked(node.id)) return;
    const named = /tooltip|hint|popover/i.test(node.name || '');
    const fill = (node.fills ?? []).find((paint) => paint.visible !== false && paint.type === 'SOLID' && paint.hex);
    const text = textsIn(node)[0];
    if (named && fill && text) found = found ?? { node, fill, text };
    for (const child of node.children ?? []) walk(child);
  };
  walk(scope);
  return found;
}

function iconColor(fill) {
  return fill?.hex ? colorObj({ hex: fill.hex, alpha: fill.alpha ?? 1 }) : null;
}

function isCell(node) {
  return textsIn(node).length <= 1;
}

function isPackageColumn(node) {
  if (!node || node.layout?.mode === 'HORIZONTAL') return false;
  const texts = textsIn(node);
  return texts.length >= 2 && texts.some((text) => priced(text.text.characters));
}

function featureRow(node, packageCount) {
  if (node?.layout?.mode !== 'HORIZONTAL') return null;
  const kids = visibleKids(node);
  const cells = kids.slice(-packageCount);
  const lead = kids.slice(0, kids.length - packageCount);
  if (cells.length !== packageCount || !cells.every(isCell)) return null;
  if (!lead.length || lead.some((item) => textsIn(item).length > 2)) return null;
  return { node, cells, lead };
}

function valueCells(node, packageCount) {
  if (node?.layout?.mode !== 'HORIZONTAL') return null;
  const kids = visibleKids(node);
  if (kids.length !== packageCount || !kids.every(isCell)) return null;
  return kids;
}

// The name sits on its own row. The row under it is one cell per package. Both rows are one feature.
function stackedFeature(node, packageCount) {
  if (node?.layout?.mode !== 'VERTICAL') return null;
  const kids = visibleKids(node);
  const cells = kids.map((child) => valueCells(child, packageCount)).find(Boolean);
  if (!cells) return null;
  const lead = kids.filter((child) => child.layout?.mode === 'HORIZONTAL' && !valueCells(child, packageCount) && textsIn(child).length > 0 && textsIn(child).length <= 3);
  if (lead.length !== 1) return null;
  return { node, cells, lead, stacked: true };
}

function matrixOf(scope) {
  let header = null;
  const walk = (node) => {
    if (node?.layout?.mode === 'HORIZONTAL') {
      const kids = visibleKids(node);
      const cols = kids.filter(isPackageColumn);
      if (cols.length >= 2 && kids.length - cols.length <= 1 && (!header || cols.length > header.cols.length)) header = { host: node, cols };
    }
    visibleKids(node).forEach(walk);
  };
  walk(scope);
  if (!header) return null;
  const rows = [];
  const scan = (node) => {
    if (header.cols.some((col) => contains(col, node.id))) return;
    const row = featureRow(node, header.cols.length) ?? stackedFeature(node, header.cols.length);
    if (row) { rows.push(row); return; }
    visibleKids(node).forEach(scan);
  };
  scan(scope);
  const byParent = new Map();
  for (const row of rows) {
    const parent = parentOf(scope, row.node.id);
    if (!parent || parent.id === header.host.id || parent.layout?.mode === 'HORIZONTAL') continue;
    const list = byParent.get(parent.id) ?? { host: parent, rows: [] };
    list.rows.push(row);
    byParent.set(parent.id, list);
  }
  const groups = [...byParent.values()].filter((group) => group.rows.length >= 2 && !contains(group.host, header.host.id));
  if (!groups.length) return null;
  return { header, groups };
}

const hasAttr = (el, name) => (el?.settings?._attributes ?? []).some((attr) => attr?.name === name);

// No tablet frame: three packages fit in the frame. A feature name is its own row. The row under it is the package values. Switch buttons sit in the package heading, not on the page title.
export function applyCompareTablet(template, keys = []) {
  const use = keys.filter((key) => key === 'tablet_portrait');
  if (!use.length) return template;
  const content = template.content ?? [];
  const share = (count) => `calc(100% / ${Math.min(Math.max(count, 1), 3)})`;
  const rows = content.filter((el) => hasAttr(el, 'data-vnx-cmp-slider') || /\bf2b-cmp-row\b/.test(el.settings?._cssClasses ?? ''));
  for (const row of rows) {
    const settings = row.settings ??= {};
    const children = content.filter((el) => el.parent === row.id);
    const cols = children.filter((el) => hasAttr(el, 'data-vnx-cmp-col'));
    const feature = /\bf2b-cmp-row\b/.test(settings._cssClasses ?? '');
    const slides = hasAttr(row, 'data-vnx-cmp-slider') && cols.length > 3;
    for (const key of use) {
      settings[`_direction:${key}`] = 'row';
      settings[`_flexWrap:${key}`] = feature ? 'wrap' : 'nowrap';
      settings[`_overflow:${key}`] = slides ? 'auto' : 'visible';
      settings[`_width:${key}`] = '100%';
      settings[`_widthMax:${key}`] = '100%';
      settings[`_widthMin:${key}`] = '0px';
      if (hasAttr(row, 'data-vnx-cmp-slider')) {
        settings[`_position:${key}`] = 'relative';
        settings[`_top:${key}`] = '65px';
      }
    }
    for (const child of children) {
      const childSettings = child.settings ??= {};
      for (const key of use) {
        if (hasAttr(child, 'data-vnx-cmp-col')) {
          childSettings[`_flexGrow:${key}`] = 1;
          childSettings[`_flexShrink:${key}`] = 1;
          childSettings[`_flexBasis:${key}`] = '0px';
          childSettings[`_width:${key}`] = share(cols.length);
          childSettings[`_widthMax:${key}`] = share(cols.length);
          childSettings[`_widthMin:${key}`] = '0px';
        } else if (feature) {
          childSettings[`_flexGrow:${key}`] = 0;
          childSettings[`_flexShrink:${key}`] = 0;
          childSettings[`_flexBasis:${key}`] = '100%';
          childSettings[`_width:${key}`] = '100%';
        } else if (hasAttr(row, 'data-vnx-cmp-slider') && !hasAttr(child, 'data-vnx-cmp-prev') && !hasAttr(child, 'data-vnx-cmp-next')) {
          childSettings[`_display:${key}`] = 'none';
        }
      }
    }
  }
  for (const el of content) {
    if (!hasAttr(el, 'data-vnx-cmp-prev') && !hasAttr(el, 'data-vnx-cmp-next')) continue;
    if (el.settings?._display !== 'none') continue;
    const header = content.find((row) => row.id === el.parent && hasAttr(row, 'data-vnx-cmp-slider'));
    const count = header ? content.filter((child) => child.parent === header.id && hasAttr(child, 'data-vnx-cmp-col')).length : 0;
    if (count <= 3) continue;
    for (const key of use) el.settings[`_display:${key}`] = 'flex';
  }
  return template;
}

export function compareFrames(root) {
  if (!root) return [];
  const frames = [];
  const walk = (node) => {
    if (matrixOf(node)) frames.push(node);
    visibleKids(node).forEach(walk);
  };
  walk(root);
  return frames.filter((frame) => !frames.some((other) => other !== frame && contains(frame, other.id)));
}

function buyValue(attrs, field) {
  const typed = attrs?.[field.id];
  if (typeof typed === 'string' && typed.trim()) return typed.trim();
  return field.value;
}

function buyButton(text, attrs) {
  const href = buyValue(attrs, BUY_BUTTON_FIELDS.find((field) => field.slot === 'href'));
  const rel = buyValue(attrs, BUY_BUTTON_FIELDS.find((field) => field.slot === 'rel'));
  const css = buyValue(attrs, BUY_BUTTON_FIELDS.find((field) => field.slot === 'class'));
  const data = BUY_BUTTON_FIELDS.filter((field) => field.slot === 'data')
    .map((field) => ({ name: field.id, value: buyValue(attrs, field) }))
    .filter((attr) => attr.value);
  return {
    text,
    tag: 'a',
    link: { type: 'external', url: href, ...(rel ? { rel } : {}) },
    ...(css ? { _cssClasses: css } : {}),
    ...(data.length ? { _attributes: data } : {}),
  };
}

function loop(kind, id) {
  return { hasLoop: true, query: { objectType: queryType(kind, id) } };
}

function rowScrolls(node) {
  return !!node && node.layout?.mode === 'HORIZONTAL' && node.clip && visibleKids(node).length >= 2;
}

function flank(parent, track) {
  const kids = visibleKids(parent);
  const index = kids.findIndex((child) => child.id === track.id);
  const plain = (node) => node && !isPackageColumn(node) && textsIn(node).length <= 1 && !textsIn(node).some((text) => amount(text.text.characters));
  return {
    prev: plain(kids[index - 1]) ? kids[index - 1] : null,
    next: plain(kids[index + 1]) ? kids[index + 1] : null,
  };
}

function moreControl(host, rows) {
  const ids = new Set(rows.map((row) => row.node.id));
  const last = visibleKids(host).at(-1);
  if (!last || ids.has(last.id) || isPackageColumn(last)) return null;
  const texts = textsIn(last);
  if (texts.length !== 1 || texts.some((text) => amount(text.text.characters))) return null;
  return last;
}

function compareScene(node, table, id, root) {
  const empty = { patches: {}, omit: [], warnings: [], column: null, skip: false };
  if (!table?.packages?.length || !table.groups?.some((group) => group.rows.length) || !id) return { stop: empty };
  const scope = root ?? node;
  const matrix = matrixOf(scope);
  if (!matrix) return { stop: { ...empty, warnings: ['no package row and feature rows are drawn here'] } };
  const { header, groups } = matrix;
  const drawnMatch = header.cols.length === table.packages.length;
  const columns = drawnMatch ? header.cols : [header.cols[0]];
  const closed = groups.filter((item) => moreControl(item.host, item.rows));
  const opened = groups.filter((item) => !moreControl(item.host, item.rows));
  const group = closed[0] ?? groups[0];
  const feature = group.rows[0];
  if (!feature?.cells?.length) return { stop: { ...empty, warnings: ['a feature row has no cell under the package column'] } };
  return { scope, header, groups, drawnMatch, columns, closed, opened, group, dataGroup: table.groups[0], feature, drawn: drawnMark(groups) };
}

function omitCompareCopies(omit, { header, groups, group, feature, columns, drawnMatch }) {
  if (!drawnMatch) header.cols.filter((col) => col.id !== columns[0].id).forEach((col) => omit.push(col.id));
  groups.filter((item) => item.host.id !== group.host.id).forEach((item) => omit.push(item.host.id));
  group.rows.filter((row) => row.node.id !== feature.node.id).forEach((row) => omit.push(row.node.id));
  if (!drawnMatch) feature.cells.slice(1).forEach((item) => omit.push(item.id));
}

function compareBuy(position, id, attrs) {
  const button = buyButton(tag('button', position, id), attrs);
  const swap = (value) => String(value)
    .replaceAll('{vnx_cmp_link}', tag('link', position, id))
    .replaceAll('{vnx_cmp_price:raw}', tag('price', position, id, ['raw']))
    .replaceAll('{vnx_cmp_price}', tag('price', position, id))
    .replaceAll('{vnx_cmp_cycle}', tag('cycle', position, id))
    .replaceAll('{vnx_cmp_name}', tag('name', position, id))
    .replaceAll('{vnx_cmp_button}', tag('button', position, id));
  return {
    ...button,
    text: swap(button.text),
    link: { ...button.link, url: swap(button.link.url) },
    ...((button._attributes) ? { _attributes: button._attributes.map((attr) => ({ ...attr, value: swap(attr.value) })) } : {}),
  };
}

function fillCompareColumn(put, used, take, { table, id, attrs, column, position }) {
  const asBuy = (textNode) => {
    const frame = parentOf(column, textNode.id);
    const onlyText = frame && frame.id !== column.id && visibleKids(frame).filter((child) => child.type === 'TEXT' && !child.svg).length === 1;
    if (!onlyText) return;
    const button = compareBuy(position, id, attrs);
    delete button.text;
    put(frame.id, { kind: 'block', unmerge: true, dropSettings: ['text', 'icon', 'iconPosition'], settings: button });
  };
  for (const textNode of textsIn(column)) {
    const word = textNode.text.characters;
    if (table.packages.some((item) => same(word, item.total))) take(textNode, 'total', position);
    else if (table.meta.unit && same(word, table.meta.unit)) take(textNode, 'unit', position);
    else if (table.packages.some((item) => same(word, item.cycle))) take(textNode, 'cycle', position);
    else if (table.packages.some((item) => same(word, item.price)) || amount(word)) { take(textNode, 'price', position); asBuy(textNode); }
    else if (priced(word)) { put(textNode.id, { settings: { text: mixedPrice(word, position, id, table) } }); used.add(textNode.id); asBuy(textNode); }
    else if (table.meta.button && same(word, table.meta.button)) {
      take(textNode, 'button', position);
      const frame = parentOf(column, textNode.id);
      const onlyText = frame && visibleKids(frame).filter((child) => child.type === 'TEXT' && !child.svg).length === 1;
      if (onlyText) {
        const button = compareBuy(position, id, attrs);
        delete button.text;
        put(frame.id, { kind: 'block', unmerge: true, dropSettings: ['text', 'icon', 'iconPosition'], settings: button });
      }
    }
  }
  const prices = textsIn(column).filter((textNode) => priced(textNode.text.characters));
  const priceY = prices.length ? Math.min(...prices.map(top)) : Infinity;
  const nameNode = textsIn(column).filter((textNode) => !used.has(textNode.id) && top(textNode) < priceY)
    .sort((a, b) => top(b) - top(a))[0];
  if (nameNode) take(nameNode, 'name', position);
}

function fillCompareCell(put, { drawn, id, cell, position }) {
  const shared = drawn ?? {};
  const own = markNode(cell);
  const size = own?.box ? Math.max(own.box.w, own.box.h) : shared.size;
  const yesFill = solidFill(own) ?? shared.fill;
  const look = (which) => ({
    icon: { library: 'fontawesome', icon: which === 'yes' ? 'fa-solid fa-check' : NO_MARK.icon },
    ...(size ? { iconSize: px(size) } : {}),
    ...(which === 'yes'
      ? (iconColor(yesFill) ? { iconColor: iconColor(yesFill) } : {})
      : { iconColor: { hex: NO_MARK.hex } }),
    _conditions: which === 'yes' ? [yesNo(position, id)[0]] : [yesNo(position, id)[1]],
  });
  if (own) {
    put(own.id, { kind: 'icon', skipChildren: true, dropSettings: ['text'], settings: look('yes') });
    put(cell.id, { extraChildren: [{ name: 'icon', label: 'No', settings: look('no') }] });
  } else {
    put(cell.id, { extraChildren: [{ name: 'icon', label: 'Yes', settings: look('yes') }, { name: 'icon', label: 'No', settings: look('no') }] });
  }
  const cellText = textsIn(cell)[0];
  if (cellText) put(cellText.id, { settings: { text: tag('value_text', position, id), _conditions: textOnly(position, id) } });
  else put(cell.id, { extraChildren: [{ name: 'text-basic', label: 'Value', settings: { text: tag('value_text', position, id), _conditions: textOnly(position, id) } }] });
}

function bindCompareMore(put, { scope, id, group, opened, closed, table }) {
  const more = moreControl(group.host, group.rows);
  if (more) {
    const moreLabel = textsIn(more)[0];
    const down = svgIn(more);
    const downSize = down?.box ? Math.max(down.box.w, down.box.h) : 14;
    const arrow = (name, glyph, label) => ({
      name: 'icon',
      label,
      settings: {
        icon: { library: 'fontawesome', icon: glyph },
        iconSize: px(downSize),
        iconColor: { hex: '#007cfc' },
        _cssClasses: name,
        _margin: { left: '6px' },
      },
    });
    put(more.id, {
      settings: {
        _attributes: [{ name: 'data-vnx-cmp-more', value: '1' }],
        _justifyContent: 'center',
        _alignItems: 'center',
        _conditions: [[
          { key: 'dynamic_data', dynamic_data: tag('group_rows', null, id), compare: '>', value: String(PREVIEW_ROWS) },
          { key: 'dynamic_data', dynamic_data: tag('group_index', null, id), compare: '!=', value: '1' },
        ]],
      },
      css: [
        { decl: 'justify-content: center; align-items: center; color: #007cfc;', suffix: '' },
        { decl: 'position: static !important; left: auto !important; width: auto !important; flex: none !important; margin-left: 0 !important; margin-right: 0 !important;', suffix: ' :is(.f2b-cmp-more-label, .f2b-cmp-less-label, .f2b-cmp-down, .f2b-cmp-up)' },
      ],
    });
    if (moreLabel) put(moreLabel.id, { settings: { _cssClasses: 'f2b-cmp-more-label', _width: 'auto', _flexGrow: '0' } });
    if (down) {
      put(down.id, { kind: 'icon', skipChildren: true, dropSettings: ['text'], settings: arrow('f2b-cmp-down', 'fa-solid fa-angle-down', 'Down').settings });
    }
    const labelHost = moreLabel ? (parentOf(scope, moreLabel.id) || more) : more;
    put(labelHost.id, {
      settings: { _justifyContent: 'center', _alignItems: 'center', _width: '100%' },
      extraChildren: [
        ...(down ? [] : [arrow('f2b-cmp-down', 'fa-solid fa-angle-down', 'Down')]),
        { name: 'text-basic', label: 'Less', ...(moreLabel ? { like: moreLabel.id } : {}), text: 'Thu gọn', settings: { _cssClasses: 'f2b-cmp-less-label', _width: 'auto', _flexGrow: '0', _justifyContent: 'center' } },
        arrow('f2b-cmp-up', 'fa-solid fa-angle-up', 'Up'),
      ],
    });
    const css = collapsedRowCss();
    if (opened.length && closed.length) {
      put(group.host.id, { settings: { _cssClasses: 'f2b-cmp-g-{vnx_cmp_group_index} f2b-cmp-start-open' } });
    }
    put(group.host.id, { css });
  } else if (table.groups.some((item, index) => index > 0 && item.rows.length > PREVIEW_ROWS)) {
    put(group.host.id, {
      css: collapsedRowCss(),
      extraChildren: [{
        name: 'block',
        label: 'More',
        settings: {
          _display: 'flex',
          _direction: 'row',
          _justifyContent: 'center',
          _alignItems: 'center',
          _width: '100%',
          _attributes: [{ name: 'data-vnx-cmp-more', value: '1' }],
          _conditions: [[
            { key: 'dynamic_data', dynamic_data: tag('group_rows', null, id), compare: '>', value: String(PREVIEW_ROWS) },
            { key: 'dynamic_data', dynamic_data: tag('group_index', null, id), compare: '!=', value: '1' },
          ]],
        },
        children: [
          { name: 'text-basic', label: 'More', settings: { text: 'Xem thêm', _cssClasses: 'f2b-cmp-more-label', _width: 'auto' } },
          moreArrow('f2b-cmp-down', 'fa-solid fa-angle-down'),
          { name: 'text-basic', label: 'Less', settings: { text: 'Thu gọn', _cssClasses: 'f2b-cmp-less-label', _width: 'auto' } },
          moreArrow('f2b-cmp-up', 'fa-solid fa-angle-up'),
        ],
      }],
    });
  }
  return more;
}

function bindCompareSlider(put, { scope, header }) {
  put(header.host.id, {
    settings: {
      _position: 'sticky',
      _top: '60px',
      '_top:tablet_portrait': '40px',
      _zIndex: 10,
      _background: { color: { hex: '#ffffff' } },
    },
  });
  const sliderRoot = parentOf(scope, header.host.id) ?? scope;
  const sides = flank(sliderRoot, header.host);
  put(sliderRoot.id, {
    settings: { _attributes: [{ name: 'data-vnx-cmp-slider-root', value: '1' }] },
    css: [
      { decl: 'opacity: 0; pointer-events: none;', suffix: ':not(.is-sliding) [data-vnx-cmp-prev]' },
      { decl: 'opacity: 0; pointer-events: none;', suffix: ':not(.is-sliding) [data-vnx-cmp-next]' },
      { decl: 'opacity: .35; pointer-events: none;', suffix: ' [data-vnx-cmp-prev].is-disabled' },
      { decl: 'opacity: .35; pointer-events: none;', suffix: ' [data-vnx-cmp-next].is-disabled' },
    ],
  });
  put(header.host.id, { settings: { ...(rowScrolls(header.host) ? { _overflow: 'auto' } : {}), _attributes: [{ name: 'data-vnx-cmp-slider', value: '1' }] } });
  const navButton = (side) => ({
    name: 'icon',
    label: side === 'prev' ? 'Prev' : 'Next',
    settings: {
      icon: { library: 'fontawesome', icon: side === 'prev' ? 'fa-solid fa-angle-left' : 'fa-solid fa-angle-right' },
      iconSize: '24px',
      iconColor: { hex: '#007cfc' },
      _display: 'none',
      _position: 'absolute',
      _top: '8px',
      _zIndex: 11,
      ...(side === 'prev' ? { _left: '8px' } : { _right: '8px' }),
      _attributes: [{ name: side === 'prev' ? 'data-vnx-cmp-prev' : 'data-vnx-cmp-next', value: '1' }],
    },
  });
  put(header.host.id, { extraChildren: [sides.prev ? null : navButton('prev'), sides.next ? null : navButton('next')].filter(Boolean) });
  if (sides.prev) put(sides.prev.id, { settings: { _attributes: [{ name: 'data-vnx-cmp-prev', value: '1' }] } });
  if (sides.next) put(sides.next.id, { settings: { _attributes: [{ name: 'data-vnx-cmp-next', value: '1' }] } });
}

function bindCompareLabels(put, used, take, { group, feature, dataGroup, more }) {
  for (const textNode of textsIn(group.host)) {
    if (used.has(textNode.id) || group.rows.some((row) => contains(row.node, textNode.id))) continue;
    if (more && contains(more, textNode.id)) continue;
    if (!used.has(textNode.id)) take(textNode, 'group');
  }
  const image = visibleKids(group.host).find((child) => !group.rows.some((row) => row.node.id === child.id || contains(child, row.node.id)) && (child.fills ?? []).some((fill) => fill.type === 'IMAGE'));
  if (image) put(image.id, { settings: { image: { useDynamicData: '{vnx_cmp_group_icon}' } } });
  for (const textNode of feature.lead.flatMap((item) => textsIn(item))) {
    if (dataGroup.rows.some((row) => same(textNode.text.characters, row.desc))) take(textNode, 'row_desc');
    else if (!used.has(textNode.id)) take(textNode, 'row');
  }
}

function bindCompareTips(put, omit, { scope, groups, header, feature, group, id }) {
  const bubble = tipBubble(scope, groups, header.cols);
  if (bubble) omit.push(bubble.node.id);
  const bg = bubble?.fill?.hex || '#007cfc';
  const ink = solidFill(bubble?.text)?.hex || '#ffffff';
  const questions = questionIcons(feature);
  const release = (node) => { if (node) put(node.id, { settings: { _overflow: 'visible' } }); };
  if (questions.length) {
    release(scope);
    release(group.host);
    release(feature.node);
    for (const lead of feature.lead) release(lead);
    for (const icon of questions) {
      let host = parentOf(scope, icon.id);
      while (host) {
        release(host);
        if (host.id === scope.id) break;
        host = parentOf(scope, host.id);
      }
    }
  }
  for (const icon of questions) {
    const wrapped = tipWrap(icon, tag('row_desc', null, id), bg, ink, drawnTipWidth(bubble?.node));
    wrapped.enclose.tail[0].settings._conditions = [[{ key: 'dynamic_data', dynamic_data: tag('row_desc', null, id), compare: 'empty_not' }]];
    put(icon.id, wrapped);
  }
}

function shareStackedCells(put, feature) {
  if (!feature.stacked) return;
  const share = 'calc(100% / var(--vnx-cmp-packages))';
  for (const cell of feature.cells) {
    put(cell.id, {
      settings: { _flexGrow: 1, _flexShrink: 1, _flexBasis: '0px', _width: share, _widthMax: share, _widthMin: '0px' },
    });
    for (const textNode of textsIn(cell)) {
      put(textNode.id, { settings: { _width: '100%', _flexBasis: 'auto', _widthMin: '0px', _typography: { 'white-space': 'normal' } } });
    }
  }
}

function bindCompareLoops(put, { id, group, feature }) {
  put(group.host.id, {
    settings: {
      ...loop('group', id),
      _attributes: [{ name: 'data-vnx-cmp-group', value: '1' }],
      _cssClasses: 'f2b-cmp-g-{vnx_cmp_group_index}',
    },
  });
  put(feature.node.id, { settings: { ...loop('row', id), _cssClasses: 'f2b-cmp-row f2b-cmp-i-{vnx_cmp_row_index}' } });
}

function bindCompare(node, table, id, root, attrs) {
  const scene = compareScene(node, table, id, root);
  if (scene.stop) return scene.stop;
  const { scope, header, groups, drawnMatch, columns, closed, opened, group, dataGroup, feature, drawn } = scene;

  const patches = {};
  const put = (nodeId, patch) => {
    const prev = patches[nodeId] ?? {};
    const settings = { ...(prev.settings ?? {}), ...(patch.settings ?? {}) };
    if (prev.settings?._attributes && patch.settings?._attributes) {
      settings._attributes = [...prev.settings._attributes, ...patch.settings._attributes];
    }
    patches[nodeId] = {
      ...prev,
      ...patch,
      settings,
      css: [...(prev.css ?? []), ...(patch.css ?? [])],
      ...(patch.extraChildren ? { extraChildren: [...(prev.extraChildren ?? []), ...patch.extraChildren] } : {}),
    };
  };
  const omit = [];
  put(scope.id, { css: [{ decl: `--vnx-cmp-packages: ${table.packages.length};`, suffix: '' }] });
  if (!drawnMatch && !rowScrolls(header.host)) {
    put(columns[0].id, { css: [{ decl: 'flex: 0 0 calc(100% / var(--vnx-cmp-packages)); width: calc(100% / var(--vnx-cmp-packages));', suffix: '' }] });
  }
  omitCompareCopies(omit, { header, groups, group, feature, columns, drawnMatch });

  const used = new Set();
  const take = (textNode, name, position = null) => {
    put(textNode.id, { settings: { text: tag(name, position, id) } });
    used.add(textNode.id);
  };
  const colAttr = [{ name: 'data-vnx-cmp-col', value: '1' }];
  columns.forEach((col, index) => {
    put(col.id, { settings: { ...(drawnMatch ? {} : loop('pkg', id)), _attributes: colAttr } });
    fillCompareColumn(put, used, take, { table, id, attrs, column: col, position: drawnMatch ? index + 1 : null });
  });
  const cells = drawnMatch ? feature.cells : [feature.cells[0]];
  cells.forEach((item, index) => {
    put(item.id, { settings: { ...(drawnMatch ? {} : loop('pkg', id)), _attributes: colAttr } });
    fillCompareCell(put, { drawn, id, cell: item, position: drawnMatch ? index + 1 : null });
  });
  shareStackedCells(put, feature);
  bindCompareLoops(put, { id, group, feature });

  const more = bindCompareMore(put, { scope, id, group, opened, closed, table });
  bindCompareSlider(put, { scope, header });
  bindCompareLabels(put, used, take, { group, feature, dataGroup, more });
  bindCompareTips(put, omit, { scope, groups, header, feature, group, id });

  return { patches, omit, warnings: [], column: columns[0] };
}

function bound(node, det, root) {
  if (cache.has(det)) return cache.get(det);
  const value = bindCompare(node, det?.params?.table, det?.params?.id, root ?? node, det?.params?.buttonAttrs);
  cache.set(det, value);
  return value;
}

export default {
  id: PartKind.COMPARE_TABLE,
  status: 'implemented',
  label: 'Comparison table',
  figma: 'a package row plus feature groups whose rows line up one cell per package',
  bricks: 'query loops vnxcmp_pkg, vnxcmp_group and vnxcmp_row. Text is {vnx_cmp_*}. A mark is an Icon. The buy control is an a. A trailing control and a clipped row use the plugin attributes',
  limits: 'A drawn column per package stays, with :p= on each tag. Fewer columns than packages, one column is the loop. A closed group is the group loop. The first group starts open when an open group is also drawn. The same table id is the data on every breakpoint. Without that id the build stops.',
  check(node, det, ctx) {
    if (!det?.params?.table?.packages?.length) return { ok: false, reason: 'comparison table data is not loaded' };
    const found = bound(node, det, ctx?.root ?? node);
    if (found.skip) return { ok: true, warnings: [] };
    if (!found.column) return { ok: false, reason: found.warnings[0] ?? 'no package row and feature rows are drawn here' };
    return { ok: true, warnings: found.warnings };
  },
  descendants(node, det, ctx) {
    return bound(node, det, ctx?.root ?? node).patches;
  },
  mergedNodes(det, node) {
    return bound(node, det).omit;
  },
  pageScript() {
    return `(function(){document.querySelectorAll('[data-vnx-cmp-group].f2b-cmp-start-open.f2b-cmp-g-1').forEach(function(group){group.classList.add('is-open');var btn=group.querySelector('[data-vnx-cmp-more]');if(btn)btn.setAttribute('aria-expanded','true');});document.addEventListener('scroll',function(e){var track=e.target;if(!track||!track.closest||!track.matches||!track.matches('[data-vnx-cmp-slider]'))return;var root=track.closest('[data-vnx-cmp-slider-root]');if(!root)return;root.querySelectorAll('.f2b-cmp-row').forEach(function(row){if(row!==track)row.scrollLeft=track.scrollLeft;});},true);})();`;
  },
};
