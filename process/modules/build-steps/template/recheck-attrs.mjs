// A verify row is one Figma attribute that does not match the preview.
// When that attribute is a Bricks style control and the element does not have it yet, write the Figma value onto the control.
// filter, backdrop-filter, and text-shadow have no control on the element. They stay in custom CSS.
const TYPOGRAPHY = {
  'font-size': 'font-size',
  'font-weight': 'font-weight',
  'line-height': 'line-height',
  'text-align': 'text-align',
  'letter-spacing': 'letter-spacing',
};

function nodeOverride(overrides, id) {
  const current = overrides.nodes[id] ?? {};
  current.settings ??= {};
  current.reason = current.reason && !current.reason.startsWith('autopilot')
    ? current.reason
    : 'recheck: the Figma attribute was missing on the element style';
  overrides.nodes[id] = current;
  return current;
}

export function recheckAttrs(ws) {
  const verify = ws.readJson('verify.json', null);
  const rows = (verify?.bad ?? []).filter((row) => row && row.id && row.ok === false && row.want != null && row.want !== '');
  if (!rows.length) return { fixed: 0, skipped: [] };
  const overrides = ws.readJson('overrides.json', { nodes: {} });
  overrides.nodes ??= {};
  let fixed = 0;
  const skipped = [];
  for (const row of rows) {
    const typographyKey = TYPOGRAPHY[row.check];
    const node = nodeOverride(overrides, row.id);
    if (typographyKey) {
      node.settings._typography ??= {};
      if (node.settings._typography[typographyKey] != null) continue;
      node.settings._typography[typographyKey] = String(row.want);
      fixed += 1;
      continue;
    }
    if (row.check === 'color') {
      node.settings._typography ??= {};
      if (node.settings._typography.color != null) continue;
      node.settings._typography.color = { raw: String(row.want) };
      fixed += 1;
      continue;
    }
    if (row.check === 'background-color') {
      if (node.settings._background != null) continue;
      node.settings._background = { color: { raw: String(row.want) } };
      fixed += 1;
      continue;
    }
    if (row.check === 'filter' || row.check === 'backdrop-filter' || row.check === 'text-shadow') {
      skipped.push({ id: row.id, check: row.check });
    }
  }
  if (fixed) ws.writeJson('overrides.json', overrides);
  return { fixed, skipped };
}
