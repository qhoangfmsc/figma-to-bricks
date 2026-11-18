import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { applyBinding, nodeLookup, textLookup, validateBinding } from '../modules/data-binding/index.mjs';

// A conference timetable from an events plugin, not a price table: days > sessions > rooms, tags `{ev_*}`.
// The main hall column is drawn with its own fill; a day shows its first two sessions until opened.
const box = (x, y, w, h) => ({ x, y, width: w, height: h });
const fill = (r, g, b) => [{ type: 'SOLID', color: { r, g, b, a: 1 } }];
const text = (id, value) => ({
  id, name: id, type: 'TEXT', characters: value, absoluteBoundingBox: box(0, 0, 100, 20),
  style: { fontFamily: 'Inter', fontSize: 14, fontWeight: 400, lineHeightPx: 20 }, fills: fill(0.1, 0.1, 0.1),
});
const frame = (id, name, rect, children, extra = {}) => ({ id, name, type: 'FRAME', absoluteBoundingBox: box(...rect), children, ...extra });
const room = (id, x, extra = {}) => frame(id, 'Room', [x, 0, 150, 40], [text(`${id}t`, 'Phòng A')], { layoutMode: 'HORIZONTAL', ...extra });
const session = (id, y) => frame(id, 'Session', [0, y, 600, 40], [
  frame(`${id}l`, 'Label', [0, 0, 150, 40], [text(`${id}lt`, 'Khai mạc')]),
  room(`${id}r1`, 150), room(`${id}r2`, 300, { fills: fill(1, 0.95, 0.8) }), room(`${id}r3`, 450),
], { layoutMode: 'HORIZONTAL' });
const day = (id, y) => frame(id, 'Day', [0, y, 600, 200], [
  text(`${id}h`, 'Ngày 1'), session(`${id}s1`, 40), session(`${id}s2`, 80), session(`${id}s3`, 120),
  frame(`${id}m`, 'More', [0, 160, 600, 20], [text(`${id}mt`, 'Xem lịch đầy đủ')]),
  frame(`${id}x`, 'Less', [0, 180, 600, 20], [text(`${id}xt`, 'Ẩn bớt')]),
], { layoutMode: 'VERTICAL' });

function timetable() {
  return normalizeRoot({ nodes: { t: { document: frame('t', 'Timetable', [0, 0, 600, 500], [
    frame('wrap', 'Wrap', [0, 0, 600, 420], [day('d1', 0), day('d2', 210)], { layoutMode: 'VERTICAL', clipsContent: true }),
  ], { layoutMode: 'VERTICAL' }) } } }, 't', { images: {}, svgs: {} });
}

const provider = {
  queries: [{ kind: 'day', type: 'ev_day__summit' }, { kind: 'session', type: 'ev_session__summit' }, { kind: 'room', type: 'ev_room__summit' }],
  tags: [{ tag: '{ev_day}', needs: ['day'] }, { tag: '{ev_session}', needs: ['session'] }, { tag: '{ev_room}', needs: ['room', 'session'] }],
};
const bind = (extra = {}) => ({
  source: 'Events plugin, summit timetable (test listing)',
  provider,
  loops: [
    { node: 'd1', query: 'ev_day__summit', drop: ['d2'], reason: 'one block per day' },
    { node: 'd1s1', query: 'ev_session__summit', drop: ['d1s2', 'd1s3'], reason: 'one row per session' },
    { node: 'd1s1r1', query: 'ev_room__summit', drop: ['d1s1r3'], reason: 'one cell per room' },
  ],
  ...extra,
});

function built(extra) {
  const tree = timetable();
  const out = buildTemplate(tree, { overrides: {}, salt: 'ev' });
  const b = bind(extra);
  validateBinding(b, (id) => !!nodeLookup([tree])(id));
  const res = applyBinding(out.template, [out.mapping], b, textLookup([tree]), nodeLookup([tree]));
  const el = (id) => out.template.content.find((e) => e.id === out.mapping[id]?.bricksId);
  return { ...out, el, res };
}

