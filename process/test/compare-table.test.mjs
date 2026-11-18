import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { parseCompareData, formatMoney, carryCompareTables } from '../modules/write-bricks/components/compare-data.mjs';
import { compareFrames, BUY_BUTTON_FIELDS } from '../modules/write-bricks/components/compare-table.mjs';
import { priceFrames } from '../modules/write-bricks/components/price-table.mjs';
import { choiceOf } from '../modules/missing-content/choices.mjs';
import { applyAnswers } from '../modules/missing-content/index.mjs';

const box = (x, y, w, h) => ({ x, y, width: w, height: h });
const text = (id, value) => ({
  id, name: id, type: 'TEXT', characters: value,
  absoluteBoundingBox: box(0, 0, 80, 20),
  style: { fontFamily: 'Roboto', fontSize: 14, fontWeight: 500, lineHeightPx: 20 },
  fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 } }],
});
const frame = (id, name, rect, children, extra = {}) => ({
  id, name, type: 'FRAME', absoluteBoundingBox: box(...rect), children, ...extra,
});
const mark = (id) => ({
  id, name: id, type: 'FRAME', absoluteBoundingBox: box(0, 0, 16, 16),
  fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8, a: 1 } }],
});

function payloadOf({ id, unit, button, packages, groups }) {
  return { id, name: id, unit, button, packages, groups };
}

const studio = payloadOf({
  id: 'studio-matrix',
  unit: '/wk',
  button: 'Order',
  packages: [
    { id: 'p1', name: 'Starter', price: 12000, cycle: 'Year', total: 144000, link: 'https://example.com/starter' },
    { id: 'p2', name: 'Growth', price: 24000, cycle: 'Year', total: 288000, link: 'https://example.com/growth' },
  ],
  groups: [{
    id: 'g1',
    label: 'Storage',
    icon: '',
    rows: [
      { id: 'disk', label: 'Disk', desc: '', values: [{ package: 'p1', value: 'yes', type: 'yes' }, { package: 'p2', value: 'no', type: 'no' }] },
      { id: 'backup', label: 'Backup', desc: 'Kept offsite', values: [{ package: 'p1', value: 'Nightly', type: 'text' }, { package: 'p2', value: 'Weekly', type: 'text' }] },
    ],
  }],
});

