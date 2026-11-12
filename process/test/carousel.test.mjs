import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectCarousels, dashRowFromSvg } from '../modules/recognize-parts/rules/carousel.mjs';
import { checkCites } from '../modules/recognize-parts/cite.mjs';
import carousel, { paginationMarks } from '../modules/write-bricks/components/carousel.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { applyAnswers, validateAnswers } from '../modules/missing-content/index.mjs';
import { screenParts } from '../modules/single-template/parts.mjs';
import { graftSlides } from '../modules/single-template/slides.mjs';

const treeOf = (id) => JSON.parse(readFileSync(new URL(`../fixtures/sections/${id}/tree.json`, import.meta.url), 'utf8'));
const svgOf = (id, file) => readFileSync(new URL(`../fixtures/sections/${id}/assets/${file}`, import.meta.url), 'utf8');

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
  assert.match(slider.settings._cssCustom, /visibility:\s*visible/);
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
  assert.equal(review.filter((c) => c.component === 'carousel').length, 0);
  assert.equal(review.find((c) => c.node === '2130:2738')?.component, 'pagination_carousel');
  const mobile = detectCarousels(treeOf('2134-3050')).find((c) => c.node === '2134:3056');
  assert.equal(mobile?.params.allowSingle, true);
  assert.equal(mobile?.params.prev, '2134:3097');
});

test('slider questions accept a count, the autoplay default, a Figma link, and a free sentence', () => {
  assert.deepEqual(validateAnswers({ 'count:a': '5', 'autoplay:a': 'tự chuyển mỗi 3 giây', 'autoplay:b': 'không tự chuyển', 'autoplay:c': '5', 'items:a': 'https://www.figma.com/design/FILE/x?node-id=1-2', 'mobileform:a': 'mobile vẫn là slider' }), []);
  assert.equal(validateAnswers({ 'items:a': 'thêm vài cái nữa' }).length, 0);
  assert.equal(validateAnswers({ 'count:a': 'không' }).length, 0);
  assert.equal(validateAnswers({ 'mobileform:a': 'làm hàng kéo' }).length, 0);
});

