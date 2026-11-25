import { PartKind, isKind } from '../modules/recognize-parts/kinds.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { parseWidgetData, PRICE_ID, carryPriceTables } from '../modules/write-bricks/components/price-data.mjs';
import { choiceOf } from '../modules/missing-content/choices.mjs';
import { applyAnswers } from '../modules/missing-content/index.mjs';
import { decide } from '../modules/approve-parts/index.mjs';
import { screenParts } from '../modules/single-template/parts.mjs';
import { REGISTER_BUTTON_FIELDS, missingBoundTables, priceFrames, registerAttrKey, stepPriceCard } from '../modules/write-bricks/components/price-table.mjs';

const box = (x, y, w, h) => ({ x, y, width: w, height: h });
const text = (id, value) => ({
  id, name: id, type: 'TEXT', characters: value,
  absoluteBoundingBox: box(0, 0, 80, 20),
  style: { fontFamily: 'Roboto', fontSize: 14, fontWeight: 500, lineHeightPx: 20 },
  fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 } }],
});
const frame = (id, name, rect, children, extra = {}) => ({
  id, name, type: 'FRAME', absoluteBoundingBox: box(...rect), children, layoutMode: 'VERTICAL', ...extra,
});

function transpose(rows) {
  const width = Math.max(...rows.map((row) => row.length));
  return Array.from({ length: width }, (_, col) => rows.map((row) => row[col] ?? ''));
}

function widgetOf({ id, unit, button, cycles, rows, packages }) {
  const head = ['', 'Notes', ...packages.map((item) => item.name)];
  const blank = head.map(() => '');
  const priceHead = ['Service price | *', 'Regular | Sale | Total | Tag | Promo | Code | Label', ...packages.map(() => '')];
  const cycleRows = cycles.map((cycle, index) => [
    cycle.badge ? `${cycle.label} | ${cycle.badge}` : cycle.label,
    '',
    ...packages.map((item) => {
      const price = item.prices[index];
      return ['', price.sale, price.total, price.tag ?? '', price.promo, price.code, ''].join(' | ');
    }),
  ]);
  const infoHead = ['Specs | *', 'Product | Extra | Icon', ...packages.map(() => '')];
  const infoRows = rows.map((row, index) => {
    const label = typeof row === 'string' ? row : row.label;
    const desc = typeof row === 'string' ? '' : (row.desc ?? '');
    return [label, desc, ...packages.map((item) => {
      const info = item.info[index];
      const text = typeof info === 'string' ? info : info.text;
      const extra = typeof info === 'string' ? '' : (info.extra ?? '');
      const icon = typeof info === 'string' ? 'yes' : (info.icon ?? 'yes');
      return `${text} | ${extra} | ${icon}`;
    })];
  });
  const urlHead = ['Sign-up | *', '', ...packages.map(() => '')];
  const urlRows = cycles.map((cycle, index) => [cycle.label, '', ...packages.map((item) => item.links[index])]);
  return {
    status: true,
    data: transpose([head, blank, priceHead, ...cycleRows, infoHead, ...infoRows, urlHead, ...urlRows]),
    meta: { table_id: id, unit, button, updated_at: 1 },
  };
}

const starter = widgetOf({
  id: 'starter-cloud',
  unit: '/mo',
  button: 'Buy',
  cycles: [
    { label: 'Year', badge: '' },
    { label: 'Two years', badge: '-8%' },
  ],
  rows: ['CPU', 'Disk'],
  packages: [
    { name: 'Basic', prices: [{ sale: '10', total: '120', promo: 'Save more', code: 'CODE1' }, { sale: '9', total: '216', promo: 'Save more', code: 'CODE1' }], info: ['4 cores', '20 GB'], links: ['https://example.com/basic-year', 'https://example.com/basic-two'] },
    { name: 'Plus', prices: [{ sale: '20', total: '240', promo: 'Save more', code: 'CODE2' }, { sale: '16', total: '384', promo: 'Save more', code: 'CODE2' }], info: ['8 cores', '40 GB'], links: ['https://example.com/plus-year', 'https://example.com/plus-two'] },
  ],
});

function treeOf() {
  const pill = (id, label) => frame(id, 'pill', [0, 0, 80, 32], [text(`${id}t`, label)]);
  const line = (id, value) => frame(id, 'line', [0, 0, 160, 24], [text(`${id}t`, value)]);
  const card = (id, name, price, cores, disk) => frame(id, 'card', [0, 0, 180, 220], [
    frame(`${id}n`, 'name', [0, 0, 160, 24], [text(`${id}nt`, name)]),
    frame(`${id}p`, 'price', [0, 28, 160, 24], [text(`${id}pt`, price)]),
    frame(`${id}u`, 'unit', [0, 52, 160, 20], [text(`${id}ut`, '/mo')]),
    frame(`${id}m`, 'promo', [0, 76, 160, 20], [text(`${id}mt`, 'Save more')]),
    frame(`${id}c`, 'code', [0, 100, 160, 20], [text(`${id}ct`, id === 'c1' ? 'CODE1' : 'CODE2')]),
    line(`${id}r1`, cores),
    line(`${id}r2`, disk),
    frame(`${id}b`, 'buy', [0, 180, 120, 36], [text(`${id}bt`, 'Buy')]),
  ]);
  return normalizeRoot({ nodes: { r: { document: frame('r', 'Pricing', [0, 0, 640, 320], [
    frame('bar', 'cycles', [0, 0, 200, 32], [pill('y1', 'Year'), pill('y2', 'Two years')], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 48, 400, 240], [card('c1', 'Basic', '10', '4 cores', '20 GB'), card('c2', 'Plus', '20', '8 cores', '40 GB')], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
}

test('widget data with three star marks becomes cycles, packages and rows', () => {
  const parsed = parseWidgetData(starter);
  assert.equal(parsed.error, undefined);
  assert.deepEqual(parsed.table.cycles.map((cycle) => cycle.label), ['Year', 'Two years']);
  assert.equal(parsed.table.cycles[1].badge, '-8%');
  assert.deepEqual(parsed.table.packages.map((item) => item.name), ['Basic', 'Plus']);
  assert.equal(parsed.table.packages[0].prices[0].sale, '10');
  assert.equal(parsed.table.packages[0].prices[1].sale, '9');
  assert.equal(parsed.table.packages[0].info[0].text, '4 cores');
  assert.equal(parsed.table.packages[1].links[1], 'https://example.com/plus-two');
  assert.equal(parsed.table.meta.unit, '/mo');
  assert.equal(parseWidgetData(null).error, 'missing-table');
  assert.equal(parseWidgetData({ status: true, data: [['no star']] }).error, 'missing-marks');
  assert.equal(PRICE_ID.test('Bang Gia'), false);
});

test('a bound table renders one pill, one card and one info row as query loops', () => {
  const parsed = parseWidgetData(starter);
  const tree = treeOf();
  const built = buildTemplate(tree, {
    detections: { components: [
      { id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'starter-cloud', table: parsed.table } },
      { id: 'buy', status: 'approved', source: 'rule', component: PartKind.BUTTON, node: 'c1b', params: {} },
    ] },
    salt: 'price',
  });
  const content = built.template.content;
  const el = (id) => content.find((item) => item.id === built.mapping[id]?.bricksId);
  assert.equal(el('r').name, 'tabs-nested');
  assert.equal(el('r').settings.openTab, '0');
  assert.equal(built.mapping.c2?.skipped?.startsWith('merged into'), true);
  assert.equal(built.mapping.y2?.skipped?.startsWith('merged into'), true);
  assert.equal(built.mapping.c1r2?.skipped?.startsWith('merged into'), true);
  const types = content.filter((item) => item.settings?.hasLoop).map((item) => item.settings.query.objectType).sort();
  assert.deepEqual(types, [
    'vnxsp_cycle__starter-cloud',
    'vnxsp_cycle__starter-cloud',
    'vnxsp_pkg__starter-cloud',
    'vnxsp_row__starter-cloud',
  ]);
  assert.equal(el('c1nt').settings.text, '{vnx_sp_name}');
  assert.equal(el('c1pt').settings.text, '{vnx_sp_sale}');
  assert.equal(el('c1ut').settings.text, '{vnx_sp_unit}');
  assert.equal(el('c1mt').settings.text, '{vnx_sp_promo_text}');
  assert.equal(el('c1ct').settings.text, '{vnx_sp_code}');
  assert.equal(el('c1ct').settings._attributes[0].name, 'data-vnx-sp-copy');
  assert.equal(el('c1r1t').settings.text, '{vnx_sp_info}');
  assert.equal(el('y1t').settings.text, '{vnx_sp_cycle}');
  assert.equal(content.find((item) => item.id === built.mapping['deck#open']?.bricksId).settings._direction, 'row');
  assert.equal(el('c1b').settings.text, '{vnx_sp_button}');
  assert.equal(el('c1b').settings.tag, 'a');
  assert.deepEqual(el('c1b').settings.link, { type: 'external', url: '{vnx_sp_link}', rel: 'nofollow' });
  assert.equal(el('c1b').settings._cssClasses, 'vnx-button vnx-btn-conversion vnx-button-register');
  assert.deepEqual(el('c1b').settings._attributes, [
    { name: 'data-price', value: '{vnx_sp_sale:raw}' },
    { name: 'data-period', value: '{vnx_sp_cycle}' },
    { name: 'data-product-name', value: '{vnx_sp_name}' },
  ]);
  assert.equal(JSON.stringify(content).includes('Plus'), false);
  assert.equal(JSON.stringify(content).includes('>10<'), false);
});

test('a cycle word inside the only card stays in that card, and the pill row is the tab menu', () => {
  const parsed = parseWidgetData(widgetOf({
    id: 'orbit-desk',
    unit: '/nam',
    button: 'Order',
    cycles: [{ label: 'Quarter', badge: '' }, { label: 'Half', badge: '-5%' }],
    rows: ['Disk'],
    packages: [
      { name: 'Alpha', prices: [{ sale: '40 đ', total: '160', promo: 'Code', code: 'AA' }, { sale: '30 đ', total: '180', promo: 'Code', code: 'AA' }], info: ['Fast'], links: ['https://example.com/a', 'https://example.com/b'] },
    ],
  }));
  const pill = (id, label) => frame(id, 'pill', [0, 0, 80, 32], [text(`${id}t`, label)]);
  const card = frame('card', 'card', [0, 0, 180, 200], [
    text('name', 'Desk'),
    frame('price', 'price', [0, 28, 160, 40], [text('amount', '40 đ'), text('unit', '/nam')]),
    text('note', 'Quarter'),
    frame('line', 'line', [0, 80, 160, 20], [text('info', 'Fast')]),
    frame('buy', 'buy', [0, 120, 80, 28], [text('buyt', 'Order')]),
  ]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 400, 280], [
    frame('bar', 'cycles', [0, 0, 200, 32], [pill('q1', 'Quarter'), pill('q2', 'Half')], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 48, 200, 200], [card, frame('nav', 'arrows', [0, 0, 40, 40], [text('navt', 'Next')])], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'orbit-desk', table: parsed.table } }] },
    salt: 'orbit',
  });
  const el = (id) => built.template.content.find((item) => item.id === built.mapping[id]?.bricksId);
  assert.equal(built.mapping.deck?.skipped, undefined);
  assert.equal(built.mapping.card?.skipped, undefined);
  assert.equal(built.mapping.name?.skipped, undefined);
  assert.equal(built.mapping.buy?.skipped, undefined);
  assert.equal(built.mapping.q2?.skipped?.startsWith('merged into'), true);
  assert.equal(el('q1').settings.hasLoop, true);
  assert.equal(el('q1').settings.query.objectType, 'vnxsp_cycle__orbit-desk');
  assert.equal(el('q1').settings._hidden._cssClasses, 'tab-title');
  assert.equal(el('bar').settings.hasLoop, undefined);
  assert.equal(el('bar').settings._hidden._cssClasses, 'tab-menu');
  assert.equal(el('r').settings.hasLoop, undefined);
  assert.equal(built.mapping.name?.skipped, undefined);
  assert.equal(built.mapping.buy?.skipped, undefined);
  assert.equal(built.mapping.note?.skipped, undefined);
  assert.equal(el('nav').settings.hasLoop, undefined);
  assert.equal(el('nav').settings._attributes[0].name, 'data-vnx-sp-next');
});

