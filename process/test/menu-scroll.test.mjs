import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectMenus } from '../detect/rules/menu.mjs';
import { detectCarousels } from '../detect/rules/carousel.mjs';
import { checkCites } from '../detect/cite.mjs';
import menuSlider from '../bricks/components/menu-slider.mjs';
import { buildTemplate } from '../bricks/render/index.mjs';

const pad = { top: 0, right: 0, bottom: 0, left: 0 };
const text = (id, label, w) => ({
  id, name: 'Label', type: 'TEXT',
  box: { x: 0, y: 10, w, h: 20, absX: 0, absY: 10 },
  sizing: { h: 'HUG', v: 'HUG' },
  text: { characters: label, fontFamily: 'Inter', fontSize: 16, fontWeight: 400, lineHeightPx: 20, align: 'LEFT' },
  fills: [{ type: 'SOLID', hex: '#111111', alpha: 1 }],
});
const item = (i, x, w, label) => ({
  id: `mi${i}`, name: '_sub-menu-item', type: 'FRAME', place: 'FLOW',
  box: { x, y: 0, w, h: 40, absX: x, absY: 0 },
  sizing: { h: 'FIXED', v: 'FIXED' },
  layout: { mode: 'HORIZONTAL', gap: 0, padding: pad },
  children: [text(`ml${i}`, label, w)],
});
const arrow = (id, name, absX) => ({
  id, name, type: 'INSTANCE', place: 'ABSOLUTE', opacity: name.includes('left') ? 0.2 : undefined,
  box: { x: absX, y: 0, w: 40, h: 40, absX, absY: 0 },
  sizing: { h: 'FIXED', v: 'FIXED' },
  fills: [{ type: 'SOLID', hex: '#0066cc', alpha: 1 }],
  children: [{ id: `${id}t`, name, type: 'TEXT', svg: { file: `svg/${id}.svg` }, text: { characters: name }, box: { x: 12, y: 12, w: 16, h: 16, absX: absX + 12, absY: 12 } }],
});

function row(items, { w = 400, parentClip = false, arrows = false } = {}) {
  const menuRow = {
    id: 'menu', name: '_menu', type: 'FRAME', place: 'FLOW',
    box: { x: 40, y: 0, w, h: 40, absX: 40, absY: 0 },
    sizing: { h: 'FIXED', v: 'FIXED' },
    layout: { mode: 'HORIZONTAL', gap: 24, padding: pad, primaryAlign: 'MIN', counterAlign: 'MIN' },
    children: items,
  };
  const kids = [menuRow];
  if (arrows) {
    kids.push({
      id: 'nav', name: 'Navigation', type: 'FRAME', place: 'ABSOLUTE',
      box: { x: 0, y: 0, w: w + 80, h: 40, absX: 0, absY: 0 },
      sizing: { h: 'FIXED', v: 'FIXED' },
      children: [arrow('left', 'angle-left', 0), arrow('right', 'angle-right', w + 40)],
    });
  }
  return {
    id: 'root', name: '_sub-menu', type: 'FRAME',
    box: { x: 0, y: 0, w: w + 240, h: 60, absX: 0, absY: 0 },
    sizing: { h: 'FIXED', v: 'FIXED' },
    layout: { mode: 'VERTICAL', gap: 0, padding: pad, primaryAlign: 'MIN', counterAlign: 'MIN' },
    children: [{
      id: 'slide', name: 'Item Slide', type: 'FRAME', clip: parentClip, place: 'FLOW',
      box: { x: 0, y: 0, w: w + 80, h: 40, absX: 0, absY: 0 },
      sizing: { h: 'FIXED', v: 'FIXED' },
      children: kids,
    }, {
      id: 'cta', name: 'Button', type: 'FRAME', place: 'FLOW',
      box: { x: w + 80, y: 0, w: 120, h: 40, absX: w + 120, absY: 0 },
      sizing: { h: 'FIXED', v: 'FIXED' },
      layout: { mode: 'HORIZONTAL', gap: 0, padding: pad, primaryAlign: 'MIN', counterAlign: 'MIN' },
      children: [text('ct', 'Chọn dịch vụ', 100)],
    }],
  };
}

