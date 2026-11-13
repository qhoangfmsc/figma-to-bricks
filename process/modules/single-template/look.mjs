// The picture's reading decides the kind. Code is a hint and does not decide.
// AI is 70. A code hint that names the same kind adds 30. A code-only row stays a hint.
import { writeFileSync } from 'node:fs';
import { download, getRenders } from '../read-figma/api.mjs';
import { SIGNAL_RULES, childKindIds, isSignal } from '../recognize-parts/kinds.mjs';

export const LOOK_FILE = 'look.json';
export const PLAN_MODEL = 'plan-model.json';

export const lookKinds = () => new Set([...Object.keys(SIGNAL_RULES), ...childKindIds(), 'pagination', 'block']);

export const AI_WEIGHT = 70;
export const CODE_WEIGHT = 30;

function weightOf(ai, code) {
  return { ai, code, total: ai + code };
}

function citeOf(cite) {
  return (cite ?? []).map((item) => [item.node, item.field].filter(Boolean).join('.')).filter(Boolean);
}

export function signalRows(components) {
  return (components ?? [])
    .filter((item) => item && (item.status === 'approved' || item.status === 'proposed') && !isSignal(item.component))
    .map((item) => ({
      node: item.node,
      kind: item.component,
      status: item.status,
      confidence: item.confidence ?? '',
      evidence: String(item.evidence ?? '').replace(/\s+/g, ' ').trim(),
      cite: citeOf(item.cite),
      children: childParts(item),
    }));
}

function childParts(item) {
  const rule = SIGNAL_RULES[item.component];
  return (rule?.childComponent ?? []).flatMap((child) => {
    const node = item.params?.[child.param];
    if (!node) return [];
    return [{ id: child.id, label: child.label || child.id, node: String(node) }];
  });
}

export async function saveSectionShot(ws, fileKey, nodeId, version) {
  const stamp = ws.readJson('look-render.json', null);
  if (ws.has('look.png') && stamp?.version === version && stamp?.node === nodeId) return { shot: 'look.png', shotError: '' };
  const urls = await getRenders(fileKey, [nodeId], 'png', { scale: 1 });
  const url = urls?.[nodeId];
  if (!url) return { shot: '', shotError: 'Figma không trả render của section' };
  writeFileSync(ws.file('look.png'), await download(url));
  ws.writeJson('look-render.json', { version, node: nodeId });
  return { shot: 'look.png', shotError: '' };
}

export function writeLook(ws, components, shot) {
  const look = {
    shot: shot?.shot ?? '',
    shotError: shot?.shotError ?? '',
    signals: signalRows(components),
    ai: null,
  };
  ws.writeJson(LOOK_FILE, look);
  return look;
}

export function normalizeAi(groups) {
  const kinds = lookKinds();
  if (!Array.isArray(groups)) throw new Error('Nhận dạng từ ảnh phải là một danh sách.');
  return groups.map((group) => {
    const kind = String(group?.kind ?? '').trim();
    const node = group?.node ? String(group.node) : '';
    const see = String(group?.see ?? '').replace(/\s+/g, ' ').trim();
    if (!kinds.has(kind)) throw new Error(`Loại "${kind}" không có trong danh sách component.`);
    if (!see) throw new Error(`Nhóm ${node || kind} thiếu câu mô tả trên ảnh.`);
    return { node, kind, see };
  });
}

