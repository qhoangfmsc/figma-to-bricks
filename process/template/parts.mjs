// Step 2 of Vietnix Tools: one block per component, one labelled field per thing the owner can change.
// A component the rules already asked about keeps those questions. One the rules skipped still gets a field,
// so a missed question is not a blank screen.
import { findNode, firstText } from '../bricks/components/helpers.mjs';
import { GROUPS, itemHeading, keyOf, figmaLink } from '../plan/index.mjs';

const HINT = {
  link: 'https://…, /duong-dan, #',
  alt: 'Mô tả ngắn của ảnh',
  answer: 'Nội dung khi mở mục',
  pane: 'Nội dung của tab',
  autoplay: 'Số giây, hoặc không',
    sync: 'không sửa, chỉ đồng bộ chữ, đừng đổi icon',
  act: 'Bấm để hiện hết chữ, hoặc địa chỉ trang',
  expand: 'Gõ phần chữ thêm khi mở, hoặc dán link Figma bản đầy đủ. Để trống thì hiện nốt chữ đã có trong khung.',
  keep: 'Dựng thành một khối tĩnh',
};
const KIND = {
  button: 'Nút', readmore: 'Xem thêm', semantic: 'Khối', accordion: 'Accordion', tabs: 'Tab', menu: 'Menu',
  carousel: 'Slider', form: 'Form', link: 'Link', 'flat-image': 'Ảnh', 'icon-list': 'Danh sách icon',
  breadcrumbs: 'Breadcrumb', counter: 'Số', countdown: 'Đếm ngược', tooltip: 'Tooltip', 'tooltip-style': 'Tooltip',
};
const QUIET = new Set(['flat-image', 'tooltip', 'tooltip-style']);

const owns = (node, id) => !!node && (node.id === id || (node.children ?? []).some((c) => owns(c, id)));
const depthOf = (tree, id) => {
  let d = -1;
  (function walk(n, i) { if (n.id === id) d = i; for (const c of n.children ?? []) walk(c, i + 1); })(tree, 0);
  return d;
};
const clip = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').slice(0, 48);

function partName(tree, component) {
  const node = findNode(tree, component.node);
  if (component.component === 'readmore' && component.params?.button) {
    const label = firstText(findNode(tree, component.params.button))?.text?.characters;
    if (label) return clip(label);
  }
  const text = node && firstText(node)?.text?.characters;
  if (component.component === 'button' || component.component === 'link') return clip(text || node?.name || component.node);
  return clip(node?.name || component.node);
}

function withTitle(field, name, kind) {
  return { ...field, title: itemHeading(field.group, field.caption || name, kind) };
}

function fallbackField(component, readmoreButtons) {
  if (component.component === 'button' && readmoreButtons.has(component.node)) {
    return { group: 'act' };
  }
  if (component.component === 'readmore') return { group: 'expand' };
  if (component.component === 'semantic') return { group: 'keep' };
  return null;
}

function fieldOf(q, fileKey) {
  const g = GROUPS[q.group];
  return {
    field: g?.field || q.group,
    group: q.group,
    key: q.key || keyOf(q.group, q.node),
    value: q.value != null && q.value !== '' ? q.value : (g?.value ?? ''),
    placeholder: HINT[q.group] || '',
    options: g?.options,
    linkOption: g?.linkOption,
    control: q.group === 'answer' || q.group === 'pane' || q.group === 'expand' ? 'textarea' : g?.options ? 'select' : 'input',
    caption: q.caption || '',
    figma: q.figma || (fileKey ? figmaLink(fileKey, q.node) : ''),
  };
}

// approved components, deepest owner wins a question, plus a fallback field when the rules asked nothing
export function screenParts(tree, components, questions, fileKey) {
  const approved = (components ?? []).filter((c) => c.status === 'approved' && !QUIET.has(c.component));
  const readmoreButtons = new Set(approved.filter((c) => c.component === 'readmore').map((c) => c.params?.button).filter(Boolean));
  const ranked = [...approved].sort((a, b) => depthOf(tree, b.node) - depthOf(tree, a.node));
  const buckets = new Map(approved.map((c) => [c.node + ':' + c.component, []]));
  const loose = [];
  for (const q of questions ?? []) {
    const owner = ranked.find((c) => owns(findNode(tree, c.node), q.node));
    const item = { ...q, caption: (questions.filter((x) => x.group === q.group).length > 1) ? q.label : '' };
    if (owner) buckets.get(owner.node + ':' + owner.component).push(item);
    else loose.push(item);
  }
  const parts = approved.map((c) => {
    const name = partName(tree, c);
    const kind = KIND[c.component] || c.component;
    let fields = (buckets.get(c.node + ':' + c.component) ?? []).map((q) => withTitle(fieldOf(q, fileKey), name, kind));
    if (!fields.length) {
      const fb = fallbackField(c, readmoreButtons);
      if (fb) fields = [withTitle(fieldOf({ ...fb, node: c.node, label: '' }, fileKey), name, kind)];
    }
    return { kind, name, figma: figmaLink(fileKey, c.node), fields };
  }).filter((p) => p.fields.length);
  for (const q of loose) {
    const name = clip(q.label);
    const kind = GROUPS[q.group]?.field || q.group;
    parts.push({ kind, name, figma: figmaLink(fileKey, q.node), fields: [withTitle(fieldOf(q, fileKey), name, kind)] });
  }
  return parts;
}
