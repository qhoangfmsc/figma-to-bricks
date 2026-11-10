// Widgets this project owns, matched by shape.
// A layer name does not decide. Numbers come from the tree.
import { hasClose, textsOf, visibleKids } from './shape.mjs';

const kids = visibleKids;

function solid(n) {
  return (n?.fills ?? []).find((f) => f.type === 'SOLID' && f.visible !== false);
}

function imageFile(n) {
  const fill = (n?.fills ?? []).find((f) => f.type === 'IMAGE' && f.asset?.file);
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
  if (items.length < 3 || items.length !== kids(n).filter((k) => k.type !== 'TEXT').length) return null;
  if (!similar(items, 'h') || !similar(items, 'w')) return null;
  if (n.clip && items.some((item) => (item.box?.x ?? 0) + item.box.w > n.box.w + 1)) return null;
  const images = items.map(imageFile).filter(Boolean);
  if (images.length !== items.length) return null;
  const rows = new Map();
  for (const item of items) {
    const y = Math.round((item.box?.y ?? 0) / 8);
    rows.set(y, (rows.get(y) ?? 0) + 1);
  }
  return {
    component: 'gallery',
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

function barOf(n) {
  const track = kids(n).find((c) => (c.box?.w ?? 0) >= 80 && (c.box?.h ?? 0) >= 4 && (c.box?.h ?? 0) <= 28);
  if (!track) return null;
  // A title row with a badge is not a track. A track may show a percent, not a sentence.
  const words = textsOf(track).map((t) => t.text.characters.trim()).filter((t) => t && !/%$/.test(t));
  if (words.some((t) => t.length > 3)) return null;
  const fill = kids(track).find((c) => solid(c) && (c.box?.w ?? 0) > 0 && c.box.w < track.box.w - 1);
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
  const thin = kids(n).filter((c) => c.box && ((c.box.h <= 28 && c.box.w >= 80) || (c.box.w <= 28 && c.box.h >= 80)));
  if (!thin.length) return false;
  return kids(n).some((c) => c.box && !thin.includes(c) && textsOf(c).length > 0 && (c.box.x + c.box.w > n.box.w + 40 || c.box.y + c.box.h > n.box.h + 40));
}

function detectProgress(n) {
  // A thin bar beside a list that runs past the frame is a scrollbar, not a percent.
  if (besideScroll(n)) return null;
  const direct = kids(n).map(barOf).filter(Boolean);
  const own = barOf(n);
  const bars = direct.length ? direct : own ? [own] : [];
  if (!bars.length) return null;
  if (direct.length && direct.length < kids(n).filter((k) => k.type !== 'TEXT').length) return null;
  return {
    component: 'progress',
    node: n.id,
    confidence: 'high',
    cite: [cite(n.id, 'type', n.type)],
    evidence: `${bars.length} bar(s), ${bars.map((b) => `${b.percentage}%`).join(', ')}`,
    params: { bars, height: bars[0].height, showPercentage: bars.some((b) => b.showPercentage) },
  };
}

function detectRating(n) {
  if (n.layout?.mode !== 'HORIZONTAL') return null;
  const marks = kids(n).filter((c) => (c.box?.w ?? 0) >= 8 && c.box.w <= 32 && Math.abs(c.box.w - c.box.h) <= 4);
  if (marks.length < 4 || marks.length !== kids(n).length) return null;
  const names = marks.map((c) => c.component || c.svg?.file || '').filter(Boolean);
  if (new Set(names).size !== 1) return null;
  const full = marks.filter((c) => (c.opacity ?? 1) >= 0.9 && ((solid(c)?.alpha ?? 1) >= 0.9 || !solid(c)));
  return {
    component: 'rating',
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

function detectAlert(n) {
  if (n.layout?.mode !== 'HORIZONTAL') return null;
  const h = n.box?.h ?? 0;
  const w = n.box?.w ?? 0;
  if (h < 36 || h > 80 || w < 240 || !solid(n)) return null;
  const texts = textsOf(n);
  const icon = kids(n).find((c) => c.svg && (c.box?.w ?? 0) <= 32);
  if (texts.length !== 1 || !icon) return null;
  const sentence = texts[0].text.characters.trim();
  if (sentence.length < 24 || !sentence.includes(' ')) return null;
  return {
    component: 'alert',
    node: n.id,
    confidence: 'high',
    cite: [cite(texts[0].id, 'type', 'TEXT')],
    evidence: `a tinted bar with one icon and "${texts[0].text.characters.trim().slice(0, 40)}"`,
    params: { content: texts[0].text.characters.trim(), dismissable: hasClose(n) },
  };
}

function detectLogo(n, parent) {
  if (!parent?.box || parent.box.h < 40 || parent.box.h > 140 || parent.box.w < 320) return null;
  const first = kids(parent)[0];
  if (first?.id !== n.id) return null;
  const file = n.svg?.file || imageFile(n);
  if (!file || (n.box?.h ?? 0) < 16 || n.box.h > parent.box.h || (n.box?.w ?? 0) > 240) return null;
  const links = textsOf(parent).filter((t) => t.text.characters.trim().length <= 24);
  if (links.length < 2) return null;
  return {
    component: 'logo',
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
  if (w < 16 || w > 48 || Math.abs(w - h) > 8) return null;
  const lines = kids(n).filter((c) => (c.box?.h ?? 99) <= 4 && (c.box?.w ?? 0) >= 12);
  if (lines.length !== 3 || lines.length !== kids(n).length) return null;
  const ordered = [...lines].sort((a, b) => a.box.y - b.box.y);
  if (!(ordered[0].box.y < ordered[1].box.y && ordered[1].box.y < ordered[2].box.y)) return null;
  return {
    component: 'hamburger',
    node: n.id,
    confidence: 'high',
    cite: [cite(lines[0].id, 'type', lines[0].type)],
    evidence: 'three stacked lines in a small square',
    params: {},
  };
}

function detectDropdown(n) {
  if (n.layout?.mode !== 'HORIZONTAL') return null;
  const texts = kids(n).filter((c) => c.type === 'TEXT' && (c.text?.characters?.trim().length ?? 0) <= 32);
  const mark = kids(n).find((c) => (c.svg || c.type === 'VECTOR') && (c.box?.w ?? 99) <= 16);
  const list = kids(n).find((c) => c.layout?.mode === 'VERTICAL' && textsOf(c).length >= 2);
  if (texts.length !== 1 || !mark || !list) return null;
  return {
    component: 'dropdown',
    node: n.id,
    confidence: 'high',
    cite: [cite(texts[0].id, 'type', 'TEXT'), cite(list.id, 'layout.mode', 'VERTICAL')],
    evidence: `"${texts[0].text.characters.trim()}" opens ${textsOf(list).length} items`,
    params: { text: texts[0].text.characters.trim(), list: list.id },
  };
}

function detectOffcanvas(n, parent) {
  if (!parent?.box || !n.box) return null;
  if (n.box.w > parent.box.w * 0.85 || n.box.w < 200 || n.box.h < parent.box.h * 0.7) return null;
  const onLeft = n.box.x <= 8;
  const onRight = parent.box.w - (n.box.x + n.box.w) <= 8;
  if (!onLeft && !onRight) return null;
  if (!hasClose(n)) return null;
  return {
    component: 'offcanvas',
    node: n.id,
    confidence: 'high',
    cite: [cite(n.id, 'type', n.type)],
    evidence: `a panel on the ${onLeft ? 'left' : 'right'} with a close mark`,
    params: { direction: onLeft ? 'left' : 'right', width: Math.round(n.box.w) },
  };
}

export function detectProduction(tree) {
  const found = [];
  const claimed = new Set();
  (function walk(n, parent) {
    if (!n || n.visible === false || claimed.has(n.id)) return;
    const hit = detectGallery(n) || detectProgress(n) || detectRating(n) || detectAlert(n) || detectLogo(n, parent) || detectHamburger(n) || detectDropdown(n) || detectOffcanvas(n, parent);
    if (hit) {
      found.push({ ...hit, level: 'E2', note: null });
      claimed.add(n.id);
      return;
    }
    kids(n).forEach((c) => walk(c, n));
  })(tree, null);
  return found;
}
