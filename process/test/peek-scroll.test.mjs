import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';

const box = (x, y, w, h) => ({ x, y, width: w, height: h });
const text = (id, value) => ({
  id, name: id, type: 'TEXT', characters: value,
  absoluteBoundingBox: box(0, 0, 40, 16),
  style: { fontFamily: 'Roboto', fontSize: 14, fontWeight: 500, lineHeightPx: 16 },
});
const frame = (id, name, rect, children, extra = {}) => ({
  id, name, type: 'FRAME', absoluteBoundingBox: box(...rect), children, ...extra,
});

test('a row that shows only part of the next item scrolls and keeps the full item width', () => {
  const card = (id, x, label) => frame(id, 'tile', [x, 0, 140, 80], [text(`${id}t`, label)]);
  const tree = normalizeRoot({ nodes: { r: { document: frame('win', 'Window', [0, 0, 180, 100], [
    frame('row', 'Row', [0, 0, 320, 80], [card('oak', 0, 'Oak'), card('pine', 160, 'Pine')], { layoutMode: 'HORIZONTAL' }),
  ], { clipsContent: true }) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, { salt: 'peek' });
  const el = (id) => built.template.content.find((item) => item.id === built.mapping[id]?.bricksId);
  assert.equal(el('row').settings._overflow, 'auto');
  assert.equal(el('row').settings._flexWrap, 'nowrap');
  assert.equal(el('oak').settings._width, '140px');
  assert.equal(el('oak').settings._flexShrink, 0);
});

test('a clipped row of a mark and a wider text box stays clipped, it is not a scroll', () => {
  const mark = { id: 'dot', name: 'dot', type: 'ELLIPSE', absoluteBoundingBox: box(0, 0, 18, 18), fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.6, b: 0.3, a: 1 } }] };
  const label = { ...text('note', 'Delivery within two days'), absoluteBoundingBox: box(26, 0, 250, 18) };
  const tree = normalizeRoot({ nodes: { r: { document: frame('box', 'Box', [0, 0, 400, 60], [
    frame('line', 'Line', [0, 0, 260, 18], [mark, label], { layoutMode: 'HORIZONTAL', itemSpacing: 8, clipsContent: true }),
  ]) } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, { salt: 'peek-line' });
  const el = (id) => built.template.content.find((item) => item.id === built.mapping[id]?.bricksId);
  assert.notEqual(el('line').settings._overflow, 'auto');
});
