import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { optimizeAssets } from '../modules/common/qa.mjs';

async function run(width, height) {
  const root = mkdtempSync(join(tmpdir(), 'opt-'));
  mkdirSync(join(root, 'assets/images'), { recursive: true });
  const png = await sharp({ create: { width, height, channels: 4, background: { r: 20, g: 90, b: 200, alpha: 1 } } }).png().toBuffer();
  writeFileSync(join(root, 'assets/images/p.png'), png);
  const ws = { file: (f) => join(root, f) };
  const map = await optimizeAssets(ws, ['images/p.png']);
  return sharp(ws.file('assets/' + map.get('images/p.png'))).metadata();
}

test('a wide photo shown wider than 1600px keeps its exported pixels', async () => {
  const meta = await run(2800, 500);
  assert.equal(meta.width, 2800);
});

test('a photo above the Figma export limit is capped, never upscaled', async () => {
  const meta = await run(5000, 400);
  assert.equal(meta.width, 4096);
});
