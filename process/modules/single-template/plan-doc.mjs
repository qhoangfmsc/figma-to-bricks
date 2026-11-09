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

function valueLine(key, saved, fallback, label = '') {
  const text = String(stored(saved, key, fallback) ?? '');
  const [first, ...rest] = text.split(/\r?\n/);
  const lead = label ? `${label} ` : '';
  return [`- ${lead}\`${key}\`: ${first ?? ''}`, ...rest.map((line) => `  ${line}`)].join('\n');
}

function fieldTitle(field) {
  if (field.group === 'answer' && field.caption) return clean(field.caption).replace(/^["«]+|["»]+$/g, '');
  return clean(field.title) || field.field || field.group;
}

function componentLines(part, saved, index) {
  const title = `${part.kind} \`${part.name}\``;
  const lines = [index ? `### ${index}. ${title}` : `### ${title}`, `- Loại: ${part.kind}`];
  if (part.figma) lines.push(`- Figma: [Mở](${part.figma})`);
  if (part.detail) lines.push(`- ${part.detail}`);
  if (part.node) lines.push(valueLine(`part:${part.node}`, saved, '', `Quyết định dựng ${part.kind}`));
  for (const field of part.fields ?? []) {
    const titleText = fieldTitle(field);
    if (titleText) lines.push(`- ${titleText}`);
    if (field.figma) lines.push(`- Figma: [Mở](${field.figma})`);
    const fallback = field.value == null || field.value === '' ? MISSING : field.value;
    lines.push(valueLine(field.key, saved, fallback));
  }
  if (part.node) lines.push(valueLine(`expect:${part.node}`, saved, '', 'Kết quả mong muốn'));
  return lines;
}

function blockLines(block, saved, index) {
  const lines = [`### ${index}. Khối \`${block.name}\``, '- Loại: block'];
  if (block.figma) lines.push(`- Figma: [Mở](${block.figma})`);
  lines.push(valueLine(`expect:${block.id}`, saved, '', 'Kết quả mong muốn'));
  return lines;
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
    '## Loại Template',
    valueLine(typeKey, saved, typeFallback),
    '',
  );
  const rows = rowsOf(model);
  const kinds = rows.flatMap((row) => [row.self?.kind || (row.block ? 'Khối' : null), ...row.nested.map((part) => part.kind)].filter(Boolean));
  const tally = [...kinds.reduce((map, kind) => map.set(kind, (map.get(kind) ?? 0) + 1), new Map())].map(([kind, n]) => `${n} ${kind}`).join(', ');
  const detected = [];
  const decisions = [];
  const pushBlock = (lines, bucket) => { bucket.push(lines.join('\n')); };
  rows.forEach((row, index) => {
    const n = index + 1;
    const ids = new Set(row.block?.ids ?? []);
    const hosts = [row.self, ...row.nested].filter(Boolean);
    const extras = [];
    for (const item of (model.open ?? []).filter((guess) => ids.has(guess.node) && !hosts.some((part) => part.node !== guess.node && part.ids?.includes(guess.node)))) {
      const lines = [`### ${clean(item.label)}`];
      if (item.figma) lines.push(`- Figma: [Mở](${item.figma})`);
      if (clean(item.evidence)) lines.push(`- ${clean(item.evidence)}`);
      lines.push(valueLine(`guess:${item.node}`, saved, ''));
      extras.push(lines.join('\n'));
    }
    for (const item of (model.repeats ?? []).filter((repeat) => ids.has(repeat.node))) {
      const name = clean(item.item || item.label);
      const sample = clean(item.sample);
      const lines = [item.count ? `${item.count} ô "${name}"${sample ? `, mẫu "${sample}"` : ''}` : clean(item.label)];
      if (item.figma) lines.push(`- Figma: [Mở](${item.figma})`);
      lines.push(valueLine(`repeat:${item.node}`, saved, ''));
      extras.push(lines.join('\n'));
    }
    if (row.block && !row.self) pushBlock([...blockLines(row.block, saved, n), ...extras], detected);
    if (row.self) pushBlock([...componentLines(row.self, saved, n), ...extras], decisions);
    for (const part of row.nested) pushBlock(componentLines(part, saved), decisions);
  });
  out.push(`## Component Detected (${rows.length})`);
  if (tally) out.push(tally);
  if (!rows.length) out.push('Không nhận ra component nào.');
  if (detected.length) out.push('', detected.join('\n\n'));
  out.push('');
  if (decisions.length) out.push('## Cần User quyết định', decisions.join('\n\n'), '');
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
  out.push('## Kết quả cần đạt được', valueLine('note:plan', saved, ''), '');
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
