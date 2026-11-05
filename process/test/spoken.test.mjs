import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hearAnswers, validateAnswers, readPane } from '../plan/index.mjs';

test('a normal sentence is read as the value the field needs', () => {
  const heard = hearAnswers({
    'link:a': 'bấm vào vietnix.vn/bang-gia nhé',
    'link:b': 'chưa có',
    'alt:c': 'đây là logo Vietnix',
    'alt:d': 'ảnh trang trí thôi',
    'autoplay:e': 'đừng tự chạy, chỉ khi bấm',
    'autoplay:f': 'chạy mỗi 5 giây',
    'count:g': 'khoảng 8 cái',
    'pane:h': 'lấy khung https://www.figma.com/design/Abcd/n?node-id=12-3',
    'act:i': 'mở trang vietnix.vn/lien-he',
  });
  assert.equal(heard['link:a'], 'https://vietnix.vn/bang-gia');
  assert.equal(heard['link:b'], 'chưa có địa chỉ');
  assert.equal(heard['alt:c'], 'đây là logo Vietnix');
  assert.equal(heard['alt:d'], 'ảnh chỉ để trang trí');
  assert.equal(heard['autoplay:e'], 'không tự chuyển');
  assert.equal(heard['autoplay:f'], '5');
  assert.equal(heard['count:g'], '8');
  assert.equal(heard['act:i'], 'https://vietnix.vn/lien-he');
  assert.equal(readPane(heard['pane:h']).nodeId, '12:3');
  assert.equal(validateAnswers(heard).length, 0);
});
