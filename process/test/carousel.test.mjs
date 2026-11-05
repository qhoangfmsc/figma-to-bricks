import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectCarousels } from '../detect/rules/carousel.mjs';
import { checkCites } from '../detect/cite.mjs';
import carousel, { paginationMarks } from '../bricks/components/carousel.mjs';
import { buildTemplate } from '../bricks/render/index.mjs';
import { validateAnswers } from '../plan/index.mjs';
import { graftSlides } from '../template/slides.mjs';

const treeOf = (id) => JSON.parse(readFileSync(new URL(`../work/NcaLAzM0EyDXVnHwqAjOR0/${id}/tree.json`, import.meta.url), 'utf8'));
const svgOf = (id, file) => readFileSync(new URL(`../work/NcaLAzM0EyDXVnHwqAjOR0/${id}/assets/${file}`, import.meta.url), 'utf8');

const card = (id, x) => ({ id, name: 'card', type: 'FRAME', box: { x, y: 0, w: 100, h: 60, absX: x, absY: 0 }, children: [{ id: id + 't', type: 'TEXT', text: { characters: 'Card' } }] });
const rowOf = (children, extra = {}) => ({ id: 'r', name: 'root', children: [{ id: 'row', name: 'Row', layout: { mode: 'HORIZONTAL', wrap: false, gap: 20 }, box: { x: 0, y: 0, w: 400, h: 60, absX: 0, absY: 0 }, children, ...extra }] });

test('three cards that fit, with no pagination and no arrows, are a grid', () => {
  const found = detectCarousels(rowOf([0, 1, 2].map((i) => card('c' + i, i * 120))));
  assert.equal(found.length, 0);
  const text = (id, x, w) => ({ id, name: 'Text', type: 'FRAME', box: { x, y: 0, w, h: 20, absX: x, absY: 0 }, children: [{ id: id + 't', type: 'TEXT', box: { x: 0, y: 0, w, h: 20, absX: x, absY: 0 }, text: { characters: 'Hi' } }] });
  const sticking = { id: 'r', name: 'root', children: [{ id: 'row', name: 'Container', layout: { mode: 'HORIZONTAL', wrap: false, gap: 0 }, box: { x: 0, y: 0, w: 277, h: 33, absX: 0, absY: 0 }, children: [text('a', 8, 174), text('b', 182, 84), text('c', 266, 30)] }] };
  assert.equal(detectCarousels(sticking).length, 0);
});

test('award cards with different inner trees and a Pagination sibling are one carousel', () => {
  const tree = treeOf('2121-2699');
  const found = detectCarousels(tree);
  const hit = found.find((c) => c.node === '2121:2708');
  assert.ok(hit, found.map((c) => c.node).join(','));
  assert.equal(hit.params.pagination, '2121:2709');
  assert.equal(checkCites(hit.cite, tree).join(';'), '');
  const marks = paginationMarks(svgOf('2121-2699', 'svg/2121_2709.svg'));
  assert.equal(marks.items.length, 7);
  assert.equal(marks.idle.w, 20);
  assert.equal(marks.active.w, 32);
  assert.equal(marks.idle.alpha, 0.24);
  const det = { id: 'd1', component: 'carousel', node: hit.node, status: 'approved', params: hit.params };
  const node = tree.children.find((c) => c.id === '2121:2708');
  assert.equal(carousel.mergedNodes(det, node, { root: tree, readAsset: (f) => svgOf('2121-2699', f) }).includes('2121:2709'), true);
  const b = buildTemplate(tree, { detections: { components: [det] }, readAsset: (f) => svgOf('2121-2699', f), salt: 'award' });
  const slider = b.template.content.find((e) => e.id === b.mapping['2121:2708'].bricksId);
  assert.equal(slider.settings.type, 'loop');
  assert.equal(slider.settings.focus, 0);
  assert.equal(slider.settings.perMove, 1);
  assert.equal(slider.settings.start, 0);
  assert.equal(slider.settings.autoplay, true);
  assert.equal(slider.settings.interval, 3000);
  assert.equal(slider.settings.pagination, true);
  assert.equal(slider.settings.paginationWidth, '20px');
  assert.equal(slider.settings.paginationWidthActive, '32px');
  assert.equal(b.template.content.filter((e) => e.parent === slider.id).length, 5);
  const stopped = { ...det, params: { ...det.params, autoplay: false } };
  const b2 = buildTemplate(tree, { detections: { components: [stopped] }, readAsset: (f) => svgOf('2121-2699', f), salt: 'award2' });
  const slider2 = b2.template.content.find((e) => e.id === b2.mapping['2121:2708'].bricksId);
  assert.equal(slider2.settings.autoplay, undefined);
  assert.equal(slider2.settings.type, 'loop');
});

