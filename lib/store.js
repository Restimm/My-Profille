import { defaultData, CATEGORIES } from './defaultData';

const DATA = 'folio:data', LIKES = 'folio:likes', LIKED = 'folio:liked';
let remote = false;

function normalize(d) {
  const b = defaultData;
  d = d || {};
  return {
    ...b, ...d,
    profile: { ...b.profile, ...d.profile, socials: { ...b.profile.socials, ...(d.profile && d.profile.socials) } },
    categories: d.categories && d.categories.length ? d.categories : CATEGORIES,
    works: d.works || b.works
  };
}

export const isRemote = () => remote;

const read = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };

export async function loadAll() {
  try {
    const j = await (await fetch('/api/data', { cache: 'no-store' })).json();
    if (j.configured) { remote = true; return { data: normalize(j.data), likes: j.likes || {} }; }
  } catch {}
  remote = false;
  return { data: normalize(read(DATA, null)), likes: read(LIKES, {}) };
}

export async function checkPassword(p) {
  try { return (await fetch('/api/auth', { method: 'POST', headers: { 'x-admin-password': p } })).ok; } catch { return false; }
}

export async function saveData(data, pass) {
  if (remote) {
    const r = await fetch('/api/save', { method: 'POST', headers: { 'x-admin-password': pass, 'content-type': 'application/json' }, body: JSON.stringify(data) });
    if (!r.ok) throw new Error('Gagal menyimpan ke server.');
    return;
  }
  try { localStorage.setItem(DATA, JSON.stringify(data)); }
  catch { throw new Error('Penyimpanan browser penuh. Kurangi jumlah foto atau pakai Supabase.'); }
}

function compress(file, max = 1600, q = 0.82) {
  if (file.type === 'image/gif') return Promise.resolve(file);
  return new Promise((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      c.toBlob((b) => (b ? res(b) : rej(new Error('Gambar gagal diproses.'))), 'image/jpeg', q);
    };
    img.onerror = () => rej(new Error('File bukan gambar yang valid.'));
    img.src = u;
  });
}

const toDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });

export async function uploadImage(file, pass) {
  const blob = await compress(file);
  if (!remote) return toDataURL(blob);
  const fd = new FormData();
  fd.append('file', blob, 'img');
  const r = await fetch('/api/upload', { method: 'POST', headers: { 'x-admin-password': pass }, body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Upload gagal.');
  return j.url;
}

export const hasLiked = (id) => read(LIKED, []).includes(id);

export async function sendLike(id, current = 0) {
  let n = current + 1;
  if (remote) {
    try {
      const j = await (await fetch('/api/like', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) })).json();
      if (j.count) n = j.count;
    } catch {}
  } else {
    localStorage.setItem(LIKES, JSON.stringify({ ...read(LIKES, {}), [id]: n }));
  }
  try { localStorage.setItem(LIKED, JSON.stringify([...read(LIKED, []), id])); } catch {}
  return n;
}

export async function sendMessage(f) {
  try {
    const r = await fetch('/api/message', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
    const j = await r.json();
    if (j.configured === false) return { fallback: true };
    return r.ok ? { ok: true } : { error: j.error };
  } catch { return { error: 'Koneksi bermasalah. Coba lagi.' }; }
}

export async function listMessages(pass) {
  try {
    const j = await (await fetch('/api/messages', { headers: { 'x-admin-password': pass }, cache: 'no-store' })).json();
    return j.messages || [];
  } catch { return []; }
}

export async function deleteMessage(id, pass) {
  await fetch('/api/delmsg', { method: 'POST', headers: { 'x-admin-password': pass, 'content-type': 'application/json' }, body: JSON.stringify({ id }) });
}

// Upload video langsung dari browser ke Supabase lewat tautan upload bertanda tangan
// (melewati batas ukuran permintaan Vercel). Butuh Supabase aktif.
const MAX_VIDEO = 50 * 1024 * 1024;
export async function uploadVideo(file, pass) {
  if (!remote) throw new Error('Upload video butuh Supabase. Pakai link YouTube atau Vimeo, atau sambungkan Supabase.');
  if (!/^video\/(mp4|webm)$/.test(file.type)) throw new Error('Format video harus MP4 atau WebM.');
  if (file.size > MAX_VIDEO) throw new Error('Ukuran video maksimal 50 MB. Kecilkan dulu videonya.');
  const ext = file.type === 'video/webm' ? 'webm' : 'mp4';
  const r = await fetch('/api/signed-upload', {
    method: 'POST',
    headers: { 'x-admin-password': pass, 'content-type': 'application/json' },
    body: JSON.stringify({ ext })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Gagal menyiapkan upload video.');
  const fd = new FormData();
  fd.append('cacheControl', '3600');
  fd.append('', file);
  const headers = { 'x-upsert': 'false' };
  if (j.anonKey) headers.apikey = j.anonKey;
  const up = await fetch(j.signedUrl, { method: 'PUT', headers, body: fd });
  if (!up.ok) throw new Error('Upload video gagal. Cek batas ukuran file di pengaturan Storage Supabase.');
  return j.publicUrl;
}
