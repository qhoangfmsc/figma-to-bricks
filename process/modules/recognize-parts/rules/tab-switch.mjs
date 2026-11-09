// A Tab List whose panel is not its sibling (the price table: the list sits beside the period bar, the
// panel is under the card). The two-child pair is left to detect/rules/tabs.mjs.
import { inspect, listsIn, isTabList, isNamedTabBar } from '../../write-bricks/components/tab-switch.mjs';

const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const contains = (n, id) => !!n && (n.id === id || visibleKids(n).some((c) => contains(c, id)));

function coveredByTabs(host, list, panels) {
  const kids = visibleKids(host);
  return kids.length === 2 && kids.some((k) => k.id === list.id) && kids.some((k) => panels.every((p) => contains(k, p.id)));
}

export function detectTabSwitches(tree) {
  const found = [];
  for (const list of listsIn(tree)) {
    if (!isTabList(list)) continue;
    let host = null;
    let panels = [];
    (function walk(n) {
      for (const c of visibleKids(n)) walk(c);
      if (host || n.id === list.id) return;
      const info = inspect(n, list);
      if (info?.list?.id === list.id) { host = n; panels = info.panels; }
    })(tree);
    if (!host || found.some((f) => f.node === host.id) || coveredByTabs(host, list, panels)) continue;
    const titles = visibleKids(list);
    found.push({
      component: 'tab-switch', node: host.id, level: 'E1', confidence: 'high',
      cite: [{ node: list.id, field: 'name', equals: list.name }, { node: panels[0].id, field: 'name', equals: panels[0].name }],
      evidence: `"${host.name}": Tab List "${list.name}" (${titles.length} titles) switches "${panels[0].name}"`,
      params: {},
      note: `${titles.length} tabs, Figma draws ${panels.length} panel(s); the Plan asks for the content of the others`,
    });
  }
  return found.concat(detectNamedTabRows(tree, found));
}

// A horizontal row of frames named "tab", plus the frame under that row.
// A mobile frame that stacks each title above its own content is not this component.
// The two-child bar + pane pair stays with detect/rules/tabs.mjs. A Tab List stays with the loop above.
function detectNamedTabRows(tree, claimed) {
  const found = [];
  const taken = new Set(claimed.map((f) => f.node));
  (function walk(n) {
    if (n.visible === false || taken.has(n.id)) return;
    const kids = visibleKids(n);
    const bar = kids.find(isNamedTabBar);
    const info = inspect(n);
    const onePaneEach = info?.panels?.length > 0 && info.panels.length === info.titles.length && !info.dataItems;
    const classicPair = kids.length === 2 && bar && onePaneEach;
    if (classicPair) { kids.forEach(walk); return; }
    const loose = info?.list && isNamedTabBar(info.list) && !isTabList(info.list);
    if (loose && info.titles.length >= 2) {
      const named = info.list ?? info.titles[0];
      found.push({
        component: 'tab-switch', node: n.id, level: 'E1', confidence: 'high',
        cite: [{ node: named.id, field: 'name', equals: named.name }, { node: info.titles[0].id, field: 'name', equals: info.titles[0].name }],
        evidence: `"${n.name}": ${info.titles.length} tab(s)${info.list ? ` in "${info.list.name}"` : ''}, ${info.dataItems?.length ? `${info.dataItems.length} item(s) of the open tab` : `${info.panels.length} content frame(s)`} drawn`,
        params: {},
        note: `${info.titles.length} tabs; each one is listed on the screen with the content Figma drew`,
      });
      return;
    }
    kids.forEach(walk);
  })(tree);
  return found;
}
