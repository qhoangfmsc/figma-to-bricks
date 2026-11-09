import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';

const box = (x, y, w, h) => ({ x, y, width: w, height: h });
const manifest = { images: {}, svgs: {} };
const build = (document, extra = {}) => {
  const tree = normalizeRoot({ nodes: { r: { document } } }, 'r', manifest);
  return buildTemplate(tree, { overrides: {}, salt: 'attr', ...extra });
};
const settings = (built, id) => built.template.content.find((e) => e.id === built.mapping[id].bricksId).settings;

const root = (children, extra = {}) => ({
  id: 'r', name: 'Section', type: 'FRAME',
  absoluteBoundingBox: box(0, 0, 400, 200),
  layoutMode: 'VERTICAL',
  children,
  ...extra,
});

test('cross-axis stretch fills the Align self control and keeps the Figma width', () => {
  const built = build(root([{
    id: 'row', name: 'Row', type: 'FRAME',
    absoluteBoundingBox: box(0, 0, 400, 80),
    layoutMode: 'HORIZONTAL',
    itemSpacing: 16,
    children: [{
      id: 'card', name: 'Card', type: 'FRAME',
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'FILL',
      layoutAlign: 'STRETCH',
      absoluteBoundingBox: box(0, 0, 88, 80),
      layoutMode: 'VERTICAL',
      children: [{ id: 'label', name: 'Label', type: 'FRAME', absoluteBoundingBox: box(0, 0, 40, 16), children: [] }],
    }],
  }]));
  const card = settings(built, 'card');
  assert.equal(card._alignSelf, 'stretch');
  assert.equal(card._width, '88px');
  assert.match(card._cssCustom, /align-self: stretch;/);
  assert.match(card._cssCustom, /\.brxe-\w+\.brxe-block \{ width: 88px; \}/);
});

test('layoutAlign center and max become Align self, without a stretch width', () => {
  const child = (id, align) => ({
    id, name: id, type: 'FRAME', layoutAlign: align,
    absoluteBoundingBox: box(0, 0, 40, 20),
    children: [{ id: id + 'c', name: 'c', type: 'FRAME', absoluteBoundingBox: box(0, 0, 10, 10), children: [] }],
  });
  const built = build(root([child('mid', 'CENTER'), child('end', 'MAX')], { layoutMode: 'VERTICAL' }));
  assert.equal(settings(built, 'mid')._alignSelf, 'center');
  assert.equal(settings(built, 'end')._alignSelf, 'flex-end');
  assert.doesNotMatch(settings(built, 'mid')._cssCustom ?? '', /width: 100%/);
});

test('an absolute badge inside a card keeps the Figma inset when the card width changes', () => {
  const built = build(root([{
    id: 'card', name: 'Card', type: 'FRAME',
    absoluteBoundingBox: box(0, 0, 128, 64),
    layoutMode: 'VERTICAL',
    children: [
      {
        id: 'tag', name: 'Tag', type: 'FRAME', layoutPositioning: 'ABSOLUTE',
        constraints: { horizontal: 'RIGHT', vertical: 'TOP' },
        absoluteBoundingBox: box(93, 0, 35, 16),
        children: [],
      },
      {
        id: 'mark', name: 'Mark', type: 'FRAME', layoutPositioning: 'ABSOLUTE',
        constraints: { horizontal: 'CENTER', vertical: 'CENTER' },
        absoluteBoundingBox: box(10, 8, 20, 12),
        children: [],
      },
    ],
  }]));
  const tag = settings(built, 'tag');
  assert.equal(tag._right, '0px');
  assert.equal(tag._left, undefined);
  assert.equal(tag._top, '0px');
  const mark = settings(built, 'mark');
  assert.equal(mark._left, 'calc(50% - 44px)'); // 10 + 10 - 64
  assert.equal(mark._top, 'calc(50% - 18px)'); // 8 + 6 - 32
  assert.match(mark._cssCustom, /transform: translate\(-50%, -50%\);/);
});

test('a fixed-height text uses the vertical alignment Figma drew', () => {
  const text = (id, valign, textCase) => ({
    id, name: id, type: 'TEXT', characters: 'Moi',
    absoluteBoundingBox: box(0, 0, 40, 32),
    style: { fontFamily: 'Inter', fontSize: 12, fontWeight: 700, lineHeightPx: 16, textAlignHorizontal: 'CENTER', textAlignVertical: valign, textAutoResize: 'NONE', textCase },
  });
  const built = build(root([text('mid', 'CENTER'), text('low', 'BOTTOM'), text('caps', 'TOP', 'SMALL_CAPS')]));
  assert.match(settings(built, 'mid')._cssCustom, /display: flex; flex-direction: column; justify-content: center;/);
  assert.match(settings(built, 'low')._cssCustom, /justify-content: flex-end;/);
  assert.equal(built.warnings.some((w) => /vertical align/.test(w.msg)), false);
  assert.match(settings(built, 'caps')._cssCustom, /font-variant-caps: small-caps;/);
});

test('a slider row keeps justify and align, and a slide is not recentered by the theme', () => {
  const card = (id, x) => ({
    id, name: id, type: 'FRAME',
    absoluteBoundingBox: box(x, 0, 100, 60),
    layoutMode: 'VERTICAL',
    itemSpacing: 4,
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
    children: [{
      id: id + 't', name: 'Label', type: 'TEXT', characters: 'Card',
      absoluteBoundingBox: box(x, 8, 40, 16),
      style: { fontFamily: 'Inter', fontSize: 12, fontWeight: 400, lineHeightPx: 16 },
    }],
  });
  const built = build(root([{
    id: 'row', name: 'Slider', type: 'FRAME',
    absoluteBoundingBox: box(0, 0, 400, 60),
    layoutMode: 'HORIZONTAL',
    itemSpacing: 16,
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'MAX',
    children: [card('a', 0), card('b', 116)],
  }]), {
    detections: { components: [{ id: 'd1', status: 'approved', component: 'carousel', node: 'row', params: {} }] },
  });
  const row = settings(built, 'row');
  assert.equal(built.template.content.find((e) => e.id === built.mapping.row.bricksId).name, 'slider-nested');
  assert.equal(row.gap, 16);
  assert.match(row._cssCustom, /\.splide__list \{ justify-content: center; align-items: flex-end; \}/);
  const slide = settings(built, 'a');
  assert.match(slide._cssCustom, /flex-direction: column; justify-content: flex-start; align-items: flex-start;/);
  assert.match(slide._cssCustom, /row-gap: 4px;/);
});
