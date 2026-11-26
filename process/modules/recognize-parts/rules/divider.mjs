// A divider is a line: the short side is a small fraction of the long side.
// The layer name is a hint. The box is the evidence. A checkbox square is not a line.
// A scroll track or thumb is the bar of that scroll, not a divider element.
import { FillType, isType, isText, LineType } from '../node-type.mjs';
import { PartKind } from '../kinds.mjs';
import { detectScrollLists } from './scroll.mjs';
const LINE = new Set(LineType);

const kids = (n) => (n.children ?? []).filter((c) => c.visible !== false);

function lineOf(n) {
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  const thin = Math.min(w, h);
  const long = Math.max(w, h);
  if (!LINE.has(n.type) || thin <= 0 || long <= 0 || thin / long > 0.08) return null;
  if (kids(n).some((c) => isText(c))) return null;
  const marks = kids(n).filter((child) => {
    const side = Math.min(child.box?.w ?? 0, child.box?.h ?? 0);
    const span = Math.max(child.box?.w ?? 0, child.box?.h ?? 0);
    return side > 0 && span > 0 && side / span <= 0.35;
  });
  if (marks.length >= 2) return null;
  return { w, h, thin, long, horizontal: w >= h };
}

export function detectDividers(tree) {
  const bar = new Set();
  for (const scroll of detectScrollLists(tree)) {
    if (scroll.node) bar.add(scroll.node);
    if (scroll.params?.track) bar.add(scroll.params.track);
    if (scroll.params?.thumb) bar.add(scroll.params.thumb);
  }
  const found = [];
  (function walk(n) {
    if (!n || n.visible === false) return;
    const line = lineOf(n);
    // A slot with no paint of its own, whose child is the colored bar, is not the line. The child is.
    const slot = line && !bar.has(n.id) && !(n.fills ?? []).some((f) => f.visible !== false) && !n.stroke && kids(n).some((c) => lineOf(c));
    if (slot) { kids(n).forEach(walk); return; }
    if (line && !bar.has(n.id)) {
      const fill = (n.fills ?? []).find((f) => f.visible !== false && isType(f, FillType.SOLID) && f.hex);
      found.push({
        component: PartKind.DIVIDER,
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