test('one card plus a dash or dot row is a slider, and three equal marks are not', () => {
  const sizing = { h: 'FIXED', v: 'FIXED' };
  const mark = (id, x, w = 12, hex = '#c5c5c6', opacity = 0.4) => ({ id, name: 'mark', type: 'RECTANGLE', sizing, box: { x, y: 0, w, h: 4, absX: x, absY: 0 }, fills: [{ type: 'SOLID', hex, opacity }], children: [] });
  const card = { id: 'card', name: '_testimonial-card', type: 'FRAME', sizing, box: { x: 0, y: 0, w: 343, h: 278, absX: 0, absY: 0 }, children: [{ id: 'photo', type: 'RECTANGLE', sizing, box: { x: 0, y: 0, w: 160, h: 278, absX: 0, absY: 0 }, children: [] }] };
  const dots = { id: 'dots', name: 'Pagination', type: 'INSTANCE', componentSet: 'Pagination', sizing, box: { x: 0, y: 326, w: 88, h: 4, absX: 0, absY: 326 }, children: [], props: { Type: 'Dash', 'Dash 01': true, 'Dash 02': true, 'Dash 03': true, 'Dash 04': false } };
  const pad = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { id: 'review', name: 'Testtimonial', type: 'FRAME', sizing, layout: { mode: 'VERTICAL', wrap: false, gap: 16, padding: pad }, box: { x: 0, y: 0, w: 343, h: 340, absX: 0, absY: 200 }, children: [card, dots] };
  const loose = { id: 'loose', name: 'marks', type: 'FRAME', sizing, box: { x: 0, y: 0, w: 88, h: 4, absX: 0, absY: 0 }, children: [mark('d1', 0), mark('d2', 20), mark('d3', 40)] };
  const dashes = { id: 'dashes', name: 'marks', type: 'FRAME', sizing, box: { x: 0, y: 16, w: 88, h: 4, absX: 0, absY: 16 }, children: [mark('a', 0), mark('b', 20), mark('on', 40, 24, '#282829', 1)] };
  const decoy = { id: 'decoy', name: 'Dashboard chip', type: 'FRAME', sizing, box: { x: 0, y: 8, w: 88, h: 4, absX: 0, absY: 8 }, children: [] };
  const dot = (id, x, hex, opacity) => ({ id, name: 'Ellipse', type: 'ELLIPSE', sizing, box: { x, y: 0, w: 8, h: 8, absX: x, absY: 0 }, fills: [{ type: 'SOLID', hex, opacity }], children: [] });
  const dotRow = { id: 'dotrow', name: 'Frame', type: 'FRAME', sizing, box: { x: 120, y: 286, w: 40, h: 8, absX: 120, absY: 286 }, children: [dot('e1', 0, '#c5c5c6', 0.4), dot('e2', 16, '#c5c5c6', 0.4), dot('e3', 32, '#282829', 1)] };
  const dotCard = { id: 'card2', name: '_testimonial-card', type: 'FRAME', sizing, box: { x: 0, y: 0, w: 343, h: 278, absX: 0, absY: 0 }, children: [] };
  const dotFrame = { id: 'dotslider', name: 'Frame', type: 'FRAME', sizing, layout: { mode: 'VERTICAL', wrap: false, gap: 8, padding: pad }, box: { x: 0, y: 400, w: 343, h: 300, absX: 0, absY: 400 }, children: [dotCard, dotRow] };
  const five = [0, 1, 2, 3].map((i) => dot('f' + i, i * 12, '#c5c5c6', 0.4)).concat([dot('f4', 48, '#282829', 1)]);
  const fiveRow = { id: 'fiverow', name: 'Frame', type: 'FRAME', sizing, box: { x: 80, y: 286, w: 60, h: 8, absX: 80, absY: 700 }, children: five };
  const fiveCard = { id: 'card5', name: '_testimonial-card', type: 'FRAME', sizing, box: { x: 0, y: 0, w: 343, h: 278, absX: 0, absY: 0 }, children: [] };
  const fiveFrame = { id: 'fiveslider', name: 'Frame', type: 'FRAME', sizing, layout: { mode: 'VERTICAL', wrap: false, gap: 8, padding: pad }, box: { x: 0, y: 720, w: 343, h: 300, absX: 0, absY: 720 }, children: [fiveCard, fiveRow] };
  const pair = [mark('p0', 0), mark('p1', 20, 24, '#282829', 1)];
  const pairRow = { id: 'pairrow', name: 'Frame', type: 'FRAME', sizing, box: { x: 0, y: 286, w: 44, h: 4, absX: 0, absY: 1000 }, children: pair };
  const pairCard = { id: 'cardpair', name: '_testimonial-card', type: 'FRAME', sizing, box: { x: 0, y: 0, w: 343, h: 278, absX: 0, absY: 0 }, children: [] };
  const pairFrame = { id: 'pairslider', name: 'Frame', type: 'FRAME', sizing, layout: { mode: 'VERTICAL', wrap: false, gap: 8, padding: pad }, box: { x: 0, y: 1040, w: 343, h: 300, absX: 0, absY: 1040 }, children: [pairCard, pairRow] };
  const tree = { id: 'root', name: 'Review', type: 'FRAME', sizing, layout: { mode: 'VERTICAL', wrap: false, gap: 12, padding: pad }, box: { x: 0, y: 0, w: 375, h: 1400, absX: 0, absY: 0 }, children: [decoy, loose, dashes, frame, dotFrame, fiveFrame, pairFrame] };
  const found = detectCarousels(tree);
  const hit = found.find((c) => c.node === 'review');
  assert.equal(hit.component, 'carousel');
  assert.equal(hit.confidence, 'medium');
  assert.equal(hit.params.allowSingle, true);
  assert.equal(hit.params.pagination, 'dots');
  assert.equal(hit.params.itemCount, 3);
  assert.equal(hit.cite.find((c) => c.node === 'dots').field, 'componentSet');
  assert.equal(checkCites(hit.cite, tree).join(';'), '');
  const dotted = found.find((c) => c.node === 'dotslider');
  assert.equal(dotted.component, 'carousel');
  assert.equal(dotted.params.pagination, 'dotrow');
  assert.equal(dotted.params.itemCount, 3);
  const fiveHit = found.find((c) => c.node === 'fiveslider');
  assert.equal(fiveHit.component, 'carousel');
  assert.equal(fiveHit.params.itemCount, 5);
  const pairHit = found.find((c) => c.node === 'pairslider');
  assert.equal(pairHit.component, 'carousel');
  assert.equal(pairHit.params.itemCount, 2);
  assert.equal(found.find((c) => c.node === 'loose'), undefined);
  const stray = found.find((c) => c.node === 'dashes');
  assert.equal(stray.component, 'pagination_carousel');
  assert.equal(stray.params.of, 'carousel');
  assert.equal(stray.params.hold, true);
  assert.equal(stray.params.itemCount, 3);
  assert.equal(found.find((c) => c.node === 'decoy'), undefined);
  const built = buildTemplate(tree, {
    detections: { components: [{ id: 'd1', status: 'approved', ...hit }, { id: 'd2', status: 'proposed', ...stray }] },
    salt: 'paged',
  });
  assert.equal(built.template.content.find((e) => e.name === 'slider-nested').label, 'Testtimonial');
  assert.ok(built.template.content.find((e) => e.label === '_testimonial-card'));
  assert.equal(built.mapping.dots.skipped.startsWith('merged into carousel'), true);
  assert.equal(built.mapping.dashes.skipped, 'waiting for the plan');
  assert.ok(built.template.content.find((e) => e.label === 'Dashboard chip'));
  const phone = JSON.parse(readFileSync(new URL('../../history/runs/cLbX6E4TL45F6k2WYE5TCQ/1-16827/tree.json', import.meta.url), 'utf8'));
  const phoneHits = detectCarousels(phone);
  const cardHit = phoneHits.find((c) => c.node === '1:16862');
  assert.equal(cardHit.confidence, 'medium');
  assert.equal(cardHit.params.pagination, '1:16886');
  assert.equal(cardHit.params.itemCount, 3);
  assert.equal(cardHit.cite.find((c) => c.node === '1:16886').equals, 'Pagination');
  assert.equal(checkCites(cardHit.cite, phone).join(';'), '');
  const looseHit = phoneHits.find((c) => c.node === '1:16861');
  assert.equal(looseHit, undefined);
  const ratings = phoneHits.find((c) => c.node === '1:16832');
  assert.equal(ratings.component, 'carousel');
  assert.equal(ratings.params.pagination, '1:16861');
  assert.equal(ratings.params.itemCount, 3);
  assert.equal(ratings.params.allowSingle, undefined);
  assert.equal(phoneHits.filter((c) => c.component === 'carousel').length, 2);
});

