import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertStagingPhrase, linkChildren, pointButtonsAtStaging, pushStaging, STAGING_PHRASE } from '../modules/staging/push.mjs';

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

test('staging upload fills children from parent and points a button at the staging template', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'f2b-staging-'));
  writeFileSync(join(dir, 'bricks.json'), JSON.stringify({
    title: 'Banner',
    type: 'section',
    content: [
      { id: 'parent1', name: 'block', parent: 0, children: [], settings: {}, label: 'Row' },
      { id: 'child01', name: 'button', parent: 'parent1', children: [], settings: { _interactions: [{ templateId: '528', action: 'show' }], _attributes: [{ name: 'data-f2b-open', value: '528' }] } },
    ],
  }));
  writeFileSync(join(dir, 'state.json'), '{}');
  const ids = new Map([['528', '491264']]);
  const pointed = pointButtonsAtStaging(JSON.parse(readFileSync(join(dir, 'bricks.json'), 'utf8')).content, ids);
  assert.equal(pointed[1].settings._interactions[0].templateId, '491264');
  assert.equal(pointed[1].settings._attributes[0].value, '491264');
  const linked = linkChildren(pointed);
  assert.deepEqual(linked[0].children, ['child01']);
  assert.deepEqual(linked[1].children, []);
  let sent = null;
  await pushStaging(dir, STAGING_PHRASE, async (name, args) => {
    if (name === 'create_template') {
      sent = JSON.parse(args.elements_json);
      return { template_id: 41, edit_url: 'https://staging.example/?bricks=run' };
    }
    return { generated: true };
  });
  assert.deepEqual(sent[0].children, ['child01']);
  const stored = JSON.parse(readFileSync(join(dir, 'bricks.json'), 'utf8'));
  assert.deepEqual(stored.content[0].children, []);
});

test('popup upload sends a script element and the popup width local already stores', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'f2b-staging-'));
  writeFileSync(join(dir, 'bricks.json'), JSON.stringify({
    title: 'Cookie',
    type: 'popup',
    popup: { width: 560, backdrop: { hex: '#0c0c0d', alpha: 0.6 } },
    content: [{ id: 'card01', name: 'block', parent: 0, children: [], settings: {} }],
  }));
  writeFileSync(join(dir, 'state.json'), '{}');
  let settings = null;
  await pushStaging(dir, STAGING_PHRASE, async (name, args) => {
    if (name === 'create_template') return { template_id: 9, edit_url: 'https://staging.example/?bricks=run' };
    if (name === 'set_page_settings') {
      settings = JSON.parse(args.page_settings_json);
      assert.equal(args.template_id, 9);
      return {};
    }
    return { generated: true };
  });
  assert.match(settings.customScriptsBodyFooter, /^<script>[\s\S]*<\/script>$/);
  assert.match(settings.customScriptsBodyFooter, /f2b_popup_9/);
  assert.equal(settings.popupContentWidth, '560px');
  assert.deepEqual(settings.templateConditions, [{ id: 'f2bany', main: 'any' }]);
});
