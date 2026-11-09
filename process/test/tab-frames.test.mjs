import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyAnswers, readPane, paneQuestionLabel, shareFilledContent, validateAnswers } from '../modules/missing-content/index.mjs';
import { screenParts } from '../modules/single-template/parts.mjs';
import { graftTabPane, paneSource } from '../modules/single-template/tab-frames.mjs';
import { isLayoutRow, isSvgRoot } from '../modules/read-figma/nodes.mjs';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { switchInventory } from '../modules/write-bricks/components/tab-switch.mjs';
import { tabInventory } from '../modules/write-bricks/components/tabs.mjs';
import { resolveWorkspace } from '../modules/common/workspace.mjs';

const text = (id, value) => ({ id, name: id, type: 'TEXT', text: { characters: value }, children: [] });
const row = (id, name, value) => ({ id, name, type: 'FRAME', children: [text(`${id}-t`, value)] });

test('a tab answer is a Figma link, typed text, or keep', () => {
  assert.equal(readPane('').kind, 'keep');
  assert.equal(readPane('chưa có nội dung').kind, 'keep');
  assert.equal(readPane('Gói SSD').text, 'Gói SSD');
  assert.equal(readPane('https://www.figma.com/design/Abcd/n?node-id=12-3').nodeId, '12:3');
  assert.equal(readPane('https://www.figma.com/design/Abcd/n').kind, 'bad');
  assert.equal(validateAnswers({ 'pane:a': 'chưa có nội dung', 'pane:b': 'https://www.figma.com/design/Abcd/n?node-id=12-3' }).length, 0);
  assert.equal(validateAnswers({ 'pane:c': 'https://www.figma.com/design/Abcd/n' }).length, 1);
});

