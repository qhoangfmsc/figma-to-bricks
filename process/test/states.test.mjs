import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { ComponentState, componentState, siblingStatePatches } from '../modules/write-bricks/components/states.mjs';

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
