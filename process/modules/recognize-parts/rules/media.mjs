// Search: a wide field (at least four times as wide as it is tall) with one placeholder text and one small icon.
// Video: a picture frame with one play circle near the centre. The layer name is a hint. The shape is the evidence.
// A row already inside a form stays a form field.
import { detectForms, isButtonLike, isInputLike } from './form.mjs';
import { textsOf } from './shape.mjs';
import { isDomainLookup } from './layout-only.mjs';

const HOLDERS = new Set(['FRAME', 'INSTANCE', 'COMPONENT', 'GROUP']);
const SEARCH_NAME = /\b(search|tìm kiếm|tim kiem)\b/i;
const VIDEO_NAME = /\b(video|player)\b/i;

const kids = (n) => (n.children ?? []).filter((c) => c.visible !== false);

function radiusMin(n) {
  return Array.isArray(n.radius) && n.radius.length ? Math.min(...n.radius) : 0;
}

function labelOf(n) {
  if (!n || n.visible === false) return null;
  if (n.type === 'TEXT' && !n.svg && n.text?.characters?.trim()) return n;
  const inner = kids(n);
  if (inner.length === 1) return labelOf(inner[0]);
  return null;
}

function iconOf(n) {
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  return (n.svg || n.type === 'VECTOR') && w <= 28 && h <= 28 && w >= 8 && h >= 8;
}

const SEARCH_BTN = /tìm\s*kiếm|tim\s*kiem|\bsearch\b/i;

// A field and a labeled submit beside it: "Tìm kiếm tên miền" + "Tìm Kiếm".
// The icon-only field below stays searchOf. This row is the same Bricks search element.
function searchSubmit(n) {
  if (!HOLDERS.has(n.type) || n.layout?.mode !== 'HORIZONTAL') return null;
  if (isDomainLookup(n)) return null;
  const direct = kids(n);
  const field = direct.find((c) => isInputLike(c));
  const button = direct.find((c) => c !== field && isButtonLike(c));
  if (!field || !button) return null;
  const label = textsOf(button)[0]?.text?.characters?.trim() ?? '';
  const named = SEARCH_NAME.test(`${n.name ?? ''} ${n.component ?? ''}`) || SEARCH_BTN.test(label);
  if (!named) return null;
  const text = textsOf(field)[0];
  if (!text) return null;
  return { field, button, text, label };
}

function searchOf(n) {
  if (!HOLDERS.has(n.type) || n.layout?.mode !== 'HORIZONTAL' || isDomainLookup(n)) return null;
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  if (h < 32 || h > 64 || w < h * 4) return null;
  const direct = kids(n);
  const text = direct.map(labelOf).find(Boolean);
  const icon = direct.find((c) => c !== text && (iconOf(c) || kids(c).some(iconOf)));
  if (!text || !icon) return null;
  if (direct.some((c) => c !== text && c !== icon && !kids(c).includes(icon) && labelOf(c) !== text)) return null;
  const named = SEARCH_NAME.test(n.name ?? '') || SEARCH_NAME.test(n.component ?? '');
  return { text, icon, named, w, h };
}

function imageCovers(n, frame) {
  const fill = (n.fills ?? []).some((f) => f.visible !== false && f.type === 'IMAGE');
  if (!fill) return false;
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  return w >= (frame.box?.w ?? 0) * 0.6 && h >= (frame.box?.h ?? 0) * 0.6;
}

function playMark(n, frame) {
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  if (w < 28 || w > 96 || Math.abs(w - h) > 6) return false;
  if (radiusMin(n) < h / 2 - 1 && !n.svg) return false;
  const cx = (n.box?.x ?? 0) + w / 2;
  const cy = (n.box?.y ?? 0) + h / 2;
  const fw = frame.box?.w ?? 0;
  const fh = frame.box?.h ?? 0;
  return Math.abs(cx - fw / 2) <= fw * 0.22 && Math.abs(cy - fh / 2) <= fh * 0.28;
}

function videoOf(n) {
  if (!HOLDERS.has(n.type)) return null;
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  if (w < 200 || h < 100 || w > 2000) return null;
  const direct = kids(n);
  const play = direct.find((c) => playMark(c, n));
  const picture = imageCovers(n, n) || direct.some((c) => c !== play && imageCovers(c, n));
  if (!play || !picture) return null;
  const named = VIDEO_NAME.test(n.name ?? '') || VIDEO_NAME.test(n.component ?? '');
  return { play, named, w, h };
}

export function detectMedia(tree) {
  const formIds = new Set(detectForms(tree).map((f) => f.node));
  const found = [];
  (function walk(n) {
    if (!n || n.visible === false || formIds.has(n.id)) return;
    const bar = searchSubmit(n);
    if (bar) {
      found.push({
        component: 'search',
        node: n.id,
        level: 'E2',
        confidence: 'high',
        cite: [
          { node: bar.text.id, field: 'type', equals: 'TEXT' },
          { node: bar.button.id, field: 'type', equals: bar.button.type },
        ],
        evidence: `${n.type} "${n.name}" is a field "${bar.text.text.characters.trim()}" and a submit "${bar.label}"`,
        params: {
          placeholder: bar.text.text.characters.trim().replace(/\s+/g, ' '),
          labelNode: bar.text.id,
          buttonText: bar.label.replace(/\s+/g, ' '),
          buttonNode: bar.button.id,
          fieldNode: bar.field.id,
        },
        note: null,
      });
      return;
    }
    const search = searchOf(n);
    if (search) {
      found.push({
        component: 'search',
        node: n.id,
        level: 'E2',
        confidence: search.named ? 'high' : 'medium',
        cite: [
          { node: search.text.id, field: 'type', equals: 'TEXT' },
          { node: search.icon.id, field: 'type', equals: search.icon.type },
        ],
        evidence: `${n.type} "${n.name}" is a ${Math.round(search.w)}×${Math.round(search.h)} field with the text "${search.text.text.characters.trim()}" and one icon${search.named ? '' : ' (shape only)'}`,
        params: { placeholder: search.text.text.characters.trim().replace(/\s+/g, ' '), labelNode: search.text.id },
        note: null,
      });
      return;
    }
    const video = videoOf(n);
    if (video) {
      found.push({
        component: 'video',
        node: n.id,
        level: 'E2',
        confidence: 'high',
        cite: [{ node: video.play.id, field: 'type', equals: video.play.type }],
        evidence: `${n.type} "${n.name}" is a ${Math.round(video.w)}×${Math.round(video.h)} picture with a play mark at the centre${video.named ? '' : ' (shape only)'}`,
        params: { url: null },
        note: null,
      });
      return;
    }
    kids(n).forEach(walk);
  })(tree);
  return found;
}
