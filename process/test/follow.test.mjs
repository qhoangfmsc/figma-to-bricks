import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepPhoneWrap, pinStackedBasis } from '../modules/breakpoints/follow.mjs';

const stack = (id) => `@media (max-width: 1199px) and (min-width: 479px) { body #brxe-${id} { flex-direction: column; width: 100%; max-width: 100%; } }`;

test('a row the phone drew as a wrapping row loses the default stack rule, another row keeps it', () => {
  const t = { content: [
    { id: 'aa1', parent: 0, name: 'block', settings: { _direction: 'row', '_flexWrap:mobile_portrait': 'wrap', _cssCustom: `${stack('aa1')} #brxe-aa1 { gap: 4px; }` } },
    { id: 'bb2', parent: 0, name: 'block', settings: { _direction: 'row', _cssCustom: stack('bb2') } },
  ] };
  keepPhoneWrap(t, { keep: ['mobile_portrait'] });
  assert.doesNotMatch(t.content[0].settings._cssCustom, /flex-direction: column/);
  assert.match(t.content[0].settings._cssCustom, /gap: 4px/);
  assert.match(t.content[1].settings._cssCustom, /flex-direction: column/);
  const noPhone = { content: [{ id: 'cc3', parent: 0, name: 'block', settings: { '_flexWrap:mobile_portrait': 'wrap', _cssCustom: stack('cc3') } }] };
  keepPhoneWrap(noPhone, { keep: [] });
  assert.match(noPhone.content[0].settings._cssCustom, /flex-direction: column/);
});

test('a child of a stacked, centered row that sizes itself by flex-basis gets that width, a stretched row is left alone', () => {
  const t = { content: [
    { id: 'r1', parent: 0, name: 'block', settings: { _direction: 'row', _alignItems: 'center', _cssCustom: stack('r1') } },
    { id: 'c1', parent: 'r1', name: 'block', settings: { _width: 'auto', _flexBasis: '420px' } },
    { id: 'c2', parent: 'r1', name: 'block', settings: { _width: '300px', _flexBasis: '300px' } },
    { id: 'r2', parent: 0, name: 'block', settings: { _direction: 'row', _alignItems: 'stretch', _cssCustom: stack('r2') } },
    { id: 'c3', parent: 'r2', name: 'block', settings: { _width: 'auto', _flexBasis: '420px' } },
  ] };
  pinStackedBasis(t);
  const by = (id) => t.content.find((e) => e.id === id).settings;
  assert.match(by('c1')._cssCustom, /\(max-width: 1199px\) and \(min-width: 479px\) \{ #brxe-c1 \{ width: 100%; max-width: 420px; flex-basis: auto; \} \}/);
  assert.equal(by('c1')._flexBasis, '420px');
  assert.equal(by('c2')._cssCustom, undefined);
  assert.equal(by('c3')._cssCustom, undefined);
});

import { keepPhoneColumns } from '../modules/breakpoints/follow.mjs';

test('equal cards that fill the phone row keep their column count on a wider screen, a row they do not fill is left alone', () => {
  const card = (id, parent) => ({ id, parent, name: 'block', settings: { '_width:mobile_portrait': '100px' } });
  const t = { content: [
    { id: 'g1', parent: 0, name: 'block', settings: { '_flexWrap:mobile_portrait': 'wrap', '_columnGap:mobile_portrait': '10px' } },
    card('k1', 'g1'), card('k2', 'g1'), card('k3', 'g1'),
    { id: 'g2', parent: 0, name: 'block', settings: { '_flexWrap:mobile_portrait': 'wrap', '_columnGap:mobile_portrait': '10px' } },
    card('m1', 'g2'), card('m2', 'g2'),
  ] };
  // 3 cards of 100 with gap 10 fill 320; the second row is 400 wide and 2 cards do not fill it
  keepPhoneColumns(t, { keep: ['mobile_portrait'], phoneRow: new Map([['g1', 320], ['g2', 400]]) });
  const by = (id) => t.content.find((e) => e.id === id).settings;
  assert.match(by('k1')._cssCustom, /width: calc\(\(100% - 20px\) \/ 3\)/);
  assert.equal(by('m1')._cssCustom, undefined);
  keepPhoneColumns({ content: [] }, { keep: [], phoneRow: new Map() });
});

import { fluidFill } from '../modules/breakpoints/follow.mjs';

test('a FILL child of a fixed-width row shares what is left, a child of a hugging row keeps its measured basis', () => {
  const t = { content: [
    { id: 'r1', parent: 0, name: 'block', settings: { _direction: 'row', _width: '900px' } },
    { id: 'a', parent: 'r1', name: 'block', settings: { _flexGrow: 1, _flexShrink: 1, _flexBasis: '300px' } },
    { id: 'b', parent: 'r1', name: 'block', settings: { _width: '200px', _flexBasis: '200px' } },
    { id: 'r2', parent: 0, name: 'block', settings: { _direction: 'row', _width: 'auto' } },
    { id: 'c', parent: 'r2', name: 'block', settings: { _flexGrow: 1, _flexShrink: 1, _flexBasis: '300px' } },
  ] };
  fluidFill(t);
  const by = (id) => t.content.find((e) => e.id === id).settings;
  assert.equal(by('a')._flexBasis, '0px');
  assert.equal(by('b')._flexBasis, '200px');
  assert.equal(by('c')._flexBasis, '300px');
});
