// The drawn bar is the scrollbar: a darker thumb on a lighter track, in one frame.
// Bricks has no scrollbar element. Inside the frame, a normal wheel or trackpad scrolls the items.
// The browser bar stays hidden. A scroll timeline moves the drawn thumb with that scroll.
import { detectScrollLists } from '../../recognize-parts/rules/scroll.mjs';

const HIDE_BAR = [
  { decl: 'scrollbar-width: none;' },
  { decl: 'display: none;', suffix: '::-webkit-scrollbar' },
];

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

// The thumb still follows a drag. The frame itself does not need that drag.
const THUMB_HANDLERS = [
  attr('onpointerdown', "this._on=1;if(this.setPointerCapture)this.setPointerCapture(event.pointerId);var p=this.closest('[data-f2b-scroll]');this._x=event.clientX;this._y=event.clientY;this._l=p.scrollLeft;this._t=p.scrollTop;event.preventDefault()"),
  attr('onpointermove', "if(!this._on)return;var p=this.closest('[data-f2b-scroll]');var t=p.querySelector('[data-f2b-scroll-track]');var y=p.getAttribute('data-f2b-scroll')==='y';var room=(y?t.clientHeight:t.clientWidth)-(y?this.offsetHeight:this.offsetWidth);var max=y?p.scrollHeight-p.clientHeight:p.scrollWidth-p.clientWidth;var delta=y?event.clientY-this._y:event.clientX-this._x;var next=(y?this._t:this._l)+(room>0?delta/room*max:0);if(y)p.scrollTop=next;else p.scrollLeft=next"),
  attr('onpointerup', 'this._on=0'),
  attr('onpointercancel', 'this._on=0'),
];

function findNode(n, id) {
  if (!n) return null;
  if (n.id === id) return n;
  for (const c of n.children ?? []) {
    const hit = findNode(c, id);
    if (hit) return hit;
  }
  return null;
}

// The thumb travels the track that Figma drew. The timeline is named on the container, so a sticky bar still follows that scroll.
function thumbMotion(root, params) {
  const track = findNode(root, params.track);
  const thumb = findNode(root, params.thumb);
  const long = params.axis === 'y' ? 'h' : 'w';
  const room = Math.round((track?.box?.[long] ?? 0) - (thumb?.box?.[long] ?? 0));
  if (room <= 0) return null;
  const name = `f2b-scroll-${String(params.thumb).replace(/[^a-z0-9]/gi, '')}`;
  const axis = params.axis === 'y' ? 'Y' : 'X';
  const timelineAxis = params.axis === 'y' ? 'block' : 'inline';
  return {
    port: `%root% { scroll-timeline-name: --${name}; scroll-timeline-axis: ${timelineAxis}; }`,
    thumb: `@keyframes ${name} { from { transform: translate${axis}(0); } to { transform: translate${axis}(${room}px); } }\n%root% { animation-name: ${name}; animation-duration: auto; animation-timing-function: linear; animation-fill-mode: both; animation-timeline: --${name}; }`,
  };
}

export default {
  id: 'scroll',
  status: 'implemented',
  label: 'Scroll',
  figma: 'a darker block lying on a lighter block, in one frame, beside repeated items that run past the container (`rules/scroll.mjs`)',
  bricks: 'the container uses `_overflow: auto` and hides the browser bar. The drawn thumb moves with that scroll',
  limits: 'The thumb keeps the size Figma drew. No snap and no arrows. A row with arrows stays a slider',
  kind: () => 'block',

  check(node, det, { root } = {}) {
    const params = measured(node, det, root);
    if (!params) return { ok: false, reason: 'this frame is not a darker thumb on a lighter track' };
    return { ok: true, warnings: [] };
  },

  apply({ node, s, root }, det) {
    const params = measured(node, det, root);
    if (!params) return;
    s._position = 'sticky';
    if (params.axis === 'y') s._top = '0px';
    else s._left = '0px';
  },

  descendants(node, det, { root } = {}) {
    const params = measured(node, det, root);
    if (!params) return {};
    const motion = thumbMotion(root, params);
    const out = {
      [params.container]: {
        settings: {
          _overflow: 'auto',
          _attributes: [attr('data-f2b-scroll', params.axis), ...(params.axis === 'x' ? [WHEEL] : [])],
        },
        css: HIDE_BAR,
        expectCss: { overflow: 'auto' },
        ...(motion && { rawCss: motion.port }),
      },
      [params.list]: { settings: { _flexWrap: 'nowrap' } },
      [params.track]: { settings: { _attributes: [attr('data-f2b-scroll-track', params.axis)] } },
      [params.thumb]: {
        settings: { _attributes: [attr('data-f2b-scroll-thumb', params.axis), ...THUMB_HANDLERS] },
        css: [{ decl: 'cursor: grab; touch-action: none; user-select: none;' }],
        ...(motion && { rawCss: motion.thumb }),
      },
    };
    for (const id of params.items ?? []) {
      out[id] = { settings: { _flexShrink: 0, _widthMax: 'none' } };
    }
    return out;
  },
};
