import { PartKind, isKind } from '../modules/recognize-parts/kinds.mjs';
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
  const spilling = frame('spill', {
    box: box(0, 0, 200, 80),
    children: [picture('a', 0), picture('b', 136), picture('c', 272)],
  });
  assert.equal(detectProduction(spilling).some((c) => isKind(c, PartKind.GALLERY)), false);
  const pair = frame('pair', {
    box: box(0, 0, 260, 80),
    layout: { mode: 'HORIZONTAL', gap: 16, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [picture('p', 0), picture('q', 136)],
  });
  assert.equal(detectProduction(pair)[0].component, 'gallery');
  assert.equal(detectProduction(pair)[0].params.columns, 2);
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
  assert.equal(detectProduction(titled).some((c) => isKind(c, PartKind.PROGRESS)), false);
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
  const gem = (id, x) => frame(id, { box: box(x, 0, 40, 40), component: 'Gem', svg: { file: 'svg/gem.svg' } });
  const gems = frame('gems', {
    box: box(0, 0, 88, 40),
    layout: { mode: 'HORIZONTAL', gap: 8, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [gem('g1', 0), gem('g2', 48)],
  });
  const two = detectProduction(gems)[0];
  assert.equal(two.component, 'rating');
  assert.equal(two.params.maxRating, 2);

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

test('a dropdown with no drawn list still builds the control', () => {
  const text = (id, characters) => ({ id, type: 'TEXT', name: id, box: box(0, 0, 40, 20), sizing, text: { characters, fontFamily: 'Inter', fontSize: 14 } });
  const tree = frame('item', {
    box: box(0, 0, 120, 32),
    layout: { mode: 'HORIZONTAL', gap: 8, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [text('label', 'Topics'), frame('chev', { box: box(70, 4, 12, 12), svg: { file: 'svg/chev.svg' } })],
  });
  const built = buildTemplate(tree, {
    overrides: {},
    detections: { components: [{ id: 'd0', status: 'approved', component: PartKind.DROPDOWN, node: 'item', params: { text: 'Topics', list: null } }] },
    salt: 'closed',
  });
  assert.equal(built.template.content.find((e) => e.name === 'dropdown').settings.text, 'Topics');
  assert.equal(built.template.content.some((e) => e.settings?._hidden?._cssClasses === 'brx-dropdown-content'), false);
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
  const note = frame('note', {
    box: box(0, 0, 80, 20),
    layout: { mode: 'HORIZONTAL', gap: 4, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    fills: [{ type: 'SOLID', hex: '#fff4e5', alpha: 1 }],
    children: [
      frame('bell', { box: box(0, 4, 12, 12), svg: { file: 'svg/bell.svg' } }),
      { id: 'copy2', type: 'TEXT', name: 'copy2', box: box(16, 2, 60, 16), sizing, text: { characters: 'All set', fontFamily: 'Inter', fontSize: 12 } },
    ],
  });
  assert.equal(detectProduction(note)[0].component, 'alert');
  assert.equal(detectProduction(note)[0].params.content, 'All set');
  const chip = frame('chip', {
    box: box(12, 12, 70, 24),
    layout: { mode: 'HORIZONTAL', gap: 4, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    fills: [{ type: 'SOLID', hex: '#fff4e5', alpha: 1 }],
    children: [
      frame('dot', { box: box(4, 6, 12, 12), svg: { file: 'svg/dot.svg' } }),
      { id: 'chip-copy', type: 'TEXT', name: 'chip-copy', box: box(20, 4, 44, 16), sizing, text: { characters: 'New plan', fontFamily: 'Inter', fontSize: 12 } },
    ],
  });
  const board = frame('board', { box: box(0, 0, 480, 200), children: [chip] });
  assert.equal(detectProduction(board).some((item) => item.component === 'alert'), false);

  const mark = frame('brand', { box: box(0, 16, 96, 32), svg: { file: 'svg/brand.svg' } });
  const link = (id, characters, x) => ({ id, type: 'TEXT', name: id, box: box(x, 20, 60, 20), sizing, text: { characters, fontFamily: 'Inter', fontSize: 14 } });
  const header = frame('header', {
    box: box(0, 0, 960, 64),
    layout: { mode: 'HORIZONTAL', gap: 24, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [mark, link('a', 'Sản phẩm', 140), link('b', 'Giá', 220)],
  });
  const logo = detectProduction(header).find((c) => isKind(c, PartKind.LOGO));
  assert.equal(logo.params.file, 'svg/brand.svg');
  const logoEl = buildTemplate(header, { overrides: {}, detections: { components: [{ id: 'd0', status: 'approved', ...logo }] }, salt: 'logo' }).template.content.find((e) => e.name === 'logo');
  assert.equal(logoEl.settings.logoHeight, '32px');
});

test('a quote icon in the corner of a card is not an offcanvas', () => {
  const quote = frame('Quote icon', { box: box(16, 12, 24, 24), svg: { file: 'svg/quote.svg' } });
  const card = frame('card', { box: box(440, 0, 360, 300), children: [quote] });
  const page = frame('page', { box: box(0, 0, 800, 400), children: [card] });
  assert.equal(detectProduction(page).find((c) => isKind(c, PartKind.OFFCANVAS)), undefined);
});

test('a bullet before a short word is not a progress bar', () => {
  const row = frame('tld', {
    box: box(0, 0, 104, 12),
    children: [
      frame('dot', { box: box(0, 4, 3, 3), fills: [{ type: 'SOLID', hex: '#ffffff', alpha: 1 }] }),
      { id: 'name', type: 'TEXT', box: box(8, 0, 90, 12), text: { characters: 'com' } },
    ],
  });
  assert.equal(detectProduction(row).find((c) => isKind(c, PartKind.PROGRESS)), undefined);
});

test('a logo that contains a picture is not a progress bar', () => {
  const logo = frame('logo', {
    box: box(0, 0, 84, 34),
    children: [frame('mark', {
      box: box(0, 8, 84, 18),
      children: [
        frame('word', { box: box(0, 4, 61, 8), fills: [{ type: 'SOLID', hex: '#111111', alpha: 1 }] }),
        frame('photo', { box: box(62, 0, 21, 18), fills: [{ type: 'IMAGE' }] }),
      ],
    })],
  });
  assert.equal(detectProduction(logo).find((c) => isKind(c, PartKind.PROGRESS)), undefined);
});

test('a short track, a narrow link bar, and a large three-line mark keep their kinds', () => {
  const track = frame('meter', {
    box: box(0, 0, 60, 36),
    children: [frame('rail', {
      box: box(0, 8, 60, 20),
      children: [frame('done', { box: box(0, 0, 30, 20), fills: [{ type: 'SOLID', hex: '#2255aa', alpha: 1 }] })],
    })],
  });
  assert.equal(detectProduction(track)[0].component, PartKind.PROGRESS);
  assert.equal(detectProduction(track)[0].params.bars[0].percentage, 50);

  const brand = frame('mark', { box: box(0, 8, 40, 20), svg: { file: 'svg/mark.svg' } });
  const link = (id, characters, x) => ({ id, type: 'TEXT', name: id, box: box(x, 10, 70, 16), sizing, text: { characters, fontFamily: 'Inter', fontSize: 14 } });
  const bar = frame('bar', {
    box: box(0, 0, 200, 36),
    layout: { mode: 'HORIZONTAL', gap: 12, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [brand, link('docs', 'Docs', 52), link('bill', 'Billing history for the account', 130)],
  });
  assert.equal(detectProduction(bar).find((item) => isKind(item, PartKind.LOGO)).params.file, 'svg/mark.svg');

  const menu = frame('menu', {
    box: box(0, 0, 64, 64),
    children: [8, 28, 48].map((y, index) => frame(`line${index}`, { box: box(12, y, 40, 8), fills: [{ type: 'SOLID', hex: '#111111', alpha: 1 }] })),
  });
  assert.equal(detectProduction(menu)[0].component, PartKind.HAMBURGER);
});