test('controls beside one card step that card, and a wrapped pill row stays wrapped', () => {
  const parsed = parseWidgetData(widgetOf({
    id: 'birch-plan',
    unit: '/wk',
    button: 'Join',
    cycles: [{ label: 'Spring', badge: '' }, { label: 'Autumn', badge: '' }],
    rows: ['Soil'],
    packages: [
      { name: 'Birch', prices: [{ sale: '4', total: '16', promo: 'Note', code: 'BB' }, { sale: '3', total: '18', promo: 'Note', code: 'BB' }], info: ['Deep'], links: ['https://example.com/a', 'https://example.com/b'] },
    ],
  }));
  const pill = (id, label) => frame(id, 'pill', [0, 0, 80, 32], [text(`${id}t`, label)]);
  const card = frame('card', 'card', [40, 0, 180, 160], [
    text('name', 'Birch'),
    text('amount', '4'),
    text('unit', '/wk'),
    frame('buy', 'buy', [0, 80, 80, 28], [text('buyt', 'Join')]),
  ]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 360, 240], [
    frame('bar', 'cycles', [0, 0, 180, 72], [pill('s1', 'Spring'), pill('s2', 'Autumn')], { layoutMode: 'HORIZONTAL', layoutWrap: 'WRAP' }),
    frame('deck', 'cards', [0, 80, 260, 160], [
      frame('back', 'back', [0, 60, 32, 32], [text('backt', 'Back')]),
      card,
      frame('onward', 'onward', [228, 60, 32, 32], [text('onwardt', 'Onward')]),
    ], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'birch-plan', table: parsed.table } }] },
    salt: 'birch',
  });
  const el = (id) => built.template.content.find((item) => item.id === built.mapping[id]?.bricksId);
  assert.equal(el('bar').settings._flexWrap, 'wrap');
  assert.equal(el('back').settings._attributes[0].name, 'data-vnx-sp-prev');
  assert.equal(el('onward').settings._attributes[0].name, 'data-vnx-sp-next');
  assert.equal(el('card').settings._attributes[0].name, 'data-vnx-sp-card');
  const cards = [{ offsetLeft: 0 }, { offsetLeft: 180 }, { offsetLeft: 360 }];
  const pane = {
    scrollLeft: 180,
    querySelectorAll: () => cards,
    scrollTo({ left }) { this.scrollLeft = left; },
  };
  const root = { querySelector: () => pane };
  stepPriceCard({ closest: () => root }, 1);
  assert.equal(pane.scrollLeft, 360);
  stepPriceCard({ closest: () => root }, -1);
  assert.equal(pane.scrollLeft, 180);
});

test('another table with different words uses the same tags', () => {
  const parsed = parseWidgetData(widgetOf({
    id: 'studio-plan',
    unit: '/wk',
    button: 'Order',
    cycles: [{ label: 'Month', badge: '' }, { label: 'Season', badge: '-5%' }],
    rows: ['Disk'],
    packages: [
      { name: 'Starter', prices: [{ sale: '3', total: '12', promo: 'Code', code: 'AA' }, { sale: '2', total: '24', promo: 'Code', code: 'AA' }], info: ['Fast'], links: ['https://example.com/a', 'https://example.com/b'] },
      { name: 'Growth', prices: [{ sale: '6', total: '24', promo: 'Code', code: 'BB' }, { sale: '5', total: '60', promo: 'Code', code: 'BB' }], info: ['Faster'], links: ['https://example.com/c', 'https://example.com/d'] },
    ],
  }));
  const pill = (id, label) => frame(id, 'pill', [0, 0, 80, 32], [text(`${id}t`, label)]);
  const card = (id, name, price, info, code) => frame(id, 'card', [0, 0, 160, 120], [
    text(`${id}n`, name),
    text(`${id}p`, price),
    text(`${id}u`, '/wk'),
    text(`${id}c`, code),
    frame(`${id}r`, 'line', [0, 0, 120, 20], [text(`${id}rt`, info)]),
    frame(`${id}b`, 'buy', [0, 0, 80, 28], [text(`${id}bt`, 'Order')]),
  ]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 400, 200], [
    frame('bar', 'cycles', [0, 0, 200, 32], [pill('m1', 'Month'), pill('m2', 'Season')], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 40, 360, 140], [card('a', 'Starter', '3', 'Fast', 'AA'), card('b', 'Growth', '6', 'Faster', 'BB')], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'studio-plan', table: parsed.table } }] },
    salt: 'studio',
  });
  const textOf = (id) => built.template.content.find((item) => item.id === built.mapping[id].bricksId).settings.text;
  assert.equal(textOf('an'), '{vnx_sp_name}');
  assert.equal(textOf('ap'), '{vnx_sp_sale}');
  assert.equal(textOf('art'), '{vnx_sp_info}');
  assert.equal(textOf('m1t'), '{vnx_sp_cycle}');
  const order = built.template.content.find((item) => item.id === built.mapping.ab.bricksId).settings;
  assert.equal(order.tag, 'a');
  assert.deepEqual(order.link, { type: 'external', url: '{vnx_sp_link}', rel: 'nofollow' });
  assert.equal(order._cssClasses, 'vnx-button vnx-btn-conversion vnx-button-register');
  assert.deepEqual(order._attributes.map((item) => item.name), ['data-price', 'data-period', 'data-product-name']);
  assert.equal(built.mapping.b.skipped.startsWith('merged into'), true);
});

test('the plan id is an enum, and a blank line does not invent one', () => {
  assert.deepEqual(choiceOf('price', 'starter-cloud'), { choice: 'id', id: 'starter-cloud' });
  assert.equal(choiceOf('price', 'Bang Gia'), null);
  assert.deepEqual(choiceOf('price', { choice: 'id', id: 'Not_An_Id' }), null);
  assert.deepEqual(choiceOf('price', ''), { choice: 'unset' });
  const tree = treeOf();
  const files = {
    'tree.json': tree,
    'detections.json': { components: [] },
    'overrides.json': { nodes: {} },
  };
  const ws = { readJson: (name, fallback) => files[name] ?? fallback, writeJson: (name, value) => { files[name] = value; } };
  const applied = applyAnswers(ws, { 'price:r': 'starter-cloud' });
  assert.equal(applied.unused.length, 0);
  assert.equal(files['detections.json'].components[0].params.id, 'starter-cloud');
  const plain = buildTemplate(tree, { detections: { components: [] }, salt: 'plain' });
  assert.equal(JSON.stringify(plain.template.content).includes('vnx_sp_'), false);
  assert.equal(JSON.stringify(plain.template.content).includes('vnxsp_'), false);
});

test('one package row is the price table, and it needs a loaded id', () => {
  const spec = (id, label) => frame(id, 'spec', [0, 0, 140, 24], [text(`${id}t`, label)]);
  const card = (id, name, amount) => frame(id, 'card', [0, 0, 160, 140], [
    text(`${id}n`, name),
    text(`${id}p`, amount),
    text(`${id}u`, '/năm'),
    spec(`${id}s`, 'Seats'),
  ]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Rates', [0, 0, 400, 180], [
    frame('deck', 'row', [0, 0, 400, 160], [card('a', 'Lane', '4.000 đ'), card('b', 'Pier', '9.000 đ')], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  assert.deepEqual(priceFrames(tree).map((item) => item.id), ['deck']);
  assert.deepEqual(missingBoundTables(tree, { components: [] }).map((gap) => gap.node), ['deck']);
  const loaded = { components: [{ component: PartKind.PRICE_TABLE, status: 'approved', node: 'deck', params: { id: 'lane-pier', table: { packages: [{ name: 'Lane' }] } } }] };
  assert.deepEqual(missingBoundTables(tree, loaded), []);
});

test('a card title that is not the stored package name is still the name slot', () => {
  const placed = (id, value, y) => ({ ...text(id, value), absoluteBoundingBox: box(0, y, 80, 20) });
  const card = (id, title, amount) => frame(id, 'card', [0, 0, 160, 120], [
    placed(`${id}n`, title, 8),
    placed(`${id}p`, amount, 40),
    placed(`${id}u`, '/năm', 64),
  ]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Rates', [0, 0, 400, 140], [
    frame('deck', 'row', [0, 0, 400, 120], [card('a', 'Lane desk', '4000'), card('b', 'Pier desk', '9000')], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const table = {
    meta: { unit: '/yr', button: 'Join' },
    cycles: [{ label: 'Season', badge: '' }],
    rows: [{ label: 'Seats', desc: '' }],
    packages: [
      { name: 'Lane', prices: [{ regular: '', sale: '4', total: '4', tag: '', promoText: '', code: '', special: '' }], links: [''], info: [{ text: 'Four', extra: '', icon: '' }] },
      { name: 'Pier', prices: [{ regular: '', sale: '9', total: '9', tag: '', promoText: '', code: '', special: '' }], links: [''], info: [{ text: 'Nine', extra: '', icon: '' }] },
    ],
  };
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'deck', params: { id: 'lane-pier', table } }] },
    salt: 'lane',
  });
  const textOf = (id) => built.template.content.find((item) => item.id === built.mapping[id].bricksId).settings.text;
  assert.equal(textOf('an'), '{vnx_sp_name}');
  assert.equal(textOf('au'), '{vnx_sp_unit}');
  assert.equal(built.template.content.some((item) => item.settings?.query?.objectType === 'vnxsp_pkg__lane-pier'), true);
});

