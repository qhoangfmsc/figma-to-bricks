// Seeds for the "sections" list: the visible container children of the root. Only a starting point: the AI pass (see AI-GUIDE.md)
// renames them and writes what is inside; a human fixes the rest.
const CONTAINERS = new Set(['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT', 'SECTION']);

export function detectSections(tree) {
  const kids = (tree.children ?? []).filter((c) => c.visible !== false && CONTAINERS.has(c.type));
  return kids.map((n, i) => ({ id: `s${i + 1}`, node: n.id, name: n.name, summary: null, source: 'rule' }));
}
