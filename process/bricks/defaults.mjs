// Project defaults DECIDED BY THE OWNER, for things Figma does not give us. They are not Figma values and are reported as such.
// Change a number here and every build follows. (Responsive is out of scope for now: one desktop design at a time.)
export const DEFAULTS = {
  // hover: none. The owner dropped the old opacity 0.8 default (2026-10-26). Figma draws the hover as another variant of the component and
  // reading its values is not built yet, so a drawn hover is only reported (warning), nothing is invented. Set { opacity, duration, easing } to bring a default back.
  hover: null,
};
