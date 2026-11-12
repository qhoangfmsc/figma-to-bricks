import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeResponsive } from '../modules/breakpoints/merge.mjs';
import { fitAnvRemainder, fitFluid, fitSoloTemplate, holdMobileBand, pxPastScreen, screensToProve } from '../modules/breakpoints/solo.mjs';
import { applyAppearance } from '../modules/write-bricks/render/utils/appearance.mjs';

const el = (id, parent, name, settings = {}) => ({ id, parent, name, settings });

test('a box still wider than an undesigned screen becomes 100% and keeps the Figma px as its cap', () => {
  const row = {
    content: [
      el('row', 0, 'block', { _direction: 'row', _width: '1440px' }),
      el('card', 'row', 'block', { _width: '376px' }),
      el('card2', 'row', 'block', { _width: '376px' }),
      el('title', 'row', 'block', { _cssClasses: 'tab-title', _width: '500px' }),
    ],
  };
  fitSoloTemplate(row);
  fitAnvRemainder(row);
  const by = (id) => row.content.find((e) => e.id === id).settings;
  assert.equal(by('card')._width, '376px');
  assert.equal(by('card')['_width:mobile_portrait'], '100%');
  assert.equal(by('card')['_widthMax:mobile_portrait'], '376px');
  assert.equal(by('row')['_direction:mobile_portrait'], 'column');
  assert.equal(by('title')['_width:mobile_portrait'], undefined);
  const pasted = { content: [el('box', 0, 'block', { _width: '900px' })] };
  fitSoloTemplate(pasted, { keep: ['mobile_portrait', 'mobile_landscape', 'tablet_portrait'] });
  fitAnvRemainder(pasted, { keep: ['mobile_portrait', 'mobile_landscape', 'tablet_portrait'] });
  assert.equal(pasted.content[0].settings['_width:mobile_portrait'], undefined);
  assert.equal(pasted.content[0].settings._width, '900px');
});

test('a missing responsive frame is still measured, and a wide box is not a px width there', () => {
  assert.deepEqual(screensToProve([]).map((s) => s.width), [991, 767, 320]);
  assert.deepEqual(screensToProve([{ key: 'tablet_portrait', maxWidth: 768 }]).map((s) => s.width), [767, 320]);
  assert.deepEqual(screensToProve([{ key: 'mobile_portrait', maxWidth: 375 }, { key: 'mobile_landscape', maxWidth: 768 }, { key: 'tablet_portrait', maxWidth: 991 }]).map((s) => s.width), []);
  const wide = { content: [el('box', 0, 'block', { _width: '900px' })] };
  const column = { content: [el('col', 0, 'block', { _width: '1200px' })] };
  assert.deepEqual(pxPastScreen(wide, 320), ['box']);
  assert.deepEqual(pxPastScreen(column, 991), ['col']);
  fitSoloTemplate(wide);
  fitFluid(wide);
  fitSoloTemplate(column);
  fitFluid(column);
  assert.deepEqual(pxPastScreen(wide, 320), []);
  assert.deepEqual(pxPastScreen(wide, 767), []);
  assert.deepEqual(pxPastScreen(column, 991), []);
});

test('one desktop frame keeps the components and makes them use the screen below desktop', () => {
  const template = {
    content: [
      el('sec', 0, 'section', { _width: '1440px', _height: '900px' }),
      el('acc', 'sec', 'accordion-nested', { _width: '1100px', _height: '480px', _direction: 'column' }),
      el('answer', 'acc', 'text-basic', { text: 'Câu trả lời đã điền' }),
      el('tabs', 'sec', 'tabs-nested', { _width: '1100px', _height: '400px' }),
      el('menu', 'tabs', 'block', { _cssClasses: 'tab-menu', _direction: 'row', _width: '400px' }),
      el('title', 'menu', 'block', { _cssClasses: 'tab-title', _width: '500px' }),
      el('formbox', 'sec', 'block', { _width: '1100px', _height: '360px' }),
      el('form', 'formbox', 'form', { fields: [{ type: 'email', label: 'Email' }] }),
      el('more', 'sec', 'block', { _cssClasses: 'read-more-x', _width: '1100px', _height: '200px' }),
      el('nav', 'sec', 'block', { tag: 'ul', _direction: 'row', _width: '800px' }),
      el('slide', 'sec', 'slider-nested', { _width: '1100px', perPage: 3 }),
      el('card', 'slide', 'block', { _width: '400px' }),
      el('ms', 'sec', 'slider-nested', { _width: '800px', perPage: 4, optionsType: 'custom' }),
      el('icon', 'sec', 'svg', { _position: 'absolute', _width: '24px' }),
      el('narrow', 'sec', 'block', { _width: '400px' }),
    ],
  };
  fitSoloTemplate(template);
  const by = (id) => template.content.find((e) => e.id === id).settings;
  assert.equal(by('acc')['_width:mobile_portrait'], '100%');
  assert.equal(by('acc')['_width:tablet_portrait'], '100%');
  assert.equal(by('acc')['_height:mobile_portrait'], 'auto');
  assert.equal(by('tabs')['_height:mobile_portrait'], 'auto');
  assert.equal(by('formbox')['_height:mobile_portrait'], 'auto');
  assert.equal(by('more')['_height:mobile_portrait'], undefined);
  assert.equal(by('answer').text, 'Câu trả lời đã điền');
  assert.equal(by('form').fields[0].label, 'Email');
  assert.equal(by('more')['_width:mobile_portrait'], '100%');
  assert.equal(by('nav')['_direction:mobile_portrait'], 'column');
  assert.equal(by('nav')['_direction:tablet_portrait'], 'column');
  assert.equal(by('slide')['perPage:mobile_portrait'], 1);
  assert.equal(by('slide')['perPage:mobile_landscape'], 2);
  assert.equal(by('slide')['perPage:tablet_portrait'], 2);
  assert.equal(by('slide').perPage, 3);
  assert.equal(by('card')['_width:mobile_portrait'], '100%');
  assert.equal(by('ms')['perPage:mobile_portrait'], undefined);
  assert.equal(by('narrow')['_width:mobile_portrait'], '100%');
  assert.equal(by('narrow')['_width:tablet_portrait'], undefined);
  assert.equal(by('title')['_width:mobile_portrait'], undefined);
  assert.match(by('menu')._cssCustom, /overflow-x: auto/);
  assert.equal(by('menu')['_direction:mobile_portrait'], undefined);
  assert.equal(by('icon')['_width:mobile_portrait'], undefined);
});

