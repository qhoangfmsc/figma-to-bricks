import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../figma/normalize.mjs';
import { buildTemplate } from '../bricks/render/index.mjs';

const manifest = { images: { r: { file: 'images/r.png', bytes: 1, sha256: 'x', width: 800, height: 400, ext: 'png' }, g: { file: 'images/g.png', bytes: 1, sha256: 'y', width: 658, height: 656, ext: 'png' } }, svgs: {} };

// Widths that are not the 1440 frame: laptops, odd windows, and ultrawide monitors.
const SCREENS = [900, 1024, 1152, 1280, 1366, 1440, 1512, 1536, 1600, 1680, 1728, 1800, 1920, 2048, 2160, 2560, 2880, 3440, 3840];
const SECTION_H = 1026;

const image = (id, box, ref = 'r') => ({
  id, name: id, type: 'RECTANGLE',
  absoluteBoundingBox: { x: box.x, y: box.y, width: box.w ?? box.width, height: box.h ?? box.height },
  fills: [{ type: 'IMAGE', imageRef: ref, scaleMode: 'FILL' }],
});

function hero() {
  const bg = {
    id: 'bg', name: 'Background', type: 'GROUP',
    layoutPositioning: 'ABSOLUTE',
    constraints: { horizontal: 'CENTER', vertical: 'CENTER' },
    absoluteBoundingBox: { x: -798, y: -122, width: 3036, height: 1148 },
    children: [
      image('scene', { x: -266, y: -122, width: 2504, height: 1148 }),
      {
        id: 'shade', name: 'Shade', type: 'RECTANGLE',
        rotation: -Math.PI,
        size: { x: 2504, y: 493 },
        relativeTransform: [[-1, 0, 2504], [0, -1, 493]],
        absoluteBoundingBox: { x: -798, y: -122, width: 2504, height: 493 },
        fills: [{ type: 'SOLID', color: { r: 0.04, g: 0.21, b: 0.7, a: 1 } }],
      },
    ],
  };
  // scene x is absolute in the file; normalize makes it parent-relative: -266 - (-798) = 532
  return normalizeRoot({ nodes: { r: { document: {
    id: 'r', name: 'Hero', type: 'FRAME',
    absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: SECTION_H },
    layoutMode: 'VERTICAL', clipsContent: true,
    children: [bg],
  } } } }, 'r', manifest);
}

function used(sectionW, sectionH, settings) {
  let w = sectionW * parseFloat(settings._width) / 100;
  if (settings._widthMin) w = Math.max(w, parseFloat(settings._widthMin));
  const [aw, ah] = settings._aspectRatio.split('/').map((n) => parseFloat(n));
  const h = w * ah / aw;
  const left = sectionW / 2 - w / 2;
  const off = String(settings._top).match(/([+-])\s*([\d.]+)%/);
  const anchor = sectionH * (50 + (off ? (off[1] === '-' ? -1 : 1) * parseFloat(off[2]) : 0)) / 100;
  const top = anchor - h / 2;
  return { left, top, right: left + w, bottom: top + h, w, h };
}

test('a full-bleed picture covers screens that are not the Figma width, and matches that width exactly', () => {
  const tree = hero();
  const built = buildTemplate(tree, { overrides: {}, salt: 'hero' });
  const bg = built.template.content.find((e) => e.id === built.mapping.bg.bricksId).settings;
  const scene = built.template.content.find((e) => e.id === built.mapping.scene.bricksId).settings;
  const shade = built.template.content.find((e) => e.id === built.mapping.shade.bricksId).settings;
  assert.equal(bg._width, '210.8333%');
  assert.equal(bg._widthMin, '3036px');
  assert.equal(bg._height, 'auto');
  assert.equal(bg._aspectRatio, '3036 / 1148');
  assert.equal(bg._widthMax, 'none');
  assert.match(bg._cssCustom, /translate\(-50%, -50%\)/);
  assert.equal(scene._position, 'absolute');
  assert.equal(scene._width.endsWith('%'), true);
  assert.equal(scene._width.endsWith('px'), false);
  assert.equal(shade._position, 'absolute');
  assert.equal(shade._transform.rotateZ, '180');
  assert.equal(shade._left.endsWith('%'), true);

  const atDesign = used(1440, SECTION_H, bg);
  assert.ok(Math.abs(atDesign.w - 3036) < 0.05, `design width ${atDesign.w}`);
  assert.ok(Math.abs(atDesign.h - 1148) < 0.05, `design height ${atDesign.h}`);
  assert.ok(Math.abs(atDesign.left - -798) < 0.05, `design left ${atDesign.left}`);
  assert.ok(Math.abs(atDesign.top - -122) < 0.05, `design top ${atDesign.top}`);

  for (const sectionW of SCREENS) {
    const box = used(sectionW, SECTION_H, bg);
    assert.ok(box.left <= 0.5, `${sectionW}: left ${box.left} leaves a gap`);
    assert.ok(box.right >= sectionW - 0.5, `${sectionW}: right ${box.right} leaves a gap`);
    assert.ok(box.top <= 0.5, `${sectionW}: top ${box.top} leaves a gap`);
    assert.ok(box.bottom >= SECTION_H - 0.5, `${sectionW}: bottom ${box.bottom} leaves a gap`);
    const layerW = box.w * parseFloat(scene._width) / 100;
    assert.ok(Math.abs(layerW / box.w - 2504 / 3036) < 1e-6, `${sectionW}: stacked layer drifted`);
  }
});

