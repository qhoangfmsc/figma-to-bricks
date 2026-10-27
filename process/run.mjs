#!/usr/bin/env node
// Runs the whole pipeline for one Figma node.
//   node process/run.mjs <figma-url>                       fetch → tree → build → push → verify
//   node process/run.mjs <figma-url> --from=build          re-run from a step (fetch|tree|detect|export|build|push|verify), e.g. after editing overrides.json
//   node process/run.mjs <figma-url> --only=tree           a single step
//   node process/run.mjs <figma-url> --fixture <dir>       offline fetch from a saved fixture
//   node process/run.mjs <figma-url> --strict              fail on any warning / unhandled property
import { fetchStep } from './scripts/01-fetch.mjs';
import { treeStep } from './scripts/02-tree.mjs';
import { detectStep } from './scripts/03-detect.mjs';
import { exportStep } from './scripts/04-export.mjs';
import { buildStep } from './scripts/05-build.mjs';
import { pushStep } from './scripts/06-push.mjs';
import { verifyStep } from './scripts/07-verify.mjs';
import { summaryStep } from './scripts/08-summary.mjs';
import { dirname, join } from 'node:path';
import { resolveWorkspace } from './shared/workspace.mjs';
import { gate } from './review/index.mjs';

const args = process.argv.slice(2);
const flag = (name) => (args.find((a) => a.startsWith(`--${name}=`)) ?? '').split('=')[1];
const fx = args.indexOf('--fixture');
const fixture = fx >= 0 ? args.splice(fx, 2)[1] : undefined;
const target = args.find((a) => !a.startsWith('--'));
const strict = args.includes('--strict');

const STEPS = ['fetch', 'tree', 'detect', 'export', 'build', 'push', 'verify'];
const only = flag('only');
const from = flag('from');
const run = only ? [only] : STEPS.slice(from ? STEPS.indexOf(from) : 0);
if (run.some((s) => !STEPS.includes(s))) throw new Error(`steps: ${STEPS.join(', ')}`);

const ws = resolveWorkspace(target);
const impl = {
  fetch: () => fetchStep(target, { fixture }),
  tree: () => treeStep(ws.dir),
  detect: () => detectStep(ws.dir),
  export: async () => { await exportStep(ws.dir); for (const v of ws.readJson('responsive.json', { variants: [] }).variants) { console.log(`  [${v.key}]`); await exportStep(join(dirname(ws.dir), v.workspace)); } },
  build: () => buildStep(ws.dir, { strict }),
  push: () => pushStep(ws.dir),
  verify: () => verifyStep(ws.dir, { cross: !args.includes('--no-cross') }),
};

const GATED = new Set(['export', 'build', 'push', 'verify']);
let waiting = false;
for (const step of run) {
  if (GATED.has(step) && !waiting) {
    const g = gate(ws);
    if (!g.ok) {
      waiting = true;
      console.log(`\n⏸  REVIEW GATE (before ${step}): ${g.reason}`);
      console.log(`   Compare ${ws.dir}/detections.md (and facts.md) with the Figma file, correct it, then sign off:`);
      console.log(`   node process/scripts/review.mjs "${ws.dir}" status | approve <ids> | reject <ids> | set <id> k=v | signoff "<note>"`);
      console.log(`   then: node process/run.mjs "${target}" --from=export`);
      process.exitCode = 2;
    }
  }
  if (waiting) break;
  console.log(`\n[${STEPS.indexOf(step) + 1}/${STEPS.length}] ${step}`);
  await impl[step]();
  if (process.exitCode && step !== 'verify') break;
}
if (!waiting && (run.includes('verify') || run.includes('build'))) summaryStep(ws.dir);
console.log(`\nworkspace: ${ws.dir}`);
