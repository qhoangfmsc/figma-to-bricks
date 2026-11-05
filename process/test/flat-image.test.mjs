import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../figma/normalize.mjs';
import { detectFlatImages } from '../detect/rules/flat-image.mjs';
import { buildTemplate } from '../bricks/render/index.mjs';

const manifest = { images: { r: { file: 'images/r.png', bytes: 1, sha256: 'x', width: 800, height: 400, ext: 'png' } }, svgs: {} };

const solid = (id) => ({
  id, name: id, type: 'RECTANGLE',
  absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 80 },
  fills: [{ type: 'SOLID', color: { r: 0, g: 0.2, b: 0.7, a: 1 } }],
});

function section(children, extra = {}) {
  return normalizeRoot({ nodes: { r: { document: {
    id: 'r', name: 'Hero', type: 'FRAME',
    absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 },
    layoutMode: 'VERTICAL',
    children,
    ...extra,
  } } } }, 'r', manifest);
}

const background = (extra = {}) => ({
  id: 'bg', name: 'Background', type: 'GROUP',
  absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 },
  children: [
    { id: 'scene', name: 'Scene', type: 'RECTANGLE', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 }, fills: [{ type: 'IMAGE', imageRef: 'r', scaleMode: 'FILL' }] },
    solid('wash'),
    solid('shade'),
  ],
  ...extra,
});

test('a section of images and no text is one picture', () => {
  const found = detectFlatImages(section([background()]));
  assert.deepEqual(found.map((c) => c.node), ['bg']);
});

test('text stays editable, and an auto-layout row of pictures stays elements', () => {
  const titled = section([background({ children: [...background().children, { id: 't', name: 'Title', type: 'TEXT', characters: 'Hello', absoluteBoundingBox: { x: 0, y: 0, width: 80, height: 20 }, style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 700, lineHeightPx: 20 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }] }] })]);
  assert.equal(detectFlatImages(titled).some((c) => c.node === 'bg'), false);
  const row = section([{ ...background(), layoutMode: 'HORIZONTAL' }]);
  assert.equal(detectFlatImages(row).some((c) => c.node === 'bg'), false);
});

test('the combined picture has no custom css; the div sets the box and the image is 100%', () => {
  const tree = section([background()]);
  const detections = { components: [{ id: 'd1', status: 'approved', component: 'flat-image', node: 'bg', params: {} }] };
  const flats = { bg: { file: 'flat/bg.png', width: 800, height: 400, scale: 2 } };
  const built = buildTemplate(tree, { overrides: {}, detections, flats, salt: 'flat' });
  const box = built.template.content.find((e) => e.id === built.mapping.bg.bricksId);
  const pic = built.template.content.find((e) => e.parent === box.id);
  assert.equal(box.name, 'div');
  assert.equal(box.settings._width, '100%');
  assert.ok(box.settings._height);
  assert.equal(pic.name, 'image');
  assert.equal(pic.settings._width, '100%');
  assert.equal(pic.settings._height, '100%');
  assert.equal(pic.settings._cssCustom, undefined);
  assert.deepEqual(pic.settings.image, { $asset: 'flat/bg.png', size: 'full' });
  assert.equal(built.mapping.scene.skipped.startsWith('merged into flat-image'), true);
  assert.equal(built.template.content.filter((e) => e.name === 'image').length, 1);
});
