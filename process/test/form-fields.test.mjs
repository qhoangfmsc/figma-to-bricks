import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRoot } from '../figma/normalize.mjs';
import { buildTemplate } from '../bricks/render/index.mjs';
import { detectForms } from '../detect/rules/form.mjs';
import { submissionName } from '../bricks/components/form.mjs';

const box = (x, y, w, h) => ({ x, y, width: w, height: h });
const text = (id, value, b) => ({
  id, name: id, type: 'TEXT', characters: value,
  absoluteBoundingBox: box(b.x, b.y, b.w, b.h),
  style: { fontFamily: 'Inter', fontSize: 14, fontWeight: 400, lineHeightPx: 20, textAlignHorizontal: 'LEFT' },
  fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2, a: 1 } }],
});
const input = (id, b, placeholder, name = 'Input') => ({
  id, name, type: 'FRAME',
  absoluteBoundingBox: box(b.x, b.y, b.w, b.h),
  layoutMode: 'HORIZONTAL',
  paddingTop: 8, paddingRight: 12, paddingBottom: 8, paddingLeft: 12,
  fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
  strokes: [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8, a: 1 } }],
  strokeWeight: 1,
  children: [text(`${id}t`, placeholder, { x: b.x + 12, y: b.y + 8, w: b.w - 24, h: 20 })],
});

function built(doc, params, title) {
  const tree = normalizeRoot({ nodes: { r: { document: doc } } }, 'r', { images: {}, svgs: {} });
  return buildTemplate(tree, {
    overrides: title ? { template: { title } } : {}, salt: 'form',
    detections: { version: 1, sections: [], components: [{ id: 'd1', component: 'form', node: 'frm', status: 'approved', params }] },
  });
}
const formOf = (b) => b.template.content.find((e) => e.name === 'form').settings;

test('each field keeps its own height and a short field keeps its share of the row', () => {
  const b = built({
    id: 'r', name: 'Section', type: 'FRAME',
    absoluteBoundingBox: box(0, 0, 480, 400),
    layoutMode: 'VERTICAL',
    children: [{
      id: 'frm', name: 'Contact', type: 'FRAME',
      absoluteBoundingBox: box(0, 0, 400, 300),
      layoutMode: 'VERTICAL', itemSpacing: 16,
      children: [
        text('l1', 'Email', { x: 0, y: 0, w: 80, h: 20 }),
        input('in1', { x: 0, y: 28, w: 400, h: 40 }, 'you@example.com'),
        input('in2', { x: 0, y: 84, w: 180, h: 56 }, 'Họ và tên'),
        input('in3', { x: 220, y: 84, w: 180, h: 56 }, 'Số điện thoại', 'Phone'),
        {
          id: 'btn', name: 'Submit', type: 'FRAME',
          absoluteBoundingBox: box(0, 156, 400, 44),
          layoutMode: 'HORIZONTAL',
          fills: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1, a: 1 } }],
          children: [text('bt', 'Gửi', { x: 180, y: 168, w: 40, h: 20 })],
        },
      ],
    }],
  }, {
    fields: [
      { node: 'in1', type: 'email', label: 'Email', placeholder: 'you@example.com', labelNode: 'l1' },
      { node: 'in2', type: 'text', placeholder: 'Họ và tên' },
      { node: 'in3', type: 'tel', placeholder: 'Số điện thoại' },
    ],
    submit: 'btn',
  });
  const s = formOf(b);
  assert.equal(s.fields[1].width, 45);
  assert.equal(s.fields[2].width, 45);
  assert.equal(s.fields[0].width, undefined);
  assert.match(s._cssCustom, /\.form-group:nth-child\(2\) input:not\(\[type=checkbox\]\) \{ height: 56px;/);
  assert.match(s._cssCustom, /column-gap: 40px/);
  assert.match(s._cssCustom, /\.form-group > \.label \{ margin-bottom: 16px/);
  assert.deepEqual(s.fieldMargin, { top: '0px', right: '0px', bottom: '16px', left: '0px' });
  assert.match(s._cssCustom, /max-width: 100%/);
});

