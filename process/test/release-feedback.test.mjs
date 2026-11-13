import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { buildTemplate } from '../modules/write-bricks/render/index.mjs';
import { detectTemplateType, normalizeTemplateType } from '../modules/recognize-parts/rules/template-type.mjs';
import { detectChoices } from '../modules/recognize-parts/rules/choice.mjs';
import { detectDividers } from '../modules/recognize-parts/rules/divider.mjs';
import { detectMedia } from '../modules/recognize-parts/rules/media.mjs';
import { schemaTraps, sealThemeDefaults } from '../modules/write-bricks/render/utils/schema-traps.mjs';
import { externalCssReady, externalCssUrl } from '../modules/build-steps/07-verify.mjs';
import { hearAnswers, applyAnswers } from '../modules/missing-content/index.mjs';
import { detectForms } from '../modules/recognize-parts/rules/form.mjs';
import { detectCarousels } from '../modules/recognize-parts/rules/carousel.mjs';
import { runRules } from '../modules/recognize-parts/index.mjs';
import { popupPageSettings } from '../modules/write-bricks/components/popup-settings.mjs';
import { buttonRole } from '../modules/write-bricks/components/button.mjs';

const mini = (nodeRaw) => normalizeRoot({ nodes: { r: { document: { id: 'r', name: 'root', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 }, layoutMode: 'VERTICAL', ...nodeRaw } } } }, 'r', { images: {}, svgs: {} });
const kid = (id, extra) => ({ id, name: id, type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 40 }, ...extra });
const txt = (id, characters, extra = {}) => {
  const { style, ...rest } = extra;
  return { id, name: id, type: 'TEXT', characters, absoluteBoundingBox: { x: 0, y: 0, width: 80, height: 20 }, ...rest, style: { fontFamily: 'Inter', fontSize: 16, fontWeight: 400, lineHeightPx: 20, textAlignHorizontal: 'LEFT', ...style } };
};

test('template type defaults to section and names popup, header and footer from the tree', () => {
  assert.equal(detectTemplateType(mini({ name: 'Banner', children: [txt('a', 'Hello')] })).type, 'section');

  const header = detectTemplateType(mini({
    name: 'Bar',
    layoutMode: 'HORIZONTAL',
    absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 80 },
    children: [txt('a', 'Home'), txt('b', 'Blog'), txt('c', 'Pricing')],
  }));
  assert.equal(header.type, 'header');
  assert.equal(header.confidence, 'high');

  const footer = detectTemplateType(mini({
    name: 'Bottom',
    absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 360 },
    children: [txt('c', '© 2026 Vietnix')],
  }));
  assert.equal(footer.type, 'footer');

  const popup = detectTemplateType(mini({
    name: 'Overlay',
    absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 },
    children: [
      kid('scrim', { absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 }, fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 0.45 } }] }),
      kid('card', { absoluteBoundingBox: { x: 470, y: 220, width: 500, height: 360 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], children: [txt('t', 'Offer')] }),
    ],
  }));
  assert.equal(popup.type, 'popup');
  assert.ok(popup.cases.some((c) => c.id === 'backdrop-card'));

  const dialog = detectTemplateType(mini({
    name: 'Offer',
    absoluteBoundingBox: { x: 0, y: 0, width: 480, height: 320 },
    children: [
      kid('x', { absoluteBoundingBox: { x: 440, y: 12, width: 24, height: 24 }, children: [txt('xx', '×', { absoluteBoundingBox: { x: 446, y: 14, width: 12, height: 16 } })] }),
      txt('body', 'Join'),
    ],
  }));
  assert.equal(dialog.type, 'popup');
  assert.ok(dialog.cases.some((c) => c.id === 'close-on-frame'));

  const namedOnly = detectTemplateType(mini({ name: 'Popup', absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 800 }, children: [txt('a', 'Hello')] }));
  assert.equal(namedOnly.type, 'section');
  assert.equal(namedOnly.confidence, 'low');
  assert.match(namedOnly.reason, /popup/);
});

test('template type aliases stay inside the Bricks list', () => {
  assert.equal(normalizeTemplateType('Single'), 'content');
  assert.equal(normalizeTemplateType('Search results'), 'search');
  assert.equal(normalizeTemplateType('Error page'), 'error');
  assert.equal(normalizeTemplateType('Popup'), 'popup');
  assert.equal(normalizeTemplateType('banner'), '');
  assert.equal(hearAnswers({ 'type:1:2': 'Single' })['type:1:2'], 'Single');
});

test('a confirmed template type is stored on the template and the title reason stays', () => {
  const files = {
    'detections.json': { components: [] },
    'overrides.json': { template: { title: 'File - Hero', reason: 'naming convention' }, nodes: {} },
    'tree.json': { id: 'r', children: [] },
  };
  const ws = { readJson: (n, fb) => files[n] ?? fb, writeJson: (n, v) => { files[n] = v; } };
  applyAnswers(ws, { 'type:r': 'popup' });
  assert.equal(files['overrides.json'].template.type, 'popup');
  assert.equal(files['overrides.json'].template.title, 'File - Hero');
  assert.equal(files['overrides.json'].template.reason, 'naming convention');
});