const fitItems = [item(1, 0, 80, 'Một'), item(2, 104, 80, 'Hai')];
const wideItems = [0, 1, 2, 3, 4, 5].map((i) => item(i, i * 100, 80, `Mục ${i}`));

test('a short menu that fits is a menu and not a slider', () => {
  const tree = row(fitItems);
  const found = detectMenus(tree);
  assert.equal(found.length, 1);
  assert.equal(found[0].component, 'menu');
  assert.equal(found[0].node, 'menu');
  assert.equal(checkCites(found[0].cite, tree).join(';'), '');
  assert.equal(detectCarousels(tree).length, 0);
  const det = { id: 'd1', component: 'menu', node: 'menu', status: 'approved', params: found[0].params };
  const built = buildTemplate(tree, { detections: { components: [det] }, salt: 'menufit' }).template.content;
  const rowEl = built.find((e) => e.label === '_menu');
  assert.equal(rowEl.name, 'block');
  assert.equal(rowEl.settings.tag, 'ul');
  assert.ok(built.filter((e) => e.label === '_sub-menu-item').every((e) => e.settings.tag === 'li'));
  assert.equal(built.find((e) => e.label === 'Item Slide').settings.tag, 'nav');
});

test('a clipping parent that cuts the row adds the inner slider even when the menu box is wider', () => {
  const tree = row(fitItems, { w: 400, parentClip: true });
  const slide = tree.children[0];
  slide.box.w = 80;
  const found = detectMenus(tree);
  assert.equal(found[0].component, 'menu-slider');
  assert.equal(found[0].params.prev, undefined);
});

test('one named item is not a menu, and a row of links with no menu name is not a menu', () => {
  assert.equal(detectMenus(row([item(1, 0, 80, 'Một')])).length, 0);
  const plain = row(fitItems);
  const menuRow = plain.children[0].children[0];
  menuRow.name = 'Row';
  menuRow.children.forEach((c) => { if (c.name === '_sub-menu-item') c.name = 'Link'; });
  plain.name = 'Footer';
  plain.children[0].name = 'Links';
  assert.equal(detectMenus(plain).length, 0);
});

test('menu items that run past the frame become a slider of those items, not a separate carousel', () => {
  const tree = row(wideItems, { w: 300, arrows: true });
  const found = detectMenus(tree);
  assert.equal(found.length, 1);
  assert.equal(found[0].component, 'menu-slider');
  assert.equal(found[0].params.prev, 'left');
  assert.equal(found[0].params.next, 'right');
  assert.deepEqual(found[0].params.controls, ['nav']);
  assert.equal(detectCarousels(tree).length, 0);

  const det = { id: 'd1', component: 'menu-slider', node: 'menu', status: 'approved', params: { ...found[0].params, links: { ml0: '#a' } } };
  const b = buildTemplate(tree, { detections: { components: [det] }, salt: 'menuslide' });
  const elements = b.template.content;
  const slider = elements.find((e) => e.label === '_menu');
  assert.equal(slider.name, 'slider-nested');
  const options = JSON.parse(slider.settings.options);
  assert.equal(options.type, 'slide');
  assert.equal(options.drag, true);
  assert.equal(options.rewind, false);
  assert.equal(options.autoWidth, true);
  assert.equal(options.pagination, false);
  assert.equal(options.autoplay, undefined);
  assert.equal(options.gap, '24px');
  assert.equal(slider.settings._overflow, 'visible');
  assert.equal(slider.settings.arrows, true);
  assert.equal(slider.settings.prevArrowLeft, '0px');
  assert.equal(slider.settings.nextArrowRight, '0px');
  assert.equal(slider.settings._padding.left, '40px');
  assert.equal(slider.settings._padding.right, '40px');
  assert.equal(options.padding, undefined);
  assert.ok(slider.settings.nextArrow);
  const slides = elements.filter((e) => e.label === '_sub-menu-item');
  assert.equal(slides.length, 6);
  assert.ok(slides.every((e) => e.settings._width === '80px'));
  assert.ok(elements.some((e) => e.name === 'text-link' && e.settings.link?.url === '#a'));
  assert.equal(b.mapping.nav.skipped.startsWith('merged into menu-slider'), true);
  assert.ok(elements.some((e) => e.label === 'Button'));
  assert.equal(elements.find((e) => e.label === 'Item Slide').settings.tag, 'nav');

  det.params.autoplay = true;
  const s = {};
  menuSlider.apply({ node: tree.children[0].children[0], s, root: tree }, det);
  assert.equal(JSON.parse(s.options).autoplay, undefined);
  assert.equal(JSON.parse(s.options).type, 'slide');
});

