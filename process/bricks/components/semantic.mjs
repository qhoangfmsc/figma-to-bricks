// COMPONENT semantic: the node (and optionally its children) get the HTML tag a developer would use, nothing else changes (the look stays
// exactly the Figma blocks). This is what turns "nested blocks" into ul > li, ol > li, dl > dt/dd, figure > figcaption, article, nav, a…
// Bricks 1.9.8: every block has a `tag` (div, section, a, article, nav, ol, ul, li, aside, address, figure, custom + customTag),
//   source: includes/elements/container.php (tag, customTag), base.php get_tag. `_cssId` is the element id (anchor target).
// params: tag (required) · itemTag (each visible child gets it, e.g. ul > li) · childTags { nodeId: tag } (explicit, wins over itemTag)
//         link (url for tag a; empty -> '#', reported) · itemLink (true: children with itemTag a become links to '#') · id (css id, anchor target)
//         alts { nodeId: text } (alt text of image descendants, only what the owner gave) · caption (node id of a text that becomes figcaption and the alt of images in a figure)
import { addCustomCss } from '../render/utils/css.mjs';
import { tagSettings, tagReset, linkSetting, visibleKids, findNode, MISSING_URL } from './helpers.mjs';

const ALLOWED = new Set(['div', 'section', 'header', 'footer', 'main', 'nav', 'article', 'aside', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'a', 'address', 'p', 'span', 'h2', 'h3', 'h4']);

export default {
  id: 'semantic',
  status: 'implemented',
  label: 'Semantic tags (ul/li, dl, figure, article, nav, a…)',
  figma: 'a container that a developer would write as a list / definition list / figure / article / nav / link card',
  bricks: 'the block keeps its look; `tag` (or custom tag) and, for links, `link` are set on it and its children',
  limits: 'visual values are untouched; tags outside the Bricks select use the custom tag; a link without URL is `#`',

  check(node, det) {
    const p = det.params ?? {};
    if (!p.tag || !ALLOWED.has(p.tag)) return { ok: false, reason: `params.tag must be one of ${[...ALLOWED].join(', ')}` };
    if (p.itemTag && !ALLOWED.has(p.itemTag)) return { ok: false, reason: `params.itemTag "${p.itemTag}" is not supported` };
    if (node.type === 'TEXT') return { ok: false, reason: 'semantic tags apply to containers (use the heading / link components for text)' };
    const warnings = [];
    if (p.tag === 'a' && !p.link) warnings.push(`link has no URL in Figma: written as "${MISSING_URL}" (designer list)`);
    if (p.itemTag === 'a') warnings.push(`${visibleKids(node).length} item link(s) have no URL in Figma: written as "${MISSING_URL}" (designer list)`);
    return { ok: true, warnings };
  },

  apply({ s }, det) {
    const p = det.params;
    Object.assign(s, tagSettings(p.tag));
    const r = tagReset(p.tag);
    for (const [k, v] of Object.entries(r.defaults)) s[k] ??= v;
    for (const c of r.css) addCustomCss(s, c.decl, c.suffix);
    if (p.tag === 'a') s.link = linkSetting(p.link);
    if (p.id) s._cssId = p.id;
  },

  descendants(node, det, { root }) {
    const p = det.params;
    const out = {};
    if (p.itemTag) {
      for (const c of visibleKids(node)) {
        out[c.id] = { settings: { ...tagSettings(p.itemTag), ...(p.itemTag === 'a' && { link: linkSetting(null) }) }, ...tagReset(p.itemTag) };
      }
    }
    for (const [id, tag] of Object.entries(p.childTags ?? {})) {
      const n = findNode(root, id);
      if (!n) continue;
      out[id] = { settings: { ...(out[id]?.settings ?? {}), ...tagSettings(tag), ...(tag === 'a' && { link: linkSetting(null) }) }, ...tagReset(tag) };
    }
    if (p.caption) {
      const cap = findNode(root, p.caption);
      if (cap?.text) {
        out[cap.id] = { settings: { ...tagSettings('figcaption') }, ...tagReset('figcaption') };
        const alt = cap.text.characters.replace(/\s+/g, ' ').trim();
        const imgs = []; // image leaves inside the figure take the caption as their alt (nearby text, owner decision)
        (function walk(n) { if (n.visible === false) return; if (!n.children?.length && n.fills?.some((f) => f.type === 'IMAGE') && n.type !== 'TEXT') imgs.push(n); (n.children ?? []).forEach(walk); })(node);
        for (const i of imgs) out[i.id] = { settings: { altText: alt } };
      }
    }
    for (const [id, alt] of Object.entries(p.alts ?? {})) out[id] = { settings: { ...(out[id]?.settings ?? {}), altText: alt } };
    return out;
  },
};
