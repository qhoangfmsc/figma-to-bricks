// Confirm step of /generate-template-from-figma: one block per component, one labelled field per thing the owner can change.
// A component the rules already asked about keeps those questions. One the rules skipped still gets a field,
// so a missed question is not a blank screen.
import { findNode, firstText } from '../write-bricks/components/helpers.mjs';
import { GROUPS, itemHeading, keyOf, figmaLink } from '../missing-content/index.mjs';
import { MISSING } from '../missing-content/choices.mjs';
import { unclaimedRepeats } from '../recognize-parts/structure.mjs';

const HINT = {
  link: 'Viết địa chỉ, ví dụ vietnix.vn/bang-gia. Chưa có thì ghi chưa có.',
  alt: 'Một câu ngắn, ví dụ logo Vietnix. Ảnh trang trí thì để nguyên.',
  answer: 'Viết câu trả lời khi mở mục này.',
  pane: 'Đúng rồi thì để nguyên. Muốn đổi thì dán link khung, hoặc viết nội dung.',
  tabopen: 'Viết tên tab đang mở.',
  tabdata: 'Viết tên nhóm mục của tab đang mở.',
  autoplay: 'Ví dụ 5 giây, hoặc đừng tự chạy.',
  count: 'Ví dụ 5 cái.',
  items: 'Để trống là dùng các mục đang có. Hoặc dán link khung chứa đủ mục.',
  mobileform: 'Để nguyên. Có link mobile thì tool dựng đúng thứ khung đó vẽ.',
  sync: 'Giữ nguyên, chỉ giống phần chữ, hoặc đừng đổi icon.',
  act: 'Hiện hết chữ, hoặc viết địa chỉ trang.',
  expand: 'Viết chữ thêm khi mở, hoặc dán link khung đã mở hết. Để trống thì hiện nốt chữ đang có.',
  keep: 'Giữ nguyên như bản vẽ.',
};
const KIND = {
  button: 'Nút', checkbox: 'Checkbox', switch: 'Switch', readmore: 'Xem thêm', semantic: 'Khối', accordion: 'Accordion', tabs: 'Tab', 'tab-switch': 'Tabs Component', menu: 'Menu',
  'menu-slider': 'Menu slider', carousel: 'Slider', form: 'Form', link: 'Link', 'flat-image': 'Ảnh', 'icon-list': 'Danh sách icon',
  breadcrumbs: 'Breadcrumb', counter: 'Số', countdown: 'Đếm ngược', tooltip: 'Tooltip', 'tooltip-style': 'Tooltip',
};
const TAB_NOTE = 'Mỗi nút là một tab. Phần bên dưới là nội dung của tab đang mở. Tab chưa vẽ thì dán link khung đó, hoặc viết nội dung vào. Để trống là giữ như bản vẽ.';
const SLIDER_NOTE = 'Chỉ có khung desktop thì mobile vẫn là slider. Có link mobile thì dựng đúng thứ khung đó vẽ, kể cả khi không phải slider. Không tự đổi slider thành hàng kéo.';

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

function detailOf(tree, component) {
  if (component.component !== 'form') return '';
  const labels = (component.params?.fields ?? []).map((f) => clip(f.label || f.placeholder)).filter(Boolean);
  const submit = findNode(tree, component.params?.submit);
  const button = clip(submit && firstText(submit)?.text?.characters);
  return [labels.join(', '), button ? `nút ${button}` : ''].filter(Boolean).join(' · ');
}

const CANNED = new Set(['chưa có địa chỉ', 'chưa có địa chỉ video', 'chưa có câu trả lời', 'chưa có nội dung', 'tự chuyển mỗi 3 giây', 'ảnh chỉ để trang trí', 'giữ nguyên khối', 'làm các mục giống nhau']);

function shownValue(value, fallback) {
  const text = value != null && value !== '' ? String(value) : (fallback ?? '');
  if (!text || CANNED.has(text)) return MISSING;
  return text;
}

function fieldOf(q, fileKey) {
  const g = GROUPS[q.group];
  return {
    field: g?.field || q.group,
    group: q.group,
    key: q.key || keyOf(q.group, q.node),
    value: shownValue(q.value, g?.value),
    placeholder: HINT[q.group] || '',
    options: g?.options,
    linkOption: g?.linkOption,
    control: q.group === 'answer' || q.group === 'pane' || q.group === 'expand' || q.group === 'items' ? 'textarea' : g?.options ? 'select' : 'input',
    caption: q.caption || '',
    figma: q.figma || (fileKey ? figmaLink(fileKey, q.node) : ''),
  };
}

