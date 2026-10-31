// COMPONENT readmore ("Xem thêm"): a clipped frame with a button under it opens to its full height when the button is clicked.
// Bricks 1.9.8 has the click interaction `toggleAttribute` with key `class` (assets/js/bricks.min.js: it toggles the class on every element the selector finds), so the button
// toggles a class on the frame and one css rule gives the frame its full height: no JS. The closed state is exactly the Figma frame (its own height and clip, untouched).
//   source: includes/interactions.php (trigger click, action toggleAttribute, target custom + targetSelector, actionAttributeKey / Value), button.php (`tag` only without a link)
// The button becomes a real <button> (no link: a `#` link would jump to the top of the page). The fade drawn over the bottom edge (an absolute gradient child) goes away while open.
// params: button (node id of the "Xem thêm" button)
import { findNode, visibleKids, rowId, firstText } from './helpers.mjs';

const OPEN = 'read-more-open';
// The class must be the SAME in every breakpoint frame (node ids differ per frame, and so can the copy: the mobile frame of a section may carry another heading): the
// responsive merge then shares the frame and the button instead of keeping one of each. It comes from names that the frames share: the section, the frame, the button label.
// (Two read-more frames with the same three names on one page would share it: listed in BACKLOG-usable-output.md.)
const classOf = (node, root, det) => {
  const btn = det?.params?.button && findNode(root, det.params.button);
  return `read-more-${rowId(root.name, node.name, firstText(btn ?? node)?.text.characters ?? '')}`;
};
const fadeOf = (node) => visibleKids(node).find((k) => k.place === 'ABSOLUTE' && k.fills?.some((f) => f.type === 'GRADIENT_LINEAR'));

export default {
  id: 'readmore',
  status: 'implemented',
  label: 'Read more (Xem thêm)',
  figma: 'a clipped frame whose content is longer than its height, with a button "Xem thêm" / "Read more" after it (variant Expand=No)',
  bricks: 'the frame gets a class, the button a click interaction that toggles it (`toggleAttribute` on `class`); one css rule gives the open frame `height: auto`',
  limits: 'the label does not change to "Thu gọn" when open (not in Figma); the caret does not turn; the closing click works the same way',

  check(node, det, { root }) {
    if (!node.clip) return { ok: false, reason: 'the frame does not clip its content' };
    const b = det.params?.button && findNode(root, det.params.button);
    if (!b) return { ok: false, reason: `params.button ${det.params?.button} is not in the tree` };
    return { ok: true, warnings: [] };
  },

  apply({ node, s, root }, det) {
    s._cssClasses = [s._cssClasses, classOf(node, root, det)].filter(Boolean).join(' ');
  },

  descendants(node, det, { root }) {
    const out = {};
    const cls = classOf(node, root, det);
    const fade = fadeOf(node);
    out[node.id] = { css: [
      { decl: 'height: auto !important; max-height: none !important; overflow: visible !important;', suffix: `.${OPEN}` },
      ...(fade ? [{ decl: 'display: none !important;', suffix: `.${OPEN} .read-more-fade` }] : []),
    ] };
    if (fade) out[fade.id] = { settings: { _cssClasses: 'read-more-fade' } };
    out[det.params.button] = {
      settings: { tag: 'button', _interactions: [{ id: rowId(cls, 'rm'), trigger: 'click', action: 'toggleAttribute', target: 'custom', targetSelector: `.${cls}`, actionAttributeKey: 'class', actionAttributeValue: OPEN }] },
      dropSettings: ['link'],
    };
    return out;
  },
};
