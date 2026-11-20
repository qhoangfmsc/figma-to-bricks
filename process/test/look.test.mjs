import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAiDecisions, lookReport, normalizeAi, signalRows } from '../modules/single-template/look.mjs';
import { PartKind, childId, lookKinds } from '../modules/recognize-parts/kinds.mjs';
import { renderTemplatePlan } from '../modules/single-template/plan-doc.mjs';
import { COMPONENTS } from '../modules/write-bricks/components/index.mjs';

const tab = {
  node: '1:1', component: PartKind.TAB_SWITCH, status: 'approved', evidence: '5 tabs',
  cite: [{ node: '1:2', field: 'layout.mode', equals: 'HORIZONTAL' }],
};

test('a plan is not ready until the picture has a reading', () => {
  const report = lookReport({ shot: 'look.png', signals: signalRows([tab]), ai: null });
  assert.equal(report.ready, false);
  assert.deepEqual(report.rows[0].cite, ['1:2.layout.mode']);
  const md = renderTemplatePlan({
    title: 'T', name: 'S', width: 100,
    parts: [{ kind: 'Tabs Component', name: 'Title', node: '1:1', fields: [] }],
    look: report,
  });
  assert.match(md, /## Chứng cứ\n!\[[^\]]*\]\(look\.png\)\nNhận dạng từ ảnh chưa đủ/);
  assert.match(md, /chưa phải bản để xác nhận/);
  assert.match(md, /AI: chưa nhận dạng nhóm này trên ảnh/);
  assert.doesNotMatch(md, /part:1:1`: drop/);
});

test('the same kind is kept, a different kind is drop, and a picture-only group stays a block', () => {
  const signals = signalRows([
    tab,
    { node: '1:9', component: PartKind.MENU, status: 'proposed', evidence: '3 links', cite: [] },
    { node: '1:8', component: PartKind.BUTTON, status: 'proposed', evidence: 'one label', cite: [] },
  ]);
  const ai = normalizeAi([
    { node: '1:1', kind: 'tab-switch', see: 'một hàng chip, một chip đang chọn, nội dung bên dưới' },
    { node: '1:9', kind: 'block', see: 'ba thẻ giá' },
    { node: '1:8', kind: 'button', see: 'một nút XEM CHI TIẾT' },
    { kind: 'form', see: 'một form ở cuối, tín hiệu không có' },
  ]);
  const report = lookReport({ shot: 'look.png', signals, ai });
  assert.equal(report.ready, true);
  assert.equal(report.rows[0].verdict, 'agree');
  assert.equal(report.rows[0].weight.total, 100);
  assert.equal(report.rows[1].verdict, 'differ');
  assert.equal(report.rows[1].weight.ai, 70);
  assert.equal(report.rows[2].verdict, 'agree');
  assert.deepEqual(report.rows[2].weight, { ai: 70, code: 0, total: 70 });
  assert.equal(report.extras.length, 1);
  const model = {
    title: 'T', name: 'S', width: 100,
    parts: [{ kind: 'Tabs Component', name: 'Title', node: '1:1', fields: [] }],
    open: [
      { node: '1:9', label: 'menu', evidence: '3 links' },
      { node: '1:8', label: 'button', evidence: 'one label' },
    ],
    look: report,
  };
  const md = renderTemplatePlan(model);
  assert.match(md, /## Chứng cứ\n!\[[^\]]*\]\(look\.png\)\nẢnh quyết định loại/);
  assert.match(md, /Kết luận: dựng tab-switch/);
  assert.match(md, /Review: tin được/);
  assert.match(md, /Tín hiệu: 5 tabs \(1:2\.layout\.mode\)/);
  assert.match(md, /Kết luận: không dựng menu/);
  assert.match(md, /AI 70% thấy block/);
  assert.match(md, /guess:1:9`: drop/);
  assert.match(md, /guess:1:8`: attach/);
  assert.match(md, /Ảnh thấy form/);
  assert.match(md, /dựng form. AI 70%/);
  const kept = renderTemplatePlan(model, { 'part:1:1': 'đừng dựng nút này' });
  assert.match(kept, /đừng dựng nút này/);
});

test('a picture that names a part inside children agrees with that component', () => {
  const signals = signalRows([
    { ...tab, params: { tabs_bar: '1:1' } },
    { node: '1:4', component: childId(PartKind.SCROLL, 'thumb'), status: 'proposed', evidence: 'the thumb', cite: [] },
  ]);
  assert.equal(signals.some((row) => row.kind === 'thumb_scroll'), false);
  const ai = normalizeAi([{
    node: '1:1', kind: 'tab-switch', see: 'một hàng, một tab đang chọn, các tab còn lại nghỉ',
    children: { tabs_bar: '1:1', tabs_data: null },
  }]);
  const report = lookReport({ shot: 'look.png', signals, ai });
  assert.equal(report.rows[0].verdict, 'agree');
  assert.equal(report.rows[0].review, 'trust');
  assert.equal(report.rows[0].children[0].image, true);
  assert.equal(report.ready, true);
  assert.throws(() => normalizeAi([{ node: '1', kind: 'tabs_bar', see: 'một hàng tab' }]), /không có trong danh sách/);
});

test('a detected child stays a doubt until the picture and the structure both name it', () => {
  const slider = {
    node: 's', component: PartKind.CAROUSEL, status: 'approved', evidence: 'two rows and a dash row',
    cite: [{ node: 'dots', field: 'svg' }],
    params: { pagination: 'dots', prev: 'pv' },
  };
  const signals = signalRows([slider]);
  assert.equal(signals[0].children[0].node, 'dots');
  const ai = normalizeAi([{ node: 's', kind: 'carousel', see: 'hàng card và hàng gạch' }]);
  const report = lookReport({ shot: 'look.png', signals, ai });
  assert.equal(report.rows[0].review, 'trust');
  assert.equal(report.rows[0].children[0].review, 'doubt');
  assert.equal(report.rows[0].children[0].structure, true);
  assert.equal(report.rows[0].children[1].structure, false);
  const md = renderTemplatePlan({
    title: 'T', name: 'S', width: 100,
    parts: [{ kind: 'Slider', name: 'Reviews', node: 's', fields: [] }],
    look: report,
  });
  assert.match(md, /## Component Detected/);
  assert.match(md, /Pagination: `dots` — nghi ngờ\. cấu trúc có node này\. ảnh chưa gọi tên\./);
  assert.match(md, /Nút trước: `pv` — nghi ngờ\. cấu trúc chưa trích node này/);
});

test('an unknown kind is refused', () => {
  assert.throws(() => normalizeAi([{ node: '1', kind: 'widget', see: 'một khối lạ' }]), /không có trong danh sách/);
});

test('a picture reading keeps the open item and stores the parts it saw', () => {
  const ai = normalizeAi([{
    node: 'row', kind: 'carousel', see: 'một hàng thẻ, một thẻ đang nổi, có mũi tên sau',
    selected: 'card-b',
    children: { pagination_carousel: 'marks', carousel_prev: null, carousel_next: 'fwd' },
  }]);
  assert.equal(ai[0].selected, 'card-b');
  assert.equal(ai[0].children.carousel_prev, null);
  const files = {
    'detections.json': { components: [{ id: 'd', status: 'approved', component: PartKind.CAROUSEL, node: 'row', params: { id: 'keep' }, cite: [{ node: 'row', field: 'name' }] }] },
  };
  const ws = { has: () => true, readJson: (name) => files[name], writeJson: (name, value) => { files[name] = value; } };
  const report = lookReport({ shot: 'look.png', signals: signalRows([{ node: 'row', component: PartKind.CAROUSEL, status: 'approved', evidence: 'cards', cite: [{ node: 'row', field: 'name' }] }]), ai });
  applyAiDecisions(ws, report);
  const item = files['detections.json'].components[0];
  assert.equal(item.params.id, 'keep');
  assert.equal(item.params.selected, 'card-b');
  assert.equal(item.params.pagination, 'marks');
  assert.equal(item.params.next, 'fwd');
  assert.equal(item.params.prev, null);
  assert.equal(item.params.children.carousel_prev, null);
});

test('a row of package cards the picture names stays a price table', () => {
  const signals = signalRows([
    { node: 'deck', component: PartKind.PRICE_TABLE, status: 'approved', evidence: 'one row of package cards', cite: [{ node: 'deck', field: 'name' }] },
  ]);
  const ai = normalizeAi([
    { node: 'deck', kind: 'price-table', see: 'một hàng thẻ Pier và Berth, mỗi thẻ có giá và nút Order' },
  ]);
  const report = lookReport({ shot: 'look.png', signals, ai });
  assert.equal(report.rows[0].verdict, 'agree');
  assert.equal(report.rows[0].weight.total, 100);
  const md = renderTemplatePlan({
    title: 'T', name: 'S', width: 100,
    parts: [{ kind: 'price-table', name: 'Deck', node: 'deck', fields: [] }],
    look: report,
  });
  assert.match(md, /Kết luận: dựng price-table/);
  assert.doesNotMatch(md, /part:deck`: drop/);
});

test('aligned package cells the picture names stay a comparison table', () => {
  const signals = signalRows([
    { node: 'grid', component: PartKind.COMPARE_TABLE, status: 'approved', evidence: 'package row and aligned cells', cite: [{ node: 'grid', field: 'name' }] },
  ]);
  const ai = normalizeAi([
    { node: 'grid', kind: 'compare-table', see: 'hàng tên cột Lane và Quay, các ô thẳng hàng và nút Buy' },
  ]);
  const report = lookReport({ shot: 'look.png', signals, ai });
  assert.equal(report.rows[0].verdict, 'agree');
  assert.equal(report.ready, true);
});

test('the component catalog has one list', () => {
  const kinds = lookKinds();
  const partIds = new Set(Object.values(PartKind));
  assert.deepEqual([...partIds].sort(), Object.keys(COMPONENTS).sort());
  for (const id of partIds) assert.equal(kinds.has(id), true, id);
  assert.equal(kinds.has('block'), true);
  for (const id of ['tabs_bar', 'pagination_carousel', 'thumb_scroll', 'price_card', 'dropdown_list']) {
    assert.equal(kinds.has(id), false, id);
  }
});