test('a cycle pill whose words are not in the table is still that one cycle source', () => {
  const pill = (id, label, badge) => frame(id, 'pill', [0, 0, 90, 32], [text(`${id}l`, label), text(`${id}b`, badge)], { layoutMode: 'HORIZONTAL' });
  const card = (id, title) => frame(id, 'card', [0, 0, 160, 80], [text(`${id}n`, title), text(`${id}p`, '4000'), text(`${id}u`, '/năm')]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Rates', [0, 0, 400, 160], [
    frame('bar', 'cycles', [0, 0, 280, 36], [pill('s', 'Spring', '-5%'), pill('e', 'Season', '-10%')], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'row', [0, 40, 400, 100], [card('a', 'Lane desk'), card('b', 'Pier desk')], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const table = {
    meta: { unit: '/yr', button: 'Join' },
    cycles: [{ label: 'Season', badge: '-10%' }, { label: 'Winter', badge: '' }],
    rows: [],
    packages: [
      { name: 'Lane', prices: [{ sale: '4', regular: '', total: '', tag: '', promoText: '', code: '', special: '' }], links: [''], info: [] },
      { name: 'Pier', prices: [{ sale: '9', regular: '', total: '', tag: '', promoText: '', code: '', special: '' }], links: [''], info: [] },
    ],
  };
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'lane-pier', table } }] },
    salt: 'cycles',
  });
  const texts = built.template.content.map((item) => item.settings?.text).filter((value) => typeof value === 'string');
  assert.equal(texts.includes('Spring'), false);
  assert.equal(texts.includes('-5%'), false);
  assert.equal(texts.includes('{vnx_sp_cycle}'), true);
  assert.equal(built.template.content.some((item) => item.settings?.query?.objectType === 'vnxsp_cycle__lane-pier'), true);
});

test('a card keeps tags when the drawn words differ by case from the table', () => {
  const parsed = parseWidgetData(starter);
  const pill = (id, label, badge) => frame(id, 'pill', [0, 0, 90, 32], [text(`${id}t`, label), ...(badge ? [text(`${id}b`, badge)] : [])]);
  const card = (id, name) => frame(id, 'card', [0, 0, 180, 160], [
    text(`${id}n`, name),
    text(`${id}p`, '10'),
    text(`${id}u`, '/mo'),
    frame(`${id}promo`, 'promo', [0, 0, 160, 28], [text(`${id}pt`, 'Type this code:'), text(`${id}pc`, 'SAVE')]),
    frame(`${id}buy`, 'buy', [0, 0, 100, 32], [text(`${id}bt`, 'Buy')]),
  ]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 500, 220], [
    frame('bar', 'cycles', [0, 0, 280, 32], [pill('y1', 'year', ''), pill('y2', 'two years', '-8%')], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 40, 400, 160], [card('a', 'basic'), card('b', 'plus')], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'ap', params: { id: 'starter-cloud', table: parsed.table } }] },
    salt: 'case',
  });
  const textOf = (id) => built.template.content.find((item) => item.id === built.mapping[id]?.bricksId)?.settings.text;
  assert.equal(textOf('an'), '{vnx_sp_name}');
  assert.equal(textOf('ap'), '{vnx_sp_sale}');
  assert.equal(textOf('au'), '{vnx_sp_unit}');
  assert.equal(textOf('apt'), '{vnx_sp_promo_text}');
  assert.equal(textOf('apc'), '{vnx_sp_code}');
  // The loop copies the fullest resting pill: the one with a badge beside its label.
  assert.equal(textOf('y2t'), '{vnx_sp_cycle}');
  assert.equal(textOf('y2b'), '{vnx_sp_cycle_badge}');
  assert.equal(built.mapping.b.skipped.startsWith('merged into'), true);
});

test('a vertical card row stays a column, and the loop copies the resting pill', () => {
  const parsed = parseWidgetData(starter);
  const mark = { id: 'mark', name: 'mark', type: 'FRAME', layoutPositioning: 'ABSOLUTE', absoluteBoundingBox: { x: 20, y: -16, width: 40, height: 14 }, children: [] };
  const pill = (id, label, extras = []) => frame(id, 'pill', [0, 0, 90, 32], [text(`${id}t`, label), ...extras], { fills: id === 'hot' ? [{ type: 'SOLID', color: { r: 0, g: 0.15, b: 0.32, a: 1 } }] : [] });
  const card = (id, name) => frame(id, 'card', [0, 0, 120, 80], [text(`${id}n`, name), text(`${id}p`, '10')]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 300, 240], [
    frame('bar', 'cycles', [0, 0, 200, 32], [pill('hot', 'Year', [mark]), pill('rest', 'Two years')], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 48, 140, 180], [card('a', 'Basic'), card('b', 'Plus')], { layoutMode: 'VERTICAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'starter-cloud', table: parsed.table } }] },
    salt: 'rest',
  });
  const content = built.template.content;
  const el = (id) => content.find((item) => item.id === built.mapping[id]?.bricksId);
  assert.equal(el('rest').settings.query.objectType, 'vnxsp_cycle__starter-cloud');
  assert.equal(built.mapping.hot.skipped.startsWith('merged into'), true);
  assert.equal(content.find((item) => item.id === built.mapping['deck#open']?.bricksId).settings._direction, 'column');
  assert.match(el('bar').settings._cssCustom, /brx-open/);
});

test('the open cycle pill keeps a gradient and the resting pill is the loop', () => {
  const parsed = parseWidgetData(widgetOf({
    id: 'cabin-loft',
    unit: '/wk',
    button: 'Book',
    cycles: [{ label: 'Season', badge: '' }, { label: 'Winter', badge: '' }],
    rows: ['Berth'],
    packages: [
      { name: 'Cabin', prices: [{ sale: '40', total: '40', promo: '', code: '' }, { sale: '30', total: '30', promo: '', code: '' }], info: ['one berth'], links: ['https://example.com/c', 'https://example.com/c2'] },
      { name: 'Loft', prices: [{ sale: '70', total: '70', promo: '', code: '' }, { sale: '55', total: '55', promo: '', code: '' }], info: ['two berths'], links: ['https://example.com/l', 'https://example.com/l2'] },
    ],
  }));
  const gradient = {
    type: 'GRADIENT_LINEAR',
    gradientHandlePositions: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0, y: 1 }],
    gradientStops: [
      { position: 0, color: { r: 0.067, g: 0.133, b: 0.2, a: 1 } },
      { position: 1, color: { r: 0.8, g: 0.267, b: 0.067, a: 1 } },
    ],
  };
  const pill = (id, label, state, fills) => ({
    id, name: 'pill', type: 'INSTANCE', componentId: 'pill-comp',
    componentProperties: { 'State#9:1': { type: 'VARIANT', value: state } },
    absoluteBoundingBox: box(0, 0, 90, 32),
    layoutMode: 'HORIZONTAL',
    children: [text(`${id}t`, label)],
    ...(fills ? { fills } : {}),
  });
  const card = (id, name) => frame(id, 'card', [0, 0, 160, 80], [text(`${id}n`, name), text(`${id}p`, '40'), text(`${id}u`, '/wk')]);
  const tree = normalizeRoot({ nodes: { r: {
    components: { 'pill-comp': { name: 'State=Default', componentSetId: 'pill-set' } },
    componentSets: { 'pill-set': { name: 'Cycle pill' } },
    document: frame('r', 'Plans', [0, 0, 400, 200], [
      frame('bar', 'cycles', [0, 0, 280, 32], [
        pill('hot', 'Season', 'Hover', [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 0.12 } }]),
        pill('on', 'Season', 'Active', [gradient]),
        pill('off', 'Winter', 'Default'),
      ], { layoutMode: 'HORIZONTAL' }),
      frame('deck', 'cards', [0, 48, 360, 80], [card('a', 'Cabin'), card('b', 'Loft')], { layoutMode: 'HORIZONTAL' }),
    ]),
  } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'cabin-loft', table: parsed.table } }] },
    salt: 'season',
  });
  const content = built.template.content;
  const el = (id) => content.find((item) => item.id === built.mapping[id]?.bricksId);
  assert.equal(el('off').settings.query.objectType, 'vnxsp_cycle__cabin-loft');
  assert.equal(built.mapping.on.skipped.startsWith('merged into'), true);
  assert.equal(built.mapping.hot.skipped.startsWith('merged into'), true);
  assert.equal(el('off').settings._gradient, undefined);
  assert.match(el('bar').settings._cssCustom, /\.tab-title\.brx-open \{ background-image: linear-gradient/);
  assert.equal(el('r').settings.openTab, '0');
});

test('one painted pill among plain pills is the open tab, with no variant and no badge', () => {
  const parsed = parseWidgetData(widgetOf({
    id: 'dawn-dusk',
    unit: '/wk',
    button: 'Book',
    cycles: [{ label: 'Dawn', badge: '' }, { label: 'Noon', badge: '' }, { label: 'Dusk', badge: '' }],
    rows: ['Berth'],
    packages: [
      { name: 'Cabin', prices: [{ sale: '40', total: '40', promo: '', code: '' }, { sale: '30', total: '30', promo: '', code: '' }, { sale: '20', total: '20', promo: '', code: '' }], info: ['one berth'], links: ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'] },
      { name: 'Loft', prices: [{ sale: '70', total: '70', promo: '', code: '' }, { sale: '55', total: '55', promo: '', code: '' }, { sale: '40', total: '40', promo: '', code: '' }], info: ['two berths'], links: ['https://example.com/d', 'https://example.com/e', 'https://example.com/f'] },
    ],
  }));
  const pill = (id, label, fills) => frame(id, 'pill', [0, 0, 90, 32], [text(`${id}t`, label)], fills ? { fills } : {});
  const card = (id, name) => frame(id, 'card', [0, 0, 160, 80], [text(`${id}n`, name), text(`${id}p`, '40'), text(`${id}u`, '/wk')]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 400, 200], [
    frame('bar', 'cycles', [0, 0, 300, 32], [
      pill('early', 'Dawn'),
      pill('mid', 'Noon', [{ type: 'SOLID', color: { r: 0.1, g: 0.45, b: 0.3, a: 1 } }]),
      pill('late', 'Dusk'),
    ], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 48, 360, 80], [card('a', 'Cabin'), card('b', 'Loft')], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'dawn-dusk', table: parsed.table } }] },
    salt: 'dawn',
  });
  const content = built.template.content;
  const el = (id) => content.find((item) => item.id === built.mapping[id]?.bricksId);
  assert.equal(el('early').settings.query.objectType, 'vnxsp_cycle__dawn-dusk');
  assert.equal(built.mapping.mid.skipped.startsWith('merged into'), true);
  assert.equal(built.mapping.late.skipped.startsWith('merged into'), true);
  assert.match(el('bar').settings._cssCustom, /\.tab-title\.brx-open \{ background-color: #1a734d/);
  // The tool's script opens the popular cycle from the first tab, so the tabs start on the first tab.
  assert.equal(el('r').settings.openTab, '0');
  assert.equal(JSON.stringify(el('early').settings._attributes ?? []).includes('{vnx_sp_cycle_popular}'), true);
});

