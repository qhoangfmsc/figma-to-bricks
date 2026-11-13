// A breadcrumb is a short horizontal trail: a label, then a separator, then a label.
// The separator is a small icon, or it sits in front of every label after the first.
// A row of labels with no separators stays a menu.
const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);

function labelsOf(n, out = []) {
  if (!n || n.visible === false) return out;
  if (n.type === 'TEXT' && !n.svg && n.text?.characters?.trim()) out.push(n);
  for (const child of visibleKids(n)) labelsOf(child, out);
  return out;
}

function isSeparator(n) {
  if (!n || n.visible === false || labelsOf(n).length) return false;
  const w = n.box?.w ?? 0;
  const h = n.box?.h ?? 0;
  if (w > 32 || h > 32) return false;
  return !!(n.svg || n.type === 'VECTOR' || n.type === 'INSTANCE');
}

function crumb(n) {
  const labels = labelsOf(n);
  if (labels.length !== 1) return null;
  const icon = visibleKids(n).some((child) => isSeparator(child) || visibleKids(child).some(isSeparator));
  return { icon };
}

export function isBreadcrumbRow(n) {
  if (n?.layout?.mode !== 'HORIZONTAL') return false;
  const kids = visibleKids(n);
  if (kids.length < 2 || kids.length > 8) return false;
  const marks = kids.map(crumb);
  if (marks.every(Boolean) && marks.slice(1).every((item) => item.icon)) return true;
  if (kids.length < 3 || kids.length % 2 === 0) return false;
  return kids.every((child, index) => (index % 2 === 0 ? labelsOf(child).length === 1 : isSeparator(child)));
}

export function detectBreadcrumbs(tree) {
  const found = [];
  (function walk(n) {
    if (n.visible === false) return;
    if (isBreadcrumbRow(n)) {
      const home = labelsOf(n)[0];
      found.push({
        component: 'breadcrumbs',
        node: n.id,
        level: 'E1',
        confidence: 'high',
        cite: [{ node: n.id, field: 'layout.mode', equals: 'HORIZONTAL' }, { node: home.id, field: 'type', equals: 'TEXT' }],
        evidence: `"${n.name}" is a trail of ${labelsOf(n).length} labels with a separator before each label after the first`,
        params: {},
        note: 'the current page label follows the WordPress page',
      });
      return;
    }
    visibleKids(n).forEach(walk);
  })(tree);
  return found;
}
