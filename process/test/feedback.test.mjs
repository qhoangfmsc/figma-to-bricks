import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFeedback } from '../template/feedback.mjs';
import { validate } from '../detect/index.mjs';

const card = (id, name) => ({ id, name, type: 'INSTANCE', visible: true, componentSet: 'Slider Item TLD', children: [] });
const tree = {
  id: 'root', name: 'Banner', children: [
    {
      id: 'row', name: 'Frame 1000002508', type: 'FRAME', layout: { mode: 'HORIZONTAL', wrap: false, gap: 16 },
      children: [card('a', 'Component 10'), card('b', 'Slider Item TLD'), card('c', 'Component 12'), card('d', 'Component 13')],
    },
    {
      id: 'faq', name: 'FAQ', type: 'FRAME', layout: { mode: 'VERTICAL', wrap: false },
      children: [
        { id: 'q1', name: 'Item', type: 'FRAME', children: [] },
        { id: 'q2', name: 'Item', type: 'FRAME', children: [] },
      ],
    },
  ],
};
const detections = {
  sections: [],
  components: [
    { id: 'd3', status: 'approved', source: 'ai', component: 'semantic', node: 'row', cite: [{ node: 'row', field: 'name', equals: 'Frame 1000002508' }], params: { tag: 'ul', itemTag: 'li' } },
    { id: 'd4', status: 'approved', source: 'ai', component: 'semantic', node: 'faq', cite: [{ node: 'faq', field: 'name', equals: 'FAQ' }], params: { tag: 'ul', itemTag: 'li' } },
  ],
};

test('a loose sentence turns the repeated row into a slider and can name another part', () => {
  const out = applyFeedback(tree, detections, 'phần này là carousel, phần faq là accordion');
  assert.deepEqual(out.applied, [
    { name: 'Frame 1000002508', component: 'carousel' },
    { name: 'FAQ', component: 'accordion' },
  ]);
  assert.equal(out.unknown, false);
  const row = out.detections.components.find((c) => c.node === 'row');
  const faq = out.detections.components.find((c) => c.node === 'faq');
  assert.equal(row.component, 'carousel');
  assert.equal(row.status, 'approved');
  assert.equal(faq.component, 'accordion');
  assert.deepEqual(validate(out.detections, tree), []);
});

test('a sentence can point a button at a page, name an image, or set how fast a slider runs', () => {
  const spoken = {
    id: 'root', name: 'Page', children: [
      { id: 'go', name: 'Button', type: 'INSTANCE', componentSet: 'Button', children: [{ id: 'gt', type: 'TEXT', text: { characters: 'Gửi thông tin' } }] },
      { id: 'pic', name: 'Group 1000002111', type: 'GROUP', children: [] },
      { id: 'row', name: 'Slider', type: 'FRAME', layout: { mode: 'HORIZONTAL' }, children: [] },
    ],
  };
  const det = {
    sections: [],
    components: [
      { id: 'd1', status: 'approved', component: 'button', node: 'go', params: {} },
      { id: 'd2', status: 'approved', component: 'flat-image', node: 'pic', params: {} },
      { id: 'd3', status: 'approved', component: 'carousel', node: 'row', params: {} },
    ],
  };
  const link = applyFeedback(spoken, det, 'nút Gửi thông tin cho mở trang vietnix.vn/tu-van');
  assert.equal(link.unknown, false);
  assert.equal(link.detections.components.find((c) => c.node === 'go').params.link, 'https://vietnix.vn/tu-van');
  const alt = applyFeedback(spoken, det, 'ảnh bên phải là logo Vietnix');
  assert.equal(alt.detections.components.find((c) => c.node === 'pic').params.alt, 'logo Vietnix');
  const speed = applyFeedback(spoken, det, 'cái slider chạy mỗi 4 giây');
  const slider = speed.detections.components.find((c) => c.node === 'row');
  assert.equal(slider.params.autoplay, true);
  assert.equal(slider.params.settings.interval, 4000);
  const stop = applyFeedback(spoken, det, 'đừng cho slider tự chạy');
  assert.equal(stop.detections.components.find((c) => c.node === 'row').params.autoplay, false);
});

