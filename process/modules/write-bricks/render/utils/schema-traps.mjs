// Keys Bricks 1.12.3 ignores. The list lives here. Theme source is the check.
// A hit means the setting never becomes CSS, so the picture is wrong while the JSON still looks valid.
const NESTABLE = new Set(['container', 'block', 'div', 'section']);

// Theme defaults that override a missing key. Filled only when the renderer left the key empty,
// so a width or a wrap taken from Figma is kept.
export function sealThemeDefaults(elements) {
  for (const el of elements ?? []) {
    const settings = el.settings ??= {};
    if (el.name === 'container' && settings._width == null) settings._width = '100%';
    if ((el.name === 'block' || el.name === 'div') && settings._direction === 'row' && settings._flexWrap == null) settings._flexWrap = 'nowrap';
    if ((el.name === 'block' || el.name === 'div') && Number(settings._flexShrink) === 0 && settings._width == null) settings._width = 'auto';
  }
  return elements;
}

export function schemaTraps(elements) {
  const hits = [];
  for (const el of elements ?? []) {
    const settings = el.settings ?? {};
    if (el.name === 'container' && settings._width == null) hits.push({ id: el.id, key: '_width', msg: 'a container without _width stays 1100px at every screen' });
    if ((el.name === 'block' || el.name === 'div') && settings._direction === 'row' && settings._flexWrap == null) hits.push({ id: el.id, key: '_flexWrap', msg: 'below 767px the theme forces flex-wrap:wrap unless _flexWrap is set' });
    if ((el.name === 'block' || el.name === 'div') && Number(settings._flexShrink) === 0 && settings._width == null) hits.push({ id: el.id, key: '_width', msg: 'flex-shrink 0 on a block with no _width stretches to the theme width of 100%' });
    for (const key of Object.keys(settings)) {
      const base = key.split(':')[0];
      if (base === '_borderRadius') hits.push({ id: el.id, key, msg: 'radius belongs in _border.radius' });
      else if (base === '_minWidth' || base === '_maxWidth') hits.push({ id: el.id, key, msg: `use ${base === '_minWidth' ? '_widthMin' : '_widthMax'}` });
      else if (base === '_color') hits.push({ id: el.id, key, msg: 'text color belongs in _typography.color' });
      else if (base === '_gap' && NESTABLE.has(el.name)) hits.push({ id: el.id, key, msg: '_gap does not compile on a container. Use _columnGap and _rowGap' });
      else if (base === '_cssCustom' && typeof settings[key] === 'string' && settings[key].includes('%root%')) hits.push({ id: el.id, key, msg: '%root% is left as text. The selector has to be #brxe-<id> before save' });
      else if (base === '_cssCustom' && typeof settings[key] === 'string' && /#[\w-]*:(?:tablet_portrait|mobile_landscape|mobile_portrait)\s*\{/.test(settings[key])) {
        hits.push({ id: el.id, key, msg: 'a breakpoint name inside a selector never matches. Use a real @media rule or the key _cssCustom:<breakpoint>' });
      } else if (base === '_cssCustom' && settings._cssId && typeof settings[key] === 'string' && settings[key].includes(`#brxe-${el.id}`)) {
        hits.push({ id: el.id, key, msg: 'a custom id replaces #brxe-<id>, so this selector never matches' });
      }
    }
    if (typeof settings.text === 'string' && /[^\s>]<br>\S/.test(settings.text)) {
      hits.push({ id: el.id, key: 'text', msg: 'a <br> with no space before it glues the two words when the break is hidden' });
    }
  }
  return hits;
}
