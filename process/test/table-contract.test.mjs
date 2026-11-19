import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { parseWidgetData } from '../modules/write-bricks/components/price-data.mjs';
import { parseCompareData } from '../modules/write-bricks/components/compare-data.mjs';
import { priceTableGaps, compareTableGaps } from '../modules/write-bricks/components/table-contract.mjs';

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

function priceWidget() {
  const cycles = [{ label: 'Spring', badge: '' }, { label: 'Autumn', badge: '-4%' }];
  const packages = [
    { name: 'Cedar', prices: [{ sale: '4', total: '16', promo: 'Note', code: 'AA' }, { sale: '3', total: '18', promo: 'Note', code: 'AA' }], info: ['Soil'], links: ['https://example.com/c1', 'https://example.com/c2'] },
    { name: 'Maple', prices: [{ sale: '8', total: '32', promo: 'Note', code: 'BB' }, { sale: '7', total: '42', promo: 'Note', code: 'BB' }], info: ['Shade'], links: ['https://example.com/m1', 'https://example.com/m2'] },
  ];
  const head = ['', 'Notes', ...packages.map((item) => item.name)];
  const blank = head.map(() => '');
  const priceHead = ['Service price | *', 'Regular | Sale | Total | Tag | Promo | Code | Label', '', ''];
  const cycleRows = cycles.map((cycle, index) => [
    cycle.label,
    '',
    ...packages.map((item) => ['', item.prices[index].sale, item.prices[index].total, '', item.prices[index].promo, item.prices[index].code, ''].join(' | ')),
  ]);
  const infoHead = ['Specs | *', 'Product | Extra | Icon', '', ''];
  const infoRows = [['Soil', '', ...packages.map((item) => `${item.info[0]} |  | yes`)]];
  const urlHead = ['Sign-up | *', '', '', ''];
  const urlRows = cycles.map((cycle, index) => [cycle.label, '', ...packages.map((item) => item.links[index])]);
  return parseWidgetData({
    status: true,
    data: transpose([head, blank, priceHead, ...cycleRows, infoHead, ...infoRows, urlHead, ...urlRows]),
    meta: { table_id: 'grove-plan', unit: '/wk', button: 'Reserve', updated_at: 1 },
  });
}

function priceTree() {
  const pill = (id, label) => frame(id, 'pill', [0, 0, 80, 32], [text(`${id}t`, label)]);
  const card = (id, name, price, info) => frame(id, 'card', [0, 0, 180, 160], [
    text(`${id}n`, name),
    text(`${id}p`, price),
    text(`${id}u`, '/wk'),
    frame(`${id}r`, 'line', [0, 0, 120, 20], [text(`${id}rt`, info)]),
    frame(`${id}b`, 'buy', [0, 0, 80, 28], [text(`${id}bt`, 'Reserve')]),
  ]);
  return normalizeRoot({ nodes: { r: { document: frame('r', 'Plans', [0, 0, 420, 240], [
    frame('bar', 'cycles', [0, 0, 200, 32], [pill('s1', 'Spring'), pill('s2', 'Autumn')], { layoutMode: 'HORIZONTAL' }),
    frame('deck', 'cards', [0, 48, 400, 160], [card('a', 'Cedar', '4', 'Soil'), card('b', 'Maple', '8', 'Shade')], { layoutMode: 'HORIZONTAL' }),
  ]) } } }, 'r', { images: {}, svgs: {} });
}

test('a price table output keeps every package and the cycle control from the tool', () => {
  const parsed = priceWidget();
  assert.equal(parsed.error, undefined);
  const built = buildTemplate(priceTree(), {
    detections: { components: [{ id: 'price', status: 'approved', source: 'plan', component: 'price-table', node: 'r', params: { id: 'grove-plan', table: parsed.table } }] },
    salt: 'grove',
  });
  assert.deepEqual(priceTableGaps(built.template.content, parsed.table, 'grove-plan'), []);
  const packages = built.template.content.filter((item) => item.settings?.query?.objectType === 'vnxsp_pkg__grove-plan');
  assert.equal(packages.length, 1);
});

test('a price output without the package loop is rejected', () => {
  const gaps = priceTableGaps([
    { settings: { hasLoop: true, query: { objectType: 'vnxsp_cycle__grove-plan' }, _hidden: { _cssClasses: 'tab-title' } } },
  ], { rows: [{ label: 'Soil' }], packages: [{}, {}] }, 'grove-plan');
  assert.ok(gaps.includes('package loop'));
  assert.ok(gaps.includes('info row loop'));
  assert.ok(gaps.includes('package name'));
});

test('a comparison output keeps every feature row and every package column', () => {
  const parsed = parseCompareData({
    id: 'fleet-sheet',
    name: 'fleet-sheet',
    unit: '/wk',
    button: 'Book',
    packages: [
      { id: 'p1', name: 'Ferry', price: 5000, cycle: 'Week', total: 20000, link: 'https://example.com/ferry' },
      { id: 'p2', name: 'Skiff', price: 9000, cycle: 'Week', total: 36000, link: 'https://example.com/skiff' },
    ],
    groups: [{
      id: 'g1',
      label: 'Hull',
      icon: '',
      rows: [
        { id: 'oak', label: 'Oak', desc: 'Outer skin', values: [{ package: 'p1', value: 'yes', type: 'yes' }, { package: 'p2', value: 'no', type: 'no' }] },
        { id: 'paint', label: 'Paint', desc: '', values: [{ package: 'p1', value: 'Blue', type: 'text' }, { package: 'p2', value: 'Red', type: 'text' }] },
      ],
    }],
  });
  const line = (id, value, y) => ({ ...text(id, value), absoluteBoundingBox: box(0, y, 80, 20) });
  const column = (id, name, price, total) => frame(id, 'col', [0, 0, 160, 140], [
    line(`${id}n`, name, 0), line(`${id}p`, price, 28), line(`${id}u`, '/wk', 52), line(`${id}c`, 'Week', 76), line(`${id}t`, total, 100),
  ]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'Sheet', [0, 0, 400, 280], [
    frame('head', 'packages', [0, 0, 360, 140], [
      column('a', 'Ferry', '5.000', '20.000'),
      column('b', 'Skiff', '9.000', '36.000'),
    ], { layoutMode: 'HORIZONTAL' }),
    frame('g', 'group', [0, 160, 360, 80], [
      text('gt', 'Hull'),
      frame('r1', 'row', [0, 24, 360, 24], [text('r1l', 'Oak'), text('r1c1', 'yes'), text('r1c2', 'no')], { layoutMode: 'HORIZONTAL' }),
      frame('r2', 'row', [0, 52, 360, 24], [text('r2l', 'Paint'), text('r2c1', 'Blue'), text('r2c2', 'Red')], { layoutMode: 'HORIZONTAL' }),
    ]),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'cmp', status: 'approved', source: 'plan', component: 'compare-table', node: 'r', params: { id: 'fleet-sheet', table: parsed.table } }] },
    salt: 'fleet',
  });
  assert.deepEqual(compareTableGaps(built.template.content, parsed.table, 'fleet-sheet'), []);
});

test('a comparison output that drops the feature rows is rejected', () => {
  const gaps = compareTableGaps([
    { settings: { text: '{vnx_cmp_name:t=fleet-sheet:p=1}' } },
  ], { packages: [{}, {}], groups: [{ rows: [{}, {}] }] }, 'fleet-sheet');
  assert.ok(gaps.includes('feature group loop'));
  assert.ok(gaps.includes('feature row loop'));
  assert.ok(gaps.includes('every package column'));
});
