// The result box is ordinary speech: "phần này là carousel, phần kia là form".
// Each piece is matched to a part of the frame. The person does not have to name the layer.

import { detectForms } from '../detect/rules/form.mjs';

const KINDS = [
  [/menu\s*slider|menu trượt|menu truot/i, 'menu-slider'],
  [/carousel|slider|slides?|trượt|truot|kéo ngang|keo ngang|băng chuyền|bang chuyen|vuốt|vuot/i, 'carousel'],
  [/biểu mẫu|bieu mau|ô nhập|o nhap|điền thông tin|dien thong tin|\bform\b/i, 'form'],
  [/accordion|faq|hỏi đáp|hoi dap|thu gọn|thu gon|xổ xuống|xo xuong/i, 'accordion'],
  [/chuyển tab|chuyen tab|\btabs?\b/i, 'tabs'],
  [/\bmenu\b/i, 'menu'],
  [/nút|\bnut\b|\bbutton\b/i, 'button'],
  [/ảnh|anh|\bhình\b|\bhinh\b|\bimage\b/i, 'flat-image'],
];

const STOP = new Set(['phần', 'phan', 'các', 'cac', 'này', 'nay', 'kia', 'đó', 'do', 'khác', 'khac', 'trên', 'tren', 'dưới', 'duoi', 'là', 'la', 'thành', 'thanh', 'cho', 'và', 'va', 'còn', 'con', 'của', 'cua', 'một', 'mot', 'cái', 'cai', 'những', 'nhung', 'với', 'voi', 'trong', 'khung', 'hàng', 'hang', 'thẻ', 'the']);

const LABEL = {
  carousel: 'slider', form: 'form', accordion: 'accordion', tabs: 'tab', menu: 'menu', 'menu-slider': 'menu slider',
  button: 'nút', 'flat-image': 'ảnh', semantic: 'khối',
};

const visible = (n) => (n.children ?? []).filter((c) => c.visible !== false);

function walk(n, parent, visit) {
  visit(n, parent);
  for (const c of visible(n)) walk(c, n, visit);
}

function find(tree, id) {
  let hit = null;
  walk(tree, null, (n) => { if (n.id === id) hit = n; });
  return hit;
}

function textsOf(n, out = []) {
  if (!n || n.visible === false) return out;
  if (n.type === 'TEXT' && n.text?.characters?.trim()) out.push(n.text.characters.trim());
  for (const c of visible(n)) textsOf(c, out);
  return out;
}

function blob(n) {
  return `${n.name ?? ''} ${n.componentSet ?? ''} ${textsOf(n).join(' ')}`.toLowerCase();
}

function wordsOf(text) {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !STOP.has(w) && !KINDS.some(([re]) => re.test(w)));
}

function kindsIn(text) {
  return KINDS.map(([re, kind]) => (re.test(text) ? kind : null)).filter(Boolean);
}

function kindOf(text) {
  return KINDS.find(([re]) => re.test(text))?.[1] ?? null;
}

function clausesOf(text) {
  // A comma or "và" inside one description ("Họ và Tên,.. là form") stays in that description.
  // It splits only when the sentence names more than one kind.
  return text.split(/[;\n]+/).flatMap((piece) => {
    const bit = piece.trim();
    if (!bit) return [];
    if (kindsIn(bit).length <= 1) return [bit];
    return bit.split(/,+|\s+và\s+|\s+còn\s+/i).flatMap((part) => part.split(/(?=\bphần\b|\bphan\b)/i).map((s) => s.trim()).filter(Boolean));
  }).filter(Boolean);
}

function isRow(n) {
  return n?.layout?.mode === 'HORIZONTAL' && n.layout.wrap !== true && visible(n).length >= 2;
}

function rowOf(node, parent) {
  if (isRow(node)) return node;
  if (isRow(parent)) return parent;
  return null;
}

function nextId(components) {
  const n = Math.max(0, ...components.map((c) => Number(String(c.id).slice(1)) || 0));
  return `d${n + 1}`;
}

function citeFor(node) {
  if (node.name != null) return [{ node: node.id, field: 'name', equals: node.name }];
  return [{ node: node.id, field: 'type', equals: node.type }];
}