test('a checkbox row and a switch row become a native checkbox field, with one hide rule for the submit button', () => {
  const tree = mini({
    layoutMode: 'VERTICAL',
    itemSpacing: 12,
    children: [
      kid('row', {
        name: 'Agree',
        layoutMode: 'HORIZONTAL',
        itemSpacing: 8,
        absoluteBoundingBox: { x: 0, y: 0, width: 220, height: 24 },
        children: [
          kid('box', { absoluteBoundingBox: { x: 0, y: 4, width: 16, height: 16 }, children: [kid('tick', { absoluteBoundingBox: { x: 3, y: 3, width: 10, height: 10 } })] }),
          txt('lab', 'I agree', { absoluteBoundingBox: { x: 24, y: 2, width: 80, height: 20 } }),
        ],
      }),
      kid('sw', {
        name: 'Notify',
        layoutMode: 'HORIZONTAL',
        itemSpacing: 8,
        absoluteBoundingBox: { x: 0, y: 36, width: 180, height: 28 },
        children: [
          kid('track', {
            absoluteBoundingBox: { x: 0, y: 2, width: 44, height: 24 },
            cornerRadius: 12,
            children: [kid('knob', { absoluteBoundingBox: { x: 22, y: 2, width: 20, height: 20 }, cornerRadius: 10 })],
          }),
          txt('sl', 'Alerts', { absoluteBoundingBox: { x: 52, y: 4, width: 60, height: 20 } }),
        ],
      }),
    ],
  });
  const found = detectChoices(tree);
  const box = found.find((c) => c.component === 'checkbox');
  const sw = found.find((c) => c.component === 'switch');
  assert.equal(box.node, 'row');
  assert.equal(box.params.checked, true);
  assert.equal(box.confidence, 'high');
  assert.equal(sw.node, 'sw');
  assert.equal(sw.params.checked, true);
  assert.equal(sw.params.label, 'Alerts');

  const built = buildTemplate(tree, {
    overrides: {},
    detections: { components: found.map((c, i) => ({ id: `d${i}`, status: 'approved', ...c })) },
    salt: 'choice',
  });
  const forms = built.template.content.filter((e) => e.name === 'form');
  assert.equal(forms.length, 2);
  const boxForm = forms.find((f) => f.settings.fields[0].options.includes('I agree'));
  const switchForm = forms.find((f) => f.settings.fields[0].options.includes('Alerts'));
  for (const form of forms) {
    assert.equal(form.settings.fields[0].type, 'checkbox');
    assert.equal(form.settings.fields[0].value, 'on');
    assert.match(form.settings._cssCustom, /submit-button-wrapper \{ display: none; \}/);
    assert.equal(form.settings.actions, undefined);
  }
  assert.match(boxForm.settings._cssCustom, /input\[type="checkbox"\] \{ appearance: none; width: 16px; height: 16px;/);
  assert.match(switchForm.settings._cssCustom, /input\[type="checkbox"\] \{[^}]*appearance: none; width: 44px; height: 24px; border-radius: 12px;/);
  assert.equal(built.template.content.find((e) => e.name === 'form' && e.settings.fields[0].options.includes('Alerts')).label, 'Switch');
});

test('a switch paints the Figma pill and knob, and keeps the label on the side it was drawn', () => {
  const tree = mini({
    children: [
      kid('sw', {
        layoutMode: 'HORIZONTAL',
        absoluteBoundingBox: { x: 0, y: 0, width: 65, height: 20 },
        children: [
          txt('sl', 'Tắt', { absoluteBoundingBox: { x: 0, y: 0, width: 21, height: 20 } }),
          kid('track', {
            absoluteBoundingBox: { x: 29, y: 0, width: 36, height: 20 },
            cornerRadius: 12,
            fills: [{ type: 'SOLID', color: { r: 229 / 255, g: 231 / 255, b: 235 / 255, a: 1 } }],
            children: [
              kid('knob', {
                absoluteBoundingBox: { x: 31, y: 2, width: 16, height: 16 },
                cornerRadius: 8,
                fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
              }),
            ],
          }),
        ],
      }),
    ],
  });
  const sw = detectChoices(tree).find((c) => c.component === 'switch');
  assert.equal(sw.params.checked, false);
  assert.equal(sw.params.markNode, 'track');
  const form = buildTemplate(tree, {
    overrides: {},
    detections: { components: [{ id: 'd0', status: 'approved', ...sw }] },
    salt: 'pill',
  }).template.content.find((e) => e.label === 'Switch');
  assert.match(form.settings._cssCustom, /background-color: #e5e7eb/);
  assert.match(form.settings._cssCustom, /circle at 10px 10px, #ffffff 8px/);
  assert.match(form.settings._cssCustom, /:checked \{ background-image: radial-gradient\(circle at 26px 10px/);
  assert.match(form.settings._cssCustom, /flex-direction: row-reverse; .*gap: 8px|gap: 8px; flex-direction: row-reverse/);
});

test('a switch uses the drawn off color at rest and the drawn on color when checked', () => {
  const track = (id, x, on) => kid(id, {
    name: 'Toggle',
    absoluteBoundingBox: { x, y: 0, width: 36, height: 20 },
    cornerRadius: 12,
    fills: [{ type: 'SOLID', color: on ? { r: 0, g: 124 / 255, b: 252 / 255, a: 1 } : { r: 229 / 255, g: 231 / 255, b: 235 / 255, a: 1 } }],
    children: [kid(`${id}k`, {
      absoluteBoundingBox: { x: x + (on ? 18 : 2), y: 2, width: 16, height: 16 },
      cornerRadius: 8,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
    })],
  });
  const tree = mini({
    children: [
      kid('off', { layoutMode: 'HORIZONTAL', absoluteBoundingBox: { x: 0, y: 0, width: 80, height: 20 }, children: [txt('a', 'Tắt'), track('offt', 40, false)] }),
      kid('on', { layoutMode: 'HORIZONTAL', absoluteBoundingBox: { x: 0, y: 40, width: 80, height: 20 }, children: [txt('b', 'Bật'), track('ont', 40, true)] }),
    ],
  });
  const sw = detectChoices(tree).find((c) => c.node === 'off');
  const form = buildTemplate(tree, {
    detections: { components: [{ id: 'd0', status: 'approved', ...sw }] },
  }).template.content.find((e) => e.label === 'Switch');
  assert.match(form.settings._cssCustom, /background-color: #e5e7eb/);
  assert.match(form.settings._cssCustom, /:checked \{ background-color: #007cfc/);
  assert.match(form.settings.fields[0].options, /f2b-off">Tắt/);
  assert.match(form.settings.fields[0].options, /f2b-on">Bật/);
  assert.match(form.settings._cssCustom, /cursor: pointer/);
  const stored = { ...sw, params: { ...sw.params } };
  delete stored.params.markNode;
  const again = buildTemplate(tree, {
    detections: { components: [{ id: 'd0', status: 'approved', ...stored }] },
  }).template.content.find((e) => e.label === 'Switch');
  assert.match(again.settings._cssCustom, /:checked \{ background-color: #007cfc/);
});

test('a popup template is the centered card, and the dim frame is the backdrop', () => {
  const tree = mini({
    fills: [{ type: 'SOLID', color: { r: 12 / 255, g: 12 / 255, b: 13 / 255, a: 0.6 } }],
    absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 1024 },
    children: [kid('card', {
      absoluteBoundingBox: { x: 440, y: 142, width: 560, height: 695 },
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
      children: [txt('title', 'Cài đặt Cookie')],
    })],
  });
  const built = buildTemplate(tree, { overrides: { template: { type: 'popup' } } });
  assert.equal(built.template.popup.width, 560);
  assert.equal(built.template.popup.backdrop.hex, '#0c0c0d');
  assert.equal(built.mapping.r.skipped, 'popup backdrop');
  assert.equal(built.template.content.find((e) => e.parent === 0).id, built.mapping.card.bricksId);
});

test('a circle beside a label is a radio and a thin line is a divider', () => {
  const tree = mini({
    layoutMode: 'VERTICAL',
    children: [
      kid('line', { type: 'RECTANGLE', absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 1 }, fills: [{ type: 'SOLID', color: { r: 229 / 255, g: 229 / 255, b: 229 / 255, a: 1 } }] }),
      kid('rad', {
        name: 'Plan',
        layoutMode: 'HORIZONTAL',
        absoluteBoundingBox: { x: 0, y: 16, width: 160, height: 20 },
        children: [
          kid('dot', { absoluteBoundingBox: { x: 0, y: 1, width: 18, height: 18 }, cornerRadius: 9, children: [kid('mark', { absoluteBoundingBox: { x: 4, y: 4, width: 10, height: 10 }, cornerRadius: 5 })] }),
          txt('rl', 'Monthly', { absoluteBoundingBox: { x: 26, y: 0, width: 80, height: 20 } }),
        ],
      }),
    ],
  });
  const line = detectDividers(tree).find((c) => c.node === 'line');
  const radio = detectChoices(tree).find((c) => c.component === 'radio');
  assert.equal(line.params.direction, 'horizontal');
  assert.equal(line.params.length, 200);
  assert.equal(line.params.thickness, 1);
  assert.equal(radio.node, 'rad');
  assert.equal(radio.params.checked, true);
  const built = buildTemplate(tree, {
    overrides: {},
    detections: { components: [line, radio].map((c, i) => ({ id: `d${i}`, status: 'approved', ...c })) },
    salt: 'line',
  });
  const divider = built.template.content.find((e) => e.name === 'divider');
  const form = built.template.content.find((e) => e.name === 'form');
  assert.equal(divider.settings.direction, 'horizontal');
  assert.equal(divider.settings.height, '1px');
  assert.equal(divider.settings.width, '200px');
  assert.deepEqual(divider.settings.color, { hex: '#e5e5e5' });
  assert.equal(form.settings.fields[0].type, 'radio');
  assert.match(form.settings._cssCustom, /input\[type="radio"\] \{ appearance: none; width: 18px; height: 18px; border-radius: 9px;/);
});

test('a badge sitting on an icon is not a radio', () => {
  const bell = {
    id: 'note', name: 'Notification Container', type: 'FRAME', box: { x: 0, y: 0, w: 32, h: 32 },
    children: [
      { id: 'bell', name: 'Button', type: 'INSTANCE', svg: { file: 'svg/bell.svg' }, box: { x: 0, y: 0, w: 32, h: 32 }, radius: [999, 999, 999, 999], children: [] },
      { id: 'badge', name: 'badget', type: 'FRAME', box: { x: 20, y: -7, w: 18, h: 18 }, radius: [999, 999, 999, 999], children: [
        { id: 'count', type: 'TEXT', box: { x: 4, y: 2, w: 10, h: 14 }, text: { characters: '8' } },
      ] },
    ],
  };
  const dot = {
    id: 'count-only', name: 'Badge', type: 'FRAME', box: { x: 0, y: 0, w: 32, h: 32 },
    children: [
      { id: 'disk', type: 'FRAME', box: { x: 0, y: 0, w: 32, h: 32 }, radius: [999, 999, 999, 999], children: [] },
      { id: 'badge', type: 'FRAME', box: { x: 18, y: -4, w: 18, h: 18 }, children: [
        { id: 'count', type: 'TEXT', box: { x: 4, y: 2, w: 10, h: 14 }, text: { characters: '8' } },
      ] },
    ],
  };
  assert.equal(detectChoices({ id: 'root', children: [bell, dot] }).some((c) => c.component === 'radio'), false);
});

test('a wide field with an icon is a search, and a picture with a play mark waits for a video address', () => {
  const tree = normalizeRoot({ nodes: { r: { document: {
    id: 'r', name: 'root', type: 'FRAME', layoutMode: 'VERTICAL',
    absoluteBoundingBox: { x: 0, y: 0, width: 800, height: 500 },
    children: [
      kid('find', {
        name: 'Search',
        layoutMode: 'HORIZONTAL',
        absoluteBoundingBox: { x: 0, y: 0, width: 280, height: 40 },
        children: [
          kid('mag', { type: 'VECTOR', absoluteBoundingBox: { x: 12, y: 12, width: 16, height: 16 } }),
          txt('ph', 'Search products', { absoluteBoundingBox: { x: 36, y: 10, width: 200, height: 20 } }),
        ],
      }),
      kid('clip', {
        name: 'Showreel',
        absoluteBoundingBox: { x: 0, y: 60, width: 640, height: 360 },
        fills: [{ type: 'IMAGE', imageRef: 'poster' }],
        children: [
          kid('play', { absoluteBoundingBox: { x: 292, y: 152, width: 56, height: 56 }, cornerRadius: 28 }),
        ],
      }),
    ],
  } } } }, 'r', { images: { poster: { file: 'images/poster.png', width: 640, height: 360 } }, svgs: {} });
  const search = detectMedia(tree).find((c) => c.component === 'search');
  const video = detectMedia(tree).find((c) => c.component === 'video');
  assert.equal(search.node, 'find');
  assert.equal(search.confidence, 'high');
  assert.equal(search.params.placeholder, 'Search products');
  assert.equal(video.node, 'clip');
  const waiting = buildTemplate(tree, {
    overrides: {},
    detections: { components: [{ id: 'v', status: 'approved', ...video }] },
    salt: 'wait',
  });
  assert.equal(waiting.template.content.some((e) => e.name === 'video'), false);
  const built = buildTemplate(tree, {
    overrides: {},
    detections: { components: [{ id: 's', status: 'approved', ...search }, { id: 'v', status: 'approved', ...video, params: { url: 'https://www.youtube.com/watch?v=abcdefghijk' } }] },
    salt: 'media',
  });
  const field = built.template.content.find((e) => e.name === 'search');
  const player = built.template.content.find((e) => e.name === 'video');
  assert.equal(field.settings.placeholder, 'Search products');
  assert.equal(field.settings.inputHeight, '40px');
  assert.equal(field.settings.inputWidth, '280px');
  assert.equal(player.settings.videoType, 'youtube');
  assert.equal(player.settings.youTubeId, 'abcdefghijk');
  assert.equal(hearAnswers({ 'video:clip': 'https://vimeo.com/1234567' })['video:clip'], 'https://vimeo.com/1234567');
});

test('theme defaults are filled only where Figma left the key empty', () => {
  const elements = [
    { id: 'cnt', name: 'container', settings: {} },
    { id: 'row', name: 'block', settings: { _direction: 'row', _width: '640px' } },
    { id: 'hug', name: 'block', settings: { _flexShrink: 0 } },
    { id: 'drawn', name: 'container', settings: { _width: '640px' } },
    { id: 'wrap', name: 'block', settings: { _direction: 'row', _flexWrap: 'wrap', _width: '200px' } },
  ];
  sealThemeDefaults(elements);
  assert.equal(elements[0].settings._width, '100%');
  assert.equal(elements[1].settings._flexWrap, 'nowrap');
  assert.equal(elements[1].settings._width, '640px');
  assert.equal(elements[2].settings._width, 'auto');
  assert.equal(elements[3].settings._width, '640px');
  assert.equal(elements[4].settings._flexWrap, 'wrap');
  assert.deepEqual(schemaTraps(elements), []);
  const customId = schemaTraps([{ id: 'abc123', name: 'block', settings: { _cssId: 'gia', _cssCustom: '#brxe-abc123 { color: red; }', _width: 'auto' } }]);
  assert.equal(customId.length, 1);
});

test('external css is the served post file, not a site-wide rebuild', () => {
  assert.equal(externalCssReady({ css_loading: 'file', generated: true, file_name: 'post-12.min.css' }), true);
  assert.equal(externalCssReady({ css_loading: 'file', generated: false, file_name: null }), false);
  assert.equal(externalCssUrl('http://localhost:8080/', 'post-12.min.css'), 'http://localhost:8080/wp-content/uploads/bricks/css/post-12.min.css');
});

test('a built template does not emit keys Bricks 1.12.3 ignores', () => {
  const tree = mini({ children: [txt('a', 'Hello')] });
  const built = buildTemplate(tree, { overrides: {}, detections: { components: [] }, salt: 'plain' });
  assert.deepEqual(schemaTraps(built.template.content), []);
  const bad = schemaTraps([{ id: 'abc123', name: 'block', settings: { _gap: '8px', _minWidth: '10px', _cssCustom: '%root% { color: red; }' } }]);
  assert.equal(bad.length, 3);
});

test('the bridge sets external CSS and does not write theme styles', () => {
  const php = readFileSync(fileURLToPath(new URL('../../wp-content/mu-plugins/figma-to-bricks-bridge.php', import.meta.url)), 'utf8');
  assert.match(php, /\$settings\['cssLoading'\] = 'file'/);
  assert.match(php, /\$global_settings\['cssLoading'\] = 'file'/);
  assert.match(php, /\$global_data\['settings'\]\['cssLoading'\] = 'file'/);
  assert.match(php, /\/css-file/);
  assert.match(php, /generate_post_css_file/);
  assert.match(php, /'css_loading'\s*=>\s*'file'/);
  assert.doesNotMatch(php, /regenerate_css_files/);
  assert.doesNotMatch(php, /Inline mode/);
  assert.doesNotMatch(php, /bricks_theme_styles/);
  assert.doesNotMatch(php, /BRICKS_DB_THEME_STYLES/);
  const preview = php.slice(php.indexOf('function preview'), php.indexOf('function preview_cleanup'));
  const assemble = php.slice(php.indexOf('function assemble_page'), php.indexOf('function set_fonts'));
  assert.match(preview, /external_css_file/);
  assert.match(assemble, /external_css_file/);
  const push = readFileSync(fileURLToPath(new URL('../modules/build-steps/06-push.mjs', import.meta.url)), 'utf8');
  assert.match(push, /css\.css_loading !== 'file'/);
  assert.match(push, /post-\$\{res\.id\}\.min\.css was not written/);
  const verify = readFileSync(fileURLToPath(new URL('../modules/build-steps/07-verify.mjs', import.meta.url)), 'utf8');
  assert.match(verify, /externalCssReady/);
  assert.match(verify, /method: 'HEAD'/);
  assert.doesNotMatch(verify, /regenerate_css/);
  assert.match(php, /BRICKS_DB_PAGE_SETTINGS/);
  assert.match(php, /F2B_Bricks_Store::split_settings/);
  assert.match(php, /F2B_Bricks_Store::link_children/);
  assert.match(push, /popupPageSettings/);
  const store = readFileSync(fileURLToPath(new URL('../../wp-content/plugins/f2b-mcp/includes/class-f2b-bricks-store.php', import.meta.url)), 'utf8');
  const tools = readFileSync(fileURLToPath(new URL('../../wp-content/plugins/f2b-mcp/includes/class-f2b-mcp-tools.php', import.meta.url)), 'utf8');
  for (const key of ['headerWidth', 'templateConditions', 'passwordProtectionPassword', 'templatePreviewPostId', 'popupContentWidth', 'template_interactions']) {
    assert.match(store, new RegExp(`'${key}'`));
  }
  assert.match(tools, /F2B_Bricks_Store::split_settings/);
  assert.match(tools, /F2B_Bricks_Store::link_children/);
  assert.doesNotMatch(tools, /function template_setting_keys/);
});

test('a dim overlay with one field and a button is a form', () => {
  const field = kid('field', {
    absoluteBoundingBox: { x: 40, y: 80, width: 280, height: 44 },
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }],
    children: [txt('ph', 'Email')],
  });
  const button = kid('go', {
    name: 'Button',
    absoluteBoundingBox: { x: 40, y: 140, width: 160, height: 44 },
    fills: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1 }, opacity: 1 }],
    children: [txt('label', 'Lưu')],
  });
  const scrim = kid('scrim', {
    absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 },
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 0.4 }],
    children: [],
  });
  const tree = mini({ children: [scrim, field, button] });
  const found = detectForms(tree);
  assert.equal(found.length, 1);
  assert.equal(found[0].params.fields.length, 1);
  assert.equal(found[0].params.submit, 'go');
  assert.equal(found[0].params.overlay, true);
});

test('a dim frame, a centered card, and a close mark inside the card are a popup', () => {
  const tree = mini({
    name: 'Frame',
    absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 1024 },
    fills: [{ type: 'SOLID', color: { r: 12 / 255, g: 12 / 255, b: 13 / 255, a: 0.6 } }],
    children: [
      kid('card', {
        absoluteBoundingBox: { x: 440, y: 142, width: 560, height: 400 },
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
        children: [
          kid('header', {
            layoutMode: 'HORIZONTAL',
            absoluteBoundingBox: { x: 0, y: 0, width: 560, height: 72 },
            children: [
              txt('title', 'Cài đặt Cookie', { absoluteBoundingBox: { x: 24, y: 25, width: 128, height: 22 } }),
              kid('x', { absoluteBoundingBox: { x: 512, y: 24, width: 24, height: 24 }, children: [kid('v', { type: 'VECTOR', absoluteBoundingBox: { x: 4, y: 4, width: 16, height: 16 } })] }),
            ],
          }),
        ],
      }),
    ],
  });
  const hit = detectTemplateType(tree);
  assert.equal(hit.type, 'popup');
  assert.ok(hit.cases.some((c) => c.id === 'root-dim-card'));
  assert.ok(hit.cases.some((c) => c.id === 'close-on-card'));
});

test('an icon glyph beside a label is not a checkbox or a radio', () => {
  const text = (id, characters, w) => ({ id, type: 'TEXT', text: { characters, fontFamily: 'Inter' }, box: { x: 0, y: 0, w, h: 24 } });
  const tree = {
    id: 'r', type: 'FRAME', name: 'root', box: { x: 0, y: 0, w: 600, h: 80 },
    children: [
      {
        id: 'plus-row', type: 'FRAME', name: '_toggle-title', box: { x: 0, y: 0, w: 400, h: 30 },
        children: [
          text('q', 'Câu hỏi', 360),
          { id: 'plus', type: 'INSTANCE', name: 'Plus', svg: { file: 'plus.svg' }, box: { x: 370, y: 3, w: 24, h: 24 }, children: [] },
        ],
      },
      {
        id: 'icon-row', type: 'FRAME', name: '_toggle-title', box: { x: 0, y: 40, w: 400, h: 30 },
        children: [
          text('q2', 'Câu hỏi khác', 300),
          {
            id: 'mark', type: 'INSTANCE', name: 'Check Icon', box: { x: 360, y: 0, w: 20, h: 20 }, radius: [50, 50, 50, 50],
            children: [{ id: 'glyph', type: 'TEXT', svg: { file: 'plus.svg' }, text: { characters: 'plus', fontFamily: 'Font Awesome 6 Pro' }, box: { x: 3, y: 2, w: 14, h: 16 } }],
          },
        ],
      },
    ],
  };
  assert.equal(detectChoices(tree).length, 0);
});

test('one text field on a card that sits on a dim frame is a form, and a switch panel is not', () => {
  const field = kid('field', {
    absoluteBoundingBox: { x: 24, y: 40, width: 440, height: 44 },
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1 }],
    children: [txt('ph', 'Email')],
  });
  const button = kid('go', {
    name: 'Button',
    absoluteBoundingBox: { x: 24, y: 100, width: 160, height: 44 },
    fills: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1 }, opacity: 1 }],
    children: [txt('label', 'Save')],
  });
  const card = kid('card', {
    absoluteBoundingBox: { x: 470, y: 200, width: 500, height: 280 },
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
    children: [field, button],
  });
  const tree = mini({
    absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 },
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 0.5 } }],
    children: [card],
  });
  const found = detectForms(tree);
  assert.equal(found.length, 1);
  assert.equal(found[0].node, 'card');
  assert.equal(found[0].params.overlay, true);

  const switches = mini({
    absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 },
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 0.5 } }],
    children: [
      kid('panel', {
        absoluteBoundingBox: { x: 470, y: 200, width: 500, height: 280 },
        children: [
          kid('sw', {
            layoutMode: 'HORIZONTAL',
            absoluteBoundingBox: { x: 24, y: 40, width: 200, height: 28 },
            children: [
              kid('track', {
                absoluteBoundingBox: { x: 0, y: 2, width: 44, height: 24 },
                cornerRadius: 12,
                children: [kid('knob', { absoluteBoundingBox: { x: 2, y: 2, width: 20, height: 20 }, cornerRadius: 10 })],
              }),
              txt('sl', 'Tắt', { absoluteBoundingBox: { x: 52, y: 4, width: 40, height: 20 } }),
            ],
          }),
          kid('save', {
            name: 'Button',
            absoluteBoundingBox: { x: 24, y: 100, width: 160, height: 44 },
            fills: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1 }, opacity: 1 }],
            children: [txt('save-label', 'Save')],
          }),
        ],
      }),
    ],
  });
  const action = detectForms(switches);
  assert.equal(action.length, 1);
  assert.equal(action[0].params.kind, 'action');
  assert.equal(action[0].params.submit, 'save');
  assert.equal(action[0].params.fields[0].role, 'switch');
  assert.equal(detectChoices(switches).length, 0);
  const built = buildTemplate(switches, { detections: { components: [] } });
  const form = built.template.content.find((e) => e.name === 'form');
  assert.equal(form.settings.submitButtonText, 'Save');
  assert.deepEqual(form.settings.actions, ['save-submission']);
  assert.match(form.settings._cssCustom, /appearance: none/);
  assert.match(form.settings._cssCustom, /width: 44px; height: 24px/);
  assert.match(form.settings._cssCustom, /border-radius: 12px/);

  const notice = mini({
    absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 },
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 0.5 } }],
    children: [kid('panel', {
      absoluteBoundingBox: { x: 470, y: 200, width: 500, height: 280 },
      children: [kid('ok', {
        name: 'Button',
        absoluteBoundingBox: { x: 24, y: 100, width: 160, height: 44 },
        fills: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1, a: 1 } }],
        children: [txt('ok-label', 'Xác nhận')],
      })],
    })],
  });
  assert.equal(detectForms(notice).length, 0);
});

