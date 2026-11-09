// A line. Bricks 1.12.3 element `divider` (includes/elements/divider.php): height, width, style, direction, color.
import { colorObj, px } from '../render/utils/css.mjs';

export default {
  id: 'divider',
  status: 'implemented',
  label: 'Divider',
  figma: 'a line: one side at most 2px, the other at least 40px (`rules/divider.mjs`)',
  bricks: '`divider`. Height is the thickness on a horizontal line and the length on a vertical line. Color is the solid fill when Figma drew one',
  limits: 'A stroke that is not a solid fill is not copied. No icon is added',
  mergesChildren: true,
  kind: () => 'divider',

  check() {
    return { ok: true, warnings: [] };
  },

  apply(ctx, det) {
    const { s: t } = ctx;
    const horizontal = det.params?.direction !== 'vertical';
    const length = px(det.params?.length ?? 0);
    const thickness = px(det.params?.thickness ?? 1);
    t.direction = horizontal ? 'horizontal' : 'vertical';
    t.style = 'solid';
    t.height = horizontal ? thickness : length;
    t.width = horizontal ? length : thickness;
    if (det.params?.color?.hex) t.color = colorObj(det.params.color);
  },
};
