#!/usr/bin/env node
// REGRESSION GUARD for the fix loop: a rule change must not make another section worse.
//   node process/scripts/regress.mjs <fileKey> --save        remember the current look / mismatch numbers of every section that has a scorecard
//   node process/scripts/regress.mjs <fileKey>               rebuild every such section (run.mjs --from=build --no-cross) and compare with the saved numbers
//   node process/scripts/regress.mjs <fileKey> --no-rebuild compare without rebuilding
//   node process/scripts/regress.mjs <fileKey> --only=Name   limit to workspaces whose tree name contains Name
// A section is WORSE when a frame's look score grows by more than 1.0 (/255) or its real mismatches grow by more than 3. Exit code 1 when any is worse.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Progress } from '../shared/progress.mjs';
import { bridge } from '../bricks/bridge.mjs';

const args = process.argv.slice(2);
const fileKey = args.find((a) => !a.startsWith('--'));
const save = args.includes('--save');
const noRebuild = args.includes('--no-rebuild'); // compare the numbers on disk with the baseline (after auto.mjs re-decided and rebuilt the sections)
const only = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7).toLowerCase();
if (!fileKey) { console.error('usage: node process/scripts/regress.mjs <fileKey> [--save] [--only=Name]'); process.exit(1); }
const root = fileURLToPath(new URL(`../work/${fileKey}/`, import.meta.url));
const baselineFile = join(root, 'baseline.json');
const j = (f) => JSON.parse(readFileSync(f, 'utf8'));

const sections = readdirSync(root).map((d) => join(root, d)).filter((d) => existsSync(join(d, 'scorecard.md')) && existsSync(join(d, 'verify.json')) && existsSync(join(d, 'meta.json')));
const numbers = (dir) => {
  const out = {};
  for (const f of readdirSync(dir).filter((n) => /^verify(\..+)?\.json$/.test(n) && !n.endsWith('.figma.json'))) {
    const key = f === 'verify.json' ? 'base' : f.slice(7, -5);
    const v = j(join(dir, f));
    out[key] = { look: v.visualMean == null ? null : Math.round(v.visualMean * 100) / 100, bad: v.bad.length, major: v.tiers ? v.tiers[1] + v.tiers[2] : v.bad.length };
  }
  return out;
};
const list = sections.map((dir) => ({ dir, name: j(join(dir, 'tree.json')).name, meta: j(join(dir, 'meta.json')) })).filter((s) => !only || s.name.toLowerCase().includes(only));

if (save) {
  const base = existsSync(baselineFile) ? j(baselineFile) : {};
  for (const s of list) base[s.dir.split('/').pop()] = { name: s.name, ...{ frames: numbers(s.dir) } };
  writeFileSync(baselineFile, JSON.stringify(base, null, 2));
  console.log(`saved the numbers of ${list.length} section(s) to ${baselineFile}`);
  process.exit(0);
}
if (!existsSync(baselineFile)) { console.error('no baseline: run with --save after a good run'); process.exit(1); }
const base = j(baselineFile);
let worse = 0;
// progress of the rebuild: every section counts as read (prepared) already, build + push + verify are what this loop does
const progress = new Progress({ dir: root, node: `regress-${fileKey}`, title: `regress ${fileKey}${noRebuild ? ' (no rebuild)' : ''}`, sections: list.map((s) => ({ id: s.dir.split('/').pop(), name: s.name })), quiet: noRebuild });
list.forEach((s, i) => {
  const keys = existsSync(join(s.dir, 'responsive.json')) ? j(join(s.dir, 'responsive.json')).variants.map((v) => v.key) : [];
  progress.found(i, keys);
  for (const k of ['desktop', ...keys]) progress.prepared(i, k);
});
for (const [idx, s] of list.entries()) {
  progress.begin(idx);
  progress.at(idx, 'desktop', 'build + push + verify');
  const id = s.dir.split('/').pop();
  const url = `https://www.figma.com/design/${s.meta.fileKey}/x?node-id=${s.meta.nodeId.replace(':', '-')}`;
  const r = noRebuild ? { status: 0 } : spawnSync('node', [fileURLToPath(new URL('../run.mjs', import.meta.url)), url, '--from=build', '--no-cross'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const now = numbers(s.dir), was = base[id]?.frames ?? {};
  const notes = [];
  for (const [k, n] of Object.entries(now)) {
    const b = was[k];
    if (!b) { notes.push(`${k}: new frame (look ${n.look}, ${n.bad} mismatches)`); continue; }
    const unmeasured = n.look == null && b.look != null; // the Figma render was not fetched: that is not an improvement
    const flag = unmeasured || n.look > b.look + 1 || n.bad > b.bad + 3 || (b.major !== undefined && n.major > b.major);
    notes.push(`${k}: look ${b.look} -> ${n.look}, mismatches ${b.bad} -> ${n.bad}${b.major !== undefined ? `, blocker+major ${b.major} -> ${n.major}` : ''}${unmeasured ? '  NOT MEASURED' : flag ? '  WORSE' : ''}`);
    if (flag) worse++;
  }
  progress.built(idx); progress.pushed(idx);
  for (const k of Object.keys(now)) progress.verified(idx, k, now[k].look == null ? 'không đo được' : `look ${now[k].look}`);
  progress.end(idx, r.status === null ? 'stopped' : 'done', r.status === null ? 'run failed' : '');
  console.log(`${worse && notes.some((x) => x.includes('WORSE') || x.includes('NOT MEASURED')) ? '✗' : '✓'} ${s.name}${r.status === null ? ' (run failed)' : ''}\n    ${notes.join('\n    ')}`);
}
if (!noRebuild) await bridge('DELETE', '/preview').catch(() => {}); // the verify steps used the temporary preview page: it is not part of the deliverable
console.log(worse ? `\n${worse} frame(s) got worse: revert or narrow the rule change` : '\nno section got worse');
process.exit(worse ? 1 : 0);