test('popup page settings call the Bricks popup API and set a cookie for that template', () => {
  const settings = popupPageSettings(42);
  assert.equal(settings.popupCloseOn, 'backdrop');
  assert.match(settings.customScriptsBodyFooter, /^<script>[\s\S]*<\/script>$/);
  assert.doesNotMatch(settings.customScriptsBodyFooter, /<\/script>[\s\S]/);
  assert.match(settings.customScriptsBodyFooter, /bricksOpenPopup/);
  assert.match(settings.customScriptsBodyFooter, /bricksClosePopup/);
  assert.match(settings.customScriptsBodyFooter, /f2b_popup_42/);
  assert.match(settings.customScriptsBodyFooter, /data-f2b-open/);
  assert.match(settings.customScriptsBodyFooter, /data-f2b-close/);
  assert.deepEqual(settings.templateConditions, [{ id: 'f2bany', main: 'any' }]);
  assert.equal(settings.popupContentWidth, undefined);
  const staged = popupPageSettings(42, { width: 560, backdrop: { hex: '#0c0c0d', alpha: 0.6 } });
  assert.equal(staged.popupContentWidth, '560px');
  assert.equal(staged.popupContentPadding.top, '0px');
  assert.equal(staged.popupBackground.color.rgb, 'rgba(12, 12, 13, 0.6)');
});

