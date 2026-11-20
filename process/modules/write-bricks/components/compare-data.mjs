import { PartKind, isKind } from '../../recognize-parts/kinds.mjs';
// Comparison table payload from VNX_Compare_Table_Store_Center, the shape GET /wp-json/vnx_api/compare-table/{id} returns.
// Money is stored as an integer. The tag prints it with a dot as the thousands separator, and the drawn text is matched to that.

export { PRICE_ID as COMPARE_ID } from './price-data.mjs';

const norm = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

export function formatMoney(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return groupDigits(value);
  const text = norm(value);
  if (/^-?\d+$/.test(text)) return groupDigits(Number(text));
  return text;
}

function groupDigits(value) {
  const sign = value < 0 ? '-' : '';
  const digits = String(Math.abs(value));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function cellType(value, given) {
  if (given === 'yes' || given === 'no' || given === 'text' || given === 'empty') return given;
  const text = norm(value).toLowerCase();
  if (text === 'yes' || text === 'no') return text;
  return text ? 'text' : 'empty';
}

/**
 * @returns {{ table: object } | { error: string }}
 */
export function parseCompareData(payload) {
  const body = payload?.data?.packages ? payload.data : payload;
  if (!body || !Array.isArray(body.packages) || !Array.isArray(body.groups)) return { error: 'missing-table' };
  const packages = body.packages.filter((item) => item && !item.hidden).map((item) => ({
    id: norm(item.id),
    name: norm(item.name),
    price: formatMoney(item.price),
    cycle: norm(item.cycle),
    total: formatMoney(item.total),
    link: norm(item.link),
  }));
  const groups = body.groups.filter((item) => item && Array.isArray(item.rows)).map((item) => ({
    id: norm(item.id),
    label: norm(item.label),
    icon: norm(item.icon),
    rows: item.rows.filter(Boolean).map((row) => {
      const values = {};
      for (const cell of row.values ?? []) {
        const key = norm(cell?.package);
        if (!key) continue;
        values[key] = { value: norm(cell.value), type: cellType(cell.value, cell.type) };
      }
      return { id: norm(row.id), label: norm(row.label), desc: norm(row.desc), values };
    }),
  }));
  if (!packages.length || !groups.some((group) => group.rows.length)) return { error: 'empty-table' };
  return {
    table: {
      meta: {
        table_id: norm(body.id),
        name: norm(body.name),
        unit: norm(body.unit),
        button: norm(body.button),
      },
      packages,
      groups,
    },
  };
}

export function queryType(kind, id) {
  return `vnxcmp_${kind}__${id}`;
}

// The id bound on the base frame is the same id on every breakpoint.
// The node may be the paired wrapper. A table drawn inside that wrapper still uses this id.
export function carryCompareTables(baseDetections, variantDetections, pairs, variantRootId) {
  const bound = (baseDetections?.components ?? []).filter((item) => isKind(item, PartKind.COMPARE_TABLE) && item.status === 'approved' && item.params?.id && item.params?.table);
  if (!bound.length) return variantDetections;
  const baseToVariant = new Map();
  for (const [variantId, baseId] of pairs ?? []) baseToVariant.set(baseId, variantId);
  const rest = (variantDetections?.components ?? []).filter((item) => !isKind(item, PartKind.COMPARE_TABLE));
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

export async function attachCompareData(ws, reader) {
  const det = ws.readJson('detections.json', { components: [] });
  const pending = (det.components ?? []).filter((item) => isKind(item, PartKind.COMPARE_TABLE) && item.params?.id && !item.params.table);
  if (!pending.length) return [];
  const errors = [];
  for (const item of pending) {
    try {
      const parsed = parseCompareData(await reader(item.params.id));
      if (parsed.error) errors.push(`${item.params.id}: ${parsed.error}`);
      else item.params.table = parsed.table;
    } catch (error) {
      errors.push(`${item.params.id}: ${error.message}`);
    }
  }
  ws.writeJson('detections.json', det);
  return errors;
}
