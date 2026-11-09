// Dynamic tags. Prefixes are the provider files under
// includes/integrations/dynamic-data/providers/.
// provider-acf.php builds `acf_<field>`. provider-wp.php resolves `cf_<meta key>`.
// provider-woo.php tags start with woo_. A Figma text node is not a tag.
// There is no {shortcode:} tag in 1.12.3.

const NAME = /^[A-Za-z0-9_]+$/;

function tag(prefix, name) {
  const field = String(name ?? '').trim();
  if (!NAME.test(field)) throw new Error(`${prefix} tag needs the field name from the plan`);
  return `{${prefix}${field}}`;
}

export function acfTag(fieldName) {
  return tag('acf_', fieldName);
}

export function metaTag(metaKey) {
  return tag('cf_', metaKey);
}

export function wooTag(name) {
  return tag('woo_', name);
}
