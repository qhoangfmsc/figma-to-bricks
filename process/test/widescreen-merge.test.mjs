import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeResponsive } from '../responsive/merge.mjs';

function section(bricksId, figmaId, settings) {
  return {
    tree: { id: figmaId, name: 'Hero', children: [] },
    template: { content: [{ id: bricksId, parent: 0, name: 'section', settings }] },
    mapping: { [figmaId]: { bricksId, element: 'section', verify: true, expect: {} } },
  };
}

test('a wide frame writes min-width css and leaves the narrower breakpoint on its own key', () => {
  const base = section('BASE', 'root', { _width: '1440px', _left: '0px' });
  const tablet = {
    key: 'tablet_portrait',
    maxWidth: 991,
    ...section('TAB', 'troot', { _width: '768px', _left: '0px' }),
    aliases: {},
  };
  const wide = {
    key: 'widescreen',
    minWidth: 1920,
    ...section('WIDE', 'wroot', { _width: '1920px', _left: '12px' }),
    aliases: {},
  };
  const merged = mergeResponsive({ base, variants: [tablet, wide] });
  const settings = merged.template.content[0].settings;
  assert.equal(settings['_width:tablet_portrait'], '768px');
  assert.equal(settings['_width:widescreen'], undefined);
  assert.equal(settings['_left:widescreen'], undefined);
  assert.match(settings._cssCustom, /@media \(min-width: 1920px\)/);
  assert.match(settings._cssCustom, /width: 1920px/);
  assert.match(settings._cssCustom, /left: 12px/);
});

test('mobile landscape is a max-width breakpoint', () => {
  const base = section('BASE', 'root', { _width: '1440px' });
  const land = {
    key: 'mobile_landscape',
    maxWidth: 767,
    ...section('LAND', 'lroot', { _width: '700px' }),
  };
  const merged = mergeResponsive({ base, variants: [land] });
  const settings = merged.template.content[0].settings;
  assert.equal(settings['_width:mobile_landscape'], '700px');
  assert.equal(settings._cssCustom, undefined);
});