test('submit saves the entry under the Figma file, the section and the form frame', () => {
  assert.equal(submissionName({ designTitle: 'LDP IT_PROSPEAK - Container', root: { name: 'Container' }, node: { name: 'Registration / Form' } }), 'LDP IT_PROSPEAK - Container / Registration / Form');
  assert.equal(submissionName({ root: { name: 'Container' }, node: { name: 'Container' } }), 'Container');
  const b = built({
    id: 'r', name: 'Container', type: 'FRAME',
    absoluteBoundingBox: box(0, 0, 400, 160),
    layoutMode: 'VERTICAL',
    children: [{
      id: 'frm', name: 'Registration / Form', type: 'FRAME',
      absoluteBoundingBox: box(0, 0, 400, 140),
      layoutMode: 'VERTICAL', itemSpacing: 12,
      children: [
        input('a', { x: 0, y: 0, w: 400, h: 40 }, 'Email'),
        input('b', { x: 0, y: 52, w: 400, h: 40 }, 'Phone'),
        { id: 'btn', name: 'Submit', type: 'FRAME', absoluteBoundingBox: box(0, 104, 120, 40), layoutMode: 'HORIZONTAL', children: [text('bt', 'Gửi', { x: 40, y: 112, w: 40, h: 20 })] },
      ],
    }],
  }, {
    fields: [{ node: 'a', type: 'email', placeholder: 'Email' }, { node: 'b', type: 'tel', placeholder: 'Phone' }],
    submit: 'btn',
    actions: ['save-submission'],
  }, 'LDP IT_PROSPEAK - Container');
  const s = formOf(b);
  assert.deepEqual(s.actions, ['save-submission']);
  assert.equal(s.submissionFormName, 'LDP IT_PROSPEAK - Container / Registration / Form');
});

test('a select shows the lines that were drawn and does not invent more', () => {
  const b = built({
    id: 'r', name: 'Section', type: 'FRAME',
    absoluteBoundingBox: box(0, 0, 400, 200),
    layoutMode: 'VERTICAL',
    children: [{
      id: 'frm', name: 'Contact', type: 'FRAME',
      absoluteBoundingBox: box(0, 0, 400, 160),
      layoutMode: 'VERTICAL', itemSpacing: 12,
      children: [
        input('city', { x: 0, y: 0, w: 400, h: 48 }, 'Hà Nội', 'City dropdown'),
        input('note', { x: 0, y: 60, w: 400, h: 40 }, 'Email'),
        {
          id: 'btn', name: 'Submit', type: 'FRAME',
          absoluteBoundingBox: box(0, 112, 400, 40),
          layoutMode: 'HORIZONTAL',
          children: [text('bt', 'Gửi', { x: 180, y: 120, w: 40, h: 20 })],
        },
      ],
    }],
  }, {
    fields: [
      { node: 'city', type: 'select', placeholder: 'Hà Nội', options: ['Hà Nội', 'Đà Nẵng'] },
      { node: 'note', type: 'email', placeholder: 'Email' },
    ],
    submit: 'btn',
  });
  const city = formOf(b).fields[0];
  assert.equal(city.type, 'select');
  assert.equal(city.options, 'Hà Nội\nĐà Nẵng');
  assert.equal(city.placeholder, 'Hà Nội');
});

