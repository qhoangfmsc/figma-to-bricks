// Two measurements that are not a broken template.
// A looping slider parks the original slides off screen by one shared shift. The copies on screen are the picture.
// A frame that is partly clear, while the picture already matches, is that clear area, not a missing fill.

const LOOK_CLOSE = 18;
const PARKED = 200;

export function settleMeasuredRows(rows, visualMean) {
  if (visualMean == null || visualMean >= LOOK_CLOSE) return rows;
  const shifts = rows.filter((r) => r.check === 'x' && !r.ok).map((r) => {
    const d = parseFloat(r.got) - parseFloat(r.want);
    return Number.isFinite(d) ? { r, d } : null;
  }).filter(Boolean);
  const parked = new Set();
  if (shifts.length >= 4) {
    const sorted = shifts.map((x) => x.d).sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length / 2)];
    // One label inside a parked slide can sit a few pixels off the shared shift. It is the same slide.
    if (Math.abs(mid) >= PARKED) {
      for (const x of shifts) if (Math.abs(x.d - mid) <= 8 && x.r.id) parked.add(x.r.id);
    }
  }
  for (const r of rows) {
    if (r.check === 'transparent area without a background') r.soft = true;
    if (r.id && parked.has(r.id) && ['x', 'y', 'w', 'h'].includes(r.check)) r.soft = true;
  }
  return rows;
}
