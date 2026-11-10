// A Tab List whose panel is not its sibling (the price table: the list sits beside the period bar, the
// panel is under the card). The two-child pair is left to detect/rules/tabs.mjs.
import { inspect, inspectClassic, listsIn, isTabList, isNamedTabBar, isActionBar, rowTitles, activeTitle, dividerOf, hasDivider } from '../../write-bricks/components/tab-switch.mjs';

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
      const info = inspectClassic(n, list);
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

// A horizontal row the visitor clicks, plus the frame under that row that shows the open tab's data.
// A layer name is a hint. A mobile frame that stacks each title above its own content is not this component.
// The two-child bar + pane pair stays with detect/rules/tabs.mjs. A Tab List stays with the loop above.
function detectNamedTabRows(tree, claimed) {
  const found = [];
  const taken = new Set(claimed.map((f) => f.node));
  (function walk(n) {
    if (n.visible === false || taken.has(n.id)) return;
    const kids = visibleKids(n);
    const bar = kids.find((child) => isActionBar(child) || isNamedTabBar(child));
    const info = inspect(n);
    const onePaneEach = info?.panels?.length > 0 && info.panels.length === info.titles.length && !info.dataItems;
    const classicPair = kids.length === 2 && bar && onePaneEach;
    if (classicPair) {
      kids.forEach((child) => { if (child.id !== bar.id) walk(child); });
      return;
    }
    const loose = info?.list && isActionBar(info.list) && !isTabList(info.list);
    if (loose && info.titles.length >= 2) {
      // The page that holds this section also matches. The section that holds the bar and the pane is the component.
      const tighter = kids.some((child) => inspect(child)?.list?.id === info.list.id);
      if (!tighter) {
        const open = info.titles[Number.isInteger(info.active) ? info.active : 0];
        const marked = Object.entries(open.props ?? {}).find(([key, value]) => /state|active|selected|property\s*1/i.test(key) && /^(selected|active|current|on|true)$/i.test(String(value)));
        const divider = dividerOf(info.list, info.titles);
        const cite = [{ node: info.list.id, field: 'layout.mode', equals: 'HORIZONTAL' }];
        if (marked) cite.push({ node: open.id, field: `props.${marked[0]}`, equals: marked[1] });
        if (divider) cite.push({ node: divider.id, field: 'type', equals: divider.type });
        if (!marked && !divider) cite.push({ node: open.id, field: 'name', equals: open.name });
        found.push({
          component: 'tab-switch', node: n.id, level: 'E1', confidence: marked || divider || isNamedTabBar(info.list) ? 'high' : 'medium',
          cite,
          evidence: `"${n.name}": ${info.titles.length} tab(s)${info.list ? ` in "${info.list.name}"` : ''}, ${info.dataItems?.length ? `${info.dataItems.length} item(s) of the open tab` : `${info.panels.length} content frame(s)`} drawn`,
          params: {},
          note: `${info.titles.length} tabs; the row switches the data frame under it`,
        });
        return;
      }
    }
    const bare = !info && isActionBar(n) && !isTabList(n);
    if (bare) {
      const titles = rowTitles(n);
      const active = activeTitle(titles, n);
      const strong = active.reason === 'variant' || active.reason === 'paint' || active.reason === 'fill' || isNamedTabBar(n) || (active.reason === 'stroke' && hasDivider(n, titles));
      if (strong && titles.length >= 2) {
        const open = titles[Number.isInteger(active.index) ? active.index : 0];
        found.push({
          component: 'tab-switch', node: n.id, level: 'E1', confidence: strong ? 'high' : 'medium',
          cite: [{ node: n.id, field: 'layout.mode', equals: 'HORIZONTAL' }, { node: open.id, field: 'name', equals: open.name }],
          evidence: `"${n.name}": ${titles.length} tab(s), no content frame in this node`,
          params: {},
          note: `${titles.length} tabs; the pane is not inside this frame`,
        });
        return;
      }
    }
    kids.forEach(walk);
  })(tree);
  return found;
}