test('a mark beside one card stays out of the loop', () => {
  const parsed = parseWidgetData(starter);
  const body = (id, name) => frame(id, 'plan', [0, 24, 120, 80], [
    text(`${id}n`, name), text(`${id}p`, '10'), text(`${id}u`, '/mo'), text(`${id}f`, 'Disk'),
  ]);
  const ribbon = frame('ribbon', 'ribbon', [20, 0, 48, 16], []);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 300, 160], [
    frame('bar', 'cycles', [0, 0, 200, 32], [frame('y1', 'pill', [0, 0, 80, 32], [text('y1t', 'Year')]), frame('y2', 'pill', [88, 0, 80, 32], [text('y2t', 'Two years')])], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 40, 280, 110], [body('plain', 'Basic'), frame('wrap', 'plan', [140, 0, 120, 110], [ribbon, body('inner', 'Plus')])], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'starter-cloud', table: parsed.table } }] },
    salt: 'ribbon',
  });
  const content = built.template.content;
  const el = (id) => content.find((item) => item.id === built.mapping[id]?.bricksId);
  const dumped = JSON.stringify(content);
  assert.equal(el('plain').settings.query.objectType, 'vnxsp_pkg__starter-cloud');
  assert.equal(dumped.includes('vnx_sp_popular'), false);
  assert.equal(dumped.includes('f2b-popular'), false);
  assert.equal(built.mapping.wrap.skipped.startsWith('merged into'), true);
});

test('a closed cycle field becomes a dropdown and a clipped card row scrolls', () => {
  const parsed = parseWidgetData(starter);
  const card = (id, name) => frame(id, 'plan', [0, 0, 140, 80], [text(`${id}n`, name), text(`${id}p`, '10'), text(`${id}u`, '/mo')]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 320, 220], [
    frame('shell', 'shell', [16, 8, 200, 40], [
      frame('field', 'field', [0, 0, 200, 40], [text('ft', 'Year'), frame('icon', 'icon', [170, 8, 16, 16], [])], { layoutMode: 'HORIZONTAL' }),
    ], { layoutMode: 'VERTICAL' }),
    frame('deck', 'cards', [0, 60, 400, 120], [card('a', 'Basic'), card('b', 'Plus')], { layoutMode: 'HORIZONTAL', clipsContent: true }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'starter-cloud', table: parsed.table } }] },
    salt: 'drop',
  });
  const content = built.template.content;
  const el = (id) => content.find((item) => item.id === built.mapping[id]?.bricksId);
  const title = content.find((item) => item.settings?._hidden?._cssClasses === 'tab-title' && item.settings?.query);
  const pane = content.find((item) => item.id === built.mapping['deck#open']?.bricksId);
  assert.equal(el('shell').settings._hidden._cssClasses, 'f2b-select');
  assert.equal(el('shell').settings._overflow, 'visible');
  const values = content.find((item) => item.settings?._hidden?._cssClasses === 'f2b-select-values');
  assert.equal(values.settings._position, 'absolute');
  assert.equal(values.settings._top, '100%');
  assert.equal(el('field').parent, values.id);
  const trigger = content.find((item) => item.settings?._hidden?._cssClasses === 'f2b-select-trigger');
  assert.equal(trigger.parent, el('shell').id);
  assert.equal(content.find((item) => item.settings?._hidden?._cssClasses === 'f2b-select-value').parent, trigger.id);
  assert.match(el('shell').settings._cssCustom, /:not\(\.is-open\) \.f2b-select-values/);
  assert.match(el('shell').settings._cssCustom, /\.tab-title \{[^}]*border: none/);
  assert.match(el('shell').settings._cssCustom, /\.tab-title > \.brxe-text-basic:first-child/);
  assert.equal(el('field').settings._border, undefined);
  assert.equal(el('field').settings._justifyContent, 'flex-start');
  assert.equal(el('field').settings._width, '100%');
  assert.equal(el('ft').settings.text, '{vnx_sp_cycle}');
  assert.equal(el('ft').settings._cssCustom, undefined);
  assert.equal(title.settings.query.objectType, 'vnxsp_cycle__starter-cloud');
  const badge = content.find((item) => item.settings?.text === '{vnx_sp_cycle_badge}');
  assert.equal(badge.settings._conditions[0][0].compare, 'empty_not');
  assert.match(el('deck').settings._cssCustom, /overflow-x: auto/);
  assert.equal(pane.settings._direction, 'row');
  assert.match(pane.settings._cssCustom, /max-content/);
  assert.equal(el('a').settings.query.objectType, 'vnxsp_pkg__starter-cloud');
});

test('a bound table is the same table on another frame', () => {
  const table = { packages: [{ name: 'Basic' }], cycles: [{ label: 'Year' }] };
  const carried = carryPriceTables(
    { components: [
      { id: 'desk', component: PartKind.PRICE_TABLE, status: 'approved', node: 'desk-box', params: { id: 'starter-cloud', table } },
      { id: 'desk-2', component: PartKind.PRICE_TABLE, status: 'approved', node: 'desk-other', params: { id: 'starter-cloud', table } },
    ] },
    { components: [
      { id: 'local', component: PartKind.PRICE_TABLE, status: 'approved', node: 'phone-box', params: { id: 'other-table' } },
      { id: 'keep', component: PartKind.BUTTON, status: 'approved', node: 'phone-btn', params: {} },
    ] },
    new Map([['phone-box', 'desk-box']]),
    'phone',
  );
  assert.equal(carried.components.find((item) => isKind(item, PartKind.BUTTON)).id, 'keep');
  const prices = carried.components.filter((item) => isKind(item, PartKind.PRICE_TABLE));
  assert.equal(prices.length, 1);
  const price = prices[0];
  assert.equal(price.node, 'phone-box');
  assert.equal(price.params.id, 'starter-cloud');
  assert.equal(price.params.table, table);
});

test('two price nodes that share a prefix get different detection ids', () => {
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Rates', [0, 0, 400, 120], [
    frame('aa:11111111', 'one', [0, 0, 160, 80], [text('t1', 'One')]),
    frame('aa:11111112', 'two', [180, 0, 160, 80], [text('t2', 'Two')]),
  ], { layoutMode: 'HORIZONTAL' }) } } }, 'r', { images: {}, svgs: {} });
  const files = {
    'tree.json': tree,
    'detections.json': { components: [] },
    'overrides.json': { nodes: {} },
  };
  const ws = { readJson: (name, fallback) => files[name] ?? fallback, writeJson: (name, value) => { files[name] = value; } };
  applyAnswers(ws, {
    'price:aa:11111111': { choice: 'id', id: 'alpha-plan' },
    'price:aa:11111112': { choice: 'id', id: 'alpha-plan' },
  });
  const ids = files['detections.json'].components.map((item) => item.id);
  assert.equal(ids.length, 2);
  assert.notEqual(ids[0], ids[1]);
});

test('a drawn amount that is not in the table still becomes the sale tag', () => {
  const parsed = parseWidgetData(starter);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 240, 160], [
    frame('y1', 'pill', [0, 0, 80, 32], [text('y1t', 'Year')]),
    frame('card', 'plan', [0, 40, 180, 80], [
      text('name', 'Basic'),
      text('sample', '1.500'),
      text('unit', '/mo'),
    ]),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'starter-cloud', table: parsed.table } }] },
    salt: 'sample',
  });
  const sample = built.template.content.find((item) => item.id === built.mapping.sample?.bricksId);
  assert.equal(sample.settings.text, '{vnx_sp_sale}');
});

test('an info line binds the row name, the value, the extra, the discount and the mark', () => {
  const parsed = parseWidgetData(widgetOf({
    id: 'seat-plan',
    unit: '/wk',
    button: 'Join',
    cycles: [{ label: 'Month', badge: '' }],
    rows: [{ label: 'Seats', desc: 'People who can sign in' }],
    packages: [
      { name: 'Solo', prices: [{ sale: '3', total: '12', tag: '-12%', promo: '', code: '' }], info: [{ text: '3 people', extra: '+1', icon: 'yes' }], links: ['https://example.com/solo'] },
      { name: 'Crew', prices: [{ sale: '6', total: '24', tag: '-12%', promo: '', code: '' }], info: [{ text: '10 people', extra: '+2', icon: 'no' }], links: ['https://example.com/crew'] },
    ],
  }));
  const line = frame('line', 'line', [0, 0, 180, 24], [
    frame('mark', 'mark', [0, 0, 16, 16], []),
    text('label', 'Seats'),
    text('value', '3 people'),
    text('extra', '+1'),
    text('hint', 'People who can sign in'),
  ], { layoutMode: 'HORIZONTAL' });
  const card = frame('card', 'plan', [0, 0, 200, 140], [
    text('name', 'Solo'),
    text('price', '3'),
    text('chip', '-12%'),
    line,
    frame('buy', 'buy', [0, 100, 80, 28], [text('bt', 'Join')]),
  ]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 480, 180], [
    frame('bar', 'cycles', [0, 0, 80, 32], [frame('m1', 'pill', [0, 0, 80, 32], [text('m1t', 'Month')])]),
    frame('deck', 'cards', [0, 40, 440, 140], [card, frame('other', 'plan', [220, 0, 200, 140], [text('on', 'Crew'), text('op', '6')])], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: { mark: { file: 'svg/mark.svg' } } });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'seat-plan', table: parsed.table } }] },
    salt: 'seats',
  });
  const el = (id) => built.template.content.find((item) => item.id === built.mapping[id]?.bricksId);
  assert.equal(el('label').settings.text, '{vnx_sp_row}');
  assert.equal(el('value').settings.text, '{vnx_sp_info}');
  assert.equal(el('extra').settings.text, '{vnx_sp_info_extra}');
  assert.equal(el('hint').settings.text, '{vnx_sp_row_desc}');
  assert.equal(el('chip').settings.text, '{vnx_sp_tag}');
  assert.equal(el('mark').name, 'icon');
  assert.equal(el('mark').settings.icon.icon, 'fa-solid fa-check');
  assert.equal(el('mark').settings._conditions[0][0].value, 'yes');
  assert.equal(built.template.content.find((item) => item.label === 'No').settings.icon.icon, 'fa-solid fa-xmark');
  assert.equal(built.template.content.find((item) => item.label === 'Highlight').settings.icon.icon, 'fa-solid fa-star');
  assert.equal(el('line').settings.query.objectType, 'vnxsp_row__seat-plan');
});

