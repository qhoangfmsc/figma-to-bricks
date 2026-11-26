import assert from 'node:assert/strict';
import test from 'node:test';
import { applyEffects } from '../modules/write-bricks/render/utils/effects.mjs';
import { activeLook } from '../modules/write-bricks/components/states.mjs';
import { applyLayout } from '../modules/write-bricks/render/layout.mjs';
import { applyFill } from '../modules/write-bricks/render/utils/fill.mjs';
import { applyLine } from '../modules/write-bricks/render/utils/line.mjs';
import { detectDividers } from '../modules/recognize-parts/rules/divider.mjs';
import { paneNodes, tabInventory } from '../modules/write-bricks/components/tabs.mjs';
import flatImage, { clippedBox } from '../modules/write-bricks/components/flat-image.mjs';

const stroke = { paints: [{ type: 'SOLID', hex: '#3355aa', alpha: 1 }], align: 'CENTER', weight: 1 };

test('a translucent tint does not replace the gradient under it', () => {
  const node = {
    id: 'go', name: 'Go', type: 'FRAME', box: { w: 180, h: 48 }, children: [],
    fills: [
      { type: 'GRADIENT_LINEAR', alpha: 1, handles: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], stops: [{ position: 0, hex: '#ff9400', alpha: 1 }, { position: 1, hex: '#ffc500', alpha: 1 }] },
      { type: 'SOLID', hex: '#cc7700', alpha: 0.2 },
    ],
  };
  const settings = {};
  applyFill({ node, s: settings, css: {}, warn() {} });
  assert.equal(settings._gradient.gradientType, 'linear');
  assert.equal(settings._background, undefined);
});

test('a photo under a gradient stays, and the gradient is a layer above it', () => {
  const node = {
    id: 'card', name: 'Card', type: 'FRAME', box: { w: 320, h: 200 },
    children: [{ id: 'title', type: 'TEXT' }],
    fills: [
      { type: 'IMAGE', scaleMode: 'FILL', asset: { file: 'images/harbor.jpg' } },
      { type: 'GRADIENT_LINEAR', alpha: 1, handles: [{ x: 0.5, y: 0 }, { x: 0.5, y: 1 }, { x: 0, y: 0.5 }], stops: [{ position: 0, hex: '#0041a3', alpha: 0 }, { position: 1, hex: '#0041a3', alpha: 1 }] },
    ],
  };
  const settings = {};
  applyFill({ node, s: settings, css: {}, warn() {} });
  assert.equal(settings._background.image.$asset, 'images/harbor.jpg');
  assert.match(settings._cssCustom, /::before/);
  assert.doesNotMatch(settings._cssCustom, /%root% \{[^}]*background-image/);
});

test('an empty frame drop shadow follows the children instead of drawing a border', () => {
  const node = {
    id: 'card', type: 'FRAME',
    effects: [{ type: 'DROP_SHADOW', hex: '#112233', alpha: 0.3, x: 0, y: 4, blur: 6, spread: 2 }],
    children: [{ id: 'photo', type: 'RECTANGLE' }],
  };
  const settings = {};
  const warnings = [];
  applyEffects({ node, s: settings, warn: (n, msg) => warnings.push(msg) });
  assert.equal(settings._boxShadow, undefined);
  assert.match(settings._cssCustom, /filter: drop-shadow\(0px 4px 6px rgba\(17, 34, 51, 0\.3\)\)/);
  assert.ok(warnings.some((msg) => /spread 2px is not applicable/.test(msg)));
});

test('a layer blur is half the Figma radius', () => {
  const node = { id: 'glow', type: 'FRAME', effects: [{ type: 'LAYER_BLUR', radius: 24 }] };
  const settings = {};
  applyEffects({ node, s: settings, warn() {} });
  assert.match(settings._cssCustom, /filter: blur\(12px\)/);
});

