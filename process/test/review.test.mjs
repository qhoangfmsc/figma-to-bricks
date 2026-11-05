import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewFrame } from '../template/review.mjs';

const shifted = (id, want, got) => ({ id, label: `${id} block`, check: 'x', want: String(want), got: String(got), ok: false, tier: 2 });

test('a menu shifted for the arrow is explained without FAIL or look', () => {
  const review = reviewFrame({
    verdict: 'FAIL',
    visualMean: 8.234,
    bad: [
      shifted('a', 191, 231),
      shifted('b', 203, 243.05),
      { label: 'frame base', check: 'transparent area without a background', want: 'a page-frame fill behind it', got: "17% of Figma's picture is clear", ok: false, tier: 1 },
      { id: 'c', label: 'c text-link', check: 'on top at its center', want: 'itself', got: 'covered by a#x', ok: false, tier: 1 },
    ],
  }, 'desktop');
  assert.equal(review.name, 'Máy tính');
  assert.equal(review.percent, 3.2);
  assert.deepEqual(review.notes, [
    'Các phần chữ nằm lệch sang phải khoảng 40px so với bản vẽ.',
    'Khoảng 17% bản vẽ trong suốt. Trên trang chỗ đó hiện nền trang.',
    'Có một chữ bị phần khác đè lên.',
  ]);
});

test('a slider that parks its nodes off screen is not described as a huge shift when the picture is close', () => {
  const parked = Array.from({ length: 24 }, (_, i) => shifted(`n${i}`, 100, 100 - 2328));
  const review = reviewFrame({ verdict: 'FAIL', visualMean: 1.9296, bad: parked }, 'desktop');
  assert.equal(review.percent, 0.8);
  assert.deepEqual(review.notes, []);
});

test('the same huge shift is still mentioned when the picture is also different', () => {
  const review = reviewFrame({
    verdict: 'FAIL',
    visualMean: 40,
    bad: [shifted('a', 100, 100 - 2328)],
  }, 'desktop');
  assert.match(review.notes[0], /2328px/);
});

test('a picture that matches has only the percent', () => {
  const review = reviewFrame({ verdict: 'PASS', visualMean: 1.2, bad: [] }, 'mobile_portrait');
  assert.equal(review.percent, 0.5);
  assert.deepEqual(review.notes, ['Không thấy chỗ nào lệch so với bản vẽ.']);
});

test('a frame that was not measured says so', () => {
  const review = reviewFrame(null, 'tablet_portrait');
  assert.equal(review.percent, null);
  assert.deepEqual(review.notes, ['Chưa đo được.']);
});
