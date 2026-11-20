// Widgets this project owns, matched by shape.
// A layer name does not decide. Numbers come from the tree.
import { NodeType, FillType, isType, isText } from '../node-type.mjs';
import { PartKind } from '../kinds.mjs';
import { hasClose, textsOf, visibleKids } from './shape.mjs';
import { priceFrames } from '../../write-bricks/components/price-table.mjs';
import { compareFrames } from '../../write-bricks/components/compare-table.mjs';

const kids = visibleKids;

function solid(n) {
  return (n?.fills ?? []).find((f) => isType(f, FillType.SOLID) && f.visible !== false);
}

function imageFile(n) {
  const fill = (n?.fills ?? []).find((f) => isType(f, FillType.IMAGE) && f.asset?.file);
  if (fill) return fill.asset.file;
  for (const c of kids(n)) {
    const file = imageFile(c);
    if (file) return file;
  }
  return null;
}

function isPicture(n) {
  return !!imageFile(n) && textsOf(n).length === 0 && !n.svg;
}

function similar(nodes, key) {
  const values = nodes.map((n) => n.box?.[key] ?? 0).filter((v) => v > 0);
  if (values.length < nodes.length) return false;
  const max = Math.max(...values);
  const min = Math.min(...values);
  return max === 0 || (max - min) / max <= 0.2;
}

function cite(node, field, equals) {
  return { node, field, equals };
}

function detectGallery(n) {
  const items = kids(n).filter(isPicture);
  if (items.length < 2 || items.length !== kids(n).filter((k) => !isText(k)).length) return null;
  if (!similar(items, 'h') || !similar(items, 'w')) return null;
  if (items.some((item) => (item.box?.x ?? 0) < -1 || (item.box?.x ?? 0) + item.box.w > (n.box?.w ?? 0) + 1)) return null;
  const images = items.map(imageFile).filter(Boolean);
  if (images.length !== items.length) return null;
  const rows = new Map();
  for (const item of items) {
    const y = Math.round((item.box?.y ?? 0) / 8);
    rows.set(y, (rows.get(y) ?? 0) + 1);
  }
  return {
    component: PartKind.GALLERY,
    node: n.id,
    confidence: 'high',
    cite: [cite(n.id, 'type', n.type), cite(items[0].id, 'type', items[0].type)],
    evidence: `${items.length} pictures of one size`,
    params: {
      images,
      columns: Math.max(...rows.values()),
      height: Math.round(items[0].box.h),
      gutter: Math.round(n.layout?.gap ?? 0),
    },
  };
}

function along(node) {
  const w = node.box?.w ?? 0;
  const h = node.box?.h ?? 0;
  if (w <= 0 || h <= 0 || w === h) return null;
  return w > h ? 'w' : 'h';
}

function barOf(n) {
  const track = kids(n).find((child) => along(child));
  if (!track) return null;
  const pictured = (node) => (node.fills ?? []).some((fill) => isType(fill, FillType.IMAGE)) || (node.children ?? []).some((child) => child.visible !== false && pictured(child));
  if (pictured(track)) return null;
  const words = textsOf(track).map((text) => text.text.characters.trim()).filter((text) => text && !/%$/.test(text));
  if (words.some((text) => !/^\d{1,3}$/.test(text))) return null;
  const axis = along(track);
  const fill = kids(track).find((child) => solid(child) && along(child) === axis && child.box[axis] < track.box[axis] - 0.5);
  if (!fill) return null;
  const label = textsOf(n).find((t) => !kids(track).some((c) => c.id === t.id));
  const percentText = textsOf(n).map((t) => t.text.characters.trim()).find((t) => /%$/.test(t));
  const percentage = percentText ? Number(percentText.replace('%', '')) : Math.round((fill.box.w / track.box.w) * 100);
  if (!Number.isFinite(percentage)) return null;
  return {
    title: label && !/%$/.test(label.text.characters.trim()) ? label.text.characters.trim() : '',
    percentage,
    color: solid(fill) ? { hex: solid(fill).hex, alpha: solid(fill).alpha ?? 1 } : null,
    height: Math.round(track.box.h),
    showPercentage: !!percentText,
  };
}

