// One enum for every part a section can be. A rule matches the shape.
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
};

// shape is the rule. hint only raises confidence. anv is a note of the copy the idea came from. The build does not read it.
export const PART_RULES = {
  [PartKind.BUTTON]: {
    shape: 'One text, at most one icon, height 32–56, and a fill, stroke, radius, or padding.',
    hint: 'button, btn, cta',
    anv: 'Button Frame, or text that is a click target',
  },
  [PartKind.FORM]: {
    shape: 'Two or more text fields plus a button. One text field is enough on a dim overlay or beside a close mark. Switch, checkbox, and radio rows stay their own controls.',
    hint: 'none',
    anv: 'Form Frame',
  },
  [PartKind.CHECKBOX]: {
    shape: 'A small square beside one label. An icon glyph (svg or icon font, no stroke box) is not a square.',
    hint: 'checkbox',
    anv: 'icon + text row that is not a button',
  },
  [PartKind.RADIO]: {
    shape: 'A small circle beside one label. A rounded icon glyph is not a circle.',
    hint: 'radio',
    anv: 'icon + text row that is not a button',
  },
  [PartKind.SWITCH]: {
    shape: 'A pill with one knob and one label.',
    hint: 'switch, toggle',
    anv: 'ANV has no switch row. Bricks toggle is the hamburger. This pill stays a switch',
  },
  [PartKind.SEARCH]: {
    shape: 'A wide field with one text and one icon, or a field beside a button labeled search.',
    hint: 'search',
    anv: 'not a separate row; we keep it off a form field',
  },
  [PartKind.VIDEO]: {
    shape: 'A picture with one play circle near the centre.',
    hint: 'video, player',
    anv: 'Video Frame',
  },
  [PartKind.CAROUSEL]: {
    shape: 'A horizontal row of similar cards, or one clipped slide with arrow buttons.',
    hint: 'slider, carousel',
    anv: 'Component (Slider/Carousel) → slider-nested',
  },
  [PartKind.ACCORDION]: {
    shape: 'Two or more rows of the same width, each a title and optional body.',
    hint: 'faq, accordion',
    anv: 'Component (Accordion/FAQ)',
  },
  [PartKind.TABS]: {
    shape: 'A horizontal bar of two or more titles and one content frame under it.',
    hint: 'tab',
    anv: 'not in the layout table; same bar-plus-pane shape',
  },
  [PartKind.TAB_SWITCH]: {
    shape: 'Tab buttons, one of them active, then the repeated items of that tab.',
    hint: 'tab',
    anv: 'same as tabs when the pane is a repeated list',
  },
  [PartKind.MENU]: {
    shape: 'A horizontal row of short link labels, no picture. A title plus a badge, a row that holds a switch, or a bar of filled buttons is not a link row.',
    hint: 'menu, nav',
    anv: 'nav-menu is a WordPress menu id; this row is ul > li',
  },
  [PartKind.MENU_SLIDER]: {
    shape: 'The same link row when the labels run past the frame.',
    hint: 'menu, nav',
    anv: 'same row, not nav-menu',
  },
  [PartKind.DIVIDER]: {
    shape: 'A line: one side at most 2px, the other at least 40px.',
    hint: 'none',
    anv: 'not in the layout table',
  },
  [PartKind.READMORE]: {
    shape: 'A clipped frame whose content is taller than the frame, plus a button after it.',
    hint: 'the button text',
    anv: 'not in the layout table',
  },
  [PartKind.TOOLTIP]: {
    shape: 'An info or question icon next to a label.',
    hint: 'tooltip',
    anv: 'not in the layout table',
  },
  [PartKind.FLAT_IMAGE]: {
    shape: 'A hand-placed frame of artwork with little text.',
    hint: 'none',
    anv: 'Image/Photo wrapped in a block',
  },
  [PartKind.GALLERY]: {
    shape: 'Three or more pictures of one size, in a row or a grid, with no arrows.',
    hint: 'none',
    anv: 'image-gallery',
  },
  [PartKind.PROGRESS]: {
    shape: 'A track and a shorter fill inside it. The fill width is the percent.',
    hint: 'none',
    anv: 'progress-bar',
  },
  [PartKind.RATING]: {
    shape: 'A row of the same star mark, at least four.',
    hint: 'none',
    anv: 'rating. The icon name is not invented',
  },
  [PartKind.ALERT]: {
    shape: 'A short tinted bar with one icon and one sentence.',
    hint: 'none',
    anv: 'alert. The info/success type is not guessed from the color',
  },
  [PartKind.LOGO]: {
    shape: 'The first picture in a short wide bar that also has links.',
    hint: 'logo',
    anv: 'logo. The link stays the site address until the plan has one',
  },
  [PartKind.HAMBURGER]: {
    shape: 'Three stacked lines in a small square.',
    hint: 'none',
    anv: 'toggle. That element is the hamburger, not a switch',
  },
  [PartKind.DROPDOWN]: {
    shape: 'One short label, one small chevron, and a vertical list of labels.',
    hint: 'none',
    anv: 'dropdown',
  },
  [PartKind.OFFCANVAS]: {
    shape: 'A tall panel against the left or right edge, with a close mark.',
    hint: 'none',
    anv: 'offcanvas',
  },
};

export const partRule = (kind) => PART_RULES[kind] ?? null;
