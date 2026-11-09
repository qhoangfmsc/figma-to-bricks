// A circle plus one label. Bricks 1.12.3 renders it as a form radio field (includes/elements/form.php).
import { applyChoice } from './choice-control.mjs';

export default {
  id: 'radio',
  status: 'implemented',
  label: 'Radio',
  figma: 'a row whose children are one small circle and one text label',
  bricks: 'a block (the Figma row) holding a `form` with one radio field. The circle size is element CSS compiled into the external post CSS file. No theme style is changed',
  limits: 'Bricks has no standalone radio element, so this is a form field. The submit button Bricks always adds is hidden with one rule because form.php has no control for it. A radio inside a form stays part of that form',
  mergesChildren: true,
  wrap: true,
  innerKind: 'form',
  kind: () => 'block',

  check(node, det) {
    if (!det.params?.label) return { ok: false, reason: 'params.label is empty' };
    return { ok: true, warnings: [] };
  },

  apply(ctx, det) {
    applyChoice(ctx, det, 'radio');
  },
};
