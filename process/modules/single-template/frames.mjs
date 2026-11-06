// The frames pasted on /generate-template-from-figma. Desktop is the template.
// Every other slot is optional. A blank slot is skipped. A filled slot is merged.
// Tablet portrait, mobile landscape and mobile portrait are Bricks 1.9.8 breakpoints (max-width).
// Widescreen is not one of those breakpoints: Bricks applies it as min-width CSS from the wide frame's own width.
import { parseFigmaUrl } from '../read-figma/url.mjs';

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
