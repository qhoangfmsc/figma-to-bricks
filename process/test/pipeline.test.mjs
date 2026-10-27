// Offline tests: raw fixture -> tree -> bricks. No network, no WordPress.   node --test process/test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeRoot } from '../figma/normalize.mjs';
import { buildTemplate } from '../bricks/render/index.mjs';
import { collectSvgRoots } from '../figma/nodes.mjs';
import { parseFigmaUrl } from '../figma/url.mjs';

const fx = (p) => fileURLToPath(new URL(`../fixtures/award/${p}`, import.meta.url));
const raw = JSON.parse(readFileSync(fx('raw.json'), 'utf8'));
const manifest = {
  images: Object.fromEntries(['trophy1', 'cert001', 'trophy2', 'cert002', 'trophy3'].map((k) => [`ref${'0'.repeat(34)}${k}`, { file: `images/${k}.png`, width: 263, height: 150, sha256: k }])),
  svgs: { '1586_403': { file: 'svg/1586_403.svg', bytes: 1 } },
};
const tree = normalizeRoot(raw, '1586:393', manifest);
const overrides = JSON.parse(readFileSync(fileURLToPath(new URL('../work/4Fg9060CBIg7qeFxJzWiru/1586-393/overrides.json', import.meta.url)), 'utf8'));
const build = (ov = {}) => buildTemplate(tree, { overrides: ov, salt: 'x' });
const find = (b, figmaId) => b.template.content.find((e) => e.id === b.mapping[figmaId].bricksId);

test('url parsing', () => {
  assert.deepEqual(parseFigmaUrl('https://www.figma.com/design/AbC/x?node-id=1586-393&t=z'), { fileKey: 'AbC', nodeId: '1586:393' });
  assert.throws(() => parseFigmaUrl('https://www.figma.com/design/AbC/x'), /node-id/);
});

test('tree keeps every value, hidden nodes included but flagged', () => {
  const header = tree.children[0].children[0];
  assert.equal(header.children[0].visible, false);
  const heading = header.children[1];
  assert.equal(heading.text.fontSize, 36);
  assert.equal(heading.text.lineHeightPx, 48);
  assert.equal(heading.fills[0].hex, '#282829');
  assert.equal(tree.unhandled, undefined);
});

test('svg roots are detected as one unit', () => {
  const ids = collectSvgRoots(raw.nodes['1586:393'].document).map((n) => n.id);
  assert.deepEqual(ids, ['1586:403']);
});

test('mirrors the Figma tree: one element per visible node (+1 crop wrapper), hidden skipped', () => {
  const b = build();
  assert.equal(b.mapping['1586:396'].skipped, 'hidden in Figma');
  const visibleNodes = Object.values(b.mapping).filter((m) => m.bricksId && !m.expect === false).length;
  assert.equal(b.template.content.length, visibleNodes + 1); // + crop image inside its wrapper
  assert.equal(find(b, '1586:393').name, 'section');
});

test('text fill is the text color, never a background', () => {
  const h = find(build(), '1586:398');
  assert.equal(h.settings._background, undefined);
  assert.deepEqual(h.settings._typography.color, { hex: '#282829' });
  assert.equal(h.settings._typography['font-size'], '36px');
  assert.equal(h.settings._typography['line-height'], '48px');
  assert.equal(h.settings.tag, 'h4'); // from text style "H4/Bold" unless overridden
  assert.equal(build(overrides).template.content.find((e) => e.label === 'Heading text').settings.tag, 'h2');
});

test('sizing + layout come straight from the Figma values', () => {
  const b = build();
  const title = find(b, '1586:394').settings;
  assert.equal(title._width, '1140px');
  assert.equal(title._padding.bottom, '40px');
  assert.equal(title._alignItems, 'center'); // cross axis: overflow spills on both sides like Figma
  assert.equal(title._justifyContent, 'flex-start');
  const card = find(b, 'I1586:402;c2').settings;
  assert.equal(card._flexGrow, 1);
  assert.equal(card._alignSelf, undefined); // in a row: plain align-self via custom css, Bricks' `_alignSelf: stretch` would add width:100%
  assert.match(card._cssCustom, /align-self: stretch;/);
  assert.deepEqual(card._border.radius, { top: '12px', right: '12px', bottom: '12px', left: '12px' });
});

test('CROP image becomes wrapper + absolutely positioned image with exact percentages', () => {
  const b = build();
  const wrap = find(b, 'I1586:402;1095:30407');
  assert.equal(wrap.name, 'block');
  assert.equal(wrap.settings._overflow, 'hidden');
  const img = b.template.content.find((e) => e.parent === wrap.id);
  assert.equal(img.settings._width, '294.1176%');
  assert.equal(img.settings._height, '118.5818%');
  assert.equal(img.settings._left, '-174.8235%');
  assert.equal(img.settings._top, '-8.5616%');
});

test('overrides: slider owns the flow, slides keep height rules but lose width rules', () => {
  const b = build(overrides);
  const slider = find(b, '1586:402');
  assert.equal(slider.name, 'slider-nested');
  assert.equal(slider.settings._direction, undefined);
  assert.equal(slider.settings.autoHeight, true);
  assert.equal(slider.settings.perPage, 5);
  const slide = find(b, 'I1586:402;c1');
  assert.equal(slide.settings._flexGrow, undefined);
  assert.equal(b.mapping['1586:403'].skipped.startsWith('override'), true);
});

test('deterministic: same input, same output', () => {
  assert.deepEqual(build(overrides).template, build(overrides).template);
});

// ---- rules learned from the real Price table run
const mini = (nodeRaw) => normalizeRoot({ nodes: { r: { document: { id: 'r', name: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 }, layoutMode: 'VERTICAL', ...nodeRaw } } } }, 'r', { images: {}, svgs: {} });
const buildMini = (raw) => buildTemplate(mini(raw), { overrides: {}, salt: 'm' }).template.content;
const kid = (id, extra) => ({ id, name: id, type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 40 }, ...extra });

test('INSIDE stroke the padding can absorb -> border + reduced padding', () => {
  const [root] = buildMini({ paddingLeft: 24, paddingRight: 24, paddingTop: 24, paddingBottom: 24, strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }], strokeWeight: 1, strokeAlign: 'INSIDE', children: [] });
  assert.equal(root.settings._border.width.top, '1px');
  assert.equal(root.settings._padding.left, '23px');
});

test('INSIDE stroke with no padding -> inset shadow, layout untouched', () => {
  const [root] = buildMini({ strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }], strokeWeight: 2, strokeAlign: 'INSIDE', children: [] });
  assert.equal(root.settings._border?.width, undefined);
  assert.equal(root.settings._boxShadow.inset, true);
  assert.equal(root.settings._boxShadow.values.spread, '2');
});

test('per-side stroke -> one inset shadow per side with the real selector', () => {
  const [root] = buildMini({ strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }], strokeWeight: 1, individualStrokeWeights: { top: 0, right: 1, bottom: 1, left: 1 }, strokeAlign: 'INSIDE', children: [] });
  assert.match(root.settings._cssCustom, new RegExp(`^#brxe-${root.id} \\{ box-shadow: inset 1px 0px`));
});

test('HUG width never clamps to the parent and never shrinks; FILL keeps the Figma px as flex-basis', () => {
  const els = buildMini({ primaryAxisSizingMode: 'FIXED', children: [kid('h', { layoutSizingHorizontal: 'HUG', layoutSizingVertical: 'HUG' }), kid('f', { layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'FIXED', layoutAlign: 'STRETCH' })] });
  const h = els.find((e) => e.label === 'h').settings;
  assert.equal(h._widthMax, 'none');
  assert.equal(h._width, 'auto');
  const f = els.find((e) => e.label === 'f').settings;
  assert.equal(f._alignSelf, 'stretch');
});

test('paragraph spacing: one block span per paragraph, margin only between them', () => {
  const t = { id: 't', name: 't', type: 'TEXT', characters: 'a\nb', absoluteBoundingBox: { x: 0, y: 0, width: 50, height: 44 }, style: { fontFamily: 'Inter', fontWeight: 400, fontSize: 16, lineHeightPx: 16, paragraphSpacing: 12 }, fills: [] };
  const el = buildMini({ children: [t] }).find((e) => e.label === 't');
  assert.equal(el.settings.text, '<span style="display:block">a</span><span style="display:block;margin-top:12px">b</span>');
});

test('icon-font text is exported as svg', () => {
  const icon = { id: 'i', type: 'TEXT', visible: true, style: { fontFamily: 'Font Awesome 6 Pro' }, characters: 'check' };
  assert.deepEqual(collectSvgRoots({ id: 'p', type: 'FRAME', children: [icon] }).map((n) => n.id), ['i']);
});

test('linear gradient: horizontal Figma handles -> 90deg across the whole box; stops are re-projected exactly', () => {
  const g = (handles) => ({ type: 'GRADIENT_LINEAR', gradientHandlePositions: handles, gradientStops: [{ position: 0, color: { r: 0, g: 0.5, b: 1, a: 1 } }, { position: 1, color: { r: 0, g: 0, b: 0, a: 1 } }] });
  const [root] = buildMini({ fills: [g([{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0, y: 1 }])], children: [] });
  assert.equal(root.settings._cssCustom, `#brxe-${root.id} { background-image: linear-gradient(90deg, #0080ff 0%, #000000 100%); }`);
  // gradient line not spanning the box: 25% -> 75% of the width
  const [r2] = buildMini({ fills: [g([{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }, { x: 0.25, y: 1 }])], children: [] });
  assert.match(r2.settings._cssCustom, /linear-gradient\(90deg, #0080ff 25%, #000000 75%\)/);
});

test('gradient text fill -> background-clip:text on the text element', () => {
  const [root, text] = buildMini({ children: [{ id: 't', name: 't', type: 'TEXT', characters: 'x', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 20 }, style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, lineHeightPx: 20, textAlignHorizontal: 'LEFT' }, fills: [{ type: 'GRADIENT_LINEAR', gradientHandlePositions: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0, y: 1 }], gradientStops: [{ position: 0, color: { r: 0, g: 0, b: 0, a: 1 } }, { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } }] }] }] });
  assert.match(text.settings._cssCustom, /background-clip: text; .*text-fill-color: transparent/);
});

// ---- detect step + components (approved detections change the build, nothing else does)
import { mergeDetections, runRules, validate, emptyDetections } from '../detect/index.mjs';
import { COMPONENTS } from '../bricks/components/index.mjs';
import { matchTrees } from '../responsive/match.mjs';
import { mergeResponsive } from '../responsive/merge.mjs';
import { decide } from '../decide/index.mjs';

