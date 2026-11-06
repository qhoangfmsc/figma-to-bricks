// The fill-in sheet for one template. read writes plan.md in the desktop workspace.
// The owner edits the value after each `key`: and sets `Xác nhận: có`. A later read keeps those values.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePlan } from '../missing-content/index.mjs';

export const templatePlanPath = (dir) => join(dir, 'plan.md');

const FIX = /^Sửa:[ \t]?(.*)$/m;

const clean = (s) => String(s ?? '').replace(/[`\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();

function fieldLine(field, saved) {
  const key = field.key;
  const value = Object.prototype.hasOwnProperty.call(saved, key) ? saved[key] : (field.value ?? '');
  return `- ${clean(field.title)} \`${key}\`: ${clean(value)}`;
}

function choiceLine(prefix, key, saved, fallback) {
  const value = Object.prototype.hasOwnProperty.call(saved, key) ? saved[key] : fallback;
  return `- ${prefix} \`${key}\`: ${clean(value)}`;
}

export function renderTemplatePlan(model, saved = {}, note = '') {
  const width = Number.isFinite(model.width) ? `${Math.round(model.width)}px` : '';
  const merged = (model.variants ?? []).filter((v) => v.label && Number.isFinite(v.width));
  const out = [
    `# Plan: ${model.title}`,
    '',
    [model.name, width].filter(Boolean).join(' · '),
  ];
  if (merged.length) out.push(`Gộp ${merged.map((v) => `${v.label} ${Math.round(v.width)}px`).join(', ')}.`);
  out.push(
    '',
    'Điền sau dấu `:` trên dòng có khóa. Giữ giá trị sẵn cũng được.',
    'Đổi dòng `Xác nhận: không` thành `Xác nhận: có`, rồi nhắn chạy tiếp.',
    '',
    'Xác nhận: không',
    '',
    '## Component sẽ dựng',
    '',
    'Đổi `giữ` thành `bỏ` nếu không dựng component đó.',
    '',
  );
  const parts = model.parts ?? [];
  if (!parts.length) out.push('Không nhận ra component nào.', '');
  for (const part of parts) {
    out.push(`### ${part.kind} \`${part.name}\``, '', `[Mở trong Figma](${part.figma})`, '');
    if (part.detail) out.push(part.detail, '');
    if (part.note) out.push(part.note, '');
    if (part.node) out.push(choiceLine('Đổi thành bỏ nếu không dựng.', `part:${part.node}`, saved, 'giữ'));
    for (const field of part.fields ?? []) out.push(fieldLine(field, saved));
    out.push('');
  }
  const open = model.open ?? [];
  if (open.length) {
    out.push('## Đoán, chưa gắn', '', 'Ghi `gắn` hoặc `bỏ`.', '');
    for (const item of open) {
      const because = clean(item.evidence);
      const where = item.figma ? ` [Mở](${item.figma}).` : '';
      const why = because ? ` Vì: ${because}.` : '';
      out.push(choiceLine(`${clean(item.label)}.${where}${why}`.replace(/\s+/g, ' '), `guess:${item.node}`, saved, 'chưa gắn'));
    }
    out.push('');
  }
  const repeats = model.repeats ?? [];
  if (repeats.length) {
    out.push('## Ô cùng hình, chưa gắn', '', 'Ghi slider, tab, menu, form, accordion hoặc nút.', '');
    for (const item of repeats) {
      const name = clean(item.item || item.label);
      const sample = clean(item.sample);
      const where = item.figma ? ` [Mở](${item.figma}).` : '';
      const seen = item.count ? `${item.count} ô "${name}" cùng hình${sample ? `, mẫu "${sample}"` : ''}.` : `${clean(item.label)}.`;
      out.push(choiceLine(`${seen}${where}`.replace(/\s+/g, ' '), `repeat:${item.node}`, saved, 'chưa gắn'));
    }
    out.push('');
  }
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