test('a transform shared by tablet and mobile still applies on the phone', () => {
  const frame = (id, rootId, transform) => ({
    tree: { id: rootId, name: 'Hero', children: [{ id: `${rootId}b`, name: 'Background', children: [] }] },
    template: {
      content: [
        { id, parent: 0, name: 'section', settings: {} },
        { id: `${id}b`, parent: id, name: 'block', settings: { _cssCustom: `#brxe-${id}b { transform: ${transform}; }` } },
      ],
    },
    mapping: {
      [rootId]: { bricksId: id, element: 'section', verify: true, expect: {} },
      [`${rootId}b`]: { bricksId: `${id}b`, element: 'block', verify: true, expect: {} },
    },
  });
  const merged = mergeResponsive({
    base: frame('BASE', 'root', 'translate(-50%, -50%)'),
    variants: [
      { key: 'tablet_portrait', maxWidth: 991, ...frame('TAB', 'troot', 'translateX(-50%)'), aliases: {} },
      { key: 'mobile_portrait', maxWidth: 478, ...frame('MOB', 'mroot', 'translateX(-50%)'), aliases: {} },
    ],
  });
  const css = merged.template.content.find((el) => el.id === 'BASEb').settings._cssCustom;
  assert.match(css, /@media \(max-width: 991px\) \{ #brxe-BASEb \{ transform: translateX\(-50%\); \} \}/);
  assert.doesNotMatch(css, /min-width: 479px/);
});

test('a different crop stays its own background, a rounding difference stays one picture', () => {
  const frame = (id, rootId, crop) => ({
    tree: {
      id: rootId, name: 'Hero', type: 'FRAME',
      children: [
        { id: `${rootId}bg`, name: 'Background', type: 'GROUP', children: [
          { id: `${rootId}scene`, name: 'Scene', type: 'RECTANGLE', children: [] },
        ] },
        { id: `${rootId}title`, name: 'Title', type: 'TEXT', children: [] },
      ],
    },
    template: {
      content: [
        { id, parent: 0, name: 'section', settings: { _width: '100%' } },
        { id: `${id}bg`, parent: id, name: 'block', settings: { _position: 'absolute', _width: '100%' } },
        { id: `${id}sc`, parent: `${id}bg`, name: 'div', settings: { _width: '80%' } },
        { id: `${id}im`, parent: `${id}sc`, name: 'image', settings: { image: { $asset: 'images/bg.png' }, ...crop } },
        { id: `${id}tx`, parent: id, name: 'heading', settings: { text: 'Title', _width: '200px' } },
      ],
    },
    mapping: {
      [rootId]: { bricksId: id, element: 'section', verify: true, expect: {} },
      [`${rootId}bg`]: { bricksId: `${id}bg`, element: 'block', verify: true, expect: {} },
      [`${rootId}scene`]: { bricksId: `${id}sc`, element: 'div', verify: true, expect: {} },
      [`${rootId}scene#crop`]: { bricksId: `${id}im`, element: 'image', verify: true, expect: {} },
      [`${rootId}title`]: { bricksId: `${id}tx`, element: 'heading', verify: true, expect: {} },
    },
  });
  const crop = { _position: 'absolute', _left: '0%', _top: '-11%', _width: '100%', _height: '114%' };
  const other = { _position: 'absolute', _left: '-127%', _top: '-48%', _width: '355%', _height: '152%' };
  const merged = mergeResponsive({
    base: frame('BASE', 'root', crop),
    variants: [{ key: 'mobile_portrait', maxWidth: 478, ...frame('MOB', 'mroot', other), aliases: {} }],
  });
  const ids = merged.template.content.map((el) => el.id);
  assert.ok(ids.includes('BASEbg') && ids.includes('MOBbg'));
  assert.equal(merged.template.content.filter((el) => el.name === 'image').length, 2);
  assert.equal(merged.template.content.find((el) => el.id === 'BASEbg').settings['_display:mobile_portrait'], 'none');
  const phone = merged.template.content.find((el) => el.id === 'MOBim').settings;
  assert.equal(phone._width, '355%');
  assert.match(merged.template.content.find((el) => el.id === 'MOBbg').settings._cssCustom, /display:\s*none/);
  assert.equal(merged.template.content.filter((el) => el.name === 'heading').length, 1);

  const close = mergeResponsive({
    base: frame('BASE', 'root', crop),
    variants: [{ key: 'mobile_portrait', maxWidth: 478, ...frame('MOB', 'mroot', { ...crop, _top: '-11.4%' }), aliases: {} }],
  });
  assert.equal(close.template.content.filter((el) => el.name === 'image').length, 1);
});

test('an element drawn only on the wide frame stays hidden until that width', () => {
  const base = section('BASE', 'root', { _width: '1440px' });
  const wide = {
    key: 'widescreen',
    minWidth: 1920,
    tree: {
      id: 'wroot',
      name: 'Hero',
      children: [{ id: 'badge', name: 'Badge', children: [] }],
    },
    template: {
      content: [
        { id: 'WIDE', parent: 0, name: 'section', settings: { _width: '1920px' } },
        { id: 'BADGE', parent: 'WIDE', name: 'block', settings: { _display: 'flex', _width: '80px' } },
      ],
    },
    mapping: {
      wroot: { bricksId: 'WIDE', element: 'section', verify: true, expect: {} },
      badge: { bricksId: 'BADGE', element: 'block', verify: true, expect: {} },
    },
  };
  const merged = mergeResponsive({ base, variants: [wide] });
  const badge = merged.template.content.find((el) => el.id === 'BADGE');
  assert.equal(badge.settings._display, 'none');
  assert.match(badge.settings._cssCustom, /@media \(min-width: 1920px\)/);
  assert.match(badge.settings._cssCustom, /display: flex/);
  assert.equal(badge.settings._width, '80px');
});

test('a changed image file is a source at that breakpoint, and the phone is listed before the tablet', () => {
  const frame = (id, rootId, file) => ({
    tree: { id: rootId, name: 'Hero', children: [{ id: `${rootId}p`, name: 'Photo', children: [] }] },
    template: { content: [
      { id, parent: 0, name: 'section', settings: {} },
      { id: `${id}im`, parent: id, name: 'image', settings: { image: { $asset: file } } },
    ] },
    mapping: {
      [rootId]: { bricksId: id, element: 'section', verify: true, expect: {} },
      [`${rootId}p`]: { bricksId: `${id}im`, element: 'image', verify: true, expect: {} },
    },
  });
  const merged = mergeResponsive({
    base: frame('BASE', 'root', 'images/desk.png'),
    variants: [
      { key: 'tablet_portrait', maxWidth: 991, ...frame('TAB', 'troot', 'images/tab.png'), aliases: {} },
      { key: 'mobile_portrait', maxWidth: 478, ...frame('MOB', 'mroot', 'images/desk.png'), aliases: {} },
    ],
  });
  const image = merged.template.content.find((el) => el.name === 'image');
  assert.equal(merged.template.content.filter((el) => el.name === 'image').length, 1);
  assert.equal(image.settings.image.$asset, 'images/desk.png');
  assert.deepEqual(image.settings.sources, [
    { breakpoint: 'mobile_portrait', image: { $asset: 'images/desk.png', size: 'full' } },
    { breakpoint: 'tablet_portrait', image: { $asset: 'images/tab.png', size: 'full' } },
  ]);
});
