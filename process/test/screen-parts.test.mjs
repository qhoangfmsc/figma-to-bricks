import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { screenParts } from '../modules/single-template/parts.mjs';
import { validateAnswers, applyAnswers, readExpand } from '../modules/missing-content/index.mjs';
import { graftExpand } from '../modules/single-template/expand.mjs';
import readmore from '../modules/write-bricks/components/readmore.mjs';
import button from '../modules/write-bricks/components/button.mjs';

const tree = {
  id: 'root', name: 'SEO', children: [
    { id: 'full', name: 'Full section', children: [{ id: 'h', type: 'TEXT', text: { characters: 'Tiêu đề' } }] },
    { id: 'btn', name: 'Button', children: [{ id: 'bt', type: 'TEXT', text: { characters: 'Xem thêm' } }] },
    { id: 'list', name: 'Mục lặp', children: [] },
  ],
};
const components = [
  { component: 'readmore', node: 'full', status: 'approved', params: { button: 'btn' } },
  { component: 'button', node: 'btn', status: 'approved', params: {} },
  { component: 'semantic', node: 'list', status: 'approved', params: {} },
  { component: 'flat-image', node: 'pic', status: 'approved', params: {} },
];

test('step 2 lists one block per component, with the field that block needs', () => {
  const parts = screenParts(tree, components, [], 'FILEKEY');
  assert.deepEqual(parts.filter((p) => p.fields.length).map((p) => [p.fields[0].title, p.fields[0].value]), [
    ['Bấm Xem thêm thì hiện thêm chữ gì?', '[Chưa có value]'],
    ['Bấm Xem thêm thì chuyện gì xảy ra?', 'Bấm để hiện hết chữ'],
    ['Khối Mục lặp giữ nguyên như bản vẽ', 'Dựng thành một khối tĩnh'],
  ]);
  assert.deepEqual(parts.filter((p) => !p.fields.length).map((p) => p.kind), ['Ảnh']);
  assert.equal(parts[0].fields[0].control, 'textarea');
  assert.match(parts[0].fields[0].placeholder, /link khung đã mở hết/);
  assert.equal(parts[1].fields[0].control, 'select');
  assert.deepEqual(parts[1].fields[0].options, ['Bấm để hiện hết chữ', 'Bấm để mở một địa chỉ']);
  assert.equal(validateAnswers(Object.fromEntries(parts.flatMap((p) => p.fields.map((f) => [f.key, f.value])))).length, 0);
  assert.equal(validateAnswers({ 'act:b': 'mở phần chữ bị cắt', 'act:d': 'https://vietnix.vn/vps', 'expand:e': 'dùng chữ đang bị cắt', 'keep:k': 'giữ block' }).length, 0);
  assert.equal(validateAnswers({ 'act:c': 'Bấm không làm gì' }).length, 0);
  assert.equal(validateAnswers({ 'act:b': 'https://www.figma.com/design/abc' }).length, 1);
  assert.equal(validateAnswers({ 'act:b': 'Bấm để mở một địa chỉ' }).length, 0);
  assert.equal(validateAnswers({ 'expand:full': 'Đoạn chữ thêm khi mở.' }).length, 0);
  assert.equal(validateAnswers({ 'expand:full': 'https://www.figma.com/design/FILE/x?node-id=9-9' }).length, 0);
  assert.equal(readExpand('https://www.figma.com/design/FILE/x').kind, 'bad');
});

test('a form with nothing to type is still listed, with the fields and the submit it recognized', () => {
  const formTree = {
    id: 'root', name: 'f-w', children: [
      { id: 'left', name: '1', children: [{ id: 'go', name: 'Button', children: [{ id: 'gt', type: 'TEXT', text: { characters: 'Gửi thông tin' } }] }] },
    ],
  };
  const parts = screenParts(formTree, [{
    component: 'form', node: 'left', status: 'approved',
    params: { fields: [{ label: 'Họ tên của bạn' }, { placeholder: 'Email' }], submit: 'go' },
  }], [], 'FILE');
  assert.equal(parts.length, 1);
  assert.equal(parts[0].kind, 'Form');
  assert.equal(parts[0].name, '1');
  assert.equal(parts[0].fields.length, 0);
  assert.match(parts[0].detail, /Họ tên của bạn/);
  assert.match(parts[0].detail, /Email/);
  assert.match(parts[0].detail, /nút Gửi thông tin/);
});

