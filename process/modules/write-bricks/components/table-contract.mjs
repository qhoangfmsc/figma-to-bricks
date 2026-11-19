// A price table and a comparison table render the tool's data, not the words Figma drew.
// Figma chooses the layout: a pill row is cycle tabs, a closed field is a cycle dropdown,
// and a card row may scroll or stay a slider. The query repeats every package, cycle and feature row.

function walk(content) {
  const queries = [];
  const classes = [];
  const texts = [];
  for (const element of content ?? []) {
    const settings = element?.settings ?? {};
    if (settings.query?.objectType) queries.push(settings.query.objectType);
    if (settings._hidden?._cssClasses) classes.push(settings._hidden._cssClasses);
    if (typeof settings.text === 'string') texts.push(settings.text);
    for (const child of settings.extraChildren ?? []) {
      if (typeof child?.settings?.text === 'string') texts.push(child.settings.text);
      if (child?.settings?._hidden?._cssClasses) classes.push(child.settings._hidden._cssClasses);
    }
  }
  return { queries, classes, texts };
}

const has = (texts, needle) => texts.some((text) => text.includes(needle));

export function priceTableGaps(content, table, id) {
  const { queries, classes, texts } = walk(content);
  const gaps = [];
  if (!queries.includes(`vnxsp_cycle__${id}`)) gaps.push('cycle loop');
  if (!queries.includes(`vnxsp_pkg__${id}`)) gaps.push('package loop');
  if ((table?.rows?.length ?? 0) > 0 && !queries.includes(`vnxsp_row__${id}`)) gaps.push('info row loop');
  const cycleUi = classes.some((name) => name.split(' ').includes('tab-title') || name.includes('f2b-select'));
  if (!cycleUi) gaps.push('cycle tabs or dropdown');
  if (!has(texts, '{vnx_sp_name}')) gaps.push('package name');
  if (!has(texts, '{vnx_sp_sale}')) gaps.push('package price');
  return gaps;
}

export function compareTableGaps(content, table, id) {
  const { queries, texts } = walk(content);
  const gaps = [];
  if (!queries.includes(`vnxcmp_group__${id}`)) gaps.push('feature group loop');
  if (!queries.includes(`vnxcmp_row__${id}`)) gaps.push('feature row loop');
  if (!has(texts, '{vnx_cmp_row')) gaps.push('feature name');
  if (!has(texts, '{vnx_cmp_value_text') && !has(texts, '{vnx_cmp_name')) gaps.push('feature value');
  const positions = new Set();
  for (const text of texts) {
    for (const match of text.matchAll(/:p=(\d+)/g)) positions.add(Number(match[1]));
  }
  const packages = table?.packages?.length ?? 0;
  const looped = queries.includes(`vnxcmp_pkg__${id}`);
  if (!looped && positions.size < packages) gaps.push('every package column');
  return gaps;
}

export function boundTableGaps(content, detections) {
  const lines = [];
  for (const item of detections?.components ?? []) {
    if (item.status === 'rejected' || !item.params?.id || !item.params?.table) continue;
    const gaps = item.component === 'price-table'
      ? priceTableGaps(content, item.params.table, item.params.id)
      : item.component === 'compare-table'
        ? compareTableGaps(content, item.params.table, item.params.id)
        : [];
    if (gaps.length) lines.push(`${item.component} ${item.params.id} thiếu ${gaps.join(', ')}. Figma chỉ là layout. Data của id phải ra đủ chu kỳ, gói hoặc dòng tính năng.`);
  }
  return lines;
}
