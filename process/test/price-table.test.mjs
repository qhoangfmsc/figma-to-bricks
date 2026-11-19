import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { parseWidgetData, PRICE_ID, carryPriceTables } from '../modules/write-bricks/components/price-data.mjs';
import { choiceOf } from '../modules/missing-content/choices.mjs';
import { applyAnswers } from '../modules/missing-content/index.mjs';
import { decide } from '../modules/approve-parts/index.mjs';
import { screenParts } from '../modules/single-template/parts.mjs';
import { REGISTER_BUTTON_FIELDS, missingBoundTables, priceFrames, registerAttrKey } from '../modules/write-bricks/components/price-table.mjs';

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
      { id: 'price', status: 'approved', source: 'plan', component: 'price-table', node: 'r', params: { id: 'starter-cloud', table: parsed.table } },
      { id: 'buy', status: 'approved', source: 'rule', component: 'button', node: 'c1b', params: {} },
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
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: 'price-table', node: 'r', params: { id: 'studio-plan', table: parsed.table } }] },
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
  const loaded = { components: [{ component: 'price-table', status: 'approved', node: 'deck', params: { id: 'lane-pier', table: { packages: [{ name: 'Lane' }] } } }] };
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
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: 'price-table', node: 'deck', params: { id: 'lane-pier', table } }] },
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
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: 'price-table', node: 'r', params: { id: 'lane-pier', table } }] },
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
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: 'price-table', node: 'ap', params: { id: 'starter-cloud', table: parsed.table } }] },
    salt: 'case',
  });
  const textOf = (id) => built.template.content.find((item) => item.id === built.mapping[id]?.bricksId)?.settings.text;
  assert.equal(textOf('an'), '{vnx_sp_name}');
  assert.equal(textOf('ap'), '{vnx_sp_sale}');
  assert.equal(textOf('au'), '{vnx_sp_unit}');
  assert.equal(textOf('apt'), '{vnx_sp_promo_text}');
  assert.equal(textOf('apc'), '{vnx_sp_code}');
  assert.equal(textOf('y1t'), '{vnx_sp_cycle}');
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
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: 'price-table', node: 'r', params: { id: 'starter-cloud', table: parsed.table } }] },
    salt: 'rest',
  });
  const content = built.template.content;
  const el = (id) => content.find((item) => item.id === built.mapping[id]?.bricksId);
  assert.equal(el('rest').settings.query.objectType, 'vnxsp_cycle__starter-cloud');
  assert.equal(built.mapping.hot.skipped.startsWith('merged into'), true);
  assert.equal(content.find((item) => item.id === built.mapping['deck#open']?.bricksId).settings._direction, 'column');
  assert.match(el('bar').settings._cssCustom, /brx-open/);
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
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: 'price-table', node: 'r', params: { id: 'starter-cloud', table: parsed.table } }] },
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
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: 'price-table', node: 'r', params: { id: 'starter-cloud', table: parsed.table } }] },
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
      { id: 'desk', component: 'price-table', status: 'approved', node: 'desk-box', params: { id: 'starter-cloud', table } },
      { id: 'desk-2', component: 'price-table', status: 'approved', node: 'desk-other', params: { id: 'starter-cloud', table } },
    ] },
    { components: [
      { id: 'local', component: 'price-table', status: 'approved', node: 'phone-box', params: { id: 'other-table' } },
      { id: 'keep', component: 'button', status: 'approved', node: 'phone-btn', params: {} },
    ] },
    new Map([['phone-box', 'desk-box']]),
    'phone',
  );
  assert.equal(carried.components.find((item) => item.component === 'button').id, 'keep');
  const prices = carried.components.filter((item) => item.component === 'price-table');
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
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: 'price-table', node: 'r', params: { id: 'starter-cloud', table: parsed.table } }] },
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
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: 'price-table', node: 'r', params: { id: 'seat-plan', table: parsed.table } }] },
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
  const entry = files['detections.json'].components.find((item) => item.component === 'price-table');
  entry.params.table = parsed.table;
  const built = buildTemplate(tree, { detections: files['detections.json'], salt: 'attrs' });
  const button = built.template.content.find((item) => item.id === built.mapping.c1b.bricksId);
  assert.equal(button.settings.link.url, '{vnx_sp_link}');
  assert.equal(button.settings.link.rel, 'nofollow');
  assert.equal(button.settings._cssClasses, 'vnx-button vnx-btn-conversion vnx-button-register');
  assert.equal(button.settings._attributes.find((attr) => attr.name === 'data-product-category').value, 'Cloud desk');
  assert.equal(button.settings._attributes.find((attr) => attr.name === 'data-product-name').value, '{vnx_sp_name}');
});
