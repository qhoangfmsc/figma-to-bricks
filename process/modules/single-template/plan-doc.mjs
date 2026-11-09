// The fill-in sheet for one template. read writes plan.md in the desktop workspace.
// The owner edits the value after each `key`: and sets `Xác nhận: có`. A later read keeps those values.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePlan } from '../missing-content/index.mjs';
import { MISSING } from '../missing-content/choices.mjs';
import { SLOTS } from '../single-template/frames.mjs';

export const templatePlanPath = (dir) => join(dir, 'plan.md');

const FIX = /^Sửa:[ \t]?(.*)$/m;

const clean = (s) => String(s ?? '').replace(/[`\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();

function stored(saved, key, fallback) {
  return Object.prototype.hasOwnProperty.call(saved, key) ? saved[key] : fallback;
}

function valueLine(key, saved, fallback) {
  const text = String(stored(saved, key, fallback) ?? '');
  const [first, ...rest] = text.split(/\r?\n/);
  return [`- \`${key}\`: ${first ?? ''}`, ...rest.map((line) => `  ${line}`)].join('\n');
}

function pushPart(out, part, saved) {
  out.push(`### ${part.kind} \`${part.name}\``, '');
  out.push(`- Loại: ${part.kind}`);
  if (part.figma) out.push(`- Figma: [Mở](${part.figma})`);
  if (part.detail) out.push(`- ${part.detail}`);
  out.push('');
  if (part.node) {
    out.push('Dựng', '', valueLine(`part:${part.node}`, saved, ''), '');
  }
  for (const field of part.fields ?? []) {
    const title = field.group === 'answer' && field.caption
      ? clean(field.caption).replace(/^["«]+|["»]+$/g, '')
      : (clean(field.title) || field.field || field.group);
    out.push(title, '');
    if (field.figma) out.push(`- Figma: [Mở](${field.figma})`);
    const fallback = field.value == null || field.value === '' ? MISSING : field.value;
    out.push(valueLine(field.key, saved, fallback), '');
  }
  if (part.node) out.push('Góp ý', '', valueLine(`expect:${part.node}`, saved, ''), '');
}

function rowsOf(model) {
  const parts = model.parts ?? [];
  const blocks = model.blocks ?? [];
  if (!blocks.length) return parts.map((part) => ({ block: null, self: part, nested: [] }));
  const claimed = new Set();
  const rows = blocks.map((block) => {
    const mine = parts.filter((part) => block.ids.includes(part.node));
    mine.forEach((part) => claimed.add(part.node));
    const self = mine.find((part) => part.node === block.id) ?? null;
    return { block, self, nested: mine.filter((part) => part !== self) };
  });
  for (const part of parts) if (!claimed.has(part.node)) rows.push({ block: null, self: part, nested: [] });
  return rows;
}

