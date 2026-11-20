// A domain lookup stays a picture of the layout. This file does not invent a sign-up URL.
// A price table and a comparison table are not that picture: each one needs an id and renders that id.
// An amount is a short number with a currency mark or a unit. The mark is not a word from one country.
// A normal search field and a normal link button are unchanged.
import { textsOf, visibleKids } from './shape.mjs';

const DOMAIN = /tên miền|ten mien|\bdomain\b/i;
const CURRENCY = /[$€£¥₫đ]/i;

function isAmountText(value) {
  const word = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!word || word.length > 32 || !/\d/.test(word)) return false;
  if (!CURRENCY.test(word) && !/\/[\p{L}]{1,12}/u.test(word)) return false;
  const parts = word.split(' ').filter(Boolean);
  if (parts.length > 4) return false;
  let sawNumber = false;
  for (const part of parts) {
    const bare = part.replace(CURRENCY, '');
    if (!bare) continue;
    if (/^[\d][\d.,]*(?:\/[\p{L}]{1,12})?$/u.test(bare) || /^\/[\p{L}]{1,12}$/u.test(bare)) {
      if (/\d/.test(bare)) sawNumber = true;
      continue;
    }
    return false;
  }
  return sawNumber;
}

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
  const words = textsOf(node).map((text) => text.text.characters);
  if (words.some((word) => isAmountText(word))) return true;
  const number = words.some((word) => {
    const bare = word.trim().replace(CURRENCY, '');
    return /\d/.test(bare) && /^[\d][\d.,]*$/.test(bare.replace(/\s/g, ''));
  });
  const unit = words.some((word) => /^\/[\p{L}]{1,12}$/u.test(word.trim()));
  return number && unit;
}

export function layoutOnlyReason(node, root) {
  if (!node || !root) return null;
  const parent = parentOf(root, node.id);
  if (parent && isDomainLookup(parent)) return 'domain';
  let current = node;
  while (current && current !== root) {
    const holder = parentOf(root, current.id);
    if (!holder) break;
    const priced = visibleKids(holder).filter((c) => showsPrice(c));
    if (priced.length >= 2 && priced.some((c) => contains(c, node.id))) return 'price';
    current = holder;
  }
  return null;
}
