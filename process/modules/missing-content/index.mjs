// THE PLAN: the one document the owner reads and fills before anything is built (owner decision 2026-10-29: "after you look at Figma
// and detect, ask only what you really need: values to list, content to fill in, short and clear, with a link to the place in Figma;
// once I confirm, run to the end").
//
//   decide() records a question wherever the build needs content the Figma file does not contain   -> questions[] ({ group, node, label })
//   renderPlan()   groups them per section into plan-<node>.md: a heading in plain words, one line of explanation, a Figma link, and one
//                  line per value:   - <label> ([Figma](url)) `<group>:<figma node id>`: <value the owner types>
//   parsePlan()    reads the file back (the owner edits it by hand)
//   the confirmation is the line `Xác nhận: không` -> `Xác nhận: có` of the same file (loadConfirmed / planProblems); a build uses it up (consumeConfirmation)
//   applyAnswers() puts each value on its node after decide() ran. Answers are keyed by the Figma node id, never stored in the entries
//                  that decide() regenerates on every run, so they survive a re-run.
// A blank value is not an error: the safe default stays (link "#", alt "") and the item is listed again in the report.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readSync } from '../write-bricks/components/accordion.mjs';
import { tabInventory } from '../write-bricks/components/tabs.mjs';
import { switchInventory, tabQuestions, tabTitles } from '../write-bricks/components/tab-switch.mjs';
import { firstText } from '../write-bricks/components/helpers.mjs';
import { parseFigmaUrl } from '../read-figma/url.mjs';
import { matchTrees } from '../breakpoints/match.mjs';
import { resolveWorkspace } from '../common/workspace.mjs';
import { choiceOf, MISSING, REPEAT_COMPONENT } from './choices.mjs';
import tabsComponent from '../write-bricks/components/tabs.mjs';
import tabSwitch from '../write-bricks/components/tab-switch.mjs';

