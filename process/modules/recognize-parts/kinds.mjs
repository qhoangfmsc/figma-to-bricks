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
  SELECT: 'select',
  OFFCANVAS: 'offcanvas',
  SCROLL: 'scroll',
  PRICE_TABLE: 'price-table',
  COMPARE_TABLE: 'compare-table',
  LINK: 'link',
  SEMANTIC: 'semantic',
  ICON_LIST: 'icon-list',
  COUNTER: 'counter',
  COUNTDOWN: 'countdown',
  TOOLTIP_STYLE: 'tooltip-style',
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
    shape: 'One text, at most one icon, and a fill, stroke, radius, or padding. Height does not decide.',
    hint: 'button, btn, cta',
    anv: 'Button Frame, or text that is a click target',
    childComponent: none,
  },
  [PartKind.FORM]: {
    shape: 'Text fields and a submit control. One text field is enough on a dim overlay or beside a close mark. Switch, checkbox, and radio rows stay their own controls. A missing field does not cancel the form.',
    hint: 'none',
    anv: 'Form Frame',
    childComponent: [
      { id: 'form_submit', param: 'submit', label: 'Nút gửi', shape: 'The submit control. Absent when the frame draws no submit.', hint: 'none' },
    ],
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
        shape: 'The dash or dot row. One mark does not share the idle look. Darker, longer, or a selected variant are ways that difference shows. Any number of idle marks share one look. Child layers, one svg of those strokes, or the Dash and Dot switches that are on. The total is the slide count. A layer name alone is not this row.',
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
    shape: 'A line: one side is far thinner than the other. The thin side is the stroke.',
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
    shape: 'Pictures of one size, in a row or a grid, with no arrows. A clipped row that overflows is a carousel.',
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
    shape: 'A row of the same star mark. The count is however many the row draws.',
    hint: 'none',
    anv: 'rating. The icon name is not invented',
    childComponent: none,
  },
  [PartKind.ALERT]: {
    shape: 'A tinted bar with one icon and one sentence.',
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
  [PartKind.SELECT]: {
    shape: 'A short wide bordered control. One value, and a small mark after that value. A label above the control is optional. The option list may be absent.',
    hint: 'none',
    anv: 'dropdown. The list comes from the plan',
    childComponent: [
      { id: 'select_list', param: 'values', label: 'Các lựa chọn', shape: 'The option lines. Absent when the list is not drawn. The plan then asks.', hint: 'none' },
    ],
  },
  [PartKind.DROPDOWN]: {
    shape: 'One short label and one small chevron. A vertical list of labels may sit with them. No list does not cancel the dropdown.',
    hint: 'none',
    anv: 'dropdown',
    childComponent: [
      { id: 'dropdown_list', param: 'list', label: 'Danh sách', shape: 'The vertical labels. Absent when the list is closed.', hint: 'none' },
    ],
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
  [PartKind.PRICE_TABLE]: {
    shape: 'A row of package cards. Each card has a name, an amount, and a sign-up control. Cycle pills may sit with the row. A missing arrow does not cancel the table.',
    hint: 'none',
    anv: 'Service Pricing. The words are slots. The data is one id',
    childComponent: [
      { id: 'price_cycle', param: 'cycle', label: 'Chu kỳ', shape: 'The cycle pills. Absent when the frame draws one closed cycle field.', hint: 'none' },
      { id: 'price_card', param: 'card', label: 'Thẻ gói', shape: 'One package card. The loop repeats it.', hint: 'none' },
      { id: 'price_row', param: 'row', label: 'Dòng thông tin', shape: 'One info line inside the card. Absent when the card draws no lines.', hint: 'none' },
    ],
  },
  [PartKind.COMPARE_TABLE]: {
    shape: 'One package row and groups of cells that line up, one cell per package. A missing expand control does not cancel the table.',
    hint: 'none',
    anv: 'Comparison table. The words are slots. The data is one id',
    childComponent: [
      { id: 'compare_column', param: 'column', label: 'Cột gói', shape: 'One package column. The loop repeats it.', hint: 'none' },
      { id: 'compare_group', param: 'group', label: 'Nhóm dòng', shape: 'One feature group. Absent when the table draws a single list.', hint: 'none' },
      { id: 'compare_row', param: 'row', label: 'Dòng so sánh', shape: 'One aligned feature row.', hint: 'none' },
    ],
  },
  [PartKind.LINK]: {
    shape: 'One text label that is a control and has no filled button body.',
    hint: 'none',
    anv: 'text-link. The URL comes from the plan',
    childComponent: none,
  },
  [PartKind.SEMANTIC]: {
    shape: 'A container whose visible children repeat one item shape. Accordion, tab, menu, slider, form, and a bound table already own their children.',
    hint: 'none',
    anv: 'ul, ol, dl. A part of a bound table is not this list',
    childComponent: none,
  },
  [PartKind.ICON_LIST]: {
    shape: 'A vertical list of rows. Each row is one icon and one text.',
    hint: 'none',
    anv: 'list element',
    childComponent: none,
  },
  [PartKind.COUNTER]: {
    shape: 'One text whose content is a number, with an optional prefix or suffix.',
    hint: 'none',
    anv: 'counter',
    childComponent: none,
  },
  [PartKind.COUNTDOWN]: {
    shape: 'A row of time units. Each unit is a number and a label.',
    hint: 'none',
    anv: 'countdown. The target date comes from the plan',
    childComponent: none,
  },
  [PartKind.TOOLTIP_STYLE]: {
    shape: 'One bubble drawn once: a fill, a radius, and one text. It is not the icon beside a label.',
    hint: 'none',
    anv: 'the tooltip bubble style, not a tooltip instance',
    childComponent: none,
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
export const isKind = (entry, kind) => entry?.component === kind;
export const isAnyKind = (entry, kinds) => kinds.some((kind) => isKind(entry, kind));
export const childId = (kind, param) => (SIGNAL_RULES[kind]?.childComponent ?? []).find((child) => child.param === param)?.id;
export const isChild = (entry, kind, param) => entry?.component === childId(kind, param);
export const isPaginationHint = (entry) => isChild(entry, PartKind.CAROUSEL, 'pagination');

export const WidgetKind = [
  PartKind.GALLERY,
  PartKind.PROGRESS,
  PartKind.RATING,
  PartKind.ALERT,
  PartKind.LOGO,
  PartKind.HAMBURGER,
  PartKind.DROPDOWN,
  PartKind.OFFCANVAS,
  PartKind.SCROLL,
];

export const ChoiceKind = [PartKind.CHECKBOX, PartKind.SWITCH, PartKind.RADIO];
export const TabKind = [PartKind.TABS, PartKind.TAB_SWITCH];
export const MenuKind = [PartKind.MENU, PartKind.MENU_SLIDER];
export const ListKind = [PartKind.ACCORDION, PartKind.TABS, PartKind.MENU, PartKind.MENU_SLIDER, PartKind.CAROUSEL, PartKind.FORM];
export const StateKind = [PartKind.ACCORDION, PartKind.MENU, PartKind.MENU_SLIDER, PartKind.TABS, PartKind.TAB_SWITCH];
export const childKindIds = () => [...new Set(Object.values(SIGNAL_RULES).flatMap((rule) => (rule.childComponent ?? []).map((child) => child.id)))];

// The only set of names the picture may use. A part id is not in this set.
export const lookKinds = () => new Set([...Object.keys(SIGNAL_RULES), 'block']);