test('a field beside a Tìm Kiếm button is a search submit, not two buttons', () => {
  const tree = mini({
    name: 'Banner',
    absoluteBoundingBox: { x: 0, y: 0, width: 600, height: 200 },
    children: [kid('bar', {
      name: 'Search desktop',
      layoutMode: 'HORIZONTAL',
      absoluteBoundingBox: { x: 0, y: 0, width: 534, height: 54 },
      children: [
        kid('field', {
          name: 'Frame 8',
          layoutMode: 'HORIZONTAL',
          absoluteBoundingBox: { x: 0, y: 0, width: 389, height: 54 },
          fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
          children: [txt('ph', 'Tìm kiếm bài viết', { absoluteBoundingBox: { x: 15, y: 12, width: 228, height: 30 } })],
        }),
        kid('go', {
          name: 'Button',
          type: 'INSTANCE',
          layoutMode: 'HORIZONTAL',
          absoluteBoundingBox: { x: 389, y: 0, width: 145, height: 54 },
          fills: [{ type: 'SOLID', color: { r: 1, g: 0.6, b: 0, a: 1 } }],
          children: [txt('gl', 'Tìm Kiếm', { absoluteBoundingBox: { x: 32, y: 12, width: 81, height: 30 } })],
        }),
      ],
    })],
  });
  const found = runRules(tree).components;
  const search = found.find((c) => c.component === 'search');
  assert.equal(search.node, 'bar');
  assert.equal(search.params.buttonText, 'Tìm Kiếm');
  assert.equal(search.params.placeholder, 'Tìm kiếm bài viết');
  assert.equal(found.some((c) => c.component === 'button' && (c.node === 'field' || c.node === 'go')), false);
  const built = buildTemplate(tree, { detections: { components: [{ ...search, id: 'd1', status: 'approved' }] } });
  const el = built.template.content.find((e) => e.id === built.mapping.bar.bricksId);
  assert.equal(el.name, 'search');
  assert.equal(el.settings.buttonText, 'Tìm Kiếm');
  assert.equal(el.settings.actionURL, undefined);
});