function besideScroll(n) {
  if (!n?.box) return false;
  const thin = kids(n).filter((child) => {
    const axis = along(child);
    if (!axis) return false;
    const long = Math.max(child.box.w, child.box.h);
    const short = Math.min(child.box.w, child.box.h);
    return short / long <= 0.35;
  });
  if (!thin.length) return false;
  return kids(n).some((child) => child.box && !thin.includes(child) && textsOf(child).length > 0 && (child.box.x + child.box.w > n.box.w + 0.5 || child.box.y + child.box.h > n.box.h + 0.5));
}

function detectProgress(n) {
  // A thin bar beside a list that runs past the frame is a scrollbar, not a percent.
  if (besideScroll(n)) return null;
  const direct = kids(n).map(barOf).filter(Boolean);
  const own = barOf(n);
  const bars = direct.length ? direct : own ? [own] : [];
  if (!bars.length) return null;
  if (direct.length && direct.length < kids(n).filter((k) => !isText(k)).length) return null;
  return {
    component: PartKind.PROGRESS,
    node: n.id,
    confidence: 'high',
    cite: [cite(n.id, 'type', n.type)],
    evidence: `${bars.length} bar(s), ${bars.map((b) => `${b.percentage}%`).join(', ')}`,
    params: { bars, height: bars[0].height, showPercentage: bars.some((b) => b.showPercentage) },
  };
}

function detectRating(n) {
  if (n.layout?.mode !== 'HORIZONTAL') return null;
  const marks = kids(n).filter((c) => {
    const w = c.box?.w ?? 0;
    const h = c.box?.h ?? 0;
    return w > 0 && h > 0 && Math.abs(w - h) / Math.max(w, h) <= 0.25;
  });
  if (marks.length < 2 || marks.length !== kids(n).length) return null;
  const names = marks.map((c) => c.component || c.svg?.file || '').filter(Boolean);
  if (new Set(names).size !== 1) return null;
  const full = marks.filter((c) => (c.opacity ?? 1) >= 0.9 && ((solid(c)?.alpha ?? 1) >= 0.9 || !solid(c)));
  return {
    component: PartKind.RATING,
    node: n.id,
    confidence: 'high',
    cite: [cite(marks[0].id, 'type', marks[0].type)],
    evidence: `${full.length} of ${marks.length} of the same mark`,
    params: {
      rating: full.length,
      maxRating: marks.length,
      gap: Math.round(n.layout?.gap ?? 0),
      iconSize: Math.round(marks[0].box.w),
      ...(solid(full[0] ?? marks[0]) && { color: { hex: solid(full[0] ?? marks[0]).hex, alpha: solid(full[0] ?? marks[0]).alpha ?? 1 } }),
    },
  };
}

function detectAlert(n, parent) {
  if (n.layout?.mode !== 'HORIZONTAL' || !solid(n)) return null;
  if (parent?.box?.w && n.box?.w && n.box.w < parent.box.w * 0.55) return null;
  const texts = textsOf(n);
  const icon = kids(n).find((c) => c.svg);
  if (texts.length !== 1 || !icon || !texts[0].text.characters.trim()) return null;
  return {
    component: PartKind.ALERT,
    node: n.id,
    confidence: 'high',
    cite: [cite(texts[0].id, 'type', NodeType.TEXT)],
    evidence: `a tinted bar with one icon and "${texts[0].text.characters.trim().slice(0, 40)}"`,
    params: { content: texts[0].text.characters.trim(), dismissable: hasClose(n) },
  };
}

