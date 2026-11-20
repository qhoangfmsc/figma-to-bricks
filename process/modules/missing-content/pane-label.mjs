export function paneQuestionLabel(row) {
  const name = String(row.label ?? '').slice(0, 40);
  if (row.active && row.drawn) return `${name} đang mở, đang có: ${row.drawn}. Để nguyên cũng được, hoặc dán link khung khác.`;
  if (!row.drawn) return `${name} chưa vẽ nội dung. Dán link khung của tab này, hoặc viết nội dung vào.`;
  return `${name} đang có: ${row.drawn}`;
}
