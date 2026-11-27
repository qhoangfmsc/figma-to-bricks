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

test('tabs keep the frame that holds the named tab bar and the named tab data', () => {
  const tab = (id) => ({ id, type: 'FRAME', visible: true, children: [text(`${id}t`)] });
  const bar = { id: 'strip', type: 'FRAME', visible: true, children: [tab('a'), tab('b'), tab('c')] };
  const data = { id: 'body', type: 'FRAME', visible: true, children: [card('left'), card('right')] };
  const frame = { id: 'frame', type: 'FRAME', visible: true, children: [bar, data] };
  const tree = { id: 'root', type: 'FRAME', visible: true, children: [{ id: 'wrap', type: 'FRAME', visible: true, children: [frame] }] };
  const params = { tabs_bar: 'strip', tabs_data: 'body' };
  // The strip, the frame or the wrapper may be named. The frame with exactly those two branches is the node.
  assert.deepEqual(confirmNode(tree, 'tabs', 'frame', params), { confirm: 'ok', node: 'frame' });
  assert.deepEqual(confirmNode(tree, 'tab-switch', 'strip', params), { confirm: 'again', node: 'frame' });
  assert.deepEqual(confirmNode(tree, 'tabs', 'wrap', params), { confirm: 'again', node: 'frame' });
  // A third branch beside the bar and the data is not a tab frame: the old rule decides.
  frame.children.push(card('extra'));
  assert.notEqual(confirmNode(tree, 'tabs', 'frame', params).node, 'strip');
});