test('one svg of a longer dash and any number of shorter faded dashes is the slider row', () => {
  const stroke = (x, len, opacity = 0.5) => `<path opacity="${opacity}" d="M${x} 2H${x + len}" stroke-width="4" stroke-linecap="round" stroke="#007CFC"/>`;
  const svg = (parts) => `<svg width="124" height="4" viewBox="0 0 124 4" fill="none" xmlns="http://www.w3.org/2000/svg">${parts}</svg>`;
  const row = svg([stroke(2, 12), stroke(26, 12), stroke(50, 24, 1), stroke(86, 12), stroke(110, 12)].join(''));
  assert.equal(dashRowFromSvg(row).count, 5);
  assert.equal(dashRowFromSvg(svg([stroke(2, 12, 1), stroke(26, 12, 1), stroke(50, 12, 1)].join(''))), null);
  const sizing = { h: 'FIXED', v: 'FIXED' };
  const pad = { top: 0, right: 0, bottom: 0, left: 0 };
  const card = (id, x) => ({ id, name: '_testimonial-card', type: 'FRAME', sizing, box: { x, y: 0, w: 200, h: 180, absX: x, absY: 0 }, children: [] });
  const band = (id, y, ids) => ({ id, name: 'row', type: 'FRAME', sizing, layout: { mode: 'HORIZONTAL', wrap: false, gap: 16, padding: pad }, box: { x: 0, y, w: 420, h: 180, absX: 0, absY: y }, children: ids.map((n, i) => card(n, i * 210)) });
  const dots = { id: 'svgdots', name: 'Frame', type: 'FRAME', sizing, box: { x: 150, y: 380, w: 120, h: 0, absX: 150, absY: 380 }, children: [], svgText: row };
  const frame = { id: 'page', name: 'Reviews', type: 'FRAME', sizing, layout: { mode: 'VERTICAL', wrap: false, gap: 24, padding: pad }, box: { x: 0, y: 0, w: 420, h: 400, absX: 0, absY: 0 }, children: [band('r1', 0, ['a', 'b']), band('r2', 200, ['c', 'd']), dots] };
  const hit = detectCarousels(frame).find((c) => c.node === 'page');
  assert.equal(hit.component, 'carousel');
  assert.equal(hit.params.pagination, 'svgdots');
  assert.equal(hit.params.itemCount, 5);
  const plain = { ...dots, id: 'plain', svgText: svg([stroke(2, 12, 1), stroke(26, 12, 1), stroke(50, 12, 1)].join('')) };
  assert.equal(detectCarousels({ ...frame, children: [band('r1', 0, ['a', 'b']), band('r2', 200, ['c', 'd']), plain] }).find((c) => c.component === 'carousel'), undefined);
});

