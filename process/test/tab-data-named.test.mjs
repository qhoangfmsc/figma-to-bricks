import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { detectTabSwitches } from '../modules/recognize-parts/rules/tab-switch.mjs';
import { inspect } from '../modules/write-bricks/components/tab-switch.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';

// A course page, not a price table: a billing switch inside the title block, the plan cards under it,
// and a promo picture after the title block. The drawing alone gives the promo as the pane.
const box = (x, y, w, h) => ({ x, y, width: w, height: h });
const fill = (r, g, b) => [{ type: 'SOLID', color: { r, g, b, a: 1 } }];
const text = (id, value) => ({
  id, name: id, type: 'TEXT', characters: value, absoluteBoundingBox: box(0, 0, 90, 20),
  style: { fontFamily: 'Inter', fontSize: 14, fontWeight: 500, lineHeightPx: 20 }, fills: fill(0.1, 0.1, 0.1),
});
const frame = (id, name, rect, children, extra = {}) => ({ id, name, type: 'FRAME', absoluteBoundingBox: box(...rect), children, ...extra });
const chip = (id, label, on) => frame(id, 'Frame 7', [0, 0, 120, 36], [text(`${id}t`, label)], {
  layoutMode: 'HORIZONTAL', cornerRadius: 18, ...(on ? { fills: fill(0.05, 0.2, 0.45) } : {}),
});
const card = (id, y) => frame(id, 'Course card', [0, y, 300, 200], [text(`${id}n`, 'Khóa cơ bản'), text(`${id}p`, '1.200.000')], { layoutMode: 'VERTICAL' });

function coursePage() {
  return normalizeRoot({ nodes: { s: { document: frame('s', 'Courses', [0, 0, 960, 900], [
    frame('top', 'Top', [0, 0, 960, 600], [
      text('h', 'Học phí'),
      frame('bill', 'Frame 3', [300, 60, 360, 44], [chip('m', 'Theo tháng', true), chip('y', 'Theo năm', false), chip('q', 'Theo quý', false)], { layoutMode: 'HORIZONTAL' }),
      frame('plans', 'Frame 9', [0, 140, 960, 220], [card('k1', 0), card('k2', 0), card('k3', 0)], { layoutMode: 'HORIZONTAL' }),
      text('note', 'Giá chưa gồm VAT'),
    ], { layoutMode: 'VERTICAL' }),
    frame('promo', 'Banner', [0, 620, 960, 180], [text('pt', 'Ưu đãi mùa thu')], { fills: fill(0.9, 0.95, 1) }),
  ], { layoutMode: 'VERTICAL' }) } } }, 's', { images: {}, svgs: {} });
}

test('without a named data frame, the drawing order decides (unchanged)', () => {
  const tree = coursePage();
  const [found] = detectTabSwitches(tree);
  assert.equal(found?.component, 'tab-switch');
  const auto = inspect(tree, undefined, found.params);
  assert.equal(auto.list.id, 'bill');
  assert.equal(found.node, 's');
  assert.equal(found.params.tabs_data, 'promo');
  assert.equal(auto.paneParent?.id, 'promo');
});

test('the data frame the plan names is the tab content, and the frame after the bar stays a block', () => {
  const tree = coursePage();
  const [found] = detectTabSwitches(tree);
  const params = { ...found.params, tabs_data: 'plans' };
  const named = inspect(tree, undefined, params);
  assert.equal(named.list.id, 'bill');
  assert.equal(named.paneParent.id, 'plans');
  assert.equal(named.dataItems?.length, 3);

  const det = { components: [{ id: 'd1', component: 'tab-switch', node: 's', status: 'approved', params }] };
  const built = buildTemplate(tree, { overrides: {}, detections: det, salt: 'named' });
  const el = (id) => built.template.content.find((e) => e.id === built.mapping[id].bricksId);
  assert.equal(el('s').name, 'tabs-nested');
  assert.match(el('plans').settings._hidden?._cssClasses ?? '', /tab-content/);
  assert.doesNotMatch(el('promo').settings._hidden?._cssClasses ?? '', /tab/);
  assert.match(el('bill').settings._hidden?._cssClasses ?? '', /tab-menu/);
  const pane = built.template.content.find((e) => e.id === built.mapping['plans#open']?.bricksId);
  assert.equal(pane?.settings._direction, 'row');
  assert.doesNotMatch(pane.settings._cssCustom ?? '', /flex-direction/);
});