function writeKind(det, node, kind, params) {
  const existing = det.components.find((c) => c.node === node.id);
  if (existing?.component === kind && existing.status === 'approved') return null;
  const entry = {
    ...(existing ?? { id: nextId(det.components) }),
    status: 'approved',
    source: 'ai',
    component: kind,
    node: node.id,
    level: 'E2',
    confidence: 'medium',
    cite: citeFor(node),
    evidence: `the result screen asked for ${kind} on "${node.name ?? node.id}"`,
    params: params ?? (existing?.component === kind ? (existing.params ?? {}) : {}),
    note: 'the result screen named this part',
  };
  if (existing) Object.assign(existing, entry);
  else det.components.push(entry);
  return { name: node.name || node.id, component: kind };
}

function parents(tree) {
  const map = new Map();
  walk(tree, null, (n, parent) => map.set(n.id, parent));
  return map;
}

function pickNamed(tree, hintWords) {
  if (!hintWords.length) return null;
  let best = null;
  let score = 0;
  let depth = -1;
  (function visit(n, d) {
    if (n !== tree) {
      const got = hintWords.reduce((sum, w) => sum + (blob(n).includes(w) ? 1 : 0), 0);
      if (got > 0 && (got > score || (got === score && d > depth))) { score = got; depth = d; best = n; }
    }
    for (const c of visible(n)) visit(c, d + 1);
  })(tree, 0);
  return best;
}

function pickDefault(tree, det, kind, used) {
  const forms = detectForms(tree);
  if (kind === 'form') return forms.map((f) => find(tree, f.node)).find((n) => n && !used.has(n.id)) ?? null;
  if (kind === 'carousel') {
    let row = null;
    walk(tree, null, (n) => {
      if (row || used.has(n.id) || !isRow(n)) return;
      const known = det.components.find((c) => c.node === n.id && c.status === 'approved');
      if (!known || known.component === 'semantic') row = n;
    });
    return row;
  }
  if (kind === 'accordion') {
    const known = det.components.find((c) => c.status === 'approved' && c.component === 'semantic' && !used.has(c.node) && find(tree, c.node)?.layout?.mode === 'VERTICAL');
    return known ? find(tree, known.node) : null;
  }
  const other = det.components.find((c) => c.status === 'approved' && c.component !== kind && !used.has(c.node));
  return other ? find(tree, other.node) : null;
}

export function describedParts(tree, detections) {
  return (detections?.components ?? []).filter((c) => c.status === 'approved').map((c) => {
    const node = find(tree, c.node);
    const text = node ? textsOf(node)[0] : '';
    return { kind: LABEL[c.component] || c.component, name: node?.name || c.node, text: text ? String(text).replace(/\s+/g, ' ').slice(0, 48) : '' };
  });
}

const fold = (s) => String(s ?? '').trim().toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ');

function destinationOf(text) {
  const explicit = String(text).match(/https?:\/\/\S+|mailto:\S+|tel:\S+/i);
  if (explicit) return explicit[0].replace(/[),.;]+$/, '');
  const domain = String(text).match(/\b(?:www\.)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?/i);
  if (domain && !/figma\.com/i.test(domain[0])) return `https://${domain[0].replace(/[),.;]+$/, '')}`;
  return '';
}

function nodesOf(tree, det, kind) {
  return det.components.filter((c) => c.status === 'approved' && c.component === kind).map((c) => find(tree, c.node)).filter(Boolean);
}

function pickAmong(nodes, words) {
  if (!nodes.length) return null;
  let best = null;
  let score = 0;
  for (const n of nodes) {
    const got = words.reduce((sum, w) => sum + (blob(n).includes(w) ? 1 : 0), 0);
    if (got > score) { score = got; best = n; }
  }
  return best ?? (nodes.length === 1 ? nodes[0] : null);
}

function entryOf(det, node, kind) {
  return det.components.find((c) => c.node === node.id && c.component === kind && c.status === 'approved');
}

