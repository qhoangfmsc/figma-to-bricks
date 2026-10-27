// Visual style of one node: fill, stroke, radius, effects, opacity/clip/blend, rotation.
// This file only calls the small modules in utils/ in a fixed order. To support a new Figma property, add or extend a
// module in utils/ and call it here (see ../../AI-GUIDE.md).
import { applyFill } from './utils/fill.mjs';
import { applyStroke } from './utils/stroke.mjs';
import { applyLine } from './utils/line.mjs';
import { applyRadius } from './utils/radius.mjs';
import { applyEffects } from './utils/effects.mjs';
import { applyAppearance } from './utils/appearance.mjs';
import { applyRotation } from './utils/rotation.mjs';
import { applyInteractions } from './utils/interactions.mjs';

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
  if (!line) applyStroke(ctx, border);
  applyRadius(ctx, border);
  if (Object.keys(border).length) ctx.s._border = border;
  applyEffects(ctx);
  applyAppearance(ctx);
  if (!line) applyRotation(ctx);
  applyInteractions(ctx);
}