test('a drawn copy with its own look loops too and shows only at its drawn place; the plain item hides there', () => {
  const { el } = built({ twin: [{ node: 'd1s1r2', loop: 'd1s1r1', reason: 'main hall drawn with its own fill' }] });
  const a = el('d1s1r1');
  const b = el('d1s1r2');
  assert.equal(b.settings.hasLoop, true);
  assert.equal(b.settings.query.objectType, 'ev_room__summit');
  const css = a.settings._cssCustom;
  const A = `.brxe-${a.id}`;
  const B = `.brxe-${b.id}`;
  // no `:nth-child(2 of ...)`: a minifier joins "2 of" and the rule is lost
  assert.doesNotMatch(css, /nth-child/);
  assert.ok(css.includes(`${A} ~ ${A}:not(${A} ~ ${A} ~ ${A}) { display: none !important; }`));
  assert.ok(css.includes(`:is(${B}:not(${B} ~ ${B}), ${B} ~ ${B} ~ ${B}) { display: none !important; }`));
  assert.ok(css.includes(`${B} { order: 1; }`));
  assert.ok(css.includes(`${A} ~ ${A} ~ ${A} { order: 2; }`));
  assert.equal(el('d1s1r3'), undefined);
  assert.throws(() => validateBinding(bind({ twin: [{ node: 'd1s1r3', loop: 'd1s1r1', reason: 'x' }] }), () => true), /not a dropped copy/);
});

test('a glyph drawn as icon-font text keeps its size, colour and alignment when the source names the icon', () => {
  const { el } = built({ icons: [{ node: 'd1s1r1t', tag: '{ev_room}', reason: 'room icon from the source' }] });
  const ty = el('d1s1r1t').settings._typography;
  assert.equal(ty['font-size'], '14px');
  assert.equal(ty['line-height'], '20px');
  assert.equal(ty.color.hex, '#1a1a1a');
});

test('a twin drawn before the plain item still takes its drawn place', () => {
  const { el } = built({
    loops: [
      { node: 'd1', query: 'ev_day__summit', drop: ['d2'], reason: 'one block per day' },
      { node: 'd1s1', query: 'ev_session__summit', drop: ['d1s2', 'd1s3'], reason: 'one row per session' },
      { node: 'd1s1r3', query: 'ev_room__summit', drop: ['d1s1r1'], reason: 'the last drawn room is the plain item' },
    ],
    twin: [{ node: 'd1s1r2', loop: 'd1s1r3', reason: 'main hall' }],
  });
  const a = el('d1s1r3');
  const b = el('d1s1r2');
  const A = `.brxe-${a.id}`;
  const css = a.settings._cssCustom;
  assert.ok(css.includes(`${A} ~ ${A}:not(${A} ~ ${A} ~ ${A}) { display: none !important; }`));
  assert.ok(css.includes(`.brxe-${b.id} { order: 1; }`));
  assert.ok(css.includes(`${A} ~ ${A} ~ ${A} { order: 2; }`));
  assert.doesNotMatch(css, new RegExp(`brxe-${a.id}\\) \\{ order: 3`));
});

test('looped columns share the row, or keep their drawn width and scroll', () => {
  const share = built({ columns: [{ node: 'd1s1r1', mode: 'share', reason: 'more rooms than drawn stay in the row' }] }).el('d1s1r1');
  assert.match(share.settings._cssCustom, /flex: 1 1 150px !important; min-width: 0 !important;/);
  const scroll = built({ columns: [{ node: 'd1s1r1', mode: 'scroll', reason: 'phone: rooms scroll' }] }).el('d1s1r1');
  assert.match(scroll.settings._cssCustom, /flex: 1 0 150px !important; min-width: 150px !important;/);
  assert.throws(() => validateBinding(bind({ columns: [{ node: 'd1s1r1', mode: 'wrap', reason: 'x' }] }), () => true), /share or scroll/);
});