test('a sentence that does not name a carousel is left unused', () => {
  const out = applyFeedback(tree, detections, 'chữ tìm kiếm đậm hơn');
  assert.equal(out.unknown, true);
  assert.deepEqual(out.applied, []);
  assert.equal(out.detections.components[0].component, 'semantic');
});

const icon = (id) => ({ id, name: 'Icon', type: 'INSTANCE', visible: true, box: { w: 24, h: 24 }, children: [{ id: `${id}v`, name: 'Vector', type: 'VECTOR', visible: true, box: { w: 16, h: 16 } }] });
const labeled = (id, label, placeholder, y, h = 44) => ({
  id: `${id}row`, name: 'Text input', type: 'FRAME', visible: true, box: { y, w: 526, h: h + 34 },
  children: [
    {
      id: `${id}label`, name: 'Label', type: 'INSTANCE', visible: true, componentSet: 'Label', box: { y, w: 140, h: 30 },
      children: [
        { id: `${id}lt`, name: 'Label', type: 'TEXT', visible: true, box: { y, w: 120, h: 30 }, text: { characters: label } },
        { id: `${id}star`, name: '*', type: 'TEXT', visible: true, box: { y, w: 8, h: 24 }, text: { characters: '*' } },
      ],
    },
    {
      id, name: 'Input field', type: 'FRAME', visible: true, box: { y: y + 34, w: 526, h },
      fills: [{ type: 'SOLID', color: '#ffffff' }],
      children: [
        icon(`${id}i`),
        { id: `${id}t`, name: 'Placeholder', type: 'TEXT', visible: true, box: { y: y + 40, w: 400, h: 24 }, text: { characters: placeholder } },
      ],
    },
    { id: `${id}help`, name: 'Helper text', type: 'TEXT', visible: true, box: { y: y + h + 40, w: 200, h: 24 }, text: { characters: 'Helper text' } },
  ],
});

test('a spoken description of the fields is enough to mark that block as a form', () => {
  const spoken = {
    id: 'root', name: 'f-w', children: [
      {
        id: 'left', name: '1', type: 'FRAME', visible: true, box: { w: 558, h: 676 },
        children: [
          labeled('name', 'Họ tên của bạn', 'Nhập họ và tên', 24),
          labeled('phone', 'Số điện thoại', '(+84) 123 456 789', 122),
          {
            id: 'go', name: 'Button', type: 'INSTANCE', visible: true, componentSet: 'Button', box: { y: 220, w: 178, h: 44 },
            children: [{ id: 'got', name: 'Button', type: 'TEXT', visible: true, box: { y: 230, w: 114, h: 30 }, text: { characters: 'Gửi thông tin' } }],
          },
        ],
      },
      { id: 'pic', name: 'Group 1000002111', type: 'GROUP', visible: true, box: { w: 701, h: 495 }, children: [] },
    ],
  };
  const out = applyFeedback(spoken, { sections: [], components: [] }, 'Phần section chính bên trái chứa các thông tin như Họ và Tên,.. là một cái form');
  assert.equal(out.unknown, false);
  assert.deepEqual(out.applied, [{ name: '1', component: 'form' }]);
  const form = out.detections.components.find((c) => c.node === 'left');
  assert.equal(form.params.submit, 'go');
  assert.equal(form.params.fields[0].label, 'Họ tên của bạn');
  assert.equal(form.params.fields[0].placeholder, 'Nhập họ và tên');
  assert.equal(form.params.fields[0].node, 'name');
  assert.equal(form.params.fields[1].type, 'tel');
  assert.deepEqual(validate(out.detections, spoken), []);
});

test('a row that is already a carousel is not changed again', () => {
  const done = { sections: [], components: [{ id: 'd3', status: 'approved', component: 'carousel', node: 'row', params: { pagination: 'p' } }] };
  const out = applyFeedback(tree, done, 'các phần kia là carousel');
  assert.deepEqual(out.applied, []);
  assert.equal(out.detections.components[0].params.pagination, 'p');
});