test('an absolute content frame joins the flow below desktop and a pinned icon stays', () => {
  const template = {
    content: [
      el('sec', 0, 'block', { _width: '100%', _height: '650px', _position: 'relative' }),
      el('box', 'sec', 'block', { _position: 'absolute', _left: '332px', _top: '92px', _width: '1232px', _height: '389px' }),
      el('title', 'box', 'text-basic', { text: 'LỢI ÍCH KHI THAM DỰ SỰ KIỆN NÀY' }),
      el('row', 'box', 'block', { _width: 'auto', _direction: 'row' }),
      el('c1', 'row', 'block', { _width: '376px' }),
      el('c2', 'row', 'block', { _width: '376px' }),
      el('icon', 'sec', 'svg', { _position: 'absolute', _left: '10px', _width: '24px' }),
      el('art', 'sec', 'image', { _position: 'absolute', _left: '0px', _width: '1905px', _height: '650px' }),
    ],
  };
  fitSoloTemplate(template);
  const by = (id) => template.content.find((e) => e.id === id).settings;
  assert.equal(by('box')._position, 'absolute');
  assert.equal(by('box')._left, '332px');
  assert.equal(by('box')._width, '1232px');
  assert.match(by('box')._cssCustom, /@media \(max-width: 991px\)/);
  assert.match(by('box')._cssCustom, /position: relative/);
  assert.match(by('box')._cssCustom, /width: 100%/);
  assert.equal(by('row')['_direction:tablet_portrait'], 'column');
  assert.equal(by('row')['_width:mobile_portrait'], '100%');
  assert.equal(by('row')._width, 'auto');
  assert.equal(by('sec')['_height:tablet_portrait'], 'auto');
  assert.equal(by('sec')['_height:mobile_portrait'], 'auto');
  assert.match(by('sec')._cssCustom, /overflow-x: hidden/);
  assert.equal(by('sec')._height, '650px');
  assert.equal(by('icon')._cssCustom, undefined);
  assert.equal(by('art')._cssCustom, undefined);
});

test('without a phone frame, a pinned group keeps its fraction of the card and the heading leaves room for the icon', () => {
  const template = {
    content: [
      el('card', 0, 'block', { _width: '376px', _height: '312px', _position: 'relative' }),
      el('group', 'card', 'block', {
        _position: 'absolute', _left: '111px', _top: '17px', _width: '188px', _height: '108px', _direction: 'row',
      }),
      el('label', 'group', 'heading', {
        text: '01', _width: 'auto', _typography: { 'font-size': '72px', 'line-height': '72px', 'white-space': 'nowrap' },
      }),
      el('icon', 'group', 'block', { _width: '103px', _position: 'relative' }),
    ],
  };
  fitSoloTemplate(template);
  const by = (id) => template.content.find((e) => e.id === id).settings;
  assert.equal(by('group')._left, '111px');
  assert.equal(by('group')._width, '188px');
  assert.equal(by('group')['_left:mobile_portrait'], '29.5213%');
  assert.equal(by('group')['_width:mobile_portrait'], '50%');
  assert.equal(by('group')['_top:tablet_portrait'], '5.4487%');
  assert.equal(by('group')['_height:mobile_portrait'], undefined);
  assert.equal(by('label')['_width:mobile_portrait'], undefined);
  assert.equal(by('label')['_typography:mobile_portrait']['font-size'], '48px');
  assert.equal(by('icon')._width, '103px');
  const bullet = {
    content: [
      el('row', 0, 'block', { _direction: 'row', _width: 'auto' }),
      el('mark', 'row', 'svg', { _width: '14px' }),
      el('line', 'row', 'text-basic', { _width: '326px', _flexShrink: 0, text: 'Bảo vệ dữ liệu khách hàng an toàn' }),
    ],
  };
  fitSoloTemplate(bullet);
  const line = bullet.content.find((e) => e.id === 'line').settings;
  const row = bullet.content.find((e) => e.id === 'row').settings;
  assert.equal(line._width, '326px');
  assert.equal(line['_width:mobile_portrait'], 'auto');
  assert.equal(line['_flexGrow:mobile_portrait'], 1);
  assert.equal(line['_widthMin:mobile_portrait'], '0px');
  assert.equal(row['_width:mobile_portrait'], '100%');
  assert.equal(bullet.content.find((e) => e.id === 'mark').settings['_width:mobile_portrait'], undefined);
  const cards = {
    content: [
      el('row', 0, 'block', { _direction: 'row', _width: 'auto' }),
      el('a', 'row', 'block', { _width: '376px' }),
      el('b', 'row', 'block', { _width: '376px' }),
    ],
  };
  fitSoloTemplate(cards);
  assert.notEqual(cards.content.find((e) => e.id === 'a').settings['_width:tablet_portrait'], 'auto');
});

test('a wide-frame inset becomes a 24px gutter below desktop, and a hug box stays inside its parent', () => {
  const template = {
    content: [
      el('sec', 0, 'block', { _width: '100%', _padding: { top: '76px', right: '382px', bottom: '76px', left: '382px' } }),
      el('hug', 'sec', 'block', { _width: 'auto', _widthMax: 'none' }),
    ],
  };
  fitSoloTemplate(template);
  const by = (id) => template.content.find((e) => e.id === id).settings;
  assert.equal(by('sec')._padding.left, '382px');
  assert.equal(by('sec')['_padding:tablet_portrait'].left, '24px');
  assert.equal(by('sec')['_padding:mobile_portrait'].right, '24px');
  assert.equal(by('sec')['_padding:tablet_portrait'].top, '52px');
  assert.equal(by('hug')._widthMax, 'none');
  assert.equal(by('hug')['_widthMax:mobile_portrait'], '100%');
  const line = {
    content: [el('line', 0, 'text-basic', { _typography: { 'font-size': '28px', 'white-space': 'pre' } })],
  };
  fitSoloTemplate(line);
  const ty = line.content[0].settings;
  assert.equal(ty._typography['white-space'], 'pre');
  assert.equal(ty['_typography:mobile_portrait']['white-space'], 'pre-wrap');
  const short = {
    content: [el('short', 0, 'text-basic', { _typography: { 'font-size': '18px', 'white-space': 'pre' } })],
  };
  fitSoloTemplate(short);
  assert.equal(short.content[0].settings['_typography:mobile_portrait']['white-space'], 'pre-wrap');
});

test('a fixed column wider than the padded content box keeps its Figma width', () => {
  const template = {
    content: [
      el('sec', 0, 'block', { _width: '100%', _padding: { top: '76px', right: '382px', bottom: '76px', left: '382px' } }),
      el('col', 'sec', 'block', { _width: '1200px', _widthMax: 'none' }),
      el('fit', 'sec', 'block', { _width: '1107px', _widthMax: '100%' }),
    ],
  };
  fitFluid(template, { frameWidth: 1905 });
  const by = (id) => template.content.find((e) => e.id === id).settings;
  assert.equal(by('col')._width, '1200px');
  assert.equal(by('col')._widthMax, 'none');
  assert.doesNotMatch(by('col')._cssCustom ?? '', /(?:^|[^-])width: 100%/);
  assert.equal(by('fit')._width, '1107px');
  assert.match(by('fit')._cssCustom, /max-width: 1904px/);
  assert.match(by('fit')._cssCustom, /width: 100%/);
});

