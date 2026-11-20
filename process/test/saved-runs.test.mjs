import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PartKind, isKind } from '../modules/recognize-parts/kinds.mjs';
import { runRules } from '../modules/recognize-parts/index.mjs';
import { checkCites } from '../modules/recognize-parts/cite.mjs';
import { priceFrames } from '../modules/write-bricks/components/price-table.mjs';
import { SavedRun, savedRun } from './support/saved-run.mjs';

function kinds(tree, kind) {
  return runRules(tree).components.filter((item) => isKind(item, kind));
}

test('the saved price table keeps a period switch and a price row', () => {
  const desktop = savedRun(SavedRun.PRICE_DESKTOP);
  assert.equal(desktop.tree.id, SavedRun.PRICE_DESKTOP.nodeId);
  assert.ok(priceFrames(desktop.tree).length >= 1);
  const tabs = kinds(desktop.tree, PartKind.TAB_SWITCH);
  assert.equal(tabs.length, 1);
  assert.equal(checkCites(tabs[0].cite, desktop.tree).join(';'), '');
  assert.equal(kinds(desktop.tree, PartKind.FORM).some((item) => item.node === '13697:2386'), false);
  assert.equal(kinds(desktop.tree, PartKind.SEARCH).some((item) => item.node === '13697:7397'), false);
  assert.equal(kinds(desktop.tree, PartKind.BREADCRUMBS).length, 0);

  const mobile = savedRun(SavedRun.PRICE_MOBILE);
  assert.equal(mobile.tree.id, SavedRun.PRICE_MOBILE.nodeId);
  const mobileTabs = kinds(mobile.tree, PartKind.TAB_SWITCH);
  assert.equal(mobileTabs.length, 1);
  assert.equal(checkCites(mobileTabs[0].cite, mobile.tree).join(';'), '');
});

test('the saved section keeps its period switch and its price row', () => {
  const desktop = savedRun(SavedRun.SECTION_DESKTOP);
  assert.equal(desktop.tree.id, SavedRun.SECTION_DESKTOP.nodeId);
  const tabs = kinds(desktop.tree, PartKind.TAB_SWITCH);
  assert.ok(tabs.length >= 1);
  assert.equal(checkCites(tabs[0].cite, desktop.tree).join(';'), '');
  assert.ok(priceFrames(desktop.tree).length >= 1);

  const mobile = savedRun(SavedRun.SECTION_MOBILE);
  assert.equal(mobile.tree.id, SavedRun.SECTION_MOBILE.nodeId);
  assert.ok(priceFrames(mobile.tree).length >= 1);
  assert.equal(kinds(mobile.tree, PartKind.SELECT).length, 1);
});
