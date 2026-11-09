import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrameInput } from '../modules/single-template/frames.mjs';
import { renderTemplatePlan, writeTemplatePlan } from '../modules/single-template/plan-doc.mjs';
import { itemHeading, parsePlan } from '../modules/missing-content/index.mjs';
import { readFlag } from '../template.mjs';
import { describeTiming, formatDuration } from '../modules/single-template/timing.mjs';

const desktop = 'https://www.figma.com/design/AbC/x?node-id=112-1369';
const tablet = 'https://www.figma.com/design/AbC/x?node-id=200-1';
const mobile = 'https://www.figma.com/design/AbC/x?node-id=125-2252';
const wide = 'https://www.figma.com/design/AbC/x?node-id=300-9';

test('desktop is required and the optional frames keep their breakpoint keys', () => {
  const missing = parseFrameInput({});
  assert.equal(missing.ok, false);
  assert.match(missing.errors[0], /Desktop/);

  const parsed = parseFrameInput({ desktop, tablet, mobile, widescreen: wide });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.frames.desktop.nodeId, '112:1369');
  assert.equal(parsed.frames.tablet.key, 'tablet_portrait');
  assert.equal(parsed.frames.tablet.maxWidth, 991);
  assert.equal(parsed.frames.mobile.key, 'mobile_portrait');
  assert.equal(parsed.frames.mobile.maxWidth, 478);
  assert.equal(parsed.frames.widescreen.key, 'widescreen');
  assert.equal(parsed.frames.widescreen.wide, true);
  assert.equal(parsed.frames.widescreen.maxWidth, undefined);

  const landscape = 'https://www.figma.com/design/AbC/x?node-id=400-2';
  const withLandscape = parseFrameInput({ desktop, landscape });
  assert.equal(withLandscape.ok, true);
  assert.equal(withLandscape.frames.landscape.key, 'mobile_landscape');
  assert.equal(withLandscape.frames.landscape.maxWidth, 767);
});

test('frames must be one Figma file and different nodes', () => {
  const other = parseFrameInput({ desktop, tablet: 'https://www.figma.com/design/ZZZ/x?node-id=1-2' });
  assert.equal(other.ok, false);
  assert.match(other.errors.join(' '), /cùng một file/);

  const same = parseFrameInput({ desktop, mobile: desktop });
  assert.equal(same.ok, false);
  assert.match(same.errors.join(' '), /cùng một node/);
});

test('timing follows the measured per-frame medians and counts every filled slot', () => {
  assert.equal(formatDuration(5_000), '5 giây');
  assert.equal(formatDuration(48_000), '48 giây');
  assert.equal(formatDuration(120_000), '2 phút');
  assert.equal(formatDuration(144_000), '2 phút 24 giây');
  const one = describeTiming({ desktop: 'https://www.figma.com/design/AbC/x?node-id=1-2' });
  assert.equal(one.frames, 1);
  assert.equal(one.planMs, 5_000);
  assert.equal(one.planMaxMs, 120_000);
  assert.equal(one.buildMs, 48_000);
  assert.match(one.plan, /5 giây – 2 phút/);
  assert.match(one.build, /48 giây/);
  const four = describeTiming({ desktop: 'a', tablet: 'b', mobile: 'c', widescreen: 'd' });
  assert.equal(four.frames, 4);
  assert.equal(four.buildMs, 192_000);
  const five = describeTiming({ desktop: 'a', widescreen: 'b', tablet: 'c', landscape: 'd', mobile: 'e' });
  assert.equal(five.frames, 5);
  assert.match(describeTiming({}).plan, /Desktop/);
});

