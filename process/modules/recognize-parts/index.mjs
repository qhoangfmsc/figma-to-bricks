// STEP 3 logic: find candidate sections / components in tree.json and keep the human decisions in detections.json.
//
// detections.json (committed, per workspace) is the ONLY place where "this node is a tooltip / button / …" is decided:
//   sections    [{ id, node, name, summary, source }]                       what the page is made of (AI pass + human)
//   components  [{ id, component, node, status, source, confidence, evidence, params, note }]
//     status    proposed (default, not applied) · approved (the build turns the node into the component) · rejected (stays a block)
//     source    rule (found by detect/rules/*) · ai (written by the AI pass) · human
// Rules never overwrite an existing entry, so approvals / rejections / params survive every re-run.
import { detectSections } from '../recognize-parts/rules/sections.mjs';
import { detectTooltips } from '../recognize-parts/rules/tooltip.mjs';
import { detectButtons } from '../recognize-parts/rules/button.mjs';
import { detectFlatImages } from '../recognize-parts/rules/flat-image.mjs';
import { detectCarousels } from '../recognize-parts/rules/carousel.mjs';
import { detectForms } from '../recognize-parts/rules/form.mjs';
import { detectAccordions } from '../recognize-parts/rules/accordion.mjs';
import { detectTabs } from '../recognize-parts/rules/tabs.mjs';
import { detectTabSwitches } from '../recognize-parts/rules/tab-switch.mjs';
import { detectMenus } from '../recognize-parts/rules/menu.mjs';
import { detectReadMore } from '../recognize-parts/rules/readmore.mjs';
import { detectChoices } from '../recognize-parts/rules/choice.mjs';
import { detectDividers } from '../recognize-parts/rules/divider.mjs';
import { detectMedia } from '../recognize-parts/rules/media.mjs';
import { detectProduction } from '../recognize-parts/rules/production-widgets.mjs';
import { COMPONENTS } from '../write-bricks/components/index.mjs';
import { partRule } from '../recognize-parts/kinds.mjs';
import { checkCites, findNode } from '../recognize-parts/cite.mjs';

export const STATUSES = ['proposed', 'approved', 'rejected'];
export const emptyDetections = () => ({ version: 1, sections: [], components: [] });

export { findNode } from '../recognize-parts/cite.mjs';

// names from the root down to the node
export function nodePath(tree, id, trail = []) {
  const here = [...trail, tree.name];
  if (tree.id === id) return here;
  for (const c of tree.children ?? []) { const p = nodePath(c, id, here); if (p) return p; }
  return null;
}

export function runRules(tree) {
  const components = [...detectTooltips(tree), ...detectButtons(tree), ...detectFlatImages(tree), ...detectCarousels(tree), ...detectForms(tree), ...detectAccordions(tree), ...detectTabs(tree), ...detectTabSwitches(tree), ...detectMenus(tree), ...detectReadMore(tree), ...detectChoices(tree), ...detectDividers(tree), ...detectMedia(tree), ...detectProduction(tree)].map((c) => ({ status: 'proposed', source: 'rule', kind: c.component, ...c }));
  const claimed = new Set();
  for (const c of components) {
    if (c.component !== 'search') continue;
    if (c.params?.fieldNode) claimed.add(c.params.fieldNode);
    if (c.params?.buttonNode) claimed.add(c.params.buttonNode);
  }
  return {
    sections: detectSections(tree),
    components: components.filter((c) => !(c.component === 'button' && claimed.has(c.node))),
  };
}

// existing wins; new candidates get the next free id
export function mergeDetections(existing, found) {
  const out = { ...emptyDetections(), ...existing, components: [...(existing.components ?? [])], sections: [...(existing.sections ?? [])] };
  const key = (c) => `${c.component}|${c.node}`;
  const have = new Set(out.components.map(key));
  let n = Math.max(0, ...out.components.map((c) => Number(String(c.id).replace(/\D/g, '')) || 0));
  const added = [];
  const claimedPopups = new Set(out.components.map((c) => c.params?.popup).filter(Boolean));
  for (const c of found.components) {
    if (have.has(key(c)) || (c.params?.popup && claimedPopups.has(c.params.popup))) {
      // facts a rule can refresh (evidence, citations, level) never touch decisions (status, params, node, note)
      const old = out.components.find((o) => o.source === 'rule' && key(o) === key(c));
      if (old) Object.assign(old, { evidence: c.evidence, cite: c.cite, level: c.level, confidence: c.confidence });
      continue;
    }
    const entry = { id: `d${++n}`, ...c };
    out.components.push(entry);
    added.push(entry);
  }
  if (!out.sections.length) out.sections = found.sections;
  return { detections: out, added };
}

export function validate(det, tree) {
  const problems = [];
  const ids = new Set();
  for (const c of det.components) {
    const where = `${c.id} (${c.component} on ${c.node})`;
    if (ids.has(c.id)) problems.push(`${c.id}: duplicate id`);
    ids.add(c.id);
    if (!STATUSES.includes(c.status)) problems.push(`${where}: status "${c.status}" must be ${STATUSES.join(' | ')}`);
    if (!findNode(tree, c.node)) problems.push(`${where}: the node is not in the tree any more (stale)`);
    for (const p of checkCites(c.cite, tree)) problems.push(`${where}: ${p}`);
    if (c.source === 'ai' && !(c.cite?.length)) problems.push(`${where}: an AI candidate must cite what it saw in the tree (cite: [{ node, field, equals }]); it cannot be approved without`);
    if (c.source === 'rule' && !partRule(c.kind ?? c.component)) problems.push(`${where}: no shape rule for "${c.component}"`);
    const comp = COMPONENTS[c.component];
    if (!comp) problems.push(`${where}: unknown component "${c.component}" (known: ${Object.keys(COMPONENTS).join(', ')})`);
    else if (c.status === 'approved' && comp.status !== 'implemented') problems.push(`${where}: approved but "${c.component}" is ${comp.status}: the node stays a block`);
  }
  for (const s of det.sections) if (!findNode(tree, s.node)) problems.push(`section ${s.id}: node ${s.node} is not in the tree`);
  return problems;
}

// node id -> approved entry (what the build applies)
export const approvedByNode = (det) => new Map((det?.components ?? []).filter((c) => c.status === 'approved').map((c) => [c.node, c]));
