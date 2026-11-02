// COMPONENT readmore ("Xem thêm"): a clipped frame with a button under it opens to its full height when the button is clicked.
// Bricks 1.9.8 has the click interaction `toggleAttribute` with key `class` (assets/js/bricks.min.js: it toggles the class on every element the selector finds), so the button
// toggles a class on the frame and one css rule gives the frame its full height: no JS. The closed state is exactly the Figma frame (its own height and clip, untouched).
//   source: includes/interactions.php (trigger click, action toggleAttribute, target custom + targetSelector, actionAttributeKey / Value), button.php (`tag` only without a link)
// The button becomes a real <button> (no link: a `#` link would jump to the top of the page). The fade drawn over the bottom edge (an absolute gradient child) goes away while open.
// params: button (node id of the "Xem thêm" button)
//         buttonMode: toggle (default) | none | link
//         expand: { kind: 'text', text } extra copy shown only while open, or { kind: 'figma', ... } the full frame grafted as .read-more-full
//         (empty expand keeps revealing the text already clipped in this frame)
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
const fold = (s) => String(s ?? '').trim().toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/\p{M}/gu, '');
const COLLAPSE = /^(thu gon|collapse|show less|see less|an bot|rut gon)$/;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The full frame draws the same button again, with the open label ("Thu gọn") and the caret pointing up.
// That drawing is the open state of the one button, not a second control.
function collapseButton(node) {
  const full = (node.children ?? []).find((c) => c.openRoot);
  if (!full) return null;
  let found = null;
  (function walk(n) {
    if (n.visible === false) return;
    const label = firstText(n)?.text?.characters?.trim();
    if ((n.type === 'INSTANCE' || n.componentSet) && label && COLLAPSE.test(fold(label))) found = n;
    else for (const c of n.children ?? []) walk(c);
  })(full);
  return found;
}

export default {
  id: 'readmore',
  status: 'implemented',
  label: 'Read more (Xem thêm)',
  figma: 'a clipped frame whose content is longer than its height, with a button "Xem thêm" / "Read more" after it (variant Expand=No)',
  bricks: 'the frame gets a class, the button a click interaction that toggles it (`toggleAttribute` on `class`); one css rule gives the open frame `height: auto`',
  limits: 'the open label and the turned caret come from the collapse button drawn in the full frame (Thu gọn). That button is not built again. Typed text is added under the clipped copy and shown only while open.',

  mergedNodes(det, node) {
    const open = collapseButton(node);
    return open ? [open.id] : [];
  },

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
    const css = [
      { decl: 'height: auto !important; max-height: none !important; overflow: visible !important;', suffix: `.${OPEN}` },
      ...(fade ? [{ decl: 'display: none !important;', suffix: `.${OPEN} .read-more-fade` }] : []),
    ];
    const extraChildren = [];
    const expand = det.params?.expand;
    if (expand?.kind === 'text') {
      const sample = firstText(node);
      extraChildren.push({
        name: 'text-basic', label: 'Nội dung khi mở', settings: { _cssClasses: 'read-more-added' },
        ...(sample && { like: sample.id }), text: expand.text,
      });
      css.push(
        { decl: 'display: none !important;', suffix: ' .read-more-added' },
        { decl: 'display: block !important;', suffix: `.${OPEN} .read-more-added` },
      );
    } else if (expand?.kind === 'figma') {
      const full = (node.children ?? []).find((c) => c.openRoot);
      const openDisplay = full?.layout?.mode === 'GRID' ? 'grid' : full?.layout?.mode ? 'flex' : 'block';
      css.push(
        { decl: 'display: none !important;', suffix: `.${OPEN} > :not(.read-more-full)` },
        { decl: `display: ${openDisplay} !important;`, suffix: `.${OPEN} > .read-more-full` },
      );
    }
    const openBtn = collapseButton(node);
    out[node.id] = { css, ...(extraChildren.length && { extraChildren }) };
    if (fade) out[fade.id] = { settings: { _cssClasses: 'read-more-fade' } };
    const mode = det.params?.buttonMode || 'toggle';
    if (mode === 'none') out[det.params.button] = { settings: { tag: 'span' }, dropSettings: ['link', '_interactions'] };
    else if (mode === 'toggle') {
      const settings = { tag: 'button', _interactions: [{ id: rowId(cls, 'rm'), trigger: 'click', action: 'toggleAttribute', target: 'custom', targetSelector: `.${cls}`, actionAttributeKey: 'class', actionAttributeValue: OPEN }] };
      const openLabel = openBtn && firstText(openBtn)?.text?.characters?.trim();
      if (openLabel) {
        const closedLabel = firstText(findNode(root, det.params.button))?.text?.characters?.trim() ?? '';
        settings.text = `<span class="rm-closed">${esc(closedLabel)}</span><span class="rm-open">${esc(openLabel)}</span>`;
        settings._cssClasses = 'read-more-toggle';
        css.push(
          { decl: 'display: none;', suffix: ' ~ .read-more-toggle .rm-open' },
          { decl: 'display: none !important;', suffix: `.${OPEN} ~ .read-more-toggle .rm-closed` },
          { decl: 'display: inline !important;', suffix: `.${OPEN} ~ .read-more-toggle .rm-open` },
          { decl: 'transform: rotate(180deg);', suffix: `.${OPEN} ~ .read-more-toggle svg` },
        );
      }
      out[det.params.button] = { settings, dropSettings: ['link'] };
    }
    return out;
  },
};
