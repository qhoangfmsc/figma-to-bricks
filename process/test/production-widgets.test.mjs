import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectProduction } from '../modules/recognize-parts/rules/production-widgets.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';

const box = (x, y, w, h) => ({ x, y, w, h, absX: x, absY: y });
const sizing = { h: 'FIXED', v: 'FIXED' };
const frame = (id, extra) => ({ id, type: 'FRAME', name: id, box: box(0, 0, 100, 40), sizing, children: [], ...extra });

test('a row of equal pictures is a gallery and a clipped overflowing row is not', () => {
  const picture = (id, x) => frame(id, {
    box: box(x, 0, 120, 80),
    fills: [{ type: 'IMAGE', asset: { file: `images/${id}.png` } }],
  });
  const row = frame('row', {
    box: box(0, 0, 400, 80),
    layout: { mode: 'HORIZONTAL', gap: 16, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [picture('a', 0), picture('b', 136), picture('c', 272)],
  });
  const found = detectProduction(row);
  assert.equal(found[0].component, 'gallery');
  assert.equal(found[0].params.columns, 3);
  assert.deepEqual(found[0].params.images, ['images/a.png', 'images/b.png', 'images/c.png']);
  const built = buildTemplate(row, { overrides: {}, detections: { components: [{ id: 'd0', status: 'approved', ...found[0] }] }, salt: 'gal' });
  const gallery = built.template.content.find((e) => e.name === 'image-gallery');
  assert.equal(gallery.settings.layout, 'grid');
  assert.equal(gallery.settings.columns, 3);
  assert.equal(gallery.settings.items.images.length, 3);

  const clipped = frame('slide', {
    box: box(0, 0, 200, 80),
    clip: true,
    children: [picture('a', 0), picture('b', 136), picture('c', 272)],
  });
  assert.equal(detectProduction(clipped).length, 0);
});

test('a track with a shorter fill is a progress bar at that percent', () => {
  const tree = frame('bars', {
    box: box(0, 0, 320, 40),
    children: [
      frame('one', {
        box: box(0, 0, 320, 16),
        children: [
          frame('track', {
            box: box(0, 4, 200, 8),
            children: [frame('fill', { box: box(0, 0, 50, 8), fills: [{ type: 'SOLID', hex: '#2563eb', alpha: 1 }] })],
          }),
        ],
      }),
    ],
  });
  const found = detectProduction(tree);
  assert.equal(found[0].component, 'progress');
  assert.equal(found[0].params.bars[0].percentage, 25);
  const bar = buildTemplate(tree, { overrides: {}, detections: { components: [{ id: 'd0', status: 'approved', ...found[0] }] }, salt: 'bar' }).template.content.find((e) => e.name === 'progress-bar');
  assert.equal(bar.settings.bars[0].percentage, 25);
  assert.equal(bar.settings.bars[0].title, '');
  assert.deepEqual(bar.settings.bars[0].color, { hex: '#2563eb' });
  const titled = frame('card', {
    box: box(0, 0, 512, 84),
    children: [frame('title', {
      box: box(16, 16, 480, 24),
      children: [
        { id: 'name', type: 'TEXT', name: 'Cookie', visible: true, text: { characters: 'Cookie thiết yếu' }, box: box(0, 0, 361, 24), children: [] },
        frame('badge', { box: box(373, 0, 107, 20), fills: [{ type: 'SOLID', hex: '#dcfce7', alpha: 1 }], children: [] }),
      ],
    })],
  });
  assert.equal(detectProduction(titled).some((c) => c.component === 'progress'), false);
});

test('the same star four times is a rating, three lines are a hamburger, and a side panel is an offcanvas', () => {
  const star = (id, x) => frame(id, { box: box(x, 0, 16, 16), component: 'Star', svg: { file: 'svg/star.svg' }, fills: [{ type: 'SOLID', hex: '#f5b942', alpha: 1 }] });
  const stars = frame('stars', {
    box: box(0, 0, 80, 16),
    layout: { mode: 'HORIZONTAL', gap: 4, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [0, 1, 2, 3].map((i) => star(`s${i}`, i * 20)),
  });
  const rating = detectProduction(stars)[0];
  assert.equal(rating.component, 'rating');
  assert.equal(rating.params.rating, 4);
  assert.equal(rating.params.maxRating, 4);

  const burger = frame('burger', {
    box: box(0, 0, 24, 24),
    children: [2, 10, 18].map((y, i) => frame(`l${i}`, { box: box(2, y, 20, 2), fills: [{ type: 'SOLID', hex: '#111111', alpha: 1 }] })),
  });
  assert.equal(detectProduction(burger)[0].component, 'hamburger');
  const toggle = buildTemplate(burger, { overrides: {}, detections: { components: [{ id: 'd0', status: 'approved', ...detectProduction(burger)[0] }] }, salt: 'ham' }).template.content.find((e) => e.name === 'toggle');
  assert.ok(toggle);

  const panel = frame('panel', {
    box: box(0, 0, 320, 800),
    children: [
      frame('x', { box: box(280, 16, 24, 24), svg: { file: 'svg/x.svg' } }),
      frame('body', { box: box(0, 48, 320, 700), children: [] }),
    ],
  });
  const page = frame('page', { box: box(0, 0, 390, 844), children: [panel] });
  const off = detectProduction(page)[0];
  assert.equal(off.component, 'offcanvas');
  assert.equal(off.params.direction, 'left');
  const built = buildTemplate(page, { overrides: {}, detections: { components: [{ id: 'd0', status: 'approved', ...off }] }, salt: 'off' }).template.content.find((e) => e.name === 'offcanvas');
  assert.equal(built.settings.direction, 'left');
  assert.equal(built.settings.width, '320px');
});

test('a label, a chevron, and a vertical list are a dropdown', () => {
  const text = (id, characters) => ({ id, type: 'TEXT', name: id, box: box(0, 0, 40, 20), sizing, text: { characters, fontFamily: 'Inter', fontSize: 14 } });
  const tree = frame('item', {
    box: box(0, 0, 120, 80),
    layout: { mode: 'HORIZONTAL', gap: 8, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [
      text('label', 'Dịch vụ'),
      frame('chev', { box: box(70, 4, 12, 12), svg: { file: 'svg/chev.svg' } }),
      frame('list', {
        box: box(0, 28, 120, 48),
        layout: { mode: 'VERTICAL', gap: 4, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
        children: [text('i1', 'Hosting'), text('i2', 'VPS')],
      }),
    ],
  });
  const found = detectProduction(tree)[0];
  assert.equal(found.component, 'dropdown');
  const built = buildTemplate(tree, { overrides: {}, detections: { components: [{ id: 'd0', status: 'approved', ...found }] }, salt: 'drop' });
  assert.equal(built.template.content.find((e) => e.name === 'dropdown').settings.text, 'Dịch vụ');
  const list = built.template.content.find((e) => e.label === 'list');
  assert.equal(list.settings.tag, 'ul');
  assert.equal(list.settings._hidden._cssClasses, 'brx-dropdown-content');
});

test('a tinted sentence bar is an alert and the first picture of a link bar is a logo', () => {
  const sentence = frame('bar', {
    box: box(0, 0, 480, 48),
    layout: { mode: 'HORIZONTAL', gap: 12, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    fills: [{ type: 'SOLID', hex: '#ecfdf3', alpha: 1 }],
    children: [
      frame('mark', { box: box(0, 12, 24, 24), svg: { file: 'svg/info.svg' } }),
      { id: 'copy', type: 'TEXT', name: 'copy', box: box(36, 14, 400, 20), sizing, text: { characters: 'Đơn của bạn đã được ghi nhận', fontFamily: 'Inter', fontSize: 14 } },
    ],
  });
  const alert = detectProduction(sentence)[0];
  assert.equal(alert.component, 'alert');
  const built = buildTemplate(sentence, { overrides: {}, detections: { components: [{ id: 'd0', status: 'approved', ...alert }] }, salt: 'al' }).template.content.find((e) => e.name === 'alert');
  assert.equal(built.settings.content, 'Đơn của bạn đã được ghi nhận');
  assert.equal(built.settings.type, undefined);

  const mark = frame('brand', { box: box(0, 16, 96, 32), svg: { file: 'svg/brand.svg' } });
  const link = (id, characters, x) => ({ id, type: 'TEXT', name: id, box: box(x, 20, 60, 20), sizing, text: { characters, fontFamily: 'Inter', fontSize: 14 } });
  const header = frame('header', {
    box: box(0, 0, 960, 64),
    layout: { mode: 'HORIZONTAL', gap: 24, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [mark, link('a', 'Sản phẩm', 140), link('b', 'Giá', 220)],
  });
  const logo = detectProduction(header).find((c) => c.component === 'logo');
  assert.equal(logo.params.file, 'svg/brand.svg');
  const logoEl = buildTemplate(header, { overrides: {}, detections: { components: [{ id: 'd0', status: 'approved', ...logo }] }, salt: 'logo' }).template.content.find((e) => e.name === 'logo');
  assert.equal(logoEl.settings.logoHeight, '32px');
  assert.equal(logoEl.settings.logoUrl, undefined);
});
