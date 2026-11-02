// The frames a person pastes on the Vietnix Tools screen. Desktop is the template.
// Tablet and mobile are merged as Bricks breakpoints. Widescreen is kept and not merged:
// Bricks 1.9.8 has no breakpoint wider than the desktop frame (the 2504 frame is only a check).
import { parseFigmaUrl } from '../figma/url.mjs';

export const SLOTS = [
  { id: 'desktop', label: 'Desktop', required: true },
  { id: 'tablet', label: 'Tablet', required: false, key: 'tablet_portrait', maxWidth: 991 },
  { id: 'mobile', label: 'Mobile', required: false, key: 'mobile_portrait', maxWidth: 478 },
  { id: 'widescreen', label: 'Widescreen', required: false, merge: false },
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
