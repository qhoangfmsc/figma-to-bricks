#!/usr/bin/env node
// The owner's console for the review gate. Edits detections.json safely (validated), shows the status, signs off, keeps a log.
//   node process/scripts/review.mjs <figma-url | workspace-dir> status
//   node process/scripts/review.mjs <ws> approve <ids|component=tooltip|all>      ids: d1 d3 d5-d9
//   node process/scripts/review.mjs <ws> reject  <ids|component=tooltip|all>
//   node process/scripts/review.mjs <ws> set <id> key=value [key=value …]          params, e.g.  set d3 text="Số tên miền" link=https://…
//   node process/scripts/review.mjs <ws> signoff "<note>"                          the owner's OK: unlocks export / build / push / verify
//   node process/scripts/review.mjs <ws> log "<feedback>" "<what was changed>"     revision log (revisions.md)
// Any change to a decision voids an earlier sign-off (see review/index.mjs).
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolveWorkspace } from '../shared/workspace.mjs';
import { gate, signOff, counts } from '../review/index.mjs';
import { validate } from '../detect/index.mjs';
import { COMPONENTS } from '../bricks/components/index.mjs';

const args = process.argv.slice(2);
const ws = resolveWorkspace(args[0]);
const [cmd, ...rest] = args.slice(1);

function select(det, tokens) {
  const out = new Set();
  for (const t of tokens) {
    let m;
    if (t === 'all') det.components.forEach((c) => out.add(c.id));
    else if ((m = t.match(/^component=(.+)$/))) det.components.filter((c) => c.component === m[1]).forEach((c) => out.add(c.id));
    else if ((m = t.match(/^d(\d+)-d?(\d+)$/))) for (let i = +m[1]; i <= +m[2]; i++) out.add(`d${i}`);
    else out.add(t);
  }
  const known = new Set(det.components.map((c) => c.id));
  const bad = [...out].filter((id) => !known.has(id));
  if (bad.length) throw new Error(`unknown detection id(s): ${bad.join(', ')}`);
  return [...out];
}

function status(det) {
  const c = counts(det);
  const g = gate(ws);
  console.log(`  components: ${c.approved} approved · ${c.rejected} rejected · ${c.proposed} still proposed (stay blocks)`);
  console.log(`  review gate: ${g.ok ? `OPEN (signed off ${g.review.signedOffAt}${g.review.note ? `: ${g.review.note}` : ''})` : `CLOSED: ${g.reason}`}`);
}

const det = ws.readJson('detections.json');
const save = () => { ws.writeJson('detections.json', det); console.log('  detections.json saved (any earlier sign-off is void now)'); };

switch (cmd) {
  case 'status': status(det); break;
  case 'approve': case 'reject': {
    const ids = select(det, rest);
    for (const c of det.components.filter((x) => ids.includes(x.id))) {
      c.status = cmd === 'approve' ? 'approved' : 'rejected';
      if (cmd === 'approve' && COMPONENTS[c.component]?.status !== 'implemented') console.log(`    ! ${c.id}: ${c.component} is ${COMPONENTS[c.component]?.status}, it will stay a block`);
    }
    console.log(`  ${cmd}d ${ids.length}: ${ids.length > 8 ? ids.slice(0, 8).join(' ') + ' …' : ids.join(' ')}`);
    save(); status(det); break;
  }
  case 'set': {
    const [id, ...kv] = rest;
    const c = det.components.find((x) => x.id === id);
    if (!c) throw new Error(`unknown detection id ${id}`);
    for (const pair of kv) {
      const i = pair.indexOf('=');
      if (i < 1) throw new Error(`expected key=value, got "${pair}"`);
      const k = pair.slice(0, i), v = pair.slice(i + 1);
      const val = /^[\[{]/.test(v) ? JSON.parse(v) : v; // fields=[…] / settings={…} arrive as JSON
      if (k === 'node') c.node = v; else (c.params ??= {})[k] = val;
    }
    console.log(`  ${id}: ${JSON.stringify({ node: c.node, ...c.params })}`);
    save(); break;
  }
  case 'signoff': {
    const r = signOff(ws, { note: rest.join(' ') });
    console.log(`  SIGNED OFF ${r.signedOffAt}: ${r.counts.approved} approved, ${r.counts.rejected} rejected, ${r.counts.proposed} proposed (stay blocks)`);
    const unresolved = validate(det, ws.readJson('tree.json'));
    if (unresolved.length) console.log(unresolved.map((p) => `    ! ${p}`).join('\n'));
    break;
  }
  case 'log': {
    const [feedback, change] = rest;
    if (!feedback) throw new Error('usage: log "<feedback>" "<what was changed>"');
    const file = ws.file('revisions.md');
    if (!existsSync(file)) writeFileSync(file, '# Revisions\n\nOne entry per piece of owner feedback after a build: what was said, what was changed, why.\n\n');
    appendFileSync(file, `- **${new Date().toISOString().slice(0, 16).replace('T', ' ')}** ${feedback}\n  → ${change ?? '(no change yet)'}\n`);
    console.log('  logged in revisions.md'); break;
  }
  default:
    console.log('usage: review.mjs <workspace> status | approve <ids> | reject <ids> | set <id> k=v | signoff "<note>" | log "<feedback>" "<change>"');
    process.exitCode = 1;
}