test('a desktop form beside a column stacks once the window cannot hold both', () => {
  const template = {
    content: [
      el('sec', 0, 'section', { _width: '100%', _padding: { top: '120px', right: '10px', bottom: '120px', left: '10px' } }),
      el('row', 'sec', 'block', { _width: 'auto', _widthMax: 'none', _direction: 'row', _columnGap: '128px', _flexShrink: 0 }),
      el('left', 'row', 'block', { _width: '644px', _widthMax: '100%', _flexShrink: 0 }),
      el('right', 'row', 'block', { _width: 'auto', _widthMax: 'none', _direction: 'column', _flexShrink: 0 }),
      el('form', 'right', 'block', { _width: '481px', _widthMax: 'none', _flexShrink: 0 }),
    ],
  };
  fitFluid(template, { frameWidth: 1905 });
  const by = (id) => template.content.find((e) => e.id === id).settings;
  assert.equal(by('form')._width, '481px');
  assert.equal(by('form')._widthMax, 'none');
  assert.equal(by('row')._direction, 'row');
  assert.match(by('row')._cssCustom, /@media \(max-width: 1279px\) \{ body #brxe-row \{ flex-direction: column; width: 100%; max-width: 100%; \}/);
  assert.match(by('left')._cssCustom, /@media \(max-width: 1279px\)/);
  assert.doesNotMatch(by('left')._cssCustom, /max-width: 1904px/);
  assert.match(by('form')._cssCustom, /@media \(max-width: 639px\) \{ #brxe-form \{ max-width: 100%; \}/);
  assert.equal(pxPastScreen(template, 1905).includes('form'), false);
});

test('a row of pieces that cannot fit a phone stacks, and a pasted phone frame is not restacked', () => {
  const pieces = {
    content: [
      el('row', 0, 'block', { _width: 'auto', _direction: 'row', _columnGap: '16px' }),
      el('a', 'row', 'block', { _width: '140px' }),
      el('b', 'row', 'block', { _width: '140px' }),
      el('c', 'row', 'block', { _width: '140px' }),
      el('d', 'row', 'block', { _width: '140px' }),
    ],
  };
  fitFluid(pieces, { frameWidth: 1440 });
  const row = pieces.content[0].settings;
  assert.equal(row._direction, 'row');
  assert.match(row._cssCustom, /@media \(max-width: 639px\) \{ body #brxe-row \{ flex-direction: column; width: 100%; max-width: 100%; \}/);
  const narrow = {
    content: [
      el('row', 0, 'block', { _width: 'auto', _direction: 'row' }),
      el('a', 'row', 'block', { _width: '100px' }),
      el('b', 'row', 'block', { _width: '100px' }),
    ],
  };
  fitFluid(narrow, { frameWidth: 1440 });
  assert.equal(narrow.content[0].settings._cssCustom, undefined);
  const pasted = {
    content: [
      el('row', 0, 'block', { _width: 'auto', _direction: 'row', _columnGap: '128px' }),
      el('left', 'row', 'block', { _width: '644px' }),
      el('form', 'row', 'block', { _width: '481px', _widthMax: 'none' }),
    ],
  };
  fitFluid(pasted, { frameWidth: 1905, coveredUntil: 478 });
  const pastedRow = pasted.content[0].settings._cssCustom;
  assert.match(pastedRow, /min-width: 479px/);
  assert.match(pastedRow, /flex-direction: column/);
  const kept = {
    content: [el('box', 0, 'block', { _width: '900px', '_width:mobile_portrait': '280px', _padding: { top: '80px', right: '80px', bottom: '80px', left: '80px' } })],
  };
  fitSoloTemplate(kept, { keep: ['mobile_portrait'] });
  const box = kept.content[0].settings;
  assert.equal(box['_width:mobile_portrait'], '280px');
  assert.equal(box['_width:tablet_portrait'], '100%');
  assert.equal(box['_padding:mobile_portrait'], undefined);
  assert.equal(box['_padding:tablet_portrait'].left, '52px');
  const drawn = {
    content: [
      el('row', 0, 'block', { _direction: 'row', _width: '1048px', _columnGap: '16px' }),
      el('card', 'row', 'block', { _width: 'auto', _flexBasis: '250px', _flexGrow: 1, '_flexBasis:tablet_portrait': '175px' }),
      el('card2', 'row', 'block', { _width: 'auto', _flexBasis: '250px', _flexGrow: 1, '_flexBasis:tablet_portrait': '175px' }),
    ],
  };
  fitFluid(drawn, { frameWidth: 1440, keep: ['tablet_portrait', 'mobile_portrait'] });
  const card = drawn.content.find((e) => e.id === 'card').settings;
  const drawnRow = drawn.content[0].settings;
  assert.equal(drawnRow['_direction:tablet_portrait'], undefined);
  assert.equal(drawnRow['_direction:mobile_landscape'], 'column');
  assert.equal(card['_width:tablet_portrait'], undefined);
  assert.equal(card['_flexBasis:tablet_portrait'], '175px');
  assert.equal(card['_width:mobile_landscape'], '250px');
});

test('shrinking cards stay one row above a pasted tablet frame, and an inset panel follows its bar', () => {
  const cards = ['a', 'b', 'c', 'd'].map((id) => el(id, 'row', 'block', {
    _width: 'auto', _flexBasis: '250px', _flexGrow: 1, _flexShrink: 1, _widthMin: '0px',
  }));
  const template = {
    content: [
      el('sec', 0, 'section', { _width: '100%', _padding: { top: '0px', right: '20px', bottom: '0px', left: '20px' } }),
      el('row', 'sec', 'block', { _direction: 'row', _width: '1048px', _widthMax: '100%', _columnGap: '16px', _flexWrap: 'nowrap' }),
      ...cards,
      el('bar', 'sec', 'block', { _width: '1031px', _widthMax: '100%' }),
      el('panel', 'bar', 'block', { _position: 'absolute', _left: '15px', _width: '1001px', _height: '104px' }),
      el('glow', 'bar', 'block', { _position: 'absolute', _left: '-94px', _width: '1388px' }),
    ],
  };
  fitFluid(template, { frameWidth: 1440, coveredUntil: 991, keep: ['tablet_portrait', 'mobile_portrait'] });
  const by = (id) => template.content.find((e) => e.id === id).settings;
  assert.equal(by('row')._direction, 'row');
  assert.equal(by('row')['_direction:tablet_portrait'], undefined);
  assert.equal(by('row')['_direction:mobile_landscape'], 'column');
  assert.doesNotMatch(by('row')._cssCustom ?? '', /flex-direction:\s*column/);
  assert.match(by('row')._cssCustom, /max-width: 1279px\) and \(min-width: 992px\) \{ #brxe-row \{ flex-wrap: nowrap/);
  assert.equal(by('a')['_width:tablet_portrait'], undefined);
  assert.equal(by('a')['_flexBasis:tablet_portrait'], undefined);
  assert.equal(by('panel')._width, '1001px');
  assert.equal(by('panel')._left, '15px');
  assert.match(by('panel')._cssCustom, /min-width: 992px/);
  assert.match(by('panel')._cssCustom, /calc\(100% - 30px\)/);
  assert.match(by('panel')._cssCustom, /max-width: 1001px/);
  assert.equal(by('glow')._cssCustom, undefined);
  const open = {
    content: [
      el('row', 0, 'block', { _direction: 'row', _width: '1048px', _columnGap: '16px' }),
      ...['a', 'b', 'c', 'd'].map((id) => el(id, 'row', 'block', { _width: 'auto', _flexBasis: '250px', _flexShrink: 1 })),
    ],
  };
  fitFluid(open, { frameWidth: 1440 });
  const openRow = open.content[0].settings._cssCustom;
  assert.match(openRow, /@media \(max-width: 767px\) \{ body #brxe-row \{ flex-direction: column/);
  assert.match(openRow, /@media \(max-width: 1279px\) \{ #brxe-row \{ flex-wrap: nowrap/);
});

test('a pasted phone frame holds until the tablet frame', () => {
  const template = {
    content: [
      el('row', 0, 'block', {
        _direction: 'row', _display: 'flex', '_display:mobile_portrait': 'grid',
        '_direction:mobile_landscape': 'column',
        _cssCustom: '@media (max-width: 478px) { #brxe-row { grid-template-columns: repeat(2,minmax(0,1fr)); } }',
      }),
      el('card', 'row', 'block', {
        _width: 'auto', _flexBasis: '250px', _flexGrow: 1,
        '_flexBasis:mobile_portrait': 'auto', '_flexGrow:mobile_portrait': 0,
        '_width:mobile_landscape': '250px', '_flexGrow:mobile_landscape': 0, '_flexBasis:mobile_landscape': 'auto',
      }),
      el('phoneOnly', 0, 'text-basic', {
        _cssCustom: '@media (min-width: 479px) and (max-width: 991px) { body #brxe-phoneOnly { display: none; } } @media (min-width: 479px) { body #brxe-phoneOnly { display: none; } }',
      }),
      el('tabletOnly', 0, 'block', { '_display:mobile_portrait': 'none' }),
    ],
  };
  holdMobileBand(template, { keep: ['mobile_portrait', 'tablet_portrait'] });
  const by = (id) => template.content.find((e) => e.id === id).settings;
  assert.equal(by('row')['_display:mobile_landscape'], 'grid');
  assert.equal(by('row')['_direction:mobile_landscape'], undefined);
  assert.match(by('row')._cssCustom, /max-width: 767px/);
  assert.doesNotMatch(by('row')._cssCustom, /478px/);
  assert.equal(by('card')['_width:mobile_landscape'], undefined);
  assert.equal(by('card')['_flexBasis:mobile_landscape'], 'auto');
  assert.equal(by('card')['_flexGrow:mobile_landscape'], 0);
  assert.match(by('phoneOnly')._cssCustom, /min-width: 768px\) and \(max-width: 991px\)/);
  assert.match(by('phoneOnly')._cssCustom, /@media \(min-width: 768px\) \{ body #brxe-phoneOnly \{ display: none; \}/);
  assert.doesNotMatch(by('phoneOnly')._cssCustom, /min-width: 479px/);
  assert.equal(by('tabletOnly')['_display:mobile_landscape'], 'none');
  const landscapeFrame = { content: [el('row', 0, 'block', { '_direction:mobile_landscape': 'row', '_direction:mobile_portrait': 'column' })] };
  holdMobileBand(landscapeFrame, { keep: ['mobile_portrait', 'mobile_landscape'] });
  assert.equal(landscapeFrame.content[0].settings['_direction:mobile_landscape'], 'row');
});

test('every width shows the desktop version or the phone version, and a row stacks only while it does not fit', () => {
  const template = {
    content: [
      el('desk', 0, 'block', { _display: 'flex', '_display:mobile_portrait': 'none' }),
      el('phone', 0, 'block', { _display: 'flex', _cssCustom: '@media (min-width: 479px) { body #brxe-phone { display: none; } }' }),
      el('row', 'phone', 'block', {
        _direction: 'row',
        '_direction:tablet_portrait': 'column',
        '_direction:mobile_landscape': 'column',
        '_width:mobile_portrait': 'auto',
        _cssCustom: '@media (max-width: 639px) and (min-width: 479px) { body #brxe-row { flex-direction: column; width: 100%; max-width: 100%; } }',
      }),
    ],
  };
  holdMobileBand(template, { keep: ['mobile_portrait'] });
  const by = (id) => template.content.find((e) => e.id === id).settings;
  const hidden = (settings, width) => {
    const bp = width <= 478 ? ['mobile_portrait', 'mobile_landscape', 'tablet_portrait']
      : width <= 767 ? ['mobile_landscape', 'tablet_portrait']
        : width <= 991 ? ['tablet_portrait'] : [];
    if (bp.some((key) => settings[`_display:${key}`] === 'none')) return true;
    return [...String(settings._cssCustom ?? '').matchAll(/@media \(([^)]+)\) \{[^}]*display:\s*none/g)].some((match) => {
      const min = /min-width:\s*(\d+)/.exec(match[1]);
      const max = /max-width:\s*(\d+)/.exec(match[1]);
      if (min && width < Number(min[1])) return false;
      if (max && width > Number(max[1])) return false;
      return true;
    });
  };
  for (const width of [320, 478, 479, 640, 767, 768, 991, 992, 1440]) {
    const desk = hidden(by('desk'), width);
    const phone = hidden(by('phone'), width);
    assert.equal(desk === phone, false, `${width}px hides desk ${desk} and phone ${phone}`);
  }
  assert.match(by('row')._cssCustom, /@media \(max-width: 639px\) and \(min-width: 479px\) \{ body #brxe-row \{ flex-direction: column/);
  assert.doesNotMatch(by('row')._cssCustom, /max-width: 639px\) and \(min-width: 768px\)/);
  assert.equal(by('row')['_direction:mobile_landscape'], 'column');
  assert.equal(by('desk')['_display:mobile_landscape'], 'none');
});

test('a phone row wider than the phone breakpoint stacks there, a row that fits stays as drawn', () => {
  const wide = {
    content: [
      el('row', 0, 'block', { _direction: 'row', _width: 'auto', _columnGap: '16px' }),
      el('a', 'row', 'block', { _width: '280px' }),
      el('b', 'row', 'block', { _width: '280px' }),
    ],
  };
  fitFluid(wide, { frameWidth: 1440, coveredUntil: 478, keep: ['mobile_portrait'] });
  assert.equal(wide.content[0].settings['_direction:mobile_portrait'], 'column');
  assert.match(wide.content[0].settings._cssCustom, /max-width: 639px\) and \(min-width: 479px\)/);
  const fits = {
    content: [
      el('row', 0, 'block', { _direction: 'row', _width: '343px', _columnGap: '8px' }),
      el('icon', 'row', 'svg', { _width: '24px' }),
      el('label', 'row', 'block', { _width: '241px' }),
    ],
  };
  fitFluid(fits, { frameWidth: 1440, coveredUntil: 478, keep: ['mobile_portrait'] });
  assert.equal(fits.content[0].settings['_direction:mobile_portrait'], undefined);
});

test('three similar cards past the phone scroll sideways', () => {
  const gallery = {
    content: [
      el('row', 0, 'block', { _direction: 'row', _width: '1140px', _columnGap: '16px' }),
      el('a', 'row', 'block', { _width: '371px', '_width:mobile_portrait': '280px' }),
      el('b', 'row', 'block', { _width: '280px' }),
      el('c', 'row', 'block', { _width: '280px' }),
      el('d', 'row', 'block', { _width: '280px' }),
      el('e', 'row', 'block', { _width: '280px' }),
      el('grid', 'row', 'block', { _width: '750px', '_display:mobile_portrait': 'none' }),
    ],
  };
  fitFluid(gallery, { frameWidth: 1440, coveredUntil: 478, keep: ['mobile_portrait'] });
  const row = gallery.content[0].settings;
  assert.equal(row['_direction:mobile_portrait'], 'row');
  assert.equal(row['_flexWrap:mobile_portrait'], 'nowrap');
  assert.equal(row['_width:mobile_portrait'], '100%');
  assert.equal(row['_widthMax:mobile_portrait'], '100%');
  assert.equal(row['_overflow:mobile_portrait'], 'auto');
  assert.equal(gallery.content.find((e) => e.id === 'a').settings['_flexShrink:mobile_portrait'], 0);
  assert.doesNotMatch(row._cssCustom ?? '', /flex-wrap:\s*wrap/);
  assert.equal(row['_direction:tablet_portrait'], 'column');
});

test('a full-bleed picture covers the section off the frame, and the content column caps per band', () => {
  const template = {
    content: [
      el('sec', 0, 'section', { _width: '100%' }),
      el('bg', 'sec', 'block', { _position: 'absolute', _width: '210%', _widthMin: '3036px', _height: 'auto', _aspectRatio: '3036 / 1148' }),
      el('col', 'sec', 'block', { _width: '1200px', _widthMax: '100%' }),
      el('locked', 'sec', 'block', { _width: '1200px', _widthMax: 'none' }),
    ],
  };
  fitFluid(template, { frameWidth: 1440, coveredUntil: 991 });
  const by = (id) => template.content.find((e) => e.id === id).settings;
  assert.equal(by('bg')._width, '210%');
  assert.equal(by('bg')._widthMin, '3036px');
  assert.match(by('bg')._cssCustom, /min-width: 992px/);
  assert.match(by('bg')._cssCustom, /min-width: 100%/);
  assert.match(by('bg')._cssCustom, /height: 100%/);
  assert.match(by('bg')._cssCustom, /min-width: 1441px/);
  assert.match(by('col')._cssCustom, /max-width: 1023px\) and \(min-width: 992px\)[\s\S]*max-width: 768px/);
  assert.match(by('col')._cssCustom, /max-width: 1279px\) and \(min-width: 1024px\)[\s\S]*max-width: 1024px/);
  assert.match(by('col')._cssCustom, /max-width: 1439px\) and \(min-width: 1280px\)[\s\S]*max-width: 1200px/);
  assert.equal(by('col')._width, '1200px');
  assert.doesNotMatch(by('locked')._cssCustom ?? '', /(?:^|[^-])width: 100%/);
});

test('a wide column shrinks with the window and a logo row wraps', () => {
  const template = {
    content: [
      el('sec', 0, 'section', { _width: '100%', _padding: { top: '50px', right: '120px', bottom: '50px', left: '120px' } }),
      el('title', 'sec', 'block', { _width: '1140px', _widthMax: '100%' }),
      el('row', 'sec', 'block', { _width: '1140px', _direction: 'row' }),
      el('logo', 'row', 'block', { _width: '202px', _flexShrink: 0 }),
      el('logo2', 'row', 'block', { _width: '202px', _flexShrink: 0 }),
      el('logo3', 'row', 'block', { _width: '202px', _flexShrink: 0 }),
      el('icon', 'sec', 'svg', { _position: 'absolute', _width: '24px' }),
      el('kept', 'sec', 'block', { _width: '800px', '_width:mobile_portrait': '343px' }),
    ],
  };
  fitFluid(template, { frameWidth: 1440 });
  const by = (id) => template.content.find((e) => e.id === id).settings;
  assert.equal(by('title')._width, '1140px');
  assert.equal(by('title')._widthMax, '100%');
  assert.match(by('title')._cssCustom, /max-width: 1439px/);
  assert.match(by('title')._cssCustom, /width: 100%/);
  assert.equal(by('kept')['_width:mobile_portrait'], '343px');
  assert.equal(by('icon')._width, '24px');
  assert.match(by('row')._cssCustom, /max-width: 1439px/);
  assert.match(by('row')._cssCustom, /flex-wrap: wrap/);
  assert.equal(by('logo')._flexShrink, 0);
  assert.match(by('logo')._cssCustom, /flex-shrink: 1/);
  const phone = {
    content: [
      el('row', 0, 'block', { _width: '343px', _direction: 'row' }),
      el('a', 'row', 'svg', { _width: '109px' }),
      el('b', 'row', 'svg', { _width: '109px' }),
      el('c', 'row', 'svg', { _width: '109px' }),
      el('d', 'row', 'svg', { _width: '109px' }),
      el('e', 'row', 'svg', { _width: '109px' }),
    ],
  };
  fitFluid(phone);
  assert.equal(phone.content.find((e) => e.id === 'a').settings._flexShrink, undefined);
  assert.match(by('sec')._cssCustom, /100vw/);
  assert.match(by('sec')._cssCustom, /min\(120px/);
  assert.doesNotMatch(by('sec')._cssCustom, /min-width: 479px/);
  assert.equal(by('row')['_direction:tablet_portrait'], 'column');
  assert.equal(by('row')['_direction:mobile_portrait'], 'column');
  assert.equal(phone.content.find((e) => e.id === 'row').settings['_direction:mobile_portrait'], undefined);
});

test('both tab panes stack, including cards whose width is only a flex-basis', () => {
  const template = {
    content: [
      el('open', 0, 'block', { _cssClasses: 'tab-pane', _direction: 'row', _width: 'auto' }),
      el('a', 'open', 'svg', { _width: '202.4px', _height: '140px' }),
      el('b', 'open', 'svg', { _width: '202.4px', _height: '140px' }),
      el('shut', 0, 'block', { _cssClasses: 'tab-pane', _direction: 'row', _width: '100%', _widthMax: '1140px' }),
      el('c', 'shut', 'svg', { _width: 'auto', _flexBasis: '202.4px', _flexGrow: 1, _height: '140px' }),
      el('d', 'shut', 'block', { _width: 'auto', _flexBasis: '202.4px', _flexGrow: 1, _height: '140px' }),
    ],
  };
  fitFluid(template);
  const by = (id) => template.content.find((e) => e.id === id).settings;
  assert.equal(by('open')['_direction:mobile_portrait'], 'column');
  assert.equal(by('shut')['_direction:mobile_portrait'], 'column');
  assert.equal(by('shut')['_direction:tablet_portrait'], 'column');
  assert.equal(by('c')['_width:mobile_portrait'], '202.4px');
  assert.equal(by('c')['_flexGrow:mobile_portrait'], 0);
  assert.equal(by('c')['_flexBasis:tablet_portrait'], 'auto');
  assert.equal(by('c')._width, 'auto');
  assert.equal(by('c')._flexGrow, 1);
});

test('sibling panes of one tabs-nested stack together', () => {
  const template = {
    content: [
      el('tabs', 0, 'tabs-nested', {}),
      el('menu', 'tabs', 'block', { _cssClasses: 'tab-menu', _direction: 'row' }),
      el('body', 'tabs', 'block', { _cssClasses: 'tab-content', _direction: 'column' }),
      el('open', 'body', 'block', { _cssClasses: 'tab-pane', _direction: 'row' }),
      el('a', 'open', 'svg', { _width: '202px' }),
      el('b', 'open', 'svg', { _width: '202px' }),
      el('shut', 'body', 'block', { _cssClasses: 'tab-pane', _direction: 'row', _width: '100%' }),
      el('c', 'shut', 'svg', { _width: 'auto' }),
      el('d', 'shut', 'image', { _width: 'auto' }),
      el('phone', 'body', 'block', { _cssClasses: 'tab-pane', _direction: 'row', _width: '343px' }),
      el('e', 'phone', 'svg', { _width: '109px' }),
      el('f', 'phone', 'svg', { _width: '109px' }),
    ],
  };
  fitFluid(template);
  const by = (id) => template.content.find((e) => e.id === id).settings;
  assert.equal(by('open')['_direction:mobile_portrait'], 'column');
  assert.equal(by('shut')['_direction:mobile_portrait'], 'column');
  assert.equal(by('shut')['_direction:tablet_portrait'], 'column');
  assert.equal(by('menu')['_direction:mobile_portrait'], undefined);
  assert.equal(by('phone')['_direction:mobile_portrait'], undefined);
});

test('a desktop-only frame steps large spacing and headings down, and leaves the 1440 values', () => {
  const template = {
    content: [
      el('sec', 0, 'section', {
        _padding: { top: '50px', right: '120px', bottom: '50px', left: '120px' },
        _margin: { top: '0px', right: '0px', bottom: '40px', left: '0px' },
      }),
      el('gap', 'sec', 'block', { _padding: { top: '8px', right: '8px', bottom: '8px', left: '8px' } }),
      el('title', 'sec', 'heading', {
        text: 'HỆ ĐIỀU HÀNH VÀ CONTROL PANEL HỖ TRỢ',
        _width: 'auto',
        _typography: { 'font-size': '36px', 'line-height': '44px', 'white-space': 'nowrap', color: { hex: '#fff' } },
      }),
      el('body', 'sec', 'text-basic', { _typography: { 'font-size': '16px', 'line-height': '24px' } }),
      el('chip', 'sec', 'block', { _cssClasses: 'tab-title' }),
      el('label', 'chip', 'text-basic', { _typography: { 'font-size': '18px', 'white-space': 'nowrap' } }),
    ],
  };
  fitSoloTemplate(template);
  const by = (id) => template.content.find((e) => e.id === id).settings;
  assert.equal(by('sec')._padding.right, '120px');
  assert.deepEqual(by('sec')['_padding:tablet_portrait'], { top: '32px', right: '80px', bottom: '32px', left: '80px' });
  assert.deepEqual(by('sec')['_padding:mobile_landscape'], { top: '24px', right: '60px', bottom: '24px', left: '60px' });
  assert.deepEqual(by('sec')['_padding:mobile_portrait'], { top: '16px', right: '40px', bottom: '16px', left: '40px' });
  assert.equal(by('sec')['_margin:mobile_portrait'].bottom, '16px');
  assert.equal(by('sec')._margin.bottom, '40px');
  assert.equal(by('gap')['_padding:mobile_portrait'], undefined);
  assert.equal(by('title')._typography['font-size'], '36px');
  assert.equal(by('title')._typography['white-space'], 'nowrap');
  assert.equal(by('title')['_typography:tablet_portrait']['font-size'], '30px');
  assert.equal(by('title')['_typography:mobile_landscape']['font-size'], '28px');
  assert.equal(by('title')['_typography:mobile_portrait']['font-size'], '24px');
  assert.equal(by('title')['_typography:mobile_portrait']['line-height'], '29px');
  assert.equal(by('title')['_typography:mobile_portrait']['white-space'], 'normal');
  assert.equal(by('title')['_width:mobile_portrait'], '100%');
  assert.equal(by('body')['_typography:mobile_portrait'], undefined);
  assert.equal(by('label')['_typography:mobile_portrait'], undefined);
});

test('generate order keeps the spacing steps and does not add a second padding rule', () => {
  const template = {
    content: [
      el('sec', 0, 'section', { _padding: { top: '50px', right: '120px', bottom: '50px', left: '120px' } }),
      el('inner', 'sec', 'block', { _width: '1140px' }),
    ],
  };
  fitSoloTemplate(template);
  fitFluid(template);
  const s = template.content.find((e) => e.id === 'sec').settings;
  assert.equal(s._padding.right, '120px');
  assert.equal(s['_padding:tablet_portrait'].right, '80px');
  assert.equal(s['_padding:mobile_portrait'].right, '40px');
  assert.doesNotMatch(s._cssCustom ?? '', /100vw/);
});

test('a one-line title wraps below desktop and a tab label stays on one line', () => {
  const template = {
    content: [
      el('sec', 0, 'section', { _overflow: 'hidden' }),
      el('title', 'sec', 'heading', { text: 'HỆ ĐIỀU HÀNH VÀ CONTROL PANEL HỖ TRỢ', _typography: { 'font-size': '36px', 'white-space': 'nowrap' }, _width: 'auto' }),
      el('chip', 'sec', 'block', { _cssClasses: 'tab-title' }),
      el('label', 'chip', 'text-basic', { text: 'WINDOW OS', _typography: { 'font-size': '18px', 'white-space': 'nowrap' } }),
      el('bullet', 'sec', 'block', { _direction: 'row', _width: 'auto' }),
      el('mark', 'bullet', 'svg', { _width: '14px' }),
      el('line', 'bullet', 'text-basic', { text: 'Không bỏ lỡ bất kỳ cuộc gọi nào, kể cả ngoài giờ', _typography: { 'font-size': '13px', 'white-space': 'nowrap' }, _width: 'auto' }),
    ],
  };
  fitFluid(template);
  const title = template.content.find((e) => e.id === 'title').settings;
  const label = template.content.find((e) => e.id === 'label').settings;
  const line = template.content.find((e) => e.id === 'line').settings;
  assert.equal(title._typography['white-space'], 'nowrap');
  assert.equal(title['_typography:tablet_portrait']['white-space'], 'normal');
  assert.equal(title['_width:tablet_portrait'], '100%');
  assert.equal(line['_width:tablet_portrait'], undefined);
  assert.equal(line['_flexGrow:tablet_portrait'], 1);
  assert.equal(line['_flexShrink:tablet_portrait'], 1);
  assert.equal(line['_widthMin:tablet_portrait'], '0px');
  assert.equal(line['_typography:tablet_portrait']['white-space'], 'normal');
  assert.equal(label['_typography:tablet_portrait'], undefined);
});

test('desktop tabs and mobile blocks are two versions; accordion and form stay on both', () => {
  const baseTree = {
    id: 'sec', name: 'Section', children: [
      { id: 'acc', name: 'FAQ', children: [{ id: 'q', name: 'Item', children: [{ id: 'qt', name: 'Answer', children: [] }] }] },
      { id: 'tabs', name: 'Tabs', children: [{ id: 'bar', name: 'Bar', children: [] }, { id: 'pane', name: 'Pane', children: [] }] },
      { id: 'form', name: 'Form', children: [] },
    ],
  };
  const mobileTree = {
    id: 'msec', name: 'Section', children: [
      { id: 'macc', name: 'FAQ', children: [{ id: 'mq', name: 'Item', children: [{ id: 'mqt', name: 'Answer', children: [] }] }] },
      { id: 'info', name: 'Info', children: [] },
      { id: 'mform', name: 'Form', children: [] },
    ],
  };
  const answer = { text: 'Câu trả lời đã điền' };
  const fields = [{ type: 'email', label: 'Email', errorMessage: 'Email chưa đúng' }];
  const base = {
    tree: baseTree,
    template: {
      content: [
        el('sec', 0, 'section', {}),
        el('acc', 'sec', 'accordion-nested', {}),
        el('q', 'acc', 'block', {}),
        el('qt', 'q', 'text-basic', answer),
        el('tabs', 'sec', 'tabs-nested', {}),
        el('bar', 'tabs', 'block', { _cssClasses: 'tab-menu' }),
        el('pane', 'tabs', 'block', { _cssClasses: 'tab-pane' }),
        el('form', 'sec', 'form', { fields }),
      ],
    },
    mapping: Object.fromEntries(['sec', 'acc', 'q', 'qt', 'tabs', 'bar', 'pane', 'form'].map((id) => [id, { bricksId: id, element: 'block' }])),
  };
  const mobile = {
    key: 'mobile_portrait',
    maxWidth: 478,
    tree: mobileTree,
    template: {
      content: [
        el('msec', 0, 'section', {}),
        el('macc', 'msec', 'accordion-nested', {}),
        el('mq', 'macc', 'block', {}),
        el('mqt', 'mq', 'text-basic', answer),
        el('info', 'msec', 'block', { text: 'Window OS và Control Panel' }),
        el('mform', 'msec', 'form', { fields }),
      ],
    },
    mapping: {
      msec: { bricksId: 'msec', element: 'section' },
      macc: { bricksId: 'macc', element: 'accordion-nested' },
      mq: { bricksId: 'mq', element: 'block' },
      mqt: { bricksId: 'mqt', element: 'text-basic' },
      info: { bricksId: 'info', element: 'block' },
      mform: { bricksId: 'mform', element: 'form' },
    },
  };
  const merged = mergeResponsive({ base, variants: [mobile] });
  const by = (id) => merged.template.content.find((e) => e.id === id);
  assert.equal(by('qt').settings.text, 'Câu trả lời đã điền');
  assert.equal(by('qt').settings['_display:mobile_portrait'], undefined);
  assert.equal(by('form').settings.fields[0].errorMessage, 'Email chưa đúng');
  assert.equal(by('form').settings['_display:mobile_portrait'], undefined);
  assert.equal(by('tabs').settings['_display:mobile_portrait'], 'none');
  const info = by('info');
  assert.equal(info.settings.text, 'Window OS và Control Panel');
  assert.match(info.settings._cssCustom, /display: none/);
  assert.equal(info.settings['_display:mobile_portrait'], undefined);
});

test('a tab frame and a plain mobile frame stay two whole frames', () => {
  const base = {
    tree: { id: 'desk', name: 'OS', children: [{ id: 'title', name: 'Title', children: [] }] },
    template: { content: [el('desk', 0, 'tabs-nested', {}), el('title', 'desk', 'text-basic', { text: 'HỆ ĐIỀU HÀNH' })] },
    mapping: { desk: { bricksId: 'desk' }, title: { bricksId: 'title' } },
  };
  const mobile = {
    key: 'mobile_portrait',
    maxWidth: 478,
    tree: { id: 'mob', name: 'OS', children: [{ id: 'mtitle', name: 'Title', children: [] }, { id: 'block', name: 'WINDOW OS', children: [] }] },
    template: {
      content: [
        el('mob', 0, 'section', { _padding: { top: '32px', right: '16px', bottom: '32px', left: '16px' } }),
        el('mtitle', 'mob', 'text-basic', { text: 'HỆ ĐIỀU HÀNH', _typography: { 'font-size': '24px' } }),
        el('block', 'mob', 'block', {}),
      ],
    },
    mapping: { mob: { bricksId: 'mob' }, mtitle: { bricksId: 'mtitle' }, block: { bricksId: 'block' } },
  };
  const merged = mergeResponsive({ base, variants: [mobile] });
  const by = (id) => merged.template.content.find((e) => e.id === id);
  assert.equal(by('desk').settings['_display:mobile_portrait'], 'none');
  assert.doesNotMatch(by('desk').settings._cssCustom ?? '', /display: contents/);
  assert.equal(by('mob').parent, 0);
  assert.equal(by('mtitle').parent, 'mob');
  assert.equal(by('mtitle').settings.text, 'HỆ ĐIỀU HÀNH');
  assert.match(by('mob').settings._cssCustom ?? '', /display: none/);
});

test('a pasted phone keeps the base type; the landscape step does not shrink it', () => {
  const template = { content: [el('h', 0, 'heading', { _typography: { 'font-size': '24px', 'line-height': '36px', 'white-space': 'nowrap' } })] };
  fitSoloTemplate(template, { keep: ['mobile_portrait'] });
  const stepped = template.content[0].settings['_typography:mobile_landscape'];
  assert.equal(stepped['font-size'], '18px');
  assert.equal(stepped['white-space'], 'normal');
  holdMobileBand(template, { keep: ['mobile_portrait'] });
  const s = template.content[0].settings;
  assert.equal(s['_typography:mobile_portrait']['font-size'], '24px');
  assert.equal(s['_typography:mobile_portrait']['white-space'], 'nowrap');
  assert.equal(s['_typography:mobile_landscape']['font-size'], '24px');
  assert.equal(s['_typography:mobile_landscape']['white-space'], 'nowrap');
  assert.notEqual(s['_typography:tablet_portrait']['font-size'], '24px');
});

test('a one-line label in a pasted phone frame is not wrapped by the tablet step', () => {
  const template = {
    content: [
      el('row', 0, 'block', { _direction: 'column' }),
      el('p', 'row', 'text-basic', { text: 'Tìm kiếm tên miền của bạn', _typography: { 'font-size': '16px', 'line-height': '24px', 'white-space': 'nowrap' }, _width: 'auto' }),
    ],
  };
  fitFluid(template, { frameWidth: 1440, coveredUntil: 478, keep: ['mobile_portrait'] });
  holdMobileBand(template, { keep: ['mobile_portrait'] });
  const s = template.content.find((e) => e.id === 'p').settings;
  assert.equal(s['_typography:tablet_portrait']['white-space'], 'normal');
  assert.equal(s['_typography:mobile_portrait']['white-space'], 'nowrap');
  assert.equal(s['_width:mobile_portrait'], 'auto');
  assert.equal(s['_typography:mobile_landscape']['white-space'], 'nowrap');
});

test('a pasted phone keeps the width it drew when the tablet step stretches the element', () => {
  const template = { content: [el('pag', 0, 'slider-nested', { _width: 'auto', '_width:tablet_portrait': '100%', '_width:mobile_landscape': '100%' })] };
  holdMobileBand(template, { keep: ['mobile_portrait'] });
  const s = template.content[0].settings;
  assert.equal(s['_width:mobile_portrait'], 'auto');
  assert.equal(s['_width:mobile_landscape'], 'auto');
  assert.equal(s['_width:tablet_portrait'], '100%');
});

test('a pasted phone keeps its slider count through the open band', () => {
  const template = { content: [el('slide', 0, 'slider-nested', { perPage: 3 })] };
  fitSoloTemplate(template, { keep: ['mobile_portrait'] });
  assert.equal(template.content[0].settings['perPage:mobile_portrait'], 3);
  assert.equal(template.content[0].settings['perPage:tablet_portrait'], 2);
  holdMobileBand(template, { keep: ['mobile_portrait'] });
  assert.equal(template.content[0].settings['perPage:mobile_landscape'], 3);
  const drawn = { content: [el('one', 0, 'slider-nested', { perPage: 3, 'perPage:mobile_portrait': 1 })] };
  fitSoloTemplate(drawn, { keep: ['mobile_portrait'] });
  assert.equal(drawn.content[0].settings['perPage:mobile_portrait'], 1);
});

test('a clipped frame hides overflow the way Figma clips it', () => {
  const frame = {
    clip: true,
    box: { x: 0, y: 0, w: 1905, h: 400 },
    layout: { padding: { top: 76, right: 382, bottom: 76, left: 382 } },
    children: [{ box: { x: 352.5, y: 76, w: 1200, h: 100 } }],
  };
  const kept = {};
  applyAppearance({ node: frame, s: kept, css: {}, warn() {} });
  assert.equal(kept._overflow, 'hidden');
  const open = {};
  applyAppearance({ node: { ...frame, clip: false }, s: open, css: {}, warn() {} });
  assert.equal(open._overflow, undefined);
  const outside = { ...frame, children: [{ box: { x: -20, y: 0, w: 100, h: 40 } }] };
  const cut = {};
  applyAppearance({ node: outside, s: cut, css: {}, warn() {} });
  assert.equal(cut._overflow, 'hidden');
  const inset = { ...frame, children: [{ box: { x: 400, y: 76, w: 1100, h: 100 } }] };
  const normal = {};
  applyAppearance({ node: inset, s: normal, css: {}, warn() {} });
  assert.equal(normal._overflow, 'hidden');
  const sticker = {
    clip: true,
    box: { x: 0, y: 0, w: 562, h: 264, absX: 100, absY: 200 },
    layout: { padding: { top: 24, right: 24, bottom: 24, left: 24 } },
    children: [
      { box: { x: 0, y: 0, w: 562, h: 264, absX: 100, absY: 200 } },
      { box: { x: 0, y: 0, w: 562, h: 263, absX: 100, absY: 201 }, children: [{ box: { x: 352, y: 181, w: 210, h: 153, absX: 452, absY: 382 } }] },
    ],
  };
  const cutSticker = {};
  applyAppearance({ node: sticker, s: cutSticker, css: {}, warn() {} });
  assert.equal(cutSticker._overflow, 'hidden');
});

test('a fixed picture keeps both axes, and its row does not wrap', () => {
  const template = {
    content: [
      el('slider', 0, 'slider-nested', { _width: '1140px', _direction: 'row', perPage: 1 }),
      el('card', 'slider', 'block', { _direction: 'row', _display: 'flex', _width: '751px', _columnGap: '24px' }),
      el('photo', 'card', 'div', { _width: '234px', _height: '343px' }),
      el('img', 'photo', 'image', { _width: '100%', _height: '100%', _objectFit: 'fill' }),
      el('copy', 'card', 'block', { _width: '493px', _flexBasis: '493px' }),
      el('wide', 'slider', 'div', { _width: '1200px', _height: '400px' }),
      el('wideImg', 'wide', 'image', { _width: '100%', _height: '100%' }),
      el('bleed', 'slider', 'block', { _position: 'absolute', _width: '1400px', _height: '200px' }),
    ],
  };
  fitSoloTemplate(template);
  fitFluid(template, { frameWidth: 1440 });
  fitAnvRemainder(template);
  const by = (id) => template.content.find((e) => e.id === id).settings;
  assert.notEqual(by('photo')['_width:tablet_portrait'], '100%');
  assert.equal(by('photo')._width, '234px');
  assert.equal(by('photo')._height, '343px');
  assert.equal(by('photo')['_height:tablet_portrait'], undefined);
  assert.equal(by('card')['_direction:tablet_portrait'], undefined);
  assert.equal(by('card')['_direction:mobile_landscape'], undefined);
  assert.equal(by('card')['_direction:mobile_portrait'], 'column');
  assert.match(by('card')._cssCustom, /max-width: 767px\) \{ body #brxe-card \{ flex-direction: column/);
  assert.equal(by('card')._flexWrap, 'nowrap');
  assert.doesNotMatch(by('card')._cssCustom ?? '', /flex-wrap:\s*wrap/);
  assert.equal(by('wide')['_width:tablet_portrait'], '100%');
  assert.equal(by('wide')['_height:tablet_portrait'], 'auto');
  assert.equal(by('wide')['_aspectRatio:tablet_portrait'], '1200 / 400');
  assert.equal(by('wide')['_widthMax:tablet_portrait'], '1200px');
  assert.equal(by('card')['_width:tablet_portrait'], '100%');
  assert.equal(by('bleed')._width, '1400px');
  assert.equal(by('bleed')['_aspectRatio:tablet_portrait'], undefined);
  assert.equal(by('bleed')['_height:tablet_portrait'], undefined);
});
