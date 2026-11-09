// A picture with a play mark. Bricks 1.12.3 element `video` (includes/elements/video.php).
// The file does not contain the video address. The Plan supplies it. Until then the frame stays a picture.
import { youtubeId, vimeoId } from './video-url.mjs';

export default {
  id: 'video',
  status: 'implemented',
  label: 'Video',
  figma: 'a picture frame with one play circle near the centre (`rules/media.mjs`)',
  bricks: '`video`. A YouTube or Vimeo address uses that source. Any other http address uses File URL',
  limits: 'Without an address the detection stays a question and the frame stays the picture Figma drew. Autoplay is left off',
  mergesChildren: true,
  kind: () => 'video',

  check(node, det) {
    if (!det.params?.url) return { ok: false, reason: 'the video address is not in the Figma file' };
    return { ok: true, warnings: [] };
  },

  apply(ctx, det) {
    const { s } = ctx;
    const url = String(det.params.url);
    const youtube = youtubeId(url);
    const vimeo = vimeoId(url);
    if (youtube) {
      s.videoType = 'youtube';
      s.youTubeId = youtube;
    } else if (vimeo) {
      s.videoType = 'vimeo';
      s.vimeoId = vimeo;
    } else {
      s.videoType = 'file';
      s.fileUrl = url;
    }
  },
};
