import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { detectTabs } from '../modules/recognize-parts/rules/tabs.mjs';
import { detectTabSwitches } from '../modules/recognize-parts/rules/tab-switch.mjs';
import { detectForms } from '../modules/recognize-parts/rules/form.mjs';
import { detectMenus } from '../modules/recognize-parts/rules/menu.mjs';
import { switchInventory, tabQuestions } from '../modules/write-bricks/components/tab-switch.mjs';
import { tabDataFrame } from '../modules/single-template/tab-frames.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { decide, writeDecisionReport } from '../modules/approve-parts/index.mjs';
import { detectStep } from '../modules/build-steps/03-detect.mjs';
import { groupQuestions, GROUPS, keyOf } from '../modules/missing-content/index.mjs';
import { planInventory, screenParts, sectionBlocks } from '../modules/single-template/parts.mjs';
import { renderTemplatePlan } from '../modules/single-template/plan-doc.mjs';

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

test('a tab row inside the panel under another tab row is a nested tab', () => {
  const title = (id, label, on) => frame(id, 'Tab', [0, 0, 80, 32], [text(`${id}t`, label, [0, 0, 0])], on ? { fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }] } : {});
  const card = (id, label) => frame(id, 'Card', [0, 0, 120, 80], [
    text(`${id}a`, label, [0, 0, 0]),
    text(`${id}b`, 'Detail', [0, 0, 0]),
  ], { layoutMode: 'VERTICAL' });
  const tree = normalizeRoot({ nodes: { r: { document: frame('outer', 'Plans', [0, 0, 600, 440], [
    frame('heading', 'Heading', [0, 0, 200, 28], [text('h', 'Choose', [0, 0, 0])]),
    frame('products', 'Tab List', [0, 40, 200, 40], [title('alpha', 'Alpha', true), title('beta', 'Beta', false)], { layoutMode: 'HORIZONTAL' }),
    frame('body', 'Body', [0, 90, 600, 300], [
      frame('slot', 'Slot', [0, 0, 280, 36], [
        frame('when', 'Tab List', [0, 0, 280, 36], [title('now', 'Now', true), title('soon', 'Soon', false), title('later', 'Later', false)], { layoutMode: 'HORIZONTAL' }),
      ], { layoutMode: 'VERTICAL' }),
      frame('grid', 'Grid', [0, 48, 600, 200], [card('c1', 'One'), card('c2', 'Two'), card('c3', 'Three'), card('c4', 'Four')], { layoutMode: 'HORIZONTAL' }),
    ], { layoutMode: 'VERTICAL' }),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
  const found = detectTabSwitches(tree);
  const hosts = found.map((item) => item.node).sort();
  assert.deepEqual(hosts, ['body', 'outer']);
  const built = buildTemplate(tree, { overrides: {}, detections: { components: found.map((item, i) => ({ id: `d${i}`, status: 'approved', ...item })) }, salt: 'nest' });
  const el = (id) => built.template.content.find((entry) => entry.id === built.mapping[id].bricksId);
  assert.equal(el('outer').name, 'tabs-nested');
  assert.equal(el('body').name, 'tabs-nested');
  assert.equal(el('c1').settings._hidden, undefined);
  assert.equal(el('c2').settings._hidden, undefined);
  assert.equal(el('c3').settings._hidden, undefined);
  assert.equal(el('c4').settings._hidden, undefined);
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

test('an unnamed row with one selected control and the cards under it is a tab', () => {
  const control = (id, label, selected) => frame(id, 'Frame 2147225719', [0, 0, 200, 48], [text(`${id}t`, label, selected ? [1, 0.43, 0] : [0.2, 0.25, 0.33])], {
    layoutMode: 'HORIZONTAL',
    fills: [{ type: 'SOLID', color: selected ? { r: 1, g: 0.96, b: 0.96, a: 1 } : { r: 1, g: 1, b: 1, a: 1 } }],
    componentProperties: { 'Property 1': { type: 'VARIANT', value: selected ? 'Selected' : 'Default' } },
  });
  const card = (id, title) => frame(id, 'ServiceCard', [0, 0, 260, 180], [text(`${id}t`, title, [0.1, 0.1, 0.1])], { layoutMode: 'VERTICAL' });
  const tree = normalizeRoot({ nodes: { r: { document: frame('host', '_Title', [0, 0, 1140, 600], [
    frame('head', 'Header', [0, 0, 1140, 80], [text('h', 'VPS', [0.1, 0.1, 0.1])], { layoutMode: 'VERTICAL' }),
    frame('bar', 'Frame 2147225732', [0, 220, 1140, 66], [control('linux', 'LINUX', false), control('win', 'WINDOWS', true)], { layoutMode: 'HORIZONTAL' }),
    frame('data', 'Service Section', [0, 300, 1140, 260], [card('c1', 'NVME'), card('c2', 'SSD')], { layoutMode: 'HORIZONTAL' }),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
  assert.equal(detectTabs(tree).length, 0);
  const found = detectTabSwitches(tree);
  assert.equal(found.length, 1);
  assert.equal(found[0].node, 'host');
  const rows = switchInventory(tree);
  assert.equal(rows[1].label, 'WINDOWS');
  assert.equal(rows[1].active, true);
  assert.match(rows[1].drawn, /2 item/);
  assert.equal(rows[0].drawn, '');
});

test('the open title moves the radio check with the background', () => {
  const radio = (id, on) => frame(id, 'Radio', [0, 0, 20, 20], on ? [frame(`${id}c`, 'Check', [6, 6, 8, 8], [], { fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }] })] : [], {
    strokes: [{ type: 'SOLID', color: on ? { r: 1, g: 0.525, b: 0.161, a: 1 } : { r: 0.9, g: 0.91, b: 0.92, a: 1 } }],
    strokeWeight: 1,
    ...(on ? { fills: [{ type: 'SOLID', color: { r: 1, g: 0.525, b: 0.161, a: 1 } }] } : {}),
    componentProperties: { Checked: { type: 'VARIANT', value: on ? 'True' : 'False' } },
  });
  const control = (id, label, on) => frame(id, 'Frame 2147225719', [0, 0, 200, 64], [
    text(`${id}t`, label, on ? [1, 0.435, 0] : [0.2, 0.255, 0.333]),
    radio(`${id}r`, on),
  ], {
    layoutMode: 'HORIZONTAL',
    fills: [{ type: 'SOLID', color: on ? { r: 1, g: 0.965, b: 0.957, a: 1 } : { r: 1, g: 1, b: 1, a: 1 } }],
    strokes: [{ type: 'SOLID', color: on ? { r: 1, g: 0.886, b: 0.8, a: 1 } : { r: 0.9, g: 0.906, b: 0.922, a: 1 } }],
    strokeWeight: 1,
    paddingTop: 16, paddingRight: 20, paddingBottom: 16, paddingLeft: 20,
    componentProperties: { 'Property 1': { type: 'VARIANT', value: on ? 'Selected' : 'Default' } },
  });
  const tree = normalizeRoot({ nodes: { r: { document: frame('host', '_Title', [0, 0, 1140, 400], [
    frame('bar', 'Frame 2147225732', [0, 80, 1140, 64], [control('linux', 'LINUX', false), control('win', 'WINDOWS', true)], { layoutMode: 'HORIZONTAL' }),
    frame('data', 'Service Section', [0, 160, 1140, 200], [frame('c1', 'ServiceCard', [0, 0, 200, 160], [text('n', 'NVME', [0.1, 0.1, 0.1])])], { layoutMode: 'HORIZONTAL' }),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, { overrides: {}, detections: { components: [{ id: 'd1', status: 'approved', component: 'tab-switch', node: 'host', params: {} }] }, salt: 'radio' });
  const el = (id) => built.template.content.find((e) => e.id === built.mapping[id].bricksId);
  const attr = (node, name) => el(node).settings._attributes.find((a) => a.name === name).value;
  assert.equal(el('win').settings._hidden._cssClasses, 'tab-title brx-open');
  assert.equal(attr('winr', 'aria-checked'), 'true');
  assert.equal(attr('linuxr', 'aria-checked'), 'false');
  assert.equal(attr('winr', 'data-f2b-check'), 'radio');
  assert.match(el('linux').settings._cssCustom, /\.brx-open \.f2b-s-1 \{[^}]*background-color: #ff8629 !important/);
  assert.match(el('linux').settings._cssCustom, /\.brx-open \.f2b-on \{ display: block !important/);
  assert.match(el('win').settings._cssCustom, /border-color: #ffe2cc !important/);
  const clone = built.template.content.find((e) => e.label === 'Check' && e.id !== el('winrc').id);
  assert.equal(clone.parent, el('linuxr').id);
  assert.equal(clone.settings._cssClasses, 'f2b-on');
  assert.equal(clone.settings._width, '8px');
  assert.equal(clone.settings._height, '8px');
  assert.equal(el('linuxr').settings._position, 'relative');
  assert.match(built.template.scripts[0], /aria-checked/);
  assert.match(built.template.scripts[0], /input\.checked/);
});

test('a pill row with one gradient chip, nested under the title, switches the frame below', () => {
  const rest = { fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 0.6 } }] };
  const gradient = { fills: [{ type: 'GRADIENT_LINEAR', gradientHandlePositions: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0, y: 1 }], gradientStops: [{ position: 0, color: { r: 0, g: 0.486, b: 0.988, a: 1 } }, { position: 1, color: { r: 0, g: 0.392, b: 0.8, a: 1 } }] }] };
  const chip = (id, label, y, extra = {}, badge = false) => frame(id, '_period-bar-item-Ver 11.2024', [0, y, 218, 36], [
    text(`${id}t`, label, extra === gradient ? [1, 1, 1] : [0.322, 0.337, 0.4]),
    ...(badge ? [frame(`${id}b`, 'recom.svg', [140, y, 81, 22], [])] : []),
  ], { layoutMode: 'HORIZONTAL', ...extra });
  const tree = normalizeRoot({ nodes: { r: { document: frame('title', '_Title', [0, 0, 1140, 700], [
    frame('head', 'Header', [0, 0, 1140, 64], [text('h', 'Dịch vụ', [0.1, 0.1, 0.1])]),
    frame('period', '_Period', [0, 80, 1140, 52], [
      frame('wrap', 'period-bar', [0, 80, 1140, 52], [
        frame('list', '_period-list', [8, 88, 1124, 36], [
          chip('a', 'FIRE WALL ANTI DDOS', 88, gradient),
          chip('b', 'EMAIL', 88, rest),
          chip('c', 'SSL', 88, rest),
          chip('d', 'MÁY CHỦ', 88, rest),
          chip('e', 'TỐI ƯU TỐC ĐỘ', 88, rest, true),
        ], { layoutMode: 'HORIZONTAL' }),
      ]),
    ]),
    frame('data', 'Cards', [0, 150, 1140, 400], [
      frame('left', 'Paragraph', [0, 150, 360, 400], [text('lt', 'list', [0, 0, 0])]),
      frame('right', 'Paragraph', [0, 150, 700, 400], [text('rt', 'cards', [0, 0, 0])]),
    ], { layoutMode: 'HORIZONTAL' }),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
  assert.equal(detectForms(tree).some((f) => f.node === 'list'), false);
  assert.equal(detectMenus(tree).some((f) => f.node === 'list'), false);
  const found = detectTabSwitches(tree);
  assert.equal(found.length, 1);
  assert.equal(found[0].node, 'title');
  const next = { id: 'next', name: 'Next', type: 'FRAME', visible: true, box: { x: 0, y: 800, w: 1440, h: 400, absX: 0, absY: 800 }, children: [] };
  const page = { id: 'page', name: 'Homepage', type: 'FRAME', visible: true, layout: { mode: 'VERTICAL' }, box: { x: 0, y: 0, w: 1440, h: 1600, absX: 0, absY: 0 }, children: [tree, next] };
  assert.equal(detectTabSwitches(page)[0].node, 'title');
  const rows = switchInventory(tree);
  assert.equal(rows[0].label, 'FIRE WALL ANTI DDOS');
  assert.equal(rows[0].active, true);
  assert.match(rows[0].drawn, /2 item/);
  assert.equal(rows[1].drawn, '');
  const built = buildTemplate(tree, { overrides: {}, detections: { components: [{ id: 'd1', status: 'approved', component: 'tab-switch', node: 'title', params: {} }] }, salt: 'period' });
  const el = (id) => built.template.content.find((e) => e.id === built.mapping[id].bricksId);
  assert.equal(el('a').settings._hidden._cssClasses, 'tab-title brx-open');
  assert.equal(el('b').settings._hidden._cssClasses, 'tab-title');
  assert.match(el('list').settings._cssCustom, /linear-gradient\(/);
  assert.match(el('list').settings._cssCustom, /#007cfc/);
  assert.equal(el('a').settings._gradient, undefined);
});

test('a service bar with State=Active and a divider, nested in the header, switches the wrapper below', () => {
  const item = (id, label, state, rgb, w) => frame(id, 'Services Bar', [0, 210, w, 40], [text(`${id}t`, label, rgb)], {
    layoutMode: 'HORIZONTAL',
    componentProperties: { State: { type: 'VARIANT', value: state } },
    ...(state === 'Active' ? { fills: [{ type: 'SOLID', color: { r: 0.988, g: 0.988, b: 0.988, a: 1 } }] } : {}),
  });
  const divider = { id: 'div', name: 'Vector', type: 'VECTOR', absoluteBoundingBox: box(200, 224, 1, 12) };
  const tree = normalizeRoot({ nodes: { r: { document: frame('title', '_Title', [0, 0, 1140, 800], [
    frame('head', 'Header', [0, 0, 1140, 292], [
      frame('period', '_Period', [0, 200, 1140, 64], [
        frame('bar', 'Service Bar', [0, 210, 360, 48], [item('store', 'Lưu trữ', 'Active', [0, 0.486, 0.988], 195), divider, item('speed', 'Tốc độ cao', 'Default', [0.157, 0.157, 0.161], 133)], { layoutMode: 'HORIZONTAL' }),
      ]),
    ]),
    frame('wrap', 'Lưu trữ wrapper', [0, 300, 1140, 470], [
      frame('body', 'Paragraph', [0, 300, 1140, 390], [text('body', 'gói', [0, 0, 0])]),
    ]),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
  const found = detectTabSwitches(tree);
  assert.equal(found.length, 1);
  assert.equal(found[0].node, 'title');
  const rows = switchInventory(tree);
  assert.equal(rows[0].label, 'Lưu trữ');
  assert.equal(rows[0].active, true);
  assert.equal(rows[1].label, 'Tốc độ cao');
  assert.equal(rows[1].drawn, '');
  const alone = normalizeRoot({ nodes: { r: { document: frame('bar', 'Service Bar', [0, 0, 360, 48], [item('store', 'Lưu trữ', 'Active', [0, 0.486, 0.988], 195), divider, item('speed', 'Tốc độ cao', 'Default', [0.157, 0.157, 0.161], 133)], { layoutMode: 'HORIZONTAL' }) } } }, 'r', { images: {}, svgs: {} });
  assert.equal(detectTabSwitches(alone)[0].node, 'bar');
});

test('a row of price cards, one of them on a gradient, is not a tab', () => {
  const card = (id, label, gradient) => frame(id, 'CardPrice-Hosting-Ver 1.1.25', [0, 0, 315, 410], [
    text(`${id}t`, label, [0.1, 0.1, 0.1]),
    text(`${id}p`, '560.000', [0.1, 0.1, 0.1]),
    text(`${id}c`, 'CPU: 1', [0.1, 0.1, 0.1]),
    text(`${id}r`, 'RAM: 2GB', [0.1, 0.1, 0.1]),
  ], gradient
    ? { fills: [{ type: 'GRADIENT_LINEAR', gradientHandlePositions: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0, y: 1 }], gradientStops: [{ position: 0, color: { r: 0, g: 0.5, b: 1, a: 1 } }, { position: 1, color: { r: 0, g: 0.3, b: 0.8, a: 1 } }] }] }
    : { fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }] });
  const tree = normalizeRoot({ nodes: { r: { document: frame('row', 'Frame', [0, 0, 1308, 410], [card('a', 'Gói 1', false), card('b', 'Gói 2', false), card('c', 'Gói 3', false), card('d', 'Tùy chỉnh', true)], { layoutMode: 'HORIZONTAL' }) } } }, 'r', { images: {}, svgs: {} });
  assert.deepEqual(detectTabSwitches(tree), []);
});

test('a tall row of single-label chips, one painted differently, is still a tab', () => {
  const chip = (id, label, gradient) => frame(id, 'chip', [0, 0, 180, 220], [text(`${id}t`, label, gradient ? [1, 1, 1] : [0.2, 0.2, 0.2])], gradient
    ? { fills: [{ type: 'GRADIENT_LINEAR', gradientHandlePositions: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0, y: 1 }], gradientStops: [{ position: 0, color: { r: 0, g: 0.49, b: 0.99, a: 1 } }, { position: 1, color: { r: 0, g: 0.39, b: 0.8, a: 1 } }] }] }
    : { fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 0.6 } }] });
  const tree = normalizeRoot({ nodes: { r: { document: frame('title', 'Block', [0, 0, 800, 600], [
    frame('bar', 'row', [0, 0, 760, 220], [chip('a', 'FIRE WALL', true), chip('b', 'EMAIL', false), chip('c', 'BACKUP', false)], { layoutMode: 'HORIZONTAL' }),
    frame('body', 'Frame', [0, 240, 760, 300], [text('body', 'nội dung', [0, 0, 0])]),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
  const found = detectTabSwitches(tree);
  assert.equal(found.length, 1);
  assert.equal(found[0].node, 'title');
  assert.equal(switchInventory(tree)[0].label, 'FIRE WALL');
  assert.equal(switchInventory(tree)[0].active, true);
});

test('a divider between two triggers makes the painted one a tab', () => {
  const item = (id, label, gradient) => frame(id, 'Item', [0, 0, 140, 40], [text(`${id}t`, label, [0.1, 0.1, 0.1])], gradient
    ? { fills: [{ type: 'GRADIENT_LINEAR', gradientHandlePositions: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0, y: 1 }], gradientStops: [{ position: 0, color: { r: 0, g: 0.49, b: 0.99, a: 1 } }, { position: 1, color: { r: 0, g: 0.39, b: 0.8, a: 1 } }] }] }
    : { fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }] });
  const pair = (withDivider) => frame('bar', 'row', [0, 0, 300, 40], withDivider
    ? [item('a', 'Lưu trữ', true), { id: 'div', name: 'Vector', type: 'VECTOR', absoluteBoundingBox: box(150, 14, 1, 12) }, item('b', 'Tốc độ', false)]
    : [item('a', 'Lưu trữ', true), item('b', 'Tốc độ', false)], { layoutMode: 'HORIZONTAL' });
  const bare = normalizeRoot({ nodes: { r: { document: pair(false) } } }, 'r', { images: {}, svgs: {} });
  assert.deepEqual(detectTabSwitches(bare), []);
  const split = normalizeRoot({ nodes: { r: { document: frame('title', 'Block', [0, 0, 400, 300], [
    pair(true),
    frame('body', 'Frame', [0, 48, 400, 200], [text('body', 'gói', [0, 0, 0])]),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
  assert.equal(detectTabSwitches(split)[0].node, 'title');
  assert.equal(switchInventory(split)[0].label, 'Lưu trữ');
  assert.equal(switchInventory(split)[0].active, true);
});

test('one underlined trigger with a pane under it is a line tab', () => {
  const link = (id, label, y, line) => frame(id, 'Link', [0, y, 80, 36], [text(`${id}t`, label, [0.1, 0.1, 0.1])], line ? { strokes: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1, a: 1 } }], strokeWeight: 1, individualStrokeWeights: { top: 0, right: 0, bottom: 2, left: 0 } } : {});
  const page = (sections) => normalizeRoot({ nodes: { r: { document: frame('page', 'Homepage', [0, 0, 1440, 800], [
    frame('header', 'Header', [0, 0, 1440, 80], [
      frame('nav', 'Nav', [0, 20, 200, 40], [link('home', 'Trang chủ', 20, true), link('about', 'Giới thiệu', 20, false)], { layoutMode: 'HORIZONTAL' }),
    ]),
    ...sections,
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
  const line = page([frame('hero', 'Hero', [0, 80, 1440, 500], [text('ht', 'Hero', [0, 0, 0])])]);
  assert.equal(detectTabSwitches(line)[0].node, 'page');
  assert.equal(switchInventory(line)[0].label, 'Trang chủ');
  assert.equal(switchInventory(line)[0].active, true);
  assert.equal(detectMenus(line).some((m) => m.node === 'nav'), false);
  const site = page([
    frame('hero', 'Hero', [0, 80, 1440, 500], [text('ht', 'Hero', [0, 0, 0])]),
    frame('next', 'Features', [0, 600, 1440, 400], [text('ft', 'Features', [0, 0, 0]), text('fd', 'More', [0, 0, 0])]),
  ]);
  assert.deepEqual(detectTabSwitches(site), []);
  assert.equal(detectMenus(site).some((m) => m.node === 'nav'), true);
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

function freshPlan(tree, fileKey) {
  const dir = mkdtempSync(join(tmpdir(), 'f2b-tab-plan-'));
  try {
    writeFileSync(join(dir, 'tree.json'), JSON.stringify(tree));
    const ws = detectStep(dir);
    const result = decide(ws, { firstSection: false, variant: false, parentBg: null, formErrors: {} });
    writeDecisionReport(ws, result, tree.name || 'tabs');
    detectStep(dir);
    const det = ws.readJson('detections.json');
    const questions = groupQuestions(result.questions ?? []).flatMap((g) => g.items.map((item) => ({
      group: g.group,
      title: GROUPS[g.group].title(1).replace(/ 1 /, ' '),
      summary: GROUPS[g.group].summary,
      node: item.node,
      label: item.label,
      key: keyOf(g.group, item.node),
      value: item.value != null && item.value !== '' ? String(item.value) : (GROUPS[g.group].value ?? ''),
      figma: '',
    })));
    const inventory = planInventory(tree, det.components, fileKey);
    const typeQuestion = questions.find((q) => q.group === 'type');
    const plan = renderTemplatePlan({
      title: tree.name || 'tabs',
      name: tree.name,
      width: tree.box?.w ?? null,
      variants: [],
      parts: screenParts(tree, det.components, questions, fileKey),
      blocks: sectionBlocks(tree, fileKey),
      open: inventory.open,
      repeats: inventory.repeats,
      templateType: {
        key: typeQuestion ? keyOf('type', typeQuestion.node) : `type:${tree.id}`,
        value: typeQuestion?.value || 'section',
      },
    });
    return { plan, det };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a fresh plan lists the period bar as tabs, with no earlier expect', () => {
  const tree = JSON.parse(readFileSync(new URL('../../history/runs/cLbX6E4TL45F6k2WYE5TCQ/1-4263/tree.json', import.meta.url), 'utf8'));
  const { plan, det } = freshPlan(tree, 'cLbX6E4TL45F6k2WYE5TCQ');
  const tab = det.components.find((c) => c.component === 'tab-switch' && c.node === '1:4264');
  assert.equal(tab?.status, 'approved');
  assert.equal(det.components.some((c) => c.component === 'form' && c.node === '1:4273'), false);
  assert.equal(det.components.some((c) => c.component === 'menu' && c.node === '1:4273'), false);
  assert.match(plan, /Tabs Component `_Title`/);
  assert.match(plan, /`part:1:4264`:/);
  assert.match(plan, /FIRE WALL ANTI DDOS/);
  assert.match(plan, /EMAIL/);
  assert.match(plan, /pane:1:4274/);
});

test('a fresh plan lists the service bar as tabs, and the button under the open pane stays in that pane', () => {
  const tree = JSON.parse(readFileSync(new URL('../../history/runs/cLbX6E4TL45F6k2WYE5TCQ/1-12774/tree.json', import.meta.url), 'utf8'));
  const { plan, det } = freshPlan(tree, 'cLbX6E4TL45F6k2WYE5TCQ');
  const tab = det.components.find((c) => c.component === 'tab-switch' && c.node === '1:12774');
  assert.equal(tab?.status, 'approved');
  assert.match(plan, /Tabs Component `_Title`/);
  assert.match(plan, /`part:1:12774`:/);
  assert.match(plan, /Lưu trữ đang mở/);
  assert.match(plan, /Tốc độ cao chưa vẽ nội dung/);
  assert.doesNotMatch(plan, /Tốc độ cao đang có: XEM CHI TIẾT/);
});
