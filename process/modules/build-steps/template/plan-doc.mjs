// The fill-in sheet for one template. read writes plan.md in the desktop workspace.
// The owner edits the value after each `key`: and sets `Xác nhận: có`. A later read keeps those values.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePlan } from '../../missing-content/index.mjs';
import { MISSING } from '../../missing-content/choices.mjs';
import { SLOTS } from './frames.mjs';
import { isSignal } from '../../recognize-parts/kinds.mjs';

export const templatePlanPath = (dir) => join(dir, 'plan.md');

const FIX = /^Sửa:[ \t]?(.*)$/m;
const AGREED = 'Đồng ý';

const clean = (s) => String(s ?? '').replace(/[`\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();

function stored(saved, key, fallback) {
  return Object.prototype.hasOwnProperty.call(saved, key) ? saved[key] : fallback;
}

function valueLine(key, saved, fallback, label = '', force = false) {
  const text = String((force ? fallback : stored(saved, key, fallback)) ?? '');
  const [first, ...rest] = text.split(/\r?\n/);
  const lead = label ? `${label} ` : '';
  return [`- ${lead}\`${key}\`: ${first ?? ''}`, ...rest.map((line) => `  ${line}`)].join('\n');
}

function lookRow(model, node) {
  return (model.look?.rows ?? []).find((row) => row.node === node) ?? null;
}

function evidenceLines(row) {
  const lines = [];
  if (row.verdict === 'no-shot') lines.push('- Ảnh: chưa chụp được');
  if (row.see) lines.push(`- AI: ${clean(row.aiKind)} — ${clean(row.see)}`);
  else lines.push('- AI: chưa nhận dạng nhóm này trên ảnh');
  const cite = (row.cite ?? []).join(', ');
  lines.push(`- Tín hiệu: ${clean(row.evidence) || row.kind}${cite ? ` (${cite})` : ''}`);
  if (row.verdict === 'render' || row.verdict === 'agree') lines.push(`- Kết luận: dựng ${row.kind}.`);
  else if (row.verdict === 'differ') lines.push(`- Kết luận: không dựng ${row.kind}. Ảnh thấy block.`);
  else if (row.verdict === 'ai') lines.push(`- Kết luận: dựng ${clean(row.aiKind)}.`);
  else if (row.verdict === 'hint') lines.push('- Kết luận: ảnh chưa gọi tên. Không dựng.');
  else lines.push('- Kết luận: chưa đủ ảnh.');
  return lines;
}

function proofSection(model) {
  const look = model.look;
  if (!look) return [];
  const lines = ['## Chứng cứ'];
  if (look.shot) lines.push(`![Section](${look.shot})`);
  else lines.push(`Ảnh chưa chụp được. ${clean(look.shotError)}`);
  if (!look.ready) {
    lines.push('Nhận dạng từ ảnh chưa đủ. Plan này chưa phải bản để xác nhận.', '');
    return lines;
  }
  lines.push('Ảnh quyết định loại.', '');
  for (const extra of look.extras ?? []) {
    lines.push(`### Ảnh thấy ${extra.kind}${extra.node ? ` \`${extra.node}\`` : ''}`);
    lines.push(`- AI: ${clean(extra.see)}`);
    if (isSignal(extra.kind)) {
      lines.push('- Tín hiệu: phần này thuộc component cha. Plan ghi node ở mục component.');
      lines.push('');
      continue;
    }
    if (!extra.node || extra.kind === 'block') continue;
    lines.push(`- Kết luận: dựng ${extra.kind}.`, '');
  }
  return lines;
}

function renders(row) {
  return row?.verdict === 'render' || row?.verdict === 'agree' || row?.verdict === 'ai';
}

function renderedKind(row) {
  return row.verdict === 'ai' ? clean(row.aiKind) : row.kind;
}

function detectedReview(look) {
  const rows = (look?.rows ?? []).filter(renders);
  if (!rows.length) return [];
  const lines = ['Các component này sẽ được dựng.', ''];
  for (const row of rows) {
    lines.push(`### ${renderedKind(row)} \`${row.node}\``);
    if (row.see) lines.push(`- Ảnh: ${clean(row.see)}`);
    for (const child of (row.children ?? []).filter((item) => item.image)) {
      lines.push(`- ${child.label}: \`${child.node}\``);
    }
    lines.push('');
  }
  return lines;
}