test('a sideways scrolling frame: rows as wide as their content, a pinned label stays at the frame width', () => {
  const { el } = built({ slider: [{ node: 'wrap', pin: ['d1s1l'], reason: 'phone timetable' }] });
  const css = el('wrap').settings._cssCustom;
  const w = el('wrap').id;
  const pin = el('d1s1l').id;
  assert.match(css, /overflow-x: auto !important; container-type: inline-size;/);
  assert.match(css, new RegExp(`:is\\(#brxe-${w}, \\.brxe-${w}\\) > \\* \\{ width: min-content !important; min-width: 100% !important;`));
  assert.match(css, new RegExp(`:is\\(#brxe-${pin}, \\.brxe-${pin}\\) \\{ position: sticky; left: 0;[^}]*width: 100cqw !important;`));
});

test('a day shows its first rows until opened; the controls follow the state; the day drawn open has none', () => {
  const { el } = built({ collapse: [{ node: 'd1', rows: 'd1s1', keep: 2, more: 'd1m', less: 'd1x', className: 'is-open', open: [0], reason: 'day drawn with two sessions and a more link' }] });
  const g = el('d1').id;
  const r = el('d1s1').id;
  const more = el('d1m').id;
  const less = el('d1x').id;
  const css = el('d1').settings._cssCustom;
  const G = `.brxe-${g}`;
  const R = `.brxe-${r}`;
  assert.ok(css.includes(`${G}:not(.is-open):not(${G}:not(${G} ~ ${G})) ${R} ~ ${R} ~ ${R} { display: none !important; }`));
  assert.ok(css.includes(`${G}.is-open :is(:is(#brxe-${more}, .brxe-${more})) { display: none !important; }`));
  assert.ok(css.includes(`${G}:not(.is-open) :is(:is(#brxe-${less}, .brxe-${less})) { display: none !important; }`));
  assert.ok(css.includes(`${G}:not(:has(${R} ~ ${R} ~ ${R}))`));
  assert.ok(css.includes(`${G}:not(${G} ~ ${G}) :is(`));
  assert.throws(() => validateBinding(bind({ collapse: [{ node: 'd1m', rows: 'd1s1', keep: 2, className: 'is-open', reason: 'x' }] }), () => true), /are loops/);
});

test('a layer shown for the source takes the paint and picture the same component layer has where it is visible', async () => {
  const { showDrawnLayers } = await import('../modules/data-binding/index.mjs');
  const tree = { id: 't', children: [
    { id: 'I1:1;5:5', visible: false, children: [{ id: 'I1:1;5:5;6:6', text: { characters: 'arrow-down' }, children: [] }] },
    { id: 'I2:2;5:5', children: [{ id: 'I2:2;5:5;6:6', text: { characters: 'arrow-down' }, fills: [{ type: 'SOLID', hex: '#0055aa' }], svg: { file: 'svg/I2_2_5_5_6_6.svg' } }] },
    { id: 'I4:4;5:5', visible: false, children: [{ id: 'I4:4;5:5;6:6', text: { characters: 'arrow-down' }, fills: [{ type: 'SOLID', hex: '#ff0000' }], svg: { file: 'svg/hidden.svg' } }] },
    { id: 'I3:3;7:7', visible: false, children: [{ id: 'I3:3;7:7;6:6', text: { characters: 'Đóng' }, children: [] }] },
  ] };
  showDrawnLayers(tree, { show: [{ node: 'I1:1;5:5', reason: 'x' }, { node: 'I3:3;7:7', reason: 'x' }] });
  assert.equal(tree.children[0].children[0].svg.file, 'svg/I2_2_5_5_6_6.svg');
  assert.equal(tree.children[0].children[0].fills[0].hex, '#0055aa');
  assert.equal(tree.children[3].children[0].svg, undefined);
});

