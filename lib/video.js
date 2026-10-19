// Mengenali link video (YouTube, Vimeo, atau file MP4/WebM) dan membuat sampul dari file video.
export function parseVideo(url) {
  const u = String(url || '').trim();
  if (!u) return null;
  let m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/i);
  if (m) {
    return {
      kind: 'embed', label: 'YouTube',
      src: `https://www.youtube-nocookie.com/embed/${m[1]}`,
      thumb: `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`
    };
  }
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (m) return { kind: 'embed', label: 'Vimeo', src: `https://player.vimeo.com/video/${m[1]}` };
  if (/\.(mp4|webm)(\?.*)?$/i.test(u) || /\/storage\/v1\/object\/public\//.test(u)) {
    return { kind: 'file', label: 'File video', src: u };
  }
  return null;
}

// Ambil satu gambar dari file video untuk dijadikan sampul.
export function makePoster(file) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (fn, arg) => { URL.revokeObjectURL(url); fn(arg); };
    v.muted = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.src = url;
    v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
    v.onseeked = () => {
      try {
        const s = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(v.videoWidth * s);
        c.height = Math.round(v.videoHeight * s);
        c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
        c.toBlob(
          (b) => (b ? done(resolve, new File([b], 'poster.jpg', { type: 'image/jpeg' })) : done(reject, new Error('poster'))),
          'image/jpeg', 0.82
        );
      } catch (e) { done(reject, e); }
    };
    v.onerror = () => done(reject, new Error('poster'));
  });
}
