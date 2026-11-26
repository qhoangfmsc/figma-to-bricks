// Confirm step of /generate-template-from-figma: one block per component, one labelled field per thing the owner can change.
// A component the rules already asked about keeps those questions. One the rules skipped still gets a field,
// so a missed question is not a blank screen.
import { findNode, firstText } from '../../write-bricks/components/helpers.mjs';
import { GROUPS, itemHeading, keyOf, figmaLink } from '../../missing-content/index.mjs';
import { MISSING } from '../../missing-content/choices.mjs';
import { unclaimedRepeats } from '../../recognize-parts/structure.mjs';
import { PartKind, isKind, isSignal, isPaginationHint, SIGNAL_RULES } from '../../recognize-parts/kinds.mjs';

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
  pattr: 'Tag thì giữ. data-product-category thì viết nhóm sản phẩm. Để trống là không gắn attribute đó.',
  compare: 'Bắt buộc. Ghi id bảng so sánh, ví dụ test-section. Không có id thì không dựng.',
};
const KIND = {
  [PartKind.BUTTON]: 'Nút',
  [PartKind.CHECKBOX]: 'Checkbox',
  [PartKind.SWITCH]: 'Switch',
  [PartKind.READMORE]: 'Xem thêm',
  [PartKind.SEMANTIC]: 'Khối',
  [PartKind.ACCORDION]: 'Accordion',
  [PartKind.TABS]: 'Tab',
  [PartKind.TAB_SWITCH]: 'Tabs Component',
  [PartKind.MENU]: 'Menu',
  [PartKind.MENU_SLIDER]: 'Menu slider',
  [PartKind.CAROUSEL]: 'Slider',
  [PartKind.FORM]: 'Form',
  [PartKind.LINK]: 'Link',
  [PartKind.FLAT_IMAGE]: 'Ảnh',
  [PartKind.ICON_LIST]: 'Danh sách icon',
  [PartKind.BREADCRUMBS]: 'Breadcrumb',
  [PartKind.COUNTER]: 'Số',
  [PartKind.COUNTDOWN]: 'Đếm ngược',
  [PartKind.TOOLTIP]: 'Tooltip',
  [PartKind.TOOLTIP_STYLE]: 'Tooltip',
  [PartKind.SCROLL]: 'Scroll',
  [PartKind.PRICE_TABLE]: 'price-table',
  [PartKind.COMPARE_TABLE]: 'compare-table',
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
  if (isKind(component, PartKind.READMORE) && component.params?.button) {
    const label = firstText(findNode(tree, component.params.button))?.text?.characters;
    if (label) return clip(label);
  }
  const text = node && firstText(node)?.text?.characters;
  if (isKind(component, PartKind.BUTTON) || isKind(component, PartKind.LINK)) return clip(text || node?.name || component.node);
  return clip(node?.name || component.node);
}

function withTitle(field, name, kind) {
  return { ...field, title: itemHeading(field.group, field.caption || name, kind) };
}

function fallbackField(component, readmoreButtons) {
  if (isKind(component, PartKind.BUTTON) && readmoreButtons.has(component.node)) {
    return { group: 'act' };
  }
  if (isKind(component, PartKind.READMORE)) return { group: 'expand' };
  if (isKind(component, PartKind.SEMANTIC)) return { group: 'keep' };
  return null;
}

function detailOf(tree, component) {
  if (!isKind(component, PartKind.FORM)) return '';
  const labels = (component.params?.fields ?? []).map((f) => clip(f.label || f.placeholder)).filter(Boolean);
  const submit = findNode(tree, component.params?.submit);
  const button = clip(submit && firstText(submit)?.text?.characters);
  return [labels.join(', '), button ? `nút ${button}` : ''].filter(Boolean).join(' · ');
}

function childFacts(tree, component) {
  const kids = SIGNAL_RULES[component.component]?.childComponent ?? [];
  return kids.map((child) => {
    const id = component.params?.[child.param];
    const label = child.label || child.id;
    if (!id) return `${label}: không`;
    const node = findNode(tree, id);
    const name = clip(node?.name || '');
    const count = child.id === 'tabs_bar' && Number.isInteger(component.params?.tabsActive)
      ? ` — ${component.params.tabsActive} đang chọn, ${component.params.tabsIdle ?? 0} nghỉ`
      : '';
    return `${label}: \`${id}\`${name ? ` ${name}` : ''}${count}`;
  });
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

// Fields for components the picture already named. The tree supplies the size and the paint.
// A code detection is not a component in the plan.
export function screenParts(tree, components, questions, fileKey) {
  const approved = (components ?? []).filter((c) => c.status === 'approved' && !isSignal(c.component) && !isPaginationHint(c));
  const readmoreButtons = new Set(approved.filter((c) => isKind(c, PartKind.READMORE)).map((c) => c.params?.button).filter(Boolean));
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
    if (isKind(c, PartKind.FORM)) fields = fields.filter((field) => field.group !== 'confirm');
    if (!fields.length) {
      const fb = fallbackField(c, readmoreButtons);
      if (fb) fields = [withTitle(fieldOf({ ...fb, node: c.node, label: '' }, fileKey), name, kind)];
    }
    const note = isKind(c, PartKind.TABS) || isKind(c, PartKind.TAB_SWITCH) ? TAB_NOTE : isKind(c, PartKind.CAROUSEL) ? SLIDER_NOTE : '';
    const detail = detailOf(tree, c);
    const children = childFacts(tree, c);
    const ids = walkIds(findNode(tree, c.node) ?? { id: c.node });
    return { kind, name, node: c.node, figma: figmaLink(fileKey, c.node), ids, ...(detail && { detail }), ...(note && { note }), ...(children.length && { children }), fields };
  });
  for (const q of loose) {
    if (q.group === 'pattr') {
      const host = parts.find((part) => (part.fields ?? []).some((field) => field.key === keyOf('price', q.node) || field.key === keyOf('compare', q.node)));
      if (host) {
        host.fields.push(withTitle(fieldOf(q, fileKey), q.label, host.kind));
        continue;
      }
    }
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
    found: (components ?? []).filter((c) => c.status === 'approved' && !isSignal(c.component)).map(line),
    open: (components ?? []).filter((c) => c.status === 'proposed' && !isSignal(c.component) && !isPaginationHint(c)).map((c) => ({
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
