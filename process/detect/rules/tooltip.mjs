// Candidate tooltips. Evidence ladder (strongest first):
//   E1  the designer declared it: an instance property such as "Tooltips icon" = true on the row that holds the icon
//   E3  the shape: an info / question / exclamation icon (icon font) next to a text label
// A bubble drawn loose in the file (a "Tooltip" instance with a text) is proposed as well, with its text, but its trigger is unknown.
// The tooltip TEXT is usually not in Figma: it stays null (and is listed as "missing from Figma") unless a popup node holds it.
// Position comes from the bubble's arrow when there is one (arrow on the top edge = the bubble opens below the trigger).
import { ICON_FONT } from '../../figma/nodes.mjs';

const GLYPH = /(^|-)(info|question|exclamation|help)(-|$)/i;
const FLAG = /tooltip/i;

function texts(n, out = []) {
  if (n.type === 'TEXT' && n.text?.characters) out.push(n.text.characters.trim());
  for (const c of n.children ?? []) texts(c, out);
  return out;
}
const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
// first readable (non-icon) text inside a node, depth first
function labelIn(n) {
  if (n.visible === false) return null;
  if (n.type === 'TEXT') return n.text?.characters && !ICON_FONT.test(n.text.fontFamily ?? '') ? n : null;
  for (const c of n.children ?? []) { const f = labelIn(c); if (f) return f; }
  return null;
}

// a small rotated square on one edge of the bubble is its arrow: the arrow side tells where the bubble opens
function arrowPosition(bubble) {
  const a = (bubble.children ?? []).find((c) => c.visible !== false && Math.abs(Math.abs(c.rotation ?? 0) - Math.PI / 4) < 0.05 && c.box.w < 24 && c.box.h < 24);
  if (!a) return null;
  const { w, h } = bubble.box;
  const cx = a.box.x + a.box.w / 2, cy = a.box.y + a.box.h / 2;
  const side = cy < 0 ? 'bottom' : cy > h ? 'top' : cx < 0 ? 'right' : cx > w ? 'left' : null; // arrow on the top edge -> bubble sits below
  return side ? { position: side, cite: { node: a.id, field: 'rotation' } } : null;
}

export function detectTooltips(tree) {
  const found = [];
  (function walk(n, chain) {
    if (n.visible === false) return;
    if (n.type === 'TEXT' && ICON_FONT.test(n.text?.fontFamily ?? '') && GLYPH.test(n.text.characters.trim()) && chain.length) {
      // the icon is often wrapped alone in an "Icon" frame: climb while the wrapper holds only that icon
      let top = n, i = chain.length - 1;
      while (i > 0 && visibleKids(chain[i]).length === 1) { top = chain[i]; i--; }
      const holder = chain[i];
      const sibs = (holder.children ?? []).filter((c) => c !== top);
      const labelNode = sibs.map(labelIn).find(Boolean);
      const popup = sibs.find((c) => /tooltip|hint|popover/i.test(c.name));
      const popupText = popup ? texts(popup).join(' ') : '';
      // the designer's own flag on the row (or any ancestor): a boolean property named like "Tooltips icon"
      const flagged = [...chain].reverse().map((a) => [a, Object.entries(a.props ?? {}).find(([k, v]) => FLAG.test(k) && typeof v === 'boolean')]).find(([, e]) => e);
      const flag = flagged?.[1];
      if (labelNode || popup || flag) {
        const cite = [{ node: n.id, field: 'text.characters', equals: n.text.characters }];
        let level = 'E3', confidence = popupText ? 'high' : 'medium';
        let why = `icon "${n.text.characters.trim()}" next to ${labelNode ? `the text "${labelNode.text.characters.trim()}"` : 'a tooltip-named node'}`;
        let note = popupText ? null : 'the tooltip text is not in the Figma file: ask the designer, fill params.text, or reject';
        if (flag && flag[1] === true) { level = 'E1'; confidence = 'high'; cite.push({ node: flagged[0].id, field: `props.${flag[0]}`, equals: true }); why += `; the designer flagged it: "${flagged[0].name}" has ${flag[0]} = true`; }
        else if (flag) { confidence = 'low'; cite.push({ node: flagged[0].id, field: `props.${flag[0]}`, equals: false }); note = `CONFLICT: the icon is drawn but the designer set ${flag[0]} = false on "${flagged[0].name}"; ` + (note ?? ''); }
        if (popupText) { why += `; popup text found in "${popup.name}"`; cite.push({ node: popup.id, field: 'name' }); }
        found.push({ component: 'tooltip', node: n.id, level, confidence, evidence: why, cite, params: { text: null, ...(popupText && { popup: popup.id }), position: 'top' }, note });
      }
    }
    for (const c of n.children ?? []) walk(c, [...chain, n]);
  })(tree, []);

  // a tooltip bubble drawn loose in the file (not next to an icon): we know the text, not the trigger
  const used = new Set(found.map((f) => f.params.popup).filter(Boolean));
  (function loose(n) {
    if (n.visible === false) return;
    if (/tooltip/i.test(n.name) && n.type !== 'TEXT' && !used.has(n.id)) {
      const text = texts(n).join(' ');
      if (text) {
        const arrow = arrowPosition(n);
        const variant = n.props && Object.keys(n.props).length ? ` (component variant: ${Object.entries(n.props).map(([k, v]) => `${k}=${v}`).join(', ')})` : '';
        found.push({
          component: 'tooltip', node: n.id, level: 'E2', confidence: 'low',
          evidence: `"${n.name}" ${n.type} is a tooltip bubble with the text "${text}" drawn on its own (${Math.round(n.box.w)}×${Math.round(n.box.h)}), not attached to any icon${variant}${arrow ? `; its arrow is on the ${arrow.position === 'bottom' ? 'top' : arrow.position === 'top' ? 'bottom' : arrow.position === 'right' ? 'left' : 'right'} edge, so it opens ${arrow.position}` : ''}`,
          cite: [{ node: n.id, field: 'name' }, ...(arrow ? [arrow.cite] : [])],
          params: { text: null, popup: n.id, position: arrow?.position ?? 'top' },
          note: 'the trigger is unknown: set "node" to the id of the icon that should show it (popup stays in params.popup), or reject' + (arrow ? '' : '; position is a default, Figma does not say'),
        });
        return;
      }
    }
    (n.children ?? []).forEach(loose);
  })(tree);
  return found;
}
