#!/usr/bin/env node
// Removes accepted limits (limits.json) that cover nothing any more, so that the record only holds differences that really exist.
//   node process/scripts/prune-limits.mjs <fileKey>            dry run
//   node process/scripts/prune-limits.mjs <fileKey> --apply
// An entry is USED when a node of its frame is `limit` with its reason (a cascade: with "follows from <root>"), a `look` entry when the frame still has look rows
// that fail. Run it after a verify; an entry that is dropped by mistake comes back as a failing node, never as a silent pass.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fileKey = process.argv[2];
const apply = process.argv.includes('--apply');
if (!fileKey) { console.error('usage: node process/scripts/prune-limits.mjs <fileKey> [--apply]'); process.exit(1); }
const root = fileURLToPath(new URL(`../work/${fileKey}/`, import.meta.url));
const j = (f) => JSON.parse(readFileSync(f, 'utf8'));
let kept = 0, dropped = 0;
for (const d of readdirSync(root)) {
  const dir = join(root, d);
  if (!existsSync(join(dir, 'limits.json')) || !existsSync(join(dir, 'nodes.state.json'))) continue;
  const st = j(join(dir, 'nodes.state.json')).frames;
  const lim = j(join(dir, 'limits.json'));
  const used = (l) => {
    const fr = st[l.frame ?? 'base'];
    if (!fr) return false;
    if (l.node === 'look') {
      const f = join(dir, l.frame === 'base' || !l.frame ? 'verify.json' : `verify.${l.frame}.json`);
      return existsSync(f) && (j(f).bad ?? []).some((r) => r.check === 'vs Figma render');
    }
    if (l.cascade) return Object.values(fr.nodes).some((n) => n.state === 'limit' && String(n.reason ?? '').startsWith(`follows from ${l.root}`));
    return fr.nodes[l.node]?.state === 'limit' && fr.nodes[l.node].reason === l.reason;
  };
  const keep = lim.accepted.filter(used);
  const gone = lim.accepted.length - keep.length;
  kept += keep.length; dropped += gone;
  if (gone) console.log(`${d}: ${gone} unused entr${gone === 1 ? 'y' : 'ies'}${apply ? ' removed' : ''}, ${keep.length} kept`);
  if (apply && gone) writeFileSync(join(dir, 'limits.json'), JSON.stringify({ accepted: keep }, null, 1));
}
console.log(`${apply ? 'removed' : 'would remove'} ${dropped}, kept ${kept}`);