export const keyOf = (group, node) => `${group}:${node}`;
export const figmaLink = (fileKey, node) => `https://www.figma.com/design/${fileKey}/x?node-id=${String(node).replaceAll(':', '-')}`;
const clean = (s) => String(s ?? '').replace(/[`\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();

// what each kind of question says, and how its value is checked. `apply` puts the value in the workspace (see applyAnswers).
export const GROUPS = {
  link: {
    title: (n) => `Link của ${n} nút / mục menu`,
    field: 'Link của nút',
    heading: (name, kind) => (kind === 'Menu' ? `Bấm ${name || 'mục này'} thì mở trang nào?` : `Bấm nút ${name || 'này'} thì mở trang nào?`),
    summary: 'Chưa có trang thì ghi chưa có. Có rồi thì viết địa chỉ, ví dụ vietnix.vn/bang-gia.',
    value: 'chưa có địa chỉ',
    check: (v) => (v.length <= 500 ? null : 'dài quá 500 ký tự'),
  },
  type: {
    title: () => 'Loại template',
    field: 'Loại template',
    heading: () => 'Template này thuộc loại nào?',
    summary: 'Mặc định là section. Đổi thành header, footer, popup, content, archive, search hoặc error khi đúng. Giữ section nếu chưa chắc.',
    value: 'section',
    check: (v) => (v.length <= 80 ? null : 'ngắn hơn 80 ký tự'),
  },
  video: {
    title: (n) => `Địa chỉ video của ${n} khung`,
    field: 'Địa chỉ video',
    heading: (name) => `${name || 'Khung này'} phát video nào?`,
    summary: 'Dán link YouTube, Vimeo, hoặc file. Để trống thì giữ ảnh Figma đã vẽ.',
    value: 'chưa có địa chỉ video',
    check: (v) => (v.length <= 500 ? null : 'dài quá 500 ký tự'),
  },
  answer: {
    title: (n) => `Câu trả lời cho ${n} câu hỏi FAQ`,
    field: 'Câu trả lời cho câu hỏi FAQ',
    heading: (name) => `Mở ${name || 'mục này'} thì trả lời thế nào?`,
    summary: 'Viết câu trả lời. Để trống thì bấm vào chưa có chữ. Nhiều câu thì xuống dòng.',
    value: 'chưa có câu trả lời',
    check: (v) => (v.length <= 4000 ? null : 'dài quá 4000 ký tự'),
  },
  pane: {
    title: (n) => `Nội dung của ${n} tab`,
    field: 'Nội dung của tab',
    heading: (name) => name || 'Tab này bên trong có gì?',
    summary: 'Đúng rồi thì để nguyên. Muốn đổi thì dán link khung của tab đó, hoặc viết nội dung nếu tab chưa vẽ gì.',
    value: 'chưa có nội dung',
    check: (v) => readPane(v).why ?? null,
  },
  autoplay: {
    title: (n) => `Tự chuyển slide của ${n} slider`,
    field: 'Tự chuyển slide',
    heading: (name) => `${name || 'Phần này'} tự chạy không?`,
    summary: 'Đang để tự chạy mỗi 3 giây. Viết số giây nếu muốn chậm hơn hoặc nhanh hơn, hoặc ghi đừng tự chạy nếu chỉ chạy khi bấm.',
    value: 'tự chuyển mỗi 3 giây',
    check: (v) => (String(v ?? '').length <= 200 ? null : 'ngắn hơn 200 ký tự'),
  },
  loop: {
    title: (n) => `Lặp vòng của ${n} slider`,
    field: 'Lặp vòng',
    heading: (name) => `Lặp vòng của ${name}`,
    summary: 'Slider luôn chạy vòng. Dòng này còn để file Plan cũ vẫn đọc được; tool không hỏi nữa.',
    value: 'quay lại slide đầu',
    options: ['dừng ở slide cuối', 'quay lại slide đầu'],
    check: (v) => (v.length <= 200 ? null : 'ngắn hơn 200 ký tự'),
  },
  count: {
    title: (n) => `Tổng số item của ${n} slider`,
    field: 'Tổng số item',
    heading: (name) => `${name || 'Phần này'} có bao nhiêu mục?`,
    summary: 'Số sẵn là số mục đang vẽ. Viết số khác nếu bộ thật nhiều hơn, ví dụ 8 cái.',
    value: '',
    check: (v) => (v.length <= 80 ? null : 'ngắn hơn 80 ký tự'),
  },
  items: {
    title: (n) => `Bộ item của ${n} slider`,
    field: 'Bộ item',
    heading: (name) => `${name || 'Phần này'} lấy các mục ở đâu?`,
    summary: 'Để trống là dùng các mục đang có. Muốn đủ hơn thì dán link khung chứa hết các mục, từ trái sang phải.',
    value: '',
    check: (v) => (readItems(v).kind === 'bad' && /figma\.com/i.test(v) ? readItems(v).why : v.length <= 500 ? null : 'dài quá 500 ký tự'),
  },
  mobileform: {
    title: (n) => `Mobile của ${n} slider`,
    field: 'Mobile của slider',
    heading: (name) => `Mobile của ${name || 'slider này'} dựng thế nào?`,
    summary: 'Chỉ có khung desktop thì mobile vẫn là slider. Có link mobile thì dựng đúng thứ khung đó vẽ, kể cả khi không phải slider. Không tự đổi slider thành hàng kéo.',
    value: 'mobile vẫn là slider',
    check: (v) => (v.length <= 500 ? null : 'dài quá 500 ký tự'),
  },
  confirm: {
    title: (n) => `Xác nhận ${n} khối mà tool chỉ đoán được là accordion`,
    field: 'Xác nhận accordion',
    heading: (name) => `${name || 'Khối này'} có phải mục bấm để mở không?`,
    summary: 'Chưa rõ đây có phải câu hỏi bấm ra câu trả lời hay không. Giữ nguyên nếu không phải.',
    value: 'giữ nguyên khối',
    options: ['giữ nguyên khối', 'làm accordion'],
    check: (v) => (v.length <= 200 ? null : 'ngắn hơn 200 ký tự'),
  },
  sync: {
    title: (n) => `Đồng bộ ${n} accordion`,
    field: 'Đồng bộ accordion',
    heading: (name) => `Các mục trong ${name || 'phần này'} cho giống nhau không?`,
    summary: 'Các mục đang lệch nhau. Để giống nhau, hoặc ghi giữ nguyên, chỉ giống phần chữ, đừng đổi icon.',
    value: 'làm các mục giống nhau',
    check: (v) => (v.length <= 500 ? null : 'dài quá 500 ký tự'),
  },
  alt: {
    title: (n) => `Mô tả (alt) của ${n} ảnh nội dung`,
    field: 'Ảnh',
    heading: (name) => {
      const quoted = /["«]([^"»]+)["»]/.exec(String(name ?? ''));
      const who = quoted ? quoted[1].trim() : plainName(name);
      return who ? `Ghi alt cho ảnh "${who}"` : 'Ghi alt cho ảnh này';
    },
    summary: 'Ảnh trang trí thì để nguyên. Ảnh có nghĩa thì viết một câu ngắn, ví dụ logo Vietnix.',
    value: 'ảnh chỉ để trang trí',
    check: (v) => (v.length <= 160 ? null : 'viết ngắn một câu thôi'),
  },
  act: {
    title: (n) => `Hành động của ${n} nút`,
    field: 'Hành động của nút',
    heading: (name) => `Bấm ${name || 'nút này'} thì chuyện gì xảy ra?`,
    summary: 'Mặc định là hiện nốt chữ bị khuất. Muốn mở một trang thì viết địa chỉ trang đó.',
    value: 'Bấm để hiện hết chữ',
    options: ['Bấm để hiện hết chữ', 'Bấm để mở một địa chỉ'],
    linkOption: 'Bấm để mở một địa chỉ',
    check: (v) => (/figma\.com/i.test(v) ? 'đây là link bản vẽ, hãy viết địa chỉ trang web' : v.length <= 500 ? null : 'dài quá 500 ký tự'),
  },
  expand: {
    title: (n) => `Nội dung khi mở của ${n} phần`,
    field: 'Nội dung khi mở',
    heading: (name) => `Bấm ${name || 'xem thêm'} thì hiện thêm chữ gì?`,
    summary: 'Để trống là hiện nốt chữ đang bị khuất. Viết thêm câu, hoặc dán link khung đã mở hết.',
    value: '',
    check: (v) => readExpand(v).why ?? null,
  },
  tabopen: {
    title: (n) => `Tab đang mở của ${n} cụm`,
    field: 'Tab đang mở',
    heading: (name) => `Tab nào trong ${name || 'phần này'} đang mở?`,
    summary: 'Chưa rõ tab nào đang mở. Viết đúng tên tab đó. Để trống thì chưa gắn.',
    value: '',
    check: (v) => (String(v ?? '').trim().length <= 80 ? null : 'tên tab ngắn hơn 80 ký tự'),
  },
  expect: {
    title: () => 'Góp ý component',
    field: 'Góp ý',
    heading: () => 'Khối này phải là component nào?',
    summary: 'Để trống là giữ cách tool đang gắn.',
    value: '',
    check: (v) => (v.length <= 200 ? null : 'ngắn hơn 200 ký tự'),
  },
  note: {
    title: () => 'Góp ý thêm',
    field: 'Góp ý thêm',
    heading: () => 'Góp ý thêm',
    summary: 'Ghi thêm điều tool chưa hỏi.',
    value: '',
    check: (v) => (v.length <= 2000 ? null : 'dài quá 2000 ký tự'),
  },
  tabdata: {
    title: (n) => `Nhóm item của ${n} tab`,
    field: 'Nhóm item',
    heading: (name) => `Các mục của ${name || 'tab này'} thuộc nhóm nào?`,
    summary: 'Có vài nhóm mục giống nhau. Viết tên nhóm của tab đang mở. Để trống thì chưa gắn.',
    value: '',
    check: (v) => (String(v ?? '').trim().length <= 80 ? null : 'tên nhóm ngắn hơn 80 ký tự'),
  },
  keep: {
    title: (n) => `Cách dựng của ${n} khối`,
    field: 'Cách dựng của khối',
    heading: (name) => `Khối ${name || 'này'} giữ nguyên như bản vẽ`,
    summary: 'Khối này dựng y như bản vẽ.',
    value: 'Dựng thành một khối tĩnh',
    options: ['Dựng thành một khối tĩnh'],
    check: (v) => (v.length <= 200 ? null : 'ngắn hơn 200 ký tự'),
  },
  part: {
    title: (n) => `Component đã nhận của ${n} phần`,
    field: 'Component đã nhận',
    heading: (name) => name || 'Phần này',
    summary: 'Tool đã gắn component này. Viết một câu nếu không dựng. Để trống là dựng.',
    value: '',
    check: (v) => (v.length <= 200 ? null : 'ngắn hơn 200 ký tự'),
  },
  guess: {
    title: (n) => `Component chưa chắc của ${n} phần`,
    field: 'Component chưa chắc',
    heading: (name) => name || 'Phần này',
    summary: 'Chỉ thấy hình dạng. Viết một câu nếu muốn gắn hoặc bỏ. Để trống là chưa gắn.',
    value: '',
    check: (v) => (v.length <= 200 ? null : 'ngắn hơn 200 ký tự'),
  },
  repeat: {
    title: (n) => `Nhóm lặp chưa gắn của ${n} phần`,
    field: 'Nhóm lặp',
    heading: (name) => name || 'Nhóm này',
    summary: 'Các mục giống nhau mà tool chưa gọi tên. Viết nhóm này là gì. Để trống là chưa gắn.',
    value: '',
    check: (v) => (v.length <= 200 ? null : 'ngắn hơn 200 ký tự'),
  },
};

const fold = (s) => String(s ?? '').trim().toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ');

function plainName(name) {
  const who = String(name ?? '').replace(/^["«\s]+|["»\s]+$/g, '').replace(/^ảnh\s+/i, '').trim();
  if (!who || /^(group|frame|image|img|rectangle|vector|ellipse)\b/i.test(who) || /\d{5,}/.test(who)) return '';
  return who;
}

export function paneQuestionLabel(row) {
  const name = String(row.label ?? '').slice(0, 40);
  if (row.active && row.drawn) return `${name} đang mở, đang có: ${row.drawn}. Để nguyên cũng được, hoặc dán link khung khác.`;
  if (!row.drawn) return `${name} chưa vẽ nội dung. Dán link khung của tab này, hoặc viết nội dung vào.`;
  return `${name} đang có: ${row.drawn}`;
}

// What the tab box means. Empty keeps the pane Figma already drew. A Figma link is that tab's full frame.
// Typed text fills a tab Figma did not draw; it does not replace a card that is already in the frame.
export function readPane(v) {
  const text = String(v ?? '').trim();
  const folded = fold(text);
  if (!text || folded === 'chua co noi dung' || folded === 'dung noi dung dang ve' || folded === 'dung noi dung dang co') return { kind: 'keep' };
  if (/figma\.com/i.test(text)) {
    const url = text.split(/\s+/)[0];
    try {
      const ref = parseFigmaUrl(url);
      return { kind: 'figma', url, fileKey: ref.fileKey, nodeId: ref.nodeId };
    } catch {
      return { kind: 'bad', why: 'link này chưa chỉ đúng một khung. Hãy copy link ngay trên khung đó.' };
    }
  }
  if (text.length > 4000) return { kind: 'bad', why: 'dài quá 4000 ký tự' };
  return { kind: 'text', text };
}

// What the "Nội dung khi mở" box means. Empty and the old one-line defaults keep the clipped text.
// A Figma link is the expanded frame. Anything else is extra copy shown only after the click.
export function readExpand(v) {
  const text = String(v ?? '').trim();
  if (!text) return { kind: 'keep' };
  const folded = fold(text);
  if (/^(không|khong|no)$/i.test(text) || folded === 'dung chu dang bi cat' || folded === 'dung chu da co trong khung, khong can link') return { kind: 'keep' };
  if (/figma\.com/i.test(text)) {
    const url = text.split(/\s+/)[0];
    try {
      const ref = parseFigmaUrl(url);
      return { kind: 'figma', url, fileKey: ref.fileKey, nodeId: ref.nodeId };
    } catch {
      return { kind: 'bad', why: 'link này chưa chỉ đúng một khung. Hãy copy link ngay trên khung đã mở hết.' };
    }
  }
  if (text.length > 8000) return { kind: 'bad', why: 'dài quá 8000 ký tự' };
  return { kind: 'text', text };
}

// What the "Bộ item" box means. Empty keeps the slides drawn in the frame. A Figma link is the full set, in order.
export function readItems(v) {
  const text = String(v ?? '').trim();
  if (!text) return { kind: 'keep' };
  const folded = fold(text);
  if (folded === 'dung item trong khung' || folded === 'dung cac item trong khung') return { kind: 'keep' };
  if (/figma\.com/i.test(text)) {
    const url = text.split(/\s+/)[0];
    try {
      const ref = parseFigmaUrl(url);
      return { kind: 'figma', url, fileKey: ref.fileKey, nodeId: ref.nodeId };
    } catch {
      return { kind: 'bad', why: 'link này chưa chỉ đúng một khung. Hãy copy link ngay trên khung chứa các mục.' };
    }
  }
  return { kind: 'bad', why: 'để trống để dùng các mục đang có, hoặc dán link khung chứa đủ mục' };
}

// Default is on: Bricks' own interval placeholder is 3000ms (slider-nested.php). "không tự chuyển" is the only off switch.
export function readAutoplay(v) {
  const folded = fold(v);
  if (/^(khong|no|khong tu chuyen)$/.test(folded)) return { on: false };
  const n = String(v ?? '').match(/(\d+(?:\.\d+)?)/);
  if (n && +n[1] > 0 && +n[1] <= 120) return { on: true, seconds: +n[1] };
  return { why: 'viết số giây, ví dụ 5 giây, hoặc ghi đừng tự chạy' };
}

// The chat filters a sentence into a choice before build. This keeps the words as typed.
export function hearAnswers(answers) {
  const out = {};
  for (const [key, value] of Object.entries(answers ?? {})) {
    const text = String(value ?? '').trim();
    if (text) out[key] = text;
  }
  return out;
}

export function itemHeading(group, name, kind) {
  const who = String(name ?? '').trim().replace(/^["«]([\s\S]*)["»]$/, '$1').trim();
  const line = GROUPS[group]?.heading;
  if (line) return line(who, kind).replace(/\s+/g, ' ').trim();
  const base = String(GROUPS[group]?.title?.(1) || group).replace(/ 1 /, ' ');
  return who ? `${base} ${who}` : base;
}

export function groupQuestions(questions) {
  const by = new Map();
  for (const q of questions) {
    if (!GROUPS[q.group]) continue;
    const g = by.get(q.group) ?? [];
    if (!g.some((x) => x.node === q.node)) g.push(q);
    by.set(q.group, g);
  }
  return [...by].map(([group, items]) => ({ group, items }));
}

// model = { title, fileKey, nodeId, url, sections: [{ name, id, build: string, decided: string[], questions: [] }] }
export function renderPlan(model, answers = {}) {
  const out = [];
  let n = 0;
  const total = model.sections.reduce((a, s) => a + s.questions.length, 0);
  out.push(`# Plan: ${model.title}`, '',
    `Tạo bởi \`process/auto.mjs\` ngày ${new Date().toISOString().slice(0, 10)}. Đọc từng heading, điền giá trị vào cuối các dòng có \`khoá\` (để trống = dùng mặc định an toàn).`,
    'Điền xong, đổi dòng bên dưới thành `Xác nhận: có` rồi nhắn chạy tiếp. Lần chạy chỉ dựng theo các quyết định trong file này. Chỗ chưa điền giữ mặc định. Lần chạy không sửa code.', '',
    'Xác nhận: không', '',
    '## Tóm tắt', '', '| # | Section | Link Figma | Sẽ build thành | Cần điền |', '|---|---|---|---|---|',
    ...model.sections.map((s, i) => `| ${i + 1} | ${s.name} | [mở](${figmaLink(model.fileKey, s.id)}) | ${s.build || 'block'} | ${s.questions.length ? s.questions.length + ' nhóm' : '-'} |`), '',
    total ? `Tổng cộng **${total} nhóm câu hỏi**.` : 'Không có gì cần anh điền; xác nhận để bắt đầu build.', '');
  model.sections.forEach((s, i) => {
    out.push(`## Section ${String(i + 1).padStart(2, '0')} — ${s.name}`, '', `- Figma: [mở section](${figmaLink(model.fileKey, s.id)})`, `- Sẽ build thành: ${s.build || 'block'}`);
    if (s.decided?.length) out.push(`- Đã tự quyết, không cần hỏi: ${s.decided.join('; ')}`);
    out.push('');
    const line = (group, item, fallback) => {
      const k = keyOf(group, item.node);
      return `- ${clean(item.label)} ([Figma](${figmaLink(model.fileKey, item.node)})) \`${k}\`: ${answers[k] ?? item.value ?? fallback}`;
    };
    if (s.found?.length) {
      out.push('### Đã nhận', '', 'Tool đã gắn các component này. Viết một câu nếu không dựng. Để trống là dựng.', '');
      for (const item of s.found) out.push(line('part', item, ''));
      out.push('');
    }
    if (s.open?.length) {
      out.push('### Chưa chắc', '', 'Chỉ thấy hình dạng. Viết một câu nếu muốn gắn hoặc bỏ. Để trống là chưa gắn.', '');
      for (const item of s.open) out.push(line('guess', item, ''));
      out.push('');
    }
    if (s.repeats?.length) {
      out.push('### Nhóm lặp chưa gắn', '', 'Các mục giống nhau mà tool chưa gọi tên. Viết nhóm này là gì. Để trống là chưa gắn.', '');
      for (const item of s.repeats) out.push(line('repeat', item, ''));
      out.push('');
    }
    if (!s.questions.length && !s.found?.length && !s.open?.length && !s.repeats?.length) { out.push('Không có gì cần điền ở section này.', ''); return; }
    if (!s.questions.length) return;
    for (const { group, items } of s.questions) {
      n++;
      out.push(`### [Q${n}] ${GROUPS[group].title(items.length)}`, '', GROUPS[group].summary, '');
      for (const q of items) {
        const k = keyOf(group, q.node);
        out.push(`- ${clean(q.label)} ([Figma](${figmaLink(model.fileKey, q.node)})) \`${k}\`: ${answers[k] ?? q.value ?? ''}`);
      }
      out.push('');
    }
  });
  return out.join('\n');
}