function fieldTitle(field) {
  if (field.group === 'answer' && field.caption) return clean(field.caption).replace(/^["«]+|["»]+$/g, '');
  return clean(field.title) || field.field || field.group;
}

function componentLines(part, saved, index, model = {}) {
  const title = `${part.kind} \`${part.name}\``;
  const lines = [index ? `### ${index}. ${title}` : `### ${title}`, `- Loại: ${part.kind}`];
  if (part.figma) lines.push(`- Figma: [Mở](${part.figma})`);
  if (part.detail) lines.push(`- ${part.detail}`);
  for (const line of part.children ?? []) lines.push(`- ${line}`);
  const row = lookRow(model, part.node);
  if (row) lines.push(...evidenceLines(row));
  for (const field of part.fields ?? []) {
    const titleText = fieldTitle(field);
    if (titleText) lines.push(`- ${titleText}`);
    if (field.figma) lines.push(`- Figma: [Mở](${field.figma})`);
    const fallback = field.value == null || field.value === '' ? MISSING : field.value;
    lines.push(valueLine(field.key, saved, fallback));
  }
  // Every part the owner decides on carries its own decision line. It starts as agreed. A sentence that says no, or any note, is read by meaning.
  const decisionKey = `part:${part.node}`;
  const pictureRead = !model.look || model.look.ready; // a plan without the picture reading is not the one to decide on
  if (pictureRead && !(part.fields ?? []).some((field) => field.key === decisionKey)) {
    lines.push(valueLine(decisionKey, saved[decisionKey] ? saved : {}, AGREED, 'Quyết định'));
  }
  return lines;
}

function blockLines(block, saved, index) {
  const lines = [`### ${index}. Khối \`${block.name}\``, '- Loại: block'];
  if (block.figma) lines.push(`- Figma: [Mở](${block.figma})`);
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
    model.look && !model.look.ready ? 'Plan này chưa đủ chứng cứ. Chưa đổi Xác nhận.' : 'Đổi `Xác nhận: không` thành `Xác nhận: có` khi xong. Mọi dòng `Quyết định` mặc định là Đồng ý. Viết "không" hoặc một ghi chú ngay trên dòng đó nếu muốn bỏ hay đổi.',
    '',
    'Xác nhận: không',
    '',
    '## Loại Template',
    valueLine(typeKey, saved, typeFallback),
    '',
    ...proofSection(model),
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
      const seen = lookRow(model, item.node);
      if (seen && renders(seen)) lines.push(...evidenceLines(seen));
      if (seen && renders(seen)) extras.push(lines.join('\n'));
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
    if (row.self) pushBlock([...componentLines(row.self, saved, n, model), ...extras], decisions);
    for (const part of row.nested) pushBlock(componentLines(part, saved, 0, model), decisions);
  });
  out.push(`## Component Detected (${rows.length})`);
  const review = detectedReview(model.look);
  if (review.length) out.push(...review);
  if (model.look?.ready) {
    const listed = new Set((model.parts ?? []).map((part) => part.node));
    for (const item of model.open ?? []) {
      if (listed.has(item.node)) continue;
      const row = lookRow(model, item.node);
      if (!renders(row)) continue;
      out.push(`### ${renderedKind(row)} \`${item.node}\``);
      if (row.see) out.push(`- Ảnh: ${clean(row.see)}`);
      out.push('');
    }
  }
  if (tally) out.push(tally);
  if (!rows.length) out.push('Không nhận ra component nào.');
  if (detected.length) out.push('', detected.join('\n\n'));
  out.push('');
  if (decisions.length) out.push('## Cần User quyết định', decisions.join('\n\n'), '');
  const placed = new Set(rows.flatMap((row) => [row.block?.id, row.self?.node, ...row.nested.map((part) => part.node), ...(row.block?.ids ?? [])].filter(Boolean)));
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