test('a desktop slider stays a slider on mobile unless a mobile frame draws something else', () => {
  const tree = { id: 'row', name: 'Slider', children: [] };
  const questions = [{ group: 'mobileform', node: 'row', label: 'Slider "Slider"', value: 'mobile vẫn là slider' }];
  const parts = screenParts(tree, [{ component: 'carousel', node: 'row', status: 'approved', params: {} }], questions, 'FILE');
  assert.match(parts[0].note, /Không tự đổi/);
  assert.equal(parts[0].fields[0].value, 'mobile vẫn là slider');
  assert.deepEqual(parts[0].children, ['Pagination: không', 'Nút trước: không', 'Nút sau: không']);
  const drawn = screenParts(tree, [{ component: 'carousel', node: 'row', status: 'approved', params: { pagination: 'dots', prev: 'pv', next: 'nx' } }], questions, 'FILE');
  assert.deepEqual(drawn[0].children, ['Pagination: `dots` — nghi ngờ', 'Nút trước: `pv` — nghi ngờ', 'Nút sau: `nx` — nghi ngờ']);
  const files = { 'tree.json': tree, 'overrides.json': { nodes: {} }, 'detections.json': { components: [{ id: 'd1', component: 'carousel', node: 'row', status: 'approved', params: {} }] } };
  const missed = applyAnswers({ readJson: (n, fb) => files[n] ?? fb, writeJson: (n, v) => { files[n] = v; } }, { 'mobileform:row': 'làm hàng kéo ở điện thoại' });
  assert.deepEqual(missed.unused, ['mobileform:row']);
  applyAnswers({ readJson: (n, fb) => files[n] ?? fb, writeJson: (n, v) => { files[n] = v; } }, { 'mobileform:row': { choice: 'slider', note: 'làm hàng kéo ở điện thoại' } });
  assert.equal(files['detections.json'].components[0].component, 'carousel');
  assert.equal(files['detections.json'].components[0].params.mobileForm, 'slider');
  assert.match(files['detections.json'].components[0].params.mobileNote, /hàng kéo/);
});

