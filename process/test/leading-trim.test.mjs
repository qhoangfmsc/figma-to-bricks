import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { textFlag } from '../modules/property-coverage/handling.mjs';

const box = (x, y, w, h) => ({ x, y, width: w, height: h });
const label = (id, trim) => ({
  id, name: id, type: 'TEXT', characters: 'SALE',
  absoluteBoundingBox: box(6, 4, 40, trim ? 13 : 28),
  style: { fontFamily: 'Roboto', fontSize: 18, fontWeight: 700, lineHeightPx: 28, textAutoResize: 'WIDTH_AND_HEIGHT', ...(trim ? { leadingTrim: trim } : {}) },
  fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
});

function build(trim) {
  const tree = normalizeRoot({ nodes: { r: { document: {
    id: 'r', name: 'Tag', type: 'FRAME', absoluteBoundingBox: box(0, 0, 52, 21), layoutMode: 'HORIZONTAL', paddingTop: 4, paddingBottom: 4, paddingLeft: 6, paddingRight: 6,
    fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.6, b: 0.3, a: 1 } }],
    children: [label('t', trim)],
  } } } }, 'r', { images: {}, svgs: {} });
  const built = buildTemplate(tree, { detections: { components: [] }, salt: 'trim' });
  return built.template.content.find((item) => item.id === built.mapping.t?.bricksId);
}

test('a text trimmed to the cap height in Figma trims its box the same way', () => {
  assert.match(build('CAP_HEIGHT').settings._cssCustom ?? '', /text-box: trim-both cap alphabetic;/);
  assert.equal(textFlag('leadingTrim', 'CAP_HEIGHT'), null);
});

test('a text without a trim keeps its full line box', () => {
  assert.doesNotMatch(build(null).settings._cssCustom ?? '', /text-box/);
});
