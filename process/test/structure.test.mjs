import assert from 'node:assert/strict';
import test from 'node:test';
import { unclaimedRepeats } from '../modules/recognize-parts/structure.mjs';

const card = (id, title) => ({
  id, name: 'Service Card', type: 'INSTANCE',
  children: [
    { id: `${id}t`, type: 'TEXT', text: { characters: title } },
    { id: `${id}p`, type: 'TEXT', text: { characters: 'Chỉ từ 392.000VND/ Tháng' } },
  ],
});

test('a row of same-shaped cards is listed even when the name is not tab or slider', () => {
  const tree = {
    id: 'row', name: 'Frame 12', type: 'FRAME',
    children: [card('a', 'MaxSpeed Hosting'), card('b', 'Bussiness Hosting'), card('c', 'WordPress')],
  };
  const found = unclaimedRepeats(tree, []);
  assert.equal(found.length, 1);
  assert.equal(found[0].node, 'row');
  assert.equal(found[0].count, 3);
  assert.equal(found[0].sameName, true);
  assert.equal(found[0].sample, 'MaxSpeed Hosting');
});

test('a group already approved is not listed again', () => {
  const tree = {
    id: 'row', name: 'tabs', type: 'FRAME',
    children: [card('a', 'A'), card('b', 'B')],
  };
  assert.deepEqual(unclaimedRepeats(tree, [{ node: 'row', status: 'approved', component: 'tabs' }]), []);
});
