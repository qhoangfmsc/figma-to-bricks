// A button is a small frame with one text label and at most one icon.
// A component named Button is high confidence. The same shape with no such name is still proposed, at low confidence, so a layer called "Frame 12" is not dropped.
import { ICON_FONT } from '../../read-figma/nodes.mjs';
import { buttonRole } from '../../write-bricks/components/button.mjs';
import { layoutOnlyReason } from './layout-only.mjs';

const NAMED = /\b(button|btn|cta)\b/i;
const HOLDERS = new Set(['FRAME', 'INSTANCE', 'COMPONENT']);
const hasSvg = (n) => n.visible !== false && (!!n.svg || (n.children ?? []).some(hasSvg));

export function detectButtons(tree) {
  const found = [];
  (function walk(n) {
    if (n.visible === false) return;
    const kids = (n.children ?? []).filter((c) => c.visible !== false);
    const label = kids.find((k) => k.type === 'TEXT' && !k.svg && !ICON_FONT.test(k.text?.fontFamily ?? ''));
    const icons = kids.filter((k) => k !== label && hasSvg(k));
    const h = n.box?.h ?? 0;
    const shape = HOLDERS.has(n.type) && label && kids.length === 1 + icons.length && icons.length <= 1;
    const named = NAMED.test(n.name ?? '') || NAMED.test(n.componentSet ?? n.component ?? '');
    const pad = n.layout?.padding ?? {};
    const drawn = (n.fills ?? []).some((f) => f.visible !== false) || (n.strokes ?? []).length > 0 || n.radius || [pad.top, pad.right, pad.bottom, pad.left].filter(Boolean).length >= 2;
    const control = h >= 32 && h <= (named ? 72 : 56);
    if (shape && control && (named || drawn)) {
      if (layoutOnlyReason(n, tree) === 'domain' && !named) {
        kids.forEach(walk);
        return;
      }
      const designed = n.type === 'INSTANCE' && NAMED.test(n.componentSet ?? n.component ?? '');
      const confidence = designed ? 'high' : named ? 'medium' : 'low';
      found.push({
        component: 'button', node: n.id, level: designed ? 'E1' : named ? 'E3' : 'E2', confidence,
        cite: [{ node: label.id, field: 'type', equals: 'TEXT' }, ...(named ? [{ node: n.id, field: designed ? (n.componentSet ? 'componentSet' : 'component') : 'name' }] : [])],
        evidence: `${n.type} "${n.name}" with the text "${label.text?.characters?.trim()}"${icons.length ? ' and one icon' : ''}${named ? '' : ' (shape only)'}`,
        params: { role: layoutOnlyReason(n, tree) ? 'layout' : buttonRole(label.text?.characters) }, note: null,
      });
    }
    kids.forEach(walk);
  })(tree);
  return found;
}
