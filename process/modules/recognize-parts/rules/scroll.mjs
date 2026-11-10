// The scroll is the bar Figma draws: a darker block lying on a lighter block, both in one frame.
// The frame beside it holds the repeated items, and those items run past the container.
// The same pair on its side is a vertical scroll. A row of pictures stays with gallery.
// Arrows stay with carousel. "Xem thêm" stays with readmore.
import { textsOf, visibleKids } from './shape.mjs';

const SHAPE = new Set(['RECTANGLE', 'ELLIPSE', 'FRAME', 'VECTOR', 'COMPONENT', 'INSTANCE', 'LINE']);
const BOX = new Set(['FRAME', 'INSTANCE', 'COMPONENT', 'GROUP']);
const READ = /^\s*(xem thêm|đọc thêm|xem tất cả|xem đầy đủ|read more|show more|view more|see more)\s*$/i;
const PAST = 40;

const flow = (n) => visibleKids(n).filter((c) => c.place !== 'ABSOLUTE' && c.box);

function solid(n) {
  return (n?.fills ?? []).find((f) => f.type === 'SOLID' && f.visible !== false && f.hex);
}

function luminance(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

function readMoreAfter(parent, node) {
  if (!parent) return false;
  const kids = visibleKids(parent);
  const index = kids.indexOf(node);
  return kids.slice(index + 1).some((k) => textsOf(k).some((t) => READ.test(t.text.characters)));
}

function hasArrows(n) {
  const glyphs = textsOf(n).map((t) => t.text.characters.toLowerCase()).join(' ');
  return /angle-left|chevron-left|arrow-left/.test(glyphs) && /angle-right|chevron-right|arrow-right/.test(glyphs);
}

function closeSize(nodes, key) {
  const values = nodes.map((n) => n.box?.[key] ?? 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  return max > 0 && (max - min) / max <= 0.2;
}

function itemsOf(n) {
  const kids = flow(n).filter((c) => BOX.has(c.type));
  if (kids.length < 2) return null;
  if (!kids.every((c) => textsOf(c).length > 0)) return null;
  if (!closeSize(kids, 'w') || !closeSize(kids, 'h')) return null;
  return kids;
}

function overlaps(track, thumb, axis) {
  const cross = axis === 'x' ? 'y' : 'x';
  const along = axis === 'x' ? 'x' : 'y';
  const crossSize = axis === 'x' ? 'h' : 'w';
  const alongSize = axis === 'x' ? 'w' : 'h';
  const crossHit = thumb.box[cross] < track.box[cross] + track.box[crossSize] + 1
    && track.box[cross] < thumb.box[cross] + thumb.box[crossSize] + 1;
  const onTrack = thumb.box[along] >= track.box[along] - 1
    && thumb.box[along] + thumb.box[alongSize] <= track.box[along] + track.box[alongSize] + 1;
  return crossHit && onTrack;
}

// Two filled shapes in one frame. The longer, lighter one is the track. The shorter, darker one is the thumb.
function barOf(frame) {
  if (!frame?.box) return null;
  const kids = visibleKids(frame).filter((c) => c.box && SHAPE.has(c.type) && textsOf(c).length === 0);
  if (kids.length !== 2) return null;
  const horizontal = kids.every((c) => c.box.h <= 18) && Math.max(...kids.map((c) => c.box.w)) >= 40;
  const vertical = kids.every((c) => c.box.w <= 18) && Math.max(...kids.map((c) => c.box.h)) >= 40;
  if (horizontal === vertical) return null;
  const axis = horizontal ? 'x' : 'y';
  const long = axis === 'x' ? 'w' : 'h';
  const [track, thumb] = kids[0].box[long] >= kids[1].box[long] ? kids : [kids[1], kids[0]];
  if (track.box[long] < frame.box[long] * 0.8) return null;
  if (thumb.box[long] < 8 || thumb.box[long] >= track.box[long] * 0.95) return null;
  if (!overlaps(track, thumb, axis)) return null;
  const trackFill = solid(track);
  const thumbFill = solid(thumb);
  if (!trackFill || !thumbFill) return null;
  if (luminance(thumbFill.hex) >= luminance(trackFill.hex)) return null;
  return { axis, track, thumb };
}

function listBeside(container, bar, axis) {
  const along = axis === 'x' ? 'w' : 'h';
  const start = axis === 'x' ? 'x' : 'y';
  const row = flow(container).find((c) => c.id !== bar.id && c.box && c.box[start] + c.box[along] > container.box[along] + PAST);
  const items = row ? itemsOf(row) : null;
  if (!row || !items) return null;
  return { list: row, items };
}

function cite(node, field, equals) {
  return { node, field, equals };
}

export function detectScrollLists(tree) {
  const found = [];
  (function walk(n, parent) {
    if (!n || n.visible === false) return;
    const bar = barOf(n);
    const beside = bar && parent ? listBeside(parent, n, bar.axis) : null;
    if (bar && beside && !readMoreAfter(parent, n) && !hasArrows(parent) && !hasArrows(beside.list)) {
      found.push({
        component: 'scroll',
        node: n.id,
        level: 'E1',
        confidence: 'high',
        cite: [cite(bar.thumb.id, 'type', bar.thumb.type), cite(bar.track.id, 'type', bar.track.type), cite(beside.items[0].id, 'type', beside.items[0].type)],
        evidence: `"${n.name}" is a darker thumb on a lighter track, scrolling ${beside.items.length} items in "${beside.list.name}"`,
        params: {
          axis: bar.axis,
          container: parent.id,
          list: beside.list.id,
          items: beside.items.map((c) => c.id),
          track: bar.track.id,
          thumb: bar.thumb.id,
        },
        note: bar.axis === 'x' ? 'the drawn bar is the horizontal scroll' : 'the drawn bar is the vertical scroll',
      });
      return;
    }
    for (const c of visibleKids(n)) walk(c, n);
  })(tree, null);
  return found;
}