test('a frame named dropdown is a select, and a closed list keeps that one line', () => {
  const tree = {
    id: 'r', name: 'Section', type: 'FRAME', visible: true, box: { x: 0, y: 0, w: 400, h: 200 },
    children: [{
      id: 'frm', name: 'Form', type: 'FRAME', visible: true, box: { w: 400, h: 180 },
      children: [
        { id: 'a', name: 'City dropdown', type: 'FRAME', visible: true, box: { w: 400, h: 48 }, fills: [{ type: 'SOLID' }], children: [{ id: 'at', type: 'TEXT', text: { characters: 'Hà Nội', lineHeightPx: 20 }, box: { h: 20 } }] },
        { id: 'b', name: 'Email', type: 'FRAME', visible: true, box: { w: 400, h: 48 }, fills: [{ type: 'SOLID' }], children: [{ id: 'bt', type: 'TEXT', text: { characters: 'Email' }, box: { h: 20 } }] },
        { id: 'go', name: 'Button', type: 'FRAME', visible: true, box: { w: 400, h: 40 }, children: [{ id: 'gt', type: 'TEXT', text: { characters: 'Gửi' }, box: { h: 20 } }] },
      ],
    }],
  };
  const found = detectForms(tree);
  assert.equal(found[0].params.fields[0].type, 'select');
  assert.deepEqual(found[0].params.actions, ['save-submission']);
  const closed = built({
    id: 'r', name: 'Section', type: 'FRAME',
    absoluteBoundingBox: box(0, 0, 400, 160),
    children: [{
      id: 'frm', name: 'Form', type: 'FRAME',
      absoluteBoundingBox: box(0, 0, 400, 140),
      layoutMode: 'VERTICAL', itemSpacing: 12,
      children: [
        input('city', { x: 0, y: 0, w: 400, h: 48 }, 'Hà Nội'),
        input('mail', { x: 0, y: 60, w: 400, h: 40 }, 'Email'),
        { id: 'btn', name: 'Submit', type: 'FRAME', absoluteBoundingBox: box(0, 112, 120, 40), layoutMode: 'HORIZONTAL', children: [text('bt', 'Gửi', { x: 40, y: 120, w: 40, h: 20 })] },
      ],
    }],
  }, { fields: [{ node: 'city', type: 'select', placeholder: 'Hà Nội' }, { node: 'mail', type: 'email', placeholder: 'Email' }], submit: 'btn' });
  const city = formOf(closed).fields[0];
  assert.equal(city.options, 'Hà Nội');
  assert.equal(city.placeholder, undefined);
});

test('save submission stays, a missing action is dropped, and a date field is a datepicker', () => {
  const tree = {
    id: 'r', name: 'Section', type: 'FRAME', visible: true, box: { w: 400, h: 200 },
    children: [{
      id: 'frm', name: 'Form', type: 'FRAME', visible: true, box: { w: 400, h: 180 },
      children: [
        { id: 'a', name: 'Ngày sinh', type: 'FRAME', visible: true, box: { w: 400, h: 48 }, fills: [{ type: 'SOLID' }], children: [{ id: 'at', type: 'TEXT', text: { characters: 'Ngày sinh' }, box: { h: 20 } }] },
        { id: 'b', name: 'Email', type: 'FRAME', visible: true, box: { w: 400, h: 48 }, fills: [{ type: 'SOLID' }], children: [{ id: 'bt', type: 'TEXT', text: { characters: 'Email' }, box: { h: 20 } }] },
        { id: 'go', name: 'Button', type: 'FRAME', visible: true, box: { w: 400, h: 40 }, children: [{ id: 'gt', type: 'TEXT', text: { characters: 'Gửi' }, box: { h: 20 } }] },
      ],
    }],
  };
  assert.equal(detectForms(tree)[0].params.fields[0].type, 'datepicker');
  const b = built({
    id: 'r', name: 'Section', type: 'FRAME',
    absoluteBoundingBox: box(0, 0, 400, 160),
    children: [{
      id: 'frm', name: 'Form', type: 'FRAME',
      absoluteBoundingBox: box(0, 0, 400, 140),
      layoutMode: 'VERTICAL', itemSpacing: 12,
      children: [
        input('day', { x: 0, y: 0, w: 400, h: 40 }, 'Ngày sinh'),
        input('mail', { x: 0, y: 52, w: 400, h: 40 }, 'Email'),
        { id: 'btn', name: 'Submit', type: 'FRAME', absoluteBoundingBox: box(0, 104, 120, 40), layoutMode: 'HORIZONTAL', children: [text('bt', 'Gửi', { x: 40, y: 112, w: 40, h: 20 })] },
      ],
    }],
  }, {
    fields: [{ node: 'day', type: 'step', placeholder: 'Ngày sinh' }, { node: 'mail', type: 'email', placeholder: 'Email', error: 'Sai email' }],
    submit: 'btn',
    actions: ['webhook', 'save-submission'],
  }, 'Landing - Hero');
  const s = formOf(b);
  assert.deepEqual(s.actions, ['save-submission']);
  assert.equal(s.submissionFormName, 'Landing - Hero / Form');
  assert.equal(s.fields[0].type, 'text');
  assert.equal(s.fields[0].errorMessage, undefined);
  assert.equal(s.fields[1].errorMessage, 'Sai email');
  assert.equal(s.fields[0].id.length, 6);
  assert.notEqual(s.fields[0].id, s.fields[1].id);
});

