import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrameInput } from '../template/frames.mjs';
import { describeTiming, formatDuration } from '../template/timing.mjs';

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

test('a bad link names the slot and a blank optional slot is skipped', () => {
  const bad = parseFrameInput({ desktop: 'https://www.figma.com/design/AbC/x', tablet: '   ' });
  assert.equal(bad.ok, false);
  assert.match(bad.errors[0], /Desktop/);
  assert.equal(bad.frames.tablet, undefined);
});