test('the picture names the open cycle pill when the paints match', () => {
  const parsed = parseWidgetData(widgetOf({
    id: 'early-late',
    unit: '/wk',
    button: 'Book',
    cycles: [{ label: 'Morning', badge: '' }, { label: 'Evening', badge: '' }],
    rows: ['Berth'],
    packages: [
      { name: 'Cabin', prices: [{ sale: '40', total: '40', promo: '', code: '' }, { sale: '30', total: '30', promo: '', code: '' }], info: ['one berth'], links: ['https://example.com/a', 'https://example.com/b'] },
      { name: 'Loft', prices: [{ sale: '70', total: '70', promo: '', code: '' }, { sale: '55', total: '55', promo: '', code: '' }], info: ['two berths'], links: ['https://example.com/c', 'https://example.com/d'] },
    ],
  }));
  const pill = (id, label) => frame(id, 'pill', [0, 0, 90, 32], [text(`${id}t`, label)]);
  const card = (id, name) => frame(id, 'card', [0, 0, 160, 80], [text(`${id}n`, name), text(`${id}p`, '40'), text(`${id}u`, '/wk')]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 400, 200], [
    frame('bar', 'cycles', [0, 0, 200, 32], [pill('morn', 'Morning'), pill('eve', 'Evening')], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 48, 360, 80], [card('a', 'Cabin'), card('b', 'Loft')], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'early-late', table: parsed.table, selected: 'eve' } }] },
    salt: 'evening',
  });
  const el = (id) => built.template.content.find((item) => item.id === built.mapping[id]?.bricksId);
  assert.equal(el('morn').settings.query.objectType, 'vnxsp_cycle__early-late');
  assert.equal(built.mapping.eve.skipped.startsWith('merged into'), true);
  assert.equal(el('r').settings.openTab, '0');
});

test('two pills with the same paint and no selected item stay on the first cycle', () => {
  const parsed = parseWidgetData(widgetOf({
    id: 'dawn-plan',
    unit: '/wk',
    button: 'Book',
    cycles: [{ label: 'Dawn', badge: '' }, { label: 'Dusk', badge: '' }],
    rows: ['Berth'],
    packages: [
      { name: 'Cabin', prices: [{ sale: '40', total: '40', promo: '', code: '' }, { sale: '30', total: '30', promo: '', code: '' }], info: ['one berth'], links: ['https://example.com/a', 'https://example.com/b'] },
      { name: 'Loft', prices: [{ sale: '70', total: '70', promo: '', code: '' }, { sale: '55', total: '55', promo: '', code: '' }], info: ['two berths'], links: ['https://example.com/c', 'https://example.com/d'] },
    ],
  }));
  const pill = (id, label) => frame(id, 'pill', [0, 0, 90, 32], [text(`${id}t`, label)]);
  const card = (id, name) => frame(id, 'card', [0, 0, 160, 80], [text(`${id}n`, name), text(`${id}p`, '30'), text(`${id}u`, '/wk')]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 400, 200], [
    frame('bar', 'cycles', [0, 0, 200, 32], [pill('dawn', 'Dawn'), pill('dusk', 'Dusk')], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 48, 360, 80], [card('a', 'Cabin'), card('b', 'Loft')], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'dawn-plan', table: parsed.table } }] },
    salt: 'same-paint',
  });
  const el = (id) => built.template.content.find((item) => item.id === built.mapping[id]?.bricksId);
  assert.equal(el('r').settings.openTab, '0');
});

test('a confirmed price row does not take a cycle pill that sits outside it', () => {
  const parsed = parseWidgetData(widgetOf({
    id: 'cabin-loft',
    unit: '/wk',
    button: 'Book',
    cycles: [{ label: 'Morning', badge: '' }, { label: 'Evening', badge: '' }],
    rows: ['Berth'],
    packages: [
      { name: 'Cabin', prices: [{ sale: '40', total: '40', promo: '', code: '' }, { sale: '30', total: '30', promo: '', code: '' }], info: ['one berth'], links: ['https://example.com/a', 'https://example.com/b'] },
      { name: 'Loft', prices: [{ sale: '70', total: '70', promo: '', code: '' }, { sale: '55', total: '55', promo: '', code: '' }], info: ['two berths'], links: ['https://example.com/c', 'https://example.com/d'] },
    ],
  }));
  const pill = (id, label) => frame(id, 'pill', [0, 0, 80, 32], [text(`${id}t`, label)]);
  const card = (id, name) => frame(id, 'card', [0, 0, 160, 80], [text(`${id}n`, name), text(`${id}p`, '$40'), text(`${id}u`, '/wk')]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 400, 240], [
    frame('bar', 'cycles', [0, 0, 200, 32], [pill('morn', 'Morning'), pill('eve', 'Evening')], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 48, 360, 120], [card('a', 'Cabin'), card('b', 'Loft')], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'deck', params: { id: 'cabin-loft', table: parsed.table, confirm: 'ok' } }] },
    salt: 'locked',
  });
  assert.equal(built.mapping.morn.skipped, undefined);
  assert.equal(built.mapping.morn.bricksId != null, true);
  const pillEl = built.template.content.find((item) => item.id === built.mapping.morn.bricksId);
  assert.equal(pillEl.settings.hasLoop, undefined);
});

