// The frames pasted on /generate-template-from-figma. Desktop is the template.
// Every other slot is optional. A blank slot is skipped. A filled slot is merged.
// Tablet portrait, mobile landscape and mobile portrait are Bricks 1.9.8 breakpoints (max-width).
// Widescreen is not one of those breakpoints: Bricks applies it as min-width CSS from the wide frame's own width.
import { parseFigmaUrl } from '../read-figma/url.mjs';

// Five ranks, wide to narrow. Each width belongs to one rank. A rank with no frame shows the
// nearest wider frame, and the phone frame also fills the landscape rank when that frame is absent,
// so the bottom of the ladder is never empty.
export const WIDE_MIN = 1701;
export function caseAt(width, pasted, { wideMin = WIDE_MIN } = {}) {
  const has = (key) => pasted instanceof Set ? pasted.has(key) : Boolean(pasted?.[key]);
  if (width >= wideMin) return has('widescreen') ? 'widescreen' : 'desktop';
  if (width > 991) return 'desktop';
  if (width > 767) return has('tablet_portrait') ? 'tablet_portrait' : 'desktop';
  if (width > 478 && has('mobile_landscape')) return 'mobile_landscape';
  if (has('mobile_portrait')) return 'mobile_portrait';
  if (has('mobile_landscape')) return 'mobile_landscape';
  if (has('tablet_portrait')) return 'tablet_portrait';
  return 'desktop';
}

export const SLOTS = [
  { id: 'desktop', label: 'Desktop', required: true },
  { id: 'widescreen', label: 'Widescreen', required: false, key: 'widescreen', wide: true },
  { id: 'tablet', label: 'Tablet portrait', required: false, key: 'tablet_portrait', maxWidth: 991 },
  { id: 'landscape', label: 'Mobile landscape', required: false, key: 'mobile_landscape', maxWidth: 767 },
  { id: 'mobile', label: 'Mobile portrait', required: false, key: 'mobile_portrait', maxWidth: 478 },
];

export function parseFrameInput(input) {
  const frames = {};
  const errors = [];
  for (const slot of SLOTS) {
    const raw = String(input?.[slot.id] ?? '').trim();
    if (!raw) {
      if (slot.required) errors.push('Desktop là bắt buộc.');
      continue;
    }
    try {
      const ref = parseFigmaUrl(raw);
      frames[slot.id] = { ...slot, url: raw, fileKey: ref.fileKey, nodeId: ref.nodeId };
    } catch (e) {
      errors.push(`${slot.label}: ${e.message}`);
    }
  }
  const listed = Object.values(frames);
  if (new Set(listed.map((f) => f.fileKey)).size > 1) errors.push('Mọi link phải cùng một file Figma.');
  if (new Set(listed.map((f) => f.nodeId)).size !== listed.length) errors.push('Mỗi khung một link. Hai ô đang trỏ cùng một node.');
  return { ok: errors.length === 0, errors, frames };
}
