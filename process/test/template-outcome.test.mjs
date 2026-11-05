import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outcomeOf, readyForUser } from '../template/outcome.mjs';

test('a pushed template is a result even when verify exits with mismatches', () => {
  const out = outcomeOf({
    status: 1,
    templateId: 412,
    stdout: '  updated template 412\n  [fit @320px] FAIL scroll 501\n  summary.md → FAIL: 1 blocker and 0 major difference(s) from Figma\n',
    stderr: '',
  });
  assert.equal(out.ok, true);
  assert.equal(out.verified, true);
  assert.equal(out.status, 1);
});

test('a pushed template is still returned when verify itself stops', () => {
  const out = outcomeOf({
    status: 1,
    templateId: 412,
    stdout: '  created template 412\n',
    stderr: 'QA fit @320px: no result',
  });
  assert.equal(out.ok, true);
  assert.equal(out.verified, false);
});

test('the user link waits until every frame was measured and none has a heavy miss', () => {
  const pass = { verify: { verdict: 'PASS' } };
  const minor = { verify: { verdict: 'PASS WITH MINOR' } };
  assert.equal(readyForUser([pass, minor]), true);
  assert.equal(readyForUser([pass, { verify: { verdict: 'FAIL' } }]), false);
  assert.equal(readyForUser([pass, { verify: null }]), false);
  assert.equal(readyForUser([]), false);
});

test('a site that is down or a spent Figma token stops the run, and an old template id does not count', () => {
  const down = outcomeOf({ status: 1, templateId: 412, stdout: '', stderr: 'connect ECONNREFUSED 127.0.0.1:8080' });
  assert.equal(down.ok, false);
  assert.match(down.error.message, /ECONNREFUSED/);
  const token = outcomeOf({ status: 1, templateId: null, stdout: '', stderr: 'Figma 429 on /v1/files/abc' });
  assert.equal(token.ok, false);
  assert.match(token.error.message, /Figma 429/);
});
