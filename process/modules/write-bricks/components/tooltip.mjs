// COMPONENT tooltip: a trigger (usually an info / question icon) that shows text on hover.
// Figma has no tooltip type; the designer draws an icon next to a label. The detect step proposes it, a human approves it.
// The icon is wrapped. The bubble stays inside that wrap and opens just above the icon, the way a shadcn tooltip
// sits on its trigger (side top, 4px offset) instead of being moved out to the page.
// params: text (the tooltip text; empty = no bubble is built) · position is kept for the plan enum
//         popup (optional node id: a tooltip bubble drawn loose in Figma; its visible text is the tooltip text, the node itself is
//         merged, i.e. not built). The detection's `node` is always the TRIGGER (the icon), never the popup.
import { PartKind } from '../../recognize-parts/kinds.mjs';
import { px } from '../../write-bricks/render/utils/css.mjs';

export const POSITIONS = ['top', 'top-left', 'top-right', 'bottom', 'bottom-left', 'bottom-right', 'left', 'right'];

// Used only when the design does not draw a bubble. A drawn bubble supplies its own max-width.
export const DEFAULT_TIP_MAX_WIDTH = '150px';

export function drawnTipWidth(node) {
  const width = node?.limits?.maxWidth ?? node?.box?.w;
  return width ? px(width) : DEFAULT_TIP_MAX_WIDTH;
}

// Sits 4px above the icon. The right edge stays on the icon, so the bubble grows to the left (shadcn side=top, align=end).
export function tipLook(bg = '#007cfc', ink = '#ffffff', maxWidth = DEFAULT_TIP_MAX_WIDTH) {
  return `%root% { display: none; position: absolute; z-index: 50; bottom: calc(100% + 4px); right: 0; width: max-content; max-width: ${maxWidth}; box-sizing: border-box; background: ${bg}; color: ${ink}; border-radius: 4px; padding: 8px; white-space: normal; text-align: left; }`;
}

export function tipWrap(node, text, bg, ink, maxWidth = DEFAULT_TIP_MAX_WIDTH) {
  const settings = {
    _position: 'relative',
    _display: 'inline-flex',
    _overflow: 'visible',
    _cssClasses: 'f2b-tip-wrap',
  };
  if (node?.box?.w) settings._width = px(node.box.w);
  if (node?.box?.h) settings._height = px(node.box.h);
  return {
    enclose: {
      name: 'block',
      label: 'Tooltip',
      settings,
      css: [{ decl: 'display: block;', suffix: ':hover > .f2b-tip' }],
      tail: [{ name: 'text-basic', label: 'Tooltip', settings: { text, _cssClasses: 'f2b-tip', _cssCustom: tipLook(bg, ink, maxWidth) } }],
    },
  };
}

const findNode = (n, id) => (n.id === id ? n : (n.children ?? []).reduce((f, c) => f ?? findNode(c, id), null));
function popupText(n, out = []) {
  if (n.visible === false) return out;
  if (n.type === 'TEXT' && n.text?.characters) out.push(n.text.characters.trim());
  (n.children ?? []).forEach((c) => popupText(c, out));
  return out;
}
// the tooltip text: params.text wins, else the visible text of the popup node (a Figma value, never invented)
const resolveText = (det, root) => det.params?.text || (det.params?.popup && findNode(root, det.params.popup) ? popupText(findNode(root, det.params.popup)).join(' ') : '');

export default {
  id: PartKind.TOOLTIP,
  status: 'implemented',
  label: 'Tooltip',
  figma: 'icon (info / question glyph) next to a label; the tooltip text comes from params.text',
  bricks: 'the trigger keeps the icon. A sibling `.f2b-tip` holds the text and shows as soon as the icon is hovered',
  limits: 'the bubble uses the drawn tooltip colors when that frame is present, otherwise blue #007cfc and white text',

  mergedNodes: (det) => (det.params?.popup ? [det.params.popup] : []),

  check(node, det, { root }) {
    if (det.params?.popup && det.params.popup === node.id) return { ok: false, reason: 'the detection node is the popup bubble itself: set "node" to the id of the trigger icon (the popup id stays in params.popup)' };
    if (det.params?.popup && !findNode(root, det.params.popup)) return { ok: false, reason: `params.popup ${det.params.popup} is not in the tree` };
    const text = resolveText(det, root);
    if (/[{}]/.test(text)) return { ok: false, reason: 'params.text contains { }, Bricks would read it as dynamic data' };
    const pos = det.params.position ?? 'top';
    if (!POSITIONS.includes(pos)) return { ok: false, reason: `params.position "${pos}" is not one of ${POSITIONS.join(', ')}` };
    // no text yet (it is not in Figma): the attribute is written EMPTY, the theme CSS hides an empty balloon, so the slot is ready for the copy
    return { ok: true, warnings: text.trim() ? [] : ['tooltip text is not in Figma: the bubble stays out until params.text is set (designer list)'] };
  },

  descendants(node, det, ctx) {
    const text = resolveText(det, ctx?.root ?? node);
    if (!text.trim()) return {};
    const popup = det.params?.popup ? findNode(ctx?.root ?? node, det.params.popup) : null;
    return { [node.id]: tipWrap(node, text, undefined, undefined, drawnTipWidth(popup)) };
  },
};