// every `- label … \`key\`: value` line; a value may continue on lines indented by two spaces
export function parsePlan(md) {
  const answers = {};
  let cur = null;
  for (const line of md.split(/\r?\n/)) {
    const m = /^- (?:(?!`).)*`([^`]+)`:[ \t]?(.*)$/.exec(line);
    if (m) { cur = m[1]; answers[cur] = m[2].trim(); continue; }
    if (cur && /^ {2,}\S/.test(line)) { answers[cur] = `${answers[cur]}\n${line.trim()}`.trim(); continue; }
    cur = null;
  }
  return answers;
}

export const filled = (answers) => Object.fromEntries(Object.entries(answers).filter(([, v]) => v !== ''));

export function validateAnswers(answers) {
  const problems = [];
  for (const [k, v] of Object.entries(filled(answers))) {
    const group = k.split(':')[0];
    const why = GROUPS[group]?.check?.(v);
    if (!GROUPS[group]) problems.push(`\`${k}\`: loại câu hỏi lạ`);
    else if (why) problems.push(`${GROUPS[group].field}: ${why}`);
  }
  return problems;
}

export const planPaths = (dir, nodeKey) => ({ md: join(dir, `plan-${nodeKey}.md`) });

// the answers the owner has already typed, kept when the file is generated again so a re-run never wipes them
export function readAnswers(dir, nodeKey) {
  const { md } = planPaths(dir, nodeKey);
  return existsSync(md) ? parsePlan(readFileSync(md, 'utf8')) : {};
}

export function writePlan(dir, nodeKey, model) {
  const { md } = planPaths(dir, nodeKey);
  writeFileSync(md, renderPlan(model, readAnswers(dir, nodeKey)));
  return md;
}

// The confirmation is ONE line of the file the owner already edits: `Xác nhận: không` -> `Xác nhận: có`. No command, no second place.
const FLAG = /^Xác nhận:[ \t]*(.*)$/m;
const isYes = (v) => /^(có|co|yes)$/i.test(String(v ?? '').trim());
const flagged = (md) => isYes(FLAG.exec(md)?.[1]);
const setFlag = (md, yes) => (FLAG.test(md) ? md.replace(FLAG, `Xác nhận: ${yes ? 'có' : 'không'}`) : md);

// what is wrong with a file the owner marked `Xác nhận: có` (a link that is not a link...): the run stops and says so instead of building on it
export function planProblems(dir, nodeKey) {
  const { md } = planPaths(dir, nodeKey);
  if (!existsSync(md)) return [];
  const text = readFileSync(md, 'utf8');
  return flagged(text) ? validateAnswers(parsePlan(text)) : [];
}

export function confirmPlan(dir, nodeKey) {
  const { md } = planPaths(dir, nodeKey);
  if (!existsSync(md)) throw new Error(`no plan to confirm: ${md} does not exist, run node process/auto.mjs first`);
  const text = readFileSync(md, 'utf8');
  const answers = parsePlan(text);
  const problems = validateAnswers(answers);
  if (problems.length) throw new Error(`cannot confirm, fix first:\n  - ${problems.join('\n  - ')}`);
  writeFileSync(md, setFlag(text, true));
  return { confirmedAt: new Date().toISOString(), answered: Object.keys(filled(answers)).length, total: Object.keys(answers).length };
}

// A confirmation is for ONE build: once the build has run the line goes back to `không`, so the next run of the same link shows the Plan again (the values typed so far
// stay in the file, the owner only has to say "ok" or change something).
export function consumeConfirmation(dir, nodeKey) {
  const { md } = planPaths(dir, nodeKey);
  if (existsSync(md)) writeFileSync(md, setFlag(readFileSync(md, 'utf8'), false));
}

// the confirmed answers, or null when the file is not marked `Xác nhận: có` (or a value is invalid)
export function loadConfirmed(dir, nodeKey) {
  const { md } = planPaths(dir, nodeKey);
  if (!existsSync(md)) return null;
  const text = readFileSync(md, 'utf8');
  if (!flagged(text)) return null;
  const answers = parsePlan(text);
  return validateAnswers(answers).length ? null : filled(answers);
}

const kids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const tabKind = (node) => (node && tabsComponent.check(node, { params: {} }).ok ? 'tabs' : node && tabSwitch.check(node, { params: {} }).ok ? 'tab-switch' : 'tabs');
const hasDescendant = (n, id) => kids(n).some((c) => c.id === id || hasDescendant(c, id));
const deep = (o, path, v) => { let t = o; path.slice(0, -1).forEach((k) => { t = t[k] ??= {}; }); t[path.at(-1)] = v; };

// Put the answers on the workspace after decide(). A value for a node that is no longer there is reported, not an error.
export function applyAnswers(ws, answers) {
  const det = ws.readJson('detections.json');
  const ov = ws.readJson('overrides.json', { nodes: {} });
  const tree = ws.readJson('tree.json', null);
  const findIn = (id) => { const f = (n) => (n.id === id ? n : kids(n).map(f).find(Boolean)); return tree ? f(tree) : null; };
  const of = (component, node) => det.components.filter((x) => x.component === component && x.node === node);
  // the component of this kind whose subtree holds the node (an FAQ item sits under its accordion, a menu label under its menu row)
  const holder = (component, id, direct) => det.components.find((c) => c.component === component && c.status !== 'rejected' && (n => n && (direct ? kids(n).some((k) => k.id === id) : hasDescendant(n, id)))(findIn(c.node)));
  const applied = [], unused = [];
  for (const [k, value] of Object.entries(answers ?? {})) {
    const i = k.indexOf(':'), group = k.slice(0, i), node = k.slice(i + 1);
    const picked = choiceOf(group, value, GROUPS[group]?.value);
    let ok = false;
    if (!picked) { unused.push(k); continue; }
    switch (group) {
      case 'type':
        ov.template = { ...(ov.template ?? {}), type: picked.choice };
        ok = true;
        break;
      case 'expect': {
        if (!findIn(node) || picked.choice === 'unset' || picked.choice === 'block') { ok = !!findIn(node); break; }
        const name = picked.choice === 'tab' ? tabKind(findIn(node)) : (REPEAT_COMPONENT[picked.choice] ?? picked.choice);
        let c = det.components.find((x) => x.node === node && x.status !== 'rejected');
        if (!c) det.components.push({ id: `e${node.replace(/\W/g, '').slice(0, 8)}`, status: 'approved', source: 'plan', component: name, node, confidence: 'low', params: {}, note: 'plan: owner expected this component' });
        else { c.component = name; c.status = 'approved'; c.note = 'plan: owner expected this component'; }
        ok = true;
        break;
      }
      case 'video': {
        const c = det.components.find((x) => x.component === 'video' && x.node === node && x.status !== 'rejected');
        if (!c) break;
        switch (picked.choice) {
          case 'url':
            if (/^https?:\/\//.test(picked.href ?? '')) { (c.params ??= {}).url = picked.href; c.status = 'approved'; }
            ok = true;
            break;
          case 'empty':
            ok = true;
            break;
          default:
            break;
        }
        break;
      }
      case 'link': {
        const href = picked.choice === 'url' ? picked.href : '#';
        if (picked.choice === 'url' && !/^(#\S*|\/\S*|https?:\/\/\S+|mailto:\S+|tel:\S+)$/.test(href ?? '')) break;
        for (const c of det.components.filter((x) => ['button', 'link'].includes(x.component) && x.node === node && x.status === 'approved')) { (c.params ??= {}).link = href; ok = true; }
        const menu = !ok && (holder('menu', node) || holder('menu-slider', node));
        if (menu) { deep(menu, ['params', 'links', node], href); ok = true; }
        break;
      }
      case 'alt':
        if (ov.nodes?.[node]) {
          if (picked.choice === 'text') ov.nodes[node].alt = picked.text ?? '';
          ok = true;
        }
        break;
      case 'answer': {
        const c = holder('accordion', node, true);
        if (!c) break;
        if (picked.choice === 'text') deep(c, ['params', 'content', 'answers', node], picked.text ?? '');
        ok = true;
        break;
      }
      case 'pane': {
        const rowsOf = (c) => (c.component === 'tab-switch' ? switchInventory(findIn(c.node)) : tabInventory(findIn(c.node)));
        const c = det.components.find((x) => (x.component === 'tabs' || x.component === 'tab-switch') && x.status !== 'rejected' && rowsOf(x).some((row) => row.title.id === node));
        if (!c) break;
        switch (picked.choice) {
          case 'figma':
            if (picked.nodeId && picked.fileKey) deep(c, ['params', 'content', 'sources', node], { kind: 'figma', url: picked.url, fileKey: picked.fileKey, nodeId: picked.nodeId });
            ok = true;
            break;
          case 'text':
            if (!rowsOf(c).find((row) => row.title.id === node)?.drawn) deep(c, ['params', 'content', 'panes', node], picked.text ?? '');
            ok = true;
            break;
          case 'keep':
            ok = true;
            break;
          default:
            break;
        }
        break;
      }
      case 'tabopen':
      case 'tabdata': {
        const c = det.components.find((x) => (x.component === 'tabs' || x.component === 'tab-switch') && x.node === node && x.status !== 'rejected');
        if (!c) break;
        switch (picked.choice) {
          case 'unset':
            ok = true;
            break;
          case 'name':
            deep(c, ['params', 'content', 'dataName'], picked.name ?? '');
            ok = true;
            break;
          case 'title': {
            const typed = String(picked.title ?? '').trim();
            const hit = tabTitles(findIn(c.node)).find((t) => (firstText(t)?.text?.characters ?? t.name ?? '').replace(/\s+/g, ' ').trim() === typed);
            if (hit) deep(c, ['params', 'content', 'activeTitleId'], hit.id);
            ok = true;
            break;
          }
          default:
            break;
        }
        break;
      }
      case 'autoplay':
        for (const c of of('carousel', node).filter((x) => x.status === 'approved')) {
          const on = picked.choice === 'on';
          (c.params ??= {}).autoplay = on;
          if (on) { deep(c, ['params', 'settings', 'autoplay'], true); deep(c, ['params', 'settings', 'interval'], Math.round((picked.seconds ?? 3) * 1000)); }
          else deep(c, ['params', 'settings', 'autoplay'], false);
          ok = true;
        }
        break;
      case 'loop':
        for (const c of of('carousel', node).filter((x) => x.status === 'approved')) {
          if (picked.choice === 'wrap') deep(c, ['params', 'settings', 'type'], 'loop');
          ok = true;
        }
        break;
      case 'count':
        for (const c of of('carousel', node).filter((x) => x.status === 'approved')) {
          if (picked.choice === 'set' && picked.count >= 1 && picked.count <= 200) (c.params ??= {}).itemCount = picked.count;
          ok = true;
        }
        break;
      case 'items': {
        const c = of('carousel', node).find((x) => x.status === 'approved');
        if (!c) break;
        if (picked.choice === 'figma' && picked.nodeId) (c.params ??= {}).items = { kind: 'figma', url: picked.url, fileKey: picked.fileKey, nodeId: picked.nodeId };
        ok = true;
        break;
      }
      case 'mobileform': {
        const c = of('carousel', node).find((x) => x.status === 'approved');
        if (!c) break;
        switch (picked.choice) {
          case 'slider':
            (c.params ??= {}).mobileForm = 'slider';
            if (typeof picked.note === 'string') c.params.mobileNote = picked.note;
            ok = true;
            break;
          default:
            break;
        }
        break;
      }
      case 'sync':
        for (const c of of('accordion', node).filter((x) => x.status !== 'rejected')) { deep(c, ['params', 'sync'], picked.choice); ok = true; }
        break;
      case 'act': {
        const button = det.components.find((c) => c.component === 'button' && c.node === node && c.status === 'approved');
        const opener = det.components.find((c) => c.component === 'readmore' && c.status === 'approved' && c.params?.button === node);
        const mode = picked.choice === 'link' ? 'link' : picked.choice === 'none' ? 'none' : 'toggle';
        if (button && mode === 'link' && picked.href) { (button.params ??= {}).link = picked.href; ok = true; }
        if (opener) { (opener.params ??= {}).buttonMode = mode; ok = true; }
        else if (button) ok = true;
        break;
      }
      case 'expand': {
        const c = of('readmore', node).find((x) => x.status === 'approved');
        if (!c) break;
        if (picked.choice === 'text') (c.params ??= {}).expand = { kind: 'text', text: picked.text ?? '' };
        else if (picked.choice === 'figma' && picked.nodeId) (c.params ??= {}).expand = { kind: 'figma', url: picked.url, fileKey: picked.fileKey, nodeId: picked.nodeId };
        ok = true;
        break;
      }
      case 'keep':
        ok = picked.choice === 'static';
        break;
      case 'part': {
        const c = det.components.find((x) => x.node === node && x.status === 'approved');
        if (!c) break;
        if (picked.choice === 'drop') { c.status = 'rejected'; c.note = 'the owner dropped this component in the Plan'; }
        ok = true;
        break;
      }
      case 'guess': {
        const c = det.components.find((x) => x.node === node && (x.status === 'proposed' || x.status === 'approved'));
        if (!c) break;
        switch (picked.choice) {
          case 'attach':
            c.status = 'approved';
            c.note = 'the owner confirmed this component in the Plan';
            ok = true;
            break;
          case 'drop':
            c.status = 'rejected';
            c.note = 'the owner dropped this component in the Plan';
            ok = true;
            break;
          case 'unset':
            ok = true;
            break;
          default:
            break;
        }
        break;
      }
      case 'repeat': {
        switch (picked.choice) {
          case 'unset':
            ok = true;
            break;
          case 'slider':
          case 'tab':
          case 'menu':
          case 'form':
          case 'accordion':
          case 'button': {
            const kind = picked.choice === 'tab' ? tabKind(findIn(node)) : REPEAT_COMPONENT[picked.choice];
            if (!findIn(node)) break;
            const existing = det.components.find((x) => x.node === node && x.component === kind);
            if (existing) { existing.status = 'approved'; existing.source = existing.source || 'human'; existing.note = 'the owner named this group in the Plan'; }
            else det.components.push({ id: `plan-${kind}-${String(node).replace(/[^a-z0-9]/gi, '').slice(-8)}`, component: kind, node, status: 'approved', source: 'human', params: {}, note: 'the owner named this group in the Plan' });
            ok = true;
            break;
          }
          default:
            break;
        }
        break;
      }
      case 'confirm':
        for (const c of det.components.filter((x) => x.node === node && x.status === 'proposed')) {
          if (picked.choice === 'accordion') {
            c.status = 'approved';
            c.note = `${c.note ?? ''} · confirmed by the owner in the Plan`.replace(/^ · /, '');
            for (const l of det.components.filter((x) => x.component === 'semantic' && x.node === node)) { l.status = 'rejected'; l.note = 'autopilot: the node is an accordion now (confirmed in the Plan)'; }
          }
          ok = true;
        }
        break;
      default:
        break;
    }
    (ok ? applied : unused).push(k);
  }
  ws.writeJson('detections.json', det);
  ws.writeJson('overrides.json', ov);
  return { applied, unused };
}

const spoken = (node) => String(firstText(node ?? {})?.text?.characters ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// One design: the values live on that frame, so the same component is what every width uses.
// Several designs: each value is copied onto the frame that has the same component (paired by layer, else by the
// same words). A frame that does not have the component is skipped. A value that frame already has is left as it is.
export function shareFilledContent(baseWs) {
  const variants = baseWs.readJson('responsive.json', { variants: [] }).variants ?? [];
  if (!variants.length) return { copied: 0 };
  const baseTree = baseWs.readJson('tree.json', null);
  const baseDet = baseWs.readJson('detections.json', { components: [] });
  const baseOv = baseWs.readJson('overrides.json', { nodes: {} });
  if (!baseTree) return { copied: 0 };
  const find = (root, id) => { const f = (n) => (n?.id === id ? n : kids(n).map(f).find(Boolean)); return f(root); };
  const live = (c) => c && c.status !== 'rejected';
  const valueOf = (v) => (v && typeof v === 'object' ? structuredClone(v) : v);
  let copied = 0;
  for (const v of variants) {
    const vws = resolveWorkspace(join(dirname(baseWs.dir), v.workspace));
    if (!vws.has('tree.json') || !vws.has('detections.json')) continue;
    const vTree = vws.readJson('tree.json');
    const vDet = vws.readJson('detections.json');
    const vComps = vDet.components ?? [];
    const { pairs } = matchTrees(baseTree, vTree, { aliases: v.aliases ?? {} });
    const variantOf = new Map([...pairs].map(([vid, bid]) => [bid, vid]));
    const family = (name) => (name === 'menu' || name === 'menu-slider' ? 'menu' : name);
    const sameKind = (c) => vComps.filter((x) => family(x.component) === family(c.component) && live(x));
    // The paired component, or the only one of that kind when the layer was renamed.
    const partner = (c) => sameKind(c).find((x) => x.node === variantOf.get(c.node)) ?? (sameKind(c).length === 1 ? sameKind(c)[0] : null);
    const used = new Set();
    const take = (baseId, pool) => {
      const direct = pool.find((p) => p.id === variantOf.get(baseId));
      if (direct) return used.has(direct.id) ? null : direct;
      const text = spoken(find(baseTree, baseId));
      if (!text) return null;
      return pool.find((p) => !used.has(p.id) && p.text === text) ?? null;
    };
    let changed = false;
    const mark = () => { changed = true; copied++; };

    const ownersOf = (c) => { const prefer = partner(c); return prefer ? [prefer, ...sameKind(c).filter((x) => x !== prefer)] : sameKind(c); };

    for (const c of baseDet.components.filter((x) => x.component === 'accordion' && live(x))) {
      const pool = ownersOf(c).flatMap((comp) => kids(find(vTree, comp.node) ?? {}).map((item) => ({ id: item.id, text: spoken(item), comp })));
      for (const [itemId, text] of Object.entries(c.params?.content?.answers ?? {})) {
        if (!text) continue;
        const item = take(itemId, pool);
        if (!item) continue;
        used.add(item.id);
        if (item.comp.params?.content?.answers?.[item.id]) continue;
        deep(item.comp, ['params', 'content', 'answers', item.id], text);
        mark();
      }
      const hit = partner(c);
      if (!hit) continue;
      if (c.params?.sync && !hit.params?.sync) { deep(hit, ['params', 'sync'], c.params.sync); mark(); }
      if (c.status === 'approved' && /confirmed by the owner/.test(c.note ?? '') && hit.status === 'proposed') {
        hit.status = 'approved';
        hit.note = `${hit.note ?? ''} · confirmed by the owner in the Plan`.replace(/^ · /, '');
        for (const l of vComps.filter((x) => x.component === 'semantic' && x.node === hit.node && live(x))) {
          l.status = 'rejected';
          l.note = 'autopilot: the node is an accordion now (confirmed in the Plan)';
        }
        mark();
      }
    }

    for (const c of baseDet.components.filter((x) => (x.component === 'tabs' || x.component === 'tab-switch') && live(x))) {
      const pool = ownersOf(c).flatMap((comp) => {
        const node = find(vTree, comp.node) ?? {};
        const titles = comp.component === 'tab-switch' ? tabTitles(node) : kids(kids(node)[0] ?? {});
        return titles.map((title) => ({ id: title.id, text: spoken(title), comp }));
      });
      const panes = c.params?.content?.panes ?? {};
      const sources = c.params?.content?.sources ?? {};
      for (const titleId of new Set([...Object.keys(panes), ...Object.keys(sources)])) {
        const title = take(titleId, pool);
        if (!title?.comp) continue;
        used.add(title.id);
        if (panes[titleId] && !title.comp.params?.content?.panes?.[title.id]) {
          deep(title.comp, ['params', 'content', 'panes', title.id], panes[titleId]);
          mark();
        }
        if (sources[titleId]?.kind === 'figma' && !title.comp.params?.content?.sources?.[title.id]) {
          deep(title.comp, ['params', 'content', 'sources', title.id], valueOf(sources[titleId]));
          mark();
        }
      }
    }

    for (const c of baseDet.components.filter((x) => (x.component === 'menu' || x.component === 'menu-slider') && live(x))) {
      const pool = ownersOf(c).flatMap((comp) => kids(find(vTree, comp.node) ?? {}).map((item) => firstText(item)).filter(Boolean).map((t) => ({ id: t.id, text: spoken(t), comp })));
      for (const [labelId, href] of Object.entries(c.params?.links ?? {})) {
        if (!href) continue;
        const label = take(labelId, pool);
        if (!label) continue;
        used.add(label.id);
        if (label.comp.params?.links?.[label.id]) continue;
        deep(label.comp, ['params', 'links', label.id], href);
        mark();
      }
    }

    for (const c of baseDet.components.filter((x) => (x.component === 'button' || x.component === 'link') && live(x) && x.params?.link)) {
      const pool = sameKind(c).map((comp) => ({ id: comp.node, text: spoken(find(vTree, comp.node)), comp }));
      const hit = take(c.node, pool);
      if (!hit) continue;
      used.add(hit.id);
      if (hit.comp.params?.link) continue;
      (hit.comp.params ??= {}).link = c.params.link;
      mark();
    }

    for (const c of baseDet.components.filter((x) => x.component === 'carousel' && live(x))) {
      const hit = partner(c);
      if (!hit) continue;
      if (typeof c.params?.autoplay === 'boolean' && hit.params?.autoplay === undefined) { (hit.params ??= {}).autoplay = c.params.autoplay; mark(); }
      for (const [key, value] of Object.entries(c.params?.settings ?? {})) {
        if (hit.params?.settings?.[key] !== undefined) continue;
        deep(hit, ['params', 'settings', key], valueOf(value));
        mark();
      }
      if (c.params?.itemCount && hit.params?.itemCount == null) { (hit.params ??= {}).itemCount = c.params.itemCount; mark(); }
      if (c.params?.items && !hit.params?.items) { (hit.params ??= {}).items = valueOf(c.params.items); mark(); }
    }

    for (const c of baseDet.components.filter((x) => x.component === 'form' && live(x))) {
      const hit = partner(c);
      if (!hit) continue;
      const baseFields = c.params?.fields ?? [];
      const varFields = hit.params?.fields ?? [];
      const spokenField = (f) => String(f.placeholder || f.label || '').trim().toLowerCase().replace(/\s+/g, ' ');
      for (const field of baseFields) {
        if (!field.error) continue;
        const same = varFields.find((f) => spokenField(f) && spokenField(f) === spokenField(field));
        const byOrder = baseFields.length === varFields.length ? varFields[baseFields.indexOf(field)] : null;
        const dest = same ?? byOrder;
        if (!dest || dest.error) continue;
        dest.error = field.error;
        mark();
      }
      if (c.params?.errorStyle && !hit.params?.errorStyle) { (hit.params ??= {}).errorStyle = valueOf(c.params.errorStyle); mark(); }
    }

    for (const c of baseDet.components.filter((x) => x.component === 'readmore' && live(x))) {
      const hit = partner(c);
      if (!hit) continue;
      if (c.params?.expand && !hit.params?.expand) { (hit.params ??= {}).expand = valueOf(c.params.expand); mark(); }
      if (c.params?.buttonMode && !hit.params?.buttonMode) { (hit.params ??= {}).buttonMode = c.params.buttonMode; mark(); }
    }

    const vOv = vws.has('overrides.json') ? vws.readJson('overrides.json', { nodes: {} }) : null;
    let ovChanged = false;
    if (vOv?.nodes) {
      for (const [id, entry] of Object.entries(baseOv.nodes ?? {})) {
        if (!entry?.alt) continue;
        const dest = vOv.nodes[variantOf.get(id)];
        if (!dest || dest.alt) continue;
        dest.alt = entry.alt;
        ovChanged = true;
        copied++;
      }
    }
    if (changed) vws.writeJson('detections.json', vDet);
    if (ovChanged) vws.writeJson('overrides.json', vOv);
  }
  return { copied };
}

export const shareAccordionAnswers = shareFilledContent;
