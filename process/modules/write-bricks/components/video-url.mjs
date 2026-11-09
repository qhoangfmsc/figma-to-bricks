export function youtubeId(url) {
  const text = String(url ?? '').trim();
  const short = text.match(/youtu\.be\/([\w-]{6,})/i);
  if (short) return short[1];
  const watch = text.match(/[?&]v=([\w-]{6,})/i);
  if (watch) return watch[1];
  const embed = text.match(/youtube\.com\/embed\/([\w-]{6,})/i);
  if (embed) return embed[1];
  if (/^[\w-]{11}$/.test(text)) return text;
  return '';
}

export function vimeoId(url) {
  const hit = String(url ?? '').match(/vimeo\.com\/(?:video\/)?(\d{6,})/i);
  return hit ? hit[1] : '';
}