test('a bound text drops the fixed box the drawn words had; a fixed icon class is allowed', () => {
  const tree = timetable();
  const n = nodeLookup([tree])('d1s1r1t');
  n.sizing = { h: 'FIXED', v: 'FIXED' };
  const out = buildTemplate(tree, { overrides: {}, salt: 'ev' });
  const el = out.template.content.find((e) => e.id === out.mapping.d1s1r1t.bricksId);
  el.settings._width = '62px';
  el.settings._height = '30px';
  const b = bind({ text: [{ node: 'd1s1r1t', value: '{ev_room}', reason: 'room name' }], icons: [{ node: 'd1ht', className: 'fa-solid fa-angles-up', reason: 'x' }] });
  b.loops = b.loops.slice(0, 1);
  applyBinding(out.template, [out.mapping], b, textLookup([tree]), nodeLookup([tree]));
  assert.equal(el.settings._width, undefined);
  assert.equal(el.settings._height, undefined);
  assert.equal(el.settings._widthMax, '100%');
  assert.throws(() => validateBinding(bind({ icons: [{ node: 'd1s1r1t', className: 'x{y}', reason: 'x' }] }), () => true), /className/);
});

test('the owner names the featured position: the twin shows there, not at its drawn place', () => {
  const { el } = built({ twin: [{ node: 'd1s1r2', loop: 'd1s1r1', index: 0, reason: 'owner: the first room is the main hall' }] });
  const a = el('d1s1r1');
  const A = `.brxe-${a.id}`;
  assert.ok(a.settings._cssCustom.includes(`${A}:not(${A} ~ ${A}) { display: none !important; }`));
  assert.ok(a.settings._cssCustom.includes(`${A} ~ ${A} { order: 2; }`));
});

test('a note shown on hover: it hugs the source words, opens above on the last row, and a frame without it gets a copy under the trigger', () => {
  // the drawn note sits in the day block; its trigger is the session label; a second trigger lives in the "phone" day
  const tree = timetable();
  const of = nodeLookup([tree]);
  const note = { id: 'note', name: 'Note', type: 'FRAME', visible: true, box: { x: 0, y: 0, w: 140, h: 90, absX: 20, absY: 70 }, sizing: { h: 'FIXED', v: 'HUG' }, children: [] };
  of('d1').children.push(note);
  of('d1s1l').box = { ...of('d1s1l').box, absX: 0, absY: 40, w: 150, h: 40 };
  of('d1s1lt').box = { ...of('d1s1lt').box, absX: 10, absY: 50, w: 100, h: 20 };
  of('d1s2lt').box = { ...of('d1s2lt').box, absX: 10, absY: 90, w: 100, h: 20 };
  const out = buildTemplate(tree, { overrides: {}, salt: 'ev' });
  const of2 = nodeLookup([tree]);
  const b = bind({
    loops: [{ node: 'd1', query: 'ev_day__summit', drop: [], reason: 'x' }, { node: 'd1s1', query: 'ev_session__summit', drop: ['d1s3'], reason: 'x' }],
    collapse: [{ node: 'd1', rows: 'd1s1', keep: 2, className: 'is-open', reason: 'x' }],
    hoverShow: [
      { node: 'note', trigger: 'd2s1lt', copy: true, reason: 'phone frame draws no note' },
      { node: 'note', trigger: 'd1s1lt', anchor: 'd1s1lt', flipUp: 'd1s1', reason: 'note drawn under the first label' },
    ],
  });
  validateBinding(b, (id) => !!of2(id));
  const elOf = (id) => out.template.content.find((e) => e.id === out.mapping[id]?.bricksId);
  elOf('note').settings._height = '90px';
  applyBinding(out.template, [out.mapping], b, textLookup([tree]), of2);
  const n = elOf('note');
  assert.equal(n.settings._height, undefined);
  const R = `.brxe-${elOf('d1s1').id}`;
  const G = `.brxe-${elOf('d1').id}`;
  assert.ok(n.settings._cssCustom.includes(`:is(${R}:not(:has(~ ${R})), ${G}:not(.is-open) ${R} ~ ${R}:not(${R} ~ ${R} ~ ${R})) :is(#brxe-${n.id}, .brxe-${n.id}) { top: auto !important; bottom: 30px !important; }`));
  const copy = out.template.content.find((e) => e.parent === elOf('d2s1lt').parent && e.label === n.label && e.id !== n.id);
  assert.ok(copy, 'a copy of the note sits beside the phone trigger');
  assert.equal(copy.settings._top, '100%');
  assert.equal(copy.settings._position, 'absolute');
  assert.match(copy.settings._cssCustom, new RegExp(`:has\\(:is\\(#brxe-${elOf('d2s1lt').id}, \\.brxe-${elOf('d2s1lt').id}\\):hover\\)`));
});

