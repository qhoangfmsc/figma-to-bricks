// Candidate buttons: a frame / instance named like a button whose visible children are a text label and at most one svg icon.
import { ICON_FONT } from '../../figma/nodes.mjs';

const NAME = /button|btn/i;
const HOLDERS = new Set(['FRAME', 'INSTANCE', 'COMPONENT']);
const hasSvg = (n) => n.visible !== false && (!!n.svg || (n.children ?? []).some(hasSvg));

export function detectButtons(tree) {
  const found = [];
  (function walk(n) {
    if (n.visible === false) return;
    const kids = (n.children ?? []).filter((c) => c.visible !== false);
    const label = kids.find((k) => k.type === 'TEXT' && !k.svg && !ICON_FONT.test(k.text?.fontFamily ?? ''));
    const icons = kids.filter((k) => k !== label && hasSvg(k));
    if (HOLDERS.has(n.type) && NAME.test(n.name) && label && kids.length === 1 + icons.length && icons.length <= 1) {
      const kid0 = label;
      const designed = n.type === 'INSTANCE' && /button/i.test(n.componentSet ?? n.component ?? '');
      found.push({
        component: 'button', node: n.id, level: designed ? 'E1' : 'E3', confidence: designed ? 'high' : 'medium',
        cite: [{ node: n.id, field: designed ? (n.componentSet ? 'componentSet' : 'component') : 'name' }, { node: kid0.id, field: 'type', equals: 'TEXT' }],
        evidence: `${n.type} "${n.name}"${n.component ? ` (variant ${n.component})` : ''} with the text "${kid0.text?.characters?.trim()}"${icons.length ? ' and one svg icon' : ''}`,
        params: {}, note: null,
      });
    }
    kids.forEach(walk);
  })(tree);
  return found;
}
