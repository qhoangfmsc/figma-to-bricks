import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shareAccordionAnswers, shareFilledContent } from '../plan/index.mjs';

const text = (id, value) => ({ id, name: id, type: 'TEXT', text: { characters: value }, children: [] });
const item = (id, name, question) => ({ id, name, children: [{ id: `${id}-title`, name: 'Title', children: [text(`${id}-t`, question)] }] });
const tree = (id, accId, rows) => ({ id, name: 'Section', children: [{ id: accId, name: 'FAQ', children: rows }] });

function writeWs(dir, treeJson, det) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'tree.json'), JSON.stringify(treeJson));
  writeFileSync(join(dir, 'detections.json'), JSON.stringify(det));
}

test('a desktop FAQ answer is copied onto the matching mobile item', () => {
  const root = mkdtempSync(join(tmpdir(), 'acc-share-'));
  try {
    const desk = join(root, 'desk');
    const mob = join(root, 'mob');
    const tab = join(root, 'tab');
    writeWs(desk, tree('root', 'acc', [item('q1', 'Row', 'Câu 1'), item('q2', 'Row', 'Câu 2')]), {
      components: [{ id: 'd1', component: 'accordion', status: 'approved', node: 'acc', params: { content: { answers: { q1: 'Trả lời 1', q2: 'Trả lời 2' } } } }],
    });
    writeFileSync(join(desk, 'responsive.json'), JSON.stringify({
      variants: [
        { key: 'mobile_portrait', workspace: 'mob', maxWidth: 478 },
        { key: 'tablet_portrait', workspace: 'tab', maxWidth: 991 },
      ],
    }));
    writeWs(mob, tree('mroot', 'macc', [item('mq1', 'Row', 'Câu 1'), item('mq2', 'Row', 'Câu 2')]), {
      components: [{ id: 'd1', component: 'accordion', status: 'approved', node: 'macc', params: {} }],
    });
    writeWs(tab, tree('troot', 'tacc', [item('tq1', 'Mục A', 'Câu 1'), item('tq2', 'Mục B', 'Câu 2')]), {
      components: [{ id: 'd1', component: 'accordion', status: 'approved', node: 'tacc', params: { content: { answers: { tq2: 'Giữ câu của tablet' } } } }],
    });
    const base = {
      dir: desk,
      readJson: (name, fallback) => {
        try { return JSON.parse(readFileSync(join(desk, name), 'utf8')); } catch { return fallback; }
      },
    };
    assert.equal(shareAccordionAnswers(base).copied, 3);
    const mobile = JSON.parse(readFileSync(join(mob, 'detections.json'), 'utf8'));
    assert.deepEqual(mobile.components[0].params.content.answers, { mq1: 'Trả lời 1', mq2: 'Trả lời 2' });
    const tablet = JSON.parse(readFileSync(join(tab, 'detections.json'), 'utf8'));
    assert.equal(tablet.components[0].params.content.answers.tq1, 'Trả lời 1');
    assert.equal(tablet.components[0].params.content.answers.tq2, 'Giữ câu của tablet');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('links, alts, tabs, sliders and read-more text filled on desktop reach the other frame', () => {
  const root = mkdtempSync(join(tmpdir(), 'fill-share-'));
  try {
    const desk = join(root, 'desk');
    const mob = join(root, 'mob');
    const row = (id, name, label) => ({ id, name, children: [text(`${id}-t`, label)] });
    writeWs(desk, {
      id: 'root', name: 'Section', children: [
        { id: 'acc', name: 'FAQ', children: [row('q1', 'Row', 'Câu 1')] },
        { id: 'guess', name: 'Guess', children: [] },
        { id: 'btn', name: 'CTA', children: [text('bt', 'Đăng ký')] },
        { id: 'menu', name: 'Menu', children: [row('mi1', 'Item', 'Ưu điểm'), row('mi2', 'Item', 'Bảng giá')] },
        { id: 'tabs', name: 'Tabs', children: [
          { id: 'bar', name: 'Bar', children: [row('tt1', 'Tab A', 'Tổng quan'), row('tt2', 'Tab B', 'Chi tiết')] },
          { id: 'body', name: 'Body', children: [{ id: 'pane', name: 'Pane', children: [] }] },
        ] },
        { id: 'slide', name: 'Slider', children: [] },
        { id: 'more', name: 'Blurb', children: [] },
        { id: 'pic', name: 'Photo', type: 'RECTANGLE', children: [] },
      ],
    }, {
      components: [
        { id: 'd1', component: 'accordion', status: 'approved', node: 'acc', params: { sync: 'không sửa', content: { answers: { q1: 'Trả lời' } } } },
        { id: 'd2', component: 'accordion', status: 'approved', node: 'guess', note: 'autopilot: shape · confirmed by the owner in the Plan', params: {} },
        { id: 'd3', component: 'button', status: 'approved', node: 'btn', params: { link: 'https://vietnix.vn' } },
        { id: 'd4', component: 'menu', status: 'approved', node: 'menu', params: { links: { 'mi1-t': 'https://a.vn/uu', 'mi2-t': '/gia' } } },
        { id: 'd5', component: 'tabs', status: 'approved', node: 'tabs', params: { content: { panes: { tt2: 'Nội dung chi tiết' } } } },
        { id: 'd6', component: 'carousel', status: 'approved', node: 'slide', params: { autoplay: false, settings: { interval: 8000 }, itemCount: 6, items: { kind: 'figma', nodeId: '9:9' } } },
        { id: 'd7', component: 'readmore', status: 'approved', node: 'more', params: { button: 'btn', buttonMode: 'link', expand: { kind: 'text', text: 'Thêm dòng' } } },
      ],
    });
    writeFileSync(join(desk, 'overrides.json'), JSON.stringify({ nodes: { pic: { alt: 'Diễn giả', reason: 'autopilot: image' } } }));
    writeFileSync(join(desk, 'responsive.json'), JSON.stringify({ variants: [{ key: 'mobile_portrait', workspace: 'mob', maxWidth: 478 }] }));
    writeWs(mob, {
      id: 'mroot', name: 'Section', children: [
        { id: 'macc', name: 'FAQ', children: [row('mq1', 'Row', 'Câu 1')] },
        { id: 'mguess', name: 'Guess', children: [] },
        { id: 'mbtn', name: 'CTA', children: [text('mbt', 'Đăng ký')] },
        { id: 'mmenu', name: 'Menu', children: [row('mmi1', 'Muc', 'Ưu điểm'), row('mmi2', 'Muc', 'Bảng giá')] },
        { id: 'mtabs', name: 'Tabs', children: [
          { id: 'mbar', name: 'Bar', children: [row('mtt1', 'Khac', 'Tổng quan'), row('mtt2', 'Khac 2', 'Chi tiết')] },
          { id: 'mbody', name: 'Body', children: [{ id: 'mpane', name: 'Pane', children: [] }] },
        ] },
        { id: 'mslide', name: 'Slider', children: [] },
        { id: 'mmore', name: 'Blurb', children: [] },
        { id: 'mpic', name: 'Photo', type: 'RECTANGLE', children: [] },
      ],
    }, {
      components: [
        { id: 'd1', component: 'accordion', status: 'approved', node: 'macc', params: {} },
        { id: 'd2', component: 'accordion', status: 'proposed', node: 'mguess', params: {} },
        { id: 'd3', component: 'semantic', status: 'approved', node: 'mguess', params: {} },
        { id: 'd4', component: 'button', status: 'approved', node: 'mbtn', params: {} },
        { id: 'd5', component: 'menu-slider', status: 'approved', node: 'mmenu', params: { links: { 'mmi2-t': '/giu' } } },
        { id: 'd6', component: 'tabs', status: 'approved', node: 'mtabs', params: {} },
        { id: 'd7', component: 'carousel', status: 'approved', node: 'mslide', params: {} },
        { id: 'd8', component: 'readmore', status: 'approved', node: 'mmore', params: { button: 'mbtn' } },
      ],
    });
    writeFileSync(join(mob, 'overrides.json'), JSON.stringify({ nodes: { mpic: { alt: '', reason: 'autopilot: image' }, other: { alt: 'Giữ alt riêng', reason: 'owner' } } }));
    const base = {
      dir: desk,
      readJson: (name, fallback) => {
        try { return JSON.parse(readFileSync(join(desk, name), 'utf8')); } catch { return fallback; }
      },
    };
    assert.equal(shareFilledContent(base).copied, 13);
    const det = JSON.parse(readFileSync(join(mob, 'detections.json'), 'utf8'));
    const by = (node) => det.components.find((c) => c.node === node && c.component !== 'semantic');
    assert.equal(by('macc').params.content.answers.mq1, 'Trả lời');
    assert.equal(by('macc').params.sync, 'không sửa');
    assert.equal(by('mguess').status, 'approved');
    assert.equal(det.components.find((c) => c.component === 'semantic').status, 'rejected');
    assert.equal(by('mbtn').params.link, 'https://vietnix.vn');
    assert.deepEqual(by('mmenu').params.links, { 'mmi1-t': 'https://a.vn/uu', 'mmi2-t': '/giu' });
    assert.equal(by('mtabs').params.content.panes.mtt2, 'Nội dung chi tiết');
    assert.equal(by('mslide').params.autoplay, false);
    assert.equal(by('mslide').params.settings.interval, 8000);
    assert.equal(by('mslide').params.itemCount, 6);
    assert.deepEqual(by('mslide').params.items, { kind: 'figma', nodeId: '9:9' });
    assert.equal(by('mmore').params.button, 'mbtn');
    assert.equal(by('mmore').params.buttonMode, 'link');
    assert.deepEqual(by('mmore').params.expand, { kind: 'text', text: 'Thêm dòng' });
    const ov = JSON.parse(readFileSync(join(mob, 'overrides.json'), 'utf8'));
    assert.equal(ov.nodes.mpic.alt, 'Diễn giả');
    assert.equal(ov.nodes.other.alt, 'Giữ alt riêng');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a form error is copied onto the same field, and a frame without the form is left alone', () => {
  const root = mkdtempSync(join(tmpdir(), 'form-share-'));
  const desk = join(root, 'desk');
  const mob = join(root, 'mob');
  const plain = join(root, 'plain');
  try {
    writeWs(desk, { id: 'root', name: 'Section', children: [{ id: 'form', name: 'Form', children: [] }] }, {
      components: [{ id: 'd', component: 'form', status: 'approved', node: 'form', params: { errorStyle: { gap: 4 }, fields: [
        { node: 'n', type: 'text', placeholder: 'Họ và Tên*', error: 'Nhập họ tên' },
        { node: 'e', type: 'email', placeholder: 'Email*', error: 'Email chưa đúng' },
      ] } }],
    });
    writeWs(mob, { id: 'mroot', name: 'Section', children: [{ id: 'mform', name: 'Form', children: [] }] }, {
      components: [{ id: 'd', component: 'form', status: 'approved', node: 'mform', params: { fields: [
        { node: 'mn', type: 'text', placeholder: 'Họ và Tên*' },
        { node: 'me', type: 'email', placeholder: 'Email*', error: 'Giữ lỗi riêng' },
      ] } }],
    });
    writeWs(plain, { id: 'proot', name: 'Section', children: [{ id: 'title', name: 'Title', children: [] }] }, {
      components: [],
    });
    writeFileSync(join(desk, 'responsive.json'), JSON.stringify({ variants: [
      { key: 'mobile_portrait', workspace: 'mob', maxWidth: 478 },
      { key: 'tablet_portrait', workspace: 'plain', maxWidth: 991 },
    ] }));
    const base = { dir: desk, readJson: (name, fallback) => { try { return JSON.parse(readFileSync(join(desk, name), 'utf8')); } catch { return fallback; } } };
    assert.equal(shareFilledContent(base).copied, 2);
    const fields = JSON.parse(readFileSync(join(mob, 'detections.json'), 'utf8')).components[0].params;
    assert.equal(fields.fields[0].error, 'Nhập họ tên');
    assert.equal(fields.fields[1].error, 'Giữ lỗi riêng');
    assert.equal(fields.errorStyle.gap, 4);
    assert.equal(JSON.parse(readFileSync(join(plain, 'detections.json'), 'utf8')).components.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