const txt = (id, characters, extra = {}) => ({ id, name: id, type: 'TEXT', characters, absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 20 }, style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, lineHeightPx: 20, textAlignHorizontal: 'LEFT', ...extra.style }, fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }] });
const withIcons = () => mini({
  children: [
    kid('row', { name: 'Row', layoutMode: 'HORIZONTAL', children: [
      kid('lab', { name: 'Text', layoutMode: 'HORIZONTAL', children: [txt('t1', 'Number of domains:')] }),
      kid('wrap', { name: 'Icon', layoutMode: 'VERTICAL', children: [txt('q1', 'circle-question', { style: { fontFamily: 'Font Awesome 6 Pro Light' } })] }),
    ] }),
    kid('btn', { name: 'Button', type: 'INSTANCE', layoutMode: 'HORIZONTAL', paddingLeft: 16, paddingRight: 16, paddingTop: 4, paddingBottom: 4, itemSpacing: 8, fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }], children: [txt('bt', 'Buy now')] }),
  ],
});
const buildWith = (tree, detections) => buildTemplate(tree, { overrides: {}, detections, salt: 'd' });
const byFigma = (b, id) => b.template.content.find((e) => e.id === b.mapping[id]?.bricksId);

test('detect rules: tooltip icon found through its wrapper, button found, both start as proposed', () => {
  const found = runRules(withIcons());
  const tip = found.components.find((c) => c.component === 'tooltip');
  assert.equal(tip.node, 'q1');
  assert.match(tip.evidence, /Number of domains:/);
  assert.equal(tip.params.text, null); // not in Figma, never invented
  assert.equal(found.components.find((c) => c.component === 'button').node, 'btn');
  assert.ok(found.components.every((c) => c.status === 'proposed'));
});

test('merge keeps human decisions and params, only appends new candidates', () => {
  const tree = withIcons();
  const first = mergeDetections(emptyDetections(), runRules(tree)).detections;
  first.components[0].status = 'approved';
  first.components[0].params.text = 'Hello';
  const again = mergeDetections(first, runRules(tree));
  assert.equal(again.added.length, 0);
  assert.equal(again.detections.components[0].status, 'approved');
  assert.equal(again.detections.components[0].params.text, 'Hello');
  assert.deepEqual(validate(again.detections, tree), []);
  again.detections.components.push({ id: 'dX', component: 'tooltip', node: 'gone', status: 'approved', params: {} });
  assert.match(validate(again.detections, tree).join(), /stale/);
});

test('proposed or rejected detections change nothing: the nodes stay blocks', () => {
  const tree = withIcons();
  const det = mergeDetections(emptyDetections(), runRules(tree)).detections;
  const plain = buildWith(tree, null);
  for (const status of ['proposed', 'rejected']) {
    det.components.forEach((c) => { c.status = status; c.params.text = 'x'; });
    assert.deepEqual(buildWith(tree, det).template.content, plain.template.content);
  }
});

test('approved tooltip -> data-balloon attributes on the trigger; without text the attribute is empty (hidden by the theme) and says why', () => {
  const tree = withIcons();
  const det = mergeDetections(emptyDetections(), runRules(tree)).detections;
  const tip = det.components.find((c) => c.component === 'tooltip');
  tip.status = 'approved';
  const noText = buildWith(tree, det);
  assert.deepEqual(byFigma(noText, 'q1').settings._attributes, [{ name: 'data-balloon', value: '' }, { name: 'data-balloon-pos', value: 'top' }]);
  assert.match(noText.warnings.map((w) => w.msg).join(), /tooltip text is not in Figma/);
  tip.params.text = 'How many sites you can host';
  const ok = buildWith(tree, det);
  assert.deepEqual(byFigma(ok, 'q1').settings._attributes, [{ name: 'data-balloon', value: 'How many sites you can host' }, { name: 'data-balloon-pos', value: 'top' }]);
  assert.equal(ok.mapping.q1.component, 'tooltip');
  assert.equal(ok.mapping.q1.expect.attrs['data-balloon'], 'How many sites you can host');
});

test('approved button -> one button element, label merged, theme defaults overridden', () => {
  const tree = withIcons();
  const det = mergeDetections(emptyDetections(), runRules(tree)).detections;
  det.components.find((c) => c.component === 'button').status = 'approved';
  const b = buildWith(tree, det);
  const btn = byFigma(b, 'btn');
  assert.equal(btn.name, 'button');
  assert.equal(btn.settings.text, 'Buy now');
  assert.equal(btn.settings._typography['letter-spacing'], '0px');
  assert.equal(btn.settings._padding.left, '16px');
  assert.match(btn.settings._cssCustom, /column-gap: 8px/);
  assert.equal(b.mapping.bt.skipped, 'merged into button d2');
  assert.equal(b.template.content.filter((e) => e.parent === btn.id).length, 0);
});

test('approved but not applicable (form without fields) stays a block and says why', () => {
  const tree = withIcons();
  const det = { ...emptyDetections(), components: [{ id: 'd1', component: 'form', node: 'row', status: 'approved', params: {} }] };
  const b = buildWith(tree, det);
  assert.equal(byFigma(b, 'row').name, 'block');
  assert.match(b.warnings.map((w) => w.msg).join(), /form.*params\.fields is empty/);
});

test('components README lists every registered component', () => {
  const readme = readFileSync(fileURLToPath(new URL('../bricks/components/README.md', import.meta.url)), 'utf8');
  for (const id of Object.keys(COMPONENTS)) assert.ok(readme.includes(`\`${id}\``), `bricks/components/README.md is missing ${id}`);
});

test('loose tooltip bubble: proposed with its text, applies only once the trigger is chosen, bubble is merged', () => {
  const tree = mini({ children: [
    kid('row', { name: 'Row', layoutMode: 'HORIZONTAL', children: [txt('t1', 'Domains'), kid('icon', { name: 'Icon', children: [txt('q1', 'circle-question', { style: { fontFamily: 'Font Awesome 6 Pro Light' } })] })] }),
    kid('bubble', { name: 'Tooltip', type: 'INSTANCE', children: [txt('bt', 'Number of domains:')] }),
  ] });
  const det = mergeDetections(emptyDetections(), runRules(tree)).detections;
  const loose = det.components.find((c) => c.params.popup === 'bubble');
  assert.equal(loose.node, 'bubble');
  assert.equal(loose.confidence, 'low');
  loose.status = 'approved';
  assert.match(buildWith(tree, det).warnings.map((w) => w.msg).join(), /node is the popup bubble itself/);
  loose.node = 'q1'; // the owner picks the trigger
  const b = buildWith(tree, det);
  assert.equal(byFigma(b, 'q1').settings._attributes[0].value, 'Number of domains:');
  assert.equal(b.mapping.bubble.skipped, 'merged into tooltip ' + loose.id);
});

// ---- flat-image (banner shipped as one Figma-rendered picture)
const art = (id, extra = {}) => ({ id, name: id, type: 'RECTANGLE', absoluteBoundingBox: { x: 0, y: 0, width: 50, height: 50 }, fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }], ...extra });
const bannerTree = (rootExtra = {}) => mini({
  children: [{ id: 'bn', name: 'Banner', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 100 }, ...rootExtra, children: [
    ...[1, 2, 3, 4, 5].map((i) => art(`a${i}`, { rotation: 0.3 })),
    txt('h1', 'SALE'), txt('h2', 'SALE'), txt('h3', 'NOW'),
  ] }],
});

test('flat-image rule: hand-placed artwork container is proposed, an auto-layout grid is not', () => {
  const found = runRules(bannerTree()).components.filter((c) => c.component === 'flat-image');
  assert.deepEqual(found.map((c) => c.node), ['bn']);
  assert.equal(found[0].confidence, 'high'); // rotated layers
  assert.equal(runRules(bannerTree({ layoutMode: 'HORIZONTAL' })).components.some((c) => c.component === 'flat-image'), false);
});

test('flat-image approved: one image element, subtree merged, alt = unique texts, link optional; not applied without the export', () => {
  const tree = bannerTree();
  const det = mergeDetections(emptyDetections(), runRules(tree)).detections;
  const d = det.components.find((c) => c.component === 'flat-image');
  d.status = 'approved';
  const build = (flats) => buildTemplate(tree, { overrides: {}, detections: det, flats, salt: 'f' });
  assert.match(build({}).warnings.map((w) => w.msg).join(), /not exported yet/);
  assert.equal(byFigma(build({}), 'bn').name, 'block');

  const flats = { bn: { file: 'flat/bn.png', width: 800, height: 200, scale: 2 } };
  const b = build(flats);
  const img = byFigma(b, 'bn');
  assert.equal(img.name, 'image');
  assert.equal(img.settings.altText, 'SALE NOW');
  assert.deepEqual(img.settings.image, { $asset: 'flat/bn.png', size: 'full' });
  assert.equal(img.settings.url, undefined);
  assert.equal(b.template.content.filter((e) => e.parent === img.id).length, 0);
  assert.equal(b.mapping.a1.skipped, 'merged into flat-image ' + d.id);

  d.params.link = 'https://example.com/signup';
  assert.deepEqual(build(flats).template.content.find((e) => e.name === 'image').settings.url, { type: 'external', url: 'https://example.com/signup' });
  // an export bigger than the box (blur / shadow spilling out) is refused instead of being squeezed in
  assert.match(build({ bn: { file: 'x', width: 1000, height: 200, scale: 2 } }).warnings.map((w) => w.msg).join(), /spill outside the box/);
});

// ---- source grounding + review gate
import { checkCites } from '../detect/cite.mjs';
import { buildFacts } from '../facts/index.mjs';
import { gate, signOff, requireSignOff } from '../review/index.mjs';
import { resolveWorkspace } from '../shared/workspace.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const compRaw = (id, props) => kid(id, { name: '_Item', type: 'INSTANCE', componentId: 'c1', componentProperties: props, children: [] });
const withProps = () => normalizeRoot({ components: { c1: { name: 'Include=Yes', componentSetId: 's1' } }, componentSets: { s1: { name: '_Item' } }, nodes: { r: { components: { c1: { name: 'Include=Yes', componentSetId: 's1' } }, componentSets: { s1: { name: '_Item' } }, document: { id: 'r', name: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 }, layoutMode: 'VERTICAL', children: [
  compRaw('i1', { 'Tooltips icon#1:0': { type: 'BOOLEAN', value: true } }), compRaw('i2', { 'Tooltips icon#1:0': { type: 'BOOLEAN', value: false } }), compRaw('i3', { 'Tooltips icon#1:0': { type: 'BOOLEAN', value: true } }),
] } } } }, 'r', { images: {}, svgs: {} });

test('normalize keeps what the designer declared: props, component set, prototype', () => {
  const t = withProps();
  assert.equal(t.children[0].props['Tooltips icon'], true);
  assert.equal(t.children[0].componentSet, '_Item');
  const f = buildFacts(t);
  assert.deepEqual(f.components[0].props['Tooltips icon'], { true: 2, false: 1 });
  assert.equal(f.repeats.length, 0); // empty identical leaves are too small to be a "structure"
});

