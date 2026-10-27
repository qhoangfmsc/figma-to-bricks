// Severity tiers for the rows of 07-verify (config: qa/severity.json).
//   1 blocker      content missing / covered, horizontal scroll, failed request, a transparent area with no background
//   2 major        a picture region clearly different, a box off by more than minorPx, a wrong color / font / attribute, heavy images
//   3 minor        a box off by negligiblePx..minorPx, a picture region slightly different
//   4 negligible   off by <= negligiblePx (line-height, inside / outside stroke, rounding), or the text-engine class: listed, never fixed
import { readFileSync } from 'node:fs';

const CFG = JSON.parse(readFileSync(new URL('../qa/severity.json', import.meta.url), 'utf8'));
export const TIER_NAME = { 1: 'blocker', 2: 'major', 3: 'minor', 4: 'negligible' };
const num = (v) => { const n = parseFloat(String(v)); return Number.isFinite(n) ? n : null; };

export function tierOf(row) {
  if (row.soft) return 4; // the text-engine class
  const c = row.check;
  if (CFG.alwaysBlocker.some((k) => c.startsWith(k))) return 1;
  if (CFG.alwaysMajor.some((k) => c.startsWith(k))) return 2;
  if (row.label.startsWith('look ')) { const d = num(row.got) ?? 0; return d >= CFG.look.major ? 2 : 3; }
  if (c.startsWith('attr ')) return 2;
  const want = num(row.want), got = num(row.got);
  const delta = want !== null && got !== null ? Math.abs(got - want) : null;
  if (['x', 'y', 'w', 'h', 'width', 'height'].includes(c) && delta !== null) return delta <= CFG.box.negligiblePx ? 4 : delta <= CFG.box.minorPx ? 3 : 2;
  if (/color$/.test(c) || c === 'color') return 2;
  if (delta !== null) return delta <= CFG.css.negligiblePx ? 4 : delta <= CFG.css.minorPx ? 3 : 2;
  return 2; // a non numeric value that differs (display, text-align…)
}

export const verdictOf = (counts) => (counts[1] || counts[2] ? 'FAIL' : counts[3] ? 'PASS WITH MINOR' : 'PASS');