test('typed text fills only a tab Figma did not draw; a link is stored for every tab', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tab-answer-'));
  try {
    const ws = resolveWorkspace(dir);
    ws.writeJson('tree.json', {
      id: 'tabs', children: [
        { id: 'bar', children: [row('tb1', 'Tab', 'Một'), row('tb2', 'Tab', 'Hai')] },
        { id: 'cnt', children: [{ id: 'p1', name: 'Pane', children: [text('p1t', 'Đang mở')] }] },
      ],
    });
    ws.writeJson('detections.json', { components: [{ id: 'd', component: 'tabs', node: 'tabs', status: 'approved', params: {} }] });
    ws.writeJson('overrides.json', { nodes: {} });
    applyAnswers(ws, {
      'pane:tb1': { choice: 'text', text: 'gõ đè' },
      'pane:tb2': { choice: 'figma', url: 'https://www.figma.com/design/Abcd/n?node-id=12-3', fileKey: 'Abcd', nodeId: '12:3' },
    });
    const params = ws.readJson('detections.json').components[0].params;
    assert.equal(params.content.panes, undefined);
    assert.equal(params.content.sources.tb2.nodeId, '12:3');
    assert.equal(params.content.sources.tb1, undefined);
    ws.writeJson('detections.json', { components: [{ id: 'd', component: 'tabs', node: 'tabs', status: 'approved', params: {} }] });
    applyAnswers(ws, { 'pane:tb2': { choice: 'text', text: 'Gói hai' }, 'pane:tb1': { choice: 'keep' } });
    const again = ws.readJson('detections.json').components[0].params;
    assert.equal(again.content.panes.tb2, 'Gói hai');
    assert.equal(again.content.panes.tb1, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the confirm screen names every tab and the content Figma drew', () => {
  const tree = {
    id: 'r', name: '_price-table', children: [
      { id: 'list', name: 'Tab List', layout: { mode: 'HORIZONTAL' }, children: [
        { id: 't1', name: 'Tab', type: 'FRAME', children: [text('t1t', 'VPS NVMe')] },
        { id: 't2', name: 'Tab', type: 'FRAME', children: [text('t2t', 'VPS SSD')] },
      ] },
      { id: 'card', name: 'Price-card', children: [
        { id: 'panel', name: 'Tab Panel - 1 of 2', children: [text('pn', 'VPS NVME 1')] },
      ] },
    ],
  };
  const rows = switchInventory(tree);
  assert.equal(rows[0].drawn, 'VPS NVME 1');
  assert.equal(rows[1].drawn, '');
  const questions = rows.map((row) => ({ group: 'pane', node: row.title.id, label: paneQuestionLabel(row), key: `pane:${row.title.id}`, value: 'chưa có nội dung' }));
  const [part] = screenParts(tree, [{ component: 'tab-switch', node: 'r', status: 'approved', params: {} }], questions, 'FILE');
  assert.match(part.note, /link khung/);
  assert.match(part.fields[0].title, /VPS NVMe/);
  assert.match(part.fields[0].title, /đang có: VPS NVME 1/);
  assert.match(part.fields[1].title, /chưa vẽ nội dung/);
  assert.match(part.fields[0].placeholder, /link khung/);
});

test('a Figma frame replaces the pane of that index and is added when the pane was not drawn', () => {
  const tree = {
    id: 'r', name: '_price-table', children: [
      { id: 'list', name: 'Tab List', layout: { mode: 'HORIZONTAL' }, children: [
        { id: 't1', name: 'Tab', type: 'FRAME', children: [text('t1t', 'VPS NVMe')] },
        { id: 't2', name: 'Tab', type: 'FRAME', children: [text('t2t', 'VPS SSD')] },
      ] },
      { id: 'card', name: 'Price-card', children: [
        { id: 'panel', name: 'Tab Panel - 1 of 2', children: [text('pn', 'VPS NVME 1')] },
      ] },
    ],
  };
  assert.equal(graftTabPane(tree, 'r', 0, { id: 'panel', name: 'Tab Panel', children: [] }), null);
  const added = graftTabPane(tree, 'r', 1, { id: 'full', name: 'SSD', children: [text('x', 'Đủ gói')] });
  const card = tree.children.find((n) => n.id === 'card');
  assert.equal(card.children.length, 2);
  assert.equal(card.children[1].id, added);
  assert.equal(card.children[1].name, 'Tab Panel');
  assert.match(card.children[1].children[0].id, /x$/);
  const classic = {
    id: 'tabs', children: [
      { id: 'bar', children: [row('a', 'Tab', 'Một'), row('b', 'Tab', 'Hai')] },
      { id: 'body', children: [{ id: 'pane', name: 'Pane', children: [text('pt', 'Hello')] }] },
    ],
  };
  assert.equal(tabInventory(classic).map((row) => row.drawn).join('|'), 'Hello|');
  graftTabPane(classic, 'tabs', 1, { id: 'more', name: 'More', children: [text('mt', 'Hai đủ')] });
  assert.equal(classic.children[1].children[1].name, 'Tab Panel');
  assert.equal(classic.children[1].children[0].id, 'pane');
});

test('a linked section keeps the logo row and drops the tab bar', () => {
  const box = (y, w, h) => ({ x: 0, y, w, h, absX: 0, absY: y });
  const tab = (id, label) => ({ id, name: 'Linux tab', type: 'FRAME', box: box(0, 100, 36), children: [text(`${id}t`, label)] });
  const logos = { id: 'logos', name: 'Frame', type: 'FRAME', box: box(40, 1140, 180), children: [
    { id: 'os1', name: 'os', type: 'FRAME', box: box(0, 200, 140), children: [text('a', 'DirectAdmin')] },
  ] };
  const section = {
    id: 'big', name: 'OPERATING SYSTEM', box: box(0, 1920, 444), children: [
      { id: 'bar', name: '_log-update', type: 'FRAME', layout: { mode: 'HORIZONTAL' }, box: box(0, 306, 36), children: [tab('win', 'WINDOW OS'), tab('cp', 'CONTROL PANEL')] },
      logos,
    ],
  };
  assert.equal(paneSource(section).id, 'logos');
  assert.equal(paneSource(logos).id, 'logos');
});

test('logo cards under the open tab stay one pane, and the linked tab is the next pane', () => {
  const box = (y, h) => ({ x: 0, y, w: 200, h, absX: 0, absY: y });
  const tab = (id, label, extra = {}) => ({ id, name: 'Linux tab', type: 'FRAME', box: box(0, 36), children: [text(`${id}t`, label)], ...extra });
  const os = (id) => ({ id, name: 'os', type: 'FRAME', svg: { file: `${id}.svg` }, box: box(0, 140), children: [] });
  const tree = {
    id: 'os', name: 'OPERATING SYSTEM', children: [
      { id: 'bar', name: '_log-update', type: 'FRAME', layout: { mode: 'HORIZONTAL' }, box: box(0, 36), children: [tab('win', 'WINDOW OS', { stroke: { weights: { bottom: 4 } } }), tab('cp', 'CONTROL PANEL')] },
      { id: 'slot', name: 'Frame', type: 'FRAME', layout: { mode: 'HORIZONTAL', gap: 24, padding: { top: 40, right: 0, bottom: 0, left: 0 } }, box: box(40, 180), children: [os('a'), os('b'), os('c'), os('d'), os('e')] },
    ],
  };
  const added = graftTabPane(tree, 'os', 1, { id: 'full', name: 'Panel', children: [text('x', 'DirectAdmin')] });
  const slot = tree.children[1];
  assert.equal(slot.children.length, 2);
  assert.equal(slot.children[0].name, 'Tab Panel');
  assert.equal(slot.children[0].children.length, 5);
  assert.equal(slot.children[0].children[0].id, 'a');
  assert.equal(slot.layout.padding.top, 40);
  assert.equal(slot.layout.gap, 0);
  assert.equal(slot.children[0].layout.mode, 'HORIZONTAL');
  assert.equal(slot.children[0].layout.gap, 24);
  assert.equal(slot.children[0].layout.padding.top, 0);
  assert.equal(slot.children[1].id, added);
  assert.equal(slot.children.some((c) => String(c.id).includes('pad')), false);
});

test('a row of logo frames is not one svg, and an older svg export does not drop the cards', () => {
  const card = (id) => ({ id, type: 'FRAME', visible: true, layoutMode: 'VERTICAL', children: [{ id: `${id}v`, type: 'VECTOR', visible: true }] });
  const row = { id: '1:2', type: 'FRAME', visible: true, layoutMode: 'HORIZONTAL', children: [card('a'), card('b'), card('c'), card('d'), card('e')] };
  assert.equal(isLayoutRow(row), true);
  assert.equal(isSvgRoot(row), false);
  assert.equal(isSvgRoot(row.children[0]), true);
  const raw = { nodes: { '1:2': { document: row, components: {}, styles: {} } } };
  const tree = normalizeRoot(raw, '1:2', { images: {}, svgs: { '1_2': { file: 'svg/1_2.svg', bytes: 12 } } });
  assert.equal(tree.svg, undefined);
  assert.equal(tree.children.length, 5);
});

test('a later tab keeps its index when the content frame was empty, and that frame stops being an svg', () => {
  const box = (y, h) => ({ x: 0, y, w: 200, h, absX: 0, absY: y });
  const tab = (id, label) => ({ id, name: 'Linux tab', type: 'FRAME', box: box(0, 36), children: [text(`${id}t`, label)] });
  const tree = {
    id: 'os', name: 'OPERATING SYSTEM', children: [
      { id: 'bar', name: '_log-update', type: 'FRAME', layout: { mode: 'HORIZONTAL' }, box: box(0, 36), children: [tab('win', 'WINDOW OS'), tab('cp', 'CONTROL PANEL')] },
      { id: 'slot', name: 'Frame', type: 'FRAME', svg: { file: 'empty.svg' }, box: box(40, 180), children: [] },
    ],
  };
  const added = graftTabPane(tree, 'os', 1, { id: 'full', name: 'Panel', children: [text('x', 'DirectAdmin')] });
  const slot = tree.children[1];
  assert.equal(slot.svg, undefined);
  assert.equal(slot.children.length, 2);
  assert.equal(slot.children[0].name, 'Tab Panel');
  assert.equal(slot.children[0].children.length, 0);
  assert.equal(slot.children[1].id, added);
  assert.equal(slot.children[1].children[0].text.characters, 'DirectAdmin');
});

test('a tab link is copied onto the breakpoint that has that tab, and skipped when the tab is absent', () => {
  const root = mkdtempSync(join(tmpdir(), 'tab-share-'));
  const desk = join(root, 'desk');
  const mob = join(root, 'mob');
  const write = (dir, treeJson, det) => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'tree.json'), JSON.stringify(treeJson));
    writeFileSync(join(dir, 'detections.json'), JSON.stringify(det));
  };
  try {
    const source = { kind: 'figma', url: 'https://www.figma.com/design/Abcd/n?node-id=9-9', fileKey: 'Abcd', nodeId: '9:9' };
    write(desk, {
      id: 'root', children: [{ id: 'tabs', name: 'Tabs', children: [
        { id: 'bar', children: [row('tt1', 'Tab', 'Tổng quan'), row('tt2', 'Tab', 'Chi tiết'), row('tt3', 'Tab', 'Chỉ desktop')] },
        { id: 'body', children: [{ id: 'pane', name: 'Pane', children: [] }] },
      ] }],
    }, { components: [{ id: 'd', component: 'tabs', status: 'approved', node: 'tabs', params: { content: { panes: { tt3: 'Chỉ desktop' }, sources: { tt2: source } } } }] });
    write(mob, {
      id: 'mroot', children: [{ id: 'mtabs', name: 'Tabs', children: [
        { id: 'mbar', children: [row('mtt1', 'Tab', 'Tổng quan'), row('mtt2', 'Tab', 'Chi tiết')] },
        { id: 'mbody', children: [{ id: 'mpane', name: 'Pane', children: [] }] },
      ] }],
    }, { components: [{ id: 'd', component: 'tabs', status: 'approved', node: 'mtabs', params: {} }] });
    writeFileSync(join(desk, 'responsive.json'), JSON.stringify({ variants: [{ key: 'mobile_portrait', workspace: 'mob', maxWidth: 478 }] }));
    const base = { dir: desk, readJson: (name, fallback) => { try { return JSON.parse(readFileSync(join(desk, name), 'utf8')); } catch { return fallback; } } };
    assert.equal(shareFilledContent(base).copied, 1);
    const det = JSON.parse(readFileSync(join(mob, 'detections.json'), 'utf8')).components[0];
    assert.equal(det.params.content.sources.mtt2.nodeId, '9:9');
    assert.equal(det.params.content.panes, undefined);
    assert.equal(det.params.content.sources.mtt1, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
