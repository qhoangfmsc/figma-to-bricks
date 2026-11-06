// COMPONENT menu-slider: a menu row whose items do not fit the frame.
// Kept apart from `carousel` on purpose. A content slider is always loop and autoplay, with one dash per item.
// A menu slider is not: it stops at the first and last item, it does not autoplay, and it has no dash strip.
// It still moves by drag and by the drawn arrows. Each item keeps its own width (autoWidth) and stays a text-link.
//   source: includes/elements/slider-nested.php (optionsType custom). The link and Active look are the menu's (menu.mjs).
// params: links { textNodeId: url } · prev / next (arrow buttons) · controls (navigation frame merged, not a slide)
import { findNode, svgIcon, svgNode, visibleKids } from '../../write-bricks/components/helpers.mjs';
import { addCustomCss, colorObj, px } from '../../write-bricks/render/utils/css.mjs';
import { menuCheck, menuClass, menuItemPatches, navPatch, paintActive } from '../../write-bricks/components/menu.mjs';

const glyphFill = (n) => {
  const ic = svgNode(n);
  return (ic?.fills ?? []).find((f) => f.type === 'SOLID' && f.hex) ?? null;
};
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
};

// Arrows keep their own icon. Each button owns a gutter of its own width, and the track is inset by that
// width so a label is clipped before it reaches the button. Splide's padding option does not do this:
// slides travel through that padding and pass under the arrow while the row moves.
// The lighter drawn icon is the disabled colour (only while that direction cannot move); both arrows use
// the darker colour while they can be pressed.
function applyArrows(s, host, pair) {
  const ready = pair.filter((p) => p.node?.box);
  if (!ready.length) return { left: 0, right: 0 };
  s.arrows = true;
  s.arrowDisabledOpacity = 1;
  const pad = { left: 0, right: 0 };
  const paints = [];
  for (const { key, label, node: a } of ready) {
    s.arrowWidth ??= px(a.box.w);
    s.arrowHeight ??= px(a.box.h);
    const ic = svgNode(a);
    if (ic) s[label] = svgIcon(ic);
    const fill = glyphFill(a);
    if (fill) paints.push(fill);
    const top = a.box.absY != null && host.box?.absY != null ? a.box.absY - host.box.absY : a.box.y;
    s[`${label}Top`] = px(top);
    const side = key === 'prev' ? 'prev' : 'next';
    if (key === 'prev') {
      pad.left = Math.max(pad.left, a.box.w);
      s[`${label}Left`] = '0px';
      // Splide's own rule is `left: 1em` on the same button. It has to lose, or the glyph sits on the label.
      addCustomCss(s, 'padding: 0; box-sizing: border-box; left: 0 !important; right: auto !important; bottom: auto; transform: none; z-index: 2;', ` .splide__arrow--${side}`);
    } else {
      pad.right = Math.max(pad.right, a.box.w);
      s[`${label}Right`] = '0px';
      addCustomCss(s, 'padding: 0; box-sizing: border-box; left: auto !important; right: 0 !important; bottom: auto; transform: none; z-index: 2;', ` .splide__arrow--${side}`);
    }
    if (ic?.box) addCustomCss(s, `width: ${px(ic.box.w)}; height: ${px(ic.box.h)};`, ` .splide__arrow--${side} svg`);
  }
  if (paints.length) {
    const ranked = [...paints].sort((a, b) => lum(a.hex) - lum(b.hex));
    s.arrowColor = colorObj(ranked[0]);
    const faded = ranked[ranked.length - 1];
    if (lum(faded.hex) - lum(ranked[0].hex) > 1) s.arrowDisabledColor = colorObj(faded);
    // The exported glyph has its own fill. The button colour (and the disabled colour) has to win.
    addCustomCss(s, 'fill: currentColor !important;', ' .splide__arrow svg *');
  }
  return pad;
}

// The arrow buttons and the slides are children of the same menu box (border-box). Padding reserves a column
// of each button's width inside that box. The track is `width: 100%` of the content box, so the labels stop
// before the button. A margin on the track does not: Splide's `width: 100%` keeps the labels under the button.
function reserveArrowColumns(s, pad) {
  if (!pad.left && !pad.right) return;
  const prev = s._padding ?? { top: '0px', right: '0px', bottom: '0px', left: '0px' };
  const num = (v) => parseFloat(v) || 0;
  s._padding = {
    top: prev.top ?? '0px',
    bottom: prev.bottom ?? '0px',
    left: px(num(prev.left) + pad.left),
    right: px(num(prev.right) + pad.right),
  };
}

export default {
  id: 'menu-slider',
  status: 'implemented',
  label: 'Menu slider (links that do not fit, drag and arrows, no loop)',
  figma: 'a menu row whose items run past the frame, often with angle-left / angle-right beside it',
  bricks: '`slider-nested` type slide, autoWidth, drag and the drawn arrows, no loop, no autoplay, no dashes. Each label is a `text-link`. A drawn Active item is the selected link; a click moves that look',
  limits: 'not the content slider (`carousel` is always loop and autoplay). This one stops at the ends. Arrows sit beside the labels, not on top of them. The lighter arrow colour shows only while that arrow cannot move. URLs come from the Plan (missing -> "#"). No dash strip is added. The active colour is only the one Figma drew',

  check(node, det) {
    return menuCheck(node, det);
  },

  kind() {
    return 'slider-nested';
  },

  apply({ node, s, css, root }, det) {
    s._cssClasses = [s._cssClasses, menuClass(node)].filter(Boolean).join(' ');
    paintActive(s, node);
    // The menu frame clips its items. The arrows are drawn outside that box, so the slider root stays visible and the track clips the items.
    s._overflow = 'visible';
    if (css) css.overflow = 'visible';
    const kids = visibleKids(node).filter((k) => k.box).sort((a, b) => a.box.x - b.box.x);
    let gap = node.layout?.gap;
    if (gap == null && kids.length >= 2) {
      const d = kids[1].box.x - (kids[0].box.x + kids[0].box.w);
      gap = d > 0 ? d : 0;
    }
    const pair = [['prev', 'prevArrow'], ['next', 'nextArrow']]
      .filter(([key]) => det.params?.[key])
      .map(([key, label]) => ({ key, label, node: findNode(root, det.params[key]) }));
    reserveArrowColumns(s, applyArrows(s, node, pair));
    const options = {
      type: 'slide', autoWidth: true, drag: true, rewind: false, omitEnd: true,
      gap: px(gap ?? 0), perMove: 1, start: 0, arrows: true, pagination: false,
      height: node.box?.h ? px(node.box.h) : 'auto',
    };
    s.optionsType = 'custom';
    s.options = JSON.stringify(options);
  },

  mergedNodes(det) {
    return [det.params?.prev, det.params?.next, ...(det.params?.controls ?? [])].filter(Boolean);
  },

  descendants(node, det, { root }) {
    return { ...menuItemPatches(node, det, { slide: true }), ...navPatch(root, node) };
  },
};