test('typed expand copy is hidden until open; a full frame is grafted under the clipped frame', () => {
  const node = { id: 'full', name: 'Full', children: [{ id: 't', type: 'TEXT', text: { characters: 'Đoạn đầu' } }] };
  const added = readmore.descendants(node, { params: { button: 'btn', expand: { kind: 'text', text: 'Phần thêm' } } }, { root: node });
  assert.equal(added.full.extraChildren[0].text, 'Phần thêm');
  assert.match(added.full.css.map((c) => c.suffix).join(' '), /read-more-added/);
  const host = { id: 'full', children: [{ id: 't' }] };
  const id = graftExpand(host, 'full', { id: '9:9', name: 'Mở', children: [{ id: 'p', type: 'TEXT' }] });
  assert.equal(host.children.at(-1).openRoot, true);
  const box = { x: 0, y: 0, w: 100, h: 40, absX: 0, absY: 0 };
  const frame = (id, extra) => ({ id, name: id, type: 'FRAME', visible: true, box, sizing: { h: 'HUG', v: 'HUG' }, children: [], ...extra });
  const pad = { top: 0, right: 0, bottom: 0, left: 0 };
  const built = buildTemplate(frame('root', { layout: { mode: 'VERTICAL', padding: pad }, children: [frame('full', { openRoot: true, openOnly: true, place: 'FLOW', layout: { mode: 'VERTICAL', padding: pad } })] }), {});
  const full = built.template.content.find((e) => e.label === 'full');
  assert.equal(full.settings._display, 'none');
  assert.match(full.settings._cssClasses, /read-more-full/);
  assert.equal(host.children.at(-1).id, id);
  assert.equal(host.children[0].id, 't');
});

test('the collapse button drawn in the full frame is the open state of Xem thêm, and a button with no fill stays clear', () => {
  const label = (id, text) => ({ id, type: 'TEXT', sizing: { v: 'HUG', h: 'HUG' }, text: { characters: text, fontFamily: 'Inter', fontSize: 16, fontWeight: 500, lineHeightPx: 24, align: 'LEFT' }, box: { h: 24, w: 80, x: 0, y: 0, absX: 0, absY: 0 }, fills: [{ type: 'SOLID', hex: '#282829', alpha: 1 }] });
  const closed = { id: 'btn', name: 'Button', type: 'INSTANCE', children: [label('bt', 'Xem thêm')] };
  const openBtn = { id: 'up', name: 'Button', type: 'INSTANCE', children: [label('ut', 'Thu gọn')] };
  const frame = { id: 'full', name: 'Full', clip: true, children: [{ id: 'body', openRoot: true, type: 'FRAME', children: [openBtn] }] };
  const root = { id: 'root', name: 'SEO', children: [frame, closed] };
  assert.deepEqual(readmore.mergedNodes({}, frame), ['up']);
  const out = readmore.descendants(frame, { params: { button: 'btn' } }, { root });
  assert.match(out.btn.settings.text, /rm-closed">Xem thêm/);
  assert.match(out.btn.settings.text, /rm-open">Rút gọn/);
  assert.equal(out.btn.settings._background.color.raw, 'transparent');
  assert.match(out.btn.css[0].decl, /background-color: transparent/);
  assert.match(out.full.css.map((c) => c.suffix).join('\n'), /read-more-open ~ \.read-more-toggle svg/);
  const plain = { id: 'more', name: 'More', clip: true, children: [{ id: 'copy', type: 'TEXT', text: { characters: 'Body' } }] };
  const see = { id: 'go', name: 'Button', type: 'INSTANCE', children: [label('gt', 'See more')] };
  const bare = readmore.descendants(plain, { params: { button: 'go' } }, { root: { id: 'page', name: 'Page', children: [plain, see] } });
  assert.match(bare.go.settings.text, /rm-closed">See more/);
  assert.match(bare.go.settings.text, /rm-open">Rút gọn/);
  assert.equal(bare.go.settings._background.color.raw, 'transparent');
  const s = {};
  button.apply({ node: { ...closed, fills: undefined, layout: { gap: 8, primaryAlign: 'CENTER' } }, s, css: {}, warn() {} }, { params: { link: '#' } });
  assert.equal(s._background.color.raw, 'transparent');
  assert.match(s._cssCustom, /background-color: transparent/);
});

test('a readmore button set to "không làm gì" does not toggle; the default still does', () => {
  const node = { id: 'full', name: 'Full', children: [{ id: 't', type: 'TEXT', text: { characters: 'Xem thêm' } }] };
  const open = readmore.descendants(node, { params: { button: 'btn' } }, { root: node });
  assert.equal(open.btn.settings.tag, 'button');
  assert.equal(open.btn.settings._interactions[0].action, 'toggleAttribute');
  const still = readmore.descendants(node, { params: { button: 'btn', buttonMode: 'none' } }, { root: node });
  assert.equal(still.btn.settings.tag, 'span');
  assert.equal(still.btn.settings._interactions, undefined);
  assert.equal(typeof applyAnswers, 'function');
});
