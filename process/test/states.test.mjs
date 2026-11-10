import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { ComponentState, componentState, siblingStatePatches, activeLook } from '../modules/write-bricks/components/states.mjs';

test('component state reads the variant property and the variant name', () => {
  assert.equal(componentState({ props: { State: 'Hover' } }), ComponentState.HOVER);
  assert.equal(componentState({ props: { State: 'Expand' } }), ComponentState.OPEN);
  assert.equal(componentState({ props: { State: 'Active' } }), ComponentState.ACTIVE);
  assert.equal(componentState({ props: { State: 'Disabled' } }), ComponentState.DISABLED);
  assert.equal(componentState({ props: { State: 'Pressed' } }), ComponentState.PRESSED);
  assert.equal(componentState({ props: { State: 'Focus' } }), ComponentState.FOCUS);
  assert.equal(componentState({ component: 'Size=xl, State=Default' }), ComponentState.REST);
  assert.equal(componentState({ name: 'hover-button' }), null);
});

test('sibling Hover fill becomes :hover and that item keeps no resting background', () => {
  const item = (id, state, hex) => ({
    id, name: id, type: 'INSTANCE', visible: true, componentSet: 'Button',
    props: { State: state }, fills: hex ? [{ type: 'SOLID', hex, alpha: 1 }] : [], children: [],
  });
  const root = { id: 'row', visible: true, children: [item('a', 'Default'), item('b', 'Hover', '#007cfc'), item('c', 'Default')] };
  const patches = siblingStatePatches(root, []);
  assert.equal(patches.b.dropSettings.includes('_background'), true);
  assert.equal(patches.b.expectCss['background-color'], 'rgba(0, 0, 0, 0)');
  assert.equal(patches.a.css[0].suffix, ':hover');
  assert.match(patches.a.css[0].decl, /#007cfc/);
  assert.equal(patches.c.css[0].suffix, ':hover');
});

test('active look is the paint and the check mark, not the item name', () => {
  const rest = {
    id: 'linux', name: 'LINUX', type: 'INSTANCE', visible: true,
    fills: [{ type: 'SOLID', hex: '#ffffff', alpha: 1 }],
    stroke: { paints: [{ type: 'SOLID', hex: '#e5e7eb', alpha: 1 }], weight: 1, align: 'INSIDE' },
    layout: { padding: { top: 16, right: 20, bottom: 16, left: 20 } },
    children: [{
      id: 'off', name: 'Radio', type: 'INSTANCE', visible: true, props: { Checked: 'False' },
      stroke: { paints: [{ type: 'SOLID', hex: '#e5e7eb', alpha: 1 }], weight: 1, align: 'INSIDE' },
      children: [],
    }],
  };
  const on = {
    id: 'win', name: 'WINDOWS', type: 'INSTANCE', visible: true,
    fills: [{ type: 'SOLID', hex: '#fff6f4', alpha: 1 }],
    stroke: { paints: [{ type: 'SOLID', hex: '#ffe2cc', alpha: 1 }], weight: 1, align: 'INSIDE' },
    layout: { padding: { top: 16, right: 20, bottom: 16, left: 20 } },
    children: [{
      id: 'onr', name: 'Radio', type: 'INSTANCE', visible: true, props: { Checked: 'True' },
      fills: [{ type: 'SOLID', hex: '#ff8629', alpha: 1 }],
      stroke: { paints: [{ type: 'SOLID', hex: '#ff8629', alpha: 1 }], weight: 1, align: 'INSIDE' },
      children: [{ id: 'dot', name: 'Check', type: 'ELLIPSE', visible: true, fills: [{ type: 'SOLID', hex: '#ffffff', alpha: 1 }], children: [] }],
    }],
  };
  const look = activeLook(rest, on, '.brx-open');
  assert.equal(look.controls[0].path, '0');
  assert.equal(look.controls[0].role, 'radio');
  assert.equal(look.clones[0].like, 'dot');
  assert.equal(look.clones[0].parentPath, '0');
  assert.match(look.css.find((rule) => rule.suffix === '.brx-open').decl, /#ffe2cc/);
  assert.match(look.css.find((rule) => rule.suffix === '.brx-open .f2b-s-0').decl, /#ff8629/);
  assert.equal(look.css.some((rule) => /LINUX|WINDOWS/.test(rule.decl)), false);
});

test('a component that paints its own state is skipped, and a null prototype action does not throw', () => {
  const item = (id, state) => ({ id, name: id, type: 'INSTANCE', visible: true, componentSet: 'FAQ', props: { State: state }, fills: [{ type: 'SOLID', hex: '#ffffff', alpha: 1 }], children: [] });
  const root = { id: 'list', children: [item('a', 'Default'), item('b', 'Hover')] };
  assert.deepEqual(siblingStatePatches(root, ['list']), {});
  const raw = { nodes: { r: { document: {
    id: 'r', name: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 },
    children: [{ id: 'radio', name: 'Radio', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 }, interactions: [{ trigger: { type: 'ON_CLICK' }, actions: [null] }] }],
  } } } };
  const tree = normalizeRoot(raw, 'r', { images: {}, svgs: {} });
  assert.equal(tree.children[0].interactions, undefined);
  assert.ok(tree.children[0].unhandled.includes('interaction action is null'));
});