test('a named data frame that holds the bar is ignored', () => {
  const tree = coursePage();
  const [found] = detectTabSwitches(tree);
  const auto = inspect(tree, undefined, found.params);
  const odd = inspect(tree, undefined, { ...found.params, tabs_data: 'top' });
  assert.equal(odd.paneParent?.id, auto.paneParent?.id);
});

test('a select drawn closed: the plan names its one field as the title, other choices hide until the menu is open', () => {
  const tree = normalizeRoot({ nodes: { p: { document: frame('p', 'Phone', [0, 0, 360, 700], [
    frame('wrap', 'Frame 2', [0, 0, 360, 600], [
      frame('sel', 'Select', [16, 0, 328, 72], [
        text('lab', 'Học kỳ'),
        frame('field', 'Input', [0, 28, 328, 44], [text('fv', 'Học kỳ 1')], { layoutMode: 'HORIZONTAL', strokes: [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8, a: 1 } }], strokeWeight: 1 }),
      ], { layoutMode: 'VERTICAL' }),
      frame('list', 'Frame 5', [0, 100, 360, 400], [card('c1', 0), card('c2', 0)], { layoutMode: 'HORIZONTAL' }),
    ], { layoutMode: 'VERTICAL' }),
  ], { layoutMode: 'VERTICAL' }) } } }, 'p', { images: {}, svgs: {} });
  const params = { tabs_bar: 'sel', tabs_data: 'list', tabs_titles: ['field'] };
  const found = inspect(tree.children[0], undefined, params);
  assert.equal(found.titles.length, 1);
  assert.equal(found.paneParent.id, 'list');
  const det = { components: [{ id: 'd1', component: 'tab-switch', node: 'wrap', status: 'approved', params }] };
  const built = buildTemplate(tree, { overrides: {}, detections: det, salt: 'sel' });
  const el = (id) => built.template.content.find((e) => e.id === built.mapping[id].bricksId);
  assert.equal(el('wrap').name, 'tabs-nested');
  assert.match(el('sel').settings._hidden._cssClasses, /tab-menu/);
  assert.match(el('field').settings._hidden._cssClasses, /tab-title/);
  assert.match(el('sel').settings._cssCustom, /:not\(\.is-open\) \.tab-title:not\(\.brx-open\):not\(\[aria-selected="true"\]\) \{ display: none; \}/);
  assert.match(el('sel').settings._cssCustom, /\.is-open \{ height: 72px; position: relative; z-index: 10; justify-content: flex-start; \}/);
  assert.equal(inspect(tree.children[0], undefined, { tabs_bar: 'sel', tabs_data: 'list', tabs_titles: ['nope'] })?.titles?.length ?? 0, 0);
});

test('a pill drawn with a gradient on the open title and a flat fill on the others: each state sets its own image', async () => {
  const { activeLook } = await import('../modules/write-bricks/components/states.mjs');
  const pill = (id, fills) => ({ id, type: 'FRAME', name: 'Tag', box: { x: 0, y: 0, w: 60, h: 20 }, fills, children: [] });
  const rest = { id: 'r', type: 'FRAME', name: 'Opt', box: { w: 120, h: 36 }, fills: [], children: [pill('rp', [{ type: 'SOLID', hex: '#22aa55', alpha: 0.1 }])] };
  const on = { id: 'o', type: 'FRAME', name: 'Opt', box: { w: 120, h: 36 }, fills: [], children: [pill('op', [{ type: 'GRADIENT_LINEAR', handles: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0, y: 1 }], stops: [{ position: 0, hex: '#22aa55', alpha: 1 }, { position: 1, hex: '#88eeaa', alpha: 1 }] }])] };
  const { css } = activeLook(rest, on);
  const idle = css.filter((c) => c.suffix === ' .f2b-s-0').map((c) => c.decl).join(' ');
  const open = css.filter((c) => c.suffix === '.brx-open .f2b-s-0').map((c) => c.decl).join(' ');
  assert.match(idle, /background-image: none !important;/);
  assert.match(idle, /background-color: rgba\(34, 170, 85, 0\.1\)/);
  assert.match(open, /background-image: linear-gradient\(/);
  assert.match(open, /background-color: transparent/);
});
