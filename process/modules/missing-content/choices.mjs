// Plan lines stay the words the owner typed. The chat reads those words and writes a choice.
// This module only accepts a choice. It does not match synonyms.

export const Choice = {
  type: ['section', 'header', 'footer', 'popup', 'content', 'archive', 'search', 'error'],
  part: ['keep', 'drop'],
  guess: ['unset', 'attach', 'drop'],
  repeat: ['unset', 'slider', 'tab', 'menu', 'form', 'accordion', 'button'],
  mobileform: ['slider'],
  confirm: ['keep-block', 'accordion'],
  loop: ['stop', 'wrap'],
  act: ['expand', 'link', 'none'],
  autoplay: ['off', 'on'],
  link: ['empty', 'url'],
  video: ['empty', 'url'],
  alt: ['decorative', 'text'],
  answer: ['empty', 'text'],
  pane: ['keep', 'figma', 'text'],
  items: ['keep', 'figma'],
  expand: ['keep', 'figma', 'text'],
  count: ['unset', 'set'],
  sync: ['all', 'unchanged', 'text', 'no-icon'],
  keep: ['static'],
  tabopen: ['unset', 'title'],
  tabdata: ['unset', 'name'],
  expect: ['unset', 'block', 'slider', 'tab', 'menu', 'form', 'accordion', 'button'],
};

export const MISSING = '[Chưa có value]';

export const REPEAT_COMPONENT = {
  slider: 'carousel',
  tab: 'tabs',
  menu: 'menu',
  form: 'form',
  accordion: 'accordion',
  button: 'button',
};

const DEFAULTS = {
  type: { choice: 'section' },
  part: { choice: 'keep' },
  guess: { choice: 'unset' },
  repeat: { choice: 'unset' },
  mobileform: { choice: 'slider' },
  confirm: { choice: 'keep-block' },
  loop: { choice: 'wrap' },
  act: { choice: 'expand' },
  autoplay: { choice: 'on', seconds: 3 },
  link: { choice: 'empty' },
  video: { choice: 'empty' },
  alt: { choice: 'decorative' },
  answer: { choice: 'empty' },
  pane: { choice: 'keep' },
  items: { choice: 'keep' },
  expand: { choice: 'keep' },
  count: { choice: 'unset' },
  sync: { choice: 'all' },
  keep: { choice: 'static' },
  tabopen: { choice: 'unset' },
  tabdata: { choice: 'unset' },
  expect: { choice: 'unset' },
};

export function choiceOf(group, value) {
  const allowed = Choice[group];
  if (!allowed) return null;
  if (value && typeof value === 'object' && !Array.isArray(value) && allowed.includes(value.choice)) return value;
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text === MISSING) return { ...DEFAULTS[group] };
  if (allowed.includes(text)) return { choice: text };
  return null;
}

export function resolvePlan(raw, choices = {}, printedOf = () => '') {
  const ready = {};
  const open = [];
  for (const [key, value] of Object.entries(raw ?? {})) {
    const group = key.split(':')[0];
    if (!Choice[group]) continue;
    const preferred = Object.prototype.hasOwnProperty.call(choices, key) ? choices[key] : value;
    const picked = choiceOf(group, preferred);
    if (!picked) open.push({ key, text: typeof value === 'string' ? value : '' });
    else ready[key] = picked;
  }
  return { ready, open };
}
