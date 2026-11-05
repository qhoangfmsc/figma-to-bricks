// Turns one verify.json into the sentences the Vietnix Tools result card shows.
// The people reading that card are not developers: no FAIL, no "look", no node ids.

const FRAME = {
  desktop: 'Máy tính',
  base: 'Máy tính',
  tablet_portrait: 'Máy tính bảng',
  mobile_landscape: 'Điện thoại ngang',
  mobile_portrait: 'Điện thoại dọc',
  widescreen: 'Màn hình rộng',
};

const num = (v) => {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

export function reviewFrame(verify, key = 'desktop') {
  const name = FRAME[key] || key;
  if (!verify) return { name, tone: 'none', percent: null, notes: ['Chưa đo được.'] };
  const notes = reasonLines(verify.bad || [], verify.visualMean);
  if (!notes.length && verify.verdict !== 'FAIL') notes.push('Không thấy chỗ nào lệch so với bản vẽ.');
  return {
    name,
    tone: verify.verdict === 'FAIL' ? 'fail' : 'pass',
    percent: verify.visualMean == null ? null : Math.round((verify.visualMean / 255) * 1000) / 10,
    notes,
  };
}

function reasonLines(bad, visualMean) {
  const lines = [];
  // A close picture (under the 18/255 region limit) plus one shared shift of hundreds of pixels is the slider
  // loop parking its measured nodes off screen. The copies on screen are the picture. That shift is not a remark.
  const pictureClose = visualMean != null && visualMean < 18;
  lines.push(...shiftLines(bad.filter((r) => ['x', 'y', 'w', 'h'].includes(r.check)), pictureClose));
  const clear = bad.find((r) => r.check === 'transparent area without a background');
  if (clear) {
    const pct = String(clear.got).match(/(\d+)\s*%/);
    lines.push(pct
      ? `Khoảng ${pct[1]}% bản vẽ trong suốt. Trên trang chỗ đó hiện nền trang.`
      : 'Bản vẽ có vùng trong suốt. Trên trang chỗ đó hiện nền trang.');
  }
  const covered = bad.filter((r) => r.check === 'on top at its center').length;
  if (covered === 1) lines.push('Có một chữ bị phần khác đè lên.');
  else if (covered > 1) lines.push(`Có ${covered} chữ bị phần khác đè lên.`);
  if (bad.some((r) => String(r.label || '').startsWith('look '))) lines.push('Có vùng ảnh khác bản vẽ rõ.');
  if (bad.some((r) => r.check === 'horizontal scroll')) lines.push('Trang bị thanh cuộn ngang.');
  if (bad.some((r) => r.check === 'image weight' || r.check === 'hidden images downloaded')) lines.push('Ảnh tải về nặng hơn mức cho phép.');
  return lines;
}

function shiftLines(rows, pictureClose) {
  const byCheck = new Map();
  for (const row of rows) {
    const want = num(row.want);
    const got = num(row.got);
    if (want == null || got == null) continue;
    const list = byCheck.get(row.check) ?? [];
    list.push(Math.round(got - want));
    byCheck.set(row.check, list);
  }
  const out = [];
  const side = { x: ['sang trái', 'sang phải'], y: ['lên trên', 'xuống dưới'] };
  const size = { w: 'rộng', h: 'cao' };
  for (const [check, deltas] of byCheck) {
    if (!deltas.length) continue;
    const same = deltas.every((d) => Math.abs(d - deltas[0]) <= 1);
    const delta = deltas[0];
    if (same && pictureClose && Math.abs(delta) >= 200) continue;
    if (same && side[check] && delta !== 0) {
      const direction = delta > 0 ? side[check][1] : side[check][0];
      out.push(`Các phần chữ nằm lệch ${direction} khoảng ${Math.abs(delta)}px so với bản vẽ.`);
    } else if (same && size[check] && delta !== 0) {
      out.push(`Một số phần ${size[check]} ${delta > 0 ? 'hơn' : 'kém'} ${Math.abs(delta)}px so với bản vẽ.`);
    } else {
      out.push(check === 'w' || check === 'h' ? 'Một số phần lệch kích thước so với bản vẽ.' : 'Một số phần lệch vị trí so với bản vẽ.');
    }
  }
  return out;
}
