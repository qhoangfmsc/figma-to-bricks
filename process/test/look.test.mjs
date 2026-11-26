import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAiDecisions, applyPictureToVariant, holdForPicture, lookReport, normalizeAi, signalRows } from '../modules/build-steps/template/look.mjs';
import { PartKind, childId, lookKinds } from '../modules/recognize-parts/kinds.mjs';
import { renderTemplatePlan } from '../modules/build-steps/template/plan-doc.mjs';
import { COMPONENTS } from '../modules/write-bricks/components/index.mjs';

const tab = {
  node: '1:1', component: PartKind.TAB_SWITCH, status: 'approved', evidence: '5 tabs',
  cite: [{ node: '1:2', field: 'layout.mode', equals: 'HORIZONTAL' }],
};

test('a plan is not ready until the picture has a reading', () => {
  const report = lookReport({ shot: 'look.png', signals: signalRows([tab]), ai: null });
  assert.equal(report.ready, false);
  assert.equal(report.rows.length, 0);
  assert.deepEqual(signalRows([tab])[0].cite, ['1:2.layout.mode']);
  const md = renderTemplatePlan({
    title: 'T', name: 'S', width: 100,
    parts: [{ kind: 'Tabs Component', name: 'Title', node: '1:1', fields: [] }],
    look: report,
  });
  assert.match(md, /## Chứng cứ\n!\[[^\]]*\]\(look\.png\)\nNhận dạng từ ảnh chưa đủ/);
  assert.match(md, /chưa phải bản để xác nhận/);
  assert.match(md, /Nhận dạng từ ảnh chưa đủ/);
  assert.doesNotMatch(md, /part:1:1/);
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
  assert.deepEqual(report.rows.map((row) => row.kind), ['tab-switch', 'button']);
  assert.equal(report.rows[0].verdict, 'render');
  assert.equal(report.rows[0].weight.total, 100);
  assert.equal(report.extras.length, 2);
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
  assert.match(md, /Các component này sẽ được dựng/);
  assert.match(md, /Kết luận: dựng tab-switch/);
  assert.match(md, /một hàng chip, một chip đang chọn/);
  assert.match(md, /### button `1:8`/);
  assert.doesNotMatch(md, /## Chưa chắc/);
  assert.doesNotMatch(md, /nghi ngờ/);
  assert.doesNotMatch(md, /guess:1:9/);
  assert.doesNotMatch(md, /AI 70%/);
  assert.match(md, /Ảnh thấy form/);
  assert.doesNotMatch(md, /dựng form/);
  assert.match(md, /Xác nhận: không/);
  assert.doesNotMatch(md, /Quyết định dựng/);
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
  assert.equal(report.rows[0].verdict, 'render');
  assert.equal(report.rows[0].parts.tabs_bar, '1:1');
  assert.equal(report.rows[0].parts.tabs_data, null);
  assert.equal(report.ready, true);
  assert.throws(() => normalizeAi([{ node: '1', kind: 'tabs_bar', see: 'một hàng tab' }]), /không có trong danh sách/);
});

test('a part the picture does not name stays out of the detected list', () => {
  const slider = {
    node: 's', component: PartKind.CAROUSEL, status: 'approved', evidence: 'two rows and a dash row',
    cite: [{ node: 'dots', field: 'svg' }],
    params: { pagination: 'dots', prev: 'pv' },
  };
  const signals = signalRows([slider]);
  assert.equal(signals[0].children[0].node, 'dots');
  const ai = normalizeAi([{ node: 's', kind: 'carousel', see: 'hàng card và hàng gạch' }]);
  const report = lookReport({ shot: 'look.png', signals, ai });
  assert.equal(report.rows[0].review, 'render');
  assert.equal(report.rows[0].children.length, 0);
  const md = renderTemplatePlan({
    title: 'T', name: 'S', width: 100,
    parts: [{ kind: 'Slider', name: 'Reviews', node: 's', fields: [] }],
    look: report,
  });
  assert.match(md, /## Component Detected/);
  assert.match(md, /### carousel `s`/);
  assert.doesNotMatch(md, /nghi ngờ/);
  assert.doesNotMatch(md, /Pagination: `dots`/);
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
  assert.equal(report.rows[0].verdict, 'render');
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
  assert.equal(report.rows[0].verdict, 'render');
  assert.equal(report.ready, true);
});

test('a measured component stays proposed until the picture names it, and the phone frame follows that name', () => {
  const measured = [
    { component: PartKind.ACCORDION, node: 'list', status: 'approved', source: 'rule', params: { content: { answers: { q: 'Nine' } } } },
    { component: PartKind.BUTTON, node: 'buy', status: 'approved', source: 'human', params: {} },
  ];
  holdForPicture(measured);
  assert.equal(measured[0].status, 'proposed');
  assert.equal(measured[0].params.content.answers.q, 'Nine');
  assert.equal(measured[1].status, 'approved');
  const phone = [
    { component: PartKind.ACCORDION, node: 'mlist', status: 'proposed', params: {} },
    { component: PartKind.BUTTON, node: 'mbuy', status: 'proposed', params: {} },
  ];
  applyPictureToVariant(
    [{ component: PartKind.ACCORDION, node: 'list', status: 'approved' }],
    phone,
    new Map([['list', 'mlist']]),
  );
  assert.equal(phone[0].status, 'approved');
  assert.equal(phone[1].status, 'rejected');
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

import { renderTemplatePlan as renderPlanDoc } from '../modules/build-steps/template/plan-doc.mjs';

test('every part the owner decides on has a decision line that starts as agreed and keeps what the owner wrote', () => {
  const model = {
    title: 'Sample', name: 'Sample', width: 1000, variants: [], open: [], repeats: [], blocks: [], templateType: { key: 'type:r', value: 'section' },
    parts: [{ node: '9:1', name: 'Gallery row', kind: 'Gallery', fields: [] }, { node: '9:2', name: 'Other', kind: 'Link', fields: [] }],
  };
  const fresh = renderPlanDoc(model, {});
  assert.match(fresh, /- Quyết định `part:9:1`: Đồng ý/);
  assert.match(fresh, /- Quyết định `part:9:2`: Đồng ý/);
  const edited = renderPlanDoc(model, { 'part:9:2': 'không' });
  assert.match(edited, /- Quyết định `part:9:2`: không/);
  assert.match(edited, /- Quyết định `part:9:1`: Đồng ý/);
});
