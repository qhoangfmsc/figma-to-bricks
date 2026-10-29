#!/usr/bin/env node
// Frees disk space of a finished Figma file's workspaces WITHOUT losing anything that cannot be regenerated.
//   node process/scripts/clean-work.mjs <fileKey>            dry run: what would go, and how much
//   node process/scripts/clean-work.mjs <fileKey> --apply    delete it
// Goes (the next run fetches / renders it again from Figma, nothing is decided by it):
//   raw.json, assets/ (downloaded images + svg + exports), qa/ (Playwright job + output), verify*.png (renders and diffs)
// Stays (hand-made or decided, small): overrides.json, state.json (which WordPress template belongs to the section), review.json, detections.json,
//   decisions.md, meta.json, responsive.json, baseline.json, scorecard.md, verify*.md / .json, tree.json, bricks.json, mapping.json and every other report.
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const fileKey = args.find((a) => !a.startsWith('--'));
const apply = args.includes('--apply');
if (!fileKey || !/^[A-Za-z0-9]+$/.test(fileKey)) { console.error('usage: node process/scripts/clean-work.mjs <fileKey> [--apply]'); process.exit(1); }
const root = fileURLToPath(new URL(`../work/${fileKey}/`, import.meta.url));
if (!existsSync(root)) { console.error(`no workspace folder for ${fileKey}`); process.exit(1); }

const size = (p) => (statSync(p).isDirectory() ? readdirSync(p).reduce((a, f) => a + size(join(p, f)), 0) : statSync(p).size);
const targets = [];
for (const d of readdirSync(root)) {
  const dir = join(root, d);
  if (!statSync(dir).isDirectory()) continue;
  for (const f of readdirSync(dir)) {
    if (f === 'raw.json' || f === 'assets' || f === 'qa' || /^verify.*\.png$/.test(f)) targets.push(join(dir, f));
  }
}
const total = targets.reduce((a, p) => a + size(p), 0);
const mb = (b) => `${(b / 1048576).toFixed(0)} MB`;
if (apply) for (const p of targets) rmSync(p, { recursive: true, force: true });
console.log(`${apply ? 'deleted' : 'would delete'} ${targets.length} item(s), ${mb(total)} in ${root}`);
console.log('kept: overrides.json, state.json, review.json, detections.json, decisions, reports, tree / bricks / mapping.');
