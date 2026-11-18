import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { detectSelects } from '../modules/recognize-parts/rules/select.mjs';
import { detectButtons } from '../modules/recognize-parts/rules/button.mjs';
import { decide } from '../modules/approve-parts/index.mjs';
import { choiceOf } from '../modules/missing-content/choices.mjs';
import { applyAnswers } from '../modules/missing-content/index.mjs';

const box = (x, y, w, h) => ({ x, y, width: w, height: h });
const text = (id, value, x) => ({
  id, name: id, type: 'TEXT', characters: value,
  absoluteBoundingBox: box(x, 12, 60, 20),
  style: { fontFamily: 'Roboto', fontSize: 14, fontWeight: 500, lineHeightPx: 20 },
});
const frame = (id, name, rect, children, extra = {}) => ({
  id, name, type: 'FRAME', absoluteBoundingBox: box(...rect), children, layoutMode: 'HORIZONTAL', ...extra,
});

function controlTree() {
  return normalizeRoot({ nodes: { r: { document: frame('r', 'Page', [0, 0, 360, 120], [
    text('above', 'Period', 0),
    frame('box', 'box', [0, 28, 220, 44], [
      text('value', 'Term', 16),
      frame('mark', 'mark', [188, 16, 12, 12], []),
    ], { strokes: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2, a: 1 } }], strokeWeight: 1 }),
  ], { layoutMode: 'VERTICAL' }) } } }, 'r', { images: {}, svgs: {} });
}

test('a bordered control with a trailing mark is a dropdown and the plan asks for its values', () => {
  const tree = controlTree();
  const found = detectSelects(tree);
  assert.equal(found.length, 1);
  assert.equal(found[0].node, 'box');
  assert.equal(found[0].params.text, 'Term');
  assert.equal(detectButtons(tree).some((item) => item.node === 'box'), false);
  assert.deepEqual(choiceOf('options', 'Spring\nSummer'), { choice: 'list', values: ['Spring', 'Summer'] });
  const files = {
    'tree.json': tree,
    'facts.json': { repeats: [] },
    'overrides.json': { nodes: {} },
    'detections.json': { components: found.map((item) => ({ ...item, status: 'proposed', source: 'rule' })) },
  };
  const ws = { readJson: (name, fallback) => files[name] ?? fallback, writeJson: (name, value) => { files[name] = value; } };
  const asked = decide(ws, {}).questions.find((item) => item.group === 'options');
  assert.equal(asked.node, 'box');
  applyAnswers(ws, { 'options:box': { choice: 'list', values: ['Spring', 'Summer'] } });
  const built = buildTemplate(tree, { detections: files['detections.json'], salt: 'select' });
  const el = built.template.content.find((item) => item.id === built.mapping.box?.bricksId);
  assert.equal(el.settings._hidden._cssClasses, 'f2b-select f2b-select-trigger');
  assert.equal(el.settings._position, 'relative');
  assert.equal(el.settings._overflow, 'visible');
  const values = built.template.content.find((item) => item.settings?._hidden?._cssClasses === 'f2b-select-values');
  assert.equal(values.settings._position, 'absolute');
  assert.equal(values.parent, el.id);
  const options = built.template.content.filter((item) => item.settings?.text === 'Spring' || item.settings?.text === 'Summer');
  assert.deepEqual(options.map((item) => item.settings.text).sort(), ['Spring', 'Summer']);
  assert.equal(built.template.content.find((item) => item.id === built.mapping.value?.bricksId).settings._hidden._cssClasses, 'f2b-select-value');
  assert.match(el.settings._cssCustom, /\.f2b-select-option \{[^}]*border: none/);
  assert.match(el.settings._cssCustom, /\.f2b-select-trigger::after/);
});
