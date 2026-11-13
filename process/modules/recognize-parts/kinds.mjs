// One list. Each entry is a component the build can turn into an element.
// childComponent names the parts of that component. A part is not its own element.
// A layer name only raises confidence. The plan stores the owner's words.
// The chat writes a choice from process/modules/missing-content/choices.mjs. Code switches on that choice.

export const PartKind = {
  TOOLTIP: 'tooltip',
  BUTTON: 'button',
  FLAT_IMAGE: 'flat-image',
  CAROUSEL: 'carousel',
  FORM: 'form',
  ACCORDION: 'accordion',
  TABS: 'tabs',
  TAB_SWITCH: 'tab-switch',
  MENU: 'menu',
  MENU_SLIDER: 'menu-slider',
  BREADCRUMBS: 'breadcrumbs',
  READMORE: 'readmore',
  CHECKBOX: 'checkbox',
  SWITCH: 'switch',
  RADIO: 'radio',
  DIVIDER: 'divider',
  SEARCH: 'search',
  VIDEO: 'video',
  GALLERY: 'gallery',
  PROGRESS: 'progress',
  RATING: 'rating',
  ALERT: 'alert',
  LOGO: 'logo',
  HAMBURGER: 'hamburger',
  DROPDOWN: 'dropdown',
  OFFCANVAS: 'offcanvas',
  SCROLL: 'scroll',
};

const tabsBar = {
  id: 'tabs_bar',
  param: 'tabs_bar',
  label: 'Tabs bar',
  shape: 'One title is active. At least one title is inactive. More inactive titles stay in the same horizontal row. Height and the layer name do not decide.',
  hint: 'tab',
};

const tabsData = {
  id: 'tabs_data',
  param: 'tabs_data',
  label: 'Tabs data',
  shape: 'The content frame directly under the bar. A frame that is not under the bar is not this content.',
  hint: 'none',
};

const none = [];

