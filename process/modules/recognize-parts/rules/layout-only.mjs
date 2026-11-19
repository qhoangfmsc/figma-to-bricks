// A domain lookup stays a picture of the layout. This file does not invent a sign-up URL.
// A price table and a comparison table are not that picture: each one needs an id and renders that id.
// A normal search field and a normal link button are unchanged.
import { textsOf, visibleKids } from './shape.mjs';

const DOMAIN = /tên miền|ten mien|\bdomain\b/i;
const PRICE = /\d[\d.,]*\s*đ|\/\s*(?:tháng|thang|năm|nam)\b/i;

function parentOf(root, id) {
  let found = null;
  (function walk(n) {
    for (const c of n?.children ?? []) {
      if (!c) continue;
      if (c.id === id) { found = n; return; }
      walk(c);
      if (found) return;
    }
  })(root);
  return found;
}

function contains(n, id) {
  return n?.id === id || (n?.children ?? []).some((c) => contains(c, id));
}

function blob(n) {
  return textsOf(n).map((t) => t.text.characters).join(' ');
}

export function isDomainLookup(n) {
  return DOMAIN.test(blob(n));
}

export function showsPrice(node) {
  return PRICE.test(blob(node));
}

export function layoutOnlyReason(node, root) {
  if (!node || !root) return null;
  const parent = parentOf(root, node.id);
  if (parent && isDomainLookup(parent)) return 'domain';
  let current = node;
  while (current && current !== root) {
    const holder = parentOf(root, current.id);
    if (!holder) break;
    const priced = visibleKids(holder).filter((c) => PRICE.test(blob(c)));
    if (priced.length >= 2 && priced.some((c) => contains(c, node.id))) return 'price';
    current = holder;
  }
  return null;
}
