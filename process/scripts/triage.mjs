#!/usr/bin/env node
// TRIAGE: turns the mismatches of a verify run into a short, ranked list of causes, so the fix loop starts from evidence and not from guessing.
//   node process/scripts/triage.mjs <workspace>        (base workspace of a section; every breakpoint frame is covered)
// For each frame: the worst regions of the picture (look vs Figma), the Figma nodes lying on them (deepest first) with the properties that usually
// explain a difference (several fills, mask, GLASS, blur, image crop, blend, rotation, text), the real box / css mismatches grouped by check, and
// whether a mismatch is only the text-engine class. Writes triage.md.
import { dirname, join } from 'node:path';
import { resolveWorkspace } from '../shared/workspace.mjs';

const ws = resolveWorkspace(process.argv[2]);
const responsive = ws.readJson('responsive.json', { variants: [] });
const frames = [{ key: 'base', suffix: '', tree: ws.readJson('tree.json'), mapping: ws.readJson('mapping.json') }];
for (const v of responsive.variants) frames.push({ key: v.key, suffix: `.${v.key}`, tree: resolveWorkspace(join(dirname(ws.dir), v.workspace)).readJson('tree.json'), mapping: ws.readJson(`mapping.${v.key}.json`) });

const hints = (n) => {
  const h = [];
  if (!n) return h;
  const fills = n.fills ?? [];
  if (fills.length > 1) h.push(`${fills.length} fills (only the visible top layers are painted)`);
  if (fills.some((f) => f.type === 'IMAGE' && f.imageTransform)) h.push('image crop (imageTransform)');
  if (fills.some((f) => /RADIAL|ANGULAR|DIAMOND/.test(f.type))) h.push('radial / angular gradient (not supported)');
  if ((n.effects ?? []).some((e) => e.type === 'GLASS')) h.push('GLASS effect (not supported)');
  if ((n.effects ?? []).some((e) => /BLUR/.test(e.type))) h.push('blur effect');
  if ((n.effects ?? []).length > 1) h.push(`${n.effects.length} effects`);
  if (n.isMask) h.push('mask layer');
  if (n.blendMode) h.push(`blend ${n.blendMode}`);
  if (n.rotation) h.push('rotated');
  if (n.type === 'TEXT') h.push('text (engine differences, line breaks)');
  if (n.stroke && n.stroke.align !== 'INSIDE') h.push(`stroke ${n.stroke.align}`);
  if (n.opacity != null) h.push(`opacity ${n.opacity}`);
  return h;
};

const lines = [`# Triage: ${ws.readJson('tree.json').name}`, ''];
for (const f of frames) {
  const v = ws.has(`verify${f.suffix}.json`) ? ws.readJson(`verify${f.suffix}.json`) : null;
  if (!v) { lines.push(`## ${f.key}`, '', '_not verified_', ''); continue; }
  const byId = new Map(); (function rec(n) { byId.set(n.id, n); (n.children ?? []).forEach(rec); })(f.tree);
  const boxes = Object.entries(f.mapping).filter(([, m]) => m.expect).map(([fid, m]) => ({ fid, ...m.expect, element: m.element, node: byId.get(fid) })).filter((b) => b.w > 0 && b.h > 0);
  const real = v.bad ?? [], soft = v.soft ?? [];
  lines.push(`## ${f.key}: ${real.length} real, ${soft.length} text-engine`, '');
  const looks = real.filter((r) => r.label.startsWith('look ')).map((r) => { const m = r.label.match(/look (\d+),(\d+) (\d+)×(\d+)/); return { x: +m[1], y: +m[2], w: +m[3], h: +m[4], diff: parseFloat(r.got) }; }).sort((a, b) => b.diff - a.diff);
  if (looks.length) {
    lines.push('### Regions of the picture that differ most', '', '| region | diff /255 | nodes on it (deepest first) | what usually explains it |', '|---|---|---|---|');
    for (const c of looks.slice(0, 12)) {
      const on = boxes.map((b) => ({ b, area: Math.max(0, Math.min(c.x + c.w, b.x + b.w) - Math.max(c.x, b.x)) * Math.max(0, Math.min(c.y + c.h, b.y + b.h) - Math.max(c.y, b.y)) }))
        .filter((o) => o.area >= 0.5 * Math.min(c.w * c.h, o.b.w * o.b.h)).sort((a, b) => a.b.w * a.b.h - b.b.w * b.b.h).slice(0, 3);
      const why = [...new Set(on.flatMap((o) => hints(o.b.node)))];
      lines.push(`| ${c.x},${c.y} ${c.w}×${c.h} | ${Math.round(c.diff * 10) / 10} | ${on.map((o) => `${o.b.node?.name ?? o.b.fid} [${o.b.fid}]`).join('; ') || 'no mapped node (a background or unmapped layer)'} | ${why.join('; ') || 'unknown: look at the side by side'} |`);
    }
    lines.push('');
  }
  const boxRows = real.filter((r) => !r.label.startsWith('look ') && !/covered|on top|scroll|image weight|hidden images|h1|request/.test(r.check));
  if (boxRows.length) {
    const g = {}; for (const r of boxRows) (g[r.check] ??= []).push(r);
    lines.push('### Box / css mismatches by check', '', '| check | count | first examples (node: Figma → rendered) |', '|---|---|---|');
    for (const [k, rows] of Object.entries(g).sort((a, b) => b[1].length - a[1].length)) lines.push(`| ${k} | ${rows.length} | ${rows.slice(0, 3).map((r) => `${r.label.slice(0, 36)}: ${r.want} → ${r.got}`).join('; ')} |`);
    lines.push('');
  }
  const other = real.filter((r) => /covered|on top|scroll|image weight|hidden images|h1|request|transparent/.test(r.check));
  if (other.length) lines.push('### Structural problems', '', ...other.map((r) => `- ${r.label}: ${r.check}: want ${r.want}, got ${r.got}`), '');
}
lines.push('## How to read this', '', '- A region whose nodes show "image crop", "several fills", "mask", "GLASS", "blur" points at a Figma property to check in `process/bricks/render/`.', '- Only text nodes + no other hint: text-engine difference (listed, not fixed) unless the number of lines differs (a height mismatch).', '- "no mapped node": the difference is a background or a layer the build does not map; compare the side by side and the section fills.', '');
ws.writeText('triage.md', lines.join('\n'));
console.log(lines.filter((l) => l.startsWith('## ') || l.startsWith('| ') && !l.startsWith('| region') && !l.startsWith('| check') && !l.startsWith('|---')).slice(0, 18).join('\n'));
console.log(`  -> ${ws.dir}/triage.md`);
