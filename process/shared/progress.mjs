// PROGRESS of a long run (auto.mjs, regress.mjs): which section / screen is being worked on, how far, and a time estimate.
// Writes progress-<node>.md and progress-<node>.json next to the page report and prints one summary line on every change.
//   node process/scripts/progress.mjs <fileKey> [<node-id>]     prints the latest progress file
// Unit of work (the percentage and the estimate count these): for every screen of a section "prepared" (fetch, tree, decide) and "verified"
// (Playwright against Figma's render), plus "built" and "pushed" once per section. A screen the file does not have is not counted.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

// The stages of the workflow, in order. A section / screen reports the stages it has finished ("xong giai đoạn 1,2,3").
export const STAGES = [
  'đọc Figma (fetch + tree)', 'detect + quyết định theo rule', 'export ảnh / svg', 'build template (ghép breakpoint)',
  'đẩy lên WordPress (đặt tên template)', 'verify bằng Playwright', 'sửa lỗi (sau fix)', 'ghép page + hoàn tất',
];
export const stageList = (upTo) => Array.from({ length: upTo }, (_, i) => i + 1).join(',');
export const SCREENS = ['desktop', 'tablet', 'mobile', 'widescreen'];
const LABEL = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile', widescreen: 'Widescreen' };
// breakpoint key / frame width -> screen
export const screenOf = (key) => (key === 'base' || key === 'desktop' ? 'desktop' : /^tablet/.test(key) ? 'tablet' : /^mobile/.test(key) ? 'mobile' : /^wide/.test(key) ? 'widescreen' : key);
export const screenOfWidth = (w) => (w >= 1701 ? 'widescreen' : w >= 992 ? 'desktop' : w >= 479 ? 'tablet' : 'mobile');

