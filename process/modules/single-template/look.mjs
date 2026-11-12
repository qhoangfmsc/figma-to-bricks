// The picture, the reading of that picture, and the tree signals. A plan conclusion needs all three.
// The picture is Figma's render of the section. The reading names a component kind. The signal is a detection cite.
// Neither the reading nor the signal is a conclusion on its own.
import { writeFileSync } from 'node:fs';
import { download, getRenders } from '../read-figma/api.mjs';
import { SIGNAL_RULES, childKindIds, isSignal } from '../recognize-parts/kinds.mjs';

export const LOOK_FILE = 'look.json';
export const PLAN_MODEL = 'plan-model.json';

export const lookKinds = () => new Set([...Object.keys(SIGNAL_RULES), ...childKindIds(), 'pagination', 'block']);

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
    if (!image) {
      verdict = 'no-shot';
      review = 'no-shot';
    } else if (!ai) {
      verdict = 'pending';
      review = 'pending';
    } else if (other && !match) {
      verdict = 'differ';
      review = 'differ';
    } else if (match && structure) {
      verdict = 'agree';
      review = 'trust';
    } else {
      verdict = 'doubt';
      review = 'doubt';
    }
    const chosen = match ?? other;
    const children = (signal.children ?? []).map((child) => ({
      ...child,
      review: 'doubt',
      structure: (signal.cite ?? []).some((cite) => cite.startsWith(`${child.node}.`) || cite === child.node),
      image: (ai ?? []).some((group) => group.kind === child.id || group.node === child.node),
    }));
    return { ...signal, verdict, review, structure, children, see: chosen?.see ?? '', aiKind: chosen?.kind ?? '' };
  });
  const extras = (ai ?? []).filter((group) => !group.node || !signals.some((signal) => signal.node === group.node));
  const reviewed = new Set(['agree', 'differ', 'doubt']);
  const ready = image && !!ai && rows.every((row) => reviewed.has(row.verdict));
  return { shot: look?.shot || '', shotError: look?.shotError || '', ready, rows, extras };
}

export function applyAiLook(ws, groups) {
  const look = ws.readJson(LOOK_FILE);
  look.ai = normalizeAi(groups);
  ws.writeJson(LOOK_FILE, look);
  const model = ws.readJson(PLAN_MODEL);
  model.look = lookReport(look);
  return model;
}
