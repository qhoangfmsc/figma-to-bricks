import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { fitFluid, fitSoloTemplate } from '../modules/breakpoints/solo.mjs';

// The generate that reported 384px cards as 558.5px. The column is 1200px inside 382px of padding,
// so it is wider than the content box and sits at x 352.5. Width 100% at that frame starts at the
// padding (382) and the row wraps.
const box = (x, y, w, h) => ({ x, y, width: w, height: h });

test('three 384px cards stay 384px at the 1905 frame', () => {
  const card = (id, x) => ({
    id, name: id, type: 'FRAME',
    layoutGrow: 1,
    absoluteBoundingBox: box(x, 0, 384, 338),
    layoutMode: 'VERTICAL',
    children: [],
  });
  const tree = normalizeRoot({ nodes: { r: { document: {
    id: 'r', name: 'Section', type: 'FRAME',
    absoluteBoundingBox: box(0, 0, 1905, 1517),
    layoutMode: 'VERTICAL',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'FIXED',
    counterAxisAlignItems: 'CENTER',
    itemSpacing: 62,
    paddingTop: 76, paddingRight: 382, paddingBottom: 76, paddingLeft: 382,
    children: [{
      id: 'col', name: 'Container', type: 'FRAME',
      layoutSizingHorizontal: 'FIXED',
      absoluteBoundingBox: box(352.5, 76, 1200, 449),
      layoutMode: 'VERTICAL',
      primaryAxisSizingMode: 'AUTO',
      counterAxisSizingMode: 'FIXED',
      itemSpacing: 59,
      children: [{
        id: 'row', name: 'Div', type: 'FRAME',
        layoutSizingHorizontal: 'FILL',
        absoluteBoundingBox: box(352.5, 187, 1200, 338),
        layoutMode: 'HORIZONTAL',
        itemSpacing: 24,
        primaryAxisSizingMode: 'FIXED',
        counterAxisSizingMode: 'AUTO',
        children: [card('a', 352.5), card('b', 760.5), card('c', 1168.5)],
      }],
    }],
  } } } }, 'r', { images: {}, svgs: {} });

  const built = buildTemplate(tree, { overrides: {}, salt: 'cards' });
  const template = built.template;
  fitSoloTemplate(template);
  fitFluid(template, { frameWidth: 1905 });
  const settings = (fid) => template.content.find((e) => e.id === built.mapping[fid].bricksId).settings;

  const col = settings('col');
  assert.equal(col._width, '1200px');
  assert.equal(col._widthMax, 'none');
  assert.doesNotMatch(col._cssCustom ?? '', /(?:^|[^-])width: 100%/);

  const row = settings('row');
  assert.equal(row._flexWrap, 'nowrap');
  assert.match(row._cssCustom, /@media \(max-width: 1904px\)/);
  assert.match(row._cssCustom, /flex-wrap: wrap/);

  for (const id of ['a', 'b', 'c']) {
    const cardSettings = settings(id);
    assert.equal(cardSettings._flexBasis, '384px');
    assert.notEqual(cardSettings._width, '100%');
    assert.match(cardSettings._cssCustom, /@media \(max-width: 1904px\) \{ #brxe-\S+ \{ flex-shrink: 1/);
  }

  const column = 1200;
  const basis = 384;
  const gap = 24;
  const free = column - gap * 2 - basis * 3;
  assert.equal(free, 0);
  assert.equal((1905 - column) / 2, 352.5);
});

test('a fill form inside a hug column keeps the Figma width', () => {
  const tree = normalizeRoot({ nodes: { r: { document: {
    id: 'r', name: 'Section', type: 'FRAME',
    absoluteBoundingBox: box(0, 0, 1905, 900),
    layoutMode: 'HORIZONTAL',
    primaryAxisSizingMode: 'AUTO',
    counterAxisSizingMode: 'AUTO',
    itemSpacing: 128,
    children: [{
      id: 'col', name: 'Column', type: 'FRAME',
      absoluteBoundingBox: box(0, 0, 481, 572),
      layoutMode: 'VERTICAL',
      primaryAxisSizingMode: 'AUTO',
      counterAxisSizingMode: 'AUTO',
      children: [{
        id: 'form', name: 'Form', type: 'FRAME',
        absoluteBoundingBox: box(0, 0, 481, 488),
        layoutMode: 'VERTICAL',
        layoutSizingHorizontal: 'FILL',
        layoutSizingVertical: 'HUG',
        paddingTop: 24, paddingRight: 24, paddingBottom: 24, paddingLeft: 24,
        cornerRadius: 34,
        fills: [{ type: 'SOLID', color: { r: 0.098, g: 0.243, b: 0.58, a: 1 } }],
        children: [],
      }],
    }],
  } } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, { overrides: {}, salt: 'formbox' });
  const form = built.template.content.find((e) => e.label === 'Form').settings;
  assert.equal(form._width, '481px');
  assert.equal(form._alignSelf, undefined);
  assert.equal(form._border.radius.top, '34px');
});