test('a domain lookup and a price table stay layout, with no search action and no link', () => {
  const domain = mini({
    children: [kid('bar', {
      name: 'Search desktop',
      layoutMode: 'HORIZONTAL',
      absoluteBoundingBox: { x: 0, y: 0, width: 534, height: 54 },
      children: [
        kid('field', {
          layoutMode: 'HORIZONTAL',
          absoluteBoundingBox: { x: 0, y: 0, width: 389, height: 54 },
          fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
          children: [txt('ph', 'Tìm kiếm tên miền của bạn', { absoluteBoundingBox: { x: 15, y: 12, width: 228, height: 30 } })],
        }),
        kid('go', {
          name: 'Button',
          type: 'INSTANCE',
          layoutMode: 'HORIZONTAL',
          absoluteBoundingBox: { x: 389, y: 0, width: 145, height: 54 },
          fills: [{ type: 'SOLID', color: { r: 1, g: 0.6, b: 0, a: 1 } }],
          children: [txt('gl', 'Tìm Kiếm', { absoluteBoundingBox: { x: 32, y: 12, width: 81, height: 30 } })],
        }),
      ],
    })],
  });
  const found = runRules(domain).components;
  assert.equal(found.some((c) => c.component === 'search'), false);
  assert.equal(found.some((c) => c.component === 'button' && c.node === 'field'), false);
  const button = found.find((c) => c.component === 'button' && c.node === 'go');
  assert.equal(button.params.role, 'layout');
  const built = buildTemplate(domain, { detections: { components: [{ ...button, id: 'd1', status: 'approved' }] } });
  const el = built.template.content.find((e) => e.id === built.mapping.go.bricksId);
  assert.equal(el.settings.link, undefined);
  assert.equal(el.settings._interactions, undefined);

  const price = mini({
    layoutMode: 'HORIZONTAL',
    absoluteBoundingBox: { x: 0, y: 0, width: 640, height: 180 },
    children: [0, 1].map((i) => kid(`card${i}`, {
      layoutMode: 'VERTICAL',
      absoluteBoundingBox: { x: i * 320, y: 0, width: 300, height: 180 },
      children: [
        txt(`p${i}`, '235.000đ/Năm', { absoluteBoundingBox: { x: 16, y: 40, width: 120, height: 24 } }),
        kid(`buy${i}`, {
          name: 'Button',
          type: 'INSTANCE',
          absoluteBoundingBox: { x: 16, y: 120, width: 140, height: 40 },
          fills: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1, a: 1 } }],
          children: [txt(`bl${i}`, 'Mua ngay')],
        }),
      ],
    })),
  });
  const buy = runRules(price).components.find((c) => c.node === 'buy0');
  assert.equal(buy.params.role, 'layout');
});

