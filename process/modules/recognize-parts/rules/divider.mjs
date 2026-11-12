// A divider is a line: one side is at most 2px and the other is at least 40px.
// The layer name is a hint. The box is the evidence. A checkbox square is not a line.
// A scroll track or thumb is the bar of that scroll, not a divider element.
import { detectScrollLists } from './scroll.mjs';
const LINE = new Set(['FRAME', 'RECTANGLE', 'LINE', 'VECTOR', 'INSTANCE', 'COMPONENT', 'GROUP']);

const kids = (n) => (n.children ?? []).filter((c) => c.visible !== false);

function lineOf(n) {
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  const thin = Math.min(w, h);
  const long = Math.max(w, h);
  if (!LINE.has(n.type) || thin <= 0 || thin > 2 || long < 40) return null;
  if (kids(n).some((c) => c.type === 'TEXT')) return null;
  return { w, h, thin, long, horizontal: w >= h };
}

export function detectDividers(tree) {
  const bar = new Set();
  for (const scroll of detectScrollLists(tree)) {
    if (scroll.params?.track) bar.add(scroll.params.track);
    if (scroll.params?.thumb) bar.add(scroll.params.thumb);
  }
  const found = [];
  (function walk(n) {
    if (!n || n.visible === false) return;
    const line = lineOf(n);
    if (line && !bar.has(n.id)) {
      const fill = (n.fills ?? []).find((f) => f.visible !== false && f.type === 'SOLID' && f.hex);
      found.push({
        component: 'divider',
        node: n.id,
        level: 'E2',
        confidence: 'high',
        cite: [
          { node: n.id, field: 'type', equals: n.type },
          { node: n.id, field: 'box.w', equals: n.box.w },
          { node: n.id, field: 'box.h', equals: n.box.h },
        ],
        evidence: `${n.type} "${n.name}" is a ${Math.round(line.long)}×${Math.round(line.thin)} line`,
        params: {
          direction: line.horizontal ? 'horizontal' : 'vertical',
          length: Math.round(line.long),
          thickness: Math.round(line.thin * 100) / 100,
          ...(fill ? { color: { hex: fill.hex, alpha: fill.alpha ?? 1 } } : {}),
        },
        note: null,
      });
      return;
    }
    kids(n).forEach(walk);
  })(tree);
  return found;
}
