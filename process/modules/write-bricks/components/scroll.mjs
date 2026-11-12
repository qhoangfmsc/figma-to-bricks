// The drawn bar names the scroll: a darker thumb on a lighter track, in one frame.
// Those two shapes are not elements. A line div cannot be dragged, and it stays painted when the text already fits.
// The browser scrollbar uses their two colors and appears only while the content overflows.
import { detectScrollLists } from '../../recognize-parts/rules/scroll.mjs';

function paint(node) {
  return (node?.fills ?? []).find((f) => f.visible !== false && f.type === 'SOLID' && f.hex)?.hex ?? null;
}

// The browser paints this bar only when the content is longer than the window. A drawn line cannot know that.
function scrollbarCss(trackHex, thumbHex, axis) {
  const size = axis === 'y' ? 'width' : 'height';
  return [
    { decl: `scrollbar-width: thin; scrollbar-color: ${thumbHex} ${trackHex};` },
    { decl: `${size}: 2px;`, suffix: '::-webkit-scrollbar' },
    { decl: `background: ${trackHex};`, suffix: '::-webkit-scrollbar-track' },
    { decl: `background: ${thumbHex};`, suffix: '::-webkit-scrollbar-thumb' },
  ];
}

function measured(node, det, root) {
  const hit = detectScrollLists(root || node).find((c) => c.node === node.id);
  if (hit) {
    det.params = { ...(det.params ?? {}), ...hit.params };
    return det.params;
  }
  const params = det.params;
  if (params?.axis && params.container && params.list && params.track && params.thumb) return params;
  return null;
}

function attr(name, value) {
  return { name, value };
}

// A vertical wheel over a horizontal frame scrolls the items. A sideways wheel or trackpad is left to the browser.
// At either end the wheel returns to the page. Inline, because this site delays footer scripts.
const WHEEL = attr('onwheel', "if(this.getAttribute('data-f2b-scroll')==='y')return;if(Math.abs(event.deltaX)>Math.abs(event.deltaY))return;var max=this.scrollWidth-this.clientWidth;var next=Math.max(0,Math.min(max,this.scrollLeft+event.deltaY));if(next===this.scrollLeft)return;this.scrollLeft=next;event.preventDefault()");

function findNode(n, id) {
  if (!n) return null;
  if (n.id === id) return n;
  for (const c of n.children ?? []) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

export default {
  id: 'scroll',
  status: 'implemented',
  label: 'Scroll',
  figma: 'a darker block lying on a lighter block, in one frame, beside repeated items or text that run past the container (`rules/scroll.mjs`)',
  bricks: 'the container uses `_overflow: auto`. The browser bar uses the track and thumb colors and shows only while the content overflows. The drawn shapes are not elements',
  limits: 'No snap and no arrows. A row with arrows stays a slider. The bar is the browser scrollbar, so its length follows the overflow, not the drawn thumb',
  kind: () => 'block',

  mergedNodes(det) {
    const params = det.params ?? {};
    return [params.track, params.thumb].filter(Boolean);
  },

  check(node, det, { root } = {}) {
    const params = measured(node, det, root);
    if (!params) return { ok: false, reason: 'this frame is not a darker thumb on a lighter track' };
    return { ok: true, warnings: [] };
  },

  apply({ node, s, root }, det) {
    const params = measured(node, det, root);
    if (!params || params.container === node.id) return;
    // The bar frame is only the two shapes. They are not built, so the frame itself must not sit there as an empty line.
    s._display = 'none';
  },

  descendants(node, det, { root } = {}) {
    const params = measured(node, det, root);
    if (!params) return {};
    const embedded = params.container === node.id;
    const trackHex = paint(findNode(root, params.track)) ?? '#f2f3f5';
    const thumbHex = paint(findNode(root, params.thumb)) ?? '#747475';
    const out = {
      [params.container]: {
        settings: {
          _overflow: 'auto',
          ...(embedded ? { _width: '100%', _alignSelf: 'stretch', _height: `${node.box.h}px`, _flexGrow: 0, _flexShrink: 0 } : {}),
          _attributes: [attr('data-f2b-scroll', params.axis), ...(params.axis === 'x' ? [WHEEL] : [])],
        },
        css: scrollbarCss(trackHex, thumbHex, params.axis),
        expectCss: { overflow: 'auto' },
      },
      [params.list]: { settings: embedded ? { _flexShrink: 0 } : { _flexWrap: 'nowrap' } },
    };
    for (const id of params.items ?? []) {
      out[id] = { settings: { _flexShrink: 0, _widthMax: 'none' } };
    }
    return out;
  },
};