test('a template plan names each component and says what an empty group means', () => {
  const md = renderTemplatePlan({
    title: 'VPS Linux 2025 - Certificate',
    name: 'Certificate',
    width: 1440,
    variants: [{ label: 'Mobile portrait', width: 375 }],
    parts: [{
      kind: 'Slider',
      name: '_case-study-list',
      node: '2172:3675',
      figma: 'https://www.figma.com/design/FK/x?node-id=2172-3675',
      fields: [
        { title: '_case-study-list tự chạy không?', key: 'autoplay:2172:3675', value: 'tự chuyển mỗi 3 giây', placeholder: 'Gõ số giây, hoặc đừng tự chạy.' },
        { title: '_case-study-list lấy các mục ở đâu?', key: 'items:2172:3675', value: '', placeholder: 'Để trống là dùng các mục đang vẽ.' },
      ],
    }],
    open: [],
    repeats: [],
  });
  assert.match(md, /## Component Detected \(1\)/);
  assert.match(md, /### Slider `_case-study-list`/);
  assert.match(md, /`part:2172:3675`:\s*$/m);
  assert.doesNotMatch(md, /Đang có:/);
  assert.doesNotMatch(md, /Gõ số giây/);
  assert.match(md, /`autoplay:2172:3675`: tự chuyển mỗi 3 giây/);
  assert.match(md, /`items:2172:3675`: \[Chưa có value\]/);
  assert.doesNotMatch(md, /Đoán, chưa gắn/);
  assert.doesNotMatch(md, /Ô cùng hình/);
  assert.doesNotMatch(md, /^Sửa:/m);
  assert.equal(parsePlan(md)['autoplay:2172:3675'], 'tự chuyển mỗi 3 giây');
  assert.equal(parsePlan(md)['items:2172:3675'], '[Chưa có value]');
});

test('a guess shows its link and evidence, a same-shape group shows what was seen', () => {
  const md = renderTemplatePlan({
    title: 'Demo', name: 'Hero', width: 1440, variants: [], parts: [],
    open: [{ node: '1:20', label: 'Tab "Giá"', evidence: '4 nhãn một hàng', figma: 'https://www.figma.com/design/FK/x?node-id=1-20' }],
    repeats: [{ node: '1:30', count: 3, item: 'Card', sample: 'MaxSpeed', figma: 'https://www.figma.com/design/FK/x?node-id=1-30' }],
  });
  assert.match(md, /## Chưa chắc/);
  assert.match(md, /Tab "Giá"/);
  assert.match(md, /\[Mở\]\(https:\/\/www\.figma\.com\/design\/FK\/x\?node-id=1-20\)/);
  assert.match(md, /4 nhãn một hàng/);
  assert.match(md, /`guess:1:20`:\s*$/m);
  assert.match(md, /## Nhóm lặp/);
  assert.match(md, /3 ô "Card", mẫu "MaxSpeed"/);
  assert.match(md, /\[Mở\]\(https:\/\/www\.figma\.com\/design\/FK\/x\?node-id=1-30\)/);
  assert.match(md, /`repeat:1:30`:\s*$/m);
});

test('writing the plan again keeps a value the owner typed and resets the confirmation', () => {
  const dir = mkdtempSync(join(tmpdir(), 'f2b-template-plan-'));
  const model = {
    title: 'Demo', name: 'Hero', width: 1440, variants: [],
    parts: [{ kind: 'Nút', name: 'Đăng ký', node: '1:10', figma: 'https://www.figma.com/design/FK/x?node-id=1-10', fields: [
      { title: 'Bấm nút Đăng ký thì mở trang nào?', key: 'link:1:10', value: 'chưa có địa chỉ', placeholder: 'Viết địa chỉ.' },
    ] }],
    open: [{ node: '1:20', label: 'Tab "Giá"' }],
    repeats: [{ node: '1:30', label: '3 mục "Card", mẫu "MaxSpeed"' }],
  };
  const file = writeTemplatePlan(dir, model);
  writeFileSync(file, `${readFileSync(file, 'utf8')
    .replace('`link:1:10`: chưa có địa chỉ', '`link:1:10`: https://vietnix.vn/dang-ky')
    .replace('Xác nhận: không', 'Xác nhận: có')}\nSửa: bỏ nút\n`);
  writeTemplatePlan(dir, model);
  const next = readFileSync(file, 'utf8');
  assert.equal(parsePlan(next)['link:1:10'], 'https://vietnix.vn/dang-ky');
  assert.match(next, /^Xác nhận: không$/m);
  assert.match(next, /^Sửa: bỏ nút$/m);
  assert.match(next, /`guess:1:20`:\s*$/m);
  assert.match(next, /`repeat:1:30`:\s*$/m);
});

test('several images keep the quoted layer name in the question', () => {
  assert.equal(itemHeading('alt', 'Ảnh "image 15"', 'Slider'), 'Ghi alt cho ảnh "image 15"');
});

test('read accepts a link after the flag or after an equals sign', () => {
  const url = 'https://www.figma.com/design/AbC/x?node-id=1-2';
  assert.equal(readFlag(['--desktop', url, '--mobile', 'm'], 'desktop'), url);
  assert.equal(readFlag(['--desktop=' + url], 'desktop'), url);
  assert.equal(readFlag(['read'], 'desktop'), '');
});

test('a bad link names the slot and a blank optional slot is skipped', () => {
  const bad = parseFrameInput({ desktop: 'https://www.figma.com/design/AbC/x', tablet: '   ' });
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0], /Desktop/);
  assert.equal(bad.frames.tablet, undefined);
});
