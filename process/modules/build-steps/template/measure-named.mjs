// The picture already named the component. This reads that node's tree and fills
// structural params the picture did not type. It does not change the kind.
import { PartKind, isKind } from '../../recognize-parts/kinds.mjs';
import { detectForms } from '../../recognize-parts/rules/form.mjs';
import { menuLabels } from '../../write-bricks/components/menu.mjs';

function findNode(root, id) {
  if (!root) return null;
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function firstText(node) {
  if (!node || node.visible === false) return '';
  if (node.type === 'TEXT' && !node.svg && node.text?.characters?.trim()) return node.text.characters.trim();
  for (const child of node.children ?? []) {
    const text = firstText(child);
    if (text) return text;
  }
  return '';
}

function fillForm(entry, node) {
  if (entry.params?.fields?.length) return;
  const hit = detectForms(node).find((form) => form.node === node.id);
  if (!hit?.params?.fields?.length) return;
  entry.params = { ...(entry.params ?? {}), ...hit.params, ...(entry.params ?? {}) };
  if (!entry.params.fields?.length) entry.params.fields = hit.params.fields;
  if (!entry.params.submit) entry.params.submit = hit.params.submit ?? null;
}

function fillMenu(entry, node) {
  const links = { ...(entry.params?.links ?? {}) };
  for (const label of menuLabels(node)) if (!(label.id in links)) links[label.id] = null;
  entry.params = { ...(entry.params ?? {}), links };
}

function fillSelect(entry, node) {
  if (entry.params?.text) return;
  const text = firstText(node);
  if (!text) return;
  entry.params = { ...(entry.params ?? {}), text, values: entry.params?.values ?? [] };
}

export function measureNamed(tree, detections) {
  for (const entry of detections?.components ?? []) {
    if (entry.status !== 'approved') continue;
    const node = findNode(tree, entry.node);
    if (!node) continue;
    entry.params ??= {};
    if (isKind(entry, PartKind.FORM)) fillForm(entry, node);
    if (isKind(entry, PartKind.MENU) || isKind(entry, PartKind.MENU_SLIDER)) fillMenu(entry, node);
    if (isKind(entry, PartKind.SELECT)) fillSelect(entry, node);
  }
  return detections;
}
