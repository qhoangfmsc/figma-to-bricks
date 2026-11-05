import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tabDataFrame } from '../template/tab-frames.mjs';
import { slideChildren } from '../template/slides.mjs';
import { rejectAmbiguousItems, rejectTabBar, rejectTabButtons } from '../template/recheck.mjs';

const tab = (id, label, x) => ({
  id, name: 'Linux tab', type: 'FRAME', box: { x, y: 0, w: 80, h: 36, absX: x, absY: 0 },
  children: [{ id: `${id}t`, type: 'TEXT', text: { characters: label } }],
});

const os = (id, name = 'os') => ({
  id, name, type: 'FRAME', children: [{ id: `${id}v`, name: 'mark', type: 'VECTOR' }],
});

const section = {
  id: 'big', children: [
    { id: 'bar', name: '_log-update', type: 'FRAME', layout: { mode: 'HORIZONTAL' }, box: { x: 0, y: 0, w: 200, h: 36, absX: 0, absY: 0 }, children: [
      tab('t', 'CONTROL PANEL', 0), tab('u', 'Khác', 90),
    ] },
    { id: 'slot', name: 'Frame', type: 'FRAME', box: { x: 0, y: 40, w: 400, h: 140, absX: 0, absY: 40 }, children: [
      { id: 'cap', name: 'Caption', type: 'TEXT', text: { characters: 'nhãn' } },
      os('a'), os('b'), os('c'),
    ] },
  ],
};

test('a user tab link is reduced to the repeated items', () => {
  const frame = rejectAmbiguousItems(rejectTabBar(tabDataFrame(section)));
  assert.equal(frame.id, 'slot');
  assert.deepEqual(frame.children.map((n) => n.id), ['a', 'b', 'c']);
});

test('a user link that is still the tab bar is not pasted', () => {
  const bar = section.children[0];
  assert.throws(() => rejectTabBar(tabDataFrame(bar)), /thanh tab/);
  assert.throws(() => rejectTabBar(section), /thanh tab/);
});

test('two equal item groups are not chosen for the owner', () => {
  const mixed = { id: 'f', children: [os('a', 'os'), os('b', 'os'), os('c', 'panel'), os('d', 'panel')] };
  assert.throws(() => rejectAmbiguousItems(tabDataFrame(mixed)), /hai nhóm/);
});

test('a slide link that is the tab buttons is not used as the slides', () => {
  const bar = section.children[0];
  assert.throws(() => rejectTabButtons(slideChildren(bar)), /thanh tab/);
  assert.deepEqual(rejectTabButtons(slideChildren({ id: 'row', layout: { mode: 'HORIZONTAL' }, children: [os('a'), os('b'), os('c')] })).map((n) => n.id), ['a', 'b', 'c']);
});
