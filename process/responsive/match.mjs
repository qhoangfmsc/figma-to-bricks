// Match the nodes of one Figma frame (a breakpoint variant) with the nodes of the base frame, so that the SAME Bricks element can carry
// the values of every breakpoint. Deterministic, no guessing beyond what is written here:
//   1. the roots are a pair;
//   2. an explicit alias (variant id -> base id, written in responsive.json by whoever reads both frames: the node was renamed) wins;
//   3. among the children of a matched pair, children with the same NAME pair in order ("Speaker / Details" #1 with #1, ...);
//   4. a variant child still unpaired is looked up by name among the not yet paired DESCENDANTS of its parent's partner, only when that name
//      is unique there (a node moved into / out of a wrapper, e.g. a countdown that lost its "Frame 2147225847" wrapper on mobile).
// Result: { pairs: Map(variantId -> baseId), unmatchedVariant: [node], unmatchedBase: [node] }. Hidden nodes take no part.
const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);

function descendants(n, out = []) {
  for (const c of visibleKids(n)) { out.push(c); descendants(c, out); }
  return out;
}

export function matchTrees(base, variant, { aliases = {} } = {}) {
  const pairs = new Map();
  const claimed = new Set(); // base ids already paired
  const byId = (root) => { const m = new Map(); (function rec(n) { m.set(n.id, n); visibleKids(n).forEach(rec); })(root); return m; };
  const baseById = byId(base);

  const pair = (v, b) => { pairs.set(v.id, b.id); claimed.add(b.id); };

  function walk(b, v) {
    const bKids = visibleKids(b);
    const vKids = visibleKids(v);
    const free = bKids.filter((k) => !claimed.has(k.id));
    const matched = [];
    for (const vk of vKids) { // aliases first
      const alias = aliases[vk.id] && baseById.get(aliases[vk.id]);
      if (alias && !claimed.has(alias.id)) { pair(vk, alias); matched.push([alias, vk]); }
    }
    for (const vk of vKids) { // same name, in order
      if (pairs.has(vk.id)) continue;
      const i = free.findIndex((k) => !claimed.has(k.id) && k.name === vk.name);
      if (i >= 0) { pair(vk, free[i]); matched.push([free[i], vk]); }
    }
    for (const vk of vKids) { // moved: unique name among the free descendants of the partner
      if (pairs.has(vk.id)) continue;
      const hits = descendants(b).filter((d) => !claimed.has(d.id) && d.name === vk.name);
      const sameInVariant = vKids.filter((k) => k.name === vk.name).length;
      if (hits.length === 1 && sameInVariant === 1) { pair(vk, hits[0]); matched.push([hits[0], vk]); }
    }
    for (const [bk, vk] of matched) walk(bk, vk);
  }
  pair(variant, base);
  walk(base, variant);

  const all = (root) => { const out = []; (function rec(n) { out.push(n); visibleKids(n).forEach(rec); })(root); return out; };
  const baseIds = new Set(pairs.values());
  return {
    pairs,
    unmatchedVariant: all(variant).filter((n) => !pairs.has(n.id)),
    unmatchedBase: all(base).filter((n) => !baseIds.has(n.id)),
  };
}
