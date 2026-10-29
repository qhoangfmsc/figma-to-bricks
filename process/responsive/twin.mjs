// Which section of another breakpoint frame is the twin of a section of the base frame? Deterministic:
//   1. the same NAME, when that name is unique among the sections of both frames;
//   2. otherwise (the name is repeated: "vnx-service" x4, "f-w" x4, or the designer renamed it: "f-w" -> "Note") the sections that share the most
//      WORDS of visible text: a pair counts only when each is the other's best match, the overlap (Jaccard of the word sets) is at least
//      MIN_OVERLAP and at least MARGIN times the runner-up on both sides. Anything less certain has no twin (the section stays base only).
export const MIN_OVERLAP = 0.2;
export const MARGIN = 1.5;

export const wordsOf = (node) => {
  const out = new Set();
  (function rec(n) {
    if (n.visible === false) return;
    if (n.type === 'TEXT') String(n.characters ?? '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2).forEach((w) => out.add(w));
    (n.children ?? []).forEach(rec);
  })(node);
  return out;
};

const jaccard = (a, b) => { let i = 0; for (const w of a) if (b.has(w)) i++; return i / Math.max(1, a.size + b.size - i); };

// base / candidates: [{ id, name, words:Set }]; returns the candidate (or null)
export function pickTwin(target, base, candidates) {
  const sameName = (list) => list.filter((x) => x.name === target.name);
  if (sameName(base).length === 1 && sameName(candidates).length === 1) return sameName(candidates)[0];
  if (!target.words?.size) return null;
  const score = (a, b) => jaccard(a.words, b.words);
  const best = (list, from) => { const s = list.map((x) => ({ x, j: score(from, x) })).sort((p, q) => q.j - p.j); return { top: s[0], second: s[1]?.j ?? 0 }; };
  const mine = best(candidates, target);
  if (!mine.top || mine.top.j < MIN_OVERLAP || mine.top.j < MARGIN * mine.second) return null;
  const back = best(base, mine.top.x);
  if (back.top.x.id !== target.id || back.top.j < MARGIN * back.second) return null;
  return mine.top.x;
}
