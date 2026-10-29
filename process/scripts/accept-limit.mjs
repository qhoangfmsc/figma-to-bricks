#!/usr/bin/env node
// Accept a difference that cannot be removed, ON THE RECORD: limits.json of the section gets the node, the check, the value that was measured and the reason.
//   node process/scripts/accept-limit.mjs <workspace-dir> <frame> <figmaNodeId> <check|-> "<reason>"   (value measured = what nodes.state.json holds now)
//   node process/scripts/accept-limit.mjs <workspace-dir> <frame> look - "<reason>"                   (the look regions of the frame, accepted up to today's mean difference)
//   node process/scripts/accept-limit.mjs <workspace-dir> <frame> cascade <rootNodeId>:<delta> "<reason>"  (y / h of the nodes that moved by exactly <delta> because of the accepted root node)
// The acceptance holds only for THIS value: if the page later measures something else, the node fails again and the reason does not cover it.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [dir0, frame, node, check, ...reasonParts] = process.argv.slice(2);
const reason = reasonParts.join(' ').trim();
if (!dir0 || !frame || !node || !check || reason.length < 20) { console.error('usage: accept-limit.mjs <workspace-dir> <frame> <figmaNodeId|look> <check|-> "<reason, at least 20 characters, with the Figma value and what the page does>"'); process.exit(1); }
const dir = resolve(dir0);
const stFile = join(dir, 'nodes.state.json'), limFile = join(dir, 'limits.json');
const st = JSON.parse(readFileSync(stFile, 'utf8')).frames[frame];
if (!st) { console.error(`no state for frame ${frame}: run the verify step first`); process.exit(1); }
const lim = existsSync(limFile) ? JSON.parse(readFileSync(limFile, 'utf8')) : { accepted: [] };
const add = [];
if (node === 'cascade') {
  const cut = check.lastIndexOf(':'); // node ids contain ':' themselves: the delta is what follows the LAST one
  const root = check.slice(0, cut), delta = check.slice(cut + 1);
  if (!root || Number.isNaN(Number(delta))) { console.error('cascade needs <rootNodeId>:<delta>, e.g. 2209:5828:36'); process.exit(1); }
  if (!lim.accepted.some((l) => !l.cascade && l.node === root && (l.frame ?? frame) === frame)) { console.error(`accept the root node ${root} first: a consequence needs an accepted cause`); process.exit(1); }
  add.push({ frame, cascade: true, root, delta: Number(delta), checks: ['y', 'h', 'height'], reason });
} else if (node === 'look') {
  if (st.look == null) { console.error('no look score measured for this frame'); process.exit(1); }
  add.push({ frame, node: 'look', reason, maxMean: Math.ceil(st.look * 100) / 100 });
} else {
  const n = st.nodes[node];
  if (!n || n.state !== 'fail') { console.error(`${node} is not failing in frame ${frame} (state: ${n?.state ?? 'unknown'})`); process.exit(1); }
  for (const c of n.checks.filter((c) => c.tier <= 2 && (check === '-' || c.check === check))) add.push({ frame, node, check: c.check, want: c.want, got: c.got, reason });
  if (!add.length) { console.error(`${node} has no failing tier 1/2 check named ${check}`); process.exit(1); }
}
for (const a of add) lim.accepted = [...lim.accepted.filter((x) => !(x.frame === a.frame && x.node === a.node && x.check === a.check && !!x.cascade === !!a.cascade && x.root === a.root && x.delta === a.delta)), a];
writeFileSync(limFile, JSON.stringify(lim, null, 1));
console.log(`accepted ${add.length} difference(s) on ${node} (${frame}) in ${limFile}`);