test('a clipped picture larger than its frame stays a percentage of that frame', () => {
  const glow = image('glow', { x: -231.5, y: 254, width: 658, height: 656 }, 'g');
  const portrait = {
    id: 'card', name: 'Portrait', type: 'FRAME',
    absoluteBoundingBox: { x: 0, y: 0, width: 195, height: 246 },
    layoutMode: 'VERTICAL', clipsContent: true,
    children: [image('face', { x: 0, y: 0, width: 195, height: 246 }), glow],
  };
  const tree = normalizeRoot({ nodes: { r: { document: {
    id: 'r', name: 'Hero', type: 'FRAME',
    absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 400 },
    layoutMode: 'VERTICAL',
    children: [portrait],
  } } } }, 'r', manifest);
  const built = buildTemplate(tree, { overrides: {}, salt: 'card' });
  const card = built.template.content.find((e) => e.id === built.mapping.card.bricksId).settings;
  const glowEl = built.template.content.find((e) => e.id === built.mapping.glow.bricksId).settings;
  assert.equal(card._height, 'auto');
  assert.equal(card._aspectRatio, '195 / 246');
  assert.equal(glowEl._position, 'absolute');
  assert.equal(glowEl._width, '337.4359%'); // 658 / 195, clipped by the frame, and it shrinks with the frame
});

const solid = (id, box) => ({
  id, name: id, type: 'RECTANGLE',
  layoutPositioning: 'ABSOLUTE',
  constraints: { horizontal: 'CENTER', vertical: 'TOP' },
  absoluteBoundingBox: { x: box.x, y: box.y, width: box.w, height: box.h },
  fills: [{ type: 'SOLID', color: { r: 0, g: 0.2, b: 0.6, a: 1 } }],
});

const text = (id, box) => ({
  id, name: id, type: 'TEXT', characters: 'Title',
  absoluteBoundingBox: { x: box.x, y: box.y, width: box.w, height: box.h },
  style: { fontFamily: 'Inter', fontSize: 32, fontWeight: 700, lineHeightPx: 40, textAlignHorizontal: 'LEFT' },
  fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
});

test('a gradient as wide as the screen is a background, and a centered text column stays its Figma width', () => {
  const tree = normalizeRoot({ nodes: { r: { document: {
    id: 'r', name: 'Hero', type: 'FRAME',
    absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 800 },
    layoutMode: 'VERTICAL', clipsContent: true,
    children: [
      solid('wash', { x: -200, y: 0, w: 1840, h: 800 }),
      {
        id: 'col', name: 'Column', type: 'FRAME', layoutPositioning: 'ABSOLUTE',
        constraints: { horizontal: 'CENTER', vertical: 'TOP' },
        absoluteBoundingBox: { x: 120, y: 80, width: 1200, height: 400 },
        layoutMode: 'VERTICAL',
        children: [text('title', { x: 120, y: 80, w: 400, h: 40 })],
      },
    ],
  } } } }, 'r', manifest);
  const built = buildTemplate(tree, { overrides: {}, salt: 'roles' });
  const wash = built.template.content.find((e) => e.id === built.mapping.wash.bricksId).settings;
  const col = built.template.content.find((e) => e.id === built.mapping.col.bricksId).settings;
  assert.equal(wash._width, '127.7778%'); // 1840 / 1440, a solid counts as a background with no image in it
  assert.equal(wash._widthMin, '1840px');
  assert.equal(wash._height, 'auto');
  assert.equal(col._width, '1200px');
  assert.equal(col._left, '50%');
  assert.equal(col._aspectRatio, undefined);
});

test('a frame drawn edge to edge is the screen, and the background inside it scales with that screen', () => {
  const tree = normalizeRoot({ nodes: { r: { document: {
    id: 'r', name: 'Page', type: 'FRAME',
    absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 },
    layoutMode: 'VERTICAL',
    children: [{
      id: 'shell', name: 'Shell', type: 'FRAME',
      absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 800 },
      layoutMode: 'VERTICAL',
      children: [
        text('title', { x: 120, y: 40, w: 400, h: 40 }),
        {
          id: 'wash', name: 'Wash', type: 'RECTANGLE', layoutPositioning: 'ABSOLUTE',
          constraints: { horizontal: 'LEFT', vertical: 'TOP' },
          absoluteBoundingBox: { x: -100, y: 0, width: 1640, height: 800 },
          fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }],
        },
      ],
    }],
  } } } }, 'r', manifest);
  const built = buildTemplate(tree, { overrides: {}, salt: 'shell' });
  const shell = built.template.content.find((e) => e.id === built.mapping.shell.bricksId).settings;
  const wash = built.template.content.find((e) => e.id === built.mapping.wash.bricksId).settings;
  const title = built.template.content.find((e) => e.id === built.mapping.title.bricksId).settings;
  assert.equal(shell._width, '100%');
  assert.equal(wash._width, '113.8889%'); // 1640 / 1440, the shell is the screen this layer covers
  assert.equal(wash._left, '-6.9444%');
  assert.equal(title._width, '400px');
});
