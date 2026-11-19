import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchStep } from '../modules/build-steps/01-fetch.mjs';
import { findRunDir, nameWorkspace, resolveWorkspace, runDirName } from '../modules/common/workspace.mjs';

const url = 'https://www.figma.com/design/AbcdEFGHijkl/File?node-id=12-34';

test('a run folder is the timestamp and the frame name', () => {
  assert.equal(runDirName('Landing Page - 2026', 1795069495145), '1795069495145-Landing-Page---2026');
  assert.equal(runDirName('Studio Deck', 1700000000000), '1700000000000-Studio-Deck');
  assert.equal(runDirName('A/B deck', 1700000000000), '1700000000000-A-B-deck');
  assert.equal(runDirName('   ', 1700000000000), '');
});

test('the same frame keeps the named folder', () => {
  const root = mkdtempSync(join(tmpdir(), 'f2b-run-'));
  try {
    const ws = resolveWorkspace(url, root);
    assert.equal(basename(ws.dir), '12-34');
    ws.writeJson('meta.json', ws.ref);
    const named = nameWorkspace(ws, 'Studio Deck', 1700000000000);
    assert.equal(basename(named.dir), '1700000000000-Studio-Deck');
    assert.equal(dirname(named.dir), root);
    assert.equal(existsSync(ws.dir), false);
    const again = resolveWorkspace(url, root);
    assert.equal(again.dir, named.dir);
    assert.equal(nameWorkspace(again, 'Other Deck', 1800000000000).dir, named.dir);
    assert.equal(findRunDir(root, 'AbcdEFGHijkl', '12:34'), named.dir);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fetch applies the frame name to the run folder', async () => {
  const root = mkdtempSync(join(tmpdir(), 'f2b-run-'));
  try {
    const legacyDir = join(root, 'file', '12-34');
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(join(legacyDir, 'meta.json'), JSON.stringify({ fileKey: 'AbcdEFGHijkl', nodeId: '12:34' }));
    const fixture = join(root, 'fx');
    mkdirSync(fixture);
    writeFileSync(join(fixture, 'raw.json'), JSON.stringify({
      nodes: { '12:34': { document: { name: 'Studio Deck' } } },
    }));
    const ws = await fetchStep(legacyDir, { fixture });
    assert.match(basename(ws.dir), /^\d+-Studio-Deck$/);
    assert.equal(existsSync(legacyDir), false);
    assert.equal(ws.readJson('raw.json').nodes['12:34'].document.name, 'Studio Deck');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a taken timestamp takes the next millisecond', () => {
  const root = mkdtempSync(join(tmpdir(), 'f2b-run-'));
  try {
    const ws = resolveWorkspace(url, root);
    ws.writeJson('meta.json', ws.ref);
    mkdirSync(join(root, '1700000000000-Studio-Deck'));
    const named = nameWorkspace(ws, 'Studio Deck', 1700000000000);
    assert.equal(basename(named.dir), '1700000000001-Studio-Deck');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