test('a glyph takes its colour from another drawn copy when this frame keeps the default', () => {
  const tree = timetable();
  const of = nodeLookup([tree]);
  of('d2s1r1t').fills = [{ type: 'SOLID', hex: '#00aa55' }];
  const out = buildTemplate(tree, { overrides: {}, salt: 'ev' });
  const b = bind({ icons: [{ node: 'd1s1r1t', tag: '{ev_room}', paintFrom: 'd2s1r1t', reason: 'x' }] });
  b.loops = b.loops.slice(0, 1);
  validateBinding(b, (id) => !!of(id));
  applyBinding(out.template, [out.mapping], b, textLookup([tree]), of);
  assert.equal(out.template.content.find((e) => e.id === out.mapping.d1s1r1t.bricksId).settings._typography.color.hex, '#00aa55');
});

test('a note beside a trigger centred in its row is placed from the row middle, so a taller row keeps it beside the trigger', () => {
  const tree = timetable();
  const of = nodeLookup([tree]);
  of('d1').children.push({ id: 'note', name: 'Note', type: 'FRAME', visible: true, box: { x: 0, y: 0, w: 140, h: 90, absX: 20, absY: 68 }, sizing: { h: 'FIXED', v: 'HUG' }, children: [] });
  of('d1s1l').box = { ...of('d1s1l').box, absX: 0, absY: 40, w: 150, h: 40 };
  of('d1s1l').layout = { mode: 'HORIZONTAL', counterAlign: 'CENTER', padding: { top: 0, right: 0, bottom: 0, left: 0 } };
  of('d1s1lt').box = { ...of('d1s1lt').box, absX: 10, absY: 50, w: 100, h: 20 };
  const out = buildTemplate(tree, { overrides: {}, salt: 'ev' });
  const b = bind({ loops: [{ node: 'd1s1', query: 'ev_session__summit', drop: ['d1s2', 'd1s3'], reason: 'x' }], hoverShow: [{ node: 'note', trigger: 'd1s1lt', anchor: 'd1s1lt', flipUp: 'd1s1', reason: 'x' }] });
  applyBinding(out.template, [out.mapping], b, textLookup([tree]), nodeLookup([tree]));
  const n = out.template.content.find((e) => e.id === out.mapping.note.bricksId);
  assert.equal(n.settings._top, 'calc(50% + 8px)');
  assert.match(n.settings._cssCustom, /top: auto !important; bottom: calc\(50% \+ 8px\) !important;/);
  assert.match(n.settings._cssCustom, /:hover\) \{ z-index: 2; \}/);
});

test('a yes / no cell: each drawn icon shows only for its answer', () => {
  const { el } = built({ showWhen: [{ node: 'd1s1r1t', tag: '{ev_room}', value: 'main', reason: 'x' }] });
  assert.deepEqual(el('d1s1r1t').settings._conditions, [[{ key: 'dynamic_data', compare: '==', value: 'main', dynamic_data: '{ev_room}' }]]);
  assert.throws(() => validateBinding(bind({ showWhen: [{ node: 'd1s1r1t', tag: '{ev_room}', value: '{ev_day}', reason: 'x' }] }), () => true), /plain text/);
});

