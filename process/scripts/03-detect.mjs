#!/usr/bin/env node
// STEP 3  tree.json -> detections.json + detections.md.  Find what the section is made of and which nodes are really a component
// (tooltip, button, …) instead of plain blocks. Rules propose candidates; the AI pass (see AI-GUIDE.md) adds the ones rules cannot see;
// a HUMAN approves or rejects each one in detections.json. The build (step 4) applies only `approved` entries.
//   node process/scripts/03-detect.mjs <figma-url | workspace-dir>
// Also writes facts.json / facts.md (a deterministic inventory every detection must be able to cite) and ends at the REVIEW GATE.
import { resolveWorkspace } from '../shared/workspace.mjs';
import { emptyDetections, mergeDetections, runRules, validate } from '../detect/index.mjs';
import { renderReview } from '../detect/review-md.mjs';
import { buildFacts, renderFacts } from '../facts/index.mjs';
import { gate } from '../review/index.mjs';

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

  const count = (st) => detections.components.filter((c) => c.status === st).length;
  console.log(`  detections.json + detections.md  (${detections.sections.length} sections · components: ${count('proposed')} to review, ${count('approved')} approved, ${count('rejected')} rejected; ${added.length} new this run)`);
  for (const c of added) console.log(`    + ${c.id} ${c.component} ${c.node}: ${c.evidence}`);
  for (const p of problems) console.log(`    ! ${p}`);
  const g = gate(ws);
  console.log(`  review gate: ${g.ok ? 'open (signed off)' : 'CLOSED, the owner has to review detections.md and sign off before export / build'}`);
  return ws;
}

if (import.meta.url === `file://${process.argv[1]}`) detectStep(process.argv[2]);
