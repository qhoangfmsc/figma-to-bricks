import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { joinTemplates, templateGroup } from '../modules/write-bricks/template-group.mjs';

// A course landing: the hero section is the host, a FAQ and a teacher list are added to its template.
function runs() {
  const root = mkdtempSync(join(tmpdir(), 'f2b-group-'));
  const ws = (key, node, into) => {
    const dir = join(root, key, node);
    mkdirSync(dir, { recursive: true });
    if (into) writeFileSync(join(dir, 'into.json'), JSON.stringify(into));
    return dir;
  };
  return {
    root,
    hero: ws('fileA', '1-2'),
    faq: ws('fileB', '9-9', { host: 'fileA/1-2', order: 2, reason: 'owner' }),
    team: ws('fileA', '5-5', { host: 'fileA/1-2', order: 1, reason: 'owner' }),
    other: ws('fileC', '3-3'),
  };
}

test('a section added to another template pushes the whole group, host first, guests by order', () => {
  const r = runs();
  const fromGuest = templateGroup(r.faq, r.root);
  const fromHost = templateGroup(r.hero, r.root);
  assert.equal(fromGuest.host, r.hero);
  assert.deepEqual(fromGuest.members, [r.hero, r.team, r.faq]);
  assert.deepEqual(fromHost.members, fromGuest.members);
  assert.equal(templateGroup(r.other, r.root).joined, false);
});

test('a host that is itself a guest, or a missing host, stops the push', () => {
  const r = runs();
  writeFileSync(join(r.hero, 'into.json'), JSON.stringify({ host: 'fileC/3-3' }));
  assert.throws(() => templateGroup(r.faq, r.root), /itself added/);
  writeFileSync(join(r.other, 'into.json'), JSON.stringify({ host: 'fileZ/0-0' }));
  assert.throws(() => templateGroup(r.other, r.root), /not found/);
});

test('joined content keeps the host title and every root; a repeated element id stops the push', () => {
  const el = (id, parent = 0) => ({ id, name: 'section', parent, settings: {} });
  const host = { title: 'Khoá học - Hero', type: 'section', content: [el('h1'), el('h2', 'h1')], scripts: ['<script>a</script>'] };
  const faq = { title: 'Khoá học - FAQ', type: 'section', content: [el('f1'), el('f2', 'f1')], scripts: ['<script>a</script>', '<script>b</script>'] };
  const joined = joinTemplates([{ name: 'hero', template: host }, { name: 'faq', template: faq }]);
  assert.equal(joined.title, 'Khoá học - Hero');
  assert.deepEqual(joined.content.map((e) => e.id), ['h1', 'h2', 'f1', 'f2']);
  assert.deepEqual(joined.content.filter((e) => e.parent === 0).map((e) => e.id), ['h1', 'f1']);
  assert.deepEqual(joined.scripts, ['<script>a</script>', '<script>b</script>']);
  assert.throws(() => joinTemplates([{ name: 'hero', template: host }, { name: 'faq', template: { ...faq, content: [el('h2')] } }]), /h2/);
});