test('a row of amount cards is a price table without a currency from one file', () => {
  const card = (id, name, amount, unit) => frame(id, 'card', [0, 0, 160, 120], [
    text(`${id}n`, name),
    text(`${id}p`, amount),
    text(`${id}u`, unit),
  ]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Rates', [0, 0, 400, 160], [
    frame('deck', 'row', [0, 0, 400, 140], [card('a', 'Berth', '$49', '/mo'), card('b', 'Quay', '$80', '/mo')], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  assert.deepEqual(priceFrames(tree).map((item) => item.id), ['deck']);
  const specs = normalizeRoot({ nodes: { r: { document: frame('r', 'Specs', [0, 0, 400, 80], [
    frame('row', 'row', [0, 0, 400, 40], [frame('a', 'line', [0, 0, 160, 24], [text('at', '8 GB')]), frame('b', 'line', [180, 0, 160, 24], [text('bt', '16 GB')])], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  assert.deepEqual(priceFrames(specs).map((item) => item.id), []);
});

test('a drawn price pair asks for a table id', () => {
  const card = (id, value) => frame(id, 'card', [0, 0, 160, 80], [text(`${id}t`, value)]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Rates', [0, 0, 400, 120], [
    card('a', '4.500đ/năm'),
    card('b', '8.000đ/năm'),
  ], { layoutMode: 'HORIZONTAL' }) } } }, 'r', { images: {}, svgs: {} });
  const files = {
    'tree.json': tree,
    'facts.json': { repeats: [] },
    'overrides.json': { nodes: {} },
    'detections.json': { components: [] },
  };
  const result = decide({ readJson: (name, fallback) => files[name] ?? fallback, writeJson: (name, value) => { files[name] = value; } }, {});
  const asked = result.questions.find((item) => item.group === 'price');
  assert.equal(asked.node, 'r');
  const attrs = result.questions.filter((item) => item.group === 'pattr');
  assert.deepEqual(attrs.map((item) => item.attr), REGISTER_BUTTON_FIELDS.map((field) => field.id));
  assert.equal(attrs.find((item) => item.attr === 'data-product-name').value, '{vnx_sp_name}');
  assert.equal(attrs.find((item) => item.attr === 'data-product-category').value, undefined);
  const parts = screenParts(tree, files['detections.json'].components, result.questions, 'FILE');
  const price = parts.find((part) => (part.fields ?? []).some((field) => field.group === 'price'));
  assert.deepEqual(price.fields.filter((field) => field.group === 'pattr').map((field) => field.key), REGISTER_BUTTON_FIELDS.map((field) => registerAttrKey('r', field.id)));
  assert.equal(price.fields.find((field) => field.key === registerAttrKey('r', 'data-product-category')).value, '[Chưa có value]');
});

test('a filled category is on the register button and the other attributes stay visible', () => {
  const parsed = parseWidgetData(starter);
  const tree = treeOf();
  const files = {
    'tree.json': tree,
    'detections.json': { components: [] },
    'overrides.json': { nodes: {} },
  };
  const ws = { readJson: (name, fallback) => files[name] ?? fallback, writeJson: (name, value) => { files[name] = value; } };
  applyAnswers(ws, {
    'price:r': 'starter-cloud',
    [registerAttrKey('r', 'data-product-category')]: 'Cloud desk',
    [registerAttrKey('r', 'data-product-name')]: '{vnx_sp_name}',
  });
  const entry = files['detections.json'].components.find((item) => isKind(item, PartKind.PRICE_TABLE));
  entry.params.table = parsed.table;
  const built = buildTemplate(tree, { detections: files['detections.json'], salt: 'attrs' });
  const button = built.template.content.find((item) => item.id === built.mapping.c1b.bricksId);
  assert.equal(button.settings.link.url, '{vnx_sp_link}');
  assert.equal(button.settings.link.rel, 'nofollow');
  assert.equal(button.settings._cssClasses, 'vnx-button vnx-btn-conversion vnx-button-register');
  assert.equal(button.settings._attributes.find((attr) => attr.name === 'data-product-category').value, 'Cloud desk');
  assert.equal(button.settings._attributes.find((attr) => attr.name === 'data-product-name').value, '{vnx_sp_name}');
});

function moneyTree(cards, pills) {
  return normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 640, 320], [
    frame('bar', 'cycles', [0, 0, 200, 32], pills.map(([id, label]) => frame(id, 'pill', [0, 0, 80, 32], [text(`${id}t`, label)])), { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 48, 400, 240], cards, { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
}

function moneyCard(id, name, amount, badge, line, extra = []) {
  return frame(id, 'card', [0, 0, 180, 200], [
    frame(`${id}n`, 'name', [0, 0, 160, 24], [text(`${id}nt`, name)]),
    frame(`${id}p`, 'price', [0, 28, 160, 24], [text(`${id}pt`, amount)]),
    frame(`${id}d`, 'off', [0, 52, 60, 20], [text(`${id}dt`, badge)]),
    frame(`${id}r`, 'line', [0, 80, 160, 24], [text(`${id}rt`, line)]),
    ...extra,
  ]);
}

function moneyBuild(tree, id, table, salt) {
  const built = buildTemplate(tree, {
    detections: { components: [
      { id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id, table } },
    ] },
    salt,
  });
  const content = built.template.content;
  return (node) => content.find((item) => item.id === built.mapping[node]?.bricksId);
}

test('a drawn amount with thousands marks and a currency mark binds to the plain number, and keeps the mark', () => {
  const parsed = parseWidgetData(widgetOf({
    id: 'harbor-mail',
    unit: '',
    button: 'Choose',
    cycles: [{ label: 'Monthly', badge: '' }, { label: 'Yearly', badge: '-15%' }],
    rows: ['Inboxes'],
    packages: [
      { name: 'Solo', prices: [{ sale: '1250', total: '1250', promo: '', code: '' }, { sale: '1100', total: '13200', promo: '', code: '' }], info: ['3 inboxes'], links: ['https://example.com/s1', 'https://example.com/s2'] },
      { name: 'Crew', prices: [{ sale: '4800', total: '4800', promo: '', code: '' }, { sale: '4100', total: '49200', promo: '', code: '' }], info: ['15 inboxes'], links: ['https://example.com/c1', 'https://example.com/c2'] },
    ],
  }));
  const tree = moneyTree([
    moneyCard('k1', 'Solo', '$1,100', '-12%', '3 inboxes'),
    moneyCard('k2', 'Crew', '4 100 €', '-14%', '15 inboxes'),
  ], [['m1', 'Monthly'], ['m2', 'Yearly']]);
  const el = moneyBuild(tree, 'harbor-mail', parsed.table, 'money');
  assert.equal(el('k1nt').settings.text, '{vnx_sp_name}');
  assert.equal(el('k1pt').settings.text, '$' + '{vnx_sp_sale}');
  assert.notEqual(el('k1dt')?.settings?.text, '{vnx_sp_sale}');
});

test('a currency mark the cell already carries is not doubled, and a percent is not an amount', () => {
  const parsed = parseWidgetData(widgetOf({
    id: 'lumen-store',
    unit: '',
    button: 'Pick',
    cycles: [{ label: 'Week', badge: '' }],
    rows: ['Space'],
    packages: [
      { name: 'Tiny', prices: [{ sale: '12 kr', total: '12 kr', promo: '', code: '' }], info: ['1 GB'], links: ['https://example.com/t'] },
    ],
  }));
  const tree = moneyTree([moneyCard('t1', 'Tiny', '12kr', '-12%', '1 GB')], [['w1', 'Week']]);
  const el = moneyBuild(tree, 'lumen-store', parsed.table, 'money2');
  assert.equal(el('t1pt').settings.text, '{vnx_sp_sale}');
  assert.notEqual(el('t1dt')?.settings?.text, '{vnx_sp_sale}');
});

test('a trailing currency mark after a grouped amount stays after the tag', () => {
  const parsed = parseWidgetData(widgetOf({
    id: 'quill-host',
    unit: '',
    button: 'Go',
    cycles: [{ label: 'Quarter', badge: '' }],
    rows: ['Seats'],
    packages: [
      { name: 'Pro', prices: [{ sale: '89900', total: '269700', promo: '', code: '' }], info: ['5 seats'], links: ['https://example.com/p'] },
    ],
  }));
  const tree = moneyTree([moneyCard('q1', 'Pro', '89.900 ₽', 'new', '5 seats')], [['h1', 'Quarter']]);
  const el = moneyBuild(tree, 'quill-host', parsed.table, 'money3');
  assert.equal(el('q1pt').settings.text, '{vnx_sp_sale} ₽');
});

test('a drawn amount that equals the open cycle regular price is the regular price, even when another cycle sells at that number', () => {
  const parsed = parseWidgetData(widgetOf({
    id: 'cedar-vault',
    unit: '',
    button: 'Start',
    cycles: [{ label: 'Short', badge: '' }, { label: 'Long', badge: '-20%' }],
    rows: ['Backups'],
    packages: [
      { name: 'Core', prices: [{ sale: '700', total: '700', promo: '', code: '' }, { sale: '560', total: '6720', promo: '', code: '' }], info: ['Daily'], links: ['https://example.com/a', 'https://example.com/b'] },
    ],
  }));
  parsed.table.packages[0].prices[1].regular = '700';
  const tree = moneyTree([moneyCard('v1', 'Core', 'kr 560', 'old', 'Daily', [frame('v1o', 'was', [0, 110, 60, 20], [text('v1ot', '700')])])], [['l1', 'Short'], ['l2', 'Long']]);
  const built = buildTemplate(tree, {
    detections: { components: [
      { id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'cedar-vault', table: parsed.table, selected: 'l2' } },
    ] },
    salt: 'money4',
  });
  const content = built.template.content;
  const el = (node) => content.find((item) => item.id === built.mapping[node]?.bricksId);
  assert.equal(el('v1pt').settings.text, 'kr {vnx_sp_sale}');
  assert.equal(el('v1ot').settings.text, '{vnx_sp_regular}');
});

test('the open cycle pill chosen on one frame is its paired pill on another frame', () => {
  const table = { packages: [{ name: 'Basic' }], cycles: [{ label: 'Year' }] };
  const base = { components: [
    { id: 'wide', component: PartKind.PRICE_TABLE, status: 'approved', node: 'wide-box', params: { id: 'north-plan', table, selected: 'wide-pill-2', children: { price_card: 'wide-card' } } },
  ] };
  const carried = carryPriceTables(base, { components: [] }, new Map([['tall-box', 'wide-box'], ['tall-pill-2', 'wide-pill-2']]), 'tall');
  const price = carried.components.find((item) => isKind(item, PartKind.PRICE_TABLE));
  assert.equal(price.params.selected, 'tall-pill-2');
  assert.equal(base.components[0].params.selected, 'wide-pill-2');
  const lost = carryPriceTables(base, { components: [] }, new Map([['tall-box', 'wide-box']]), 'tall');
  assert.equal(lost.components.find((item) => isKind(item, PartKind.PRICE_TABLE)).params.selected, undefined);
});

function richTable() {
  const parsed = parseWidgetData(widgetOf({
    id: 'delta-sites',
    unit: '',
    button: 'Order',
    cycles: [{ label: 'Quarter', badge: '' }, { label: 'Year', badge: '' }, { label: 'Two years', badge: '-9%' }],
    rows: ['Sites', 'Mail'],
    packages: [
      { name: 'Lite', prices: [{ sale: '300', total: '900', promo: '', code: '' }, { sale: '250', total: '3000', promo: '', code: '' }, { sale: '220', total: '5280', promo: '', code: '' }], info: [{ text: '2 sites', icon: 'fa-regular fa-window' }, { text: 'No mail', icon: 'fa-solid fa-ban' }], links: ['https://example.com/1', 'https://example.com/2', 'https://example.com/3'] },
      { name: 'Max', prices: [{ sale: '900', total: '2700', promo: '', code: '' }, { sale: '800', total: '9600', promo: '', code: '' }, { sale: '700', total: '16800', promo: '', code: '' }], info: [{ text: '9 sites', icon: 'fa-regular fa-window' }, { text: 'Mail', icon: 'fa-solid fa-envelope' }], links: ['https://example.com/4', 'https://example.com/5', 'https://example.com/6'] },
    ],
  }));
  for (const pack of parsed.table.packages) {
    pack.prices[0].regular = pack.prices[0].sale;
    pack.prices[1].regular = String(Number(pack.prices[0].sale));
    pack.prices[2].regular = String(Number(pack.prices[0].sale));
  }
  return parsed.table;
}

function richTree() {
  const fixedPill = (id, label, badge) => frame(id, 'pill', [0, 0, 120, 36], [
    text(`${id}t`, label),
    ...(badge ? [frame(`${id}b`, 'badge', [80, 6, 36, 20], [text(`${id}bt`, badge)], { fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.95, b: 1, a: 1 } }] })] : []),
  ], { layoutMode: 'HORIZONTAL', layoutSizingHorizontal: 'FIXED' });
  const icon = (id) => ({ id, name: 'icon', type: 'VECTOR', absoluteBoundingBox: box(0, 0, 20, 20), fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.3, b: 0.4, a: 1 } }] });
  const card = (id, name, was, now, sum, keep, line1, line2, off) => frame(id, 'card', [0, 0, 200, 300], [
    frame(`${id}n`, 'name', [0, 0, 160, 24], [text(`${id}nt`, name)]),
    frame(`${id}o`, 'was', [0, 28, 160, 20], [{ ...text(`${id}old`, was), characterStyleOverrides: was.split('').map(() => 7), styleOverrideTable: { 7: { textDecoration: 'STRIKETHROUGH' } } }]),
    frame(`${id}p`, 'price', [0, 50, 160, 30], [text(`${id}pt`, now), frame(`${id}off`, 'off', [100, 4, 40, 20], [text(`${id}offt`, off)], { fills: [{ type: 'SOLID', color: { r: 0.9, g: 0.2, b: 0.2, a: 1 } }] }), text(`${id}ut`, '/seat a month')]),
    frame(`${id}s`, 'sum', [0, 84, 180, 40], [text(`${id}s1`, sum), text(`${id}s2`, keep)]),
    frame(`${id}r`, 'line', [0, 130, 180, 24], [icon(`${id}ri`), text(`${id}rt`, line1)], { layoutMode: 'HORIZONTAL' }),
    frame(`${id}q`, 'line', [0, 160, 180, 24], [icon(`${id}qi`), text(`${id}qt`, line2)], { layoutMode: 'HORIZONTAL' }),
  ]);
  const cards = [
    card('l1', 'Lite', '300', '€250', 'Billed €3,000 per Year', 'You keep €600', '2 sites', 'No mail', '-17%'),
    card('m1', 'Max', '900', '€800', 'Billed €9,600 per Year', 'You keep €1,200', '9 sites', 'Mail', '-11%'),
  ];
  return normalizeRoot({ nodes: { r: { document: frame('r', 'Hosting', [0, 0, 700, 420], [
    frame('bar', 'cycles', [0, 0, 380, 36], [fixedPill('p1', 'Quarter'), { ...fixedPill('p2', 'Year'), children: [...fixedPill('p2', 'Year').children, frame('p2hot', 'hot', [20, -14, 70, 14], [text('p2hott', 'Top pick')], { layoutPositioning: 'ABSOLUTE' })] }, fixedPill('p3', 'Two years', '-9%')], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 60, 420, 320], cards, { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: Object.fromEntries(['l1ri', 'l1qi', 'm1ri', 'm1qi'].map((id) => [id, { file: `svg/${id}.svg`, bytes: 60, width: 20, height: 20 }])) });
}

function richBuild() {
  const built = buildTemplate(richTree(), {
    detections: { components: [
      { id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'delta-sites', table: richTable(), selected: 'p2' } },
    ] },
    readAsset: () => '<svg viewBox="0 0 20 20" fill="none"><path d="M1 1h18" stroke="#3A4F66"/></svg>',
    salt: 'rich',
  });
  const content = built.template.content;
  return { content, el: (node) => content.find((item) => item.id === built.mapping[node]?.bricksId) };
}

test('a cycle pill drawn at a fixed width keeps that width inside the tabs', () => {
  const { el } = richBuild();
  assert.equal(el('r').name, 'tabs-nested');
  assert.doesNotMatch(el('r').settings._cssCustom ?? '', / \.tab-title \{ width: auto; \}/);
});

test('a badge drawn on one cycle pill is in the looped pill and shows only when the cycle has a badge', () => {
  const { content } = richBuild();
  const badge = content.find((item) => item.settings?.text === '{vnx_sp_cycle_badge}');
  assert.ok(badge, 'badge text is tagged');
  const host = content.find((item) => item.id === badge.parent);
  const conditioned = [badge, host].some((item) => JSON.stringify(item?.settings?._conditions ?? '').includes('{vnx_sp_cycle_badge}'));
  assert.equal(conditioned, true);
  assert.equal(content.filter((item) => item.settings?.text === '{vnx_sp_cycle}').length >= 1, true);
});

test('a price struck through by a run style is the regular price and keeps the line', () => {
  const { el } = richBuild();
  assert.equal(el('l1old').settings.text, '{vnx_sp_regular}');
  assert.equal(el('l1old').settings._typography?.['text-decoration'], 'line-through');
  assert.equal(el('l1pt').settings.text, '€{vnx_sp_sale}');
});

test('an amount inside a sentence becomes the total or the saving, and the open cycle word becomes the cycle', () => {
  const { el } = richBuild();
  assert.equal(el('l1s1').settings.text, 'Billed €{vnx_sp_total} per {vnx_sp_cycle}');
  assert.equal(el('l1s2').settings.text, 'You keep €{vnx_sp_saving}');
});

test('an info icon whose data is a font class is drawn from that class at the drawn size', () => {
  const { el } = richBuild();
  const icon = el('l1ri');
  assert.equal(JSON.stringify(icon.settings._attributes ?? []).includes('{vnx_sp_info_icon_class}'), true);
  assert.equal(icon.settings._typography?.['font-size'], '20px');
  assert.equal(icon.settings._typography?.color?.hex, '#3a4f66');
});

test('a decorative override adds its attribute and keeps the data class the price table wrote', () => {
  const built = buildTemplate(richTree(), {
    overrides: { nodes: { l1ri: { settings: { _attributes: [{ name: 'aria-hidden', value: 'true' }] }, reason: 'icon, decorative' } } },
    detections: { components: [
      { id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'delta-sites', table: richTable(), selected: 'p2' } },
    ] },
    salt: 'rich-ov',
  });
  const icon = built.template.content.find((item) => item.id === built.mapping.l1ri?.bricksId);
  const names = (icon.settings._attributes ?? []).map((attr) => `${attr.name}=${attr.value}`);
  assert.ok(names.includes('class={vnx_sp_info_icon_class}'));
  assert.ok(names.includes('aria-hidden=true'));
});

test('a percent badge on the card is the package tag of the open cycle, hidden when the package has none, and a written unit stays as drawn', () => {
  const { el } = richBuild();
  assert.equal(el('l1offt').settings.text, '{vnx_sp_tag}');
  const badge = el('l1off');
  assert.equal(JSON.stringify(badge.settings._conditions ?? '').includes('{vnx_sp_tag}'), true);
  assert.equal(JSON.stringify(badge.settings).includes('{vnx_sp_discount}'), false);
  assert.equal(el('l1ut').settings.text, '/seat a month');
});

test('a drawn word equal to a package tag is the tag, and its badge hides when the open cycle has no tag', () => {
  const table = richTable();
  table.packages[0].prices[1].tag = 'Hot deal';
  const tree = richTree();
  const offText = (node) => { if (node.id === 'l1offt') node.text.characters = 'Hot deal'; (node.children ?? []).forEach(offText); };
  offText(tree);
  const built = buildTemplate(tree, {
    detections: { components: [
      { id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'delta-sites', table, selected: 'p2' } },
    ] },
    readAsset: () => '<svg viewBox="0 0 20 20"><path d="M1 1h18" stroke="#3A4F66"/></svg>',
    salt: 'rich-tag',
  });
  const el = (node) => built.template.content.find((item) => item.id === built.mapping[node]?.bricksId);
  assert.equal(el('l1offt').settings.text, '{vnx_sp_tag}');
  assert.equal(JSON.stringify(el('l1off').settings._conditions ?? '').includes('{vnx_sp_tag}'), true);
});

test('a mark drawn over one cycle pill is the popular cycle mark of the looped pill, and the popular cycle opens first', () => {
  const { content, el } = richBuild();
  const mark = el('p2hot');
  assert.ok(mark, 'the mark is built');
  const pill = content.find((item) => item.settings?.hasLoop && item.settings.query.objectType === 'vnxsp_cycle__delta-sites' && item.settings._hidden?._cssClasses?.includes('tab-title'));
  assert.equal(mark.parent, pill.id);
  assert.deepEqual(mark.settings._conditions, [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_cycle_popular}', compare: '==', value: '1' }]]);
  assert.equal(JSON.stringify(mark.settings._conditions).includes('Year'), false);
  assert.deepEqual((pill.settings._attributes ?? []).filter((item) => item.name === 'data-vnx-sp-open-tab'), [{ name: 'data-vnx-sp-open-tab', value: '{vnx_sp_cycle_popular}' }]);
  assert.equal(pill.settings._position, 'relative');
  assert.equal(el('p2hott').settings.text, 'Top pick');
});

test('a sentence bound to the saving shows only when the cycle has a saving', () => {
  const { el } = richBuild();
  assert.equal(JSON.stringify(el('l1s2').settings._conditions ?? '').includes('{vnx_sp_saving}'), true);
});

test('a card drawn inside a highlighted shell is the popular state of the looped card', () => {
  const table = richTable();
  const body = (id, name, price) => frame(`${id}body`, 'body', [0, 0, 220, 200], [
    frame(`${id}n`, 'name', [0, 0, 180, 24], [text(`${id}nt`, name)]),
    frame(`${id}p`, 'price', [0, 28, 180, 30], [text(`${id}pt`, price)]),
    frame(`${id}r`, 'line', [0, 70, 180, 24], [text(`${id}rt`, name === 'Lite' ? '2 sites' : '9 sites')]),
  ], { layoutMode: 'VERTICAL', fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], strokes: [{ type: 'SOLID', color: { r: 0.85, g: 0.9, b: 0.95, a: 1 } }], strokeWeight: 1, strokeAlign: 'INSIDE', cornerRadius: 10 });
  const plain = frame('lite', 'plain', [0, 0, 220, 228], [body('lite', 'Lite', '€250')], { layoutMode: 'HORIZONTAL', paddingTop: 28 });
  const shell = frame('max', 'shell', [240, 0, 224, 228], [
    frame('maxtag', 'tag', [0, 0, 224, 28], [text('maxtagt', 'Editor choice')], { layoutMode: 'HORIZONTAL' }),
    body('max', 'Max', '€800'),
  ], { layoutMode: 'VERTICAL', fills: [{ type: 'SOLID', color: { r: 0.4, g: 0.1, b: 0.6, a: 1 } }], strokes: [{ type: 'SOLID', color: { r: 0.4, g: 0.1, b: 0.6, a: 1 } }], strokeWeight: 1, strokeAlign: 'INSIDE', cornerRadius: 12, clipsContent: true });
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Hosting', [0, 0, 700, 320], [
    frame('bar', 'cycles', [0, 0, 300, 36], [frame('q1', 'pill', [0, 0, 90, 36], [text('q1t', 'Quarter')]), frame('q2', 'pill', [0, 0, 90, 36], [text('q2t', 'Year')])], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 60, 480, 240], [plain, shell], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'delta-sites', table, selected: 'q2' } }] },
    salt: 'popular',
  });
  const el = (id) => built.template.content.find((item) => item.id === built.mapping[id]?.bricksId);
  const card = el('lite');
  assert.equal(card.settings.query?.objectType, 'vnxsp_pkg__delta-sites');
  assert.ok((card.settings._attributes ?? []).some((attr) => attr.name === 'data-vnx-sp-popular' && attr.value === '{vnx_sp_popular}'));
  assert.match(card.settings._cssCustom, /\[data-vnx-sp-popular="1"\] \{[^}]*background: #661a99;/);
  assert.match(card.settings._cssCustom, /\[data-vnx-sp-popular="1"\] \{[^}]*border-radius: 12px/);
  const tag = el('maxtag');
  assert.equal(tag.parent, card.id);
  assert.deepEqual(tag.settings._conditions, [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_popular}', compare: '==', value: '1' }]]);
  assert.equal(el('maxtagt').settings.text, 'Editor choice');
});

