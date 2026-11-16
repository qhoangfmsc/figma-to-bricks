import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { applyBinding, tagsIn, textLookup, unloopedTags, validateBinding } from '../modules/data-binding/index.mjs';

// A course catalog from an LMS plugin, not a price table: semesters x courses, tags `{lms_*}`.
const box = (x, y, w, h) => ({ x, y, width: w, height: h });
const fill = (r, g, b) => [{ type: 'SOLID', color: { r, g, b, a: 1 } }];
const text = (id, value, extra = {}) => ({
  id, name: id, type: 'TEXT', characters: value, absoluteBoundingBox: box(0, 0, 120, 20),
  style: { fontFamily: 'Inter', fontSize: 14, fontWeight: 400, lineHeightPx: 20 }, fills: fill(0.1, 0.1, 0.1), ...extra,
});
const frame = (id, name, rect, children, extra = {}) => ({ id, name, type: 'FRAME', absoluteBoundingBox: box(...rect), children, ...extra });
const twoRuns = (id, a, b) => text(id, a + b, {
  characterStyleOverrides: [...a].map(() => 1).concat([...b].map(() => 0)),
  styleOverrideTable: { 1: { fontWeight: 700 } },
});
const course = (id) => frame(id, 'Course', [0, 0, 280, 160], [
  text(`${id}n`, 'Lập trình Web'),
  twoRuns(`${id}f`, 'Học phí: ', '3.000.000'),
  frame(`${id}b`, 'Badge', [0, 0, 60, 20], [text(`${id}bt`, 'Mới')], { fills: fill(1, 0.9, 0.8) }),
], { layoutMode: 'VERTICAL' });

const textOf = (tree) => (id) => { const walk = (n) => (n.id === id ? n : (n.children ?? []).map(walk).find(Boolean)); return walk(tree)?.text ?? null; };

function catalog() {
  return normalizeRoot({ nodes: { c: { document: frame('c', 'Catalog', [0, 0, 960, 400], [
    frame('row', 'Frame 4', [0, 0, 960, 200], [course('a'), course('b'), course('d')], { layoutMode: 'HORIZONTAL' }),
  ], { layoutMode: 'VERTICAL' }) } } }, 'c', { images: {}, svgs: {} });
}

const provider = {
  queries: [{ kind: 'course', type: 'lms_course__fall' }, { kind: 'term', type: 'lms_term__fall' }],
  tags: [
    { tag: '{lms_title}', needs: ['course'] },
    { tag: '{lms_fee}', needs: ['course', 'term'] },
    { tag: '{lms_badge}', needs: ['course'] },
    { tag: '{lms_url}', needs: ['course'] },
  ],
};
const bind = () => ({
  source: 'LMS catalog fall (test listing)',
  provider,
  loops: [{ node: 'a', query: 'lms_course__fall', drop: ['b', 'd'], reason: 'one card per course' }],
  text: [
    { node: 'an', value: '{lms_title}', reason: 'course name' },
    { node: 'af', runs: ['Học phí: ', '{lms_fee}'], reason: 'fee keeps the bold label run' },
    { node: 'abt', value: '{lms_badge}', reason: 'badge' },
  ],
  attrs: [{ node: 'a', name: 'data-course', value: '{lms_title}', reason: 'attribute for a script' }],
  links: [{ node: 'a', tag: '{lms_url}', reason: 'card link' }],
  hideEmpty: [{ node: 'ab', tag: '{lms_badge}', reason: 'no badge, no pill' }],
});

test('tags are read with their arguments', () => {
  assert.deepEqual(tagsIn('a {lms_fee:t=2:raw} b').map((t) => [t.name, t.args]), [['lms_fee', ['t=2', 'raw']]]);
});

test('a binding the source does not list, or without a reason, is refused', () => {
  const ids = new Set(['c', 'row', 'a', 'b', 'd', 'an', 'af', 'abt', 'ab']);
  const has = (id) => ids.has(id);
  assert.ok(validateBinding(bind(), has).length >= 4);
  assert.throws(() => validateBinding({ ...bind(), text: [{ node: 'an', value: '{lms_price}', reason: 'x' }] }, has), /not a tag/);
  assert.throws(() => validateBinding({ ...bind(), loops: [{ node: 'a', query: 'lms_course__spring', reason: 'x' }] }, has), /not a query type/);
  assert.throws(() => validateBinding({ ...bind(), links: [{ node: 'a', tag: '{lms_url}' }] }, has), /reason/);
  assert.throws(() => validateBinding({ ...bind(), text: [{ node: 'zz', value: '{lms_title}', reason: 'x' }] }, has), /not in the tree/);
});

test('one drawn item loops, the drawn copies go, words become tags with their run styles', () => {
  const tree = catalog();
  const b = bind();
  const built = buildTemplate(tree, { overrides: {}, salt: 'lms' });
  const mapping = built.mapping;
  const { removed } = applyBinding(built.template, [mapping], b, textOf(tree));
  const el = (id) => built.template.content.find((e) => e.id === mapping[id]?.bricksId);
  const card = el('a');
  assert.equal(card.settings.hasLoop, true);
  assert.deepEqual(card.settings.query, { objectType: 'lms_course__fall' });
  assert.deepEqual(card.settings.link, { type: 'meta', useDynamicData: '{lms_url}' });
  assert.deepEqual(card.settings._attributes.at(-1), { name: 'data-course', value: '{lms_title}' });
  assert.ok(removed >= 2);
  assert.equal(mapping.b.bricksId, undefined);
  assert.match(mapping.b.skipped, /data loop/);
  assert.ok(!built.template.content.some((e) => e.parent && !built.template.content.some((p) => p.id === e.parent) && e.parent !== 0));
  assert.match(el('an').settings.text, /\{lms_title\}/);
  const fee = el('af').settings.text;
  assert.match(fee, /Học phí: /);
  assert.match(fee, /\{lms_fee\}/);
  assert.deepEqual(el('ab').settings._conditions, [[{ key: 'dynamic_data', compare: '!=', value: '', dynamic_data: '{lms_badge}' }]]);
});

