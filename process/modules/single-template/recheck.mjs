// A value the owner typed on the confirm screen is not built as-is. The caller already read the
// linked frame the same way as the desktop frame. These checks refuse what that read could not
// separate: a tab bar still in the result, two item groups of the same size, or a slide link that
// is the tab buttons.
import { visibleKids } from '../write-bricks/components/helpers.mjs';
import { isNamedTabBar, isSingleTab, isTabList, repeatedSet } from '../write-bricks/components/tab-switch.mjs';

function containsTabBar(node) {
  if (!node || node.visible === false) return false;
  if (isNamedTabBar(node) || isTabList(node)) return true;
  return visibleKids(node).some(containsTabBar);
}

export function rejectTabBar(frame) {
  if (containsTabBar(frame)) throw new Error('Link vẫn còn thanh tab sau khi đọc lại cấu trúc. Không gắn cả khung. Cần link khung chứa các item cùng cấu trúc.');
  return frame;
}

export function rejectAmbiguousItems(frame) {
  if (repeatedSet(visibleKids(frame)).ambiguous) throw new Error('Link có hai nhóm item bằng nhau. Không tự chọn. Gõ tên nhóm item trên màn xác nhận.');
  return frame;
}

export function rejectTabButtons(items) {
  if (items.length >= 2 && items.every(isSingleTab)) throw new Error('Link bộ item đang là thanh tab. Cần link khung chứa các item, theo thứ tự.');
  if (!items.length) throw new Error('Link bộ item không có item nào. Cần link khung chứa các item, theo thứ tự.');
  return items;
}
