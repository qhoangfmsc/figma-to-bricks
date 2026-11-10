// The picture, the reading of that picture, and the tree signals. A plan conclusion needs all three.
// The picture is Figma's render of the section. The reading names a component kind. The signal is a detection cite.
// Neither the reading nor the signal is a conclusion on its own.
import { writeFileSync } from 'node:fs';
import { download, getRenders } from '../read-figma/api.mjs';
import { PART_RULES } from '../recognize-parts/kinds.mjs';

export const LOOK_FILE = 'look.json';
export const PLAN_MODEL = 'plan-model.json';

export const lookKinds = () => new Set([...Object.keys(PART_RULES), 'block']);

function citeOf(cite) {
  return (cite ?? []).map((item) => [item.node, item.field].filter(Boolean).join('.')).filter(Boolean);
}

export function signalRows(components) {
  return (components ?? [])
    .filter((item) => item && (item.status === 'approved' || item.status === 'proposed'))
    .map((item) => ({
      node: item.node,
      kind: item.component,
      status: item.status,
      confidence: item.confidence ?? '',
      evidence: String(item.evidence ?? '').replace(/\s+/g, ' ').trim(),
      cite: citeOf(item.cite),
    }));
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
  const rows = signals.map((signal) => {
    const seen = ai?.filter((group) => group.node === signal.node) ?? [];
    const match = seen.find((group) => group.kind === signal.kind);
    const other = seen[0];
    let verdict = 'pending';
    if (!look?.shot) verdict = 'no-shot';
    else if (!ai) verdict = 'pending';
    else if (match) verdict = 'agree';
    else if (other) verdict = 'differ';
    const chosen = match ?? other;
    return { ...signal, verdict, see: chosen?.see ?? '', aiKind: chosen?.kind ?? '' };
  });
  const extras = (ai ?? []).filter((group) => !group.node || !signals.some((signal) => signal.node === group.node));
  const ready = !!look?.shot && !!ai && rows.every((row) => row.verdict === 'agree' || row.verdict === 'differ');
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