test('a row of Slider Item components is a slider even when the cards fit', () => {
  const slide = (id, x) => ({
    id, type: 'INSTANCE', name: `Card ${id}`, visible: true, componentSet: 'Slider Item TLD',
    box: { x, y: 0, w: 120, h: 90 },
    children: [{ id: `${id}t`, type: 'TEXT', name: 'TLD', visible: true, text: { characters: '.vn' }, box: { x: 8, y: 8, w: 30, h: 16 }, children: [] }],
  });
  const row = {
    id: 'row', type: 'FRAME', name: 'Frame 1000002508', visible: true,
    layout: { mode: 'HORIZONTAL', wrap: false },
    box: { x: 0, y: 0, w: 560, h: 90 },
    children: [slide('a', 0), slide('b', 136), slide('c', 272), slide('d', 408)],
  };
  const hit = detectCarousels(row);
  assert.equal(hit.length, 1);
  assert.equal(hit[0].node, 'row');
  assert.match(hit[0].evidence, /Slider/);
});

test('confirm and close labels are buttons that close a popup, a plain label stays a link', () => {
  assert.equal(buttonRole('Xác nhận và Lưu'), 'action');
  assert.equal(buttonRole('Chấp nhận tất cả'), 'action');
  assert.equal(buttonRole('Đóng'), 'close');
  assert.equal(buttonRole('Chỉ Cookie cần thiết'), 'action');
  assert.equal(buttonRole('Tìm Kiếm'), 'link');
  const tree = mini({ children: [kid('save', {
    name: 'Button',
    layoutMode: 'HORIZONTAL',
    absoluteBoundingBox: { x: 0, y: 0, width: 160, height: 44 },
    fills: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1, a: 1 } }],
    children: [txt('lab', 'Xác nhận và Lưu')],
  })] });
  const built = buildTemplate(tree, { overrides: { template: { type: 'popup' } }, detections: { components: [{ id: 'd1', component: 'button', node: 'save', status: 'approved', params: { role: 'action' } }] } });
  const el = built.template.content.find((e) => e.id === built.mapping.save.bricksId);
  assert.equal(el.settings._cursor, 'pointer');
  assert.equal(el.settings.tag, 'button');
  assert.equal(el.settings.link, undefined);
  assert.ok(el.settings._attributes.some((a) => a.name === 'data-f2b-close'));
});

