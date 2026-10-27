// Candidate carousels: a horizontal auto-layout row of >= 3 children with the SAME structure, plus at least one carousel sign:
//   - the row overflows / is cut off by its own frame (the next slides are hidden)         E2
//   - the layer is named slider / carousel / swiper                                          E1
//   - a thin strip (<= 16px high) sits right under it = pagination dashes / dots             E2
// A plain row of 3 cards that all fit and has none of these is a grid, not a carousel.
const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const sig = (n) => `${n.type}[${visibleKids(n).map(sig).join(',')}]`;
const NAME = /slider|carousel|swiper|slides?\b/i;

export function detectCarousels(tree) {
  const found = [];
  (function walk(n, parent) {
    if (n.visible === false) return;
    const kids = visibleKids(n);
    if (n.layout?.mode === 'HORIZONTAL' && !n.layout.wrap && kids.length >= 3 && new Set(kids.map(sig)).size === 1) {
      const last = kids.at(-1);
      const overflow = last.box.x + last.box.w > n.box.w + 1;
      const named = NAME.test(n.name) || NAME.test(n.componentSet ?? '');
      const sibs = parent ? visibleKids(parent) : [];
      const next = sibs[sibs.indexOf(n) + 1];
      const strip = next && next.box.h <= 16 && next.box.w <= n.box.w && next.box.absY >= n.box.absY + n.box.h - 1 && (next.svg || next.type === 'INSTANCE' || visibleKids(next).length >= 3);
      const pag = strip ? next : null;
      if (overflow || named || pag) {
        const signs = [overflow, named, !!pag].filter(Boolean).length;
        found.push({
          component: 'carousel', node: n.id, level: named ? 'E1' : 'E2', confidence: signs >= 2 ? 'high' : 'medium',
          cite: [{ node: n.id, field: 'layout.mode', equals: 'HORIZONTAL' }, ...(named ? [{ node: n.id, field: 'name' }] : []), ...(pag ? [{ node: pag.id, field: 'box.h' }] : [])],
          evidence: [
            `"${n.name}" is a horizontal row of ${kids.length} identical "${kids[0].name}" items`,
            overflow && `the row is ${Math.round(n.box.w)}px wide but its items end at ${Math.round(last.box.x + last.box.w)}px (cut off)`,
            named && 'the layer is named like a slider',
            pag && `a thin strip "${pag.name}" (${Math.round(pag.box.w)}×${Math.round(pag.box.h)}) sits right under it: pagination dashes / dots`,
          ].filter(Boolean).join('; '),
          params: pag ? { pagination: pag.id } : {},
          note: pag ? 'params.pagination was found by shape: check it really is the pagination' : 'is there a pagination row under it? link it with params.pagination=<node id>',
        });
        return;
      }
    }
    kids.forEach((c) => walk(c, n));
  })(tree, null);
  return found;
}
