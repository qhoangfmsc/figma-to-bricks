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

test('a long label trail that starts and ends on a label is still breadcrumbs', () => {
  const step = (id, label, mark) => ({
    id, type: mark ? 'VECTOR' : 'FRAME', name: id,
    box: { x: 0, y: 0, w: mark ? 8 : 40, h: mark ? 8 : 20, absX: 0, absY: 0 },
    ...(mark ? { svg: { file: `svg/${id}.svg` } } : { children: [text(`${id}t`, label)] }),
    children: mark ? [] : [text(`${id}t`, label)],
  });
  const trail = {
    id: 'long', type: 'FRAME', name: 'Trail', layout: { mode: 'HORIZONTAL' },
    box: { x: 0, y: 0, w: 400, h: 24, absX: 0, absY: 0 },
    children: [
      step('a', 'Home', false), step('s1', '', true),
      step('b', 'Library', false), step('s2', '', true),
      step('c', 'Shelf', false), step('s3', '', true),
      step('d', 'Box', false), step('s4', '', true),
      step('e', 'Item', false),
    ],
  };
  assert.equal(detectBreadcrumbs({ id: 'root', children: [trail] })[0]?.node, 'long');
  const wide = {
    id: 'wide', type: 'FRAME', name: 'Trail', layout: { mode: 'HORIZONTAL' },
    box: { x: 0, y: 0, w: 200, h: 40, absX: 0, absY: 0 },
    children: [
      crumb('home', 'Start', false),
      { id: 'gap', type: 'INSTANCE', name: 'chevron', svg: { file: 'svg/wide.svg' }, box: { x: 0, y: 0, w: 40, h: 40, absX: 0, absY: 0 }, children: [] },
      crumb('here', 'Library', false),
    ],
  };
  assert.equal(detectBreadcrumbs({ id: 'root', children: [wide] }).some((item) => item.node === 'wide'), true);
});

test('a figure beside a rate is not a trail', () => {
  const bit = (id, label) => ({
    id, type: 'FRAME', layout: { mode: 'HORIZONTAL' },
    box: { x: 0, y: 0, w: 80, h: 24, absX: 0, absY: 0 },
    children: [text(`${id}t`, label), icon(`${id}i`)],
  });
  const row = {
    id: 'figs', type: 'FRAME', layout: { mode: 'HORIZONTAL' },
    box: { x: 0, y: 0, w: 180, h: 24, absX: 0, absY: 0 },
    children: [bit('a', '222'), bit('b', '-30%')],
  };
  assert.equal(detectBreadcrumbs(row).length, 0);
});