test('the top picture covers the picture under it', () => {
  const node = {
    id: 'hero', name: 'Hero', type: 'FRAME', box: { w: 800, h: 360 },
    children: [{ id: 'copy', type: 'TEXT' }],
    fills: [
      { type: 'IMAGE', scaleMode: 'FILL', asset: { file: 'images/back.jpg' } },
      { type: 'IMAGE', scaleMode: 'FILL', asset: { file: 'images/front.jpg' } },
    ],
  };
  const settings = {};
  applyFill({ node, s: settings, css: {}, warn() {} });
  assert.equal(settings._background.image.$asset, 'images/front.jpg');
});

test('a picture painted above a gradient is the background', () => {
  const node = {
    id: 'banner', name: 'Banner', type: 'FRAME', box: { w: 600, h: 180 },
    children: [{ id: 'copy', type: 'TEXT' }],
    fills: [
      { type: 'GRADIENT_LINEAR', alpha: 1, handles: [{ x: 0, y: 0.5 }, { x: 1, y: 0.5 }, { x: 0, y: 1 }], stops: [{ position: 0, hex: '#191f25', alpha: 1 }, { position: 1, hex: '#0064cc', alpha: 1 }] },
      { type: 'IMAGE', scaleMode: 'FILL', asset: { file: 'images/hand.png' } },
    ],
  };
  const settings = {};
  applyFill({ node, s: settings, css: {}, warn() {} });
  assert.equal(settings._background.image.$asset, 'images/hand.png');
  assert.equal(settings._gradient, undefined);
  assert.equal(settings._cssCustom, undefined);
});

test('a clipped artwork uses the visible slice of the Figma render', () => {
  const art = {
    id: 'art', name: 'Art', type: 'GROUP', place: 'ABSOLUTE',
    box: { x: 200, y: -80, w: 500, h: 400, absX: 200, absY: -80 },
    children: [],
  };
  const card = {
    id: 'card', name: 'Card', type: 'FRAME', clip: true,
    box: { x: 0, y: 0, w: 400, h: 160, absX: 0, absY: 0 },
    children: [art],
  };
  const clip = clippedBox(card, art);
  assert.equal(clip.w, 200);
  assert.equal(clip.h, 160);
  const flats = { art: { file: 'flat/art.png', width: 400, height: 320, scale: 2 } };
  assert.equal(flatImage.check(art, {}, { root: card, flats }).ok, true);
  const settings = {};
  flatImage.apply({ node: art, s: settings, flats, root: card, parent: card }, {});
  assert.equal(settings._left, '200px');
  assert.equal(settings._top, '0px');
  assert.equal(settings._width, '200px');
  assert.equal(settings._height, '160px');
  assert.equal(settings.image.$asset, 'flat/art.png');
});

