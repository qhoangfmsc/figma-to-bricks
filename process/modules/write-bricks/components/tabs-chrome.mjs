// Bricks 1.9.8 Tabs (Nestable). Source: includes/elements/tabs-nested.php get_nestable_children()
// and assets/js/bricks.min.js bricksTabsFn (opens index 0, or the title whose id is the URL hash, by adding brx-open).
// A pane that is a block writes `#brxe-<pane> { display:flex }`. That id rule beats the theme's
// `.brxe-tabs-nested .tab-pane { display:none }`, so every pane stays on screen. The root selector is one class stronger.
// bricksTabsFn adds brx-open only after its script runs. The :has rule shows the first pane until then
// (LiteSpeed may defer bricks.min.js). 1.12.3 reads data-open-tab (openTab, default 0) and adds brx-open there.
// One tab is open in the first paint. A static tab already has brx-open on the title Figma drew
// as active. A query loop repeats one element, so it cannot stamp a single copy. data-open-tab
// is that index. This adds brx-open there when the markup has none. A title flagged as the data's open tab wins.
export function activateOpenTab(root) {
  const title = root.querySelector('.tab-title');
  const titles = title ? [...title.parentNode.children].filter((el) => el.classList?.contains('tab-title')) : [];
  if (!titles.length || titles.some((el) => el.classList.contains('brx-open'))) return;
  const pane = root.querySelector('.tab-pane');
  const panes = pane ? [...pane.parentNode.children].filter((el) => el.classList?.contains('tab-pane')) : [];
  let index = Number.parseInt(root.getAttribute('data-open-tab') || '0', 10);
  if (!Number.isFinite(index) || index < 0 || index >= titles.length) index = 0;
  // A price table flags its popular cycle on the looped title (data-vnx-sp-open-tab="1"). That title opens, and the root index
  // follows it so Bricks opens the same tab instead of adding a second one.
  const flagged = titles.findIndex((el) => el.getAttribute?.('data-vnx-sp-open-tab') === '1');
  if (flagged >= 0) {
    index = flagged;
    root.setAttribute?.('data-open-tab', String(index));
  }
  titles[index].classList.add('brx-open');
  titles[index].setAttribute('aria-selected', 'true');
  if (panes[index]) panes[index].classList.add('brx-open');
}

export function tabsOpenScript() {
  return `(function(){${activateOpenTab.toString()}document.querySelectorAll(".brxe-tabs-nested").forEach(activateOpenTab);})();`;
}

// keepTitleWidth: the drawn title has a fixed width. That width is the title's own setting, so the root rule does not reset it.
export function tabsChromeCss({ keepTitleWidth = false } = {}) {
  return [
    { decl: 'display: none;', suffix: ' .tab-pane' },
    { decl: 'display: flex;', suffix: ' .tab-pane.brx-open' },
    { decl: 'display: flex;', suffix: ':not(:has(.tab-pane.brx-open)) .tab-pane:first-child' },
    // A query loop writes a template marker before the repeated pane, so that pane is not :first-child.
    { decl: 'display: flex;', suffix: ':not(:has(.tab-pane.brx-open)) template + .tab-pane' },
    ...(keepTitleWidth ? [] : [{ decl: 'width: auto;', suffix: ' .tab-title' }]),
  ];
}