test('case-study row: three cards, the navigation is not a slide, and both arrows share the brighter button', () => {
  const tree = treeOf('2172-3669');
  const hit = detectCarousels(tree).find((c) => c.node === '2172:3675');
  assert.ok(hit);
  assert.equal(hit.params.prev, '2172:3710');
  assert.equal(hit.params.next, '2172:3711');
  assert.deepEqual(hit.params.controls, ['2172:3709']);
  assert.equal(hit.params.pagination, '2172:3712');
  assert.equal(checkCites(hit.cite, tree).join(';'), '');
  const marks = paginationMarks(svgOf('2172-3669', 'svg/2172_3712.svg'));
  assert.equal(marks.items.length, 5);
  assert.equal(marks.active.hex.toLowerCase(), '#007cfc');
  const det = { id: 'd1', component: 'carousel', node: '2172:3675', status: 'approved', params: hit.params };
  const b = buildTemplate(tree, { detections: { components: [det] }, readAsset: (f) => svgOf('2172-3669', f), salt: 'car' });
  const slider = b.template.content.find((e) => e.id === b.mapping['2172:3675'].bricksId);
  assert.equal(slider.name, 'slider-nested');
  assert.equal(slider.settings.perPage, 3);
  assert.equal(slider.settings.gap, 24);
  assert.equal(slider.settings.type, 'loop');
  assert.equal(slider.settings.focus, 0);
  assert.equal(slider.settings.start, 0);
  assert.equal(slider.settings.autoplay, true);
  assert.equal(slider.settings.interval, 3000);
  assert.equal(slider.settings.pagination, true);
  assert.equal(slider.settings.paginationTop, '454px');
  assert.equal(b.mapping['2172:3712'].skipped.startsWith('merged into carousel'), true);
  assert.equal(b.mapping['2172:3709'].skipped.startsWith('merged into carousel'), true);
  assert.equal(slider.settings.arrows, true);
  assert.equal(slider.settings.arrowDisabledOpacity, 1);
  assert.doesNotMatch(slider.settings._cssCustom, /opacity:\s*0\.2/);
  const prevCss = slider.settings._cssCustom.split('.splide__arrow--next')[0];
  assert.match(prevCss, /splide__arrow--prev[\s\S]*linear-gradient\(/);
  assert.match(slider.settings._cssCustom, /splide__arrow--next[\s\S]*linear-gradient\(/);
  assert.equal(slider.settings.prevArrow.svg.$asset, 'svg/I2172_3710_92_459.svg');
  assert.equal(slider.settings.nextArrow.svg.$asset, 'svg/I2172_3711_92_465.svg');
  const slides = b.template.content.filter((e) => e.parent === slider.id);
  assert.equal(slides.length, 3);
});

test('one clipped image with arrow buttons is a slider, and a review grid of two rows is not', () => {
  const bench = treeOf('2130-2393');
  const hit = detectCarousels(bench).find((c) => c.node === '2130:2404');
  assert.ok(hit);
  assert.equal(hit.params.allowSingle, true);
  assert.equal(hit.params.prev, '2130:2413');
  assert.equal(hit.params.next, '2130:2414');
  assert.equal(checkCites(hit.cite, bench).join(';'), '');
  const review = detectCarousels(treeOf('2130-2725'));
  assert.equal(review.length, 0);
  const mobile = detectCarousels(treeOf('2134-3050')).find((c) => c.node === '2134:3056');
  assert.equal(mobile?.params.allowSingle, true);
  assert.equal(mobile?.params.prev, '2134:3097');
});

test('slider questions accept a count, the autoplay default and a Figma link, and reject a sentence', () => {
  assert.deepEqual(validateAnswers({ 'count:a': '5', 'autoplay:a': 'tự chuyển mỗi 3 giây', 'autoplay:b': 'không tự chuyển', 'autoplay:c': '5', 'items:a': 'https://www.figma.com/design/FILE/x?node-id=1-2' }), []);
  assert.equal(validateAnswers({ 'items:a': 'thêm vài cái nữa' }).length, 1);
  assert.equal(validateAnswers({ 'count:a': 'không' }).length, 1);
});

test('a Figma frame of items replaces the drawn slides and keeps the arrow', () => {
  const tree = { id: 'root', children: [{ id: 'row', children: [{ id: 'a', name: 'Card', type: 'FRAME', children: [] }, { id: 'prev', name: 'Left', type: 'FRAME', children: [] }] }] };
  const source = { id: 'all', layout: { mode: 'HORIZONTAL' }, children: [{ id: 'n1', name: 'Card', type: 'FRAME', children: [{ id: 't1', type: 'TEXT' }] }, { id: 'n2', name: 'Card', type: 'FRAME', children: [] }, { id: 'dots', name: 'Pagination', type: 'FRAME', children: [] }] };
  const n = graftSlides(tree, 'row', source, ['prev']);
  assert.equal(n, 2);
  assert.deepEqual(tree.children[0].children.map((c) => c.id).slice(-1), ['prev']);
  assert.equal(tree.children[0].children.length, 3);
  assert.equal(tree.children[0].children[0].children.length, 1);
  assert.notEqual(tree.children[0].children[0].id, 'n1');
});
