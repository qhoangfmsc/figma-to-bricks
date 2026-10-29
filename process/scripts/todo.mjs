#!/usr/bin/env node
// What is LEFT: only the nodes that are still wrong, per section and frame, from nodes.state.json (written by the verify step).
//   node process/scripts/todo.mjs <fileKey>              every section: DONE, or the failing nodes with the check, what Figma has and what the page has
//   node process/scripts/todo.mjs <fileKey> --only=Name  one section
// A node that is `ok`, `minor` or an accepted `limit` is never printed: nobody has to look at it again until its input (fingerprint) changes.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const fileKey = args.find((a) => !a.startsWith('--'));
const only = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7).toLowerCase();
if (!fileKey) { console.error('usage: node process/scripts/todo.mjs <fileKey> [--only=Name]'); process.exit(1); }
const root = fileURLToPath(new URL(`../work/${fileKey}/`, import.meta.url));
const j = (f) => JSON.parse(readFileSync(f, 'utf8'));

let open = 0, sections = 0, done = 0;
for (const d of readdirSync(root).sort()) {
  const dir = join(root, d);
  if (!existsSync(join(dir, 'nodes.state.json')) || !existsSync(join(dir, 'scorecard.md'))) continue;
  const name = j(join(dir, 'tree.json')).name;
  if (only && !name.toLowerCase().includes(only)) continue;
  sections++;
  const st = j(join(dir, 'nodes.state.json'));
  const lines = [];
  for (const [frame, fr] of Object.entries(st.frames)) {
    const fails = Object.entries(fr.nodes).filter(([, n]) => n.state === 'fail');
    if (fr.done) continue;
    lines.push(`  ${frame}: ${fails.length} failing node(s)${fr.look != null ? ` · look ${Math.round(fr.look * 100) / 100}/255` : ''}`);
    for (const [id, n] of fails.slice(0, 12)) lines.push(`    ✗ ${id} ${n.element}${n.changed ? ' (changed)' : ''}${n.was ? ` (was ${n.was})` : ''}: ${n.checks.slice(0, 3).map((c) => `${c.check} want ${c.want} got ${c.got}`).join(' · ')}`);
    if (fails.length > 12) lines.push(`    … ${fails.length - 12} more`);
  }
  if (lines.length) { open++; console.log(`✗ ${name} [${d}]\n${lines.join('\n')}`); } else { done++; if (only) console.log(`✓ ${name} [${d}] DONE`); }
}
console.log(`\n${done}/${sections} section(s) DONE, ${open} with work left`);
process.exit(open ? 1 : 0);
