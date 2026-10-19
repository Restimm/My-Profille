'use client';
import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

/* ===== Garis neon yang mengalir seperti ular menyusuri alur halaman =====
   Kanvas ini menempel pada halaman (ikut tergulung oleh browser), bukan melayang tetap di layar,
   sehingga garisnya tidak bergetar ke kiri-kanan saat scroll. Hanya ujung (kepala) dan ekor yang digambar ulang.
   Kepala bergerak 1:1 mengikuti scroll, ekornya memudar dan berpendar. Ular murni visual:
   tidak ada reaksi cahaya pada panel/kartu di sekitarnya. */
const TAU = Math.PI * 2;
const PERIOD = 1400;   // panjang minimal satu liukan (px halaman)
const TAIL = 640;      // panjang ekor cahaya (px)
const STEP = 8;        // jarak antar titik ekor (px)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// warna ular: ekor violet -> fuksia -> kepala rose
const STOPS = [[139, 92, 246], [217, 70, 239], [251, 113, 133]];
const grad = (t) => {
  const k = clamp(t, 0, 1) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(k));
  const f = k - i;
  return STOPS[i].map((v, j) => Math.round(v + (STOPS[i + 1][j] - v) * f)).join(',');
};

// perkiraan perangkat lemah: CPU <= 4 inti, RAM <= 2 GB, atau mode hemat data aktif
function isLite() {
  if (typeof navigator === 'undefined') return false;
  const n = navigator;
  return (n.hardwareConcurrency || 8) <= 4 || (n.deviceMemory || 8) <= 2 || !!(n.connection && n.connection.saveData);
}