const fmt = (ms) => { const m = Math.round(ms / 60000); return m < 1 ? '<1 phút' : m < 60 ? `${m} phút` : `${Math.floor(m / 60)} giờ ${m % 60} phút`; };
const clock = (t) => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export class Progress {
  // sections: [{ id, name, screens? }]; screens = the screens the file is known to have besides desktop (else found per section later)
  constructor({ dir, node, title, sections, screens = null, quiet = false, now = () => Date.now() }) {
    this.dir = dir; this.node = node; this.title = title; this.quiet = quiet; this.now = now; this.started = now();
    this.current = null; // { i, screen, step }
    this.sections = sections.map((s) => ({
      id: s.id, name: s.name, state: 'waiting', started: null, ended: null, built: false, pushed: false, note: '',
      screens: Object.fromEntries(SCREENS.map((k) => [k, { expected: k === 'desktop' || !!screens?.includes(k), prepared: false, verified: false, verdict: null }])),
    }));
  }
  begin(i) {
    if (this.work0 == null) { this.work0 = this.units().done; this.started = this.now(); } // the estimate counts work done since the first section started, not the units that were already done (regress: every section starts as read)
    const s = this.sections[i]; s.state = 'running'; s.started = this.now(); this.current = { i, screen: 'desktop', step: 'đọc Figma' }; this.save();
  }
  // the screens found for this section: the others have no twin frame (not counted)
  found(i, keys) {
    const have = new Set(['desktop', ...keys.map(screenOf)]);
    for (const k of SCREENS) { const sc = this.sections[i].screens[k]; if (k !== 'desktop') sc.expected = have.has(k); }
    this.save();
  }
  at(i, screen, step) { this.current = { i, screen: screenOf(screen), step }; this.save(); }
  prepared(i, screen) { this.sections[i].screens[screenOf(screen)].prepared = true; this.save(); }
  built(i) { this.sections[i].built = true; this.save(); }
  pushed(i) { this.sections[i].pushed = true; this.save(); }
  verified(i, screen, verdict) { const sc = this.sections[i].screens[screenOf(screen)]; sc.verified = true; sc.verdict = verdict ?? null; this.save(); }
  end(i, state = 'done', note = '') { const s = this.sections[i]; s.state = state; s.ended = this.now(); s.note = note; if (this.current?.i === i) this.current = null; this.save(); }

  units() {
    let done = 0, total = 0;
    for (const s of this.sections) {
      const closed = s.state === 'done' || s.state === 'stopped';
      for (const sc of Object.values(s.screens)) if (sc.expected) { total += 2; done += closed ? 2 : (sc.prepared ? 1 : 0) + (sc.verified ? 1 : 0); }
      total += 2; done += closed ? 2 : (s.built ? 1 : 0) + (s.pushed ? 1 : 0);
    }
    return { done, total };
  }
  summary() {
    const { done, total } = this.units();
    const elapsed = this.now() - this.started;
    const pct = total ? Math.round((100 * done) / total) : 0;
    // sections that are still waiting have not shown their screens yet: they are assumed to have the screens the finished ones had
    const worked = done - (this.work0 ?? 0);
    const eta = done >= total ? 0 : worked >= 2 ? (elapsed / worked) * (total - done) : null;
    return { done, total, pct, elapsed, eta, etaAt: eta == null ? null : this.now() + eta };
  }
  line() {
    const s = this.summary(), c = this.current;
    const sec = this.sections.filter((x) => x.state === 'done' || x.state === 'stopped').length;
    const where = c ? ` · đang làm "${this.sections[c.i].name}" (${c.i + 1}/${this.sections.length}), màn ${LABEL[c.screen] ?? c.screen}, bước ${c.step}` : '';
    return `[tiến trình] ${s.pct}% · ${sec}/${this.sections.length} section xong${where} · ${s.eta == null ? 'ước lượng còn: đang tính' : `còn khoảng ${fmt(s.eta)} (xong lúc ~${clock(s.etaAt)})`}`;
  }
  markdown() {
    const s = this.summary(), c = this.current;
    const closed = this.sections.filter((x) => x.state === 'done' || x.state === 'stopped').length;
    const per = SCREENS.map((k) => {
      const exp = this.sections.filter((x) => x.screens[k].expected);
      const done = exp.filter((x) => x.screens[k].verified).length;
      return `| ${LABEL[k]} | ${exp.length ? `${done} / ${exp.length}` : '0 / 0'} | ${exp.length ? `${Math.round((100 * done) / exp.length)}%` : k === 'desktop' ? '-' : 'không có frame này trong file Figma'} |`;
    });
    const mark = (x, k) => { const sc = x.screens[k]; if (!sc.expected) return '–'; if (sc.verified) return `✓ ${sc.verdict ?? ''}`.trim(); if (c && this.sections[c.i] === x && c.screen === k) return `… ${c.step}`; return sc.prepared ? 'đã đọc' : '·'; };
    const rows = this.sections.map((x, i) => `| ${i + 1} | ${x.name} | ${{ waiting: 'chờ', running: 'đang làm', done: 'xong', stopped: 'DỪNG' }[x.state]}${x.note ? `: ${x.note}` : ''} | ${SCREENS.map((k) => mark(x, k)).join(' | ')} | ${x.built ? '✓' : '·'}${x.pushed ? '✓' : '·'} |`);
    return [
      `# Tiến trình: ${this.title}`, '',
      `**Tổng: ${s.pct}%** (${s.done}/${s.total} đơn vị việc) · **${closed}/${this.sections.length} section xong** · đã chạy ${fmt(s.elapsed)}`,
      s.eta == null ? '**Ước lượng thời gian còn lại:** đang tính (cần vài đơn vị xong đầu tiên)' : s.eta === 0 ? '**Đã xong.**' : `**Ước lượng còn lại:** khoảng ${fmt(s.eta)}, xong lúc ~${clock(s.etaAt)} (chỉ là ước lượng theo tốc độ đã chạy)`,
      c ? `**Đang làm:** section ${c.i + 1}/${this.sections.length} "${this.sections[c.i].name}" · màn ${LABEL[c.screen] ?? c.screen} · bước ${c.step}` : '**Đang làm:** không có section nào đang chạy', '',
      '## Theo màn hình (đã verify / có trong file)', '', '| màn hình | xong | % |', '|---|---|---|', ...per, '',
      '## Theo section', '', `| # | section | trạng thái | ${SCREENS.map((k) => LABEL[k]).join(' | ')} | build/push |`, `|---|---|---|${SCREENS.map(() => '---').join('|')}|---|`, ...rows, '',
      '_Một đơn vị việc = đọc + verify của mỗi màn hình, cộng build và push của mỗi section. `–` là màn hình file Figma không có cho section này._', '',
    ].join('\n');
  }
  // one line per finished screen / stage group: "[báo cáo] 3/23 - Mobile: xong giai đoạn 1,2,3"
  report(i, screen, upTo, extra = '') {
    const line = `[báo cáo] ${i + 1}/${this.sections.length} - ${LABEL[screenOf(screen)] ?? screen}: xong giai đoạn ${stageList(upTo)}${extra ? ` (${extra})` : ''}`;
    console.log(line);
    return line;
  }
  save() {
    if (!this.dir) return;
    try {
      writeFileSync(join(this.dir, `progress-${this.node}.md`), this.markdown());
      writeFileSync(join(this.dir, `progress-${this.node}.json`), JSON.stringify({ title: this.title, summary: this.summary(), current: this.current, sections: this.sections }, null, 2));
    } catch { /* progress must never stop a run */ }
    if (!this.quiet) { const l = this.line(); if (l !== this.last) console.log(l); this.last = l; }
  }
}
