import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hearAnswers } from '../modules/missing-content/index.mjs';
import { choiceOf, resolvePlan } from '../modules/missing-content/choices.mjs';

test('a sentence stays a sentence until the chat writes a choice', () => {
  const heard = hearAnswers({
    'link:a': 'bấm vào vietnix.vn/bang-gia nhé',
    'repeat:b': 'cái này là slider',
    'type:c': 'Single',
  });
  assert.equal(heard['link:a'], 'bấm vào vietnix.vn/bang-gia nhé');
  assert.equal(heard['repeat:b'], 'cái này là slider');
  assert.equal(choiceOf('repeat', heard['repeat:b']), null);
  assert.equal(choiceOf('type', 'popup', 'section').choice, 'popup');
  const open = resolvePlan(heard, {
    'link:a': { choice: 'url', href: 'https://vietnix.vn/bang-gia' },
    'repeat:b': { choice: 'slider' },
  }, () => '');
  assert.equal(open.open.length, 1);
  assert.equal(open.open[0].key, 'type:c');
  assert.equal(open.ready['repeat:b'].choice, 'slider');
  assert.equal(open.ready['link:a'].href, 'https://vietnix.vn/bang-gia');
});
