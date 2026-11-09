import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runRules } from '../modules/recognize-parts/index.mjs';
import { normalizeRoot } from '../modules/read-figma/normalize.mjs';
import { WOO_ELEMENTS, wooElement } from '../modules/standby/woocommerce.mjs';
import { postQuery, postsElement } from '../modules/standby/query.mjs';
import { acfTag, metaTag } from '../modules/standby/dynamic.mjs';
import { conditions } from '../modules/standby/conditions.mjs';
import { masonrySettings, shapeDivider } from '../modules/standby/layout-extra.mjs';

const themeWoo = join(dirname(fileURLToPath(import.meta.url)), '../../wp-content/themes/bricks/includes/woocommerce/elements');
const detectSource = readFileSync(new URL('../modules/recognize-parts/index.mjs', import.meta.url), 'utf8');

test('standby modules stay out of detection', () => {
  assert.equal(detectSource.includes('standby'), false);
  const tree = normalizeRoot({ nodes: { r: { document: { id: 'r', name: 'Cards', type: 'FRAME', absoluteBoundingBox: { x: 0, y: 0, width: 400, height: 200 }, children: [] } } } }, 'r', { images: {}, svgs: {} });
  const names = new Set(runRules(tree).components.map((c) => c.component));
  assert.equal(names.has('posts'), false);
  assert.equal(names.has('woocommerce'), false);
});

test('WooCommerce names match the element files in this theme', () => {
  const files = readdirSync(themeWoo)
    .filter((name) => name.endsWith('.php') && name !== 'base.php' && name !== 'woocommerce-template-hook.php')
    .map((name) => name.replace(/\.php$/, ''))
    .sort();
  assert.deepEqual([...WOO_ELEMENTS].sort(), files);
  assert.equal(wooElement('product-title').name, 'product-title');
  assert.throws(() => wooElement('woocommerce-account-payment-methods'));
});

test('query, tags, conditions, masonry and shapes refuse a missing plan value', () => {
  assert.deepEqual(postQuery({ postType: 'post', perPage: 6 }), { objectType: 'post', post_type: ['post'], posts_per_page: 6 });
  assert.equal(postsElement(postQuery({ postType: 'post' })).name, 'posts');
  assert.throws(() => postQuery({}));
  assert.equal(acfTag('price'), '{acf_price}');
  assert.equal(metaTag('subtitle'), '{cf_subtitle}');
  assert.throws(() => acfTag(''));
  assert.deepEqual(conditions([[{ key: 'user_logged_in', compare: '==', value: 1 }]]), [[{ key: 'user_logged_in', compare: '==', value: 1 }]]);
  assert.throws(() => conditions([[{ key: 'device', compare: '==', value: 'mobile' }]]));
  assert.throws(() => conditions([[{ key: 'post_type', compare: '==', value: 'post' }]]));
  assert.deepEqual(masonrySettings({ columns: 3, gutter: '16px' }), { _useMasonry: true, _masonryColumn: 3, _masonryGutter: '16px' });
  assert.throws(() => masonrySettings({}));
  assert.deepEqual(shapeDivider({ shape: 'wave' }), { _shapeDividers: [{ shape: 'wave' }] });
  assert.throws(() => shapeDivider({ shape: 'blob' }));
});
