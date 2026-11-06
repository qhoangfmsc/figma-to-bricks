// Sibling frames that share a shape, whether or not the layer is named "tab" or "slider".
// The confirm plan shows this list. The chat compares it with the picture before anyone approves a component.
// A group already claimed, or whose items are already claimed one by one, is left out.
import { visibleKids } from '../write-bricks/components/helpers.mjs';

const GENERIC = /^(frame|group|rectangle|instance|component|container|image|vector|ellipse|line|text)(\s+\d+)?$/i;
const stem = (name) => String(name ?? '').trim().toLowerCase().replace(/[\s._-]*\d+$/, '');
const shape = (n) => `${n.type}:${visibleKids(n).map((c) => c.type).join(',')}`;

function skipIds(tree, components) {
  const roots = new Set((components ?? []).filter((c) => c.status === 'approved' || c.status === 'proposed').map((c) => c.node));
  const skip = new Set();
  (function walk(n, inside) {
    const hit = inside || roots.has(n.id);
    if (hit) skip.add(n.id);
    for (const c of n.children ?? []) walk(c, hit);
  })(tree, false);
  return skip;
}

function sampleText(n) {
  let hit = '';
  (function walk(x) {
    if (!x || x.visible === false || hit) return;
    if (x.type === 'TEXT' && !x.svg && x.text?.characters?.trim()) hit = x.text.characters.trim().replace(/\s+/g, ' ').slice(0, 48);
    for (const c of x.children ?? []) walk(c);
  })(n);
  return hit;
}

export function unclaimedRepeats(tree, components) {
  const skip = skipIds(tree, components);
  const found = [];
  (function walk(n) {
    if (!n || n.visible === false) return;
    const kids = visibleKids(n).filter((k) => k.type !== 'TEXT' && k.type !== 'LINE');
    let held = new Set();
    if (!skip.has(n.id) && kids.length >= 2) {
      const groups = new Map();
      for (const k of kids) {
        const key = shape(k);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(k);
      }
      const best = [...groups.values()].sort((a, b) => b.length - a.length)[0];
      const dominant = best && best.length >= 2 && best.length >= Math.ceil(kids.length * 0.6);
      if (dominant && !best.every((k) => skip.has(k.id))) {
        const stems = best.map((k) => stem(k.name)).filter((s) => s && !GENERIC.test(s));
        found.push({
          node: n.id,
          name: n.name ?? '',
          count: best.length,
          item: best[0].name ?? '',
          sameName: stems.length === best.length && new Set(stems).size === 1,
          sample: sampleText(best[0]),
        });
        held = new Set(best.map((k) => k.id));
      }
    }
    for (const c of visibleKids(n)) if (!held.has(c.id)) walk(c);
  })(tree);
  return found;
}
