// COMPONENT carousel (basic): a horizontal row of slides, optionally with a pagination row drawn next to it.
// Bricks 1.9.8: `slider-nested` (Splide). Every child of the row becomes a slide (slide widths belong to the slider: perPage + gap).
//   source: includes/elements/slider-nested.php (settings: type, perPage, gap, pagination …)
// BASIC on purpose: perPage and gap come from Figma (how many slides fit in the row's width, the auto layout gap); arrows, autoplay,
// loop and the look of the pagination are NOT in Figma and are not invented. Pagination = on/off; its look is Bricks default
// unless params.settings (raw Bricks settings, object) says otherwise.
// params: perPage (optional override) · pagination (optional node id of the dashes / dots row, merged into the slider's own) ·
//         controls (optional node ids of other control holders, e.g. the row that holds both arrows: merged, not a slide) · allowSingle (true: a column with ONE drawn slide + its controls is a slider, e.g. a benchmark image with arrows)
//         prev / next (optional node ids of the arrow buttons: size, fill, border, radius, svg icon and position become the Bricks arrows) ·
//         settings (optional object, deep-merged over the generated settings)
import { deepMerge } from '../render/utils/merge.mjs';
import { boxLook, findNode, jsonParam, svgIcon, svgNode, visibleKids } from './helpers.mjs';
import { px } from '../render/utils/css.mjs';

const controlIds = (det) => [det.params?.pagination, det.params?.prev, det.params?.next, ...(det.params?.controls ?? [])].filter(Boolean);
const slidesOf = (node, det) => visibleKids(node).filter((c) => !controlIds(det).includes(c.id));
const perPageOf = (node, slides, det) => {
  if (det.params?.perPage) return Math.max(1, Number(det.params.perPage));
  const room = node.box.w - (node.layout?.padding?.right ?? 0);
  return Math.max(1, slides.filter((c) => c.box.x + c.box.w <= room + 1).length); // slides entirely visible in the Figma frame
};

export default {
  id: 'carousel',
  status: 'implemented',
  label: 'Carousel (basic)',
  figma: 'a horizontal auto-layout row of >= 2 similar items (slides), optionally a pagination row next to it',
  bricks: '`slider-nested`: type slide, perPage = slides fitting the row, gap = auto layout gap, pagination on/off',
  limits: 'arrows / autoplay / loop / pagination look are not in Figma, so not built (Bricks defaults); use params.settings to add them',
  kind: () => 'slider-nested',
  mergedNodes: (det) => controlIds(det),

  check(node, det, { root }) {
    if (node.layout?.mode !== 'HORIZONTAL' && !det.params?.allowSingle) return { ok: false, reason: 'the slide row must be a horizontal auto layout' };
    const slides = slidesOf(node, det);
    if (slides.length < (det.params?.allowSingle ? 1 : 2)) return { ok: false, reason: `needs at least 2 slides, found ${slides.length}` };
    for (const k of ['pagination', 'prev', 'next']) if (det.params?.[k] && !findNode(root, det.params[k])) return { ok: false, reason: `params.${k} ${det.params[k]} is not in the tree` };
    const w = ['arrows', 'autoplay', 'loop'].map((k) => k).join(', ');
    return { ok: true, warnings: [`basic slider: ${slides.length} slides, ${perPageOf(node, slides, det)} per page; ${w} are not in Figma and use Bricks defaults`] };
  },

  apply({ node, s, root, warn }, det) {
    const slides = slidesOf(node, det);
    Object.assign(s, { type: 'slide', perPage: det.params?.allowSingle ? 1 : perPageOf(node, slides, det), gap: node.layout.gap });
    if (det.params?.pagination) {
      s.pagination = true;
      const pag = findNode(root, det.params.pagination);
      const dots = visibleKids(pag).filter((d) => d.box && d.fills?.some((f) => f.type === 'SOLID'));
      if (dots.length >= 2) {
        // a row of shapes: the odd one out (different fill) is the active dot, the others are the idle ones
        const fillOf = (d) => JSON.stringify(d.fills.filter((f) => f.type === 'SOLID').pop());
        const idle = dots.find((d) => dots.filter((x) => fillOf(x) === fillOf(d)).length > 1) ?? dots[0];
        const active = dots.find((d) => fillOf(d) !== fillOf(idle)) ?? idle;
        Object.assign(s, { paginationWidth: px(idle.box.w), paginationHeight: px(idle.box.h), paginationColor: boxLook(idle, warn).background,
          paginationWidthActive: px(active.box.w), paginationHeightActive: px(active.box.h), paginationColorActive: boxLook(active, warn).background });
        if (pag.layout) s.paginationSpacing = px(pag.layout.gap);
      } else warn(pag, 'pagination is drawn as one svg: Bricks default dots (size, color, spacing are not in Figma as values)');
    }
    for (const [key, label] of [['prev', 'prevArrow'], ['next', 'nextArrow']]) {
      if (!det.params?.[key]) continue;
      const a = findNode(root, det.params[key]);
      const look = boxLook(a, warn);
      s.arrows = true;
      s.arrowWidth = px(a.box.w);
      s.arrowHeight = px(a.box.h);
      if (look.background) s.arrowBackground = look.background;
      if (look.border) s.arrowBorder = look.border;
      const ic = svgNode(a);
      if (ic) s[label] = svgIcon(ic);
      // position inside the slider box: top / left of the arrow in the Figma row
      s[`${label}Top`] = px(a.box.y);
      s[`${label}Left`] = px(a.box.x);
    }
    const extra = jsonParam(det.params?.settings);
    if (extra && typeof extra === 'object') Object.assign(s, deepMerge(s, extra));
  },
};
