import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrapSlides } from '../modules/build-steps/template/slides.mjs';

const box = (x, y, w, h) => ({ x, y, w, h, absX: x, absY: y });
const frame = (id, b, children = [], extra = {}) => ({ id, name: id, type: 'FRAME', visible: true, box: b, children, place: 'FLOW', ...extra });
const picture = (id, w, h) => ({ id, name: id, type: 'RECTANGLE', visible: true, box: box(9, 9, w, h), place: 'FLOW' });

test('the node at the slider place is replaced by a slider frame that holds one picture per slide', () => {
  const at = frame('s:1', box(40, 60, 800, 300), [frame('s:2', box(0, 0, 50, 50))], { place: 'ABSOLUTE', constraints: { vertical: 'TOP', horizontal: 'LEFT' } });
  const tree = frame('root', box(0, 0, 1000, 600), [frame('title', box(0, 0, 1000, 40)), at]);
  const { wrapper, replaced } = wrapSlides(tree, 's:1', [picture('p1', 780, 320), picture('p2', 600, 340)]);
  assert.equal(tree.children[1], wrapper);
  assert.equal(wrapper.id, 's:1:slides');
  assert.deepEqual(wrapper.children.map((n) => n.id), ['p1', 'p2']);
  assert.deepEqual([wrapper.box.x, wrapper.box.y, wrapper.box.w, wrapper.box.h], [40, 60, 780, 340]);
  assert.equal(wrapper.place, 'ABSOLUTE');
  for (const slide of wrapper.children) assert.deepEqual([slide.box.x, slide.box.y, slide.place], [0, 0, 'FLOW']);
  assert.ok(replaced.has('s:1') && replaced.has('s:2'), 'the replaced subtree is reported so its detections can be dropped');
});

test('a slide that shares an id with this section, or a place that is not in it, is refused', () => {
  const tree = frame('root', box(0, 0, 100, 100), [frame('a', box(0, 0, 50, 50))]);
  assert.throws(() => wrapSlides(tree, 'a', [picture('root', 10, 10)]), /trùng id/);
  assert.throws(() => wrapSlides(tree, 'zzz', [picture('p', 10, 10)]), /Không thấy/);
});

test('gridCards: odd number of blocks fills two columns, rows take the tallest block', async () => {
  const { gridCards } = await import('../modules/build-steps/template/slides.mjs');
  const cards = [10, 20, 14].map((h, i) => ({ id: `c${i}`, box: { x: 99, y: 99, w: 5, h }, sizing: { h: 'HUG', v: 'HUG' } }));
  const { cardW, height } = gridCards(cards, { width: 300, columns: 2, gap: 12 });
  assert.equal(cardW, 144);
  assert.equal(height, 20 + 12 + 14);
  assert.ok(cards.every((c) => c.box.w === 144 && c.box.x === 0 && c.place === 'FLOW'));
});