// approved components, deepest owner wins a question, plus a fallback field when the rules asked nothing.
// A component with nothing to type is still listed: step 2 is where the owner sees what was recognized.
export function screenParts(tree, components, questions, fileKey) {
  const approved = (components ?? []).filter((c) => c.status === 'approved');
  const readmoreButtons = new Set(approved.filter((c) => c.component === 'readmore').map((c) => c.params?.button).filter(Boolean));
  const ranked = [...approved].sort((a, b) => depthOf(tree, b.node) - depthOf(tree, a.node));
  const buckets = new Map(approved.map((c) => [c.node + ':' + c.component, []]));
  const loose = [];
  for (const q of questions ?? []) {
    if (q.group === 'type') continue;
    const owner = ranked.find((c) => owns(findNode(tree, c.node), q.node));
    const item = { ...q, caption: q.group === 'pane' || questions.filter((x) => x.group === q.group).length > 1 ? q.label : '' };
    if (owner) buckets.get(owner.node + ':' + owner.component).push(item);
    else loose.push(item);
  }
  const parts = approved.map((c) => {
    const name = partName(tree, c);
    const kind = KIND[c.component] || c.component;
    let fields = (buckets.get(c.node + ':' + c.component) ?? []).map((q) => withTitle(fieldOf(q, fileKey), name, kind));
    if (c.component === 'form') fields = fields.filter((field) => field.group !== 'confirm');
    if (!fields.length) {
      const fb = fallbackField(c, readmoreButtons);
      if (fb) fields = [withTitle(fieldOf({ ...fb, node: c.node, label: '' }, fileKey), name, kind)];
    }
    const note = c.component === 'tabs' || c.component === 'tab-switch' ? TAB_NOTE : c.component === 'carousel' ? SLIDER_NOTE : '';
    const detail = detailOf(tree, c);
    const ids = walkIds(findNode(tree, c.node) ?? { id: c.node });
    return { kind, name, node: c.node, figma: figmaLink(fileKey, c.node), ids, ...(detail && { detail }), ...(note && { note }), fields };
  });
  for (const q of loose) {
    const name = clip(q.label);
    const kind = GROUPS[q.group]?.field || q.group;
    parts.push({ kind, name, node: q.node, figma: figmaLink(fileKey, q.node), fields: [withTitle(fieldOf(q, fileKey), name, kind)] });
  }
  return parts;
}

export function planInventory(tree, components, fileKey = '') {
  const link = (node) => (fileKey ? figmaLink(fileKey, node) : '');
  const line = (c) => ({ node: c.node, label: `${KIND[c.component] || c.component} "${partName(tree, c)}"`, value: '' });
  return {
    found: (components ?? []).filter((c) => c.status === 'approved').map(line),
    open: (components ?? []).filter((c) => c.status === 'proposed').map((c) => ({
      ...line(c),
      evidence: String(c.evidence ?? '').replace(/\s+/g, ' ').trim(),
      figma: link(c.node),
    })),
    repeats: unclaimedRepeats(tree, components ?? []).map((r) => ({
      node: r.node,
      label: `${r.count} mục "${clip(r.item) || r.name}"${r.sample ? `, mẫu "${clip(r.sample)}"` : ''}`,
      count: r.count,
      item: clip(r.item) || r.name || '',
      sample: r.sample ? clip(r.sample) : '',
      figma: link(r.node),
      value: '',
    })),
  };
}

function walkIds(node, out = []) {
  if (!node) return out;
  out.push(node.id);
  for (const child of node.children ?? []) walkIds(child, out);
  return out;
}

// One row per small section inside the template: the root's children, or the children of a single wrapper.
export function sectionBlocks(tree, fileKey = '') {
  const visible = (node) => (node?.children ?? []).filter((child) => child.visible !== false && child.type !== 'TEXT' && child.type !== 'LINE');
  let rows = visible(tree);
  if (rows.length === 1) {
    const inner = visible(rows[0]);
    if (inner.length >= 2) rows = inner;
  }
  return rows.map((node) => ({
    id: node.id,
    name: node.name || node.id,
    figma: fileKey ? figmaLink(fileKey, node.id) : '',
    ids: walkIds(node),
  }));
}
