import { PartKind, isKind } from '../../recognize-parts/kinds.mjs';
// Service Pricing widget_data, the column matrix VNX_Service_Price_Store_Center::widget_data returns.
// Sections are the three cells in column A that contain "*". Cell parts are split on "|".
// The words of a table are data. They are not a detection rule.

export const PRICE_ID = /^[a-z0-9][a-z0-9-]{0,59}$/;

const norm = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

function parts(cell) {
  return String(cell ?? '').split('|').map((part) => part.trim());
}

function columnsOf(data) {
  if (!Array.isArray(data) || !data.length) return [];
  return data.map((col) => (Array.isArray(col) ? col.map((cell) => (cell == null ? '' : String(cell))) : []));
}

/**
 * @returns {{ table: object } | { error: string }}
 */
export function parseWidgetData(payload) {
  if (!payload || payload.status !== true || !Array.isArray(payload.data)) return { error: 'missing-table' };
  const cols = columnsOf(payload.data);
  const marks = [];
  (cols[0] ?? []).forEach((cell, index) => {
    if (cell.includes('*')) marks.push(index);
  });
  if (marks.length < 3) return { error: 'missing-marks' };
  const [priceAt, infoAt, urlAt] = marks;

  const cycles = [];
  for (let row = priceAt + 1; row < infoAt; row++) {
    const [label, badge = ''] = parts(cols[0][row]);
    if (!label) continue;
    cycles.push({ label, badge });
  }

  const rows = [];
  for (let row = infoAt + 1; row < urlAt; row++) {
    rows.push({ label: norm(cols[0][row]), desc: norm((cols[1] ?? [])[row]) });
  }

  const packages = [];
  for (let col = 2; col < cols.length; col++) {
    const name = norm(cols[col]?.[0]);
    if (!name) continue;
    const prices = [];
    const links = [];
    cycles.forEach((_, index) => {
      const cell = parts(cols[col][priceAt + 1 + index]);
      prices.push({
        regular: cell[0] ?? '',
        sale: cell[1] ?? '',
        total: cell[2] ?? '',
        tag: cell[3] ?? '',
        promoText: cell[4] ?? '',
        code: cell[5] ?? '',
        special: cell[6] ?? '',
      });
      links.push(norm(cols[col][urlAt + 1 + index]));
    });
    const info = rows.map((_, index) => {
      const cell = parts(cols[col][infoAt + 1 + index]);
      return { text: cell[0] ?? '', extra: cell[1] ?? '', icon: cell[2] ?? '' };
    });
    packages.push({ name, prices, links, info });
  }

  if (!cycles.length || !packages.length) return { error: 'empty-table' };
  return {
    table: {
      meta: {
        table_id: norm(payload.meta?.table_id),
        unit: norm(payload.meta?.unit),
        button: norm(payload.meta?.button),
        updated_at: Number(payload.meta?.updated_at ?? 0),
      },
      cycles,
      rows,
      packages,
    },
  };
}

export function queryType(kind, id) {
  return `vnxsp_${kind}__${id}`;
}

// The table bound on the base frame is the same table on every breakpoint frame.
// A variant detection that names another table is replaced. The node is the paired
// node in that frame, or the frame root when the base node has no pair.
export function carryPriceTables(baseDetections, variantDetections, pairs, variantRootId) {
  const bound = (baseDetections?.components ?? []).filter((item) => isKind(item, PartKind.PRICE_TABLE) && item.status === 'approved' && item.params?.id && item.params?.table);
  if (!bound.length) return variantDetections;
  const baseToVariant = new Map();
  for (const [variantId, baseId] of pairs ?? []) baseToVariant.set(baseId, variantId);
  const rest = (variantDetections?.components ?? []).filter((item) => !isKind(item, PartKind.PRICE_TABLE));
  const byTable = new Map();
  for (const item of bound) {
    const paired = baseToVariant.get(item.node);
    const prev = byTable.get(item.params.id);
    if (prev?.paired) continue;
    byTable.set(item.params.id, {
      paired: !!paired,
      detection: {
        ...item,
        id: `${item.id}@${variantRootId}`,
        node: paired ?? variantRootId,
        params: { ...item.params },
      },
    });
  }
  return { ...(variantDetections ?? {}), components: [...rest, ...[...byTable.values()].map((item) => item.detection)] };
}

// Fills params.table from the site. A table already on the detection is kept, so a later build stays offline.
export async function attachWidgetData(ws, reader) {
  const det = ws.readJson('detections.json', { components: [] });
  const pending = (det.components ?? []).filter((item) => isKind(item, PartKind.PRICE_TABLE) && item.params?.id && !item.params.table);
  if (!pending.length) return [];
  const errors = [];
  for (const item of pending) {
    try {
      const parsed = parseWidgetData(await reader(item.params.id));
      if (parsed.error) errors.push(`${item.params.id}: ${parsed.error}`);
      else item.params.table = parsed.table;
    } catch (error) {
      errors.push(`${item.params.id}: ${error.message}`);
    }
  }
  ws.writeJson('detections.json', det);
  return errors;
}