export function lookReport(look) {
  const signals = look?.signals ?? [];
  const ai = Array.isArray(look?.ai) ? look.ai : null;
  const image = !!look?.shot;
  const rows = signals.map((signal) => {
    const seen = ai?.filter((group) => group.node === signal.node) ?? [];
    const childOf = (SIGNAL_RULES[signal.kind]?.childComponent ?? []).map((child) => child.id);
    const match = seen.find((group) => group.kind === signal.kind || childOf.includes(group.kind));
    const other = seen[0];
    const structure = (signal.cite ?? []).length > 0;
    let verdict = 'pending';
    let review = 'pending';
    let weight = weightOf(0, 0);
    if (!image) {
      verdict = 'no-shot';
      review = 'no-shot';
    } else if (!ai) {
      verdict = 'pending';
      review = 'pending';
    } else if (!seen.length) {
      verdict = 'hint';
      review = 'hint';
      weight = weightOf(0, CODE_WEIGHT);
    } else if (match) {
      verdict = 'agree';
      review = 'trust';
      weight = weightOf(AI_WEIGHT, structure ? CODE_WEIGHT : 0);
    } else if (other.kind === 'block') {
      verdict = 'differ';
      review = 'ai';
      weight = weightOf(AI_WEIGHT, 0);
    } else {
      verdict = 'ai';
      review = 'ai';
      weight = weightOf(AI_WEIGHT, 0);
    }
    const chosen = match ?? other;
    const children = (signal.children ?? []).map((child) => ({
      ...child,
      review: 'doubt',
      structure: (signal.cite ?? []).some((cite) => cite.startsWith(`${child.node}.`) || cite === child.node),
      image: (ai ?? []).some((group) => group.kind === child.id || group.node === child.node),
    }));
    return { ...signal, verdict, review, structure, weight, children, see: chosen?.see ?? '', aiKind: chosen?.kind ?? '' };
  });
  const extras = (ai ?? []).filter((group) => !group.node || !signals.some((signal) => signal.node === group.node));
  const reviewed = new Set(['agree', 'differ', 'doubt', 'hint', 'ai']);
  const ready = image && !!ai && rows.every((row) => reviewed.has(row.verdict));
  return { shot: look?.shot || '', shotError: look?.shotError || '', ready, rows, extras };
}

export function applyAiLook(ws, groups) {
  const look = ws.readJson(LOOK_FILE);
  look.ai = normalizeAi(groups);
  ws.writeJson(LOOK_FILE, look);
  const report = lookReport(look);
  applyAiDecisions(ws, report);
  const model = ws.readJson(PLAN_MODEL);
  model.look = report;
  return model;
}

export function applyAiDecisions(ws, report) {
  if (!ws.has('detections.json')) return;
  const det = ws.readJson('detections.json');
  const components = det.components ?? [];
  for (const row of report.rows ?? []) {
    const item = components.find((entry) => entry.node === row.node && entry.component === row.kind);
    if (!item) continue;
    item.weight = row.weight;
    if (row.verdict === 'agree') {
      item.status = 'approved';
      item.note = `AI ${row.weight.ai}%${row.weight.code ? ` + code ${row.weight.code}%` : ''}`;
    } else if (row.verdict === 'differ') {
      item.status = 'rejected';
      item.note = `AI ${row.weight.ai}% thấy block. Code chỉ gợi ý.`;
    } else if (row.verdict === 'ai') {
      item.status = 'rejected';
      item.note = `Code gợi ý ${row.kind}. AI ${row.weight.ai}% thấy ${row.aiKind}.`;
      adopt(components, row.node, row.aiKind, row.see, row.weight);
    } else if (row.verdict === 'hint' && item.status === 'approved') {
      item.status = 'proposed';
      item.note = `Code gợi ý ${row.weight.code}%. AI chưa gọi tên.`;
    }
  }
  for (const extra of report.extras ?? []) {
    if (!extra.node || extra.kind === 'block' || isSignal(extra.kind)) continue;
    adopt(components, extra.node, extra.kind, extra.see, weightOf(AI_WEIGHT, 0));
  }
  det.components = components;
  ws.writeJson('detections.json', det);
}

function adopt(components, node, kind, see, weight) {
  const existing = components.find((entry) => entry.node === node && entry.component === kind);
  if (existing && existing.status !== 'rejected') {
    existing.status = 'approved';
    existing.weight = weight;
    existing.note = `AI ${weight.ai}%. Code không quyết định.`;
    if (!existing.cite?.length) existing.cite = [{ node, field: 'name' }];
    return;
  }
  components.push({
    id: `ai${String(node).replace(/\W/g, '').slice(0, 8)}`,
    status: 'approved',
    source: 'ai',
    component: kind,
    node,
    confidence: 'high',
    weight,
    cite: [{ node, field: 'name' }],
    evidence: see,
    params: {},
    note: `AI ${weight.ai}%. Code không quyết định.`,
  });
}
