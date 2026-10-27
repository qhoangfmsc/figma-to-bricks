// The review gate. Nothing is built, exported or pushed until the OWNER has looked at the Figma file next to detections.md
// and signed off. A sign-off is bound to what was reviewed (a fingerprint of tree.json + the decisions in detections.json): change
// either one and the sign-off is void, so the build can never run on something the owner did not see.
//   review.json = { signedOffAt, by, note, fingerprint: { tree, decisions }, counts }
// `decisions` hashes only what changes the build (component, node, status, params); notes / evidence wording do not void it.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validate } from '../detect/index.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

export function fingerprint(ws) {
  const tree = readFileSync(ws.file('tree.json'), 'utf8');
  const det = ws.readJson('detections.json', { components: [] });
  const decisions = det.components.map((c) => ({ id: c.id, component: c.component, node: c.node, status: c.status, params: c.params ?? {} }));
  return { tree: sha(tree), decisions: sha(JSON.stringify(decisions)) };
}

export function counts(det) {
  const c = (s) => det.components.filter((x) => x.status === s).length;
  return { approved: c('approved'), rejected: c('rejected'), proposed: c('proposed') };
}

export function gate(ws) {
  if (!ws.has('detections.json')) return { ok: false, reason: 'detections.json is missing: run the detect step first' };
  const det = ws.readJson('detections.json');
  const problems = validate(det, ws.readJson('tree.json'));
  if (problems.length) return { ok: false, reason: `detections.json has ${problems.length} problem(s), see detections.md:\n    - ${problems.slice(0, 5).join('\n    - ')}` };
  if (!ws.has('review.json')) return { ok: false, reason: 'the owner has not signed off the review yet' };
  const r = ws.readJson('review.json');
  const now = fingerprint(ws);
  if (r.fingerprint?.tree !== now.tree) return { ok: false, reason: 'the Figma tree changed after the sign-off: review again' };
  if (r.fingerprint?.decisions !== now.decisions) return { ok: false, reason: 'detections (status / params) changed after the sign-off: review again' };
  return { ok: true, review: r };
}

export function signOff(ws, { by = 'owner', note = '' } = {}) {
  const det = ws.readJson('detections.json');
  const problems = validate(det, ws.readJson('tree.json'));
  if (problems.length) throw new Error(`cannot sign off, fix first:\n  - ${problems.join('\n  - ')}`);
  const r = { signedOffAt: new Date().toISOString(), by, note, fingerprint: fingerprint(ws), counts: counts(det) };
  ws.writeJson('review.json', r);
  return r;
}

// every step after detect calls this first
export function requireSignOff(ws, step) {
  const g = gate(ws);
  if (g.ok) return g.review;
  const e = new Error(`REVIEW REQUIRED before "${step}": ${g.reason}\n  1. open process/work/<file>/<node>/detections.md and compare it with the Figma file (links inside)\n  2. correct it (tell Claude, or: node process/scripts/review.mjs <workspace> approve|reject <ids>)\n  3. sign off: node process/scripts/review.mjs <workspace> signoff "<note>"  (only the owner does this)`);
  e.code = 'REVIEW_REQUIRED';
  throw e;
}
