import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { detectTabs } from '../modules/recognize-parts/rules/tabs.mjs';
import { detectTabSwitches } from '../modules/recognize-parts/rules/tab-switch.mjs';
import { switchInventory, tabQuestions } from '../modules/write-bricks/components/tab-switch.mjs';
import { tabDataFrame } from '../modules/single-template/tab-frames.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { decide } from '../modules/approve-parts/index.mjs';
import { screenParts } from '../modules/single-template/parts.mjs';

const box = (x, y, w, h) => ({ x, y, width: w, height: h });
const text = (id, value, rgb) => ({
  id, name: id, type: 'TEXT', characters: value,
  absoluteBoundingBox: box(0, 0, 80, 22),
  style: { fontFamily: 'Roboto', fontSize: 15, fontWeight: 500, lineHeightPx: 22 },
  fills: [{ type: 'SOLID', color: { r: rgb[0], g: rgb[1], b: rgb[2], a: 1 } }],
});
const frame = (id, name, rect, children, extra = {}) => ({
  id, name, type: 'FRAME', absoluteBoundingBox: box(rect[0], rect[1], rect[2], rect[3]), children, ...extra,
});

function priceTable() {
  const tab = (id, label, rgb, fill) => frame(id, 'Tab', [0, 0, 160, 38], [text(`${id}t`, label, rgb)], fill ? { fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }] } : {});
  return normalizeRoot({ nodes: { r: { document: frame('r', '_price-table', [0, 0, 375, 600], [
    text('h', 'Dịch vụ', [0.1, 0.1, 0.1]),
    frame('period', '_Period', [16, 80, 343, 200], [
      frame('list', 'Tab List', [0, 0, 343, 48], [tab('t1', 'VPS NVMe', [0.22, 0.65, 1], true), tab('t2', 'VPS SSD', [1, 1, 1], false)], { layoutMode: 'HORIZONTAL' }),
      frame('chips', 'period-bar', [0, 64, 343, 80], [text('c1', '1 Tháng', [1, 1, 1]), text('c2', '3 Tháng', [1, 1, 1])], { layoutMode: 'HORIZONTAL' }),
    ], { layoutMode: 'VERTICAL' }),
    frame('card', 'Price-card', [16, 300, 343, 200], [
      frame('panel', 'Tab Panel - 1 of 2', [0, 0, 327, 180], [text('pn', 'VPS NVME 1', [0.2, 0.2, 0.3])], { layoutMode: 'VERTICAL' }),
    ], { layoutMode: 'VERTICAL' }),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
}

test('a tab list directly above its panel stays the tabs component', () => {
  const tab = (id) => frame(id, 'Tab', [0, 0, 140, 36], [text(`${id}t`, id, [0, 0, 0])], { componentSet: 'Tab' });
  const tree = normalizeRoot({ nodes: { r: { document: frame('wrap', 'Period', [0, 0, 300, 200], [
    frame('bar', 'Tab List', [0, 0, 300, 48], [tab('a'), tab('b')], { layoutMode: 'HORIZONTAL' }),
    frame('content', 'Content', [0, 60, 300, 100], [text('c1', 'Pane', [0, 0, 0])]),
  ]) } } }, 'r', { images: {}, svgs: {} });
  assert.equal(detectTabs(tree)[0]?.node, 'wrap');
  assert.deepEqual(detectTabSwitches(tree), []);
});

test('a tab list with its panel elsewhere is a tab switch, and the period bar is not the pane', () => {
  const tree = priceTable();
  assert.deepEqual(detectTabs(tree), []);
  const [found] = detectTabSwitches(tree);
  assert.equal(found.component, 'tab-switch');
  assert.equal(found.node, 'r');
});

test('clicking a title switches the pane, and the drawn pill follows the open title', () => {
  const tree = priceTable();
  const detections = { components: [{ id: 'd1', status: 'approved', component: 'tab-switch', node: 'r', params: { content: { panes: { t2: 'Gói SSD' } } } }] };
  const built = buildTemplate(tree, { overrides: {}, detections, salt: 'switch' });
  const el = (id) => built.template.content.find((e) => e.id === built.mapping[id].bricksId);
  assert.equal(el('r').name, 'tabs-nested');
  assert.equal(el('r').settings.openTab, '0');
  assert.match(el('r').settings._cssCustom, /#brxe-\w+ \.tab-pane \{ display: none; \}/);
  assert.match(el('r').settings._cssCustom, / \.tab-pane\.brx-open \{ display: flex; \}/);
  assert.match(el('r').settings._cssCustom, /:not\(:has\(\.tab-pane\.brx-open\)\) \.tab-pane:first-child \{ display: flex; \}/);
  assert.match(el('r').settings._cssCustom, / \.tab-title \{ width: auto; \}/);
  assert.equal(el('list').settings._hidden._cssClasses, 'tab-menu');
  assert.equal(el('t1').settings._hidden._cssClasses, 'tab-title brx-open');
  assert.equal(el('t2').settings._hidden._cssClasses, 'tab-title');
  assert.equal(el('t1').settings._background, undefined);
  assert.match(el('list').settings._cssCustom, /\.tab-title\.brx-open \{ background-color: #ffffff; \}/);
  assert.match(el('list').settings._cssCustom, /\.tab-title \{ background-color: transparent; \}/);
  assert.equal(el('panel').settings._hidden._cssClasses, 'tab-pane brx-open');
  assert.match(el('panel').settings._cssCustom, /\.brx-open \{ display: flex; \}/);
  assert.equal(el('chips').settings._hidden, undefined);
  const extra = built.template.content.find((e) => e.parent === el('card').id && e.label === 'Pane 2');
  assert.equal(extra.settings._hidden._cssClasses, 'tab-pane');
  assert.equal(built.template.content.find((e) => e.parent === extra.id).settings.text, 'Gói SSD');
});

function osDesktop() {
  const tab = (id, label, extra = {}) => frame(id, 'Linux tab', [0, 0, 110, 36], [text(`${id}t`, label, [1, 1, 1])], { layoutMode: 'HORIZONTAL', ...extra });
  return normalizeRoot({ nodes: { r: { document: frame('r', 'OPERATING SYSTEM', [0, 0, 1440, 400], [
    frame('title', '_Title', [0, 0, 1440, 80], [text('h', 'HỆ ĐIỀU HÀNH', [1, 1, 1])], { layoutMode: 'VERTICAL' }),
    frame('bar', '_log-update', [400, 100, 306, 36], [
      tab('linux', 'LINUX OS', { visible: false }),
      tab('win', 'WINDOW OS', { strokes: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], strokeWeight: 1, individualStrokeWeights: { top: 0, right: 0, bottom: 4, left: 0 } }),
      tab('ctl', 'CONTROL PANEL'),
    ], { layoutMode: 'HORIZONTAL' }),
    frame('content', 'Frame', [0, 160, 1140, 180], [], { layoutMode: 'HORIZONTAL' }),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
}

test('a later drawn title is the open tab', () => {
  const tab = (id, label, fill) => frame(id, 'Tab', [0, 0, 160, 38], [text(`${id}t`, label, [1, 1, 1])], fill ? { fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }] } : {});
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'OPERATING SYSTEM', [0, 0, 400, 240], [
    text('h', 'OS', [0.1, 0.1, 0.1]),
    frame('list', 'Tab List', [0, 40, 400, 40], [tab('t1', 'One', false), tab('t2', 'Two', true)], { layoutMode: 'HORIZONTAL' }),
    frame('content', 'Panels', [0, 100, 400, 80], [
      frame('p1', 'Tab Panel', [0, 0, 400, 80], [text('a', 'First', [0, 0, 0])], { layoutMode: 'VERTICAL' }),
      frame('p2', 'Tab Panel', [0, 0, 400, 80], [text('b', 'Second', [0, 0, 0])], { layoutMode: 'VERTICAL' }),
    ], { layoutMode: 'VERTICAL' }),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, { overrides: {}, detections: { components: [{ id: 'd1', status: 'approved', component: 'tab-switch', node: 'r', params: {} }] }, salt: 'later' });
  const el = (id) => built.template.content.find((e) => e.id === built.mapping[id].bricksId);
  assert.equal(el('r').settings.openTab, '1');
  assert.equal(el('t2').settings._hidden._cssClasses, 'tab-title brx-open');
  assert.equal(el('t1').settings._hidden._cssClasses, 'tab-title');
  assert.equal(el('p2').settings._hidden._cssClasses, 'tab-pane brx-open');
  assert.equal(el('p1').settings._hidden._cssClasses, 'tab-pane');
});

test('a row of named tabs with an empty frame under it is listed, including a link field', () => {
  const tree = osDesktop();
  const found = detectTabSwitches(tree);
  assert.equal(found.length, 1);
  assert.equal(found[0].node, 'r');
  const files = {
    'tree.json': tree,
    'facts.json': { repeats: [] },
    'overrides.json': { nodes: {} },
    'detections.json': { components: found.map((c, i) => ({ id: `d${i}`, status: 'proposed', source: 'rule', ...c })) },
  };
  const result = decide({ readJson: (n, fb) => files[n] ?? fb, writeJson: (n, v) => { files[n] = v; } }, {});
  const labels = result.questions.filter((q) => q.group === 'pane').map((q) => q.label);
  assert.equal(labels.length, 2);
  assert.match(labels[0], /WINDOW OS/);
  assert.match(labels[0], /chưa vẽ nội dung/);
  assert.match(labels[1], /CONTROL PANEL/);
  assert.equal(labels.some((l) => /LINUX OS/.test(l)), false);
  const parts = screenParts(tree, files['detections.json'].components, result.questions.map((q) => ({ ...q, label: q.label, key: `pane:${q.node}` })), 'FILE');
  const tab = parts.find((p) => p.kind === 'Tabs Component');
  assert.equal(tab.fields.length, 2);
  assert.match(tab.fields[0].title, /WINDOW OS/);
  assert.match(tab.fields[0].title, /chưa vẽ nội dung/);
  assert.match(tab.note, /link khung/);
  const built = buildTemplate(tree, { overrides: {}, detections: files['detections.json'], salt: 'os' });
  const el = (id) => built.template.content.find((e) => e.id === built.mapping[id].bricksId);
  assert.equal(el('r').name, 'tabs-nested');
  assert.equal(el('win').settings._hidden._cssClasses, 'tab-title brx-open');
  assert.equal(el('ctl').settings._hidden._cssClasses, 'tab-title');
  assert.equal(el('linux'), undefined);
  assert.equal(el('content').settings._hidden._cssClasses, 'tab-content');
  assert.match(el('bar').settings._cssCustom, /box-shadow: inset 0 -4px 0 #ffffff/);
});

test('repeated items under the buttons belong to the one open tab', () => {
  const tab = (id, label, extra = {}) => frame(id, 'Linux tab', [0, 0, 110, 36], [text(`${id}t`, label, [1, 1, 1])], { layoutMode: 'HORIZONTAL', ...extra });
  const os = (id) => frame(id, 'os', [0, 0, 180, 140], [{ id: `${id}v`, name: 'mark', type: 'VECTOR', absoluteBoundingBox: box(0, 0, 40, 40) }], { layoutMode: 'VERTICAL' });
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'OPERATING SYSTEM', [0, 0, 1440, 400], [
    frame('bar', '_log-update', [0, 80, 306, 36], [
      tab('win', 'WINDOW OS', { strokes: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], strokeWeight: 1, individualStrokeWeights: { top: 0, right: 0, bottom: 4, left: 0 } }),
      tab('ctl', 'CONTROL PANEL'),
    ], { layoutMode: 'HORIZONTAL' }),
    frame('slot', 'Frame', [0, 140, 1140, 180], [os('a'), os('b'), os('c'), os('d'), os('e')], { layoutMode: 'HORIZONTAL' }),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
  const rows = switchInventory(tree);
  assert.equal(rows[0].active, true);
  assert.equal(rows[0].drawn, '5 item "os"');
  assert.equal(rows[1].drawn, '');
  assert.equal(tabQuestions(tree).length, 0);
  const files = {
    'tree.json': tree,
    'facts.json': { repeats: [] },
    'overrides.json': { nodes: {} },
    'detections.json': { components: detectTabSwitches(tree).map((c, i) => ({ id: `d${i}`, status: 'proposed', source: 'rule', ...c })) },
  };
  const result = decide({ readJson: (n, fb) => files[n] ?? fb, writeJson: (n, v) => { files[n] = v; } }, {});
  const labels = result.questions.filter((q) => q.group === 'pane').map((q) => q.label);
  assert.match(labels[0], /WINDOW OS/);
  assert.match(labels[0], /5 item "os"/);
  assert.match(labels[1], /CONTROL PANEL/);
  assert.match(labels[1], /chưa vẽ nội dung/);
  assert.equal(result.questions.some((q) => q.group === 'tabopen'), false);
});

test('two open buttons are asked, and the items are not assigned', () => {
  const tab = (id, label) => frame(id, 'Linux tab', [0, 0, 110, 36], [text(`${id}t`, label, [1, 1, 1])], {
    layoutMode: 'HORIZONTAL',
    strokes: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
    strokeWeight: 1,
    individualStrokeWeights: { top: 0, right: 0, bottom: 4, left: 0 },
  });
  const os = (id) => frame(id, 'os', [0, 0, 80, 40], [{ id: `${id}v`, name: 'mark', type: 'VECTOR', absoluteBoundingBox: box(0, 0, 20, 20) }]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'OS', [0, 0, 400, 200], [
    frame('bar', '_log-update', [0, 0, 220, 36], [tab('win', 'WINDOW OS'), tab('ctl', 'CONTROL PANEL')], { layoutMode: 'HORIZONTAL' }),
    frame('slot', 'Frame', [0, 40, 300, 80], [os('a'), os('b')], { layoutMode: 'HORIZONTAL' }),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
  assert.equal(switchInventory(tree).every((row) => !row.drawn), true);
  const asked = tabQuestions(tree);
  assert.equal(asked[0].group, 'tabopen');
  assert.match(asked[0].label, /WINDOW OS/);
  assert.match(asked[0].label, /CONTROL PANEL/);
});

test('a linked frame keeps the repeated items and drops a caption', () => {
  const os = (id, name) => ({ id, name, type: 'FRAME', children: [{ id: `${id}v`, name: 'mark', type: 'VECTOR' }] });
  const section = {
    id: 'big', children: [
      { id: 'bar', name: '_log-update', type: 'FRAME', layout: { mode: 'HORIZONTAL' }, box: { x: 0, y: 0, w: 200, h: 36, absX: 0, absY: 0 }, children: [
        { id: 't', name: 'Linux tab', type: 'FRAME', box: { x: 0, y: 0, w: 80, h: 36, absX: 0, absY: 0 }, children: [{ id: 'tt', type: 'TEXT', text: { characters: 'CONTROL PANEL' } }] },
        { id: 'u', name: 'Linux tab', type: 'FRAME', box: { x: 90, y: 0, w: 80, h: 36, absX: 90, absY: 0 }, children: [{ id: 'uu', type: 'TEXT', text: { characters: 'Khác' } }] },
      ] },
      { id: 'slot', name: 'Frame', type: 'FRAME', box: { x: 0, y: 40, w: 400, h: 140, absX: 0, absY: 40 }, children: [
        { id: 'cap', name: 'Caption', type: 'TEXT', text: { characters: 'nhãn' } },
        os('a', 'os'), os('b', 'os'), os('c', 'os'),
      ] },
    ],
  };
  const data = tabDataFrame(section);
  assert.equal(data.id, 'slot');
  assert.deepEqual(data.children.map((n) => n.id), ['a', 'b', 'c']);
});

test('stacked tab titles on a mobile frame are not a tab switch', () => {
  const tab = (id, label, y) => frame(id, 'Linux tab', [16, y, 200, 36], [text(`${id}t`, label, [1, 1, 1])], { layoutMode: 'HORIZONTAL' });
  const tree = normalizeRoot({ nodes: { r: { document: frame('r', 'OPERATING SYSTEM', [0, 0, 375, 700], [
    frame('title', '_Title', [0, 0, 375, 80], [text('h', 'HỆ ĐIỀU HÀNH', [1, 1, 1])], { layoutMode: 'VERTICAL' }),
    tab('linux', 'LINUX OS', 90),
    frame('logos1', 'Logo', [0, 140, 375, 80], [text('a', 'AlmaLinux', [1, 1, 1])], { visible: false, layoutMode: 'HORIZONTAL' }),
    tab('win', 'WINDOW OS', 230),
    frame('logos2', 'Logo', [0, 280, 375, 80], [], { layoutMode: 'HORIZONTAL' }),
    tab('ctl', 'CONTROL PANEL', 370),
    frame('logos3', 'Logo', [0, 420, 375, 80], [{ id: 'v', name: 'mark', type: 'VECTOR', absoluteBoundingBox: box(0, 0, 24, 24) }], { layoutMode: 'HORIZONTAL' }),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
  tree.children.find((n) => n.id === 'linux').visible = false;
  assert.deepEqual(detectTabSwitches(tree), []);
  assert.equal(detectTabs(tree).length, 0);
});
