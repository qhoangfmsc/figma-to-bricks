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
import { join } from 'node:path';

export const keyOf = (group, node) => `${group}:${node}`;
export const figmaLink = (fileKey, node) => `https://www.figma.com/design/${fileKey}/x?node-id=${String(node).replaceAll(':', '-')}`;
const clean = (s) => String(s ?? '').replace(/[`\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();

// what each kind of question says, and how its value is checked. `apply` puts the value in the workspace (see applyAnswers).
export const GROUPS = {
  link: {
    title: (n) => `Link của ${n} nút / mục menu`,
    summary: 'Figma không có địa chỉ đích của các nút và mục menu này, nên hiện đang đặt `#`. Điền địa chỉ thật (`https://…`, `/duong-dan`, `#neo`, `mailto:…`, `tel:…`) hoặc để trống để giữ `#`.',
    check: (v) => (/^(#\S*|\/\S*|https?:\/\/\S+|mailto:\S+|tel:\S+)$/.test(v) ? null : 'địa chỉ phải bắt đầu bằng https://, /, #, mailto: hoặc tel:'),
  },
  answer: {
    title: (n) => `Câu trả lời cho ${n} câu hỏi FAQ`,
    summary: 'Figma chỉ vẽ câu trả lời của mục đang mở. Các mục còn lại cần nội dung để người dùng bấm vào là xem được. Gõ câu trả lời sau dấu `:` (nhiều dòng thì xuống dòng và thụt vào hai khoảng trắng). Để trống thì mục đó không có nội dung và bấm vào sẽ không mở ra gì.',
    check: (v) => (v.length <= 4000 ? null : 'dài quá 4000 ký tự'),
  },
  pane: {
    title: (n) => `Nội dung cho ${n} tab chưa được vẽ`,
    summary: 'Figma chỉ vẽ nội dung của tab đang mở. Gõ nội dung của các tab còn lại (nhiều dòng thì xuống dòng và thụt vào hai khoảng trắng). Để trống thì tab đó rỗng.',
    check: (v) => (v.length <= 4000 ? null : 'dài quá 4000 ký tự'),
  },
  autoplay: {
    title: (n) => `Tự chuyển slide của ${n} slider`,
    summary: 'Figma không cho biết slider có tự chuyển slide không. Điền số giây giữa hai lần chuyển (ví dụ `5`), hoặc để trống nếu chỉ chuyển khi người dùng bấm hoặc vuốt.',
    check: (v) => (/^\d+(\.\d+)?$/.test(v) && +v > 0 ? null : 'điền số giây, ví dụ 5'),
  },
  loop: {
    title: (n) => `Lặp vòng của ${n} slider`,
    summary: 'Hết slide cuối thì quay lại slide đầu hay dừng? Gõ `có` hoặc `không`; để trống thì dừng ở slide cuối.',
    check: (v) => (/^(có|co|không|khong|yes|no)$/i.test(v) ? null : 'gõ có hoặc không'),
  },
  confirm: {
    title: (n) => `Xác nhận ${n} khối mà tool chỉ đoán được là accordion`,
    summary: 'Các khối này trông giống danh sách câu hỏi mở/đóng nhưng Figma không đánh dấu rõ. Gõ `có` để build thành accordion bấm mở/đóng được; để trống hoặc `không` thì giữ nguyên là block.',
    check: (v) => (/^(có|co|không|khong|yes|no)$/i.test(v) ? null : 'gõ có hoặc không'),
  },
  alt: {
    title: (n) => `Mô tả (alt) của ${n} ảnh nội dung`,
    summary: 'Ảnh nội dung cần câu mô tả ngắn cho người dùng đọc màn hình và cho SEO; tên layer trong Figma không dùng được. Để trống nếu ảnh chỉ để trang trí.',
    check: (v) => (v.length <= 160 ? null : 'dài quá 160 ký tự, nên viết ngắn hơn'),
  },
};

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
    'Điền xong, đổi dòng bên dưới thành `Xác nhận: có` rồi nhắn Claude chạy tiếp. Claude sẽ build mọi section, kiểm tra, sửa lỗi và ghép trang, không hỏi gì thêm.', '',
    'Xác nhận: không', '',
    '## Tóm tắt', '', '| # | Section | Link Figma | Sẽ build thành | Cần điền |', '|---|---|---|---|---|',
    ...model.sections.map((s, i) => `| ${i + 1} | ${s.name} | [mở](${figmaLink(model.fileKey, s.id)}) | ${s.build || 'block'} | ${s.questions.length ? s.questions.length + ' nhóm' : '-'} |`), '',
    total ? `Tổng cộng **${total} nhóm câu hỏi**.` : 'Không có gì cần anh điền; xác nhận để bắt đầu build.', '');
  model.sections.forEach((s, i) => {
    out.push(`## Section ${String(i + 1).padStart(2, '0')} — ${s.name}`, '', `- Figma: [mở section](${figmaLink(model.fileKey, s.id)})`, `- Sẽ build thành: ${s.build || 'block'}`);
    if (s.decided?.length) out.push(`- Đã tự quyết, không cần hỏi: ${s.decided.join('; ')}`);
    out.push('');
    if (!s.questions.length) { out.push('Không có gì cần điền ở section này.', ''); return; }
    for (const { group, items } of s.questions) {
      n++;
      out.push(`### [Q${n}] ${GROUPS[group].title(items.length)}`, '', GROUPS[group].summary, '');
      for (const q of items) {
        const k = keyOf(group, q.node);
        out.push(`- ${clean(q.label)} ([Figma](${figmaLink(model.fileKey, q.node)})) \`${k}\`: ${answers[k] ?? ''}`);
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
    else if (why) problems.push(`\`${k}\` = "${v.slice(0, 40)}": ${why}`);
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
const hasDescendant = (n, id) => kids(n).some((c) => c.id === id || hasDescendant(c, id));
const yes = (v) => /^(có|co|yes)$/i.test(v);
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
    let ok = false;
    if (group === 'link') {
      for (const c of det.components.filter((x) => ['button', 'link'].includes(x.component) && x.node === node && x.status === 'approved')) { (c.params ??= {}).link = value; ok = true; }
      const menu = !ok && holder('menu', node);
      if (menu) { deep(menu, ['params', 'links', node], value); ok = true; }
    } else if (group === 'alt') {
      if (ov.nodes?.[node]) { ov.nodes[node].alt = value; ok = true; } // the entry keeps its autopilot reason: decide() rebuilds it on the next run and this puts the value back
    } else if (group === 'answer') {
      const c = holder('accordion', node, true);
      if (c) { deep(c, ['params', 'content', 'answers', node], value); ok = true; }
    } else if (group === 'pane') {
      const c = det.components.find((x) => x.component === 'tabs' && x.status !== 'rejected' && kids(findIn(x.node) ?? {})[0] && kids(kids(findIn(x.node))[0]).some((t) => t.id === node));
      if (c) { deep(c, ['params', 'content', 'panes', node], value); ok = true; }
    } else if (group === 'autoplay') {
      for (const c of of('carousel', node).filter((x) => x.status === 'approved')) { deep(c, ['params', 'settings', 'autoplay'], true); deep(c, ['params', 'settings', 'interval'], Math.round(+value * 1000)); ok = true; }
    } else if (group === 'loop') {
      for (const c of of('carousel', node).filter((x) => x.status === 'approved')) { if (yes(value)) deep(c, ['params', 'settings', 'type'], 'loop'); ok = true; }
    } else if (group === 'confirm') {
      for (const c of det.components.filter((x) => x.node === node && x.status === 'proposed')) {
        if (yes(value)) {
          c.status = 'approved'; c.note = `${c.note ?? ''} · confirmed by the owner in the Plan`.replace(/^ · /, '');
          for (const l of det.components.filter((x) => x.component === 'semantic' && x.node === node)) { l.status = 'rejected'; l.note = 'autopilot: the node is an accordion now (confirmed in the Plan)'; } // the accordion is the list
        }
        ok = true;
      }
    }
    (ok ? applied : unused).push(k);
  }
  ws.writeJson('detections.json', det);
  ws.writeJson('overrides.json', ov);
  return { applied, unused };
}