test('a run count that differs from the drawing stops the build', () => {
  const tree = catalog();
  const built = buildTemplate(tree, { overrides: {}, salt: 'lms' });
  assert.throws(() => applyBinding(built.template, [built.mapping], { text: [{ node: 'af', runs: ['{lms_fee}'], reason: 'x' }] }, textOf(tree)), /style run/);
});

test('a tag whose dimension has no loop above it is listed', () => {
  const tree = catalog();
  const b = bind();
  const built = buildTemplate(tree, { overrides: {}, salt: 'lms' });
  applyBinding(built.template, [built.mapping], b, textOf(tree));
  const loose = unloopedTags(built.template, b);
  assert.ok(loose.some((u) => u.tag === '{lms_fee}' && u.missing.join() === 'term'));
  assert.ok(!loose.some((u) => u.tag === '{lms_title}'));
});

test('words bound after render keep recognition on the drawn words', () => {
  const tree = catalog();
  const built = buildTemplate(tree, { overrides: {}, salt: 'lms' });
  const before = built.template.content.map((e) => e.name).join();
  applyBinding(built.template, [built.mapping], { text: [{ node: 'an', value: '{lms_title}', reason: 'x' }] }, textOf(tree));
  assert.equal(built.template.content.map((e) => e.name).join(), before);
  assert.equal(tree.children[0].children[0].children[0].text.characters, 'Lập trình Web');
});

test('a component that holds its one label takes the words on its own element', () => {
  const tree = catalog();
  const look = textLookup([tree]);
  assert.equal(look('ab').characters, 'Mới');
  assert.equal(look('a'), null);
});

test('a looped tab title and pane: no clone carries the drawn open class, the first one looks open', () => {
  const content = [
    { id: 'tabs', name: 'tabs-nested', parent: 0, settings: {} },
    { id: 'menu', name: 'block', parent: 'tabs', settings: { _hidden: { _cssClasses: 'tab-menu' }, _cssCustom: '#brxe-menu .tab-title.brx-open { background-color: #123456; }' } },
    { id: 'ttl', name: 'block', parent: 'menu', settings: { _hidden: { _cssClasses: 'tab-title' }, _cssCustom: '#brxe-ttl.brx-open .lbl { color: #fff; }' } },
    { id: 'body', name: 'block', parent: 'tabs', settings: { _hidden: { _cssClasses: 'tab-content' } } },
    { id: 'pane', name: 'block', parent: 'body', settings: { _hidden: { _cssClasses: 'tab-pane brx-open' }, _cssCustom: '#brxe-pane { gap: 4px; } #brxe-pane.brx-open { display: grid; }' } },
  ];
  const template = { content };
  const mapping = { t: { bricksId: 'ttl' }, p: { bricksId: 'pane' } };
  const b = { source: 's', provider, loops: [{ node: 't', query: 'lms_term__fall', reason: 'x' }, { node: 'p', query: 'lms_term__fall', reason: 'x' }] };
  applyBinding(template, [mapping], b);
  const by = (id) => content.find((e) => e.id === id).settings;
  assert.equal(by('pane')._hidden._cssClasses, 'tab-pane');

  assert.match(by('ttl')._cssCustom, /#brxe-ttl:is\(\.brx-open, \[aria-selected="true"\]\) \.lbl/);
  assert.match(by('menu')._cssCustom, /\.tab-title:is\(\.brx-open, \[aria-selected="true"\]\)/);
});

test('a layer the instance hides is built when bound, and a layer drawn on one item shows on that clone only', async () => {
  const { showDrawnLayers } = await import('../modules/data-binding/index.mjs');
  const tree = catalog();
  const badge = tree.children[0].children[0].children[2];
  badge.visible = false;
  assert.equal(showDrawnLayers(tree, { show: [{ node: 'ab', reason: 'x' }] }), 1);
  assert.equal(badge.visible, true);
  assert.throws(() => showDrawnLayers(tree, { show: [{ node: 'ab', reason: 'x' }] }), /not hidden/);
  const built = buildTemplate(tree, { overrides: {}, salt: 'lms' });
  const b = { ...bind(), onlyAt: [{ node: 'ab', loop: 'a', index: 1, reason: 'drawn on the second course' }] };
  applyBinding(built.template, [built.mapping], b, textOf(tree));
  const card = built.template.content.find((e) => e.id === built.mapping.a.bricksId);
  const pill = built.mapping.ab.bricksId;
  assert.match(card.settings._cssCustom, new RegExp(`\\.brxe-${card.id}:not\\(:nth-of-type\\(2\\)\\) :is\\(#brxe-${pill}, \\.brxe-${pill}\\) \\{ display: none; \\}`));
  assert.throws(() => validateBinding({ ...b, onlyAt: [{ node: 'ab', loop: 'row', index: 0, reason: 'x' }] }, () => true), /not in loops/);
});
