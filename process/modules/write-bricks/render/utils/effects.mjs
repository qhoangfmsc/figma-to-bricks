// Figma effects. DROP_SHADOW and INNER_SHADOW become box-shadow. Blur is blur.mjs.
// One shadow uses the Bricks control. Several shadows are one CSS list, in Figma order.
import { addCustomCss, colorObj, cssColor, px } from '../../../write-bricks/render/utils/css.mjs';
import { applyBlur, isBlur } from '../../../write-bricks/render/utils/blur.mjs';

const shadowCss = (effect) => `${effect.type === 'INNER_SHADOW' ? 'inset ' : ''}${px(effect.x)} ${px(effect.y)} ${px(effect.blur)} ${px(effect.spread ?? 0)} ${cssColor(effect)}`;

function writeTextShadows(node, settings, warn, css) {
  const drops = (node.effects ?? []).filter((effect) => effect.type === 'DROP_SHADOW');
  const solid = (node.fills ?? []).some((fill) => fill.type === 'SOLID' && fill.visible !== false);
  const clipped = !solid && (node.fills ?? []).some((fill) => fill.type === 'GRADIENT_LINEAR' && fill.visible !== false);
  if (drops.length && clipped) addCustomCss(settings, `filter: ${drops.map((effect) => `drop-shadow(${px(effect.x)} ${px(effect.y)} ${px(effect.blur)} ${cssColor(effect)})`).join(' ')};`);
  else if (drops.length) {
    const value = drops.map((effect) => `${px(effect.x)} ${px(effect.y)} ${px(effect.blur)} ${cssColor(effect)}`).join(', ');
    addCustomCss(settings, `text-shadow: ${value};`);
    if (css) css['text-shadow'] = value;
  }
  if ((node.effects ?? []).some((effect) => effect.type === 'INNER_SHADOW')) warn(node, 'inner shadow on text is not supported');
  if ((node.effects ?? []).some((effect) => effect.spread)) warn(node, 'text shadow spread is not applicable to text-shadow: ignored');
}

function writeBoxShadows(shadows, strokeShadows, settings) {
  if (strokeShadows.length) {
    addCustomCss(settings, `box-shadow: ${[...strokeShadows, ...shadows.map(shadowCss)].join(', ')};`);
    return;
  }
  if (shadows.length > 1) {
    addCustomCss(settings, `box-shadow: ${shadows.map(shadowCss).join(', ')};`);
    return;
  }
  if (!shadows.length) return;
  const effect = shadows[0];
  settings._boxShadow = {
    values: { offsetX: String(effect.x), offsetY: String(effect.y), blur: String(effect.blur), spread: String(effect.spread) },
    color: colorObj(effect),
    ...(effect.type === 'INNER_SHADOW' && { inset: true }),
  };
}

function warnUnknown(node, warn) {
  for (const effect of node.effects ?? []) {
    if (!effect.hex && !isBlur(effect)) warn(node, `effect ${effect.type} is not supported yet`);
  }
}

export function applyEffects(ctx) {
  const { node, s, warn } = ctx;
  if (node.type === 'TEXT' && !node.svg) {
    writeTextShadows(node, s, warn, ctx.css);
    applyBlur(ctx);
    warnUnknown(node, warn);
    return;
  }
  let shadows = (node.effects ?? []).filter((effect) => effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW');
  const painted = (node.fills ?? []).some((fill) => fill && fill.visible !== false) || node.stroke || (node.strokes ?? []).some((stroke) => stroke && stroke.visible !== false);
  const paintsChildren = (node.children ?? []).some((child) => child && child.visible !== false);
  if (!node.svg && !painted && paintsChildren && node.type !== 'TEXT') {
    const drops = shadows.filter((effect) => effect.type === 'DROP_SHADOW');
    if (drops.length) {
      addCustomCss(s, `filter: ${drops.map((effect) => `drop-shadow(${px(effect.x)} ${px(effect.y)} ${px(effect.blur)} ${cssColor(effect)})`).join(' ')};`);
      if (drops.some((effect) => effect.spread)) warn(node, `group drop shadow spread ${drops.map((effect) => effect.spread).join(' / ')}px is not applicable to filter: drop-shadow(): ignored (limit)`);
      shadows = shadows.filter((effect) => effect.type !== 'DROP_SHADOW');
    }
  }
  writeBoxShadows(shadows, ctx.strokeShadows ?? [], s);
  applyBlur(ctx);
  warnUnknown(node, warn);
}

