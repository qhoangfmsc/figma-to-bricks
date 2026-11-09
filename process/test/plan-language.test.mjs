import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choiceOf, resolvePlan } from '../modules/missing-content/choices.mjs';
import { applyAnswers } from '../modules/missing-content/index.mjs';
import { schemaTraps } from '../modules/write-bricks/render/utils/schema-traps.mjs';

// The sentences are what an owner might type. The code does not contain them.
// The choice next to each sentence is the reading of that sentence, written the way the chat writes choices.json.
const spoken = [
  ['type:root', 'cái khung này là hộp thoại, bấm ra ngoài là đóng', { choice: 'popup' }],
  ['mobileform:row', 'dưới điện thoại vẫn là thanh trượt từng tấm, đừng biến thành hàng kéo', { choice: 'slider', note: 'dưới điện thoại vẫn là thanh trượt từng tấm' }],
  ['part:btn', 'nút này giữ lại, đúng là nút', { choice: 'keep' }],
  ['part:old', 'xóa', { choice: 'drop' }],
  ['guess:card', 'khối này thôi, đừng gắn component', { choice: 'drop' }],
  ['repeat:list', 'mấy dòng này là câu hỏi, bấm để mở', { choice: 'accordion' }],
  ['confirm:faq', 'đúng rồi, đây là mục hỏi đáp', { choice: 'accordion' }],
  ['loop:row', 'chạy hết thì quay lại tấm đầu', { choice: 'wrap' }],
  ['autoplay:row', 'đừng tự chạy', { choice: 'off' }],
  ['link:btn', 'chưa có địa chỉ', { choice: 'empty' }],
  ['alt:pic', 'ảnh trang trí, không cần chữ thay', { choice: 'decorative' }],
  ['answer:q2', 'câu trả lời để trống', { choice: 'empty' }],
  ['act:more', 'bấm thì xổ thêm chữ đang bị cắt', { choice: 'expand' }],
];

function memory(files) {
  const box = structuredClone(files);
  return {
    readJson(name, fallback) { return name in box ? box[name] : fallback; },
    writeJson(name, value) { box[name] = value; },
  };
}

test('a Vietnamese sentence is not a choice, and the reading of that sentence is', () => {
  const raw = Object.fromEntries(spoken.map(([key, text]) => [key, text]));
  const choices = Object.fromEntries(spoken.map(([key, , choice]) => [key, choice]));
  for (const [, text] of spoken) {
    for (const group of ['type', 'part', 'guess', 'repeat', 'mobileform', 'confirm', 'loop', 'autoplay', 'link', 'alt', 'answer', 'act']) {
      assert.equal(choiceOf(group, text), null);
    }
  }
  const unread = resolvePlan(raw);
  assert.equal(unread.open.length, spoken.length);
  assert.equal(Object.keys(unread.ready).length, 0);
  const read = resolvePlan(raw, choices);
  assert.deepEqual(read.open, []);
  for (const [key, , choice] of spoken) assert.equal(read.ready[key].choice, choice.choice);
});

test('those readings change the template the way the sentence asked', () => {
  const tree = {
    id: 'root',
    children: [
      { id: 'row', children: [] },
      { id: 'list', children: [] },
      { id: 'card', children: [] },
      { id: 'faq', children: [{ id: 'q2', children: [] }] },
    ],
  };
  const ws = memory({
    'tree.json': tree,
    'overrides.json': { nodes: { pic: { alt: '' } } },
    'detections.json': {
      components: [
        { id: 'c1', component: 'carousel', node: 'row', status: 'approved', params: {} },
        { id: 'c2', component: 'button', node: 'btn', status: 'approved', params: {} },
        { id: 'c8', component: 'button', node: 'old', status: 'approved', params: {} },
        { id: 'c3', component: 'accordion', node: 'card', status: 'proposed', params: {} },
        { id: 'c4', component: 'form', node: 'list', status: 'proposed', params: {} },
        { id: 'c5', component: 'accordion', node: 'faq', status: 'proposed', params: {} },
        { id: 'c6', component: 'button', node: 'more', status: 'approved', params: {} },
        { id: 'c7', component: 'readmore', node: 'clip', status: 'approved', params: { button: 'more' } },
      ],
    },
  });
  const choices = Object.fromEntries(spoken.map(([key, , choice]) => [key, choice]));
  const { applied, unused } = applyAnswers(ws, choices);
  assert.deepEqual(unused, []);
  assert.ok(applied.includes('type:root'));
  const ov = ws.readJson('overrides.json');
  const det = ws.readJson('detections.json');
  assert.equal(ov.template.type, 'popup');
  const slide = det.components.find((c) => c.id === 'c1');
  assert.equal(slide.params.mobileForm, 'slider');
  assert.equal(slide.params.settings.autoplay, false);
  assert.equal(slide.params.settings.type, 'loop');
  assert.equal(det.components.find((c) => c.id === 'c2').params.link, '#');
  assert.equal(det.components.find((c) => c.id === 'c8').status, 'rejected');
  assert.equal(det.components.find((c) => c.id === 'c3').status, 'rejected');
  assert.equal(det.components.find((c) => c.id === 'c4').status, 'proposed');
  assert.equal(det.components.find((c) => c.id === 'c5').status, 'approved');
  assert.equal(det.components.find((c) => c.node === 'list' && c.component === 'accordion').status, 'approved');
  assert.equal(det.components.find((c) => c.id === 'c7').params.buttonMode, 'toggle');
  assert.equal(ov.nodes.pic.alt, '');
});

test('a line break keeps a space so hiding the break does not glue two words', () => {
  const glued = schemaTraps([{ id: 't', name: 'heading', settings: { text: 'VIỆT NAM<br>TỐC' } }]);
  assert.equal(glued[0].key, 'text');
  const kept = schemaTraps([{ id: 't', name: 'heading', settings: { text: 'VIỆT NAM <br>TỐC' } }]);
  assert.equal(kept.length, 0);
});
