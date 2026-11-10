import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectScrollLists } from '../modules/recognize-parts/rules/scroll.mjs';
import { detectProduction } from '../modules/recognize-parts/rules/production-widgets.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { fitFluid } from '../modules/breakpoints/solo.mjs';
import { detectStep } from '../modules/build-steps/03-detect.mjs';
import { decide, writeDecisionReport } from '../modules/approve-parts/index.mjs';
import { groupQuestions, GROUPS, keyOf, figmaLink } from '../modules/missing-content/index.mjs';
import { planInventory, screenParts, sectionBlocks } from '../modules/single-template/parts.mjs';
import { renderTemplatePlan } from '../modules/single-template/plan-doc.mjs';

const box = (x, y, w, h) => ({ x, y, w, h, absX: x, absY: y });
const sizing = { h: 'FIXED', v: 'FIXED' };
const text = (id, value) => ({
  id, type: 'TEXT', name: id, visible: true, box: box(0, 0, 80, 20), sizing, children: [],
  text: { characters: value },
});
const card = (id, x, y = 0) => ({
  id, type: 'FRAME', name: 'Card', visible: true, box: box(x, y, 315, 414), sizing,
  layout: { mode: 'VERTICAL', wrap: false, gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
  children: [text(`${id}t`, id)],
});

const rect = (id, x, y, w, h, hex, place = 'FLOW') => ({
  id, type: 'RECTANGLE', name: id, visible: true, place, box: box(x, y, w, h), sizing,
  fills: [{ type: 'SOLID', hex, alpha: 1 }], children: [],
});
const bar = (id, x, y, w, h, along) => ({
  id, type: 'FRAME', name: id, visible: true, box: box(x, y, w, h), sizing,
  layout: { mode: along === 'y' ? 'HORIZONTAL' : 'VERTICAL', wrap: false, gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
  children: along === 'y'
    ? [rect(`${id}track`, 0, 0, 6, h, '#f5f5f5', 'ABSOLUTE'), rect(`${id}thumb`, 0, 0, 6, 40, '#d9d9d9')]
    : [rect(`${id}track`, 0, 12, w, 6, '#f5f5f5', 'ABSOLUTE'), rect(`${id}thumb`, 0, 12, 126, 6, '#d9d9d9')],
});

test('a darker thumb on a lighter track scrolls the items that run past the container', () => {
  const row = {
    id: 'row', type: 'FRAME', name: 'row', visible: true, box: box(24, 0, 977, 414), sizing,
    layout: { mode: 'HORIZONTAL', wrap: false, gap: 16, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [card('a', 0), card('b', 331), card('c', 662)],
  };
  const track = bar('track', 24, 414, 728, 18, 'x');
  const host = {
    id: 'host', type: 'FRAME', name: 'Paragraph', visible: true, clip: true, box: box(0, 0, 752, 496), sizing,
    layout: { mode: 'VERTICAL', wrap: false, gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 24 } },
    children: [row, track],
  };
  const found = detectScrollLists(host);
  assert.equal(found.length, 1);
  assert.equal(found[0].node, 'track');
  assert.equal(found[0].params.axis, 'x');
  assert.equal(found[0].params.container, 'host');
  assert.equal(found[0].params.list, 'row');
  assert.equal(found[0].params.track, 'tracktrack');
  assert.equal(found[0].params.thumb, 'trackthumb');
  const section = {
    id: 'section', type: 'FRAME', name: 'Section', visible: true, box: box(0, 0, 1440, 800), sizing,
    layout: { mode: 'VERTICAL', wrap: false, gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [host],
  };
  const built = buildTemplate(section, { overrides: {}, detections: { components: [{ id: 'd0', status: 'approved', ...found[0] }] }, salt: 'scr' });
  const frame = built.template.content.find((e) => e.label === 'Paragraph');
  const rowEl = built.template.content.find((e) => e.label === 'row');
  const barEl = built.template.content.find((e) => e.label === 'track');
  const thumbEl = built.template.content.find((e) => e.label === 'trackthumb');
  assert.equal(frame.settings._overflow, 'auto');
  assert.equal(frame.settings._attributes.find((a) => a.name === 'data-f2b-scroll').value, 'x');
  assert.match(frame.settings._attributes.find((a) => a.name === 'onwheel').value, /scrollLeft/);
  assert.match(frame.settings._cssCustom, /scrollbar-width: none/);
  assert.equal(rowEl.settings._overflow, undefined);
  assert.equal(rowEl.settings._width, '977px');
  assert.equal(barEl.settings._position, 'sticky');
  assert.equal(thumbEl.settings._attributes.find((a) => a.name === 'data-f2b-scroll-thumb').value, 'x');
  assert.match(frame.settings._cssCustom, /scroll-timeline-name: --f2b-scroll-trackthumb/);
  assert.match(thumbEl.settings._cssCustom, /animation-timeline: --f2b-scroll-trackthumb/);
  assert.match(thumbEl.settings._cssCustom, /translateX\(602px\)/);
  assert.match(thumbEl.settings._attributes.find((a) => a.name === 'onpointermove').value, /scrollLeft/);
  const named = buildTemplate(section, { overrides: {}, detections: { components: [{ id: 'd1', status: 'approved', component: 'scroll', node: 'track', params: {} }] }, salt: 'named' });
  assert.equal(named.template.content.find((e) => e.label === 'Paragraph').settings._overflow, 'auto');
  assert.equal(named.template.content.find((e) => e.label === 'row').settings._overflow, undefined);

  const vrow = {
    id: 'vrow', type: 'FRAME', name: 'vrow', visible: true, box: box(0, 0, 300, 540), sizing,
    layout: { mode: 'VERTICAL', wrap: false, gap: 8, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [0, 1, 2].map((i) => ({ ...card(`v${i}`, 0, i * 180), box: box(0, i * 180, 300, 160) })),
  };
  const down = {
    id: 'down', type: 'FRAME', name: 'down', visible: true, clip: true, box: box(0, 0, 320, 200), sizing,
    layout: { mode: 'VERTICAL', wrap: false, gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [vrow, bar('vbar', 300, 0, 18, 200, 'y')],
  };
  assert.equal(detectScrollLists(down)[0].params.axis, 'y');

  const open = {
    id: 'open', type: 'FRAME', name: 'open', visible: true, clip: false, box: box(0, 0, 752, 428), sizing,
    layout: { mode: 'VERTICAL', wrap: false, gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [{ ...row, box: box(24, 0, 1308, 410), children: [card('a', 0), card('b', 331), card('c', 662), card('d', 993)] }, bar('bar2', 24, 410, 728, 18, 'x')],
  };
  const second = detectScrollLists(open)[0];
  assert.equal(second.params.axis, 'x');
  assert.equal(second.params.items.length, 4);
  assert.equal(detectProduction(open).some((c) => c.component === 'progress'), false);

  const fits = { ...host, box: box(0, 0, 1200, 496), children: [{ ...row, box: box(0, 0, 977, 414) }, track] };
  assert.equal(detectScrollLists(fits).length, 0);
  const pale = structuredClone(host);
  pale.children[1].children[1].fills[0].hex = '#ffffff';
  assert.equal(detectScrollLists(pale).length, 0);
});

test('the enterprise price row in this file is that sideways list', () => {
  const tree = JSON.parse(readFileSync(new URL('../../history/runs/cLbX6E4TL45F6k2WYE5TCQ/1-4263/tree.json', import.meta.url), 'utf8'));
  const hit = detectScrollLists(tree).find((c) => c.node === '1:4547');
  assert.equal(hit.params.axis, 'x');
  assert.equal(hit.params.container, '1:4361');
  assert.equal(hit.params.list, '1:4362');
  assert.equal(hit.params.track, '1:4548');
  assert.equal(hit.params.thumb, '1:4549');
  assert.deepEqual(hit.params.items, ['1:4363', '1:4428', '1:4485']);
});

function freshPlan(tree, fileKey) {
  const dir = mkdtempSync(join(tmpdir(), 'f2b-scroll-plan-'));
  try {
    writeFileSync(join(dir, 'tree.json'), JSON.stringify(tree));
    const ws = detectStep(dir);
    const result = decide(ws, { firstSection: false, variant: false, parentBg: null, formErrors: {} });
    writeDecisionReport(ws, result, tree.name || 'scroll');
    detectStep(dir);
    const det = ws.readJson('detections.json');
    const questions = groupQuestions(result.questions ?? []).flatMap((g) => g.items.map((item) => ({
      group: g.group,
      title: GROUPS[g.group].title(1).replace(/ 1 /, ' '),
      summary: GROUPS[g.group].summary,
      node: item.node,
      label: item.label,
      key: keyOf(g.group, item.node),
      value: item.value != null && item.value !== '' ? String(item.value) : (GROUPS[g.group].value ?? ''),
      figma: figmaLink(fileKey, item.node),
    })));
    const inventory = planInventory(tree, det.components, fileKey);
    const typeQuestion = questions.find((q) => q.group === 'type');
    const plan = renderTemplatePlan({
      title: tree.name || 'scroll',
      name: tree.name,
      width: tree.box?.w ?? null,
      variants: [],
      parts: screenParts(tree, det.components, questions, fileKey),
      blocks: sectionBlocks(tree, fileKey),
      open: inventory.open,
      repeats: inventory.repeats,
      templateType: {
        key: typeQuestion ? keyOf('type', typeQuestion.node) : `type:${tree.id}`,
        value: typeQuestion?.value || 'section',
      },
    });
    return { plan, det };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('a fresh read lists the scroll in the plan', () => {
  const tree = JSON.parse(readFileSync(new URL('../../history/runs/cLbX6E4TL45F6k2WYE5TCQ/1-4263/tree.json', import.meta.url), 'utf8'));
  const drawn = freshPlan(tree, 'cLbX6E4TL45F6k2WYE5TCQ');
  const scroll = drawn.det.components.find((c) => c.component === 'scroll' && c.node === '1:4547');
  assert.equal(scroll?.status, 'approved');
  assert.equal(drawn.det.components.some((c) => c.component === 'progress' && ['1:4361', '1:4547', '1:4548', '1:4549'].includes(c.node)), false);
  assert.match(drawn.plan, /Loại: Scroll/);
  assert.match(drawn.plan, /`part:1:4547`:/);
  assert.match(drawn.plan, /`expect:1:4547`:/);

  const row = {
    id: '1:3760', type: 'FRAME', name: 'Frame 1000002517', visible: true, box: box(24, 0, 1308, 410), sizing,
    layout: { mode: 'HORIZONTAL', wrap: false, gap: 16, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [card('1:3761', 0), card('1:3800', 331), card('1:3840', 662), card('1:3880', 993)],
  };
  const open = {
    id: '1:3759', type: 'FRAME', name: 'Paragraph', visible: true, clip: false, box: box(0, 0, 752, 428), sizing,
    layout: { mode: 'VERTICAL', wrap: false, gap: 0, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    children: [row, bar('1:4000', 24, 410, 728, 18, 'x')],
  };
  const second = freshPlan(open, 'cLbX6E4TL45F6k2WYE5TCQ');
  const again = second.det.components.find((c) => c.component === 'scroll' && c.node === '1:4000');
  assert.equal(again?.status, 'approved');
  assert.equal(second.det.components.some((c) => c.component === 'progress'), false);
  assert.match(second.plan, /Loại: Scroll/);
  assert.match(second.plan, /`part:1:4000`:/);
  assert.match(second.plan, /`expect:1:4000`:/);
  assert.doesNotMatch(second.plan, /progress/i);
});

test('a row inside a scroll frame is not stacked', () => {
  const template = {
    content: [
      { id: 'host', parent: 0, name: 'block', settings: { _overflow: 'auto', _direction: 'column', _width: '752px' } },
      { id: 'row', parent: 'host', name: 'block', settings: { _direction: 'row', _width: 'auto', _widthMax: 'none', _columnGap: '16px' } },
      { id: 'a', parent: 'row', name: 'block', settings: { _width: '315px' } },
      { id: 'b', parent: 'row', name: 'block', settings: { _width: '315px' } },
      { id: 'c', parent: 'row', name: 'block', settings: { _width: '315px' } },
    ],
  };
  fitFluid(template, { frameWidth: 1440 });
  const row = template.content.find((e) => e.id === 'row').settings;
  assert.equal(row['_direction:tablet_portrait'], undefined);
  assert.doesNotMatch(row._cssCustom ?? '', /flex-direction:\s*column/);
  assert.doesNotMatch(row._cssCustom ?? '', /flex-wrap:\s*wrap/);
});
