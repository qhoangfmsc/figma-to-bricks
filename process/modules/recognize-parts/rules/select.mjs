// A closed dropdown is a short wide control: one value, a border, and a small mark at the end.
// The list is not drawn. The plan supplies the values. A label above the control is optional.

const shown = (node) => (node?.children ?? []).filter((child) => child && child.visible !== false);
const words = (node) => shown(node).filter((child) => child.type === 'TEXT' && !child.svg && child.text?.characters?.trim());

export function isSelectControl(node) {
  if (!node || node.layout?.mode !== 'HORIZONTAL' || !node.box) return false;
  const width = node.box.w ?? 0;
  const height = node.box.h ?? 0;
  if (height < 32 || height > 64 || width < height * 2) return false;
  if (!node.stroke?.paints?.length) return false;
  const labels = words(node).filter((child) => child.text.characters.trim().length <= 40);
  if (labels.length !== 1) return false;
  const mark = shown(node).find((child) => {
    if (child === labels[0] || words(child).length) return false;
    const markWidth = child.box?.w ?? 99;
    const markHeight = child.box?.h ?? 99;
    if (markWidth > height * 0.6 || markHeight > height * 0.8) return false;
    return (child.box?.x ?? 0) > (labels[0].box?.x ?? 0) + (labels[0].box?.w ?? 0);
  });
  return !!mark;
}

export function detectSelects(tree) {
  const found = [];
  const walk = (node) => {
    if (!node || node.visible === false) return;
    if (isSelectControl(node)) {
      const label = words(node)[0];
      found.push({
        component: 'select',
        node: node.id,
        level: 'E2',
        confidence: 'high',
        cite: [{ node: label.id, field: 'type', equals: 'TEXT' }],
        evidence: `a bordered control shows "${label.text.characters.trim()}" and a trailing mark`,
        params: { text: label.text.characters.trim(), values: [] },
        note: null,
      });
      return;
    }
    shown(node).forEach(walk);
  };
  walk(tree);
  return found;
}
