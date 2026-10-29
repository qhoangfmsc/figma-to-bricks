// The state of every checked node of a frame: is it right, a known limit, or still wrong? Written by 07-verify next to verify.json, read by todo.mjs.
//   ok          every check of the node matches Figma
//   minor       only tier-3 differences (listed, they do not hold the section back)
//   limit       a difference that is accepted on purpose: the text-engine class (within 2.5px, automatic) or an entry of limits.json with its reason and the measured
//               value it was accepted at. A different value later is a NEW failure, never silently covered by the old reason
//   fail        a tier 1 / tier 2 difference that is not accepted: this is the work that is left
// The fingerprint says which input the state was measured on (Figma node + Bricks element + its parent), so a later run can tell which nodes really changed.
import { createHash } from 'node:crypto';

const sha = (v) => createHash('sha1').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 12);

// the part of a tree node that decides how it is built (children are their own nodes)
const own = (n) => { const { children, ...rest } = n ?? {}; return rest; };
export const fingerprintOf = (treeNode, element, parentElement) => sha({ node: own(treeNode), el: element?.settings ?? null, parent: parentElement?.settings ?? null });

const numeric = (v) => (/^-?[\d.]+(px)?$/.test(String(v ?? '')) ? parseFloat(v) : null);
const sameValue = (a, b) => { const x = numeric(a), y = numeric(b); return x !== null && y !== null ? Math.abs(x - y) <= 0.5 : String(a) === String(b); };

// does an accepted limit (limits.json) cover this failing row? Same node, same check, and the value measured now is the one that was accepted
export function acceptedBy(limits, row) {
  const direct = (limits ?? []).find((l) => !l.cascade && l.node === row.id && (!l.check || l.check === row.check) && (l.got === undefined || sameValue(l.got, row.got)));
  if (direct) return direct;
  // a consequence: y / h moved by exactly the amount a root node that is itself accepted moved everything below it (a heading with one more line: +36)
  const want = numeric(row.want), got = numeric(row.got);
  if (want === null || got === null || !['y', 'h', 'height'].includes(row.check)) return undefined;
  const c = (limits ?? []).find((l) => l.cascade && (l.checks ?? ['y', 'h', 'height']).includes(row.check) && Math.abs(got - want - l.delta) <= 0.5
    && (limits ?? []).some((r) => !r.cascade && r.node === l.root));
  return c && { ...c, reason: `follows from ${c.root}: ${c.reason}` };
}

// rows: the rows of ONE frame (each with id, check, want, got, ok, soft, tier); items: the nodes that were checked
export function computeStates({ rows, items, fingerprints = {}, limits = [], previous = {} }) {
  const byId = new Map();
  for (const r of rows) if (r.id) (byId.get(r.id) ?? byId.set(r.id, []).get(r.id)).push(r);
  const nodes = {};
  for (const it of items) {
    const mine = byId.get(it.figmaId) ?? [];
    const failing = mine.filter((r) => !r.ok);
    let state = 'ok', reason, accepted;
    const hard = failing.filter((r) => !r.soft && r.tier <= 2);
    const minor = failing.filter((r) => !r.soft && r.tier === 3);
    const engine = failing.filter((r) => r.soft);
    const open = [];
    for (const r of hard) { const a = acceptedBy(limits, r); if (a) (accepted ??= []).push({ check: r.check, reason: a.reason }); else open.push(r); }
    if (open.length) state = 'fail';
    else if (accepted) { state = 'limit'; reason = accepted.map((a) => a.reason)[0]; }
    else if (minor.length) state = 'minor';
    else if (engine.length) { state = 'limit'; reason = 'text-engine difference within 2.5px'; }
    const prev = previous[it.figmaId];
    nodes[it.figmaId] = {
      state, element: it.element, fp: fingerprints[it.figmaId] ?? null,
      ...(open.length || minor.length ? { checks: [...open, ...minor].map((r) => ({ check: r.check, want: r.want, got: r.got, tier: r.tier })) } : {}),
      ...(reason && { reason }),
      ...(prev && prev.state !== state ? { was: prev.state } : {}),
      ...(prev && prev.fp && prev.fp !== (fingerprints[it.figmaId] ?? null) ? { changed: true } : {}),
    };
  }
  return nodes;
}

export const summarize = (nodes) => Object.values(nodes).reduce((a, n) => ((a[n.state] = (a[n.state] ?? 0) + 1), a), { total: Object.keys(nodes).length });

// the section is done when nothing is left to do: no failing node, and no tier 1 / 2 row outside the nodes (look regions, page checks) that is not accepted.
// The look regions of a frame are accepted as a whole by an entry { node: "look", reason, maxMean }: only while the mean difference is not worse than that.
export function frameDone({ nodes, rows, limits = [], visualMean = null }) {
  const failNodes = Object.values(nodes).filter((n) => n.state === 'fail').length;
  const look = (limits ?? []).find((l) => l.node === 'look');
  const lookAccepted = !!look && visualMean !== null && visualMean <= look.maxMean;
  const looseOpen = rows.filter((r) => !r.ok && !r.soft && !r.id && r.tier <= 2 && !(lookAccepted && r.check === 'vs Figma render'));
  return { done: failNodes === 0 && looseOpen.length === 0, failNodes, looseOpen: looseOpen.length, lookAccepted };
}
