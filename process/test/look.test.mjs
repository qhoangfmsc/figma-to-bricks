import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookReport, normalizeAi, signalRows } from '../modules/single-template/look.mjs';
import { renderTemplatePlan } from '../modules/single-template/plan-doc.mjs';

const tab = {
  node: '1:1', component: 'tab-switch', status: 'approved', evidence: '5 tabs',
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
    { node: '1:9', component: 'menu', status: 'proposed', evidence: '3 links', cite: [] },
    { node: '1:8', component: 'button', status: 'proposed', evidence: 'one label', cite: [] },
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
  assert.equal(report.rows[1].verdict, 'differ');
  assert.equal(report.rows[2].verdict, 'doubt');
  assert.equal(report.rows[2].review, 'doubt');
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
  assert.match(md, /## Chứng cứ\n!\[[^\]]*\]\(look\.png\)\nẢnh, nhận dạng từ ảnh/);
  assert.match(md, /Kết luận: dựng tab-switch/);
  assert.match(md, /Review: tin được/);
  assert.match(md, /Tín hiệu: 5 tabs \(1:2\.layout\.mode\)/);
  assert.match(md, /Kết luận: không dựng menu/);
  assert.match(md, /Review: lệch/);
  assert.match(md, /guess:1:9`: drop/);
  assert.doesNotMatch(md, /guess:1:8`: attach/);
  assert.match(md, /Review: nghi ngờ/);
  assert.match(md, /Ảnh thấy form/);
  assert.match(md, /Tín hiệu: không có/);
  const kept = renderTemplatePlan(model, { 'part:1:1': 'đừng dựng nút này' });
  assert.match(kept, /đừng dựng nút này/);
});

test('a picture that names a part of the component agrees with that component', () => {
  const signals = signalRows([tab, { node: '1:4', component: 'thumb_scroll', status: 'proposed', evidence: 'the thumb', cite: [] }]);
  assert.equal(signals.some((row) => row.kind === 'thumb_scroll'), false);
  const ai = normalizeAi([{ node: '1:1', kind: 'tabs_bar', see: 'một hàng, một tab đang chọn, các tab còn lại nghỉ' }]);
  const report = lookReport({ shot: 'look.png', signals, ai });
  assert.equal(report.rows[0].verdict, 'agree');
  assert.equal(report.rows[0].review, 'trust');
  assert.equal(report.ready, true);
});

test('a detected child stays a doubt until the picture and the structure both name it', () => {
  const slider = {
    node: 's', component: 'carousel', status: 'approved', evidence: 'two rows and a dash row',
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
