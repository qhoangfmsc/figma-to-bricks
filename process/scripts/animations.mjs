#!/usr/bin/env node
// Animation backlog: collects everything the designer drew or wrote about motion into <workspace>/animations.md, and builds NONE of it.
// Owner rule (2026-10-27): animation is noted while painting from the design and done last, after the owner approved the look.
//   node process/scripts/animations.mjs <workspace> [--page=<workspace of the whole page / section>]
// Sources: (1) prototype interactions on the nodes (hover, click, after delay… with the destination variant and the transition),
//          (2) frames written as motion specs ("Animation", "Handoff"…), read verbatim from the page workspace when --page is given.
import { resolveWorkspace } from '../shared/workspace.mjs';

const args = process.argv.slice(2);
const pageArg = args.find((a) => a.startsWith('--page='))?.slice(7);
const ws = resolveWorkspace(args.find((a) => !a.startsWith('--')));
const page = pageArg ? resolveWorkspace(pageArg) : null;

const rootOf = (w) => { const raw = w.readJson('raw.json'); return Object.values(raw.nodes)[0].document; };
const walk = (n, fn) => { fn(n); (n.children ?? []).forEach((c) => walk(c, fn)); };

// 1. interactions on the nodes of this workspace
const interactions = [];
const nodeById = new Map();
walk(rootOf(ws), (n) => nodeById.set(n.id, n));
if (page) walk(rootOf(page), (n) => { if (!nodeById.has(n.id)) nodeById.set(n.id, n); });
for (const n of rootOf(ws).children ? [rootOf(ws)] : []) walk(n, (m) => {
  for (const it of m.interactions ?? []) {
    for (const a of it.actions ?? []) {
      interactions.push({
        node: m.id, name: m.name, trigger: it.trigger?.type + (it.trigger?.timeout ? ` ${it.trigger.timeout}ms` : ''),
        action: `${a.type ?? ''} ${a.navigation ?? ''}`.trim(), to: a.destinationId ? `${nodeById.get(a.destinationId)?.name ?? '?'} [${a.destinationId}]` : '',
        transition: a.transition ? `${a.transition.type}${a.transition.duration != null ? ` ${a.transition.duration}s` : ''}${a.transition.easing?.type ? ` ${a.transition.easing.type}` : ''}` : 'none',
      });
    }
  }
});

// 2. motion specs written in frames of the page
const specs = [];
if (page) walk(rootOf(page), (n) => {
  if (n.type === 'FRAME' && /^(animation|handoff|motion)/i.test(n.name.trim())) {
    const lines = [];
    walk(n, (m) => { if (m.type === 'TEXT' && m.characters?.trim()) lines.push(m.characters.trim()); });
    specs.push({ id: n.id, name: n.name.trim(), lines });
  }
});

const table = (rows, head) => rows.length ? [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n') : '_none_';
// state variants repeat per instance: group identical interactions
const grouped = new Map();
for (const i of interactions) { const k = [i.name, i.trigger, i.action, i.to, i.transition].join('|'); const g = grouped.get(k) ?? { ...i, count: 0, nodes: [] }; g.count++; g.nodes.push(i.node); grouped.set(k, g); }

const md = [
  `# Animations: ${ws.readJson('tree.json').name}`, '',
  '> **Backlog only. Nothing here is built.** Painting (structure, style, layout) comes first; the owner approves the look; then each item below is done as its own pass with its own check. Do not start it earlier.', '',
  '## Written by the designer (verbatim)', '',
  ...(specs.length ? specs.flatMap((s) => [`### ${s.name} [${s.id}]`, '', ...s.lines.map((l) => `> ${l.replace(/\n/g, '\n> ')}`), '']) : ['_no motion frame found in the page_', '']),
  '## Prototype interactions on the nodes', '',
  table([...grouped.values()].map((g) => [`${g.name} (${g.count}×, e.g. ${g.nodes[0]})`, g.trigger, g.action, g.to, g.transition]), ['node', 'trigger', 'action', 'goes to', 'transition']), '',
  '## Status', '', '| item | status |', '|---|---|', '| section entrance animation (designer spec above) | not built |', '| hover / state interactions (table above) | not built (no default hover, owner decision 2026-10-26) |', '| countdown ticking | built as a real Bricks countdown (behavior, not motion); frozen in checks |', '',
].join('\n');
ws.writeText('animations.md', md);
console.log(`  animations.md: ${specs.length} spec frame(s), ${grouped.size} distinct interaction(s), nothing built`);
