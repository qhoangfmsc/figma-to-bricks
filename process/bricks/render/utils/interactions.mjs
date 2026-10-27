// Prototype interactions -> hover. OWNER DECISION (bricks/defaults.mjs): there is no default hover any more (it was opacity 0.8); when a default is set it gets `opacity: <DEFAULTS.hover.opacity>` with the
// transition time / easing the designer drew (or the default), instead of the real values of the hover variant.
// Why not the real values: Figma stores the hover as another variant (interaction dest), which is outside the fetched subtree.
// So the build is honest about it: nodes with a drawn hover get a ⚠ "default used" line, and hover is never measured by verify.
// To do it properly later: fetch the destination node (figma/api.mjs getNode), diff it against this node, write the difference
// as `:hover` rules (addCustomCss(s, decl, ':hover')) and add them to mapping.expect.
import { DEFAULTS } from '../../defaults.mjs';
import { addCustomCss } from './css.mjs';

const EASING = { EASE_IN: 'ease-in', EASE_OUT: 'ease-out', EASE_IN_AND_OUT: 'ease-in-out', LINEAR: 'linear' };

// shared by every element that should fade on hover (also used by components: button, link, linked images)
export function addHoverFade(s, { duration, easing } = {}) {
  if (!DEFAULTS.hover) return; // no default hover (owner decision): nothing is written
  duration ??= DEFAULTS.hover.duration;
  easing ??= DEFAULTS.hover.easing;
  addCustomCss(s, `transition: opacity ${duration}s ${easing};`);
  addCustomCss(s, `opacity: ${DEFAULTS.hover.opacity};`, ':hover');
}

export function applyInteractions({ node, s, warn }) {
  const hover = (node.interactions ?? []).find((i) => i.trigger === 'ON_HOVER');
  if (hover) {
    addHoverFade(s, { duration: hover.duration, easing: EASING[hover.easing] });
    warn(node, DEFAULTS.hover
      ? `Figma prototype ON_HOVER → ${hover.navigation ?? hover.action} ${hover.dest ?? ''}: built the owner default (opacity ${DEFAULTS.hover.opacity}) instead of the hover variant's real values`
      : `Figma prototype ON_HOVER → ${hover.navigation ?? hover.action} ${hover.dest ?? ''}: hover not built (no default, the hover variant's real values are not read yet)`);
  }
  for (const i of (node.interactions ?? []).filter((x) => x.trigger !== 'ON_HOVER')) warn(node, `prototype ${i.trigger} → ${i.action}${i.dest ? ' ' + i.dest : ''}${i.url ? ' ' + i.url : ''} is not applied`);
}
