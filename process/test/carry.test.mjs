import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carryComponents } from '../modules/breakpoints/carry.mjs';

const pairs = new Map([['20:2', '10:2'], ['20:3', '10:3'], ['20:4', '10:4']]);

test('a component the base frame approved is the same component on the paired node of a variant frame', () => {
  const base = { components: [
    { id: 'p', component: 'video', node: '10:2', status: 'approved', params: { url: 'https://vimeo.com/123456' }, cite: [{ node: '10:2', field: 'name' }] },
    { id: 'm', component: 'menu', node: '10:3', status: 'approved', params: { items: ['10:4', '10:9'] }, cite: [] },
    { id: 'gone', component: 'button', node: '10:77', status: 'approved', params: {}, cite: [] },
    { id: 'no', component: 'divider', node: '10:4', status: 'rejected', params: {}, cite: [] },
  ] };
  const variant = { components: [
    { id: 'x', component: 'video', node: '20:2', status: 'proposed', params: {}, cite: [] },
    { id: 'y', component: 'divider', node: '20:2', status: 'rejected', params: {}, cite: [] },
  ] };
  const out = carryComponents(base, variant, pairs, '20:1').components;
  const video = out.find((c) => c.component === 'video');
  assert.equal(video.node, '20:2');
  assert.equal(video.status, 'approved');
  assert.equal(video.params.url, 'https://vimeo.com/123456');
  assert.equal(video.cite[0].node, '20:2');
  assert.equal(out.some((c) => c.id === 'x'), false, 'the variant proposal on that node is replaced');
  assert.equal(out.some((c) => c.id === 'y'), true, 'a rejected variant entry stays');
  const menu = out.find((c) => c.component === 'menu');
  assert.deepEqual(menu.params.items, ['20:4', null]);
  assert.equal(out.some((c) => c.component === 'button'), false, 'a base node with no pair carries nothing');
  assert.equal(out.some((c) => c.component === 'divider' && c.node === '20:4'), false, 'a rejected base entry is not carried');
});

test('a kind the variant frame already approved on that node is kept as decided there', () => {
  const base = { components: [{ id: 'a', component: 'accordion', node: '10:2', status: 'approved', params: { open: '10:3' }, cite: [] }] };
  const variant = { components: [{ id: 'own', component: 'accordion', node: '20:2', status: 'approved', params: { open: '20:3' }, cite: [] }] };
  assert.equal(carryComponents(base, variant, pairs, '20:1'), variant);
});

import { matchByContent, carryPairs, carryGaps } from '../modules/breakpoints/carry.mjs';

const node = (id, name, type, extra = {}, children = []) => ({ id, name, type, visible: true, children, ...extra });
const text = (id, name, characters) => node(id, name, 'TEXT', { text: { characters } });
const pic = (id, name, imageRef) => node(id, name, 'FRAME', { fills: [{ type: 'IMAGE', imageRef }] });

test('nodes pair by what they draw (image and text), whatever the designer named them', () => {
  const base = node('1:1', 'Page', 'FRAME', {}, [
    node('1:2', 'Row', 'FRAME', {}, [text('1:3', 'Title', 'Hello world'), pic('1:4', 'Frame 9', 'imgA')]),
  ]);
  const phone = node('2:1', 'Mobile', 'FRAME', {}, [
    node('2:2', 'Stack', 'FRAME', {}, [pic('2:3', 'Thing', 'imgA'), text('2:4', 'xyz', 'Hello world')]),
  ]);
  const pairs = matchByContent(base, phone);
  assert.equal(pairs.get('2:3'), '1:4');
  assert.equal(pairs.get('2:4'), '1:3');
});

test('an empty frame and a repeated different content never pair by guess', () => {
  const base = node('1:1', 'Page', 'FRAME', {}, [node('1:2', 'a', 'FRAME'), text('1:3', 't', 'same'), text('1:4', 't', 'same')]);
  const phone = node('2:1', 'Page', 'FRAME', {}, [node('2:2', 'a', 'FRAME'), text('2:3', 't', 'same')]);
  const pairs = matchByContent(base, phone);
  assert.equal(pairs.has('2:2'), false);
  assert.equal(pairs.has('2:3'), false, 'two on one side and one on the other is not decided');
});

test('an alias wins over content, and an approved component with no partner is reported', () => {
  const base = node('1:1', 'Page', 'FRAME', {}, [pic('1:2', 'a', 'imgA')]);
  const phone = node('2:1', 'Page', 'FRAME', {}, [pic('2:2', 'b', 'imgB'), pic('2:3', 'c', 'imgA')]);
  const pairs = carryPairs(base, phone, new Map(), { '2:2': '1:2' });
  assert.equal(pairs.get('2:2'), '1:2');
  assert.equal(pairs.has('2:3'), false);
  const gaps = carryGaps({ components: [{ component: 'video', node: '1:2', status: 'approved', source: 'ai' }, { component: 'menu', node: '1:9', status: 'approved', source: 'ai' }] }, pairs);
  assert.equal(gaps.length, 1);
  assert.match(gaps[0], /menu/);
});
