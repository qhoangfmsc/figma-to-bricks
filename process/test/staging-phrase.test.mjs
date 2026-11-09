import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertStagingPhrase, pushStaging, STAGING_PHRASE } from '../modules/staging/push.mjs';

test('only the exact staging sentence is accepted', () => {
  assert.doesNotThrow(() => assertStagingPhrase(STAGING_PHRASE));
  for (const text of ['', 'xác nhận lên staging', 'Xác nhận lên staging.', 'Xác nhận: lên staging', 'Xác nhận lên staging giúp tôi']) {
    assert.throws(() => assertStagingPhrase(text), { code: 'STAGING_PHRASE' });
  }
});

test('a wrong sentence never calls the staging plugin', async () => {
  let called = false;
  await assert.rejects(() => pushStaging('/tmp/unused', 'đưa lên staging', async () => { called = true; }), { code: 'STAGING_PHRASE' });
  assert.equal(called, false);
});

test('the exact sentence sends the local template through f2b-mcp', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'f2b-staging-'));
  writeFileSync(join(dir, 'bricks.json'), JSON.stringify({
    title: 'Banner',
    type: 'section',
    content: [{ id: 'abcd12', name: 'section', parent: 0, children: [], settings: {} }],
  }));
  writeFileSync(join(dir, 'state.json'), '{}');
  const names = [];
  const result = await pushStaging(dir, STAGING_PHRASE, async (name, args) => {
    names.push(name);
    if (name === 'create_template') {
      assert.equal(args.title, 'Banner');
      assert.equal(JSON.parse(args.elements_json)[0].id, 'abcd12');
      return { template_id: 41, edit_url: 'https://staging.example/?bricks=run' };
    }
    if (name === 'generate_css_file') return { generated: true, file_name: 'post-41.min.css' };
    return {};
  });
  assert.deepEqual(names, ['create_template', 'generate_css_file']);
  assert.equal(result.templateId, 41);
});
