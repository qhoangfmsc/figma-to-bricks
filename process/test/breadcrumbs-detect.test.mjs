import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectBreadcrumbs } from '../modules/recognize-parts/rules/breadcrumbs.mjs';
import { detectMenus } from '../modules/recognize-parts/rules/menu.mjs';

const text = (id, label) => ({
  id, type: 'TEXT', name: 'Label',
  box: { x: 0, y: 0, w: 60, h: 20, absX: 0, absY: 0 },
  text: { characters: label },
});
const icon = (id) => ({
  id, type: 'INSTANCE', name: 'chevron', svg: { file: `svg/${id}.svg` },
  box: { x: 0, y: 0, w: 16, h: 16, absX: 0, absY: 0 }, children: [],
});
const crumb = (id, label, withIcon) => ({
  id, type: 'FRAME', name: 'Crumb',
  box: { x: 0, y: 0, w: 80, h: 24, absX: 0, absY: 0 },
  children: withIcon ? [icon(`${id}-icon`), text(`${id}-text`, label)] : [text(`${id}-text`, label)],
});

test('a label trail with a separator icon is breadcrumbs, and plain labels stay a menu', () => {
  const trail = {
    id: 'trail', type: 'FRAME', name: 'Trail', layout: { mode: 'HORIZONTAL' },
    box: { x: 0, y: 0, w: 280, h: 24, absX: 0, absY: 0 },
    children: [crumb('a', 'Home', false), crumb('b', 'Shop', true), crumb('c', 'Shoes', true)],
  };
  const links = {
    id: 'links', type: 'FRAME', name: 'Links', layout: { mode: 'HORIZONTAL' },
    box: { x: 0, y: 0, w: 240, h: 24, absX: 0, absY: 0 },
    children: [crumb('d', 'Alpha', false), crumb('e', 'Beta', false), crumb('f', 'Gamma', false)],
  };
  const tree = { id: 'root', children: [trail, links] };
  assert.equal(detectBreadcrumbs(tree)[0]?.node, 'trail');
  assert.equal(detectMenus(tree).some((item) => item.node === 'trail'), false);
  assert.equal(detectMenus(tree).some((item) => item.node === 'links'), true);
});