test('a line under the open title moves with the open class', () => {
  const title = (id, word, color, line) => ({
    id, type: 'FRAME', name: 'Title',
    ...(line ? { stroke: { paints: [{ type: 'SOLID', hex: color, alpha: 1 }], weight: 3, weights: { top: 0, right: 0, bottom: 3, left: 0 }, align: 'INSIDE' } } : {}),
    children: [{ id: `${id}t`, type: 'TEXT', text: { characters: word }, fills: [{ type: 'SOLID', hex: color, alpha: 1 }] }],
  });
  const look = activeLook(title('rest', 'One', '#222222', false), title('open', 'Two', '#0066cc', true), '.brx-open');
  const hot = look.css.filter((rule) => rule.suffix.includes('brx-open')).map((rule) => rule.decl).join(' ');
  const idle = look.css.filter((rule) => !rule.suffix.includes('brx-open')).map((rule) => rule.decl).join(' ');
  assert.match(hot, /border-bottom: 3px solid/);
  assert.match(hot, /#0066cc/);
  assert.match(idle, /border-bottom: 0/);
  assert.match(idle, /#222222/);
});

test('columns that hold the same cells share one row track', () => {
  const pad = { top: 0, right: 0, bottom: 0, left: 0 };
  const cell = (id) => ({ id, type: 'FRAME', visible: true, place: 'FLOW', box: { w: 80, h: 32 }, layout: { mode: 'HORIZONTAL', gap: 0, padding: pad, primaryAlign: 'MIN', counterAlign: 'MIN' }, children: [] });
  const list = (id) => ({ id, type: 'FRAME', visible: true, place: 'FLOW', box: { w: 100, h: 96 }, layout: { mode: 'VERTICAL', gap: 0, padding: pad, primaryAlign: 'MIN', counterAlign: 'MIN' }, children: [cell(`${id}a`), cell(`${id}b`), cell(`${id}c`)] });
  const column = (id) => ({ id, type: 'FRAME', visible: true, place: 'FLOW', box: { w: 100, h: 140 }, layout: { mode: 'VERTICAL', gap: 0, padding: pad, primaryAlign: 'MIN', counterAlign: 'MIN' }, children: [cell(`${id}h`), list(`${id}l`)] });
  const row = { id: 'sheet', type: 'FRAME', layout: { mode: 'HORIZONTAL', gap: 0, padding: pad, primaryAlign: 'MIN', counterAlign: 'MIN' }, children: [column('one'), column('two'), column('three')] };
  const settings = {};
  applyLayout({ node: row, s: settings, css: {}, warn() {} }, 'block');
  assert.match(settings._cssCustom, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  const columnSettings = {};
  applyLayout({ node: row.children[0], s: columnSettings, css: {}, warn() {} }, 'block');
  assert.match(columnSettings._cssCustom, /grid-template-rows: subgrid/);
});

test('a line that fills a column draws its stroke through the middle', () => {
  const wide = { type: 'LINE', place: 'FLOW', rotation: Math.PI / 2, box: { w: 48, h: 106 }, stroke };
  const settings = {};
  assert.equal(applyLine({ node: wide, s: settings, warn() {} }), true);
  assert.match(settings._cssCustom, /left: calc\(50% - 0\.5px\)/);

  const hair = { type: 'LINE', place: 'FLOW', rotation: Math.PI / 2, box: { w: 0, h: 80 }, stroke };
  const thin = {};
  applyLine({ node: hair, s: thin, warn() {} });
  assert.match(thin._cssCustom, /left: -0\.5px/);
});

test('a slot with no paint is not the line when its child is the bar', () => {
  const bar = { id: 'bar', name: 'Bar', type: 'FRAME', box: { w: 240, h: 2 }, fills: [{ type: 'SOLID', hex: '#2266aa', alpha: 1, visible: true }], children: [] };
  const slot = { id: 'slot', name: 'Slot', type: 'FRAME', box: { w: 240, h: 2 }, children: [bar] };
  assert.deepEqual(detectDividers(slot).map((c) => c.node), ['bar']);
});

test('regions side by side are one open pane', () => {
  const box = (w, h) => ({ x: 0, y: 0, w, h });
  const title = (id, label) => ({ id, name: 'Title', type: 'FRAME', box: box(120, 40), children: [{ id: `${id}t`, type: 'TEXT', text: { characters: label } }] });
  const content = {
    id: 'body', name: 'Body', type: 'FRAME', layout: { mode: 'HORIZONTAL' }, box: box(800, 300),
    children: [
      { id: 'photo', name: 'Photo', type: 'FRAME', box: box(400, 300), children: [] },
      { id: 'tags', name: 'Tags', type: 'FRAME', box: box(400, 300), children: [{ id: 'tag', type: 'TEXT', text: { characters: 'Harbor' } }] },
    ],
  };
  const node = { id: 'tabs', children: [{ id: 'bar', children: [title('a', 'Harbor'), title('b', 'Dock'), title('c', 'Pier')] }, content] };
  assert.equal(paneNodes(content, node.children[0].children).one, true);
  assert.deepEqual(tabInventory(node).map((row) => row.drawn), ['Harbor', '', '']);
});