// shape is the rule. hint only raises confidence. anv is a note of the copy the idea came from. The build does not read it.
// childComponent is the parts the plan names. param is the key already stored on the detection.
export const SIGNAL_RULES = {
  [PartKind.BUTTON]: {
    shape: 'One text, at most one icon, height 32–56, and a fill, stroke, radius, or padding.',
    hint: 'button, btn, cta',
    anv: 'Button Frame, or text that is a click target',
    childComponent: none,
  },
  [PartKind.FORM]: {
    shape: 'Two or more text fields plus a button. One text field is enough on a dim overlay or beside a close mark. Switch, checkbox, and radio rows stay their own controls.',
    hint: 'none',
    anv: 'Form Frame',
    childComponent: none,
  },
  [PartKind.CHECKBOX]: {
    shape: 'A small square beside one label. An icon glyph (svg or icon font, no stroke box) is not a square.',
    hint: 'checkbox',
    anv: 'icon + text row that is not a button',
    childComponent: none,
  },
  [PartKind.RADIO]: {
    shape: 'A small circle beside one label. A rounded icon glyph is not a circle.',
    hint: 'radio',
    anv: 'icon + text row that is not a button',
    childComponent: none,
  },
  [PartKind.SWITCH]: {
    shape: 'A pill with one knob and one label.',
    hint: 'switch, toggle',
    anv: 'ANV has no switch row. Bricks toggle is the hamburger. This pill stays a switch',
    childComponent: none,
  },
  [PartKind.SEARCH]: {
    shape: 'A wide field with one text and one icon, or a field beside a button labeled search.',
    hint: 'search',
    anv: 'not a separate row; we keep it off a form field',
    childComponent: none,
  },
  [PartKind.VIDEO]: {
    shape: 'A picture with one play circle near the centre.',
    hint: 'video, player',
    anv: 'Video Frame',
    childComponent: none,
  },
  [PartKind.CAROUSEL]: {
    shape: 'A horizontal row of the same card. It is a carousel when the frame or its parent clips and a card sits outside the row, or a prev and next pair sits on the row or on the sibling above or below, or a dash or dot row belongs to the frame. One such row is the basic slider, and that row is the slide. Two or more rows of that card, every row inside the frame, plus that dash row, are still one page: the rows are the layout of the page, not separate slides. A shape that is not that card, such as a fade at the edge, is not a slide. Missing buttons do not cancel it. The same cards sitting fully inside the frame, with no clip, no buttons, and no dash row, stay a grid.',
    hint: 'slider, carousel',
    anv: 'Component (Slider/Carousel) → slider-nested',
    childComponent: [
      {
        id: 'pagination_carousel',
        param: 'pagination',
        label: 'Pagination',
        shape: 'The dash or dot row. One active mark, darker or longer, and any number of idle marks of one size. Child layers, one svg of those strokes, or the Dash and Dot switches that are on. The total is the slide count. A layer name alone is not this row.',
        hint: 'pagination, dots, pager',
      },
      {
        id: 'carousel_prev',
        param: 'prev',
        label: 'Nút trước',
        shape: 'The previous control beside the carousel: a left arrow, or the left icon of a pair above or below the row. Absent when that pair is not drawn.',
        hint: 'prev, arrow',
      },
      {
        id: 'carousel_next',
        param: 'next',
        label: 'Nút sau',
        shape: 'The next control beside the carousel: a right arrow, or the right icon of a pair above or below the row. Absent when that pair is not drawn.',
        hint: 'next, arrow',
      },
    ],
  },
  [PartKind.ACCORDION]: {
    shape: 'Two or more rows of the same width, each a title and optional body.',
    hint: 'faq, accordion',
    anv: 'Component (Accordion/FAQ)',
    childComponent: none,
  },
  [PartKind.TABS]: {
    shape: 'A tabs bar and the tabs data directly under it.',
    hint: 'tab',
    anv: 'not in the layout table; same bar-plus-pane shape',
    childComponent: [tabsBar, tabsData],
  },
  [PartKind.TAB_SWITCH]: {
    shape: 'The same tabs bar and tabs data when the content is not the bar\'s only sibling. A divider between the titles is optional evidence.',
    hint: 'tab',
    anv: 'same as tabs when the pane is a repeated list',
    childComponent: [tabsBar, tabsData],
  },
  [PartKind.MENU]: {
    shape: 'A horizontal row of short link labels, no picture. A title plus a badge, a row that holds a switch, or a bar of filled buttons is not a link row.',
    hint: 'menu, nav',
    anv: 'nav-menu is a WordPress menu id; this row is ul > li',
    childComponent: none,
  },
  [PartKind.BREADCRUMBS]: {
    shape: 'A horizontal trail of labels. A separator icon sits before every label after the first, or the labels and separators alternate. A row of labels with no separators stays a menu.',
    hint: 'breadcrumb',
    anv: 'the Bricks breadcrumbs element already existed; detection was missing',
    childComponent: none,
  },
  [PartKind.MENU_SLIDER]: {
    shape: 'The same link row when the labels run past the frame.',
    hint: 'menu, nav',
    anv: 'same row, not nav-menu',
    childComponent: none,
  },
  [PartKind.DIVIDER]: {
    shape: 'A line: one side at most 2px, the other at least 40px.',
    hint: 'none',
    anv: 'not in the layout table',
    childComponent: none,
  },
  [PartKind.READMORE]: {
    shape: 'A clipped frame whose content is taller than the frame, plus a button after it.',
    hint: 'the button text',
    anv: 'not in the layout table',
    childComponent: none,
  },
  [PartKind.TOOLTIP]: {
    shape: 'An info or question icon next to a label.',
    hint: 'tooltip',
    anv: 'not in the layout table',
    childComponent: none,
  },
  [PartKind.FLAT_IMAGE]: {
    shape: 'A hand-placed frame of artwork with little text.',
    hint: 'none',
    anv: 'Image/Photo wrapped in a block',
    childComponent: none,
  },
  [PartKind.GALLERY]: {
    shape: 'Three or more pictures of one size, in a row or a grid, with no arrows.',
    hint: 'none',
    anv: 'image-gallery',
    childComponent: none,
  },
  [PartKind.PROGRESS]: {
    shape: 'A track and a shorter fill inside it. The fill width is the percent.',
    hint: 'none',
    anv: 'progress-bar',
    childComponent: none,
  },
  [PartKind.RATING]: {
    shape: 'A row of the same star mark, at least four.',
    hint: 'none',
    anv: 'rating. The icon name is not invented',
    childComponent: none,
  },
  [PartKind.ALERT]: {
    shape: 'A short tinted bar with one icon and one sentence.',
    hint: 'none',
    anv: 'alert. The info/success type is not guessed from the color',
    childComponent: none,
  },
  [PartKind.LOGO]: {
    shape: 'The first picture in a short wide bar that also has links.',
    hint: 'logo',
    anv: 'logo. The link stays the site address until the plan has one',
    childComponent: none,
  },
  [PartKind.HAMBURGER]: {
    shape: 'Three stacked lines in a small square.',
    hint: 'none',
    anv: 'toggle. That element is the hamburger, not a switch',
    childComponent: none,
  },
  [PartKind.DROPDOWN]: {
    shape: 'One short label, one small chevron, and a vertical list of labels.',
    hint: 'none',
    anv: 'dropdown',
    childComponent: none,
  },
  [PartKind.OFFCANVAS]: {
    shape: 'A tall panel against the left or right edge, with a close mark.',
    hint: 'none',
    anv: 'offcanvas',
    childComponent: none,
  },
  [PartKind.SCROLL]: {
    shape: 'A darker thumb on a lighter track. The pair is its own frame beside repeated items, or it is drawn on the content frame. The drawn pair is the scroll. The text box does not have to be taller than that frame. The two shapes are not a divider.',
    hint: 'none',
    anv: 'not a gallery. A native overflow row was a hand-written recipe',
    childComponent: [
      {
        id: 'thumb_scroll',
        param: 'thumb',
        label: 'Nút kéo',
        shape: 'The shorter, darker bar. It lies on the track. It is not a divider and not its own element.',
        hint: 'none',
      },
      {
        id: 'track_scroll',
        param: 'track',
        label: 'Thanh kéo',
        shape: 'The longer, lighter bar. The thumb lies on it. It is not a divider and not its own element.',
        hint: 'none',
      },
    ],
  },
};

export function childById(id) {
  for (const [parent, rule] of Object.entries(SIGNAL_RULES)) {
    const hit = (rule.childComponent ?? []).find((child) => child.id === id);
    if (hit) return { ...hit, of: parent };
  }
  return null;
}

export const partRule = (kind) => SIGNAL_RULES[kind] ?? childById(kind);
export const isSignal = (kind) => childById(kind) != null;
export const childKindIds = () => [...new Set(Object.values(SIGNAL_RULES).flatMap((rule) => (rule.childComponent ?? []).map((child) => child.id)))];