test('a shell tag moved into the looped card keeps the size rules of the column it was drawn in', () => {
  const table = richTable();
  const body = (id, name, price) => frame(`${id}body`, 'body', [0, 0, 220, 200], [
    frame(`${id}n`, 'name', [0, 0, 180, 24], [text(`${id}nt`, name)]),
    frame(`${id}p`, 'price', [0, 28, 180, 30], [text(`${id}pt`, price)]),
    frame(`${id}r`, 'line', [0, 70, 180, 24], [text(`${id}rt`, name === 'Lite' ? '2 sites' : '9 sites')]),
  ], { layoutMode: 'VERTICAL', fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }] });
  const plain = frame('lite', 'plain', [0, 0, 220, 228], [body('lite', 'Lite', '€250')], { layoutMode: 'HORIZONTAL', paddingTop: 28 });
  const shell = frame('max', 'shell', [240, 0, 224, 228], [
    frame('maxtag', 'tag', [0, 0, 224, 28], [text('maxtagt', 'Editor choice')], { layoutMode: 'HORIZONTAL', layoutAlign: 'STRETCH', primaryAxisSizingMode: 'FIXED', counterAxisSizingMode: 'AUTO' }),
    body('max', 'Max', '€800'),
  ], { layoutMode: 'VERTICAL', fills: [{ type: 'SOLID', color: { r: 0.4, g: 0.1, b: 0.6, a: 1 } }] });
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Hosting', [0, 0, 700, 320], [
    frame('bar', 'cycles', [0, 0, 300, 36], [frame('q1', 'pill', [0, 0, 90, 36], [text('q1t', 'Quarter')]), frame('q2', 'pill', [0, 0, 90, 36], [text('q2t', 'Year')])], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 60, 480, 240], [plain, shell], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'delta-sites', table, selected: 'q2' } }] },
    salt: 'popular-size',
  });
  const tag = built.template.content.find((item) => item.id === built.mapping.maxtag?.bricksId);
  assert.notEqual(tag.settings._flexBasis, '224px');
  assert.equal(tag.settings._flexGrow, undefined);
});

