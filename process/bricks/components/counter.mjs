// COMPONENT counter: a big number that counts up ("80,000+", "97%", "12").
// Bricks 1.9.8: `counter` element (countFrom, countTo, prefix, suffix, thousandSeparator, typography per part).
//   source: includes/elements/counter.php
// The node is the TEXT of the number. "80,000+" -> countTo 80000, thousand separator, suffix "+"; "97%" -> 97, suffix "%".
// Not applicable: no digit, a decimal point or a dot as thousand separator (ambiguous), mixed styles.
// params: none.  Count-up duration is Bricks' default (Figma does not say).
import { typography } from '../render/text.mjs';

const parse = (str) => {
  const m = str.trim().match(/^(\D*?)(\d[\d,]*)(\D*)$/);
  if (!m) return null;
  return { prefix: m[1], digits: m[2], suffix: m[3] };
};

export default {
  id: 'counter',
  status: 'implemented',
  label: 'Counter',
  figma: 'a TEXT node with a number (optionally prefix / suffix such as +, %)',
  bricks: '`counter` element: countTo, thousand separator, prefix, suffix, typography',
  limits: 'the heading tag of the number is lost (a counter is not a heading); duration and easing are Bricks defaults',
  kind: () => 'counter',

  check(node) {
    if (node.type !== 'TEXT' || node.svg) return { ok: false, reason: 'a counter must be a text node' };
    if (node.text?.runs?.length > 1) return { ok: false, reason: 'mixed styles in a counter text' };
    const p = parse(node.text?.characters ?? '');
    if (!p) return { ok: false, reason: `"${node.text?.characters}" is not a number with optional prefix/suffix` };
    return { ok: true };
  },

  apply({ node, s, css }) {
    const p = parse(node.text.characters);
    const ty = typography(node);
    for (const k of ['text', '_typography']) delete s[k];
    for (const k of Object.keys(css)) delete css[k]; // the measured element is the counter wrapper, typography sits on its parts
    Object.assign(s, { countFrom: '0', countTo: p.digits.replace(/,/g, ''), countTypography: ty });
    if (p.digits.includes(',')) Object.assign(s, { thousandSeparator: true, separatorText: ',' });
    if (p.prefix) Object.assign(s, { prefix: p.prefix, prefixTypography: ty });
    if (p.suffix) Object.assign(s, { suffix: p.suffix, suffixTypography: ty });
  },
};