test('one drawn slide stays type slide so Splide does not clone the card out of the track', () => {
  const node = { id: 'n', box: { w: 343, h: 330 }, children: [{ id: 'card', box: { w: 343, h: 278 } }] };
  const det = { params: { allowSingle: true, autoplay: false, pagination: 'pag' } };
  const s = {};
  carousel.apply({ node, s, root: { id: 'root', children: [] }, warn() {}, readAsset() { return ''; } }, det);
  assert.equal(s.type, 'slide');
  assert.equal(s.height, '330px');
  assert.equal(s.autoplay, undefined);
  assert.match(s._cssCustom, /visibility:\s*visible/);
  const many = {};
  carousel.apply({
    node: { id: 'n', box: { w: 400, h: 60 }, layout: { gap: 20 }, children: [0, 1, 2].map((i) => ({ id: 'c' + i, box: { x: i * 120, y: 0, w: 100, h: 60 } })) },
    s: many, root: { id: 'root', children: [] }, warn() {}, readAsset() { return ''; },
  }, { params: { autoplay: false } });
  assert.equal(many.type, 'loop');
  assert.equal(many.height, undefined);
});

test('a clipped row of the same card is a carousel, and the fade shapes are not slides', () => {
  const text = (id) => ({ id, type: 'TEXT', text: { characters: 'Review' }, children: [] });
  const slide = (id, x) => ({ id, name: 'Review', type: 'FRAME', box: { x, y: 0, w: 320, h: 168, absX: x, absY: 0 }, children: [text(id + 't')] });
  const fade = (id, x) => ({ id, name: 'Rectangle', type: 'RECTANGLE', box: { x, y: 0, w: 158, h: 168, absX: x, absY: 0 }, fills: [{ type: 'GRADIENT_LINEAR', stops: [{ hex: '#ffffff', alpha: 1 }, { hex: '#ffffff', alpha: 0 }] }], children: [] });
  const leftArrow = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#282829" d="M27.53 30.97L18.97 24L27.53 17Z"/></svg>';
  const rightArrow = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#282829" d="M20.47 32L29.03 24L20.47 16Z"/></svg>';
  const button = (id, x, svgText) => ({ id, name: 'Button V2', type: 'INSTANCE', componentSet: 'Button V2', svgText, box: { x, y: 0, w: 48, h: 48, absX: x, absY: 0 }, children: [] });
  const row = {
    id: 'row', name: 'Row1', type: 'FRAME', clip: true,
    layout: { mode: 'HORIZONTAL', wrap: false },
    box: { x: 0, y: 0, w: 1140, h: 168, absX: 0, absY: 0 },
    children: [fade('fadeL', 0), slide('a', -278), slide('b', 66), slide('c', 410), slide('d', 754), slide('e', 1098), fade('fadeR', 982)],
  };
  const arrows = { id: 'arrows', name: 'Indicator', type: 'FRAME', layout: { mode: 'HORIZONTAL', wrap: false }, box: { x: 500, y: 180, w: 128, h: 48, absX: 500, absY: 180 }, children: [button('drawn-left', 80, leftArrow), button('drawn-right', 0, rightArrow)] };
  const fitted = { ...row, id: 'fit', clip: true, children: [slide('f1', 0), slide('f2', 340), slide('f3', 680)] };
  const peek2 = { ...row, id: 'lower', children: [slide('g1', -200), slide('g2', 200), slide('g3', 600)] };
  const tree = { id: 'root', name: 'Section', type: 'FRAME', layout: { mode: 'VERTICAL', wrap: false }, box: { x: 0, y: 0, w: 1440, h: 400, absX: 0, absY: 0 }, children: [row, arrows, peek2, fitted] };
  const found = detectCarousels(tree);
  const hit = found.find((c) => c.node === 'row');
  assert.equal(hit.component, 'carousel');
  assert.equal(hit.params.prev, 'drawn-left');
  assert.equal(hit.params.next, 'drawn-right');
  assert.match(hit.evidence, /5 similar "Review"/);
  assert.equal(checkCites(hit.cite, tree).join(';'), '');
  assert.equal(found.find((c) => c.node === 'arrows'), undefined);
  assert.equal(found.find((c) => c.node === 'fit'), undefined);
  assert.equal(found.find((c) => c.node === 'lower').params.prev, undefined);
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
