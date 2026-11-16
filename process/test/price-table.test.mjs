import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { parseWidgetData, PRICE_ID } from '../modules/write-bricks/components/price-data.mjs';
import { choiceOf } from '../modules/missing-content/choices.mjs';
import { applyAnswers } from '../modules/missing-content/index.mjs';
import { decide } from '../modules/approve-parts/index.mjs';

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
      return ['', price.sale, price.total, '', price.promo, price.code, ''].join(' | ');
    }),
  ]);
  const infoHead = ['Specs | *', 'Product | Extra | Icon', ...packages.map(() => '')];
  const infoRows = rows.map((row, index) => [row, '', ...packages.map((item) => `${item.info[index]} |  | yes`)]);
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
  assert.deepEqual(el('c1b').settings.link, { type: 'external', url: '{vnx_sp_link}' });
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
  assert.equal(built.mapping.b.skipped.startsWith('merged into'), true);
});

test('the plan id is an enum, and a blank id leaves the drawing alone', () => {
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
});
