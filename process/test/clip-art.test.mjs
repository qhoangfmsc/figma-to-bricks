import assert from 'node:assert/strict';
import test from 'node:test';
import { applyLayout } from '../modules/write-bricks/render/layout.mjs';
import { applySize } from '../modules/write-bricks/render/size.mjs';

const picture = {
  id: 'shot', name: 'Photo', type: 'FRAME', visible: true, place: 'FLOW',
  box: { x: 2, y: 2, w: 420, h: 180 },
  fills: [{ type: 'IMAGE', scaleMode: 'FILL' }],
  children: [],
};

const card = {
  id: 'card', name: 'Photo card', type: 'FRAME', visible: true, clip: true,
  box: { x: 0, y: 0, w: 280, h: 360 },
  sizing: { h: 'FIXED', v: 'HUG' },
  layout: { mode: 'VERTICAL', gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 }, primaryAlign: 'MIN', counterAlign: 'MIN' },
  children: [picture],
};

test('a clipped card is the positioning parent of a picture wider than the card', () => {
  const settings = {};
  applyLayout({ node: card, s: settings, css: {}, warn() {} }, 'block');
  assert.equal(settings._position, 'relative');
  assert.equal(settings._height, '360px');

  const shot = {};
  applySize({ node: picture, parent: card, root: card, s: shot, css: {}, warn() {} }, {});
  assert.equal(shot._position, undefined);
  assert.equal(shot._width, '420px');
  assert.equal(shot._height, '180px');
  assert.equal(shot._widthMin, '0px');
});

test('a fixed-width column that fills the row height keeps that width', () => {
  const photo = {
    id: 'photo', name: 'Photo column', type: 'FRAME', visible: true, place: 'FLOW',
    box: { x: 582, y: 0, w: 558, h: 726 },
    sizing: { h: 'FIXED', v: 'FILL' },
    children: [],
  };
  const row = {
    id: 'row', type: 'FRAME', visible: true,
    box: { x: 0, y: 0, w: 1140, h: 726 },
    sizing: { h: 'FIXED', v: 'HUG' },
    layout: { mode: 'HORIZONTAL', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [photo],
  };
  const settings = {};
  applySize({ node: photo, parent: row, root: row, s: settings, css: {}, warn() {} }, {});
  assert.equal(settings._width, '558px');
  assert.equal(settings._alignSelf, undefined);
});
