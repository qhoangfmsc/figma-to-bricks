// Candidate tabs: a container with exactly two visible children, a horizontal TAB BAR of >= 2 alike title frames and a CONTENT frame (the open pane).
// Needs a hint, because two stacked frames are everywhere in a design:
//   E1 variants  the titles are one component and an Active / Selected / Current property is on for one title and off for the others
//   E1 named     the container, the bar, the title component or a title is named "tab" / "tabs" / "tab menu" / "tab item"
// Without one of them nothing is proposed (tabs are not guessed from shape).
const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const BOX = new Set(['FRAME', 'GROUP', 'INSTANCE', 'COMPONENT']);
const NAME = /\btabs?\b|tab[ _-]?(menu|item|bar|title|list)/i;
const ACTIVE_KEY = /active|selected|current|state/i, ACTIVE_VAL = /^(true|active|selected|current|on|default)$/i;
const hasText = (n) => n.type === 'TEXT' && !n.svg && n.text?.characters?.trim() || visibleKids(n).some(hasText);

const activeOf = (title) => {
  for (const [key, value] of Object.entries(title.props ?? {})) if (ACTIVE_KEY.test(key) && (value === true || typeof value === 'string')) return { key, value, on: value === true || ACTIVE_VAL.test(String(value)) };
  return null;
};

export function detectTabs(tree) {
  const found = [];
  (function walk(n) {
    if (n.visible === false) return;
    const kids = visibleKids(n);
    if (kids.length === 2) {
      const [bar, content] = kids;
      const titles = visibleKids(bar);
      const ok = bar.layout?.mode === 'HORIZONTAL' && titles.length >= 2 && titles.every((t) => BOX.has(t.type) && hasText(t)) && visibleKids(content).length >= 1
        && content.box.absY >= bar.box.absY + bar.box.h - 1;
      if (ok) {
        const acts = titles.map(activeOf);
        const variants = new Set(titles.map((t) => t.componentSet ?? t.name)).size === 1 && acts.every(Boolean) && acts.some((a) => a.on) && acts.some((a) => !a.on);
        const named = NAME.test(n.name) || NAME.test(bar.name) || titles.some((t) => NAME.test(t.name) || NAME.test(t.componentSet ?? ''));
        if (variants || named) {
          const cite = [{ node: bar.id, field: 'layout.mode', equals: 'HORIZONTAL' }];
          if (named) {
            const byName = [n, bar, ...titles].find((x) => NAME.test(x.name)), bySet = titles.find((t) => NAME.test(t.componentSet ?? ''));
            if (byName) cite.push({ node: byName.id, field: 'name', equals: byName.name });
            else if (bySet) cite.push({ node: bySet.id, field: 'componentSet', equals: bySet.componentSet });
          }
          if (variants) { const on = titles[acts.findIndex((a) => a.on)]; cite.push({ node: on.id, field: `props.${acts.find((a) => a.on).key}`, equals: acts.find((a) => a.on).value }); }
          found.push({
            component: 'tabs', node: n.id, level: 'E1', confidence: variants && named ? 'high' : 'medium', cite,
            evidence: `"${n.name}": a tab bar "${bar.name}" with ${titles.length} titles and a content frame "${content.name}" ${variants ? '(one title is active in the designer variants)' : '(named like tabs)'}`,
            params: {},
            note: `${titles.length} tabs, Figma draws the open pane; the Plan asks for the content of the others`,
          });
          return;
        }
      }
    }
    kids.forEach(walk);
  })(tree);
  return found;
}