function detectLogo(n, parent) {
  if (!parent?.box || parent.layout?.mode !== 'HORIZONTAL') return null;
  const first = kids(parent)[0];
  if (first?.id !== n.id) return null;
  const file = n.svg?.file || imageFile(n);
  if (!file || (n.box?.h ?? 0) <= 0 || n.box.h > parent.box.h) return null;
  const links = textsOf(parent);
  if (links.length < 2) return null;
  return {
    component: PartKind.LOGO,
    node: n.id,
    confidence: 'high',
    cite: [cite(n.id, 'type', n.type)],
    evidence: 'the first picture in a short bar that also has links',
    params: { file, width: Math.round(n.box.w), height: Math.round(n.box.h) },
  };
}

function detectHamburger(n) {
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  if (w <= 0 || h <= 0 || Math.abs(w - h) / Math.max(w, h) > 0.25) return null;
  const lines = kids(n).filter((child) => (child.box?.w ?? 0) > (child.box?.h ?? 0));
  if (lines.length !== 3 || lines.length !== kids(n).length) return null;
  const ordered = [...lines].sort((a, b) => a.box.y - b.box.y);
  if (!(ordered[0].box.y < ordered[1].box.y && ordered[1].box.y < ordered[2].box.y)) return null;
  return {
    component: PartKind.HAMBURGER,
    node: n.id,
    confidence: 'high',
    cite: [cite(lines[0].id, 'type', lines[0].type)],
    evidence: 'three stacked lines in a small square',
    params: {},
  };
}

function detectDropdown(n) {
  if (n.layout?.mode !== 'HORIZONTAL') return null;
  const texts = kids(n).filter((child) => isText(child) && child.text?.characters?.trim());
  const mark = kids(n).find((child) => child.svg || isType(child, NodeType.VECTOR));
  const list = kids(n).find((c) => c.layout?.mode === 'VERTICAL' && textsOf(c).length >= 2);
  if (texts.length !== 1 || !mark || !list) return null;
  return {
    component: PartKind.DROPDOWN,
    node: n.id,
    confidence: 'high',
    cite: [cite(texts[0].id, 'type', NodeType.TEXT), cite(list.id, 'layout.mode', 'VERTICAL')],
    evidence: `"${texts[0].text.characters.trim()}" opens ${textsOf(list).length} items`,
    params: { text: texts[0].text.characters.trim(), list: list.id },
  };
}

function detectOffcanvas(n, parent) {
  if (!parent?.box || !n.box) return null;
  if (n.box.w >= parent.box.w || n.box.h < parent.box.h * 0.7) return null;
  const onLeft = n.box.x <= 0.5;
  const onRight = parent.box.w - (n.box.x + n.box.w) <= 0.5;
  if (!onLeft && !onRight) return null;
  if (!hasClose(n)) return null;
  return {
    component: PartKind.OFFCANVAS,
    node: n.id,
    confidence: 'high',
    cite: [cite(n.id, 'type', n.type)],
    evidence: `a panel on the ${onLeft ? 'left' : 'right'} with a close mark`,
    params: { direction: onLeft ? 'left' : 'right', width: Math.round(n.box.w) },
  };
}

function insidePricing(tree, id) {
  const holds = (node) => !!node && (node.id === id || (node.children ?? []).some((child) => child?.visible !== false && holds(child)));
  return [...priceFrames(tree), ...compareFrames(tree)].some(holds);
}

export function detectProduction(tree) {
  const found = [];
  const claimed = new Set();
  (function walk(n, parent) {
    if (!n || n.visible === false || claimed.has(n.id)) return;
    const alert = detectAlert(n, parent);
    const hit = detectGallery(n) || detectProgress(n) || detectRating(n) || (alert && !insidePricing(tree, n.id) ? alert : null) || detectLogo(n, parent) || detectHamburger(n) || detectDropdown(n) || detectOffcanvas(n, parent);
    if (hit) {
      found.push({ ...hit, level: 'E2', note: null });
      claimed.add(n.id);
      return;
    }
    kids(n).forEach((c) => walk(c, n));
  })(tree, null);
  return found;
}
