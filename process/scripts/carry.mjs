#!/usr/bin/env node
// Carry the owner's decisions (detections.json components + overrides.json) from one workspace to another frame of the SAME design
// (e.g. the 1440 hero -> the tablet and mobile hero), node by node, using the tree match of responsive/match.mjs (same name, same position).
//   node process/scripts/carry.mjs <fromWorkspace> <toWorkspace> [--aliases='{"<to id>":"<from id>"}']
// Nothing is invented: an entry whose node has no partner in the target is listed and dropped. Existing target entries are kept; a carried
// detection is skipped when the target already has the same component on the same node. Status is carried as it was (the owner decided it).
import { resolveWorkspace } from '../shared/workspace.mjs';
import { matchTrees } from '../responsive/match.mjs';

const args = process.argv.slice(2);
const aliasArg = args.find((a) => a.startsWith('--aliases='));
const [fromDir, toDir] = args.filter((a) => !a.startsWith('--'));
const from = resolveWorkspace(fromDir);
const to = resolveWorkspace(toDir);
const aliases = aliasArg ? JSON.parse(aliasArg.slice(10)) : {};

const { pairs } = matchTrees(from.readJson('tree.json'), to.readJson('tree.json'), { aliases });
const toTarget = new Map([...pairs].map(([v, b]) => [b, v])); // from id -> to id

const translate = (text) => {
  let out = text;
  for (const [a, b] of [...toTarget].sort((x, y) => y[0].length - x[0].length)) out = out.replaceAll(`"${a}"`, `"${b}"`);
  return out;
};
const idsIn = (obj) => JSON.stringify(obj).match(/"(I?\d+:\d+(?:;\d+:\d+)*)"/g)?.map((s) => s.slice(1, -1)) ?? [];

const det = to.readJson('detections.json');
const src = from.readJson('detections.json');
const dropped = [];
let next = Math.max(0, ...det.components.map((c) => Number(c.id.slice(1)) || 0)) + 1;
for (const c of src.components) {
  const mapped = JSON.parse(translate(JSON.stringify(c)));
  const missing = idsIn(c).filter((id) => !toTarget.has(id));
  if (!toTarget.has(c.node) || missing.length) { dropped.push(`${c.id} ${c.component} ${c.node}${missing.length ? ` (no partner for ${missing.join(', ')})` : ''}`); continue; }
  if (det.components.some((x) => x.component === c.component && x.node === mapped.node)) { console.log(`  = ${c.id} ${c.component}: target already has it, kept`); continue; }
  mapped.id = `d${next++}`;
  det.components.push(mapped);
  console.log(`  + ${c.id} -> ${mapped.id} ${c.component} ${c.node} -> ${mapped.node} (${mapped.status})`);
}
to.writeJson('detections.json', det);

const ovSrc = from.readJson('overrides.json', { nodes: {} });
const ov = to.readJson('overrides.json', { nodes: {} });
ov.template ??= ovSrc.template;
for (const [id, v] of Object.entries(ovSrc.nodes ?? {})) {
  if (!toTarget.has(id)) { dropped.push(`override ${id}`); continue; }
  ov.nodes ??= {};
  ov.nodes[toTarget.get(id)] ??= v;
}
to.writeJson('overrides.json', ov);
console.log(`  overrides: ${Object.keys(ov.nodes ?? {}).length} · dropped (no partner): ${dropped.length ? '\n    ' + dropped.join('\n    ') : 'none'}`);
