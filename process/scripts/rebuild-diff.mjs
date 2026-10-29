#!/usr/bin/env node
// OFFLINE REBUILD + DIFF: what does a rule change do to every section, before anything is pushed or measured?
//   node process/scripts/rebuild-diff.mjs <fileKey>            tree + build of every section from the saved Figma data (no Figma API, no WordPress, no Docker),
//                                                              then a diff of every Bricks element against the previous bricks.json -> rebuild-diff.md
//   node process/scripts/rebuild-diff.mjs <fileKey> --apply    then push + verify ONLY the sections whose template changed (run.mjs --from=push),
//                                                              afterwards: node process/scripts/regress.mjs <fileKey> --no-rebuild
//   node process/scripts/rebuild-diff.mjs <fileKey> --only=Name  limit to sections whose tree name contains Name
// Covers every change in figma/ (normalize, relayout) and bricks/ (render, components, responsive merge): tree.json of the base frame AND of every
// breakpoint frame is regenerated from raw.json, the sign-off is renewed as `autopilot` (the tree fingerprint changed, nothing else did).
// The diff is against bricks.pushed.json, the template as it was last sent to WordPress (written by --apply; the first run of a workspace takes the
// bricks.json on disk), so running the script twice never hides a change that was not pushed yet.
// A change of decide/ or policy.json decides differently and still needs auto.mjs.
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveWorkspace } from '../shared/workspace.mjs';
import { treeStep } from './02-tree.mjs';
import { buildStep } from './05-build.mjs';
import { gate, signOff } from '../review/index.mjs';

const args = process.argv.slice(2);
const fileKey = args.find((a) => !a.startsWith('--'));
const apply = args.includes('--apply');
const only = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7).toLowerCase();
if (!fileKey) { console.error('usage: node process/scripts/rebuild-diff.mjs <fileKey> [--apply] [--only=Name]'); process.exit(1); }

const root = fileURLToPath(new URL(`../work/${fileKey}/`, import.meta.url));
const j = (f) => JSON.parse(readFileSync(f, 'utf8'));
const dirs = readdirSync(root).map((d) => join(root, d)).filter((d) => existsSync(join(d, 'raw.json')));
const sections = dirs.filter((d) => existsSync(join(d, 'scorecard.md')) && existsSync(join(d, 'meta.json')) && existsSync(join(d, 'bricks.json')))
  .filter((d) => !only || j(join(d, 'tree.json')).name.toLowerCase().includes(only));
if (!sections.length) { console.error('no section with a scorecard and a bricks.json: run auto.mjs first'); process.exit(1); }

const quiet = (fn) => { const log = console.log; console.log = () => {}; try { return fn(); } finally { console.log = log; } };
const pushedFile = (d) => join(d, 'bricks.pushed.json');
const mappingPushed = (d) => join(d, 'mapping.pushed.json');
const old = new Map(sections.map((d) => [d, j(existsSync(pushedFile(d)) ? pushedFile(d) : join(d, 'bricks.json'))]));
const oldMap = new Map(sections.map((d) => [d, j(existsSync(mappingPushed(d)) ? mappingPushed(d) : join(d, 'mapping.json'))]));
for (const d of sections) {
  if (!existsSync(pushedFile(d))) copyFileSync(join(d, 'bricks.json'), pushedFile(d));
  if (!existsSync(mappingPushed(d))) copyFileSync(join(d, 'mapping.json'), mappingPushed(d));
}

// the frames a section is built from: its own workspace + every breakpoint workspace
const frames = new Set();
for (const d of sections) {
  frames.add(d);
  const r = existsSync(join(d, 'responsive.json')) ? j(join(d, 'responsive.json')) : { variants: [] };
  for (const v of r.variants) frames.add(join(root, v.workspace));
}
for (const d of frames) {
  if (!existsSync(join(d, 'raw.json'))) { console.error(`! ${d}: raw.json missing, this frame keeps its old tree`); continue; }
  quiet(() => treeStep(d));
  const ws = resolveWorkspace(d);
  if (ws.has('review.json') && !gate(ws).ok) quiet(() => signOff(ws, { by: 'autopilot', note: 'autopilot: tree regenerated offline by rebuild-diff.mjs after a rule change' }));
}
for (const d of sections) quiet(() => buildStep(d));

