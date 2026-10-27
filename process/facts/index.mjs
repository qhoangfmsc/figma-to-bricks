// tree.json -> facts.json: a DETERMINISTIC inventory of what the designer declared and what the structure shows.
// No judgment here. The AI pass and the detect rules read these facts (compact) instead of the 5000-line tree, and every claim they
// make must cite something that can be re-read from the tree (see detect/cite.mjs).
//   components   instances grouped by Figma component: how many, which variants, which properties and their values
//   repeats      sibling groups with the same structure (>= 3): lists, grids, cards
//   headings     text styles named H1..H6 in tree order = the heading outline
//   interactions prototype triggers (hover / click) the designer drew
//   tokens       text / fill / stroke styles in use
//   hygiene      how trustworthy the layer names are
//   container    artboard vs content width
const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const GENERIC = /^(Frame|Group|Rectangle|Vector|Ellipse|Line|Text|Component|Instance|Polygon|Star)( \d+)?$|^(Frame|Group) \d{6,}$/i;

export function buildFacts(tree) {
  const all = [];
  (function rec(n, parent, hidden) { all.push({ n, parent, hidden: hidden || n.visible === false }); (n.children ?? []).forEach((c) => rec(c, n, hidden || n.visible === false)); })(tree, null, false);
  const live = all.filter((x) => !x.hidden);

  // components
  const comps = new Map();
  for (const { n, hidden } of all) {
    if (!n.component && !n.props) continue;
    const key = n.componentSet ?? n.component ?? n.name;
    const c = comps.get(key) ?? { name: key, instances: 0, visible: 0, variants: {}, props: {}, ids: [] };
    comps.set(key, c);
    c.instances++;
    if (!hidden) c.visible++;
    if (n.component) c.variants[n.component] = (c.variants[n.component] ?? 0) + 1;
    for (const [k, v] of Object.entries(n.props ?? {})) { const p = (c.props[k] ??= {}); p[String(v)] = (p[String(v)] ?? 0) + 1; }
    if (c.ids.length < 5) c.ids.push(n.id);
  }

  // repeated sibling structures
  const sig = (n) => `${n.type}[${visibleKids(n).map(sig).join(',')}]`;
  const repeats = [];
  for (const { n } of live) {
    const groups = new Map();
    for (const k of visibleKids(n)) { const s = sig(k); (groups.get(s) ?? groups.set(s, []).get(s)).push(k); }
    for (const [s, list] of groups) {
      if (list.length >= 3 && s.length > 12) repeats.push({ parent: n.id, parentName: n.name, count: list.length, itemName: list[0].name, itemType: list[0].type, ids: list.map((k) => k.id) });
    }
  }
  // keep the outermost group of nested identical repeats (13 rows, not 13 x their cells)
  const repeatsTop = repeats.filter((r) => !repeats.some((o) => o !== r && o.ids.some((id) => r.parent === id)));

  // headings
  const headings = live.filter(({ n }) => n.type === 'TEXT' && /^H([1-6])(\b|\/)/.test(n.styleRefs?.text ?? '') && !n.svg)
    .map(({ n }) => ({ node: n.id, level: Number(n.styleRefs.text.match(/^H([1-6])/)[1]), style: n.styleRefs.text, text: n.text?.characters?.trim() }));

  // prototype
  const interactions = live.filter(({ n }) => n.interactions).map(({ n }) => ({ node: n.id, name: n.name, componentSet: n.componentSet, interactions: n.interactions }));

  // tokens
  const tokens = {};
  for (const { n } of live) for (const [k, v] of Object.entries(n.styleRefs ?? {})) { const t = (tokens[k] ??= {}); t[v] = (t[v] ?? 0) + 1; }

  const generic = all.filter(({ n }) => GENERIC.test(n.name)).length;
  const kids0 = visibleKids(tree);
  return {
    root: { id: tree.id, name: tree.name, width: tree.box.w, height: tree.box.h },
    container: { artboard: tree.box.w, content: kids0.length === 1 ? kids0[0].box.w : null },
    counts: { nodes: all.length, hidden: all.filter((x) => x.hidden).length, text: live.filter(({ n }) => n.type === 'TEXT').length },
    components: [...comps.values()].sort((a, b) => b.instances - a.instances),
    repeats: repeatsTop,
    headings,
    interactions,
    tokens,
    hygiene: { genericNames: generic, genericPct: Math.round((generic / all.length) * 100), unhandled: [...new Set(all.flatMap(({ n }) => n.unhandled ?? []))] },
  };
}

const ids = (l) => (l.length > 4 ? `${l.slice(0, 3).join(', ')} … +${l.length - 3}` : l.join(', '));
export function renderFacts(f) {
  const L = [`# Facts: ${f.root.name} [${f.root.id}]`, '', 'Deterministic inventory of the tree (no judgment). Detections must cite these or the tree; see `detections.md`.', ''];
  L.push(`Artboard ${f.container.artboard}px${f.container.content ? `, content ${f.container.content}px` : ''} · ${f.counts.nodes} nodes (${f.counts.hidden} hidden) · ${f.counts.text} visible texts · ${f.hygiene.genericPct}% of layer names are Figma defaults`, '');
  L.push('## Components the designer used', '', '| component | instances (visible) | variants | properties (value: count) |', '|---|---|---|---|');
  for (const c of f.components) {
    const props = Object.entries(c.props).map(([k, v]) => `${k} = ${Object.entries(v).map(([val, n]) => `${val}: ${n}`).join(', ')}`).join('<br>');
    L.push(`| **${c.name}** | ${c.instances} (${c.visible}) | ${Object.entries(c.variants).map(([k, n]) => `${k} ×${n}`).join('<br>')} | ${props} |`);
  }
  L.push('', '## Repeated structures (lists / grids / cards)', '', '| parent | repeated item | count | ids |', '|---|---|---|---|');
  for (const r of f.repeats) L.push(`| ${r.parentName} \`${r.parent}\` | ${r.itemType} "${r.itemName}" | ${r.count} | ${ids(r.ids)} |`);
  L.push('', '## Heading outline (text styles H1..H6)', '', ...(f.headings.length ? f.headings.map((h) => `- h${h.level} \`${h.node}\` (${h.style}): ${h.text}`) : ['_none_']));
  L.push('', '## Prototype interactions (behavior the designer drew)', '', ...(f.interactions.length ? f.interactions.map((i) => `- ${i.name} \`${i.node}\`: ${i.interactions.map((x) => `${x.trigger} → ${x.action} ${x.navigation ?? ''} ${x.dest ?? ''}`).join('; ')}`) : ['_none_']));
  L.push('', '## Styles in use', '', ...Object.entries(f.tokens).map(([k, v]) => `- ${k}: ${Object.entries(v).map(([name, n]) => `${name} ×${n}`).join(', ')}`), '');
  return L.join('\n');
}
