import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applySiteCss, extractGlobalClasses, normalizePalette, pullSiteCss, siteOrigin } from '../modules/staging/site-css.mjs';
import { requireSiteEnv } from '../modules/common/env.mjs';
import { externalCssUrl, frontendCheckUrl } from '../modules/build-steps/07-verify.mjs';

test('the tool stops when any site key is missing', () => {
  const full = { WP_URL: 'https://site.example', WP_USER: 'editor', WP_PASSWORD: 'app-pass', FIGMA_TOKEN: 'figma', MCP_TOKEN: 'mcp' };
  assert.doesNotThrow(() => requireSiteEnv(full));
  assert.throws(() => requireSiteEnv({ ...full, WP_PASSWORD: '  ' }), /WP_PASSWORD/);
  assert.throws(() => requireSiteEnv({}), /WP_URL, WP_USER, WP_PASSWORD, FIGMA_TOKEN, MCP_TOKEN/);
});

test('the Figma check uses the site in WP_URL and fails when it is missing', () => {
  assert.throws(() => frontendCheckUrl('https://other.example/template/?bricks_preview=1', ''), /Missing WP_URL/);
  assert.throws(() => frontendCheckUrl('https://other.example/template/?bricks_preview=1'), /Missing WP_URL/);
  assert.throws(() => externalCssUrl('', 'post-1.min.css'), /Missing WP_URL/);
  const site = 'https://site.example';
  const ok = frontendCheckUrl('https://other.example/template/vps/?bricks_preview=171000', site);
  assert.equal(new URL(ok).origin, site);
  assert.match(ok, /bricks_preview=171000/);
  assert.throws(() => frontendCheckUrl('https://other.example/template/?bricks=run', site), /editor/);
  assert.throws(() => frontendCheckUrl('https://other.example/?page_id=12', site), /bricks_preview/);
});

test('css pull uses the site in WP_URL', () => {
  assert.throws(() => siteOrigin({}), /WP_URL/);
  assert.throws(() => siteOrigin({ WP_URL: '' }), /WP_URL/);
  assert.equal(siteOrigin({ WP_URL: 'https://site.example/blog' }), 'https://site.example');
});

test('a repeated palette name keeps the later value', () => {
  const out = normalizePalette(':root {--bricks-color-aaaaaa: #ffffff;--bricks-color-bbbbbb: #111111;--bricks-color-aaaaaa: #000000;}');
  assert.equal(out.declarations, 3);
  assert.equal(out.unique, 2);
  assert.match(out.css, /--bricks-color-aaaaaa: #000000;/);
  assert.doesNotMatch(out.css, /#ffffff/);
});

test('homepage inline styles become the global class snapshot', () => {
  const html = `
    <style id="other">.tt { color: red; }</style>
    <style id="bricks-frontend-inline-inline-css">.hidden.brxe-block {position: absolute} /*# sourceURL=bricks-frontend-inline-inline-css */</style>
    <style id="bricks-global-classes-inline-inline-css">
      .btn_tawk.brxe-button {font-size: 20px}
      @media (max-width: 991px) {.btn_tawk.brxe-button {font-size: 12px}}
      .is_rich_text p {margin-top: 1rem}
    </style>`;
  const css = extractGlobalClasses(html);
  assert.match(css, /\.hidden\.brxe-block/);
  assert.match(css, /@media \(max-width: 991px\)/);
  assert.match(css, /\.is_rich_text p/);
  assert.doesNotMatch(css, /\.tt/);
  assert.doesNotMatch(css, /sourceURL/);
});

test('pull writes the snapshot and apply copies the four Bricks file names', async () => {
  const snapshot = mkdtempSync(join(tmpdir(), 'f2b-css-snap-'));
  const uploads = mkdtempSync(join(tmpdir(), 'f2b-css-up-'));
  const pages = {
    'https://staging.example/wp-content/uploads/bricks/css/color-palettes.min.css': ':root {--bricks-color-aaaaaa: #ffffff;--bricks-color-aaaaaa: #ffffff;}',
    'https://staging.example/wp-content/uploads/bricks/css/global-variables.min.css': ':root {--header-height: 121px;}',
    'https://staging.example/wp-content/uploads/bricks/css/global-elements.min.css': '.brxe-vweslf {width: 100%}',
    'https://staging.example/': '<style id="bricks-global-classes-inline-inline-css">.btn_tawk.brxe-button {font-size: 20px}</style>',
  };
  const manifest = await pullSiteCss({
    origin: 'https://staging.example',
    snapshotDir: snapshot,
    now: () => new Date('2026-11-10T02:00:00.000Z'),
    fetchImpl: async (url) => ({ ok: true, status: 200, text: async () => pages[url] }),
  });
  assert.equal(manifest.palette.unique, 1);
  assert.match(readFileSync(join(snapshot, 'global-variables.css'), 'utf8'), /--header-height: 121px/);
  const written = applySiteCss(snapshot, uploads);
  assert.deepEqual(written, [
    'color-palettes.min.css',
    'global-variables.min.css',
    'global-elements.min.css',
    'global-custom-css.min.css',
  ]);
  assert.match(readFileSync(join(uploads, 'global-custom-css.min.css'), 'utf8'), /\.btn_tawk\.brxe-button/);
});
