// Shared by the carousel and menu rules: is a row of items a row of LINKS (one short text each, no picture)?
const visibleKids = (n) => (n.children ?? []).filter((c) => c.visible !== false);
const hasImage = (n) => n.fills?.some((f) => f.type === 'IMAGE') || visibleKids(n).some(hasImage);
const textsOf = (n) => (n.visible === false ? [] : n.type === 'TEXT' && !n.svg && n.text?.characters?.trim() ? [n] : visibleKids(n).flatMap(textsOf));
export const isLinkRow = (kids) => kids.every((k) => textsOf(k).length === 1 && !hasImage(k) && k.box.h <= 80);
