// Page settings for a popup template. Bricks stores these on the template post
// (BRICKS_DB_PAGE_SETTINGS). The script calls bricksOpenPopup / bricksClosePopup
// and writes one cookie named with the template id. It does not write theme styles.
//
// Keys that exist on a popup in this theme (includes/popups.php set_controls).
// A key is written only when this file or the plan has a value. Nothing below is invented.
//   popupPadding, popupJustifyConent, popupAlignItems
//   popupCloseOn: backdrop | esc | none. Omitting it keeps Backdrop and ESC.
//   popupZindex (placeholder 10000), popupBodyScroll, popupScrollToTop, popupDisableAutoFocus
//   popupAjax, popupIsWoo, popupAjaxLoaderAnimation, popupAjaxLoaderColor, popupAjaxLoaderScale, popupAjaxLoaderSelector
//   popupBreakpointMode: at | on, then popupShowAt or popupShowOn. There is no popupDisableOnMobile.
//   popupDisableBackdrop, popupBackground, popupBackdropTransition
//   popupContentPadding, popupContentWidth, popupContentHeight, popupContentBackground, popupContentBorder, popupContentBoxShadow
//   popupLimitWindow, popupLimitSessionStorage, popupLimitLocalStorage, popupLimitTimeStorage
// Opening a popup is an interaction, not a popup* key: trigger click | contentLoaded | scroll | mouseleaveWindow,
// action "show", target "popup", templateId (includes/interactions.php). The template element reads settings.template.
// Filters bricks/template/id and bricks/template/conditions are not in this theme.
//
// popupContentWidth is required. Without it popups.php adds the class brxe-container,
// and that class is a 1100px box around the card (includes/popups.php, assets.php).
// The width and the backdrop color are the Figma card and the dim fill. Padding on the
// wrapper is 0 because the card already has its own padding.
import { colorObj } from '../render/utils/css.mjs';

export function popupPageSettings(templateId, stage = null) {
  const id = String(templateId);
  const cookie = `f2b_popup_${id}`;
  const settings = {
    popupCloseOn: 'backdrop',
    // Entire website, hidden until a button runs show + templateId.
    // A popup with no condition is only in its own preview, so a button on another template cannot find it.
    templateConditions: [{ id: 'f2bany', main: 'any' }],
    customScriptsBodyFooter: `(function () {
  var id = ${JSON.stringify(id)};
  var cookie = ${JSON.stringify(cookie)};
  function hasCookie() {
    return document.cookie.split('; ').some(function (part) { return part.indexOf(cookie + '=') === 0; });
  }
  function remember() {
    document.cookie = cookie + '=1; Path=/; SameSite=Lax';
  }
  document.addEventListener('click', function (event) {
    var opener = event.target.closest && event.target.closest('[data-f2b-open="' + id + '"]');
    if (opener && !hasCookie() && window.bricksOpenPopup) window.bricksOpenPopup(id);
    var closer = event.target.closest && (event.target.closest('.brx-popup[data-popup-id="' + id + '"] .brx-popup-backdrop') || event.target.closest('.brx-popup[data-popup-id="' + id + '"] [data-f2b-close]'));
    if (closer) {
      remember();
      if (window.bricksClosePopup) window.bricksClosePopup(id);
    }
  });
})();`,
  };
  if (stage?.width) {
    settings.popupContentWidth = `${Math.round(stage.width)}px`;
    settings.popupContentPadding = { top: '0px', right: '0px', bottom: '0px', left: '0px' };
  }
  if (stage?.backdrop?.hex) settings.popupBackground = { color: colorObj({ hex: stage.backdrop.hex, alpha: stage.backdrop.alpha ?? 1 }) };
  return settings;
}
