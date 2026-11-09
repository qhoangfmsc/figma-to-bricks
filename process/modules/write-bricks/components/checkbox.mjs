// A square plus one label. Bricks 1.12.3 renders it as a form checkbox field (includes/elements/form.php).
import { applyChoice } from './choice-control.mjs';

export default {
  id: 'checkbox',
  status: 'implemented',
  label: 'Checkbox',
  figma: 'a row whose children are one small square and one text label',
  bricks: 'a block (the Figma row) holding a `form` with one checkbox field. labelTypography carries the label. No theme style is changed',
  limits: 'Bricks has no standalone checkbox element, so this is a form field. The square size is element CSS compiled into the external post CSS file. The submit button Bricks always adds is hidden the same way. A checkbox inside a form stays part of that form',
  mergesChildren: true,
  wrap: true,
  innerKind: 'form',
  kind: () => 'block',

  check(node, det) {
    if (!det.params?.label) return { ok: false, reason: 'params.label is empty' };
    return { ok: true, warnings: [] };
  },

  apply(ctx, det) {
    applyChoice(ctx, det, 'checkbox');
  },
};
