#!/usr/bin/env node
// AUTOPILOT: one Figma link in, a verified Bricks template out, no questions.
//   node process/auto.mjs "<figma-url of a section frame>" [--first-section] [--no-responsive] [--no-cross]
// fetch -> tree -> detect -> decide (rules + policy.json, decisions.md) -> find the tablet / mobile frames of the same section -> the same for each
// -> sign-off (autopilot) -> export -> build (merge breakpoints) -> push -> verify (Playwright: boxes, look vs Figma, covered, scroll, weight, engines).
// Owner decision 2026-10-27: "one Figma link and Bricks comes out"; review happens afterwards on scorecard.md + decisions.md, not before.
// It stops only for a real blocker (no token, no node, Docker down, citations the code cannot verify). Never touches git.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { resolveWorkspace } from './shared/workspace.mjs';
import { fetchStep } from './scripts/01-fetch.mjs';
import { treeStep } from './scripts/02-tree.mjs';
import { detectStep } from './scripts/03-detect.mjs';
import { decide, writeDecisionReport } from './decide/index.mjs';
import { discoverVariants } from './figma/discover.mjs';
import { signOff, gate } from './review/index.mjs';
import { parseFigmaUrl } from './figma/url.mjs';

import { writeFileSync } from 'node:fs';
import { discoverSections } from './figma/discover.mjs';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const responsive = !args.includes('--no-responsive');
const planOnly = args.includes('--plan');
const only = (args.find((a) => a.startsWith('--only=')) ?? '').slice(7).toLowerCase();
if (!url) { console.error('usage: node process/auto.mjs "<figma url of a page, a breakpoint frame or a section>" [--plan] [--only=<name>] [--no-responsive] [--no-cross]'); process.exit(1); }

const ref = parseFigmaUrl(url);
const urlOf = (id) => `https://www.figma.com/design/${ref.fileKey}/x?node-id=${id.replace(':', '-')}`;
const NOTE = 'AUTOPILOT (owner decision 2026-10-27: one Figma link -> Bricks, every decision follows the recommendation, review afterwards on scorecard.md and decisions.md)';

async function prepare(u, opts) {
  const ws = await fetchStep(u);
  treeStep(ws.dir);
  detectStep(ws.dir);
  const result = decide(ws, opts);
  writeDecisionReport(ws, result, ws.readJson('tree.json').name);
  detectStep(ws.dir); // validates the citations of what decide wrote
  return { ws, result };
}

