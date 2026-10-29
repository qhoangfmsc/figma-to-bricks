#!/usr/bin/env node
// Builds nodes.state.json from the verify.json files that already exist (no browser, no WordPress): the same computeStates the verify step uses.
//   node process/scripts/state-backfill.mjs <fileKey>
// Fingerprints stay empty until the next real verify fills them. Rows that are not about a node (look regions, page checks) keep no id.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeStates, frameDone, summarize } from '../shared/node-state.mjs';

const fileKey = process.argv[2];
if (!fileKey) { console.error('usage: node process/scripts/state-backfill.mjs <fileKey>'); process.exit(1); }
const root = fileURLToPath(new URL(`../work/${fileKey}/`, import.meta.url));
const j = (f) => JSON.parse(readFileSync(f, 'utf8'));
let n = 0;
for (const d of readdirSync(root)) {
  const dir = join(root, d);
  if (!existsSync(join(dir, 'scorecard.md')) || !existsSync(join(dir, 'verify.json'))) continue;
  const limits = existsSync(join(dir, 'limits.json')) ? j(join(dir, 'limits.json')).accepted ?? [] : [];
  const out = { frames: {} };
  for (const f of readdirSync(dir).filter((x) => /^verify(\..+)?\.json$/.test(x) && !x.endsWith('.figma.json'))) {
    const key = f === 'verify.json' ? 'base' : f.slice(7, -5);
    const v = j(join(dir, f));
    const mapFile = key === 'base' ? 'mapping.json' : `mapping.${key}.json`;
    if (!existsSync(join(dir, mapFile))) continue;
    const mapping = j(join(dir, mapFile));
    const items = Object.entries(mapping).filter(([, m]) => m.bricksId && m.verify).map(([figmaId, m]) => ({ figmaId, element: m.element }));
    const known = new Set(items.map((i) => i.figmaId));
    const rows = [...(v.bad ?? []), ...(v.soft ?? [])].map((r) => { const id = String(r.label).split(' ')[0]; return { ...r, ...(known.has(id) && { id }) }; });
    const frameLimits = limits.filter((l) => !l.frame || l.frame === key);
    const nodes = computeStates({ rows, items, limits: frameLimits });
    const done = frameDone({ nodes, rows: rows.map((r) => ({ ...r, ok: false })), limits: frameLimits, visualMean: v.visualMean });
    out.frames[key] = { nodes, summary: summarize(nodes), done: done.done, look: v.visualMean };
  }
  writeFileSync(join(dir, 'nodes.state.json'), JSON.stringify(out));
  n++;
}
console.log(`nodes.state.json written for ${n} section(s)`);
