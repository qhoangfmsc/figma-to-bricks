import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { mergeResponsive } from '../modules/breakpoints/merge.mjs';

const manifest = { images: { r: { file: 'images/r.png', bytes: 1, sha256: 'x', width: 390, height: 492, ext: 'png' } }, svgs: {} };
const other = { images: { r: { file: 'images/other.png', bytes: 1, sha256: 'y', width: 390, height: 492, ext: 'png' } }, svgs: {} };

function tree(id, files, fill) {
  const photo = { id: 'im', name: 'Photo', type: 'RECTANGLE', absoluteBoundingBox: { x: 10, y: 20, width: 195, height: 246 }, fills: [{ type: 'IMAGE', imageRef: 'r', scaleMode: 'FILL', ...fill }] };
  return normalizeRoot({ nodes: { [id]: { document: { id, name: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 }, children: [photo] } } } }, id, files);
}

function built(id, files, fill) {
  const root = tree(id, files, fill);
  return { root, ...buildTemplate(root, { overrides: {}, salt: id }) };
}

test('a plain image sits in a div that keeps the Figma box', () => {
  const b = built('r', manifest);
  const box = b.template.content.find((e) => e.id === b.mapping.im.bricksId);
  const pic = b.template.content.find((e) => e.parent === box.id);
  assert.equal(box.name, 'div');
  assert.equal(box.settings._width, '195px'); // narrower than the screen: content, so it keeps the Figma pixels
  assert.equal(box.settings._height, '246px');
  assert.equal(box.settings._aspectRatio, undefined);
  assert.equal(box.settings._overflow, 'hidden');
  assert.equal(box.settings.image, undefined);
  assert.equal(pic.name, 'image');
  assert.equal(pic.settings._position, 'absolute');
  assert.equal(pic.settings._width, '100%');
  assert.equal(pic.settings._height, '100%');
  assert.equal(pic.settings._objectFit, 'cover');
  assert.deepEqual(pic.settings.image, { $asset: 'images/r.png', size: 'full' });
});

test('a crop is a sized div, and the image inside it is always 100%', () => {
  const b = built('r', manifest, { scaleMode: 'CROP', imageTransform: [[0.5, 0, 0.1], [0, 0.5, 0.2]] });
  const box = b.template.content.find((e) => e.id === b.mapping.im.bricksId);
  const crop = b.template.content.find((e) => e.parent === box.id);
  const pic = b.template.content.find((e) => e.parent === crop.id);
  assert.equal(box.name, 'div');
  assert.equal(box.settings._width, '195px');
  assert.equal(box.settings._height, '246px');
  assert.equal(box.settings._overflow, 'hidden');
  assert.equal(crop.name, 'div');
  assert.equal(crop.settings._width, '200%');
  assert.equal(crop.settings._height, '200%');
  assert.equal(crop.settings._left, '-20%');
  assert.equal(crop.settings._top, '-40%');
  assert.equal(pic.name, 'image');
  assert.equal(pic.settings._position, 'absolute');
  assert.equal(pic.settings._width, '100%');
  assert.equal(pic.settings._height, '100%');
  assert.equal(pic.settings._left, '0px');
  assert.equal(pic.settings._top, '0px');
});

test('the same picture at another breakpoint stays one image; a different file is a source', () => {
  const base = built('base', manifest);
  const same = built('tab', manifest);
  const shared = mergeResponsive({
    base: { tree: base.root, template: base.template, mapping: base.mapping },
    variants: [{ key: 'tablet_portrait', maxWidth: 991, tree: same.root, template: same.template, mapping: same.mapping, aliases: {} }],
  });
  assert.equal(shared.template.content.filter((e) => e.name === 'image').length, 1);
  assert.equal(shared.template.content.find((e) => e.name === 'image').settings.sources, undefined);

  const changed = built('tab', other);
  const swapped = mergeResponsive({
    base: { tree: base.root, template: base.template, mapping: base.mapping },
    variants: [{ key: 'tablet_portrait', maxWidth: 991, tree: changed.root, template: changed.template, mapping: changed.mapping, aliases: {} }],
  });
  const pic = swapped.template.content.find((e) => e.name === 'image');
  assert.equal(swapped.template.content.filter((e) => e.name === 'image').length, 1);
  assert.equal(pic.settings.image.$asset, 'images/r.png');
  assert.deepEqual(pic.settings.sources, [{ breakpoint: 'tablet_portrait', image: { $asset: 'images/other.png', size: 'full' } }]);
});
