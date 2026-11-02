// How long one Vietnix Tools template tends to take, from the VPS Linux 2025 run
// (process/work/NcaLAzM0EyDXVnHwqAjOR0, measured 2026-11-02 on the 18 sections that have verify.json).
// Read: median of raw.json → tree.json is 5s (images and svg after the node JSON is saved).
// The node request itself is not in that span. process/figma/api.mjs aborts one request at 120s.
// Build: median of (raw.json → verify.json) minus (raw.json → tree.json) is 48s
// (export, build, push, Playwright) per frame. Widescreen is not fetched or merged.

export const PLAN_TYPICAL_MS = 5_000;
export const FIGMA_TIMEOUT_MS = 120_000;
export const BUILD_MEDIAN_MS = 48_000;

const READ_SLOTS = ['desktop', 'tablet', 'mobile'];

export function formatDuration(ms) {
  const s = Math.max(0, Math.round(Number(ms) / 1000));
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m} phút ${rem} giây` : `${m} phút`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h} giờ ${min} phút` : `${h} giờ`;
}

export function frameCount(input) {
  return READ_SLOTS.filter((id) => String(input?.[id] ?? '').trim()).length;
}

export function describeTiming(input) {
  const frames = frameCount(input);
  if (!frames) {
    return { frames: 0, plan: 'Điền Desktop để ước lượng thời gian đọc.', build: 'Từ xác nhận đến template: ước lượng sau khi có link.', planMs: 0, planMaxMs: 0, buildMs: 0 };
  }
  const planMs = frames * PLAN_TYPICAL_MS;
  const planMaxMs = frames * FIGMA_TIMEOUT_MS;
  const buildMs = frames * BUILD_MEDIAN_MS;
  const n = `${frames} khung`;
  return {
    frames,
    planMs,
    planMaxMs,
    buildMs,
    plan: `Đọc Figma: khoảng ${formatDuration(planMs)} – ${formatDuration(planMaxMs)} (${n}).`,
    build: `Từ xác nhận đến template: khoảng ${formatDuration(buildMs)} (${n}).`,
    note: 'Mức thấp là trung vị 5 giây/khung cho phần tải ảnh (18 section đã đọc). Trần là timeout 2 phút/request. Tạo template là trung vị 48 giây/khung trên 18 section đã verify. Figma chậm thì sát trần.',
  };
}
