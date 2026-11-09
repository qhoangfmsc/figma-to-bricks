// After the desktop answers are copied onto every frame that has the same component, the Figma links
// in those answers (a full tab, the opened "Xem thêm" frame, the full slide set) are fetched into that frame.
// A frame that does not have the component is not passed here with those params, so nothing is added.
import { attachExpandFrames } from '../single-template/expand.mjs';
import { attachSlideFrames } from '../single-template/slides.mjs';
import { attachTabFrames } from '../single-template/tab-frames.mjs';

export async function attachFilledFrames(ws, opts = {}) {
  await attachExpandFrames(ws, opts);
  await attachSlideFrames(ws, opts);
  await attachTabFrames(ws, opts);
}