test('citations are re-checked against the tree: wrong value, missing field, missing node', () => {
  const t = withProps();
  assert.deepEqual(checkCites([{ node: 'i1', field: 'props.Tooltips icon', equals: true }, { node: 'i1', field: 'componentSet' }], t), []);
  assert.match(checkCites([{ node: 'i2', field: 'props.Tooltips icon', equals: true }], t)[0], /tree says false/);
  assert.match(checkCites([{ node: 'i1', field: 'props.Nope' }], t)[0], /does not exist/);
  assert.match(checkCites([{ node: 'zzz', field: 'name' }], t)[0], /not in the tree/);
});

test('an AI candidate without a citation, or with a false one, is a problem the gate refuses', () => {
  const t = withProps();
  const det = { ...emptyDetections(), components: [{ id: 'd1', component: 'tooltip', node: 'i1', status: 'proposed', source: 'ai', params: {} }] };
  assert.match(validate(det, t).join(), /must cite/);
  det.components[0].cite = [{ node: 'i2', field: 'props.Tooltips icon', equals: true }];
  assert.match(validate(det, t).join(), /tree says false/);
  det.components[0].cite = [{ node: 'i1', field: 'props.Tooltips icon', equals: true }];
  assert.deepEqual(validate(det, t), []);
});

test('tooltip rule: the designer flag makes it E1 / high and the rule cites it', () => {
  const tree = mini({ children: [kid('row', { name: '_Item', type: 'INSTANCE', componentProperties: { 'Tooltips icon#1:0': { type: 'BOOLEAN', value: true } }, layoutMode: 'HORIZONTAL', children: [
    kid('lab', { name: 'Text', children: [txt('t1', 'Domains')] }),
    kid('wrap', { name: 'Icon', children: [txt('q1', 'circle-question', { style: { fontFamily: 'Font Awesome 6 Pro Light' } })] })] })] });
  const [tip] = runRules(tree).components.filter((c) => c.component === 'tooltip');
  assert.equal(tip.level, 'E1');
  assert.equal(tip.confidence, 'high');
  assert.deepEqual(validate({ ...emptyDetections(), components: [{ id: 'd1', status: 'proposed', ...tip }] }, tree), []);
});

test('review gate: closed until the owner signs off; any change to the tree or the decisions closes it again', () => {
  const dir = mkdtempSync(join(tmpdir(), 'f2b-gate-'));
  const tree = withIcons();
  writeFileSync(join(dir, 'tree.json'), JSON.stringify(tree));
  const ws = resolveWorkspace(dir);
  ws.writeJson('detections.json', mergeDetections(emptyDetections(), runRules(tree)).detections);
  assert.equal(gate(ws).ok, false);
  assert.throws(() => requireSignOff(ws, 'build'), /REVIEW REQUIRED before "build"/);
  signOff(ws, { note: 'checked in Figma' });
  assert.equal(gate(ws).ok, true);
  assert.doesNotThrow(() => requireSignOff(ws, 'build'));
  const det = ws.readJson('detections.json');
  det.components[0].note = 'just a note';   // wording does not void it
  ws.writeJson('detections.json', det);
  assert.equal(gate(ws).ok, true);
  det.components[0].status = 'approved';    // a decision does
  ws.writeJson('detections.json', det);
  assert.match(gate(ws).reason, /changed after the sign-off/);
  signOff(ws);
  writeFileSync(join(dir, 'tree.json'), JSON.stringify({ ...tree, name: 'changed' }));
  assert.match(gate(ws).reason, /tree changed/);
});

// ---- basic components: carousel, accordion, tabs, link, form + owner-default hover
const approveAll = (tree, extra = []) => {
  const det = mergeDetections(emptyDetections(), runRules(tree)).detections;
  det.components.push(...extra);
  det.components.forEach((c) => { c.status = 'approved'; });
  return det;
};
const hostRow = (extra = {}) => kid('host', { name: 'Row', layoutMode: 'HORIZONTAL', itemSpacing: 20, children: [], ...extra });

test('carousel: row of identical cards + a thin strip under it -> slider-nested, perPage / gap from Figma, strip merged', () => {
  const card = (i) => kid(`c${i}`, { name: 'card', absoluteBoundingBox: { x: i * 120, y: 0, width: 100, height: 60 }, children: [txt(`ct${i}`, `Card ${i}`)] });
  const tree = mini({ children: [
    kid('row', { name: 'Awards', layoutMode: 'HORIZONTAL', itemSpacing: 20, absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 60 }, children: [0, 1, 2].map(card) }),
    kid('pag', { name: 'Pagination', type: 'INSTANCE', absoluteBoundingBox: { x: 100, y: 62, width: 200, height: 4 } }),
  ] });
  const found = runRules(tree).components.find((c) => c.component === 'carousel');
  assert.equal(found.node, 'row');
  assert.equal(found.params.pagination, 'pag');
  const det = approveAll(tree);
  const b = buildWith(tree, det);
  const slider = byFigma(b, 'row');
  assert.equal(slider.name, 'slider-nested');
  assert.deepEqual([slider.settings.type, slider.settings.perPage, slider.settings.gap, slider.settings.pagination], ['slide', 3, 20, true]);
  assert.equal(b.mapping.pag.skipped, 'merged into carousel ' + det.components[0].id);
  assert.equal(b.template.content.filter((e) => e.parent === slider.id).length, 3); // the slides
  assert.equal(runRules(mini({ children: [kid('r2', { layoutMode: 'HORIZONTAL', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 60 }, children: [0, 1, 2].map(card) })] })).components.some((c) => c.component === 'carousel'), false); // 3 cards that fit = a grid
});

test('accordion: title / content get the accordion classes, a closed item gets an EMPTY content block, first open item expands', () => {
  const item = (i, open) => kid(`it${i}`, { name: 'Item', layoutMode: 'VERTICAL', children: [kid(`ti${i}`, { name: 'Title', children: [txt(`tt${i}`, `Q${i}`)] }), ...(open ? [kid(`co${i}`, { name: 'Content', children: [txt(`ct${i}`, `A${i}`)] })] : [])] });
  const tree = mini({ children: [kid('acc', { name: 'FAQ', layoutMode: 'VERTICAL', children: [item(1, true), item(2, false), item(3, false)] })] });
  const det = { ...emptyDetections(), components: [{ id: 'd1', component: 'accordion', node: 'acc', status: 'approved', params: {} }] };
  const b = buildWith(tree, det);
  assert.equal(byFigma(b, 'acc').name, 'accordion-nested');
  assert.equal(byFigma(b, 'acc').settings.expandFirstItem, true);
  assert.equal(byFigma(b, 'ti1').settings._hidden._cssClasses, 'accordion-title-wrapper');
  assert.equal(byFigma(b, 'co1').settings._hidden._cssClasses, 'accordion-content-wrapper');
  const empties = b.template.content.filter((e) => e.settings._hidden?._cssClasses === 'accordion-content-wrapper' && e.label.includes('empty'));
  assert.equal(empties.length, 2);
  assert.match(b.warnings.map((w) => w.msg).join(), /no visible content in Figma/);
});

test('tabs: bar + one open pane -> tab-menu / tab-title divs / tab-content / panes, missing panes empty and warned', () => {
  const title = (i) => kid(`tt${i}`, { name: 'Tab', children: [txt(`tx${i}`, `Tab ${i}`)] });
  const tree = mini({ children: [kid('tabs', { name: 'Tabs', layoutMode: 'VERTICAL', children: [
    kid('bar', { name: 'Bar', layoutMode: 'HORIZONTAL', children: [title(1), title(2), title(3)] }),
    kid('content', { name: 'Content', layoutMode: 'VERTICAL', children: [kid('pane1', { name: 'Pane', children: [txt('pt', 'Hello')] })] }),
  ] })] });
  const det = { ...emptyDetections(), components: [{ id: 'd1', component: 'tabs', node: 'tabs', status: 'approved', params: {} }] };
  const b = buildWith(tree, det);
  assert.equal(byFigma(b, 'tabs').name, 'tabs-nested');
  assert.equal(byFigma(b, 'bar').settings._hidden._cssClasses, 'tab-menu');
  assert.equal(byFigma(b, 'tt2').name, 'div');
  assert.equal(byFigma(b, 'tt2').settings._hidden._cssClasses, 'tab-title');
  assert.equal(byFigma(b, 'content').settings._hidden._cssClasses, 'tab-content');
  assert.equal(b.template.content.filter((e) => e.settings._hidden?._cssClasses === 'tab-pane').length, 3);
  assert.match(b.warnings.map((w) => w.msg).join(), /2 empty pane/);
});

test('link: missing url -> "#"; given url -> that url; no default hover', () => {
  const tree = mini({ children: [txt('lk', 'Read more')] });
  const det = { ...emptyDetections(), components: [{ id: 'd1', component: 'link', node: 'lk', status: 'approved', params: {} }] };
  const noUrl = byFigma(buildWith(tree, det), 'lk');
  assert.equal(noUrl.name, 'text-link');
  assert.deepEqual(noUrl.settings.link, { type: 'external', url: '#' }); // missing URL -> '#'
  det.components[0].params.link = 'https://example.com/more';
  const el = byFigma(buildWith(tree, det), 'lk');
  assert.equal(el.name, 'text-link');
  assert.deepEqual(el.settings.link, { type: 'external', url: 'https://example.com/more' });
  assert.equal(el.settings._cssCustom, undefined); // no default hover (owner dropped opacity 0.8)
});

test('form: fields from params, field and submit look read from the cited frames, subtree merged; without fields it is refused', () => {
  const input = (id, label, ph) => kid(id, { name: 'Input', layoutMode: 'HORIZONTAL', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, cornerRadius: 6, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], strokes: [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8, a: 1 } }], strokeWeight: 1, strokeAlign: 'INSIDE', children: [txt(`${id}t`, ph)] });
  const tree = mini({ children: [kid('frm', { name: 'Contact', layoutMode: 'VERTICAL', itemSpacing: 12, children: [
    txt('l1', 'Email'), input('in1', 'Email', 'you@example.com'),
    kid('btn', { name: 'Submit', layoutMode: 'HORIZONTAL', cornerRadius: 8, fills: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1, a: 1 } }], children: [txt('bt', 'Send')] }),
  ] })] });
  const det = { ...emptyDetections(), components: [{ id: 'd1', component: 'form', node: 'frm', status: 'approved', params: {} }] };
  assert.match(buildWith(tree, det).warnings.map((w) => w.msg).join(), /params\.fields is empty/);
  det.components[0].params = { fields: JSON.stringify([{ node: 'in1', type: 'email', label: 'Email', placeholder: 'you@example.com', required: true, labelNode: 'l1' }]), submit: 'btn' };
  const b = buildWith(tree, det);
  const wrap = byFigma(b, 'frm');
  assert.equal(wrap.name, 'block'); // the Figma frame stays, the form element sits inside it
  const f = b.template.content.find((e) => e.parent === wrap.id && e.name === 'form');
  assert.deepEqual([f.settings.fields[0].type, f.settings.fields[0].label, f.settings.fields[0].required], ['email', 'Email', true]);
  assert.equal(f.settings.showLabels, true);
  assert.equal(f.settings.fieldBackgroundColor.hex, '#ffffff');
  assert.equal(f.settings.fieldBorder.radius.top, '6px');
  assert.equal(f.settings.fieldPadding.left, '12px');
  assert.equal(f.settings.submitButtonText, 'Send');
  assert.equal(f.settings.submitButtonBackgroundColor.hex, '#0066ff');
  assert.equal(f.settings.labelTypography['text-transform'], 'none'); // the theme uppercases labels
  assert.match(f.settings._cssCustom, new RegExp(`#brxe-${f.id} \\.form-group \\{ padding: 0 0 12px;`)); // the theme's 20px is replaced by the Figma gap
  assert.match(f.settings._cssCustom, /button\[type=submit\] \{ width: 100px; height: 40px;/);
  assert.equal(b.template.content.filter((e) => e.parent === wrap.id).length, 1); // fields and submit are merged: only the form element
});

