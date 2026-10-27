// COMPONENT breadcrumbs: a row "Home > current page" drawn as text + icon + text.
// Bricks 1.9.8: `breadcrumbs` element (dynamic: it follows the WordPress page hierarchy; the labels below are what Figma shows).
//   source: includes/elements/breadcrumbs.php (homeLabel, gap, separatorType, separatorIcon, itemTypography, currentItemTypography)
// The node is the row that holds the texts and the separator icon. First text = home label, last text = current page.
// params: none.  Dynamic on purpose (owner decision): a page called differently from Figma shows its own title.
import { typography } from '../render/text.mjs';
import { px } from '../render/utils/css.mjs';
import { svgIcon, svgNode } from './helpers.mjs';

function texts(n, acc = []) {
  if (n.visible === false) return acc;
  if (n.type === 'TEXT' && !n.svg) acc.push(n);
  (n.children ?? []).forEach((c) => texts(c, acc));
  return acc;
}

export default {
  id: 'breadcrumbs',
  status: 'implemented',
  label: 'Breadcrumbs',
  figma: 'a row with a home text, a separator icon and the current page text',
  bricks: '`breadcrumbs` element: home label, item + current item typography, separator icon, gap',
  limits: 'dynamic (page hierarchy): the current-page text follows the WordPress page, not Figma; links point to real pages',
  mergesChildren: true,
  kind: () => 'breadcrumbs',

  check(node) {
    const t = texts(node);
    if (t.length < 2) return { ok: false, reason: `needs a home text and a current-page text, found ${t.length} text(s)` };
    return { ok: true, warnings: [`dynamic element: the current page text "${t.at(-1).text.characters}" will be the WordPress page title`] };
  },

  apply({ node, s }) {
    const t = texts(node);
    s.homeLabel = t[0].text.characters;
    s.itemTypography = typography(t[0]);
    s.currentItemTypography = typography(t.at(-1));
    const sep = svgNode(node);
    if (sep) { s.separatorType = 'icon'; s.separatorIcon = svgIcon(sep); }
    if (node.layout) s.gap = px(node.layout.gap);
  },
};
