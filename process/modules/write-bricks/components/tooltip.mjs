// COMPONENT tooltip: a trigger (usually an info / question icon) that shows text on hover.
// Figma has no tooltip type; the designer draws an icon next to a label. The detect step proposes it, a human approves it.
// Bricks 1.9.8: no tooltip element. Any element takes custom attributes (`_attributes`); data-balloon + data-balloon-pos
// make the theme's tooltip CSS work, and Bricks loads that CSS by itself when it sees `data-balloon` in the settings.
//   source: wp-content/themes/bricks/includes/assets.php:226, assets/css/libs/tooltips.min.css, includes/elements/base.php:2152
// params: text (the tooltip text; empty = the attribute is written empty and the theme hides it until the copy exists) · position (default top)
//         popup (optional node id: a tooltip bubble drawn loose in Figma; its visible text is the tooltip text, the node itself is
//         merged, i.e. not built). The detection's `node` is always the TRIGGER (the icon), never the popup.
export const POSITIONS = ['top', 'top-left', 'top-right', 'bottom', 'bottom-left', 'bottom-right', 'left', 'right'];

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
  id: 'tooltip',
  status: 'implemented',
  label: 'Tooltip',
  figma: 'icon (info / question glyph) next to a label; the tooltip text comes from params.text',
  bricks: '`_attributes` data-balloon="<text>" + data-balloon-pos="<position>" on the trigger element',
  limits: 'plain text with the theme tooltip look; the colors / padding of a drawn Figma popup are not reproduced',

  mergedNodes: (det) => (det.params?.popup ? [det.params.popup] : []),

  check(node, det, { root }) {
    if (det.params?.popup && det.params.popup === node.id) return { ok: false, reason: 'the detection node is the popup bubble itself: set "node" to the id of the trigger icon (the popup id stays in params.popup)' };
    if (det.params?.popup && !findNode(root, det.params.popup)) return { ok: false, reason: `params.popup ${det.params.popup} is not in the tree` };
    const text = resolveText(det, root);
    if (/[{}]/.test(text)) return { ok: false, reason: 'params.text contains { }, Bricks would read it as dynamic data' };
    const pos = det.params.position ?? 'top';
    if (!POSITIONS.includes(pos)) return { ok: false, reason: `params.position "${pos}" is not one of ${POSITIONS.join(', ')}` };
    // no text yet (it is not in Figma): the attribute is written EMPTY, the theme CSS hides an empty balloon, so the slot is ready for the copy
    return { ok: true, warnings: text.trim() ? [] : ['tooltip text is not in Figma: data-balloon is empty (hidden) until params.text is set (designer list)'] };
  },

  apply({ s, root }, det) {
    const attrs = { 'data-balloon': resolveText(det, root), 'data-balloon-pos': det.params.position ?? 'top' };
    s._attributes = [...(s._attributes ?? []), ...Object.entries(attrs).map(([name, value]) => ({ name, value }))];
    return { attrs }; // verify checks these in the rendered DOM
  },
};
