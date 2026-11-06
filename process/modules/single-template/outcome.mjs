// A push that landed means WordPress has the template, so the check can run.
// The link in the chat result is a separate decision: readyForUser.
// The run stops only when this run pushed nothing: the site is down, or Figma rejected the call.

const PUSHED = /(?:updated|created) template \d+/;

export function outcomeOf({ status = 0, stdout = '', stderr = '', templateId } = {}) {
  const pushed = PUSHED.test(stdout) && templateId != null && templateId !== '';
  if (pushed) return { ok: true, verified: /summary\.md →/.test(stdout), status };
  const text = `${stderr}\n${stdout}`.trim();
  return { ok: false, error: new Error(text.slice(-800) || 'Chưa tạo được template.') };
}

// Step 3 may show the link only after every pasted frame was measured and none has a heavy miss.
// PASS WITH MINOR stays a finished template. A missing measurement is not finished.
export function readyForUser(frames) {
  return Array.isArray(frames) && frames.length > 0 && frames.every((f) => f?.verify?.verdict && f.verify.verdict !== 'FAIL');
}