test('form: a note under the button is NOT merged, it is built after the form element', () => {
  const tree = mini({ children: [kid('frm', { layoutMode: 'VERTICAL', itemSpacing: 24, children: [
    kid('in1', { name: 'Input', layoutMode: 'HORIZONTAL', children: [txt('ph', 'you@example.com')] }),
    kid('btn', { name: 'Submit', layoutMode: 'HORIZONTAL', children: [txt('bt', 'Send')] }),
    txt('note', 'We keep your data private'),
  ] })] });
  const det = detOf({ component: 'form', node: 'frm', params: { fields: [{ node: 'in1', type: 'email' }], submit: 'btn' } });
  const b = buildWith(tree, det);
  const kids = b.template.content.filter((e) => e.parent === byFigma(b, 'frm').id).map((e) => e.name);
  assert.deepEqual(kids, ['form', 'text-basic']);
  assert.equal(byFigma(b, 'note').settings.text, 'We keep your data private');
});

test('hover: a drawn ON_HOVER prototype writes nothing (no default hover) and says it was not built', () => {
  const tree = mini({ children: [kid('hv', { name: 'Card', interactions: [{ trigger: { type: 'ON_HOVER' }, actions: [{ type: 'NODE', navigation: 'CHANGE_TO', destinationId: 'x:1', transition: { type: 'DISSOLVE', duration: 0.3, easing: { type: 'EASE_OUT' } } }] }], children: [] })] });
  const b = buildWith(tree, null);
  assert.equal(byFigma(b, 'hv').settings._cssCustom, undefined);
  assert.match(b.warnings.map((w) => w.msg).join(), /hover not built/);
});

test('rotation: absolute node is placed unrotated + matrix from relativeTransform; flow node or missing transform still warns', () => {
  const s2 = Math.SQRT1_2;
  const diamond = { id: 'dm', name: 'Arrow', type: 'RECTANGLE', rotation: Math.PI / 4, size: { x: 12, y: 12 }, relativeTransform: [[s2, -s2, 122], [s2, s2, -8]], absoluteBoundingBox: { x: 113.5147, y: -8, width: 16.9706, height: 16.9706 } };
  const root = (kids, extra = {}) => mini({ layoutMode: undefined, children: [kid('box', { name: 'Box', layoutMode: undefined, absoluteBoundingBox: { x: 0, y: 0, width: 142, height: 56 }, ...extra, children: kids })] });
  const b = buildTemplate(root([diamond]), { overrides: {}, salt: 'r' });
  const el = byFigma(b, 'dm');
  assert.equal(el.settings._left, '122px');
  assert.equal(el.settings._top, '-8px');
  assert.equal(el.settings._width, '12px');
  assert.equal(el.settings._height, '12px');
  assert.deepEqual(el.settings._transform, { rotateZ: '45' }); // whole degrees: the native Transform control
  assert.equal(el.settings._transformOrigin, '0 0');
  assert.equal(el.settings._widthMin, '0px'); // empty block: the builder would otherwise force 90x90
  assert.equal(el.settings._heightMin, '0px');
  assert.equal(byFigma(b, 'box').settings._heightMin, undefined); // a block with children is not empty
  assert.equal(el.settings._cssCustom, undefined);
  const c = Math.cos(0.3), sn = Math.sin(0.3); // 17.19deg: Bricks would round it, so the exact matrix goes to Custom CSS
  const odd = byFigma(buildTemplate(root([{ ...diamond, id: 'od', rotation: 0.3, relativeTransform: [[c, -sn, 5], [sn, c, 6]] }]), { overrides: {}, salt: 'r' }), 'od');
  assert.equal(odd.settings._transform, undefined);
  assert.match(odd.settings._cssCustom, new RegExp(`transform: matrix\\(${c}, ${sn}, ${-sn}, ${c}, 0, 0\\); transform-origin: 0 0;`));
  assert.equal(b.warnings.some((w) => /rotation/.test(w.msg)), false);
  assert.equal(b.mapping.dm.expect.w, 16.9706); // verify still compares the rotated bounding box with Figma's
  assert.equal(b.mapping.dm.expect.css.width, '12px');

  const noTransform = buildTemplate(root([{ ...diamond, size: undefined, relativeTransform: undefined }]), { overrides: {}, salt: 'r' });
  assert.match(noTransform.warnings.map((w) => w.msg).join(), /fetch again/);
  const flow = buildTemplate(root([diamond], { layoutMode: 'HORIZONTAL' }), { overrides: {}, salt: 'r' });
  assert.match(flow.warnings.map((w) => w.msg).join(), /only absolutely placed/);
});

