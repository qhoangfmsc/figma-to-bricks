// Candidate accordions (FAQ): a container whose visible children are >= 2 ITEMS that look alike, each item = a title row + (only while open) a content block.
// Three kinds of evidence, strongest first (CATALOG.md: the designer's own variant > repeated structure > layer name > geometry):
//   E1 variants   the items are one component and their State property says collapsed on some and expanded on others ("State=Collapsed" / "State=Expand")
//   E1 named      the items carry a collapsed / expanded State and the layer or component set is named like an FAQ / accordion
//   E2 shape      a vertical stack of >= 3 items of the same structure where some have one child (the title row) and some two (title + content): the
//                 pattern of an accordion drawn with plain frames. Only a GUESS (it can also be a list of cards with an optional badge), so it is
//                 proposed with confidence "medium" and the Plan asks the owner before it is built.
// Never claimed: a row of items (tabs, menu), items with more than two children, a single item.
const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const BOX = new Set(['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT']);
const COLLAPSED = /^(collapsed?|closed?)$/i, EXPANDED = /^(expand(ed)?|open(ed)?)$/i;
const NAME = /faq|accordion|collaps|question|cau[ -]?hoi|c[âa]u h[ỏo]i/i;
const sig = (n) => `${n.type}[${visibleKids(n).map(sig).join(',')}]`;

// the state a designer's variant property gives an item: { key, value, kind: 'collapsed' | 'expanded' } or null
export function stateOf(item) {
  for (const [key, value] of Object.entries(item.props ?? {})) {
    if (!/state|open|expand|status/i.test(key) || typeof value !== 'string') continue;
    if (COLLAPSED.test(value)) return { key, value, kind: 'collapsed' };
    if (EXPANDED.test(value)) return { key, value, kind: 'expanded' };
  }
  return null;
}

export function detectAccordions(tree) {
  const found = [];
  (function walk(n) {
    if (n.visible === false) return;
    const kids = visibleKids(n);
    const itemLike = kids.length >= 2 && kids.every((k) => BOX.has(k.type) && visibleKids(k).length >= 1 && visibleKids(k).length <= 2);
    if (itemLike) {
      const sameKind = new Set(kids.map((k) => k.componentSet ?? k.name)).size === 1;
      const states = kids.map(stateOf);
      const hasCollapsed = states.some((s) => s?.kind === 'collapsed'), hasExpanded = states.some((s) => s?.kind === 'expanded');
      const named = NAME.test(n.name) || NAME.test(kids[0].componentSet ?? '') || NAME.test(kids[0].name);
      const counts = kids.map((k) => visibleKids(k).length);
      const titleRowsAlike = new Set(kids.map((k) => sig(visibleKids(k)[0]))).size === 1;
      const stacked = n.layout?.mode === 'VERTICAL' && kids.every((k, i) => i === 0 || k.box.absY >= kids[i - 1].box.absY + 1);
      const variants = sameKind && hasCollapsed && hasExpanded;
      const namedState = sameKind && (hasCollapsed || hasExpanded) && named;
      const sameWidth = kids.every((k) => Math.abs(k.box.w - kids[0].box.w) <= 1); // the rows of an accordion are one column wide; a card (pill, body, button) is not
      const shape = kids.length >= 3 && stacked && sameWidth && titleRowsAlike && counts.includes(1) && counts.includes(2);
      if (variants || namedState || shape) {
        const open = kids.filter((_, i) => counts[i] === 2).length;
        const cite = [{ node: n.id, field: 'name', equals: n.name }];
        const c = states.findIndex((s) => s?.kind === 'collapsed'), e = states.findIndex((s) => s?.kind === 'expanded');
        for (const i of [c, e]) if (i >= 0) cite.push({ node: kids[i].id, field: `props.${states[i].key}`, equals: states[i].value });
        const how = variants ? `designer variants: ${hasCollapsed && kids.filter((_, i) => states[i]?.kind === 'collapsed').length} collapsed + ${kids.filter((_, i) => states[i]?.kind === 'expanded').length} expanded`
          : namedState ? 'items carry a collapsed / expanded state and the layer is named like an FAQ' : 'a vertical stack where some items show a content block under the title row and the others do not';
        found.push({
          component: 'accordion', node: n.id, level: variants || namedState ? 'E1' : 'E2', confidence: variants ? 'high' : namedState ? 'medium' : 'low',
          cite,
          evidence: `"${n.name}" holds ${kids.length} items "${kids[0].name}" (${how}); ${open} drawn open`,
          params: {},
          note: shape && !variants && !namedState ? 'a guess from the shape alone: the Plan asks the owner whether this is an accordion' : 'questions and answers: the content of the closed items is not drawn, the Plan asks for it',
        });
        return; // the items of an accordion are not accordions
      }
    }
    kids.forEach(walk);
  })(tree);
  return found;
}