// A sentence can ask for something other than a new component: where a button goes, what an image is, how fast a slider moves.
function followSentence(tree, det, note, applied) {
  const folded = fold(note);
  const words = wordsOf(note);
  const href = destinationOf(note);
  if (href && /nut|button|bam|mo |dan toi|link|dia chi|trang/.test(folded)) {
    const node = pickAmong(nodesOf(tree, det, 'button'), words);
    const entry = node && entryOf(det, node, 'button');
    if (entry) {
      entry.params = { ...(entry.params ?? {}), link: href };
      applied.push({ name: textsOf(node)[0] || node.name || node.id, component: 'button', detail: href });
    }
  }
  if (/anh|hinh|image/.test(folded)) {
    const node = pickAmong(nodesOf(tree, det, 'flat-image'), words);
    const entry = node && entryOf(det, node, 'flat-image');
    const said = note.match(/(?:là|la)\s+(.+)$/i)?.[1]?.trim().replace(/[.,]+$/, '');
    const decorative = /trang tri|khong can mo ta|de trong/.test(folded);
    const caption = decorative ? '' : (said && kindOf(said) !== 'flat-image' ? said : '');
    if (entry && (decorative || caption)) {
      entry.params = { ...(entry.params ?? {}), alt: caption };
      applied.push({ name: node.name || node.id, component: 'flat-image', detail: decorative ? 'trang trí' : caption });
    }
  }
  let timing = null;
  if (/khong tu|dung tu|dung chay|chi khi bam|khong chay|tu chay|khong cho .* chay|dung cho .* chay/.test(folded) && !/\d/.test(note)) timing = { on: false };
  else {
    const seconds = folded.match(/(\d+(?:\.\d+)?)\s*giay/);
    if (seconds && +seconds[1] > 0 && +seconds[1] <= 120) timing = { on: true, seconds: +seconds[1] };
  }
  if (timing) {
    const node = pickAmong(nodesOf(tree, det, 'carousel'), words);
    const entry = node && entryOf(det, node, 'carousel');
    if (entry) {
      entry.params = {
        ...(entry.params ?? {}),
        autoplay: timing.on,
        settings: { ...(entry.params?.settings ?? {}), ...(timing.on ? { autoplay: true, interval: Math.round(timing.seconds * 1000) } : { autoplay: false }) },
      };
      applied.push({ name: node.name || node.id, component: 'carousel', detail: timing.on ? `${timing.seconds} giây` : 'không tự chạy' });
    }
  }
}

export function applyFeedback(tree, detections, text) {
  const det = structuredClone(detections ?? { components: [] });
  const note = String(text ?? '').trim();
  if (!note) return { detections: det, applied: [], unknown: false };
  const known = !!kindOf(note);
  const forms = detectForms(tree);
  const formByNode = new Map(forms.map((f) => [f.node, f]));
  const up = parents(tree);
  const used = new Set();
  const applied = [];
  for (const clause of clausesOf(note)) {
    const split = clause.match(/^(.*?)(?:\s+là\s+|\s+is\s+|\s+thành\s+)(.+)$/i);
    // "slider chạy mỗi 4 giây" names the slider; it does not ask for a new one. Only "là slider" does.
    const about = destinationOf(clause) || /\d+\s*giây|tự chạy|đừng chạy|giây/i.test(clause);
    const kind = kindOf(split ? split[2] : (about ? '' : clause));
    if (!kind) continue;
    const hintWords = wordsOf(split ? split[1] : clause.replace(KINDS.find(([re]) => re.test(clause))?.[0] ?? '', ''));
    let node = pickNamed(tree, hintWords) ?? pickDefault(tree, det, kind, used);
    if (!node) continue;
    if (kind === 'carousel') node = rowOf(node, up.get(node.id)) ?? node;
    if (kind === 'form') {
      let host = node;
      while (host && !formByNode.has(host.id)) host = up.get(host.id);
      if (!host) host = forms.map((f) => find(tree, f.node)).find((n) => n && (n.id === node.id || textsOf(n).some((t) => blob(node).includes(t.toLowerCase().slice(0, 12)))));
      if (host) node = host;
    }
    if (used.has(node.id)) continue;
    const params = kind === 'form' ? formByNode.get(node.id)?.params : undefined;
    const cite = kind === 'form' && formByNode.get(node.id)?.cite;
    const written = writeKind(det, node, kind, params);
    if (cite && written) {
      const entry = det.components.find((c) => c.node === node.id);
      entry.cite = cite;
    }
    if (!written) continue;
    used.add(node.id);
    applied.push(written);
  }
  followSentence(tree, det, note, applied);
  return { detections: det, applied, unknown: !known && !applied.length };
}