test('an accept button on a section hides that section, and a row of buttons stays buttons', () => {
  const tree = mini({ children: [kid('row', {
    name: 'CTA Group',
    layoutMode: 'HORIZONTAL',
    absoluteBoundingBox: { x: 0, y: 0, width: 480, height: 44 },
    children: [
      kid('open', { name: 'Button', absoluteBoundingBox: { x: 0, y: 0, width: 140, height: 44 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], children: [txt('o', 'Tuỳ chỉnh')] }),
      kid('need', { name: 'Button', absoluteBoundingBox: { x: 160, y: 0, width: 180, height: 44 }, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }], children: [txt('n', 'Chỉ Cookie cần thiết')] }),
    ],
  })] });
  const built = buildTemplate(tree, { detections: { components: [
    { id: 'd1', component: 'semantic', node: 'row', status: 'approved', params: { tag: 'ul', itemTag: 'li' } },
    { id: 'd2', component: 'button', node: 'open', status: 'approved', params: { role: 'open', popupId: '528' } },
    { id: 'd3', component: 'button', node: 'need', status: 'approved', params: { role: 'link' } },
  ] } });
  const row = built.template.content.find((e) => e.id === built.mapping.row.bricksId);
  const open = built.template.content.find((e) => e.id === built.mapping.open.bricksId);
  const need = built.template.content.find((e) => e.id === built.mapping.need.bricksId);
  const root = built.template.content.find((e) => e.parent === 0);
  assert.notEqual(row.settings.tag, 'ul');
  assert.equal(open.settings.tag, 'button');
  assert.equal(open.settings._interactions[0].templateId, '528');
  assert.equal(need.settings.tag, 'button');
  assert.equal(need.settings._interactions[0].action, 'hide');
  assert.equal(need.settings._interactions[0].targetSelector, '[data-f2b-dismiss]');
  assert.ok(root.settings._attributes.some((a) => a.name === 'data-f2b-dismiss'));
});

