// A pill track, one knob, and one label. Bricks 1.12.3 has no switch element, so the control is a checkbox field.
import { applyChoice } from './choice-control.mjs';

export default {
  id: 'switch',
  status: 'implemented',
  label: 'Switch',
  figma: 'a row whose children are one fully rounded pill (a knob inside it) and one text label',
  bricks: 'a block (the Figma row) holding a form labeled Switch. The field is a checkbox because 1.12.3 has no switch element. The pill fill, the knob, and which side the label sits on come from the Figma row',
  innerLabel: 'Switch',
  limits: 'Bricks 1.12.3 has no switch / toggle-mode element. The pill size is element CSS compiled into the external post CSS file. The submit button Bricks always adds is hidden the same way',
  mergesChildren: true,
  wrap: true,
  innerKind: 'form',
  kind: () => 'block',

  check(node, det) {
    if (!det.params?.label) return { ok: false, reason: 'params.label is empty' };
    return { ok: true, warnings: [] };
  },

  apply(ctx, det) {
    applyChoice(ctx, det, 'switch');
  },
};
