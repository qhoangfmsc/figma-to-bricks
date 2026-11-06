// Visual style of one node: fill, stroke, radius, effects, opacity/clip/blend, rotation.
// This file only calls the small modules in utils/ in a fixed order. To support a new Figma property, add or extend a
// module in utils/ and call it here (see ../../AI-GUIDE.md).
import { applyFill } from '../../write-bricks/render/utils/fill.mjs';
import { applyStroke } from '../../write-bricks/render/utils/stroke.mjs';
import { applyLine } from '../../write-bricks/render/utils/line.mjs';
import { applyRadius } from '../../write-bricks/render/utils/radius.mjs';
import { applyEffects } from '../../write-bricks/render/utils/effects.mjs';
import { applyAppearance } from '../../write-bricks/render/utils/appearance.mjs';
import { applyRotation } from '../../write-bricks/render/utils/rotation.mjs';
import { applyInteractions } from '../../write-bricks/render/utils/interactions.mjs';

export function applyStyle(ctx, { skipFill = false } = {}) {
  // A node exported as an svg file already carries its fill, stroke, corner radius and effects inside the file (Figma drew them). Painting them again
  // with CSS put a white rectangle behind the vector (the Hero mobile corners / panel), so only placement-level style is applied to it.
  if (ctx.node.svg && ctx.node.type !== 'TEXT') {
    applyAppearance(ctx);
    applyRotation(ctx);
    applyInteractions(ctx);
    return;
  }
  applyFill(ctx, { skipFill });
  const border = {}; // stroke and radius both write the Bricks `_border` object
  const line = applyLine(ctx); // a LINE draws its stroke itself (zero thickness box), no border / rotation
  // A component can own the stroke itself (the menu Active underline is a class, so it can move on click).
  if (!line && !ctx.skipStroke) applyStroke(ctx, border);
  applyRadius(ctx, border);
  if (Object.keys(border).length) ctx.s._border = border;
  applyEffects(ctx);
  applyAppearance(ctx);
  if (!line) applyRotation(ctx);
  applyInteractions(ctx);
}
