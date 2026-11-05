import { test } from 'node:test';
import assert from 'node:assert/strict';
import { settleMeasuredRows } from '../qa/settle.mjs';

const row = (id, check, want, got) => ({ id, check, want: String(want), got: String(got), ok: false });

test('a looping slider that parks its slides, and a clear area on a matching picture, are listed and not failures', () => {
  const rows = [
    row('a', 'x', -17, -734.94),
    row('b', 'x', 24, -693.94),
    row('c', 'x', 102.668, -615.28),
    row('d', 'x', 222.332, -495.62),
    row('e', 'x', 24, -700.06),
    row('other', 'x', 10, 40),
    row('a', 'w', 101, 87.66),
    row('label', 'w', 203, 178.52),
    { label: 'frame mobile_portrait', check: 'transparent area without a background', want: 'a page-frame fill behind it', got: '22% of Figma\'s picture is clear', ok: false },
  ];
  settleMeasuredRows(rows, 3.13);
  assert.equal(rows.filter((r) => r.check === 'x' && r.id !== 'other').every((r) => r.soft), true);
  assert.equal(rows.find((r) => r.id === 'e').soft, true);
  assert.equal(rows.find((r) => r.id === 'other').soft, undefined);
  assert.equal(rows.find((r) => r.id === 'a' && r.check === 'w').soft, true);
  assert.equal(rows.find((r) => r.id === 'label').soft, undefined);
  assert.equal(rows.find((r) => r.check === 'transparent area without a background').soft, true);
});

test('the same shift stays a failure when the picture is different', () => {
  const rows = [row('a', 'x', 0, -800), row('b', 'x', 10, -790), row('c', 'x', 20, -780), row('d', 'x', 30, -770)];
  settleMeasuredRows(rows, 40);
  assert.equal(rows.some((r) => r.soft), false);
});
