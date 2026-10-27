// COMPONENT link (basic): a TEXT node that is a link. Bricks 1.9.8: `text-link` (text + link). The URL is never in Figma, so
// params.link is optional: without it the link is written as "#" (owner decision) and the report lists the missing URL.
//   source: includes/elements/text-link.php (controls: text, link)
// Typography comes from the text node; hover fades like every link / button (owner default, bricks/defaults.mjs).
// params: link (url; missing -> '#')
import { applyText } from '../render/text.mjs';
import { addHoverFade } from '../render/utils/interactions.mjs';
import { linkSetting, MISSING_URL } from './helpers.mjs';

export default {
  id: 'link',
  status: 'implemented',
  label: 'Text link (basic)',
  figma: 'a TEXT node used as a link (underlined / colored / named link)',
  bricks: '`text-link` element: text + external url, typography from the text node, hover fade',
  limits: 'the URL is not in Figma (params.link); target / rel not set; a frame with text + icon is not supported (text only)',
  kind: () => 'text-link',

  check(node, det) {
    if (node.type !== 'TEXT' || node.svg) return { ok: false, reason: 'a link must be a text node (not an icon)' };
    return { ok: true, warnings: det.params?.link ? [] : [`no URL in Figma: the link is written as "${MISSING_URL}" (designer list)`] };
  },

  apply(ctx, det) {
    applyText(ctx);
    ctx.s.link = linkSetting(det.params?.link);
    addHoverFade(ctx.s);
  },
};
