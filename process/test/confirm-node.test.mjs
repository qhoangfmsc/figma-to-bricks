import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmNode } from '../modules/recognize-parts/confirm-node.mjs';

const text = (id) => ({ id, type: 'TEXT', visible: true, children: [] });
const card = (id) => ({ id, type: 'FRAME', visible: true, children: [text(`${id}t`), text(`${id}p`)] });

test('a named card widens once to the row of cards', () => {
  const row = { id: 'row', type: 'FRAME', visible: true, children: [card('berth'), card('quay')] };
  const tree = { id: 'root', type: 'FRAME', visible: true, children: [row] };
  assert.deepEqual(confirmNode(tree, 'price-table', 'berth'), { confirm: 'again', node: 'row' });
  assert.deepEqual(confirmNode(tree, 'price-table', 'row'), { confirm: 'ok', node: 'row' });
});

test('two equal groups are asked, and a button node is accepted as itself', () => {
  const mark = (id) => ({ id, type: 'RECTANGLE', visible: true, children: [text(`${id}t`)] });
  const row = { id: 'row', type: 'FRAME', visible: true, children: [card('berth'), card('quay'), mark('one'), mark('two')] };
  const tree = { id: 'root', type: 'FRAME', visible: true, children: [row] };
  assert.equal(confirmNode(tree, 'carousel', 'row').confirm, 'ask');
  assert.deepEqual(confirmNode(tree, 'button', 'berth'), { confirm: 'ok', node: 'berth' });
  assert.equal(confirmNode(tree, 'tabs', 'missing').confirm, 'ask');
});

test('a mark strip under a card row belongs to that row', () => {
  const dash = (id) => ({ id, type: 'RECTANGLE', visible: true, box: { w: 12, h: 4 }, children: [] });
  const strip = { id: 'marks', type: 'FRAME', visible: true, children: [dash('d1'), dash('d2'), dash('d3')] };
  const row = { id: 'row', type: 'FRAME', visible: true, children: [card('north'), card('south'), card('east')] };
  const section = { id: 'section', type: 'FRAME', visible: true, children: [text('title'), row, strip] };
  const tree = { id: 'root', type: 'FRAME', visible: true, children: [section] };
  assert.deepEqual(confirmNode(tree, 'carousel', 'section'), { confirm: 'again', node: 'row' });
  assert.deepEqual(confirmNode(tree, 'carousel', 'row'), { confirm: 'ok', node: 'row' });
  assert.deepEqual(confirmNode(tree, 'carousel', 'marks'), { confirm: 'again', node: 'row' });
});