test('a glyph colour the owner names', () => {
  const { el } = built({ icons: [{ node: 'd1s1r1t', className: 'fa-solid fa-xmark', color: '#C0392B', reason: 'owner: closed room in red' }] });
  assert.equal(el('d1s1r1t').settings._typography.color.hex, '#c0392b');
  assert.equal(el('d1s1r1t').settings._typography['font-family'], undefined);
  assert.equal(el('d1s1r1t').settings._typography['font-weight'], undefined);
  assert.throws(() => validateBinding(bind({ icons: [{ node: 'd1s1r1t', className: 'x', color: 'red', reason: 'x' }] }), () => true), /#rrggbb/);
});

test('a note built in another section is copied beside each trigger, wrapped to the trigger size, its tags renamed', () => {
  // the other section: a speaker card whose info icon shows a note with an arrow, words from {spk_bio}
  const other = normalizeRoot({ nodes: { s: { document: frame('s', 'Speakers', [0, 0, 400, 300], [
    frame('row', 'Row', [0, 0, 400, 40], [frame('ic', 'Info', [100, 10, 20, 20], [])], { layoutMode: 'HORIZONTAL' }),
    frame('tip', 'Tip', [60, 40, 160, 60], [frame('arr', 'Arrow', [102, 40, 16, 8], []), text('tipt', '{spk_bio}')], { layoutMode: 'VERTICAL', fills: fill(1, 1, 1) }),
  ], { layoutMode: 'VERTICAL' }) } } }, 's', { images: {}, svgs: {} });
  const otherBuilt = buildTemplate(other, { overrides: {}, salt: 'spk' });
  const tipEl = otherBuilt.template.content.find((e) => e.id === otherBuilt.mapping.tip.bricksId);
  tipEl.settings._cssCustom = ':is(#brxe-zzzzzz) { color: red; }';
  const tree = timetable();
  const out = buildTemplate(tree, { overrides: {}, salt: 'ev' });
  const of = nodeLookup([tree, other]);
  const b = bind({ hoverShow: [{ node: 'tip', from: 'spkFile/1-2', anchor: 'ic', pointer: 'arr', trigger: 'd1s1lt', retag: { '{spk_bio}': '{ev_room}' }, reason: 'owner: same note as the speakers' }] });
  b.loops = b.loops.slice(0, 2);
  validateBinding(b, (id) => !!of(id));
  applyBinding(out.template, [out.mapping], b, textLookup([tree]), of, { 'spkFile/1-2': { content: otherBuilt.template.content, mapping: otherBuilt.mapping } });
  const trig = out.template.content.find((e) => e.id === out.mapping.d1s1lt.bricksId);
  const wrap = out.template.content.find((e) => e.id === trig.parent);
  assert.equal(wrap.settings._position, 'relative');
  const copy = out.template.content.find((e) => e.parent === wrap.id && e.id !== trig.id);
  assert.equal(copy.settings._position, 'absolute');
  assert.equal(copy.settings._top, '30px'); // trigger 20 high + the drawn 10px gap under the icon
  assert.equal(copy.settings._left, '0px'); // arrow centre (110 - 60 = 50) over the trigger centre (100 / 2)
  assert.doesNotMatch(copy.settings._cssCustom ?? '', /zzzzzz/);
  assert.match(JSON.stringify(out.template.content.filter((e) => e.parent === copy.id)), /\{ev_room\}/);
  assert.throws(() => validateBinding(bind({ hoverShow: [{ node: 'tip', from: 'spkFile/1-2', trigger: 'd1s1lt', reason: 'x' }] }), () => true), /anchor/);
});

test('a link on a layout block makes it an <a>: Bricks prints a block link only with tag a', () => {
  const { el } = built({ links: [{ node: 'd1s1r1', tag: '{ev_room}', reason: 'room page' }] });
  const room = el('d1s1r1');
  assert.equal(room.name, 'block');
  assert.equal(room.settings.tag, 'a');
  assert.deepEqual(room.settings.link, { type: 'meta', useDynamicData: '{ev_room}' });
});

test('a stuck day heading: CSS sticky on the page; in a sideways slider it leaves the scroller and scrolls in step', () => {
  const page = built({ stick: [{ node: 'd1h', top: '64px', background: '#fafafa', reason: 'organiser: day name stays in view' }] });
  const css = page.el('d1h').settings._cssCustom;
  assert.match(css, /position: sticky; top: 64px; z-index: 3; background-color: #fafafa;/);
  assert.equal(page.template.scripts, undefined);

  // Phone: each day scrolls sideways, its name stays in view. CSS sticky follows the nearest scroller, so the
  // day's sessions move into a new scrolling block; the name keeps native sticky and scrolls sideways in step.
  const phone = built({
    slider: [{ node: 'd1', reason: 'phone timetable' }],
    stick: [{ node: 'd1h', top: '56px', background: '#ffffff', reason: 'organiser: day name stays in view' }],
  });
  const day = phone.el('d1');
  const head = phone.el('d1h');
  const rows = phone.template.content.find((e) => e.parent === day.id && e.id !== head.id);
  assert.equal(phone.template.content.filter((e) => e.parent === day.id).length, 2);
  assert.match(head.settings._cssCustom, /position: sticky; top: 56px; z-index: 3; background-color: #ffffff; width: 100% !important;.*overflow-x: auto !important;/);
  assert.equal(phone.el('d1s1').parent, rows.id);
  assert.equal(phone.el('d1m').parent, rows.id);
  assert.match(rows.settings._cssCustom, /overflow-x: auto !important; container-type: inline-size;/);
  assert.doesNotMatch(day.settings._cssCustom ?? '', /overflow-x/);
  for (const e of [head, rows]) assert.ok(e.settings._attributes.some((x) => x.name === 'data-f2b-sync'));
  assert.equal(phone.template.scripts.length, 1);
  assert.doesNotMatch(phone.template.scripts.join(''), /<script/); // the push wraps all page scripts in one tag

  // Deeper inside a slider the layer cannot leave the scroller: stop.
  assert.throws(() => built({ slider: [{ node: 'wrap', reason: 'x' }], stick: [{ node: 'd1h', top: '56px', reason: 'x' }] }), /a row of the slider/);
  assert.throws(() => validateBinding(bind({ stick: [{ node: 'd1h', top: '4rem', reason: 'x' }] }), () => true), /top is <N>px/);
});

// Room columns of a session row: each room draws a fading line on its right; the main hall (twin) has none, the
// organiser shows it second. Lines then sit between columns on screen, none after the last.
function hallRow(twinLine) {
  const fade = [{ type: 'GRADIENT_LINEAR', gradientHandlePositions: [{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 0 }], gradientStops: [{ position: 0, color: { r: 0.4, g: 0.4, b: 0.4, a: 0 } }, { position: 1, color: { r: 0.4, g: 0.4, b: 0.4, a: 1 } }] }];
  const line = { strokes: fade, strokeWeight: 1, individualStrokeWeights: { top: 0, right: 1, bottom: 0, left: 0 }, strokeAlign: 'INSIDE' };
  const solid = { strokes: [{ type: 'SOLID', color: { r: 0.75, g: 0.75, b: 0.76, a: 1 } }], strokeWeight: 1, individualStrokeWeights: { top: 0, right: 1, bottom: 0, left: 0 }, strokeAlign: 'INSIDE' };
  const tree = normalizeRoot({ nodes: { h: { document: frame('h', 'Halls', [0, 0, 600, 40], [
    room('h1', 0, line), room('h2', 150, line), room('h3', 300, { fills: fill(1, 0.95, 0.8), ...(twinLine ? solid : {}) }),
  ], { layoutMode: 'HORIZONTAL' }) } } }, 'h', { images: {}, svgs: {} });
  const out = buildTemplate(tree, { overrides: {}, salt: 'hall' });
  const b = bind({
    loops: [{ node: 'h1', query: 'ev_room__summit', drop: ['h2'], reason: 'one column per room' }],
    twin: [{ node: 'h3', loop: 'h1', index: 1, reason: 'organiser: main hall second' }],
    dividers: [{ node: 'h1', reason: 'lines between rooms' }],
  });
  validateBinding(b, (id) => !!nodeLookup([tree])(id));
  applyBinding(out.template, [out.mapping], b, textLookup([tree]), nodeLookup([tree]));
  return out.template.content.find((e) => e.id === out.mapping.h1.bricksId);
}

test('column lines: none after the last column on screen; the column after a twin without a line draws it on its left', () => {
  const a = hallRow(false);
  const css = a.settings._cssCustom;
  const P = `.brxe-${a.id}`;
  assert.ok(css.includes(`${P} ~ ${P} ~ ${P}:not(:has(~ ${P}))::before { padding-right: 0 !important; }`));
  assert.ok(css.includes(`${P} ~ ${P} ~ ${P}:not(${P} ~ ${P} ~ ${P} ~ ${P})::before { padding-left: 1px !important; }`));

  const b = hallRow(true); // a twin with its own line: no left line; it loses its line when it is the last on screen
  const css2 = b.settings._cssCustom;
  assert.doesNotMatch(css2, /padding-left: 1px/);
  assert.match(css2, /:not\(:has\(\.brxe-\w+ ~ \.brxe-\w+ ~ \.brxe-\w+\)\) > \.brxe-\w+ \{ box-shadow: none !important; \}/);
});

test('a note copied right under its trigger on the phone: centred on it, kept inside the row by a script', () => {
  const tree = timetable();
  const of = nodeLookup([tree]);
  const note = { id: 'note', name: 'Note', type: 'FRAME', visible: true, box: { x: 0, y: 0, w: 140, h: 90, absX: 20, absY: 78 }, sizing: { h: 'FIXED', v: 'HUG' }, children: [] };
  of('d1').children.push(note);
  of('d1s1lt').box = { ...of('d1s1lt').box, absX: 10, absY: 50, w: 100, h: 20 };
  const out = buildTemplate(tree, { overrides: {}, salt: 'ev' });
  const of2 = nodeLookup([tree]);
  const b = bind({
    loops: [{ node: 'd1', query: 'ev_day__summit', drop: [], reason: 'x' }],
    hoverShow: [{ node: 'note', trigger: 'd2s1lt', copy: true, under: true, anchor: 'd1s1lt', reason: 'phone frame draws no note' }],
  });
  validateBinding(b, (id) => !!of2(id));
  const elOf = (id) => out.template.content.find((e) => e.id === out.mapping[id]?.bricksId);
  const label = elOf('d2s1l');
  applyBinding(out.template, [out.mapping], b, textLookup([tree]), of2);
  const t = elOf('d2s1lt');
  const wrap = out.template.content.find((e) => e.id === t.parent);
  assert.equal(wrap.parent, label.id);
  assert.ok(wrap.settings._attributes.some((a) => a.name === 'data-f2b-keep-host'));
  assert.ok(label.settings._attributes.some((a) => a.name === 'data-f2b-bounds'));
  const copy = out.template.content.find((e) => e.parent === wrap.id && e.id !== t.id);
  assert.equal(copy.settings._top, 'calc(100% + 8px)'); // drawn 8px under the trigger beside anchor
  assert.equal(copy.settings._left, '50%');
  assert.match(copy.settings._cssCustom, /transform: translateX\(-50%\)/);
  assert.ok(copy.settings._attributes.some((a) => a.name === 'data-f2b-keep'));
  assert.match(copy.settings._cssCustom, new RegExp(`:is\\(#brxe-${label.id}, \\.brxe-${label.id}\\):has\\(:is\\(#brxe-${t.id}, \\.brxe-${t.id}\\):hover\\) \\{ z-index: 2; \\}`));
  assert.equal(out.template.scripts.filter((x) => x.includes('data-f2b-keep')).length, 1);
  assert.throws(() => validateBinding(bind({ hoverShow: [{ node: 'note', trigger: 'd2s1lt', under: true, reason: 'x' }] }), () => true), /under is true, with copy/);
});
