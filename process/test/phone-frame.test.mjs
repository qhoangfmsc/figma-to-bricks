import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrollClippedRows, setAsideFrames } from '../modules/breakpoints/phone-frame.mjs';

// A team page phone frame (360px): two member cards of 240px in a clipped row, and a row of two 120px
// buttons that fits. Not a price table.
const el = (id, parent, settings) => ({ id, name: 'block', parent, settings });

function phone() {
  return [
    el('ph', 0, { _direction: 'column', _cssCustom: '@media (min-width: 768px) { body #brxe-ph { display: none; } }' }),
    el('clip', 'ph', { _direction: 'column', _overflow: 'hidden' }),
    el('team', 'clip', { _direction: 'row', _width: '100%', _columnGap: '12px' }),
    el('m1', 'team', { _width: '240px' }),
    el('m2', 'team', { _width: '240px' }),
    el('btns', 'ph', { _direction: 'row', _columnGap: '8px' }),
    el('b1', 'btns', { _width: '120px' }),
    el('b2', 'btns', { _width: '120px' }),
  ];
}

test('a row the phone frame draws past its clip scrolls; a row that fits stays as drawn', () => {
  const content = phone();
  const rows = scrollClippedRows(content, 360);
  assert.deepEqual(rows.map((r) => r.id), ['team']);
  const s = (id) => content.find((e) => e.id === id).settings;
  assert.equal(s('team')._overflow, 'auto');
  assert.equal(s('team')._flexWrap, 'nowrap');
  assert.equal(s('m1')._flexShrink, 0);
  assert.equal(s('btns')._overflow, undefined);
});

test('a wide row with no clip around it is not made a scroll list', () => {
  const content = phone();
  content.find((e) => e.id === 'clip').settings._overflow = undefined;
  assert.deepEqual(scrollClippedRows(content, 360), []);
});

test('a whole frame is set aside from the fit passes and comes back in its place', () => {
  const template = { content: [el('desk', 0, {}), el('d1', 'desk', {}), ...phone(), el('tail', 0, {})] };
  const aside = setAsideFrames(template, ['ph']);
  assert.deepEqual(template.content.map((e) => e.id), ['desk', 'd1', 'tail']);
  assert.equal(aside.elements.length, 8);
  template.content.push(el('added', 'desk', {}));
  aside.restore();
  assert.deepEqual(template.content.map((e) => e.id).slice(0, 3), ['desk', 'd1', 'ph']);
  assert.equal(template.content.at(-1).id, 'added');
  assert.equal(template.content.at(-2).id, 'tail');
});

test('the subtree of a whole frame is found whatever the list order, and the scroll list starts at its first item', async () => {
  const { subtreeOf } = await import('../modules/breakpoints/phone-frame.mjs');
  const content = phone();
  const wrapFirst = [content[2], ...content.filter((e) => e.id !== 'team')];
  assert.equal(subtreeOf(wrapFirst, 'ph').length, 8);
  content.find((e) => e.id === 'team').settings._justifyContent = 'center';
  scrollClippedRows(content, 360);
  assert.equal(content.find((e) => e.id === 'team').settings._justifyContent, 'flex-start');
});
