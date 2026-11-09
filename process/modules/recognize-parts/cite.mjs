// Source grounding: every detection can cite facts of the tree, and the citations are RE-CHECKED by code against tree.json.
// An AI (or a rule) cannot invent a bug-free-looking reason: if the cited node / field / value is not in the tree, the detection is
// flagged and the review gate refuses to sign off.
//
//   cite: [{ node: "1688:8200", field: "props.Tooltips icon", equals: true }]
//   field   path on the normalized node: name, type, component, componentSet, text.characters, props.<property name>, styleRefs.text …
//           (after `props.` the rest is ONE key, because Figma property names contain spaces)
//   equals  optional; without it the field must just exist
export function findNode(tree, id) {
  if (tree.id === id) return tree;
  for (const c of tree.children ?? []) { const f = findNode(c, id); if (f) return f; }
  return null;
}

export function readField(node, field) {
  if (field.startsWith('props.')) return node.props?.[field.slice(6)];
  return field.split('.').reduce((v, k) => (v == null ? undefined : v[k]), node);
}

// -> list of human-readable problems (empty = every citation holds)
export function checkCites(cites, tree) {
  const problems = [];
  for (const c of cites ?? []) {
    const n = findNode(tree, c.node);
    if (!n) { problems.push(`cite ${c.node}.${c.field}: node is not in the tree`); continue; }
    const v = readField(n, c.field);
    if (v === undefined) problems.push(`cite ${c.node}.${c.field}: the field does not exist on "${n.name}"`);
    else if ('equals' in c && v !== c.equals) problems.push(`cite ${c.node}.${c.field}: tree says ${JSON.stringify(v)}, not ${JSON.stringify(c.equals)}`);
  }
  return problems;
}