function treeOf({ left, right, unit, button, cycle, group, rowA, rowB, more, badge }) {
  const line = (id, value, y) => ({ ...text(id, value), absoluteBoundingBox: box(0, y, 80, 20) });
  const column = (id, name, price, total, lead = []) => frame(id, 'col', [0, 0, 160, 180], [
    ...lead.map((item, index) => ({ ...item, absoluteBoundingBox: box(0, index * 24, 120, 20) })),
    line(`${id}n`, name, 40),
    line(`${id}p`, price, 70),
    line(`${id}u`, unit, 74),
    line(`${id}c`, cycle, 100),
    line(`${id}t`, total, 130),
    frame(`${id}b`, 'buy', [0, 150, 80, 28], [line(`${id}bt`, button, 154)]),
  ], { layoutMode: 'VERTICAL' });
  const svgs = { mk1: { file: 'mk.svg', bytes: 12, width: 16, height: 16 }, mk2: { file: 'mk.svg', bytes: 12, width: 16, height: 16 }, q1: { file: 'q.svg', bytes: 12, width: 16, height: 16 } };
  return normalizeRoot({ nodes: { r: { document: frame('r', 'Matrix', [0, 0, 400, 360], [
    frame('head', 'packages', [0, 0, 360, 180], [
      column('a', left.name, left.price, left.total),
      column('b', right.name, right.price, right.total, badge ? [text('badge', badge)] : []),
    ], { layoutMode: 'HORIZONTAL', clipsContent: true }),
    frame('tip', 'Tooltip', [0, 0, 160, 72], [text('tipt', 'A longer note about this row for the visitor.')], {
      fills: [{ type: 'SOLID', color: { r: 0, g: 0.486, b: 0.988, a: 1 } }],
    }),
    frame('g', 'group', [0, 200, 360, 140], [
      text('gt', group),
      frame('r1', 'row', [0, 24, 360, 24], [
        frame('lab', 'label', [0, 0, 140, 24], [
          text('r1l', rowA),
          { id: 'q1', name: 'circle-question', type: 'FRAME', absoluteBoundingBox: box(110, 0, 16, 16) },
        ]),
        frame('r1c1', 'cell', [80, 0, 40, 24], [mark('mk1')]),
        frame('r1c2', 'cell', [200, 0, 40, 24], [mark('mk2')]),
      ], { layoutMode: 'HORIZONTAL' }),
      frame('r2', 'row', [0, 52, 360, 24], [
        text('r2l', rowB),
        text('r2c1', 'Nightly'),
        text('r2c2', 'Weekly'),
      ], { layoutMode: 'HORIZONTAL' }),
      ...(more ? [frame('more', 'more', [0, 90, 80, 24], [text('mt', more)])] : []),
    ], { layoutMode: 'VERTICAL' }),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs });
}

function built(table, tree) {
  return buildTemplate(tree, {
    detections: { components: [{ id: 'cmp', status: 'approved', source: 'plan', component: 'compare-table', node: 'r', params: { id: table.meta.table_id, table } }] },
    salt: table.meta.table_id,
  });
}

test('compare payload money is grouped and marks keep their type', () => {
  const parsed = parseCompareData(studio);
  assert.equal(parsed.error, undefined);
  assert.equal(formatMoney(12000), '12.000');
  assert.equal(parsed.table.packages[0].price, '12.000');
  assert.equal(parsed.table.packages[1].total, '288.000');
  assert.equal(parsed.table.groups[0].rows[0].values.p1.type, 'yes');
  assert.equal(parsed.table.groups[0].rows[1].values.p2.value, 'Weekly');
  assert.equal(parseCompareData({ packages: [], groups: [] }).error, 'empty-table');
  assert.equal(parseCompareData(null).error, 'missing-table');
});

test('one column, one group and one row become the three query loops', () => {
  const parsed = parseCompareData(studio);
  const tree = treeOf({
    left: { name: 'Starter', price: '12.000', total: '144.000' },
    right: { name: 'Growth', price: '24.000', total: '288.000' },
    unit: '/wk', button: 'Order', cycle: 'Year', group: 'Storage', rowA: 'Disk', rowB: 'Backup', more: 'Show rest',
  });
  const result = built(parsed.table, tree);
  const content = result.template.content;
  const el = (id) => content.find((item) => item.id === result.mapping[id]?.bricksId);
  assert.equal(result.mapping.b?.skipped, undefined);
  assert.equal(result.mapping.r2?.skipped?.startsWith('merged into'), true);
  const types = content.filter((item) => item.settings?.hasLoop).map((item) => item.settings.query.objectType).sort();
  assert.deepEqual(types, ['vnxcmp_group__studio-matrix', 'vnxcmp_row__studio-matrix']);
  assert.equal(el('an').settings.text, '{vnx_cmp_name:t=studio-matrix:p=1}');
  assert.equal(el('bn').settings.text, '{vnx_cmp_name:t=studio-matrix:p=2}');
  assert.equal(el('ap').settings.text, '{vnx_cmp_price:t=studio-matrix:p=1}');
  assert.equal(el('at').settings.text, '{vnx_cmp_total:t=studio-matrix:p=1}');
  assert.equal(el('au').settings.text, '{vnx_cmp_unit:t=studio-matrix:p=1}');
  assert.equal(el('ac').settings.text, '{vnx_cmp_cycle:t=studio-matrix:p=1}');
  assert.equal(el('abt').settings.text, '{vnx_cmp_button:t=studio-matrix:p=1}');
  assert.equal(el('ab').settings.tag, 'a');
  assert.equal(el('ab').settings.link.url, '{vnx_cmp_link:t=studio-matrix:p=1}');
  assert.equal(el('ab').settings._attributes.find((attr) => attr.name === 'data-price').value, '{vnx_cmp_price:raw:t=studio-matrix:p=1}');
  assert.equal(el('gt').settings.text, '{vnx_cmp_group:t=studio-matrix}');
  assert.equal(el('r1l').settings.text, '{vnx_cmp_row:t=studio-matrix}');
  const tipText = content.find((item) => item.settings?.text === '{vnx_cmp_row_desc:t=studio-matrix}');
  const tipWrap = content.find((item) => item.id === tipText.parent);
  assert.equal(tipText.settings._cssClasses, 'f2b-tip');
  assert.equal(tipText.settings._conditions[0][0].compare, 'empty_not');
  assert.match(tipWrap.settings._cssClasses, /f2b-tip-wrap/);
  assert.match(tipWrap.settings._cssCustom, /:hover > \.f2b-tip \{ display: block/);
  assert.match(tipText.settings._cssCustom, /position: absolute/);
  assert.match(tipText.settings._cssCustom, /z-index: 50/);
  assert.match(tipText.settings._cssCustom, /bottom: calc\(100% \+ 4px\)/);
  assert.match(tipText.settings._cssCustom, /right: 0/);
  assert.match(tipText.settings._cssCustom, /#007cfc/);
  assert.match(tipText.settings._cssCustom, /max-width: 160px/);
  assert.equal((result.template.scripts ?? []).join('\n').includes('appendChild'), false);
  assert.equal(result.mapping.tip?.skipped?.startsWith('merged into'), true);
  assert.equal(el('mk1').name, 'icon');
  assert.equal(el('mk1').settings.icon.icon, 'fa-solid fa-check');
  assert.equal(el('mk1').settings.iconSize, '16px');
  assert.equal(el('mk1').settings.iconColor.hex, '#3366cc');
  const noIcon = content.find((item) => item.label === 'No');
  assert.equal(noIcon.settings.icon.icon, 'fa-solid fa-xmark');
  assert.equal(noIcon.settings.iconColor.hex, '#f62e13');
  assert.equal(noIcon.settings.iconSize, '16px');
  assert.equal(el('head').settings._position, 'sticky');
  assert.equal(el('head').settings._top, '60px');
  assert.equal(el('head').settings['_top:tablet_portrait'], '40px');
  assert.equal(el('more').settings._attributes[0].name, 'data-vnx-cmp-more');
  assert.equal(el('more').settings._conditions[0][0].compare, '>');
  assert.equal(el('more').settings._conditions[0][0].value, '4');
  assert.equal(el('more').settings._conditions[0][1].value, '1');
  assert.equal(content.some((item) => item.settings?.text === 'Thu gọn'), true);
  assert.match(el('g').settings._cssCustom, /f2b-cmp-less-label/);
  assert.match(el('g').settings._cssCustom, /angles-up|f2b-cmp-up/);
  assert.equal(el('g').settings._attributes.some((attr) => attr.name === 'data-vnx-cmp-group'), true);
  assert.match(el('g').settings._cssCustom, /:not\(\.is-open\) \.f2b-cmp-row/);
  assert.match(el('g').settings._cssCustom, /:not\(\.is-open\) \.f2b-cmp-i-4/);
  assert.match(el('g').settings._cssCustom, /\.f2b-cmp-g-1 \.f2b-cmp-row/);
  assert.match(el('r').settings._cssCustom, /--vnx-cmp-packages: 2/);
  assert.equal(el('r').settings._attributes.some((attr) => attr.name === 'data-vnx-cmp-slider-root'), true);
  assert.match(el('r').settings._cssCustom, /:not\(\.is-sliding\)/);
  assert.match(el('r').settings._cssCustom, /\.is-disabled/);
  assert.equal(el('head').settings._overflow, 'auto');
  assert.equal(el('head').settings._attributes.some((attr) => attr.name === 'data-vnx-cmp-slider'), true);
  assert.equal(el('a').settings._attributes.some((attr) => attr.name === 'data-vnx-cmp-col'), true);
  assert.equal(content.some((item) => item.settings?.text === '{vnx_cmp_value_text:t=studio-matrix:p=1}'), true);
  assert.equal(content.some((item) => item.settings?.text === '{vnx_cmp_value_text:t=studio-matrix:p=2}'), true);
  assert.equal(JSON.stringify(content).includes('Growth'), false);
});

test('another matrix with different words uses the same tags', () => {
  const parsed = parseCompareData(payloadOf({
    id: 'room-grid',
    unit: '/day',
    button: 'Book',
    packages: [
      { id: 'd1', name: 'Desk', price: 3000, cycle: 'Week', total: 21000, link: 'https://example.com/desk' },
      { id: 'd2', name: 'Room', price: 8000, cycle: 'Week', total: 56000, link: 'https://example.com/room' },
    ],
    groups: [{
      id: 'power',
      label: 'Power',
      rows: [
        { id: 'watts', label: 'Watts', desc: '', values: [{ package: 'd1', value: 'yes' }, { package: 'd2', value: 'no' }] },
        { id: 'plug', label: 'Plug', desc: '', values: [{ package: 'd1', value: 'Twin', type: 'text' }, { package: 'd2', value: 'Single', type: 'text' }] },
      ],
    }],
  }));
  const tree = treeOf({
    left: { name: 'Desk', price: '3.000', total: '21.000' },
    right: { name: 'Room', price: '8.000', total: '56.000' },
    unit: '/day', button: 'Book', cycle: 'Week', group: 'Power', rowA: 'Watts', rowB: 'Plug', more: 'Open list',
  });
  const result = built(parsed.table, tree);
  const textOf = (id) => result.template.content.find((item) => item.id === result.mapping[id].bricksId).settings.text;
  assert.equal(textOf('an'), '{vnx_cmp_name:t=room-grid:p=1}');
  assert.equal(textOf('bn'), '{vnx_cmp_name:t=room-grid:p=2}');
  assert.equal(textOf('ap'), '{vnx_cmp_price:t=room-grid:p=1}');
  assert.equal(textOf('gt'), '{vnx_cmp_group:t=room-grid}');
  assert.equal(textOf('r1l'), '{vnx_cmp_row:t=room-grid}');
  assert.equal(textOf('abt'), '{vnx_cmp_button:t=room-grid:p=1}');
});

test('a title that is not the stored name stays the name slot, and a ribbon on the last column stays', () => {
  const parsed = parseCompareData(payloadOf({
    id: 'seat-grid',
    unit: '/wk',
    button: 'Order',
    packages: [
      { id: 's1', name: 'Alpha', price: 12000, cycle: 'Year', total: 144000, link: 'https://example.com/a' },
      { id: 's2', name: 'Beta', price: 24000, cycle: 'Year', total: 288000, link: 'https://example.com/b' },
    ],
    groups: [{ id: 'g', label: 'Power', rows: [
      { id: 'w', label: 'Watts', desc: '', values: [{ package: 's1', value: 'yes' }, { package: 's2', value: 'no' }] },
      { id: 'p', label: 'Plug', desc: '', values: [{ package: 's1', value: 'Twin', type: 'text' }, { package: 's2', value: 'Single', type: 'text' }] },
    ] }],
  }));
  const tree = treeOf({
    left: { name: 'Plan A', price: '12.000', total: '144.000' },
    right: { name: 'Plan B', price: '24.000', total: '288.000' },
    unit: '/wk', button: 'Order', cycle: 'Year', group: 'Power', rowA: 'Watts', rowB: 'Plug', more: 'Open list', badge: 'Popular',
  });
  const result = built(parsed.table, tree);
  const textOf = (id) => result.template.content.find((item) => item.id === result.mapping[id].bricksId).settings.text;
  assert.equal(textOf('an'), '{vnx_cmp_name:t=seat-grid:p=1}');
  assert.equal(textOf('bn'), '{vnx_cmp_name:t=seat-grid:p=2}');
  assert.equal(String(textOf('badge')).includes('vnx_cmp_name'), false);
});

test('a later group longer than four rows gets a more control when the frame draws none', () => {
  const rows = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'].map((label, index) => ({
    id: `n${index}`, label, desc: '', values: [{ package: 'd1', value: 'yes', type: 'yes' }, { package: 'd2', value: 'no', type: 'no' }],
  }));
  const parsed = parseCompareData(payloadOf({
    id: 'lane-board',
    unit: '/day',
    button: 'Book',
    packages: [
      { id: 'd1', name: 'Desk', price: 3000, cycle: 'Week', total: 21000, link: 'https://example.com/desk' },
      { id: 'd2', name: 'Room', price: 8000, cycle: 'Week', total: 56000, link: 'https://example.com/room' },
    ],
    groups: [
      { id: 'short', label: 'Power', rows: [rows[0]] },
      { id: 'long', label: 'Net', rows },
    ],
  }));
  const tree = treeOf({
    left: { name: 'Desk', price: '3.000', total: '21.000' },
    right: { name: 'Room', price: '8.000', total: '56.000' },
    unit: '/day', button: 'Book', cycle: 'Week', group: 'Power', rowA: 'Watts', rowB: 'Plug', more: '',
  });
  const result = built(parsed.table, tree);
  const button = result.template.content.find((item) => item.settings?._attributes?.some((attr) => attr.name === 'data-vnx-cmp-more'));
  assert.equal(button.settings._conditions[0][0].value, '4');
  assert.equal(result.template.content.some((item) => item.settings?.text === 'Xem thêm'), true);
});

test('a matrix is asked as a comparison table, and a card row stays a price table', () => {
  const matrix = treeOf({
    left: { name: 'Starter', price: '10.000', total: '20.000' },
    right: { name: 'Growth', price: '30.000', total: '40.000' },
    unit: '/tháng', button: 'Order', cycle: 'Year', group: 'Storage', rowA: 'Disk', rowB: 'Backup', more: 'Show rest',
  });
  assert.equal(compareFrames(matrix).length, 1);
  assert.equal(priceFrames(matrix).length, 0);
  const cards = normalizeRoot({ nodes: { r: { document: frame('r', 'Rates', [0, 0, 400, 120], [
    frame('c1', 'card', [0, 0, 160, 80], [text('n1', 'Basic'), text('p1', '10.000 đ'), text('u1', '/tháng')], { layoutMode: 'VERTICAL' }),
    frame('c2', 'card', [180, 0, 160, 80], [text('n2', 'Plus'), text('p2', '20.000 đ'), text('u2', '/tháng')], { layoutMode: 'VERTICAL' }),
  ], { layoutMode: 'HORIZONTAL' }) } } }, 'r', { images: {}, svgs: {} });
  assert.equal(compareFrames(cards).length, 0);
  assert.equal(priceFrames(cards).length, 1);
});

test('the plan id is an enum and travels with the table', () => {
  assert.deepEqual(choiceOf('compare', 'room-grid'), { choice: 'id', id: 'room-grid' });
  assert.equal(choiceOf('compare', 'Room Grid'), null);
  const files = {
    'tree.json': { id: 'r', children: [] },
    'detections.json': { components: [] },
    'overrides.json': { nodes: {} },
  };
  const ws = { readJson: (name, fallback) => files[name] ?? fallback, writeJson: (name, value) => { files[name] = value; } };
  applyAnswers(ws, { 'compare:r': 'room-grid' });
  const entry = files['detections.json'].components.find((item) => item.component === 'compare-table');
  assert.equal(entry.params.id, 'room-grid');
  assert.equal(entry.status, 'approved');
  const table = { packages: [{ name: 'Desk' }], groups: [] };
  const carried = carryCompareTables(
    { components: [{ id: 'desk', component: 'compare-table', status: 'approved', node: 'desk-box', params: { id: 'room-grid', table } }] },
    { components: [{ id: 'local', component: 'compare-table', status: 'approved', node: 'phone-box', params: { id: 'other' } }, { id: 'keep', component: 'button', status: 'approved', node: 'phone-btn', params: {} }] },
    new Map([['phone-box', 'desk-box']]),
    'phone',
  );
  const compare = carried.components.find((item) => item.component === 'compare-table');
  assert.equal(compare.node, 'phone-box');
  assert.equal(compare.params.table, table);
  assert.equal(carried.components.find((item) => item.component === 'button').id, 'keep');
  assert.equal(BUY_BUTTON_FIELDS.find((field) => field.id === 'href').value, '{vnx_cmp_link}');
});