function CanvasSnake() {
  const ref = useRef(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv.getContext('2d');
    let w = 0, vhBase = 0, hC = 1, dpr = 1, H = 1, top0 = -1;
    let raf = 0, running = false, lastScrollT = 0;
    let band = null;   // bagian kanvas yang terakhir digambar [atas, bawah]
    let full = true;   // true = bersihkan dan gambar ulang seluruh kanvas
    const col = { fg: '236,236,241' };

    const readCols = () => {
      const cs = getComputedStyle(document.documentElement);
      const f = (v, fb) => (cs.getPropertyValue(v).trim().split(/\s+/).join(',') || fb);
      col.fg = f('--fg', col.fg);
    };

    // jalur: satu gelombang landai; makin lebar layar makin panjang liukannya agar tidak terlalu miring
    const X = (y) => {
      const amp = w * (w < 700 ? 0.38 : 0.42);
      const period = Math.max(PERIOD, amp * 5.2);
      return clamp(w / 2 + amp * Math.sin((y / period) * TAU + 0.6), w * 0.04, w * 0.96);
    };

    // ukuran kanvas: sekitar 3 tinggi layar, dipasang di posisi halaman dan dipindah saat scroll jauh
    const layout = () => {
      hC = Math.max(1, Math.min(Math.round(vhBase * 3), Math.round(H)));
      dpr = Math.max(1, Math.min(1.5, window.devicePixelRatio || 1, Math.sqrt(6e6 / (w * hC))));
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(hC * dpr);
      cv.style.width = w + 'px';
      cv.style.height = hC + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      top0 = -1;
      full = true;
      band = null;
    };

    const size = () => {
      const nw = document.documentElement.clientWidth;
      // tinggi layar acuan tidak menyusut saat bar alamat HP naik-turun, supaya ujung ular tidak meloncat
      if (nw !== w || !vhBase) vhBase = window.innerHeight;
      else if (window.innerHeight > vhBase) vhBase = window.innerHeight;
      w = nw;
      layout();
    };

    const place = (sy) => {
      const maxTop = Math.max(0, H - hC);
      const need = top0 < 0 || sy - top0 < vhBase * 0.4 || top0 + hC - (sy + vhBase) < vhBase * 0.4;
      if (!need) return;
      const nt = clamp(Math.round(sy - vhBase), 0, maxTop);
      if (nt !== top0) {
        top0 = nt;
        cv.style.top = nt + 'px';
        full = true;
        band = null;
      }
    };

    const drawTrack = (ya, yb) => {
      ctx.beginPath();
      for (let y = ya; y <= yb; y += 10) {
        const px = X(y + top0);
        y === ya ? ctx.moveTo(px, y) : ctx.lineTo(px, y);
      }
      ctx.strokeStyle = `rgba(${col.fg},.06)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    // yH = posisi kepala dalam koordinat halaman
    const draw = (yH) => {
      const yHc = yH - top0; // koordinat kanvas
      const pts = [{ x: X(yH), y: yHc, s: 0 }];
      let acc = 0, yy = yH, px = pts[0].x;
      while (acc < TAIL && yy - top0 > -60) {
        yy -= STEP;
        const nx = X(yy);
        acc += Math.hypot(nx - px, STEP);
        px = nx;
        pts.push({ x: nx, y: yy - top0, s: acc });
      }

      // hanya area di sekitar ular yang dibersihkan dan digambar ulang
      const na = Math.max(0, Math.floor(pts[pts.length - 1].y - 8));
      const nb = Math.min(hC, Math.ceil(yHc + 16));
      let ca = na, cb = nb;
      if (full || !band) { ca = 0; cb = hC; }
      else { ca = Math.min(na, band[0]); cb = Math.max(nb, band[1]); }

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, ca, w, cb - ca);
      ctx.clip();
      ctx.clearRect(0, ca, w, cb - ca);
      drawTrack(Math.floor(ca / 10) * 10 - 10, cb + 10);

      // ekor memudar: makin dekat kepala makin terang dan tebal
      ctx.lineCap = 'butt';
      for (let pass = 0; pass < 2; pass++) {
        for (let i = pts.length - 1; i > 0; i--) {
          const a = pts[i], b = pts[i - 1];
          const frac = Math.max(0, 1 - b.s / TAIL);
          const alpha = Math.pow(frac, 1.8);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          if (pass === 0) { ctx.strokeStyle = `rgba(${grad(frac)},${(alpha * 0.1).toFixed(3)})`; ctx.lineWidth = 7; }
          else { ctx.strokeStyle = `rgba(${grad(frac)},${(alpha * 0.95).toFixed(3)})`; ctx.lineWidth = 0.8 + 1.6 * frac; }
          ctx.stroke();
        }
      }

      // kepala
      if (yHc > -20 && yHc < hC + 20) {
        ctx.beginPath(); ctx.arc(pts[0].x, yHc, 9, 0, TAU); ctx.fillStyle = 'rgba(251,113,133,.25)'; ctx.fill();
        ctx.beginPath(); ctx.arc(pts[0].x, yHc, 2.6, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fill();
      }
      ctx.restore();

      band = [na, nb];
      full = false;
    };

    const frame = (t) => {
      const sy = window.scrollY;
      const p = clamp(sy / Math.max(1, H - vhBase), 0, 1);
      const yHead = sy + vhBase * (0.12 + 0.76 * p); // kepala turun dari atas ke bawah halaman, 1:1 dengan scroll
      place(sy);
      draw(yHead);
      // terus menggambar selama scroll berlangsung agar kepala rapat mengikuti halaman
      if (t - lastScrollT < 160) raf = requestAnimationFrame(frame);
      else running = false;
    };

    const kick = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const onScroll = () => { lastScrollT = performance.now(); kick(); };

    const onResize = () => {
      const nw = document.documentElement.clientWidth;
      if (nw !== w) size();
      else if (window.innerHeight > vhBase) { vhBase = window.innerHeight; layout(); }
      kick();
    };

    const bodyH = () => Math.max(1, document.body.getBoundingClientRect().height);
    readCols();
    H = bodyH();
    size();
    kick();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(() => {
      const nh = bodyH();
      if (Math.abs(nh - H) > 24) { H = nh; layout(); } // abaikan perubahan tinggi yang kecil
      kick();
    });
    ro.observe(document.body);
    const mo = new MutationObserver(() => { readCols(); full = true; kick(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute left-0 top-0 -z-10" />;
}

export default function Backdrop() {
  const reduce = useReducedMotion();

  // mode hemat untuk perangkat lemah (mengurangi blur menu dan animasi latar)
  useEffect(() => {
    if (isLite()) document.documentElement.classList.add('lite');
  }, []);

  return (
    <>
      {/* pendaran latar yang sangat halus */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="orb absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-plum/15 blur-[130px]" />
        <div className="orb absolute -right-40 top-1/3 h-[26rem] w-[26rem] rounded-full bg-neon/10 blur-[130px]" style={{ animationDelay: '-9s' }} />
      </div>

      {/* ular cahaya berada di lapisan paling belakang, di bawah semua panel */}
      {!reduce && <CanvasSnake />}
    </>
  );
}
