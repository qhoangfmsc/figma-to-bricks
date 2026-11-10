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
  assert.equal(report.rows[2].verdict, 'agree');
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
  assert.match(md, /Tín hiệu: 5 tabs \(1:2\.layout\.mode\)/);
  assert.match(md, /Kết luận: không dựng menu/);
  assert.match(md, /guess:1:9`: drop/);
  assert.match(md, /guess:1:8`: attach/);
  assert.match(md, /Ảnh thấy form/);
  assert.match(md, /Tín hiệu: không có/);
  const kept = renderTemplatePlan(model, { 'part:1:1': 'đừng dựng nút này' });
  assert.match(kept, /đừng dựng nút này/);
});

test('an unknown kind is refused', () => {
  assert.throws(() => normalizeAi([{ node: '1', kind: 'widget', see: 'một khối lạ' }]), /không có trong danh sách/);
});
