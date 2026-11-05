// Bricks 1.9.8 Tabs (Nestable). Source: includes/elements/tabs-nested.php get_nestable_children()
// and assets/js/bricks.min.js bricksTabsFn (opens index 0, or the title whose id is the URL hash, by adding brx-open).
// A pane that is a block writes `#brxe-<pane> { display:flex }`. That id rule beats the theme's
// `.brxe-tabs-nested .tab-pane { display:none }`, so every pane stays on screen. The root selector is one class stronger.
// bricksTabsFn adds brx-open only after its script runs. The :has rule shows the first pane until then
// (LiteSpeed may defer bricks.min.js). 1.12.3 reads data-open-tab (openTab, default 0) and adds brx-open there.
export function tabsChromeCss() {
  return [
    { decl: 'display: none;', suffix: ' .tab-pane' },
    { decl: 'display: flex;', suffix: ' .tab-pane.brx-open' },
    { decl: 'display: flex;', suffix: ':not(:has(.tab-pane.brx-open)) .tab-pane:first-child' },
    { decl: 'width: auto;', suffix: ' .tab-title' },
  ];
}