// element-level diff, keyed by the stable Bricks id
const describe = (v) => (v === undefined ? '(none)' : typeof v === 'string' ? v : JSON.stringify(v)).slice(0, 60);
const out = ['# Rebuild diff', '', `Saved Figma data of ${fileKey}, rebuilt offline. Elements compared by their Bricks id.`, ''];
const changed = [], verifyOnly = [];
for (const d of sections) {
  const prev = new Map(old.get(d).content.map((e) => [e.id, e]));
  const next = new Map(j(join(d, 'bricks.json')).content.map((e) => [e.id, e]));
  const rows = [];
  for (const [id, e] of next) {
    const p = prev.get(id);
    if (!p) { rows.push(`+ ${id} ${e.name} "${e.label ?? ''}": new`); continue; }
    const keys = new Set([...Object.keys(p.settings ?? {}), ...Object.keys(e.settings ?? {})]);
    const diff = [...keys].filter((k) => JSON.stringify(p.settings?.[k]) !== JSON.stringify(e.settings?.[k]));
    if (p.parent !== e.parent) diff.push('(parent)');
    if (p.name !== e.name) diff.push(`(element ${p.name} -> ${e.name})`);
    if (diff.length) rows.push(`~ ${id} ${e.name} "${e.label ?? ''}": ${diff.map((k) => `${k}: ${describe(p.settings?.[k])} -> ${describe(e.settings?.[k])}`).join(' · ')}`);
  }
  for (const [id, p] of prev) if (!next.has(id)) rows.push(`- ${id} ${p.name} "${p.label ?? ''}": removed`);
  // what verify EXPECTS (box of every node, from the relaid-out Figma tree): a change there alone needs a new verify, not a new push
  const was = oldMap.get(d), now = j(join(d, 'mapping.json'));
  const expectRows = Object.keys(now).filter((id) => JSON.stringify(was[id]?.expect) !== JSON.stringify(now[id]?.expect) && now[id]?.expect).map((id) => `${id}: ${['x', 'y', 'w', 'h'].filter((k) => was[id]?.expect?.[k] !== now[id].expect[k]).map((k) => `${k} ${was[id]?.expect?.[k]} -> ${now[id].expect[k]}`).join(', ')}`);
  if (!rows.length && expectRows.length) verifyOnly.push(d);
  const name = j(join(d, 'tree.json')).name;
  if (expectRows.length) rows.push(...expectRows.map((r) => `(expected box) ${r}`));
  out.push(`## ${name} (${d.split('/').pop()}): ${rows.length ? `${rows.length} element(s) changed` : 'unchanged, nothing to push'}`, '', ...rows.slice(0, 40).map((r) => `- ${r}`), ...(rows.length > 40 ? [`- … ${rows.length - 40} more`] : []), '');
  console.log(`${rows.length ? '~' : '='} ${name.padEnd(20)} ${rows.length ? `${rows.length} change(s)${expectRows.length ? ` (${expectRows.length} expected boxes)` : ''}` : 'unchanged'}`);
  if (rows.length) changed.push(d);
}
writeFileSync(join(root, 'rebuild-diff.md'), out.join('\n'));
console.log(`\n${changed.length}/${sections.length} section(s) changed -> ${join(root, 'rebuild-diff.md')}`);

if (apply) {
  for (const d of changed) {
    const meta = j(join(d, 'meta.json'));
    const url = `https://www.figma.com/design/${meta.fileKey}/x?node-id=${meta.nodeId.replace(':', '-')}`;
    const templateChanged = !verifyOnly.includes(d); // only the expected boxes moved: measure again, do not push again
    const r = spawnSync('node', [fileURLToPath(new URL('../run.mjs', import.meta.url)), url, ...(templateChanged ? ['--from=push'] : ['--only=verify']), '--no-cross'], { encoding: 'utf8', maxBuffer: 1 << 28 });
    const ok = r.status === 0 || /summary\.md →/.test(r.stdout ?? ''); // run.mjs exits 1 when a frame FAILS verify: the push itself still happened
    if (ok) { copyFileSync(join(d, 'bricks.json'), pushedFile(d)); copyFileSync(join(d, 'mapping.json'), mappingPushed(d)); }
    console.log(`${ok ? 'pushed + verified' : 'FAILED'}: ${j(join(d, 'tree.json')).name}`);
  }
  console.log('now: node process/scripts/regress.mjs ' + fileKey + ' --no-rebuild');
}