test('repeated inputs stay a form, and the submit button is not one of the fields', () => {
  const field = (id, label) => ({
    id, name: 'input', type: 'FRAME', visible: true, box: { w: 400, h: 48 }, fills: [{ type: 'SOLID' }],
    children: [{ id: `${id}t`, type: 'TEXT', text: { characters: label }, box: { h: 20 } }],
  });
  const tree = {
    id: 'r', name: 'Section', type: 'FRAME', visible: true, box: { w: 480, h: 400 },
    children: [{
      id: 'frm', name: 'Form', type: 'FRAME', visible: true, box: { w: 400, h: 360 },
      children: [
        field('a', 'Họ và Tên'),
        field('b', 'Email'),
        { id: 'btn', name: 'Button', type: 'FRAME', visible: true, box: { w: 400, h: 48 }, fills: [{ type: 'SOLID' }], children: [{ id: 'bt', type: 'TEXT', text: { characters: 'ĐĂNG KÝ NGAY' }, box: { h: 20 } }] },
      ],
    }],
  };
  const found = detectForms(tree);
  assert.deepEqual(found[0].params.fields.map((f) => f.node), ['a', 'b']);
  assert.equal(found[0].params.submit, 'btn');
  const doc = {
    id: 'r', name: 'Section', type: 'FRAME',
    absoluteBoundingBox: box(0, 0, 480, 400),
    layoutMode: 'VERTICAL',
    children: [{
      id: 'frm', name: 'Form', type: 'FRAME',
      absoluteBoundingBox: box(0, 0, 400, 360),
      layoutMode: 'VERTICAL', itemSpacing: 12,
      children: [
        input('a', { x: 0, y: 0, w: 400, h: 48 }, 'Họ và Tên', 'input'),
        input('b', { x: 0, y: 60, w: 400, h: 48 }, 'Email', 'input'),
        { id: 'btn', name: 'Button', type: 'FRAME', absoluteBoundingBox: box(0, 120, 400, 48), fills: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1, a: 1 } }], layoutMode: 'HORIZONTAL', children: [text('bt', 'ĐĂNG KÝ NGAY', { x: 140, y: 132, w: 120, h: 20 })] },
      ],
    }],
  };
  const normalized = normalizeRoot({ nodes: { r: { document: doc } } }, 'r', { images: {}, svgs: {} });
  const b = buildTemplate(normalized, {
    overrides: { template: { title: 'LDP IT_PROSPEAK - Section' } }, salt: 'form',
    detections: { version: 1, sections: [], components: [
      { id: 'd1', component: 'form', node: 'frm', status: 'approved', params: { fields: [{ node: 'a', type: 'text', placeholder: 'Họ và Tên' }, { node: 'b', type: 'email', placeholder: 'Email' }, { node: 'btn', type: 'text', placeholder: 'ĐĂNG KÝ NGAY' }], submit: 'btn', actions: ['save-submission'] } },
      { id: 'd2', component: 'semantic', node: 'frm', status: 'approved', params: { tag: 'ul', itemTag: 'li' } },
    ] },
  });
  const form = b.template.content.find((e) => e.name === 'form');
  assert.ok(form);
  assert.deepEqual(form.settings.fields.map((f) => f.placeholder), ['Họ và Tên', 'Email']);
  assert.deepEqual(form.settings.fields.map((f) => f.label), ['Họ và Tên', 'Email']);
  assert.equal(form.settings.showLabels, undefined);
  assert.deepEqual(form.settings.actions, ['save-submission']);
  assert.equal(form.settings.submissionFormName, 'LDP IT_PROSPEAK - Section / Form');
});