test('row child with a fixed width and cross-axis FILL keeps its width (no Bricks _alignSelf, which writes width:100%)', () => {
  const els = buildMini({ layoutMode: 'HORIZONTAL', children: [kid('w', { layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FILL' })] });
  const w = els.find((e) => e.label === 'w').settings;
  assert.equal(w._alignSelf, undefined);
  assert.equal(w._width, '100px');
  assert.match(w._cssCustom, /align-self: stretch;/);
});

test('fixed child wider than the parent content box overflows like in Figma (max-width none instead of 100%)', () => {
  const els = buildMini({ paddingLeft: 190, paddingRight: 190, children: [kid('wide', { layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED' })] });
  assert.equal(els.find((e) => e.label === 'wide').settings._widthMax, 'none');
  const fits = buildMini({ children: [kid('fits', { layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED' })] });
  assert.equal(fits.find((e) => e.label === 'fits').settings._widthMax, '100%');
});

// ---- usable-output components: semantic tags, icon on button, icon list, breadcrumbs, counter, alt policy, '#' links
const miniSvg = (nodeRaw, svgs = {}) => normalizeRoot({ nodes: { r: { document: { id: 'r', name: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 }, layoutMode: 'VERTICAL', ...nodeRaw } } } }, 'r', { images: {}, svgs: Object.fromEntries(Object.entries(svgs).map(([id, file]) => [id, { file, bytes: 1 }])) });
const detOf = (...components) => ({ ...emptyDetections(), components: components.map((c, i) => ({ id: `d${i + 1}`, status: 'approved', params: {}, ...c })) });

test('semantic: ul > li on the container and its children, look untouched', () => {
  const tree = mini({ children: [kid('lst', { name: 'Row', layoutMode: 'VERTICAL', children: [kid('a', { children: [txt('ta', 'A')] }), kid('b', { children: [txt('tb', 'B')] })] })] });
  const b = buildWith(tree, detOf({ component: 'semantic', node: 'lst', params: { tag: 'ul', itemTag: 'li', id: 'anchor-x' } }));
  assert.equal(byFigma(b, 'lst').settings.tag, 'ul');
  assert.equal(byFigma(b, 'lst').settings._cssId, 'anchor-x');
  assert.equal(byFigma(b, 'a').settings.tag, 'li');
  assert.equal(byFigma(b, 'b').settings.tag, 'li');
  assert.deepEqual(byFigma(b, 'lst').settings._margin, { top: '0px', right: '0px', bottom: '0px', left: '0px' }); // browser ul margin / padding must not move the layout
  assert.equal(byFigma(b, 'lst').settings._padding.left, '0px');
  assert.match(byFigma(b, 'lst').settings._cssCustom, /list-style: none;/);
  assert.equal(byFigma(b, 'lst').name, 'block');
});

test('semantic: dl with dt / dd uses the Bricks custom tag; a link card without URL is "#"', () => {
  const tree = mini({ children: [kid('dl', { children: [kid('row', { children: [kid('k', { children: [txt('tk', 'Key')] }), kid('v', { children: [txt('tv', 'Value')] })] })] }), kid('card', { children: [txt('tc', 'Card')] })] });
  const b = buildWith(tree, detOf({ component: 'semantic', node: 'dl', params: { tag: 'dl', childTags: { k: 'dt', v: 'dd' } } }, { component: 'semantic', node: 'card', params: { tag: 'a' } }));
  assert.deepEqual([byFigma(b, 'dl').settings.tag, byFigma(b, 'dl').settings.customTag], ['custom', 'dl']);
  assert.deepEqual([byFigma(b, 'k').settings.tag, byFigma(b, 'k').settings.customTag], ['custom', 'dt']);
  assert.equal(byFigma(b, 'v').settings.customTag, 'dd');
  assert.equal(byFigma(b, 'card').settings.tag, 'a');
  assert.deepEqual(byFigma(b, 'card').settings.link, { type: 'external', url: '#' });
  assert.match(b.warnings.map((w) => w.msg).join(), /written as "#"/);
});

test('semantic: figure takes its figcaption and the image alt from the caption text', () => {
  const tree = mini({ children: [kid('fig', { layoutMode: 'VERTICAL', children: [{ ...kid('img', {}), fills: [{ type: 'IMAGE', imageRef: 'x', scaleMode: 'FILL' }] }, txt('cap', 'Top 5 Thuong Hieu')] })] });
  const tree2 = normalizeRoot({ nodes: { r: { document: { id: 'r', name: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 }, layoutMode: 'VERTICAL', children: [{ ...kid('fig', { layoutMode: 'VERTICAL', children: [{ ...kid('img', {}), fills: [{ type: 'IMAGE', imageRef: 'x', scaleMode: 'FILL' }] }, txt('cap', 'Top 5 Thuong Hieu')] }) }] } } } }, 'r', { images: { x: { file: 'images/x.png', width: 10, height: 10, sha256: 'z' } }, svgs: {} });
  assert.ok(tree);
  const b = buildWith(tree2, detOf({ component: 'semantic', node: 'fig', params: { tag: 'figure', caption: 'cap' } }));
  assert.equal(byFigma(b, 'fig').settings.tag, 'figure');
  assert.equal(byFigma(b, 'cap').settings.customTag, 'figcaption');
  assert.equal(byFigma(b, 'img').settings.altText, 'Top 5 Thuong Hieu');
});

test('alt policy: never the layer name; empty alt is reported; brand-logo variant name is the alt', () => {
  const img = (id, extra = {}) => ({ ...kid(id, { name: 'Frame 61', ...extra }), fills: [{ type: 'IMAGE', imageRef: 'x', scaleMode: 'FILL' }] });
  const raw = { nodes: { r: { document: { id: 'r', name: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 }, layoutMode: 'VERTICAL', children: [img('plain'), { ...kid('logo', { name: 'brand-logo', type: 'INSTANCE', componentProperties: { 'Property 1': { type: 'VARIANT', value: 'Ivivu' } }, children: [img('lg')] }) }] } } } };
  const tree = normalizeRoot(raw, 'r', { images: { x: { file: 'images/x.png', width: 10, height: 10, sha256: 'z' } }, svgs: {} });
  const b = buildWith(tree, null);
  assert.equal(byFigma(b, 'plain').settings.altText, '');
  assert.equal(byFigma(b, 'lg').settings.altText, 'Ivivu');
  assert.match(b.warnings.map((w) => w.msg).join(), /no alt text/);
});

test('button: an svg icon child becomes the button icon (position from child order), link defaults to "#"', () => {
  const tree = miniSvg({ children: [kid('btn', { name: 'Button', layoutMode: 'HORIZONTAL', itemSpacing: 8, children: [txt('lab', 'Dang ky'), kid('arrow', { name: 'ArrowRight', type: 'INSTANCE', absoluteBoundingBox: { x: 0, y: 0, width: 24, height: 24 } })] })] }, { arrow: 'svg/arrow.svg' });
  const b = buildWith(tree, detOf({ component: 'button', node: 'btn' }));
  const btn = byFigma(b, 'btn');
  assert.equal(btn.name, 'button');
  assert.deepEqual(btn.settings.icon, { library: 'svg', svg: { $asset: 'svg/arrow.svg', size: 'full' } });
  assert.equal(btn.settings.iconPosition, 'right');
  assert.equal(btn.settings.iconGap, '8px');
  assert.deepEqual(btn.settings.link, { type: 'external', url: '#' });
});

test('icon-list: rows of icon + text become the Bricks list with title typography and no separator', () => {
  const row = (i) => kid(`r${i}`, { name: 'Check item', layoutMode: 'HORIZONTAL', itemSpacing: 8, children: [kid(`ic${i}`, { name: 'Icon', type: 'INSTANCE' }), txt(`t${i}`, `Row ${i}`)] });
  const tree = miniSvg({ children: [kid('lst', { layoutMode: 'VERTICAL', itemSpacing: 8, children: [row(1), row(2)] })] }, { ic1: 'svg/a.svg', ic2: 'svg/a.svg' });
  const b = buildWith(tree, detOf({ component: 'icon-list', node: 'lst' }));
  const l = byFigma(b, 'lst');
  assert.equal(l.name, 'list');
  assert.deepEqual(l.settings.items.map((i) => i.title), ['Row 1', 'Row 2']);
  assert.equal(l.settings.items[0].icon.library, 'svg');
  assert.equal(l.settings.separatorDisable, true);
  assert.equal(l.settings.titleTypography['font-size'], '16px');
  assert.match(l.settings._cssCustom, /li \.icon \{ margin-right: 8px; \}/);
  assert.match(l.settings._cssCustom, /display: flex; flex-direction: column; row-gap: 8px;/); // the list element has no gap control: css
  assert.equal(l.settings._rowGap, undefined);
});

test('breadcrumbs: home label, current typography and separator icon from the row', () => {
  const tree = miniSvg({ children: [kid('bc', { layoutMode: 'HORIZONTAL', itemSpacing: 12, children: [txt('h', 'Trang chu'), kid('sep', { name: 'angle-right', type: 'INSTANCE' }), txt('c', 'Toi uu')] })] }, { sep: 'svg/sep.svg' });
  const b = buildWith(tree, detOf({ component: 'breadcrumbs', node: 'bc' }));
  const e = byFigma(b, 'bc');
  assert.equal(e.name, 'breadcrumbs');
  assert.equal(e.settings.homeLabel, 'Trang chu');
  assert.equal(e.settings.separatorType, 'icon');
  assert.equal(e.settings.gap, '12px');
});

test('counter: "80,000+" -> countTo 80000, thousand separator, suffix; text/typography moved to the counter parts', () => {
  const tree = mini({ children: [txt('n', '80,000+'), txt('p', '97%'), txt('bad', 'Hello')] });
  const b = buildWith(tree, detOf({ component: 'counter', node: 'n' }, { component: 'counter', node: 'p' }, { component: 'counter', node: 'bad' }));
  const n = byFigma(b, 'n');
  assert.equal(n.name, 'counter');
  assert.deepEqual([n.settings.countTo, n.settings.thousandSeparator, n.settings.suffix], ['80000', true, '+']);
  assert.equal(n.settings.text, undefined);
  assert.equal(byFigma(b, 'p').settings.suffix, '%');
  assert.equal(byFigma(b, 'bad').name, 'text-basic'); // not a number: stays text, warned
  assert.match(b.warnings.map((w) => w.msg).join(), /not a number/);
});

test('carousel: prev / next frames become the Bricks arrows (size, fill, icon, position) and are not slides; dots read size and active color', () => {
  const card = (i) => kid(`c${i}`, { name: 'card', absoluteBoundingBox: { x: i * 120, y: 0, width: 100, height: 60 }, children: [txt(`ct${i}`, `Card ${i}`)] });
  const arrow = (id, x) => kid(id, { name: 'Arrow', type: 'INSTANCE', absoluteBoundingBox: { x, y: 10, width: 40, height: 40 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }] });
  const dot = (id, w, c) => kid(id, { name: 'dot', absoluteBoundingBox: { x: 0, y: 0, width: w, height: 8 }, fills: [{ type: 'SOLID', color: c }] });
  const tree = miniSvg({ children: [
    kid('row', { name: 'Row', layoutMode: 'HORIZONTAL', itemSpacing: 20, absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 60 }, children: [0, 1, 2].map(card).concat([arrow('pv', 0), arrow('nx', 360)]) }),
    kid('dots', { name: 'Pagination', layoutMode: 'HORIZONTAL', itemSpacing: 6, children: [dot('d1', 24, { r: 0, g: 0, b: 1, a: 1 }), dot('d2', 8, { r: 0.5, g: 0.5, b: 0.5, a: 1 }), dot('d3', 8, { r: 0.5, g: 0.5, b: 0.5, a: 1 })] }),
  ] }, { pv: 'svg/left.svg', nx: 'svg/right.svg' });
  const b = buildWith(tree, detOf({ component: 'carousel', node: 'row', params: { prev: 'pv', next: 'nx', pagination: 'dots' } }));
  const s = byFigma(b, 'row').settings;
  assert.equal(s.arrows, true);
  assert.deepEqual([s.arrowWidth, s.arrowHeight, s.prevArrowTop, s.nextArrowLeft], ['40px', '40px', '10px', '360px']);
  assert.equal(s.nextArrow.svg.$asset, 'svg/right.svg');
  assert.deepEqual([s.paginationWidth, s.paginationWidthActive, s.paginationSpacing], ['8px', '24px', '6px']);
  assert.equal(b.template.content.filter((e) => e.parent === byFigma(b, 'row').id).length, 3); // only the cards are slides
});

test('tooltip-style: the drawn bubble becomes root CSS (variables + :after look) and is not built', () => {
  const bubble = kid('bub', { name: 'Tooltip', type: 'INSTANCE', layoutMode: 'HORIZONTAL', paddingLeft: 4, paddingRight: 4, paddingTop: 4, paddingBottom: 4, cornerRadius: 4, maxWidth: 142,
    fills: [{ type: 'SOLID', color: { r: 0, g: 0.486, b: 0.988, a: 1 } }], effects: [{ type: 'DROP_SHADOW', visible: true, color: { r: 0, g: 0, b: 0, a: 0.12 }, offset: { x: 0, y: 1 }, radius: 8, spread: 0 }],
    children: [{ ...txt('bt', 'Number of domains:'), fills: [{ type: 'SOLID', color: { r: 0.99, g: 0.99, b: 0.99, a: 1 } }] }] });
  const tree = mini({ children: [bubble] });
  const b = buildWith(tree, detOf({ component: 'tooltip-style', node: 'bub' }));
  assert.equal(b.mapping.bub.skipped.startsWith('merged into tooltip-style'), true);
  const root = b.template.content[0].settings._cssCustom;
  assert.match(root, /--bricks-tooltip-bg: #007cfc/);
  assert.match(root, /\[data-balloon\]:after \{[^}]*border-radius: 4px 4px 4px 4px;[^}]*padding: 4px 4px 4px 4px;[^}]*box-shadow: 0px 1px 8px 0px rgba\(0, 0, 0, 0\.12\)/);
});

test('LINE: zero-thickness block keeps the Figma footprint, the CENTER stroke is a ::before (no border, no rotation warning)', () => {
  const stroke = { strokes: [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 1 } }], strokeWeight: 1, strokeAlign: 'CENTER' };
  const vLine = { id: 'ln', name: 'Divider', type: 'LINE', rotation: Math.PI / 2, size: { x: 34, y: 0 }, relativeTransform: [[0, -1, 10], [1, 0, 3]], absoluteBoundingBox: { x: 10, y: 3, width: 0, height: 34 }, ...stroke };
  const hLine = { ...vLine, id: 'hl', rotation: 0, size: { x: 80, y: 0 }, relativeTransform: [[1, 0, 0], [0, 1, 50]], absoluteBoundingBox: { x: 0, y: 50, width: 80, height: 0 } };
  const odd = { ...vLine, id: 'od', rotation: 0.3 };
  const b = buildTemplate(mini({ layoutMode: 'HORIZONTAL', children: [vLine, hLine, odd] }), { overrides: {}, salt: 'l' });
  const v = byFigma(b, 'ln').settings;
  assert.equal(v._border, undefined);
  assert.equal(v._position, 'relative');
  assert.equal(v._width, '0px');
  assert.equal(v._height, '34px');
  assert.match(v._cssCustom, /::before \{ content: ""; position: absolute; left: -0\.5px; top: 0; width: 1px; height: 100%; background: #808080;/);
  assert.match(byFigma(b, 'hl').settings._cssCustom, /::before \{ content: ""; position: absolute; top: -0\.5px; left: 0; height: 1px; width: 100%;/);
  assert.equal(b.warnings.some((w) => w.node === 'ln' || w.node === 'hl'), false);
  assert.match(b.warnings.filter((w) => w.node === 'od').map((w) => w.msg).join(), /rotation/); // other angles keep the generic rules and warn
});

test('countdown: units become fields (format + label), the colon is a ::after at the Figma offset, children merged, date / zone from params', () => {
  const txt = (id, chars, extra = {}) => ({ id, name: id, type: 'TEXT', characters: chars, style: { fontFamily: 'Inter', fontSize: extra.size ?? 32, fontWeight: 700, lineHeightPx: extra.lh ?? 40, textAlignHorizontal: 'CENTER' }, fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 1, a: 1 } }], absoluteBoundingBox: { x: extra.x ?? 0, y: extra.y ?? 0, width: extra.w ?? 58, height: extra.lh ?? 40 } });
  const unit = (id, x, num, label) => kid(id, { type: 'INSTANCE', layoutMode: 'VERTICAL', itemSpacing: 3, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'CENTER', absoluteBoundingBox: { x, y: 0, width: 62, height: 58 }, children: [txt(`${id}n`, num, { x: x + 2 }), txt(`${id}l`, label, { x: x + 2, size: 14, lh: 17.5 })] });
  const values = kid('vals', { layoutMode: 'HORIZONTAL', itemSpacing: 8, absoluteBoundingBox: { x: 0, y: 0, width: 146, height: 58 }, children: [unit('u1', 0, '20', 'Ngày'), txt('sp', ':', { x: 70, y: 18, w: 6, size: 18, lh: 22 }), unit('u2', 84, '00', 'Giờ')] });
  const det = (params) => ({ components: [{ id: 'd1', status: 'approved', component: 'countdown', node: 'vals', params }] });
  const params = { fields: [{ node: 'u1', format: '%D' }, { node: 'u2', format: '%H' }], date: '2026-10-29 19:30', timezone: 'UTC+07:00' };
  const b = buildWith(mini({ children: [values] }), det(params));
  const el = byFigma(b, 'vals');
  assert.equal(el.name, 'countdown');
  assert.equal(el.settings.date, '2026-10-29 19:30');
  assert.equal(el.settings.timezone, 'UTC+07:00');
  assert.deepEqual(el.settings.fields.map(({ format, suffix }) => ({ format, suffix })), [{ format: '%D', suffix: 'Ngày' }, { format: '%H', suffix: 'Giờ' }]);
  assert.equal(el.settings.gutter.right, '22px'); // 8 + 6 (colon) + 8
  assert.match(el.settings._cssCustom, /\.field:not\(:last-child\)::after \{ content: ":"; position: absolute; left: 70px; top: 18px;/);
  assert.match(el.settings._cssCustom, /\.field \{ position: relative; flex-shrink: 0; width: 62px; height: 58px; row-gap: 3px; \}/);
  assert.equal(el.settings._columnGap, undefined);
  assert.equal(b.template.content.length, 2); // root + countdown: units and colon merged
  assert.equal(b.warnings.some((w) => /countdown/.test(w.msg)), false);
  const bare = buildWith(mini({ children: [values] }), det({ fields: params.fields }));
  assert.match(bare.warnings.map((w) => w.msg).join(), /no target date/);
  assert.match(bare.warnings.map((w) => w.msg).join(), /no time zone/);
  const bad = buildWith(mini({ children: [values] }), det({ ...params, fields: [{ node: 'u1', format: 'days' }, params.fields[1]] }));
  assert.equal(byFigma(bad, 'vals').name, 'block'); // approved but not applicable: stays a block, warned
  assert.match(bad.warnings.map((w) => w.msg).join(), /format must be one of/);
});

test('overflow like Figma: cross-axis center spills on both sides, an absolute child wider than its parent is not clamped to 100%', () => {
  const wide = kid('wd', { name: 'Glow', absoluteBoundingBox: { x: -20, y: 0, width: 240, height: 10 }, children: [] });
  const box = kid('bx', { name: 'Box', layoutMode: undefined, absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 50 }, children: [wide] });
  const b = buildTemplate(mini({ children: [box] }), { overrides: {}, salt: 'o' });
  assert.equal(byFigma(b, 'wd').settings._widthMax, 'none');
  assert.equal(byFigma(b, 'bx').settings._widthMax, '100%');
  const col = kid('col', { layoutMode: 'VERTICAL', counterAxisAlignItems: 'CENTER', primaryAxisAlignItems: 'CENTER', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 }, children: [] });
  const c = byFigma(buildTemplate(mini({ children: [col] }), { overrides: {}, salt: 'o' }), 'col').settings;
  assert.equal(c._alignItems, 'center');
  assert.equal(c._justifyContent, 'safe center');
});

test('artboard anchoring: root-level absolute children follow the viewport (constraints, hand-centered LEFT), exact at the artboard width', () => {
  const abs = (id, x, w, horizontal) => kid(id, { constraints: { horizontal, vertical: 'TOP' }, absoluteBoundingBox: { x, y: 0, width: w, height: 20 }, children: [] });
  const tree = mini({ layoutMode: undefined, children: [
    abs('ct', 100, 200, 'LEFT'), // 400 wide artboard, centered by hand: (400-200)/2 = 100
    abs('cc', 0, 402, 'CENTER'),
    abs('lf', 10, 50, 'LEFT'),
    abs('rt', 340, 50, 'RIGHT'),
    abs('lr', 20, 360, 'LEFT_RIGHT'),
    abs('sc', 40, 200, 'SCALE'),
  ] });
  const b = buildTemplate(tree, { overrides: {}, salt: 'a' });
  const s = (id) => byFigma(b, id).settings;
  assert.equal(s('ct')._left, '50%'); // the middle of the box sits on the middle of the artboard
  assert.match(s('ct')._cssCustom, /transform: translateX\(-50%\);/);
  assert.equal(s('cc')._left, 'calc(50% + 1px)'); // constraint CENTER keeps Figma's offset from the middle
  assert.equal(s('lf')._left, '10px');
  assert.equal(s('rt')._right, '10px');
  assert.equal(s('rt')._left, undefined);
  assert.equal(s('lr')._right, '20px');
  assert.equal(s('lr')._width, 'auto');
  assert.equal(s('sc')._left, '10%');
  assert.equal(s('sc')._width, '50%');
  assert.equal(b.mapping.ct.expect.x, 100); // verify still compares the artboard-width position
});

test('GRID: Figma grid auto layout becomes CSS grid with the Figma tracks, gaps and cells; HUG cards keep their own height', () => {
  const card = (id, col, row, h, extra = {}) => kid(id, { layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG', layoutGrow: 1, gridColumnAnchorIndex: col, gridRowAnchorIndex: row, gridColumnSpan: 1, gridRowSpan: 1, gridChildHorizontalAlign: 'AUTO', gridChildVerticalAlign: 'AUTO', absoluteBoundingBox: { x: col * 172, y: row * 100, width: 166, height: h }, children: [], ...extra });
  const grid = kid('gr', { layoutMode: 'GRID', paddingTop: 16, gridColumnCount: 2, gridRowCount: 2, gridColumnGap: 12, gridRowGap: 10, gridColumnsSizing: 'repeat(2,minmax(0,1fr))', gridRowsSizing: 'repeat(2,fit-content(100%))', layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG', absoluteBoundingBox: { x: 0, y: 0, width: 344, height: 216 }, children: [card('c1', 0, 0, 80), card('c2', 1, 0, 100), card('c3', 0, 1, 90, { layoutSizingVertical: 'FILL' })] });
  const b = buildTemplate(mini({ children: [grid] }), { overrides: {}, salt: 'g' });
  const g = byFigma(b, 'gr').settings;
  assert.equal(g._display, 'grid');
  assert.equal(g._direction, undefined);
  assert.match(g._cssCustom, /grid-template-columns: repeat\(2,minmax\(0,1fr\)\); grid-template-rows: repeat\(2,fit-content\(100%\)\); column-gap: 12px; row-gap: 10px; align-items: start !important;/);
  assert.equal(g._padding.top, '16px');
  const c2 = byFigma(b, 'c2').settings;
  assert.match(c2._cssCustom, /grid-column: 2 \/ span 1; grid-row: 1 \/ span 1;/);
  assert.equal(c2._width, 'auto');
  assert.equal(c2._flexGrow, undefined); // no main axis in a grid cell
  assert.equal(c2._height, 'auto');
  assert.doesNotMatch(c2._cssCustom, /align-self/); // HUG card: keeps its own height
  assert.match(byFigma(b, 'c3').settings._cssCustom, /align-self: stretch;/);
  assert.equal(b.warnings.some((w) => /grid/i.test(w.msg)), false);
});

test('responsive match: same-name children pair in order, aliases win, a node moved out of a wrapper is found by its unique name', () => {
  const n = (id, name, children = []) => ({ id, name, type: 'FRAME', children });
  const base = n('b0', 'Hero', [n('b1', 'Title'), n('b2', 'Row', [n('b3', 'Item'), n('b4', 'Item')]), n('b5', 'Wrap', [n('b6', 'Countdown'), n('b7', 'CTA')]), n('b8', 'Hero / Registration old')]);
  const variant = n('v0', 'Hero', [n('v1', 'Title'), n('v2', 'Row', [n('v3', 'Item'), n('v4', 'Item')]), n('v6', 'Countdown'), n('v7', 'CTA'), n('v9', 'Registration'), n('v10', 'Only here')]);
  const { pairs, unmatchedVariant, unmatchedBase } = matchTrees(base, variant, { aliases: { v9: 'b8' } });
  assert.equal(pairs.get('v0'), 'b0');
  assert.equal(pairs.get('v3'), 'b3');
  assert.equal(pairs.get('v4'), 'b4');
  assert.equal(pairs.get('v6'), 'b6'); // lost its wrapper
  assert.equal(pairs.get('v9'), 'b8'); // alias although the names differ
  assert.deepEqual(unmatchedVariant.map((x) => x.id), ['v10']);
  assert.deepEqual(unmatchedBase.map((x) => x.id), ['b5']); // the wrapper has no partner
});


test('responsive merge: breakpoint keys for changed values, unset for dropped css, split on content, hide / contents / variant-only elements', () => {
  const node = (id, name, children = []) => ({ id, name, type: 'FRAME', children });
  const el = (id, parent, name, settings = {}, label = id) => ({ id, parent, name, settings, label });
  // base frame: root > [title, wrap > [cta], photo, deco]
  const baseTree = node('r', 'Hero', [node('t', 'Title'), node('w', 'Wrap', [node('c', 'CTA')]), node('p', 'Photo'), node('d', 'Deco')]);
  const baseEls = [
    el('R', 0, 'section', { _width: '100%', _height: '1000px' }),
    el('T', 'R', 'heading', { _typography: { 'font-size': '58px', 'white-space': 'nowrap', color: { hex: '#fff' } }, text: 'Hi', _cssCustom: '#brxe-T { align-self: stretch; margin: 0; }' }),
    el('W', 'R', 'block', { _padding: { top: '10px', right: '10px', bottom: '10px', left: '10px' } }),
    el('C', 'W', 'button', { text: 'Go', _widthMax: '100%' }),
    el('P', 'R', 'image', { image: { $asset: 'images/a.png' }, _width: '200px' }),
    el('D', 'R', 'block', { _width: '50px' }),
  ];
  const map = (pairs) => Object.fromEntries(pairs.map(([f, b, element]) => [f, { bricksId: b, element, verify: true, expect: { x: 0, y: 0, w: 1, h: 1, css: {} } }]));
  const base = { tree: baseTree, template: { title: 'x', type: 'section', content: baseEls }, mapping: map([['r', 'R', 'section'], ['t', 'T', 'heading'], ['w', 'W', 'block'], ['c', 'C', 'button'], ['p', 'P', 'image'], ['d', 'D', 'block']]) };
  // tablet frame: the wrapper is gone (CTA moved up), title smaller and wrappable, a different photo, no deco, a new strip
  const vTree = node('vr', 'Hero', [node('vt', 'Title'), node('vc', 'CTA'), node('vp', 'Photo'), node('vs', 'Strip')]);
  const vEls = [
    el('VR', 0, 'section', { _width: '100%', _height: '700px' }),
    el('VT', 'VR', 'heading', { _typography: { 'font-size': '42px', color: { hex: '#fff' } }, text: 'Hi', _cssCustom: '#brxe-VT { margin: 0; }' }),
    el('VC', 'VR', 'button', { text: 'Go' }),
    el('VP', 'VR', 'image', { image: { $asset: 'images/b.png' }, _width: '150px' }),
    el('VS', 'VR', 'block', { _width: '30px' }),
  ];
  const variant = { key: 'tablet_portrait', maxWidth: 991, aliases: {}, tree: vTree, template: { content: vEls }, mapping: map([['vr', 'VR', 'section'], ['vt', 'VT', 'heading'], ['vc', 'VC', 'button'], ['vp', 'VP', 'image'], ['vs', 'VS', 'block']]) };
  const { template, mappings, warnings } = mergeResponsive({ base, variants: [variant] });
  const get = (id) => template.content.find((e) => e.id === id);
  assert.equal(get('R').settings['_height:tablet_portrait'], '700px');
  assert.equal(get('R')._width, undefined);
  assert.deepEqual(get('T').settings['_typography:tablet_portrait'], { 'font-size': '42px', 'white-space': 'normal' }); // only what changed, dropped sub-key reset
  assert.match(get('T').settings._cssCustom, /#brxe-T \{ align-self: stretch; margin: 0; \} @media \(max-width: 991px\) \{ #brxe-T \{ align-self: unset; \} \}/);
  assert.equal(get('C').settings['_widthMax:tablet_portrait'], 'none'); // the variant left it out: initial value, not a warning
  assert.match(get('W').settings._cssCustom, /@media \(max-width: 991px\) \{ body #brxe-W \{ display: contents; \} \}/); // wrapper lost, its CTA lives on
  assert.match(get('D').settings._cssCustom, /@media \(max-width: 991px\) \{ body #brxe-D \{ display: none; \} \}/); // no partner: hidden in the tablet range
  assert.match(get('P').settings._cssCustom, /display: none;/); // different picture: two elements, the base one is hidden at tablet
  const strip = get('VS');
  assert.equal(strip.parent, 'R'); // variant-only elements hang under the partner of their parent
  assert.match(strip.settings._cssCustom, /@media \(min-width: 992px\) \{ body #brxe-VS \{ display: none; \} \}/); // hidden above the breakpoint
  assert.equal(get('P').settings.loading, 'lazy'); // hidden at tablet: not downloaded there
  assert.equal(mappings.tablet_portrait.vt.bricksId, 'T'); // verify at 768 measures the shared element
  assert.equal(mappings.tablet_portrait.vs.bricksId, 'VS');
  assert.equal(warnings.some((w) => /cannot unset/.test(w.msg)), false);
});


test('stacking + image transform: flow siblings of absolute layers become relative; STRETCH with an imageTransform is a crop like CROP', () => {
  const abs = kid('ab', { name: 'Glow', layoutPositioning: 'ABSOLUTE', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 40 }, children: [] });
  const flow = kid('fl', { name: 'Text', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 20 }, children: [] });
  const b = buildTemplate(mini({ children: [abs, flow] }), { overrides: {}, salt: 's' });
  assert.equal(byFigma(b, 'fl').settings._position, 'relative'); // paints in layer order, above the absolute glow before it
  assert.equal(byFigma(b, 'ab').settings._position, 'absolute');

  const stretch = (T) => ({ id: 'im', name: 'Photo', type: 'RECTANGLE', absoluteBoundingBox: { x: 0, y: 0, width: 195, height: 246 }, fills: [{ type: 'IMAGE', imageRef: 'r', scaleMode: 'STRETCH', imageTransform: T }] });
  const manifest = { images: { r: { file: 'images/r.png', bytes: 1, sha256: 'x', width: 100, height: 100, ext: 'png' } }, svgs: {} };
  const tree = (T) => normalizeRoot({ nodes: { r: { document: { id: 'r', name: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 }, children: [stretch(T)] } } } }, 'r', manifest);
  const crop = byFigma(buildTemplate(tree([[0.5, 0, 0.25], [0, 0.5, 0.1]]), { overrides: {}, salt: 's' }), 'im');
  assert.equal(crop.name, 'block'); // wrapper that clips
  assert.equal(crop.settings._overflow, 'hidden');
  const plain = byFigma(buildTemplate(tree([[1, 0, 0], [0, 1, 0]]), { overrides: {}, salt: 's' }), 'im');
  assert.equal(plain.name, 'image'); // identity transform: nothing to crop
});


test('text runs: a gradient fill on a range of characters is painted by its span and clipped to the glyphs', () => {
  const grad = { type: 'GRADIENT_LINEAR', gradientHandlePositions: [{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 0 }], gradientStops: [{ position: 0, color: { r: 0.9764706, g: 0.7843137, b: 0.1137255, a: 1 } }, { position: 1, color: { r: 1, g: 0.4509804, b: 0.3215686, a: 1 } }] };
  const raw = { id: 'tx', name: 'Title', type: 'TEXT', characters: 'GROW fast', style: { fontFamily: 'Inter', fontSize: 58, fontWeight: 700, lineHeightPx: 70 }, characterStyleOverrides: [1, 1, 1, 1, 0, 0, 0, 0, 0], styleOverrideTable: { 1: { fontFamily: 'Inter', fontSize: 58, fills: [grad] } }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 70 } };
  const [, text] = buildMini({ children: [raw] });
  assert.match(text.settings.text, /<span style="background-image:linear-gradient\(180deg, #f9c81d 0%, #ff7352 100%\);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">GROW<\/span> fast/);
});


test('effects: a text drop shadow is text-shadow (all of them), not a box shadow of the text box', () => {
  const raw = { id: 'tx', name: 'Name', type: 'TEXT', characters: 'Hi', style: { fontFamily: 'Inter', fontSize: 20, fontWeight: 700, lineHeightPx: 26 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], effects: [{ type: 'DROP_SHADOW', visible: true, color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 1, y: 2 }, radius: 1, spread: 0 }, { type: 'DROP_SHADOW', visible: true, color: { r: 0.7, g: 0.3, b: 0, a: 1 }, offset: { x: 1, y: 1 }, radius: 1, spread: 0 }], absoluteBoundingBox: { x: 0, y: 0, width: 80, height: 26 } };
  const [, text] = buildMini({ children: [raw] });
  assert.equal(text.settings._boxShadow, undefined);
  assert.match(text.settings._cssCustom, /text-shadow: 1px 2px 1px rgba\(0, 0, 0, 0\.25\), 1px 1px 1px #b34d00;/);
});

test('policy: line-height is written as Figma lays it out (whole pixels), exact mode keeps the raw number', async () => {
  const raw = { id: 'tx', name: 'Cap', type: 'TEXT', characters: 'a\nb\nc', style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 600, lineHeightPx: 19.3636 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], absoluteBoundingBox: { x: 0, y: 0, width: 60, height: 57 } };
  const [, text] = buildMini({ children: [raw] });
  assert.equal(text.settings._typography['line-height'], '19px');
  const { lineHeightPx } = await import('../bricks/policy.mjs');
  assert.equal(lineHeightPx(17.5), 18);
  assert.equal(lineHeightPx(23.75), 24);
  assert.equal(lineHeightPx(12.24), 12);
});


test('text: double spaces inside a text are kept like Figma (HTML would collapse them); a trailing space is not part of the box', () => {
  const mk = (id, chars, resize) => ({ id, name: id, type: 'TEXT', characters: chars, style: { fontFamily: 'Inter', fontSize: 20, fontWeight: 700, lineHeightPx: 25, textAutoResize: resize }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 25 } });
  const els = buildMini({ children: [mk('a', 'GROW  SMARTER', 'HEIGHT'), mk('b', 'GROW  SMARTER', 'WIDTH_AND_HEIGHT'), mk('c', 'WEBINAR ', 'WIDTH_AND_HEIGHT')] });
  assert.equal(els[1].settings._typography['white-space'], 'pre-wrap');
  assert.equal(els[2].settings._typography['white-space'], 'pre'); // hugging text never wraps
  assert.equal(els[3].settings._typography['white-space'], 'nowrap'); // trailing space: not kept
});


test('svg nodes: the exported file carries fill / stroke / effects, so no CSS background or border is painted behind it', () => {
  const vec = { id: 'v1', name: 'Corner', type: 'VECTOR', fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], absoluteBoundingBox: { x: 0, y: 0, width: 35, height: 42 } };
  const tree = normalizeRoot({ nodes: { r: { document: { id: 'r', name: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 }, children: [vec] } } } }, 'r', { images: {}, svgs: { v1: { file: 'svg/v1.svg', bytes: 10, sha256: 'x' } } });
  const el = byFigma(buildTemplate(tree, { overrides: {}, salt: 'v' }), 'v1');
  assert.equal(el.name, 'svg');
  assert.equal(el.settings._background, undefined);
  assert.equal(el.settings._border, undefined);
  assert.equal(el.settings._width, '35px'); // placement and size are still written
});


test('effects: several shadows become one box-shadow list (drop and inner, Figma order), nothing is dropped', () => {
  const sh = (type, x, y, blur) => ({ type, visible: true, color: { r: 1, g: 0.85, b: 0.63, a: 0.6 }, offset: { x, y }, radius: blur, spread: 0 });
  const raw = { id: 'bt', name: 'Btn', type: 'FRAME', effects: [sh('INNER_SHADOW', -3, -4, 8), sh('INNER_SHADOW', 3, 4, 8), sh('DROP_SHADOW', 1, 0.5, 1)], absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 40 }, children: [] };
  const [, box] = buildMini({ children: [raw] });
  assert.equal(box.settings._boxShadow, undefined);
  assert.match(box.settings._cssCustom, /box-shadow: inset -3px -4px 8px 0px rgba\(255, 217, 161, 0\.6\), inset 3px 4px 8px 0px rgba\(255, 217, 161, 0\.6\), 1px 0\.5px 1px 0px rgba\(255, 217, 161, 0\.6\);/);
});


test('autopilot decide: headings from text size, ul/li for repeated items, text-free decoration approved, flat-image with text rejected, icons hidden, alt left empty', () => {
  const txt = (id, chars, size, extra = {}) => ({ id, name: id, type: 'TEXT', visible: true, text: { characters: chars, fontSize: size }, ...extra });
  const item = (i) => ({ id: `it${i}`, name: 'Card', type: 'INSTANCE', children: [{ id: `ic${i}`, name: 'Icon', type: 'FRAME', svg: { file: 'x.svg' }, children: [] }, txt(`t${i}`, `Title ${i}`, 24), txt(`d${i}`, 'A longer description text of the card', 16)] });
  const tree = { id: 'r', name: 'Section', type: 'FRAME', children: [
    txt('h', 'Big section title', 40),
    { id: 'list', name: 'List', type: 'FRAME', children: [item(1), item(2), item(3)] },
    { id: 'deco', name: 'Deco', type: 'FRAME', children: [{ id: 'dv', name: 'Vec', type: 'VECTOR', children: [] }] },
    { id: 'ban', name: 'Banner', type: 'FRAME', children: [txt('bt', 'Real text inside', 18)] },
    { id: 'img', name: 'Photo', type: 'RECTANGLE', fills: [{ type: 'IMAGE' }], children: [] },
  ] };
  const facts = { repeats: [{ parent: 'list', parentName: 'List', count: 3, itemName: 'Card', ids: ['it1', 'it2', 'it3'] }] };
  const det = { version: 1, sections: [], components: [
    { id: 'd1', status: 'proposed', source: 'rule', component: 'flat-image', node: 'deco' },
    { id: 'd2', status: 'proposed', source: 'rule', component: 'flat-image', node: 'ban' },
    { id: 'd3', status: 'proposed', source: 'rule', component: 'tooltip', node: 'ic1' },
  ] };
  const files = { 'tree.json': tree, 'facts.json': facts, 'detections.json': det, 'overrides.json': { nodes: {} } };
  const ws = { readJson: (n, fb) => files[n] ?? fb, writeJson: (n, v) => { files[n] = v; } };
  const out = decide(ws, { firstSection: false });
  const status = Object.fromEntries(files['detections.json'].components.filter((c) => c.source === 'rule').map((c) => [c.id, c.status]));
  assert.deepEqual(status, { d1: 'approved', d2: 'rejected', d3: 'rejected' });
  const ov = files['overrides.json'].nodes;
  assert.equal(ov.h.tag, 'h2');
  assert.equal(ov.t1.tag, 'h3');
  assert.equal(ov.d1, undefined); // the description is not a title
  assert.deepEqual(ov.ic1.settings._attributes, [{ name: 'aria-hidden', value: 'true' }]);
  assert.equal(ov.img.alt, '');
  assert.equal(ov.img.settings.loading, 'lazy');
  const list = files['detections.json'].components.find((c) => c.component === 'semantic');
  assert.deepEqual(list.params, { tag: 'ul', itemTag: 'li' });
  assert.ok(out.designer.some((d) => /Alt text of the image "Photo"/.test(d)));
  // a text-free group holding a mask layer becomes a flat picture
  const files2 = { 'tree.json': { id: 'r', name: 'S', type: 'FRAME', children: [{ id: 'g', name: 'Bg', type: 'GROUP', children: [{ id: 'm', name: 'Mask', type: 'RECTANGLE', isMask: true, children: [] }, { id: 'p', name: 'Pic', type: 'RECTANGLE', children: [] }] }] }, 'facts.json': { repeats: [] }, 'detections.json': { version: 1, sections: [], components: [] }, 'overrides.json': { nodes: {} } };
  decide({ readJson: (n, fb) => files2[n] ?? fb, writeJson: (n, v) => { files2[n] = v; } }, {});
  assert.equal(files2['detections.json'].components.find((c) => c.component === 'flat-image' && c.node === 'g').status, 'approved');
  // first section of the page: the title is the h1
  files['overrides.json'] = { nodes: {} };
  decide(ws, { firstSection: true });
  assert.equal(files['overrides.json'].nodes.h.tag, 'h1');
  assert.equal(files['overrides.json'].nodes.t1.tag, 'h2');
});


test('frame background image: STRETCH with an imageTransform is drawn 1/s times the box and shifted by -t/s (Benefits section)', () => {
  const kidNode = kid('k1', { name: 'Child', children: [] });
  const raw = { id: 'bg', name: 'Section', type: 'FRAME', fills: [{ type: 'IMAGE', imageRef: 'r', scaleMode: 'STRETCH', imageTransform: [[1, 0, 0], [0, 0.4089, 0.0001]] }], absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 750 }, children: [kidNode] };
  const manifest = { images: { r: { file: 'images/r.png', bytes: 1, sha256: 'x', width: 1440, height: 1440, ext: 'png' } }, svgs: {} };
  const tree = normalizeRoot({ nodes: { r: { document: { id: 'r', name: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 750 }, children: [raw] } } } }, 'r', manifest);
  const el = byFigma(buildTemplate(tree, { overrides: {}, salt: 'b' }), 'bg');
  assert.match(el.settings._cssCustom, /background-size: 100% 244\.5\d*%; background-position: 0% 0\.01\d*%;/);
  assert.equal(el.settings._background.size, undefined); // size / position come from the custom css, not the select
});


test('FILL with a max width in a centered column: full width up to the cap, then centered (not stretched to the start edge)', () => {
  const photo = kid('ph', { name: 'Photo', layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'FIXED', layoutAlign: 'STRETCH', maxWidth: 260, absoluteBoundingBox: { x: 41, y: 0, width: 260, height: 100 }, children: [] });
  const col = kid('col', { layoutMode: 'VERTICAL', counterAxisAlignItems: 'CENTER', absoluteBoundingBox: { x: 0, y: 0, width: 343, height: 100 }, children: [photo] });
  const b = buildTemplate(mini({ children: [col] }), { overrides: {}, salt: 'm' });
  const s = byFigma(b, 'ph').settings;
  assert.equal(s._alignSelf, 'center');
  assert.equal(s._width, '100%');
  assert.equal(s._widthMax, '260px');
});


test('fills: an opaque solid on top covers the image under it (listed bottom to top), so only the solid is painted', () => {
  const kidNode = kid('k1', { name: 'Child', children: [] });
  const raw = { id: 'bg', name: 'Section', type: 'FRAME', fills: [{ type: 'IMAGE', imageRef: 'r', scaleMode: 'FILL' }, { type: 'SOLID', color: { r: 0, g: 0.2, b: 0.7, a: 1 } }], absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 }, children: [kidNode] };
  const manifest = { images: { r: { file: 'images/r.png', bytes: 1, sha256: 'x', width: 10, height: 10, ext: 'png' } }, svgs: {} };
  const tree = normalizeRoot({ nodes: { r: { document: { id: 'r', name: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 }, children: [raw] } } } }, 'r', manifest);
  const el = byFigma(buildTemplate(tree, { overrides: {}, salt: 'f' }), 'bg');
  assert.equal(el.settings._background.image, undefined);
  assert.equal(el.settings._background.color.hex, '#0033b3');
});


test('FILL text inside a hugging parent is capped at its design width (the paragraph wraps at 420px instead of stretching the hugging card to one line)', () => {
  const txt = { id: 'tx', name: 'Para', type: 'TEXT', characters: 'long long long text', style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, lineHeightPx: 24, textAutoResize: 'HEIGHT' }, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG', layoutGrow: 1, fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }], absoluteBoundingBox: { x: 0, y: 0, width: 420, height: 48 } };
  const row = kid('row', { layoutMode: 'HORIZONTAL', layoutSizingHorizontal: 'HUG', layoutSizingVertical: 'HUG', absoluteBoundingBox: { x: 0, y: 0, width: 452, height: 48 }, children: [txt] });
  const b = buildTemplate(mini({ children: [row] }), { overrides: {}, salt: 'h' });
  assert.equal(byFigma(b, 'tx').settings._widthMax, '420px');
});


test('text: a short label laid out on one line in Figma is nowrap, a multi-line paragraph is not', () => {
  const mk = (id, chars, h) => ({ id, name: id, type: 'TEXT', characters: chars, style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, lineHeightPx: 24, textAutoResize: 'HEIGHT' }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], absoluteBoundingBox: { x: 0, y: 0, width: 192, height: h } });
  const els = buildMini({ children: [mk('one', 'SỐ LƯỢNG: 01', 24), mk('two', 'A paragraph that Figma wraps over two lines in its box', 48)] });
  assert.equal(els[1].settings._typography['white-space'], 'nowrap');
  assert.equal(els[2].settings._typography['white-space'], undefined);
});


test('autopilot decide: a section without a visible fill takes the fill of its page frame; one with its own fill keeps it', () => {
  const mk = (fills) => ({ 'tree.json': { id: 'r', name: 'S', type: 'FRAME', fills, children: [] }, 'facts.json': { repeats: [] }, 'detections.json': { version: 1, sections: [], components: [] }, 'overrides.json': { nodes: {} } });
  const run = (files, parentBg) => { decide({ readJson: (n, fb) => files[n] ?? fb, writeJson: (n, v) => { files[n] = v; } }, { parentBg }); return files['overrides.json'].nodes.r; };
  assert.equal(run(mk([]), '#0b36b2').settings._background.color.hex, '#0b36b2');
  assert.equal(run(mk([{ type: 'SOLID', hex: '#ffffff', alpha: 1 }]), '#0b36b2'), undefined);
  assert.equal(run(mk([]), null), undefined);
});


test('line height from the Figma box: auto-height text uses box height / lines (22.4px line = 23px box); fixed-height text keeps policy rounding', () => {
  const mk = (id, h, resize) => ({ id, name: id, type: 'TEXT', characters: 'Ho va Ten', style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, lineHeightPx: 22.4, textAutoResize: resize }, fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }], absoluteBoundingBox: { x: 0, y: 0, width: 200, height: h } });
  const els = buildMini({ children: [mk('auto', 23, 'HEIGHT'), mk('two', 46, 'HEIGHT'), mk('fixed', 40, 'NONE')] });
  assert.equal(els[1].settings._typography['line-height'], '23px');
  assert.equal(els[2].settings._typography['line-height'], '23px'); // 46 / 2 lines
  assert.equal(els[3].settings._typography['line-height'], '22px'); // fixed height: policy rounding
});

test('stroke OUTSIDE / CENTER: no border (it would grow the box), shadows instead, listed above the node shadows', () => {
  const stroke = (align) => ({ strokes: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 } }], strokeWeight: 2, strokeAlign: align });
  const sh = { type: 'DROP_SHADOW', visible: true, color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 2 }, radius: 3, spread: 0 };
  const els = buildMini({ children: [kid('o', { ...stroke('OUTSIDE'), absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 40 }, children: [] }), kid('c', { ...stroke('CENTER'), effects: [sh], absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 40 }, children: [] })] });
  assert.equal(els[1].settings._border, undefined);
  assert.match(els[1].settings._cssCustom, /box-shadow: 0 0 0 2px #ff0000;/);
  assert.ok(els[2].settings._cssCustom.includes('box-shadow: 0 0 0 1px #ff0000, inset 0 0 0 1px #ff0000, 0px 2px 3px 0px rgba(0, 0, 0, 0.25);'));
});