test('with no button label in the table, the painted one-text frame under the price is the card register button and the package name in it is the name', () => {
  const table = parseWidgetData(widgetOf({
    id: 'orbit-mail',
    unit: '',
    button: '',
    cycles: [{ label: 'Month', badge: '' }, { label: 'Year', badge: '' }],
    rows: ['Boxes'],
    packages: [
      { name: 'Nova', prices: [{ sale: '40', total: '40', promo: '', code: '' }, { sale: '30', total: '360', promo: '', code: '' }], info: ['3 boxes'], links: ['https://example.com/n1', 'https://example.com/n12'] },
      { name: 'Pulsar', prices: [{ sale: '90', total: '90', promo: '', code: '' }, { sale: '70', total: '840', promo: '', code: '' }], info: ['9 boxes'], links: ['https://example.com/p1', 'https://example.com/p12'] },
    ],
  })).table;
  const paint = { fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.4, b: 0.9, a: 1 } }] };
  const at = (node, y) => ({ ...node, absoluteBoundingBox: box(0, y, 80, 20) });
  const card = (id, name, sale, line) => frame(id, 'card', [0, 0, 220, 260], [
    frame(`${id}chip`, 'chip', [0, 0, 40, 18], [at(text(`${id}chipt`, 'New'), 0)], paint),
    frame(`${id}n`, 'title', [0, 22, 160, 24], [at(text(`${id}nt`, name), 22)]),
    frame(`${id}p`, 'price', [0, 50, 160, 30], [at(text(`${id}pt`, sale), 50)]),
    frame(`${id}r`, 'line', [0, 90, 180, 24], [at(text(`${id}rt`, line), 90)], { layoutMode: 'HORIZONTAL' }),
    frame(`${id}go`, 'action', [0, 200, 200, 44], [at(text(`${id}got`, `Pick ${name} plan`), 212)], { ...paint, strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }], strokeWeight: 1 }),
  ]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Mail', [0, 0, 500, 340], [
    frame('bar', 'cycles', [0, 0, 200, 30], [frame('y1', 'pill', [0, 0, 90, 30], [text('y1t', 'Month')]), frame('y2', 'pill', [100, 0, 90, 30], [text('y2t', 'Year')])], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 40, 460, 280], [card('a1', 'Nova', '30', '3 boxes'), card('b1', 'Pulsar', '70', '9 boxes')], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [
      { id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'orbit-mail', table, selected: 'y2' } },
      { id: 'act', status: 'approved', source: 'rule', component: PartKind.BUTTON, node: 'a1go', params: {} },
    ] },
    salt: 'orbit',
  });
  const content = built.template.content;
  const el = (node) => content.find((item) => item.id === built.mapping[node]?.bricksId);
  assert.equal(el('a1go').settings.text, 'Pick {vnx_sp_name} plan');
  assert.equal(el('a1go').settings.tag, 'a');
  assert.equal(el('a1go').settings.link.url, '{vnx_sp_link}');
  assert.equal(el('a1chip')?.settings?.link, undefined);
  assert.notEqual(el('a1chipt')?.settings?.text ?? el('a1chip')?.settings?.text, 'Pick {vnx_sp_name} plan');
});

function moreBuild({ shown, after } = {}) {
  const table = parseWidgetData(widgetOf({
    id: 'kite-apps',
    unit: '',
    button: '',
    cycles: [{ label: 'Week', badge: '' }, { label: 'Season', badge: '' }],
    rows: ['A', 'B', 'C', 'D', 'E'],
    packages: [
      { name: 'Sparrow', prices: [{ sale: '5', total: '5', promo: '', code: '' }, { sale: '4', total: '48', promo: '', code: '' }], info: ['1 app', '2 users', 'Chat', 'Logs', 'Backups'], links: ['https://example.com/s1', 'https://example.com/s2'] },
      { name: 'Falcon', prices: [{ sale: '9', total: '9', promo: '', code: '' }, { sale: '8', total: '96', promo: '', code: '' }], info: ['5 apps', '9 users', 'Chat', 'Logs', 'Backups'], links: ['https://example.com/f1', 'https://example.com/f2'] },
    ],
  })).table;
  const icon = (id) => ({ id, name: 'icon', type: 'VECTOR', absoluteBoundingBox: box(0, 0, 16, 16), fills: [{ type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.3, a: 1 } }] });
  const line = (id, words) => frame(id, 'line', [0, 0, 180, 20], [icon(`${id}i`), text(`${id}t`, words)], { layoutMode: 'HORIZONTAL' });
  const tail = (id) => after === 'note'
    ? text(`${id}more`, 'Prices exclude tax')
    : frame(`${id}more`, 'toggle', [0, 0, 180, 20], [text(`${id}moret`, 'See all features'), icon(`${id}morei`)], { layoutMode: 'HORIZONTAL' });
  const card = (id, name, sale, rows) => frame(id, 'card', [0, 0, 200, 300], [
    frame(`${id}n`, 'title', [0, 0, 160, 24], [text(`${id}nt`, name)]),
    frame(`${id}p`, 'price', [0, 30, 160, 30], [text(`${id}pt`, sale)]),
    frame(`${id}b`, 'benefits', [0, 70, 180, 140], [
      frame(`${id}l`, 'list', [0, 0, 180, 100], rows.map((words, index) => line(`${id}l${index}`, words))),
      tail(id),
    ]),
  ]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Apps', [0, 0, 460, 380], [
    frame('bar', 'cycles', [0, 0, 200, 30], [frame('w1', 'pill', [0, 0, 90, 30], [text('w1t', 'Week')]), frame('w2', 'pill', [100, 0, 90, 30], [text('w2t', 'Season')])], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 40, 420, 320], [card('s1', 'Sparrow', '4', ['1 app', '2 users', 'Chat']), card('f1', 'Falcon', '8', ['5 apps', '9 users', 'Chat'])], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: Object.fromEntries(['s1l0i', 's1l1i', 's1l2i', 's1morei', 'f1l0i', 'f1l1i', 'f1l2i', 'f1morei'].map((id) => [id, { file: `svg/${id}.svg`, bytes: 60, width: 16, height: 16 }])) });
  const built = buildTemplate(tree, {
    detections: { components: [
      { id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'kite-apps', table, selected: 'w2', ...(shown ? { shown } : {}) } },
    ] },
    readAsset: () => '<svg viewBox="0 0 16 16"><path d="M1 1h14" stroke="#444444"/></svg>',
    salt: 'kite',
  });
  const content = built.template.content;
  return { content, el: (node) => content.find((item) => item.id === built.mapping[node]?.bricksId) };
}

test('a text with a trailing mark right after the looped rows opens the rows past the drawn count', () => {
  const { el } = moreBuild();
  const toggle = el('s1more');
  assert.equal(toggle.settings.tag, 'button');
  assert.match(toggle.settings._cssClasses, /vnx-sp-more/);
  assert.deepEqual(toggle.settings._interactions.map((item) => [item.trigger, item.action, item.target, item.actionAttributeKey, item.actionAttributeValue]), [['click', 'toggleAttribute', 'self', 'class', 'vnx-sp-more-open']]);
  const list = el('s1l');
  assert.match(list.settings._cssCustom, /:not\(:has\(~ \.vnx-sp-more-open\)\) > :nth-child\(n\+4\) \{ display: none !important; \}/);
  assert.match(list.settings._cssCustom, /:not\(:has\(> :nth-child\(4\)\)\) ~ \.vnx-sp-more \{ display: none !important; \}/);
});

test('a planned row count replaces the drawn count before the rows open', () => {
  const { el } = moreBuild({ shown: 2 });
  assert.match(el('s1l').settings._cssCustom, /> :nth-child\(n\+3\) \{ display: none !important; \}/);
});

test('a plain sentence after the looped rows is not a toggle', () => {
  const { el } = moreBuild({ after: 'note' });
  assert.equal(el('s1more')?.settings?._interactions, undefined);
  assert.doesNotMatch(el('s1l')?.settings?._cssCustom ?? '', /vnx-sp-more/);
});

test('a heading another card draws right before its info rows is the package specs title of the looped card, hidden when empty', () => {
  const table = parseWidgetData(widgetOf({
    id: 'reef-dns',
    unit: '',
    button: '',
    cycles: [{ label: 'Day', badge: '' }, { label: 'Night', badge: '' }],
    rows: ['Zones', 'Queries'],
    packages: [
      { name: 'Coral', prices: [{ sale: '2', total: '2', promo: '', code: '' }, { sale: '3', total: '3', promo: '', code: '' }], info: ['1 zone', '1k queries'], links: ['https://example.com/c1', 'https://example.com/c2'] },
      { name: 'Kelp', prices: [{ sale: '6', total: '6', promo: '', code: '' }, { sale: '7', total: '7', promo: '', code: '' }], info: ['5 zones', '9k queries'], links: ['https://example.com/k1', 'https://example.com/k2'] },
    ],
  })).table;
  const icon = (id) => ({ id, name: 'icon', type: 'VECTOR', absoluteBoundingBox: box(0, 0, 16, 16), fills: [{ type: 'SOLID', color: { r: 0.3, g: 0.3, b: 0.3, a: 1 } }] });
  const line = (id, words) => frame(id, 'line', [0, 0, 180, 20], [icon(`${id}i`), text(`${id}t`, words)], { layoutMode: 'HORIZONTAL' });
  const lite = frame('c1', 'card', [0, 0, 200, 260], [
    frame('c1n', 'title', [0, 0, 160, 24], [text('c1nt', 'Coral')]),
    frame('c1p', 'price', [0, 30, 160, 30], [text('c1pt', '3')]),
    frame('c1s', 'shelf', [0, 70, 180, 120], [frame('c1l', 'list', [0, 0, 180, 60], [line('c1l0', '1 zone'), line('c1l1', '1k queries')])]),
  ]);
  const full = frame('k1', 'card', [0, 0, 200, 260], [
    frame('k1n', 'title', [0, 0, 160, 24], [text('k1nt', 'Kelp')]),
    frame('k1p', 'price', [0, 30, 160, 30], [text('k1pt', '7')]),
    frame('k1s', 'shelf', [0, 70, 180, 140], [frame('k1b', 'block', [0, 0, 180, 100], [text('k1h', 'Everything in Coral, plus:'), frame('k1l', 'list', [0, 30, 180, 60], [line('k1l0', '5 zones'), line('k1l1', '9k queries')])])]),
  ]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'DNS', [0, 0, 460, 340], [
    frame('bar', 'cycles', [0, 0, 200, 30], [frame('d1', 'pill', [0, 0, 90, 30], [text('d1t', 'Day')]), frame('d2', 'pill', [100, 0, 90, 30], [text('d2t', 'Night')])], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 40, 420, 280], [lite, full], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: Object.fromEntries(['c1l0i', 'c1l1i', 'k1l0i', 'k1l1i'].map((id) => [id, { file: `svg/${id}.svg`, bytes: 60, width: 16, height: 16 }])) });
  const built = buildTemplate(tree, {
    detections: { components: [
      { id: 'price', status: 'approved', source: 'plan', component: PartKind.PRICE_TABLE, node: 'r', params: { id: 'reef-dns', table, selected: 'd2' } },
    ] },
    readAsset: () => '<svg viewBox="0 0 16 16"><path d="M1 1h14" stroke="#444444"/></svg>',
    salt: 'reef',
  });
  const el = (node) => built.template.content.find((item) => item.id === built.mapping[node]?.bricksId);
  const heading = el('k1h');
  assert.ok(heading, 'the heading is built');
  assert.equal(heading.parent, el('c1s').id);
  assert.equal(heading.settings.text, '{vnx_sp_specs_title}');
  assert.deepEqual(heading.settings._conditions, [[{ key: 'dynamic_data', dynamic_data: '{vnx_sp_specs_title}', compare: 'empty_not' }]]);
  assert.match(heading.settings._cssCustom ?? '', /order: -1;/);
});
