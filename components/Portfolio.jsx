'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, MotionConfig, useScroll, useMotionValueEvent } from 'framer-motion';
import Backdrop from './Backdrop';
import {
  loadAll, saveData, uploadImage, sendLike, checkPassword, hasLiked,
  isRemote, sendMessage, listMessages, deleteMessage, uploadVideo
} from '../lib/store';
import { parseVideo, makePoster } from '../lib/video';

const SOCIALS = [
  ['instagram', 'Instagram'], ['behance', 'Behance'], ['linkedin', 'LinkedIn'],
  ['discord', 'Discord'], ['fiverr', 'Fiverr']
];

const ease = [0.22, 1, 0.36, 1];
// arah scroll: 1 = turun, -1 = naik. Elemen masuk dari arah yang sama dengan scroll.
const DirCtx = createContext(1);
const rv = {
  hidden: (d) => ({ opacity: 0, y: 40 * d }),
  show: { opacity: 1, y: 0 }
};

const Reveal = ({ children, className = '', delay = 0 }) => {
  const d = useContext(DirCtx);
  return (
    <motion.div
      className={className}
      variants={rv} custom={d} initial="hidden" whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.6, ease, delay }}
    >
      {children}
    </motion.div>
  );
};

function Editable({ value, admin, onSave, as: Tag = 'span', multi = false, className = '' }) {
  return (
    <Tag
      className={className + (admin ? ' editable' : '')}
      contentEditable={admin}
      suppressContentEditableWarning
      spellCheck={false}
      onKeyDown={(e) => {
        if (admin && !multi && e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
      }}
      onBlur={(e) => {
        if (!admin) return;
        const v = e.currentTarget.innerText.trim();
        if (v && v !== value) onSave(v);
        else e.currentTarget.innerText = value;
      }}
    >
      {value}
    </Tag>
  );
}

function Modal({ onClose, children, width = 520 }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto bg-bg/80"
      onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, 94vw)` }}
        className="surface surface-strong mx-auto my-4 rounded-3xl p-4 sm:p-6 md:my-8 md:p-9"
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.35, ease }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

const isEmail = (v) => /^\S+@\S+\.\S+$/.test(v);
const fixUrl = (u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);
const emptyExp = () => ({ role: '', company: '', period: '', description: '' });
const emptyWork = (cats) => ({ title: '', category: cats[0], description: '', cover: '', images: [], videos: [] });

export default function Portfolio() {
  const [data, setData] = useState(null);
  const [likes, setLikes] = useState({});
  const [admin, setAdmin] = useState(false);
  const [pass, setPass] = useState('');
  const [login, setLogin] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [filter, setFilter] = useState('Semua');
  const [viewId, setViewId] = useState(null);
  const [form, setForm] = useState(null);
  const [expForm, setExpForm] = useState(null);
  const [vidLink, setVidLink] = useState('');
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ name: '', contact: '', message: '', website: '' });
  const [sending, setSending] = useState(false);
  const [dir, setDir] = useState(1);
  const mqTimer = useRef(null);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (v) => {
    const prev = scrollY.getPrevious();
    if (prev === undefined || Math.abs(v - prev) < 2) return;
    const d = v > prev ? 1 : -1;
    setDir((o) => (o === d ? o : d));
  });

  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 3200); };

  const logout = () => {
    setAdmin(false); setPass(''); sessionStorage.removeItem('folio:pass'); setForm(null);
    setCatOpen(false); setInboxOpen(false);
  };

  useEffect(() => {
    loadAll().then(({ data, likes }) => { setData(data); setLikes(likes); });
    const saved = sessionStorage.getItem('folio:pass');
    if (saved) checkPassword(saved).then((ok) => { if (ok) { setPass(saved); setAdmin(true); } });
  }, []);

  useEffect(() => {
    if (admin && isRemote()) listMessages(pass).then(setInbox);
  }, [admin, pass]);

  // Pintasan rahasia: Ctrl + Shift + A
  useEffect(() => {
    const k = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        admin ? logout() : setLogin(true);
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [admin]);

  const submitLogin = async (e) => {
    e.preventDefault();
    if (await checkPassword(pw)) {
      setPass(pw); setAdmin(true); sessionStorage.setItem('folio:pass', pw);
      setLogin(false); setPw(''); setPwErr('');
      say('Mode Admin aktif');
    } else setPwErr('Password salah. Coba lagi.');
  };

  const commit = async (next) => {
    setData(next);
    try { await saveData(next, pass); } catch (e) { say(e.message); }
  };

  const setProfile = (k, v) => commit({ ...data, profile: { ...data.profile, [k]: v } });

  // Teks berjalan: teks dan kecepatan bisa diedit admin
  const saveMarquee = (patch) => commit({ ...data, marquee: { ...data.marquee, ...patch } });
  const slideSpeed = (v) => {
    const next = { ...data, marquee: { ...data.marquee, speed: v } };
    setData(next); // langsung terlihat saat digeser
    clearTimeout(mqTimer.current);
    mqTimer.current = setTimeout(() => commit(next), 500); // simpan setelah berhenti menggeser
  };

  const editSocial = (key, label) => {
    const cur = data.profile.socials[key] || '';
    const v = window.prompt(`Tempel link ${label} (contoh: https://...). Kosongkan untuk menyembunyikan.`, cur);
    if (v === null) return;
    setProfile('socials', { ...data.profile.socials, [key]: v.trim() });
  };

  const upload = async (files, onUrl) => {
    setBusy(true);
    try { for (const f of files) onUrl(await uploadImage(f, pass)); }
    catch (e) { say(e.message || 'Upload gagal.'); }
    setBusy(false);
  };

  const saveWork = () => {
    if (!form.title.trim()) return say('Judul karya wajib diisi.');
    let cover = form.cover;
    if (!cover) {
      // link YouTube otomatis memberi gambar sampul
      const yt = (form.videos || []).map(parseVideo).find((v) => v && v.thumb);
      if (yt) cover = yt.thumb;
    }
    if (!cover) return say('Foto sampul wajib diunggah.');
    const item = { ...form, cover, videos: form.videos || [] };
    const works = form.id
      ? data.works.map((w) => (w.id === form.id ? item : w))
      : [{ ...item, id: String(Date.now()) }, ...data.works];
    commit({ ...data, works });
    setForm(null);
    say('Karya disimpan');
  };

  const addVideoLink = () => {
    const v = vidLink.trim();
    if (!v) return;
    if (!parseVideo(v)) return say('Link tidak dikenali. Pakai link YouTube atau Vimeo.');
    setForm((f) => ({ ...f, videos: [...(f.videos || []), v] }));
    setVidLink('');
  };

  const addVideoFile = async (file) => {
    setBusy(true);
    try {
      const url = await uploadVideo(file, pass);
      let poster = '';
      if (!form.cover) {
        // sampul otomatis dari satu gambar di dalam video
        try { poster = await uploadImage(await makePoster(file), pass); } catch {}
      }
      setForm((f) => ({ ...f, videos: [...(f.videos || []), url], cover: f.cover || poster }));
      say(poster ? 'Video diunggah, sampul dibuat otomatis' : 'Video diunggah');
    } catch (e) {
      say(e.message || 'Upload video gagal.');
    }
    setBusy(false);
  };

  const removeWork = (id) => {
    if (!confirm('Hapus karya ini? Tindakan ini tidak bisa dibatalkan.')) return;
    commit({ ...data, works: data.works.filter((w) => w.id !== id) });
    say('Karya dihapus');
  };

  // Pengalaman
  const saveExp = () => {
    if (!expForm.role.trim()) return say('Posisi atau peran wajib diisi.');
    const list = data.experience || [];
    const next = expForm.id
      ? list.map((e) => (e.id === expForm.id ? expForm : e))
      : [{ ...expForm, id: 'e' + Date.now() }, ...list];
    commit({ ...data, experience: next });
    setExpForm(null);
    say('Pengalaman disimpan');
  };
  const removeExp = (id) => {
    if (!confirm('Hapus pengalaman ini?')) return;
    commit({ ...data, experience: (data.experience || []).filter((e) => e.id !== id) });
    say('Pengalaman dihapus');
  };

  // Kategori
  const addCat = () => {
    const n = newCat.trim();
    if (!n) return;
    if (data.categories.some((c) => c.toLowerCase() === n.toLowerCase())) return say('Kategori itu sudah ada.');
    commit({ ...data, categories: [...data.categories, n] });
    setNewCat('');
  };
  const renameCat = (old, raw) => {
    const n = raw.trim();
    if (!n || n === old) return false;
    if (data.categories.some((c) => c !== old && c.toLowerCase() === n.toLowerCase())) { say('Nama kategori sudah dipakai.'); return false; }
    commit({
      ...data,
      categories: data.categories.map((c) => (c === old ? n : c)),
      works: data.works.map((w) => (w.category === old ? { ...w, category: n } : w))
    });
    if (filter === old) setFilter(n);
    return true;
  };
  const delCat = (c) => {
    const used = data.works.filter((w) => w.category === c).length;
    if (used) return say(`Kategori masih dipakai ${used} karya. Pindahkan atau hapus karyanya dulu.`);
    if (data.categories.length <= 1) return say('Minimal harus ada satu kategori.');
    commit({ ...data, categories: data.categories.filter((x) => x !== c) });
    if (filter === c) setFilter('Semua');
  };

  const doLike = async (id) => {
    if (hasLiked(id)) return;
    setLikes((l) => ({ ...l, [id]: (l[id] || 0) + 1 }));
    const n = await sendLike(id, likes[id] || 0);
    setLikes((l) => ({ ...l, [id]: n }));
  };

  const submitMsg = async (e) => {
    e.preventDefault();
    setSending(true);
    const r = await sendMessage(msg);
    setSending(false);
    if (r.ok) { setMsg({ name: '', contact: '', message: '', website: '' }); say('Pesan terkirim. Terima kasih!'); }
    else if (r.fallback) {
      const body = `${msg.message}\n\n${msg.name}${msg.contact ? ` (${msg.contact})` : ''}`;
      window.location.href = `mailto:${data.profile.email}?subject=${encodeURIComponent('Pesan dari website portofolio')}&body=${encodeURIComponent(body)}`;
    } else say(r.error || 'Pesan gagal dikirim.');
  };

  const openInbox = async () => {
    setInboxOpen(true);
    if (isRemote()) setInbox(await listMessages(pass));
  };
  const removeMsg = async (id) => {
    await deleteMessage(id, pass);
    setInbox((l) => l.filter((m) => m.id !== id));
  };

  if (!data) return <div className="min-h-screen bg-bg" />;

  const p = data.profile;
  const cats = data.categories;
  const mq = data.marquee || { items: [], speed: 7 };
  const items = mq.items || [];
  const speed = mq.speed || 7;
  const dur = 80 - speed * 7; // detik per putaran: speed 1 = 73 dtk (pelan), 10 = 10 dtk (cepat)
  const reps = Math.max(2, Math.ceil(8 / Math.max(items.length, 1)));
  const exps = data.experience || [];
  const showExp = admin || exps.length > 0;
  const works = filter === 'Semua' ? data.works : data.works.filter((w) => w.category === filter);
  const cur = data.works.find((w) => w.id === viewId);
  const shownSocials = SOCIALS.filter(([k]) => admin || p.socials[k]);

  return (
    <MotionConfig reducedMotion="user">
      <DirCtx.Provider value={dir}>
      {/* latar bercahaya + efek cahaya arah scroll */}
      <Backdrop />

      {admin && (
        <div className="fixed inset-x-0 top-0 z-40 border-b border-neon/40 bg-bg/95 px-4 py-3">
          <p className="mb-2 text-xs text-neon sm:text-sm">Mode Admin: klik teks bergaris putus-putus untuk mengedit</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => setForm(emptyWork(cats))}>+ Tambah Karya</button>
            <button className="btn-ghost" onClick={() => setCatOpen(true)}>Kategori</button>
            <button className="btn-ghost" onClick={openInbox}>Pesan Masuk{inbox.length ? ` (${inbox.length})` : ''}</button>
            <button className="btn-ghost sm:ml-auto" onClick={logout}>Keluar</button>
          </div>
        </div>
      )}

      {/* HERO */}
      <header id="beranda" className={`relative mx-auto max-w-6xl scroll-mt-6 px-4 pb-16 sm:px-6 md:pb-28 ${admin ? 'pt-44 sm:pt-36' : 'pt-16 md:pt-28'}`}>
        <div className="surface rounded-[2rem] p-6 sm:p-10 md:p-14">
          <div className="grid items-center gap-12 md:grid-cols-[1.3fr_1fr] md:gap-16">
            <div className="order-2 min-w-0 text-center md:order-1 md:text-left">
              <Reveal>
                <span className="surface inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-fg/80">
                  <span className="h-2 w-2 rounded-full bg-emerald-400/90" />
                  <Editable value={p.status} admin={admin} onSave={(v) => setProfile('status', v)} />
                </span>
              </Reveal>
              <Reveal delay={0.06}>
                <Editable as="h1" value={p.name} admin={admin} onSave={(v) => setProfile('name', v)} className="mt-6 block break-words font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl" />
                <p className="mt-2 text-lg text-fg/55 md:text-xl">
                  (<Editable value={p.nickname} admin={admin} onSave={(v) => setProfile('nickname', v)} />)
                </p>
                <div aria-hidden className="mx-auto mt-5 h-px w-14 bg-neon/70 md:mx-0" />
              </Reveal>
              <Reveal delay={0.12}>
                <Editable as="p" value={p.headline} admin={admin} onSave={(v) => setProfile('headline', v)} className="mt-5 block text-lg text-fg/85 md:text-xl" />
              </Reveal>
              <Reveal delay={0.18}>
                <Editable as="p" multi value={p.bio} admin={admin} onSave={(v) => setProfile('bio', v)} className="mx-auto mt-4 block max-w-xl leading-relaxed text-fg/65 md:mx-0" />
              </Reveal>
              <Reveal delay={0.24}>
                <div className="mt-7 flex flex-wrap justify-center gap-3 md:justify-start">
                  <a href="#karya" className="btn">Lihat karya</a>
                  <a href="#kontak" className="btn-ghost">Kirim pesan</a>
                </div>
              </Reveal>
            </div>

            <Reveal className="order-1 md:order-2">
              <div className="relative mx-auto w-full max-w-[14rem] md:max-w-[19rem]">
                <div className="surface relative aspect-square rounded-full p-1.5">
                  <img src={p.avatar} alt={p.name} className="h-full w-full rounded-full object-cover" />
                </div>
                {admin && (
                  <label className="btn absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    {busy ? 'Mengunggah...' : 'Upload Gambar'}
                    <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && upload([e.target.files[0]], (u) => setProfile('avatar', u))} />
                  </label>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </header>

      {/* PITA TEKS BERJALAN (teks dan kecepatan bisa diedit di Mode Admin) */}
      {items.length > 0 && (
        <div aria-hidden className={`overflow-hidden border-y border-fg/10 py-5 ${admin ? 'mb-6' : 'mb-16 md:mb-24'}`}>
          <div className="marquee" style={{ animationDuration: `${dur}s` }}>
            {[0, 1].map((half) => (
              <div key={half} className="flex shrink-0 items-center">
                {Array(reps).fill(items).flat().map((c, i) => (
                  <span key={i} className="flex items-center whitespace-nowrap">
                    <span className="outline-text px-6 font-display text-3xl font-bold md:px-10 md:text-6xl">{c}</span>
                    <span className="text-2xl text-neon md:text-4xl">✦</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {admin && (
        <div className="mx-auto mb-16 max-w-6xl px-4 sm:px-6 md:mb-24">
          <div className="surface rounded-2xl p-5">
            <p className="font-semibold">Teks berjalan</p>
            <p className="mt-1 text-sm text-fg/60">Pisahkan tiap teks dengan koma, lalu klik di luar kolom untuk menyimpan. Kosongkan untuk menyembunyikan pita.</p>
            <input
              key={items.join('|')} className="field mt-3" defaultValue={items.join(', ')}
              onBlur={(e) => saveMarquee({ items: e.target.value.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 20) })}
            />
            <label className="mt-4 block text-sm text-fg/70">
              Kecepatan: {speed} (1 pelan, 10 cepat)
              <input type="range" min="1" max="10" step="1" value={speed} onChange={(e) => slideSpeed(Number(e.target.value))} className="mt-2 w-full accent-plum" />
            </label>
          </div>
        </div>
      )}

      {/* GALERI */}
      <main id="karya" className="mx-auto max-w-6xl scroll-mt-6 px-4 pb-20 sm:px-6 md:pb-24">
        <Reveal>
          <h2 className="font-display text-2xl font-bold md:text-4xl">Karya</h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {['Semua', ...cats].map((c) => (
              <button key={c} onClick={() => setFilter(c)} aria-pressed={filter === c} className={filter === c ? 'btn' : 'btn-ghost'}>
                {c}
              </button>
            ))}
          </div>
        </Reveal>

        <motion.div layout className="mt-10 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {works.map((w) => (
              <motion.article
                layout key={w.id}
                variants={rv} custom={dir} initial="hidden" whileInView="show"
                viewport={{ once: true, amount: 0.15 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.5, ease }}
                className="relative min-w-0"
              >
                <button onClick={() => setViewId(w.id)} className="surface surface-hover group block w-full overflow-hidden rounded-2xl text-left">
                  <div className="relative aspect-video w-full overflow-hidden">
                    <img src={w.cover} alt={w.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    {(w.videos || []).length > 0 && <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">▶ Video</span>}
                  </div>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{w.title}</h3>
                      <p className="text-sm text-fg/55">{w.category}</p>
                    </div>
                    <span className="shrink-0 text-sm text-hot">♥ {likes[w.id] || 0}</span>
                  </div>
                </button>
                {admin && (
                  <div className="absolute right-3 top-3 z-10 flex gap-2">
                    <button className="btn-ghost" onClick={() => setForm({ videos: [], ...w })}>Edit</button>
                    <button className="btn-danger" onClick={() => removeWork(w.id)}>Hapus</button>
                  </div>
                )}
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>

        {works.length === 0 && (
          <p className="mt-10 text-fg/55">
            {admin ? 'Belum ada karya di kategori ini. Klik + Tambah Karya.' : 'Belum ada karya di kategori ini.'}
          </p>
        )}
      </main>

      {/* PENGALAMAN */}
      {showExp && (
        <section id="pengalaman" className="mx-auto max-w-6xl scroll-mt-6 px-4 pb-20 sm:px-6 md:pb-24">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-bold md:text-4xl">Pengalaman</h2>
              {admin && <button className="btn" onClick={() => setExpForm(emptyExp())}>+ Tambah Pengalaman</button>}
            </div>
          </Reveal>
          <Reveal className="surface mt-8 rounded-3xl p-6 sm:p-8 md:p-10">
            {exps.length === 0 ? (
              <p className="text-fg/55">Belum ada pengalaman. Klik + Tambah Pengalaman.</p>
            ) : (
              <ol className="relative ml-1.5 border-l border-fg/15">
                {exps.map((e) => (
                  <li key={e.id} className="relative pb-10 pl-7 last:pb-0 md:pl-9">
                    <span aria-hidden className="absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full bg-neon" />
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        {e.period && <p className="text-sm text-neon">{e.period}</p>}
                        <h3 className="mt-1 break-words text-lg font-semibold md:text-xl">{e.role}</h3>
                        {e.company && <p className="text-fg/60">{e.company}</p>}
                      </div>
                      {admin && (
                        <div className="flex gap-2">
                          <button className="btn-ghost" onClick={() => setExpForm({ ...e })}>Edit</button>
                          <button className="btn-danger" onClick={() => removeExp(e.id)}>Hapus</button>
                        </div>
                      )}
                    </div>
                    {e.description && <p className="mt-3 max-w-2xl whitespace-pre-line leading-relaxed text-fg/70">{e.description}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Reveal>
        </section>
      )}

      {/* KONTAK + MEDIA SOSIAL */}
      <section id="kontak" className="mx-auto max-w-6xl scroll-mt-6 px-5 pb-20 sm:px-6 md:pb-28">
        <div className="grid gap-6 md:grid-cols-2 md:gap-10">
          <Reveal className="surface min-w-0 rounded-3xl p-6 md:p-9">
            <h2 className="font-display text-2xl font-bold md:text-4xl">Kirim pesan</h2>
            <p className="mt-3 max-w-md text-fg/65">Punya proyek atau pertanyaan? Tulis di sini. Kontak balasan boleh dikosongkan.</p>
            <form onSubmit={submitMsg} className="mt-6 space-y-4">
              <input className="field" placeholder="Nama atau panggilan" value={msg.name} maxLength={80} required onChange={(e) => setMsg({ ...msg, name: e.target.value })} />
              <input className="field" placeholder="Kontak balasan (opsional: WA, IG, atau email)" value={msg.contact} maxLength={120} onChange={(e) => setMsg({ ...msg, contact: e.target.value })} />
              <textarea className="field" rows={5} placeholder="Pesan" value={msg.message} maxLength={2000} required onChange={(e) => setMsg({ ...msg, message: e.target.value })} />
              {/* kolom jebakan bot, disembunyikan dari manusia */}
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={msg.website} onChange={(e) => setMsg({ ...msg, website: e.target.value })} className="absolute left-[-9999px] h-0 w-0 opacity-0" />
              <button className="btn" disabled={sending}>{sending ? 'Mengirim...' : 'Kirim pesan'}</button>
            </form>
          </Reveal>
          <Reveal delay={0.1} className="surface min-w-0 rounded-3xl p-6 md:p-9">
            <h2 className="font-display text-2xl font-bold md:text-4xl">Temukan saya</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {shownSocials.map(([k, label]) =>
                admin ? (
                  <button key={k} className="btn-ghost" onClick={() => editSocial(k, label)}>
                    {label}{p.socials[k] ? '' : ' (kosong)'} ✎
                  </button>
                ) : (
                  <a key={k} href={fixUrl(p.socials[k])} target="_blank" rel="noopener noreferrer" className="btn-ghost">{label}</a>
                )
              )}
            </div>
            {admin && (
              <p className="mt-8 text-sm text-fg/55">
                Email cadangan (hanya terlihat admin):{' '}
                <Editable value={p.email} admin onSave={(v) => setProfile('email', v)} />
              </p>
            )}
          </Reveal>
        </div>
      </section>

      {/* FOOTER + akses admin tersembunyi di titik terakhir */}
      <footer className="border-t border-fg/10 px-6 pb-28 pt-8 text-center text-sm text-fg/50">
        © 2026 {p.name}
        <button
          type="button" tabIndex={-1} aria-hidden="true" onClick={() => setLogin(true)}
          className="relative cursor-default after:absolute after:-inset-3 after:content-['']"
        >
          .
        </button>
      </footer>

      {/* NAVIGASI MENGAMBANG (kaca) */}
     <nav
  aria-label="Navigasi"
  style={{
    borderWidth: '1px',
    borderStyle: 'solid',
    borderImage: 'linear-gradient(to right, transparent, rgba(168, 85, 247, 0.6), transparent) 1'
  }}
  className="surface nav-blur fixed bottom-4 left-1/2 z-[36] flex max-w-[94vw] -translate-x-1/2 items-center gap-0.5 rounded-full p-1.5 text-[13px] sm:gap-1 sm:text-sm"
>
  {[['#beranda', 'Beranda'], ['#karya', 'Karya'], ...(showExp ? [['#pengalaman', 'Pengalaman']] : []), ['#kontak', 'Kontak']].map(([href, label]) => (
    <a key={href} href={href} className="rounded-full px-3 py-2 text-fg/75 transition-colors hover:bg-fg/10 hover:text-fg sm:px-4">{label}</a>
  ))}
</nav>

      {/* DETAIL KARYA (gaya Behance) */}
      <AnimatePresence>
        {cur && (
          <Modal onClose={() => setViewId(null)} width={960}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="break-words font-display text-xl font-bold md:text-3xl">{cur.title}</h2>
                <p className="mt-1 text-neon">{cur.category}</p>
              </div>
              <button className="btn-ghost shrink-0" onClick={() => setViewId(null)}>Tutup</button>
            </div>
            {cur.description && <p className="mt-5 max-w-2xl whitespace-pre-line leading-relaxed text-fg/75">{cur.description}</p>}
            <button onClick={() => doLike(cur.id)} className={`mt-5 ${hasLiked(cur.id) ? 'btn' : 'btn-ghost'}`}>
              ♥ {likes[cur.id] || 0} {hasLiked(cur.id) ? 'Disukai' : 'Suka'}
            </button>
            <div className="mt-8 space-y-4">
              {(cur.videos || []).map((v, i) => {
                const pv = parseVideo(v);
                if (!pv) return null;
                return pv.kind === 'embed' ? (
                  <div key={`v${i}`} className="relative aspect-video w-full overflow-hidden rounded-2xl border border-fg/10 bg-black">
                    <iframe
                      src={pv.src} title={`${cur.title} video ${i + 1}`} loading="lazy" allowFullScreen
                      allow="accelerometer; encrypted-media; picture-in-picture; fullscreen"
                      className="absolute inset-0 h-full w-full"
                    />
                  </div>
                ) : (
                  <video key={`v${i}`} src={pv.src} controls playsInline preload="metadata" className="block h-auto w-full rounded-2xl border border-fg/10 bg-black" />
                );
              })}
              {[...((cur.videos || []).length ? [] : [cur.cover]), ...cur.images].map((src, i) => (
                <img key={i} src={src} alt={`${cur.title} ${i + 1}`} loading="lazy" className="block h-auto w-full rounded-2xl border border-fg/10" />
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* LOGIN ADMIN */}
      <AnimatePresence>
        {login && (
          <Modal onClose={() => { setLogin(false); setPwErr(''); }} width={380}>
            <form onSubmit={submitLogin}>
              <h2 className="font-display text-xl font-bold">Masuk Admin</h2>
              <input autoFocus type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" className="field mt-5" />
              {pwErr && <p className="mt-2 text-sm text-danger">{pwErr}</p>}
              <div className="mt-5 flex gap-2">
                <button type="submit" className="btn">Masuk</button>
                <button type="button" className="btn-ghost" onClick={() => { setLogin(false); setPwErr(''); }}>Batal</button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* KELOLA KATEGORI */}
      <AnimatePresence>
        {catOpen && (
          <Modal onClose={() => setCatOpen(false)} width={460}>
            <h2 className="font-display text-xl font-bold">Kelola Kategori</h2>
            <p className="mt-2 text-sm text-fg/60">Ubah nama langsung di kolom, lalu klik di luar kolom untuk menyimpan.</p>
            <ul className="mt-5 space-y-2">
              {cats.map((c) => (
                <li key={c} className="flex gap-2">
                  <input className="field" defaultValue={c} onBlur={(e) => { if (!renameCat(c, e.target.value)) e.target.value = c; }} />
                  <button className="btn-danger shrink-0" onClick={() => delCat(c)}>Hapus</button>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex gap-2">
              <input className="field" placeholder="Nama kategori baru" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCat()} />
              <button className="btn shrink-0" onClick={addCat}>+ Tambah</button>
            </div>
            <button className="btn-ghost mt-6" onClick={() => setCatOpen(false)}>Selesai</button>
          </Modal>
        )}
      </AnimatePresence>

      {/* PESAN MASUK */}
      <AnimatePresence>
        {inboxOpen && (
          <Modal onClose={() => setInboxOpen(false)} width={680}>
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-xl font-bold">Pesan Masuk</h2>
              <button className="btn-ghost" onClick={() => setInboxOpen(false)}>Tutup</button>
            </div>
            {!isRemote() && (
              <p className="mt-4 text-sm text-fg/65">Kotak masuk aktif setelah Supabase disambungkan. Tanpa itu, pesan hanya sampai bila webhook Discord diisi.</p>
            )}
            {isRemote() && inbox.length === 0 && <p className="mt-4 text-fg/65">Belum ada pesan.</p>}
            <ul className="mt-5 space-y-4">
              {inbox.map((m) => (
                <li key={m.id} className="rounded-xl border border-fg/10 p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-xs text-fg/50">{new Date(m.created_at).toLocaleString('id-ID')}</p>
                  </div>
                  {m.email ? (isEmail(m.email) ? <a href={`mailto:${m.email}`} className="text-sm text-neon underline underline-offset-4">{m.email}</a> : <p className="text-sm text-neon">{m.email}</p>) : <p className="text-sm text-fg/50">Tanpa kontak balasan</p>}
                  <p className="mt-3 whitespace-pre-line break-words text-fg/80">{m.message}</p>
                  <button className="btn-danger mt-4" onClick={() => removeMsg(m.id)}>Hapus</button>
                </li>
              ))}
            </ul>
          </Modal>
        )}
      </AnimatePresence>

      {/* FORM PENGALAMAN */}
      <AnimatePresence>
        {expForm && (
          <Modal onClose={() => setExpForm(null)} width={560}>
            <h2 className="font-display text-xl font-bold">{expForm.id ? 'Edit Pengalaman' : 'Tambah Pengalaman'}</h2>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm text-fg/65">Posisi atau peran</span>
                <input className="field" value={expForm.role} onChange={(e) => setExpForm({ ...expForm, role: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-fg/65">Perusahaan atau klien</span>
                <input className="field" value={expForm.company} onChange={(e) => setExpForm({ ...expForm, company: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-fg/65">Periode</span>
                <input className="field" placeholder="contoh: 2023 – Sekarang" value={expForm.period} onChange={(e) => setExpForm({ ...expForm, period: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-fg/65">Deskripsi</span>
                <textarea rows={4} className="field" value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} />
              </label>
            </div>
            <div className="mt-7 flex gap-2">
              <button className="btn" onClick={saveExp}>Simpan</button>
              <button className="btn-ghost" onClick={() => setExpForm(null)}>Batal</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* FORM TAMBAH / EDIT KARYA */}
      <AnimatePresence>
        {form && (
          <Modal onClose={() => setForm(null)} width={640}>
            <h2 className="font-display text-xl font-bold">{form.id ? 'Edit Karya' : 'Tambah Karya'}</h2>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm text-fg/65">Judul</span>
                <input className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-fg/65">Kategori</span>
                <select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {cats.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-fg/65">Deskripsi proyek</span>
                <textarea rows={4} className="field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>

              <div>
                <span className="mb-2 block text-sm text-fg/65">Foto sampul</span>
                {form.cover && <img src={form.cover} alt="Sampul" className="mb-2 aspect-video w-full max-w-xs rounded-lg object-cover" />}
                <label className="btn-ghost inline-block">
                  {form.cover ? 'Ganti sampul' : 'Upload Gambar'}
                  <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && upload([e.target.files[0]], (u) => setForm((f) => ({ ...f, cover: u })))} />
                </label>
              </div>

              <div>
                <span className="mb-2 block text-sm text-fg/65">Foto detail (boleh banyak)</span>
                <div className="mb-2 flex flex-wrap gap-2">
                  {form.images.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt="" className="h-20 w-24 rounded-md object-cover" />
                      <button type="button" aria-label="Hapus foto" className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-danger text-xs font-bold text-white"
                        onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }))}>×</button>
                    </div>
                  ))}
                </div>
                <label className="btn-ghost inline-block">
                  Tambah foto detail
                  <input type="file" accept="image/*" multiple hidden onChange={(e) => upload([...e.target.files], (u) => setForm((f) => ({ ...f, images: [...f.images, u] })))} />
                </label>
              </div>

              <div>
                <span className="mb-2 block text-sm text-fg/65">Video (opsional)</span>
                <ul className="mb-2 space-y-2">
                  {(form.videos || []).map((v, i) => {
                    const pv = parseVideo(v);
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-fg/10 px-3 py-2 text-sm">
                        <span className="min-w-0 truncate">▶ {pv ? pv.label : 'Link tidak dikenali'}: <span className="text-fg/55">{v}</span></span>
                        <button type="button" className="shrink-0 text-danger" onClick={() => setForm((f) => ({ ...f, videos: f.videos.filter((_, j) => j !== i) }))}>Hapus</button>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex gap-2">
                  <input className="field" placeholder="Tempel link YouTube atau Vimeo" value={vidLink} onChange={(e) => setVidLink(e.target.value)} />
                  <button type="button" className="btn-ghost shrink-0" onClick={addVideoLink}>Tambah link</button>
                </div>
                <label className="btn-ghost mt-2 inline-block">
                  Upload video (MP4 atau WebM, maks 50 MB)
                  <input type="file" accept="video/mp4,video/webm" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) addVideoFile(f); }} />
                </label>
              </div>
            </div>
            <div className="mt-7 flex items-center gap-2">
              <button className="btn" disabled={busy} onClick={saveWork}>{busy ? 'Mengunggah...' : 'Simpan karya'}</button>
              <button className="btn-ghost" onClick={() => setForm(null)}>Batal</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="surface surface-strong fixed bottom-24 left-1/2 z-[60] w-max max-w-[90vw] -translate-x-1/2 rounded-full px-5 py-3 text-center text-sm"
            role="status"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      </DirCtx.Provider>
    </MotionConfig>
  );
}