test('a drawn Active item is the selected link, and a click moves that look', () => {
  const items = wideItems.map((n) => ({ ...n, children: n.children.map((c) => ({ ...c })) }));
  items[0].props = { State: 'Active' };
  items[0].stroke = { align: 'INSIDE', paints: [{ type: 'SOLID', hex: '#007cfc', alpha: 1 }], weights: { top: 0, right: 0, bottom: 3, left: 0 } };
  items[0].children[0].fills = [{ type: 'SOLID', hex: '#007cfc', alpha: 1 }];
  items[1].props = { State: 'Default' };
  items[1].children[0].fills = [{ type: 'SOLID', hex: '#525666', alpha: 1 }];
  const tree = row(items, { w: 300, arrows: true });
  const found = detectMenus(tree)[0];
  const det = { id: 'd1', component: 'menu-slider', node: 'menu', status: 'approved', params: found.params };
  const elements = buildTemplate(tree, { detections: { components: [det] }, salt: 'menuactive' }).template.content;
  const first = elements.find((e) => e.label === '_sub-menu-item');
  assert.equal(first.settings._cssClasses, 'is-active');
  assert.equal(first.settings._border, undefined);
  assert.doesNotMatch(first.settings._cssCustom ?? '', /border/);
  assert.equal(first.settings._interactions[1].action, 'setAttribute');
  assert.equal(first.settings._interactions[1].actionAttributeValue, 'is-active');
  const slider = elements.find((e) => e.label === '_menu');
  assert.match(slider.settings._cssCustom, /#007cfc/i);
  assert.match(slider.settings._cssCustom, /border-bottom: 3px solid #007cfc/i);
});

test('arrow buttons are found from a Left or Right property when the icon text is not angle-left', () => {
  const tree = row(wideItems, { w: 300, arrows: true });
  const nav = tree.children[0].children[1];
  const byId = (id) => nav.children.find((c) => c.id === id);
  byId('left').name = '_submenu-navigation';
  byId('left').props = { 'Property 2': 'Left' };
  byId('left').children = [];
  byId('right').name = '_submenu-navigation';
  byId('right').props = { 'Property 2': 'Right' };
  byId('right').children = [];
  const found = detectMenus(tree)[0];
  assert.equal(found.params.prev, 'left');
  assert.equal(found.params.next, 'right');
});

test('an arrow that covers the labels moves into a gutter, and the lighter icon is only the disabled colour', () => {
  const tree = row(wideItems, { w: 300, arrows: true });
  const menu = tree.children[0].children[0];
  const nav = tree.children[0].children[1];
  const right = nav.children.find((c) => c.id === 'right');
  right.box = { ...right.box, absX: menu.box.absX + menu.box.w - 20 };
  nav.children.find((c) => c.id === 'left').children[0].fills = [{ type: 'SOLID', hex: '#e0e0e0', alpha: 1 }];
  right.children[0].fills = [{ type: 'SOLID', hex: '#525666', alpha: 1 }];
  const s = {};
  menuSlider.apply({ node: menu, s, css: {}, root: tree }, { params: { prev: 'left', next: 'right' } });
  const options = JSON.parse(s.options);
  assert.equal(s.prevArrowLeft, '0px');
  assert.equal(s.nextArrowRight, '0px');
  assert.equal(options.padding, undefined);
  assert.equal(s._padding.left, '40px');
  assert.equal(s._padding.right, '40px');
  assert.equal(s.arrowColor.hex, '#525666');
  assert.equal(s.arrowDisabledColor.hex, '#e0e0e0');
  assert.equal(s.arrowDisabledOpacity, 1);
});
