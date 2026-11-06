// https://www.figma.com/design/:fileKey/:name?node-id=1-2  ->  { fileKey, nodeId: '1:2' }
export function parseFigmaUrl(input) {
  const u = new URL(input);
  const parts = u.pathname.split('/').filter(Boolean);
  const kind = parts[0];
  if (!['design', 'file', 'proto'].includes(kind)) {
    throw new Error(`Unsupported Figma URL type "/${kind}/" (need a /design/ URL)`);
  }
  // .../design/:fileKey/branch/:branchKey/:name -> the branch key is the file key
  const fileKey = parts[2] === 'branch' ? parts[3] : parts[1];
  const raw = u.searchParams.get('node-id');
  if (!raw) throw new Error('URL has no node-id. In Figma: right click the frame > Copy link to selection');
  return { fileKey, nodeId: raw.replace('-', ':') };
}
