// Candidate "read more": a CLIPPED frame whose content is longer than the frame, followed by a button that says "Xem thêm" / "Read more" (the SEO Text sections).
//   E1 variant   the frame is a designer component with Expand=No (or false / collapsed)
//   E2 shape     the frame clips (clip) and its flow children end below its own height
// Both need the button: a clipped frame alone is only a clipped frame. The Figma button is the toggle, the fade over the bottom edge (an absolute gradient child) goes away when it opens.
const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const LABEL = /^\s*(xem thêm|đọc thêm|xem tất cả|xem đầy đủ|read more|show more|view more|see more)\s*$/i;
const NO = /^(no|false|collapsed?|closed?)$/i;
const textsOf = (n) => (n.visible === false ? [] : n.type === 'TEXT' && !n.svg && n.text?.characters?.trim() ? [n] : visibleKids(n).flatMap(textsOf));

export function detectReadMore(tree) {
  const found = [];
  (function walk(n) {
    if (n.visible === false) return;
    const kids = visibleKids(n);
    kids.forEach((c, i) => {
      const next = kids.slice(i + 1).find((k) => textsOf(k).length === 1 && LABEL.test(textsOf(k)[0].text.characters));
      if (!c.clip || !next) return;
      const flow = visibleKids(c).filter((k) => k.place !== 'ABSOLUTE');
      const overflow = flow.length && Math.max(...flow.map((k) => k.box.y + k.box.h)) > c.box.h + 1;
      const expand = Object.entries(c.props ?? {}).find(([k, v]) => /expand|open/i.test(k) && typeof v === 'string' && NO.test(v));
      if (!overflow && !expand) return;
      const label = textsOf(next)[0];
      found.push({
        component: 'readmore', node: c.id, level: expand ? 'E1' : 'E2', confidence: expand && overflow ? 'high' : 'medium',
        cite: [{ node: c.id, field: 'clip', equals: true }, { node: label.id, field: 'text.characters', equals: label.text.characters }, ...(expand ? [{ node: c.id, field: `props.${expand[0]}`, equals: expand[1] }] : [])],
        evidence: `"${c.name}" (${Math.round(c.box.w)}x${Math.round(c.box.h)}) clips its content${expand ? ` (designer variant ${expand[0]}=${expand[1]})` : ''}${overflow ? ', the content runs past its height' : ''}, and "${next.name}" says "${label.text.characters.trim()}"`,
        params: { button: next.id },
        note: 'the button opens the whole text (a click toggles a class, no JS); nothing to ask',
      });
    });
    kids.forEach(walk);
  })(tree);
  return found;
}