test('a popup close mark keeps data-f2b-close when the icon override sets aria-hidden', () => {
  const tree = mini({
    absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 300 },
    children: [kid('x', { name: 'Icon / X', type: 'INSTANCE', absoluteBoundingBox: { x: 360, y: 12, width: 24, height: 24 } })],
  });
  tree.children.find((c) => c.id === 'x').svg = { file: 'x.svg' };
  const built = buildTemplate(tree, {
    overrides: { template: { type: 'popup' }, nodes: { x: { settings: { _attributes: [{ name: 'aria-hidden', value: 'true' }] }, reason: 'icon' } } },
  });
  const el = built.template.content.find((e) => e.id === built.mapping.x.bricksId);
  assert.ok(el.settings._attributes.some((a) => a.name === 'data-f2b-close' && a.value === '1'));
  assert.equal(el.settings._attributes.some((a) => a.name === 'aria-hidden'), false);
});

test('a button with a popup id opens that popup instead of linking to #', () => {
  const tree = mini({ children: [kid('open', {
    name: 'Button',
    layoutMode: 'HORIZONTAL',
    absoluteBoundingBox: { x: 0, y: 0, width: 140, height: 40 },
    fills: [{ type: 'SOLID', color: { r: 0, g: 0.4, b: 1, a: 1 } }],
    children: [txt('lab', 'Cài đặt')],
  })] });
  const built = buildTemplate(tree, { detections: { components: [{ id: 'd1', component: 'button', node: 'open', status: 'approved', params: { popupId: 528 } }] } });
  const el = built.template.content.find((e) => e.id === built.mapping.open.bricksId);
  assert.equal(el.settings.link, undefined);
  assert.equal(el.settings._interactions[0].action, 'show');
  assert.equal(el.settings._interactions[0].target, 'popup');
  assert.equal(el.settings._interactions[0].templateId, '528');
});

test('a call-to-action button is not a search field', () => {
  const tree = {
    id: 'root', name: 'Section', type: 'FRAME', box: { x: 0, y: 0, w: 800, h: 200 }, children: [{
      id: 'btn', name: 'Button', type: 'INSTANCE', componentSet: 'Button',
      layout: { mode: 'HORIZONTAL' },
      box: { x: 0, y: 0, w: 364, h: 54 },
      fills: [{ type: 'SOLID', hex: '#0066cc', alpha: 1 }],
      children: [
        { id: 't', type: 'TEXT', box: { x: 16, y: 12, w: 200, h: 24 }, text: { characters: 'XEM CHI TIẾT' } },
        { id: 'i', type: 'FRAME', svg: { file: 'svg/i.svg' }, box: { x: 320, y: 14, w: 20, h: 20 }, children: [] },
      ],
    }],
  };
  assert.equal(detectMedia(tree).find((c) => c.component === 'search'), undefined);
});

test('a centered vector on a masked picture is a play mark', () => {
  const tree = {
    id: 'root', type: 'FRAME', box: { x: 0, y: 0, w: 800, h: 400 }, children: [{
      id: 'shot', type: 'GROUP', name: 'Group', box: { x: 0, y: 0, w: 722, h: 386 },
      children: [
        {
          id: 'mask', type: 'GROUP', name: 'Mask group', box: { x: 24, y: 19, w: 699, h: 353 }, children: [
            { id: 'photo', type: 'RECTANGLE', name: 'poster', box: { x: 0, y: 0, w: 736, h: 705 }, fills: [{ type: 'IMAGE' }], children: [] },
          ],
        },
        { id: 'play', type: 'VECTOR', name: 'Exclude', box: { x: 411, y: 159, w: 68, h: 68 }, children: [] },
      ],
    }],
  };
  assert.equal(detectMedia(tree).find((c) => c.component === 'video')?.node, 'shot');
});