// one section frame -> a verified template (and its tablet / mobile frames merged in)
async function runSection(sectionUrl, sectionId, { firstSection, bg }) {
  console.log(`\n== SECTION ${sectionUrl}`);
  const { ws: base, result } = await prepare(sectionUrl, { firstSection, variant: false, parentBg: bg });
  const context = { bg: { base: bg } };
  const variants = [];
  if (responsive) {
    const found = await discoverVariants(ref.fileKey, sectionId);
    console.log(`  base ${found.base.width}px · variants: ${found.variants.map((v) => `${v.key} ${v.width}px [${v.id}]`).join(', ') || 'none'}${found.others.length ? ` · ignored wide frames: ${found.others.join(', ')}` : ''}`);
    for (const v of found.variants) {
      const { ws } = await prepare(urlOf(v.id), { firstSection, variant: true, parentBg: v.bg ?? bg });
      context.bg[v.key] = v.bg ?? bg;
      variants.push({ key: v.key, workspace: ws.dir.split('/').pop(), maxWidth: v.maxWidth, aliases: {}, ws });
    }
    if (variants.length) base.writeJson('responsive.json', { note: 'written by process/auto.mjs (breakpoint frames of the same section found in the Figma file)', variants: variants.map(({ ws, ...v }) => v) });
  }
  base.writeJson('context.json', context); // what shows behind a transparent section, per frame: verify lays Figma's render over it
  // only a problem the code cannot verify (bad citations) blocks; anything else does not
  for (const w of [base, ...variants.map((v) => v.ws)]) {
    signOff(w, { by: 'autopilot', note: NOTE });
    const g = gate(w);
    if (!g.ok) throw new Error(`BLOCKED in ${w.dir}: ${g.reason}`);
  }
  const run = spawnSync('node', [join(dirname(new URL(import.meta.url).pathname), 'run.mjs'), sectionUrl, '--from=export', ...(args.includes('--no-cross') ? ['--no-cross'] : [])], { encoding: 'utf8', maxBuffer: 1 << 28 });
  for (const line of (run.stdout ?? '').split('\n')) if (/^\s+\[|rror|summary\.md|created template|updated template|exported/.test(line) && !/^\s+!/.test(line)) console.log(line.slice(0, 190));
  if (run.status !== 0 && !base.has('verify.json')) throw new Error(`run.mjs failed: ${(run.stderr || run.stdout).slice(-400)}`);

  const frames = [{ key: 'base', v: base.has('verify.json') ? base.readJson('verify.json') : null }, ...variants.map((v) => ({ key: v.key, v: base.has(`verify.${v.key}.json`) ? base.readJson(`verify.${v.key}.json`) : null }))];
  const state = base.readJson('state.json', {});
  const lines = [
    `# Scorecard: ${base.readJson('tree.json').name}`, '', `Template: ${state.builderUrl ?? 'not pushed'}`, '',
    '| frame | verdict | blocker / major / minor / negligible | look vs Figma (/255) | images (KB) | hidden images loaded (KB) | other browsers |', '|---|---|---|---|---|---|---|',
    ...frames.map(({ key, v }) => v ? `| ${key} | ${v.verdict ?? '-'} | ${v.tiers ? `${v.tiers[1]} / ${v.tiers[2]} / ${v.tiers[3]} / ${v.tiers[4]}` : '-'} | ${Math.round(v.visualMean * 100) / 100} | ${Math.round(v.imageBytes / 1024)} | ${Math.round(v.hiddenImageBytes / 1024)} | ${key === 'base' && v.engines ? Object.entries(v.engines).map(([k, e]) => `${k.split('.')[1]} ${Math.round(e.mean * 100) / 100}`).join(', ') : '-'} |` : `| ${key} | not verified | | | | | |`), '',
    '## What the checks cannot see / known limits', '',
    '- Text: Figma and the browser lay out text with different engines (1 to 2.5px per label); a different line break is a real mismatch and is listed.',
    '- Live parts (countdown) are masked; animation is not built (animations.md).', '',
    `## Decisions taken by rules (${result.decisions.length}): see decisions.md`, '', ...result.decisions.slice(0, 12).map((d) => `- ${d.kind}: ${d.node} -> ${d.decision} (${d.confidence})`), '',
    `## Needs a look (${result.needs.length})`, '', ...(result.needs.length ? result.needs.map((x) => `- ${x}`) : ['_none_']), '',
    '## For the designer', '', ...(result.designer.length ? [...new Set(result.designer)].map((x) => `- ${x}`) : ['_none_']), '',
  ];
  base.writeText('scorecard.md', lines.join('\n'));
  const bad = frames.reduce((s, f) => s + (f.v?.tiers ? f.v.tiers[1] + f.v.tiers[2] : (f.v?.bad.length ?? 0)), 0); // real problems = tier 1 + 2
  return { name: base.readJson('tree.json').name, id: sectionId, dir: base.dir, template: state.builderUrl, frames, bad, result };
}

console.log(`\n== AUTOPILOT ${url}`);
const plan = await discoverSections(ref.fileKey, ref.nodeId);
let sections = plan.sections.filter((s) => !only || s.name.toLowerCase().includes(only));
console.log(`  ${plan.kind}: base frame "${plan.base.name}" ${plan.base.width}px · ${sections.length} section(s): ${sections.map((s) => `${s.name} [${s.id}]${s.firstSection ? ' (h1)' : ''}`).join(' · ')}`);
if (planOnly) process.exit(0);

const done = [];
for (const s of sections) {
  try { done.push(await runSection(urlOf(s.id), s.id, { firstSection: s.firstSection, bg: plan.base.bg })); }
  catch (e) { console.error(`\n✋ ${s.name} [${s.id}] stopped: ${e.message.slice(0, 400)}`); done.push({ name: s.name, id: s.id, error: e.message.slice(0, 300), frames: [], bad: -1, result: { decisions: [], needs: [], designer: [] } }); }
}

// page report: one table, the designer list, everything that needs a look
const rows = done.map((d) => d.error ? `| ${d.name} | STOPPED: ${d.error.replace(/\|/g, '/').slice(0, 120)} | | | |` : `| ${d.name} | ${d.frames.map((f) => f.v ? `${f.key} ${f.v.verdict ?? ''} ${Math.round(f.v.visualMean * 100) / 100}` : `${f.key} -`).join(' · ')} | ${d.bad} | ${d.result.decisions.length} | ${d.template ?? ''} |`);
const page = [
  `# Page report: ${plan.base.name} (${ref.fileKey} ${ref.nodeId})`, '', `${done.length} section(s), base ${plan.base.width}px, tablet / mobile frames merged per section.`, '',
  '| section | verdict and look vs Figma (/255) per frame | blockers + major | decisions by rule | template |', '|---|---|---|---|---|', ...rows, '',
  '## For the designer', '', ...(() => { const all = done.flatMap((d) => d.result.designer.map((x) => `${d.name}: ${x}`)); return all.length ? all.map((x) => `- ${x}`) : ['_none_']; })(), '',
  '## Needs a look', '', ...(() => { const all = done.flatMap((d) => d.result.needs.map((x) => `${d.name}: ${x}`)); return all.length ? all.map((x) => `- ${x}`) : ['_none_']; })(), '',
  '## Where to look', '', ...done.filter((d) => d.dir).map((d) => `- ${d.name}: ${d.dir}/scorecard.md, decisions.md, verify*.diff.png`), '',
];
const out = join(dirname(done.find((d) => d.dir)?.dir ?? '.'), `page-${ref.nodeId.replace(':', '-')}.md`);
writeFileSync(out, page.join('\n'));
console.log(`\n== done: ${out}`);
process.exitCode = done.some((d) => d.error) ? 2 : 0;
