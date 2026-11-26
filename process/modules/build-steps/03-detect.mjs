#!/usr/bin/env node
// STEP 3  tree.json -> detections.json + facts.json. Rules measure structure the build can paint.
// A proposed row is not a component. The picture names the component. The build applies only `approved` entries.
//   node process/modules/build-steps/03-detect.mjs <figma-url | workspace-dir>
// Also writes facts.json / facts.md (a deterministic inventory every detection must be able to cite) and ends at the REVIEW GATE.
import { resolveWorkspace } from '../common/workspace.mjs';
import { emptyDetections, mergeDetections, runRules, validate } from '../recognize-parts/index.mjs';
import { renderReview } from '../recognize-parts/review-md.mjs';
import { buildFacts, renderFacts } from '../recognize-parts/facts.mjs';
import { gate } from '../sign-off/index.mjs';
import { isSignal } from '../recognize-parts/kinds.mjs';

export function detectStep(urlOrDir) {
  const ws = resolveWorkspace(urlOrDir);
  const tree = ws.readJson('tree.json');
  const { detections, added } = mergeDetections(ws.readJson('detections.json', emptyDetections()), runRules(tree));
  const problems = validate(detections, tree);
  const facts = buildFacts(tree);

  ws.writeJson('detections.json', detections);
  ws.writeJson('facts.json', facts);
  ws.writeText('facts.md', renderFacts(facts));
  ws.writeText('detections.md', renderReview(tree, detections, problems, facts, { fileKey: ws.ref?.fileKey }));

  const count = (st) => detections.components.filter((c) => c.status === st && !isSignal(c.component)).length;
  const hints = detections.components.filter((c) => isSignal(c.component)).length;
  console.log(`  detections.json + detections.md  (${detections.sections.length} sections · components: ${count('proposed')} to review, ${count('approved')} approved, ${count('rejected')} rejected; ${added.filter((c) => !isSignal(c.component)).length} new this run; ${hints} hints)`);
  for (const c of added) console.log(`    ${isSignal(c.component) ? 'hint' : '+'} ${c.id} ${c.component} ${c.node}: ${c.evidence}`);
  for (const p of problems) console.log(`    ! ${p}`);
  const g = gate(ws);
  console.log(`  review gate: ${g.ok ? 'open (signed off)' : 'CLOSED, the owner has to review detections.md and sign off before export / build'}`);
  return ws;
}

if (import.meta.url === `file://${process.argv[1]}`) detectStep(process.argv[2]);