export function renderTemplatePlan(model, saved = {}, note = '') {
  const width = Number.isFinite(model.width) ? `${Math.round(model.width)}px` : '';
  const merged = (model.variants ?? []).filter((v) => v.label && Number.isFinite(v.width));
  const out = [
    `# Plan: ${model.title}`,
    '',
    [model.name, width].filter(Boolean).join(' · '),
  ];
  if (merged.length) out.push('', `Đã gộp: ${merged.map((v) => `${v.label} ${Math.round(v.width)}px`).join(', ')}`);
  const pasted = new Set(merged.map((v) => v.label));
  const missing = SLOTS.filter((slot) => slot.maxWidth && !pasted.has(slot.label)).map((slot) => slot.label);
  if (missing.length) out.push(`Chưa có: ${missing.join(', ')}`);
  const typeKey = model.templateType?.key || 'type:root';
  const typeFallback = model.templateType?.value || 'section';
  out.push(
    '',
    'Đổi `Xác nhận: không` thành `Xác nhận: có` khi xong.',
    '',
    'Xác nhận: không',
    '',
    '## Loại',
    '',
    'section · header · footer · popup · content · archive · search · error',
    '',
    valueLine(typeKey, saved, typeFallback),
    '',
  );
  const rows = rowsOf(model);
  const kinds = rows.flatMap((row) => [row.self?.kind || (row.block ? 'Khối' : null), ...row.nested.map((part) => part.kind)].filter(Boolean));
  const tally = [...kinds.reduce((map, kind) => map.set(kind, (map.get(kind) ?? 0) + 1), new Map())].map(([kind, n]) => `${n} ${kind}`).join(', ');
  out.push(`## Component Detected (${rows.length})`, '');
  if (tally) out.push(tally, '');
  if (!rows.length) out.push('Không nhận ra component nào.', '');
  rows.forEach((row, index) => {
    if (row.self && !row.block) {
      out.push(`${index + 1}.`, '');
      pushPart(out, row.self, saved);
      return;
    }
    if (row.self) {
      out.push(`${index + 1}.`, '');
      pushPart(out, row.self, saved);
    } else if (row.block) {
      out.push(`${index + 1}.`, '', `### Khối \`${row.block.name}\``, '', '- Loại: block');
      if (row.block.figma) out.push(`- Figma: [Mở](${row.block.figma})`);
      out.push('', 'Góp ý', '', valueLine(`expect:${row.block.id}`, saved, ''), '');
    }
    for (const part of row.nested) pushPart(out, part, saved);
    const ids = new Set(row.block?.ids ?? []);
    const hosts = [row.self, ...row.nested].filter(Boolean);
    for (const item of (model.open ?? []).filter((guess) => ids.has(guess.node) && !hosts.some((part) => part.node !== guess.node && part.ids?.includes(guess.node)))) {
      out.push(`### ${clean(item.label)}`, '');
      if (item.figma) out.push(`- Figma: [Mở](${item.figma})`);
      if (clean(item.evidence)) out.push(`- ${clean(item.evidence)}`);
      out.push('', valueLine(`guess:${item.node}`, saved, ''), '');
    }
    for (const item of (model.repeats ?? []).filter((repeat) => ids.has(repeat.node))) {
      const name = clean(item.item || item.label);
      const sample = clean(item.sample);
      out.push(item.count ? `${item.count} ô "${name}"${sample ? `, mẫu "${sample}"` : ''}` : clean(item.label), '');
      if (item.figma) out.push(`- Figma: [Mở](${item.figma})`);
      out.push('', valueLine(`repeat:${item.node}`, saved, ''), '');
    }
  });
  const placed = new Set(rows.flatMap((row) => [row.block?.id, row.self?.node, ...row.nested.map((part) => part.node), ...(row.block?.ids ?? [])].filter(Boolean)));
  const open = (model.open ?? []).filter((item) => !placed.has(item.node));
  if (open.length) {
    out.push('## Chưa chắc', '');
    for (const item of open) {
      out.push(`### ${clean(item.label)}`, '');
      if (item.figma) out.push(`- Figma: [Mở](${item.figma})`);
      if (clean(item.evidence)) out.push(`- ${clean(item.evidence)}`);
      out.push('', valueLine(`guess:${item.node}`, saved, ''), '');
    }
  }
  const repeats = (model.repeats ?? []).filter((item) => !placed.has(item.node));
  if (repeats.length) {
    out.push('## Nhóm lặp', '');
    for (const item of repeats) {
      const name = clean(item.item || item.label);
      const sample = clean(item.sample);
      out.push(item.count ? `${item.count} ô "${name}"${sample ? `, mẫu "${sample}"` : ''}` : clean(item.label), '');
      if (item.figma) out.push(`- Figma: [Mở](${item.figma})`);
      out.push('', valueLine(`repeat:${item.node}`, saved, ''), '');
    }
  }
  out.push('## Góp ý thêm', '', valueLine('note:plan', saved, ''), '');
  if (clean(note)) out.push(`Sửa: ${clean(note)}`, '');
  return out.join('\n');
}

export function writeTemplatePlan(dir, model) {
  const file = templatePlanPath(dir);
  const prev = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const saved = prev ? parsePlan(prev) : {};
  const note = FIX.exec(prev)?.[1] ?? '';
  writeFileSync(file, renderTemplatePlan(model, saved, note));
  return file;
}
