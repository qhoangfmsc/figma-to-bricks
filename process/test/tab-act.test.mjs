import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activateOpenTab } from '../modules/write-bricks/components/tabs-chrome.mjs';

function box(className) {
  const classes = new Set(className.split(' ').filter(Boolean));
  return {
    classList: {
      contains: (name) => classes.has(name),
      add: (name) => classes.add(name),
    },
    setAttribute(name, value) { this.attrs[name] = value; },
    attrs: {},
  };
}

function view(openIndex) {
  const titles = [box('tab-title'), box('tab-title'), box('tab-title')];
  const panes = [box('tab-pane'), box('tab-pane'), box('tab-pane')];
  const menu = { children: titles };
  const content = { children: panes };
  titles.forEach((item) => { item.parentNode = menu; });
  panes.forEach((item) => { item.parentNode = content; });
  return {
    titles,
    panes,
    root: {
      getAttribute: () => String(openIndex),
      querySelector: (sel) => (sel === '.tab-title' ? titles[0] : panes[0]),
    },
  };
}

test('after render, the tab marked open is the one that receives brx-open', () => {
  const first = view(1);
  activateOpenTab(first.root);
  assert.equal(first.titles[1].classList.contains('brx-open'), true);
  assert.equal(first.titles[0].classList.contains('brx-open'), false);
  assert.equal(first.titles[1].attrs['aria-selected'], 'true');
  assert.equal(first.panes[1].classList.contains('brx-open'), true);
  assert.equal(first.panes[0].classList.contains('brx-open'), false);
});
