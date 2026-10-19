export const CATEGORIES = ['Branding', 'Motion', '2D/3D Art', 'Poster'];

const ph = (a, b, t) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1200" height="900" fill="url(#g)"/><text x="60" y="840" font-size="64" fill="#fff" fill-opacity=".85" font-family="sans-serif">${t}</text></svg>`
  );

export const defaultData = {
  categories: CATEGORIES,
  experience: [
    { id: 'e1', role: 'Graphic Designer', company: 'Nama Perusahaan', period: '2024 – Sekarang', description: 'Merancang identitas visual, materi kampanye, dan aset media sosial.' },
    { id: 'e2', role: 'Freelance Designer', company: 'Klien Independen', period: '2022 – 2024', description: 'Mengerjakan proyek branding dan poster untuk bisnis lokal.' }
  ],
  marquee: { items: ['Graphic Design', 'Branding', 'Motion', 'Poster', 'Illustration'], speed: 7 },
  profile: {
    name: 'Nama Lengkap Kamu',
    nickname: 'Panggilan',
    status: 'Terbuka untuk proyek',
    socials: { instagram: '', behance: '', linkedin: '', discord: '', fiverr: '' },
    headline: 'Graphic Designer: branding, motion, dan ilustrasi',
    bio: 'Saya membuat identitas visual, poster, dan animasi untuk brand yang ingin tampil berani. Masuk ke Mode Admin untuk mengganti teks ini.',
    email: 'halo@namakamu.com',
    avatar: ph('#c084fc', '#8a5cff', 'Foto')
  },
  works: [
    { id: 'w1', title: 'Kopi Senja', category: 'Branding', description: 'Identitas merek untuk kedai kopi lokal: logo, palet warna, dan kemasan.', cover: ph('#8a5cff', '#1a0a3a', 'Kopi Senja'), images: [ph('#2a1566', '#8a5cff', 'Logo'), ph('#c084fc', '#2a1040', 'Palet warna')] },
    { id: 'w2', title: 'Festival Malam', category: 'Poster', description: 'Seri poster untuk festival musik elektronik.', cover: ph('#ff3d9a', '#220018', 'Festival Malam'), images: [ph('#ff3d9a', '#c084fc', 'Poster 1'), ph('#220018', '#ff3d9a', 'Poster 2')] },
    { id: 'w3', title: 'Loop Neon', category: 'Motion', description: 'Animasi loop 10 detik untuk intro kanal video.', cover: ph('#c084fc', '#1a0a24', 'Loop Neon'), images: [ph('#1a0a24', '#c084fc', 'Frame 1')] },
    { id: 'w4', title: 'Kota Bawah Laut', category: '2D/3D Art', description: 'Ilustrasi 3D kota fiksi di dasar laut.', cover: ph('#a855f7', '#14061f', 'Kota Bawah Laut'), images: [ph('#14061f', '#a855f7', 'Detail 1'), ph('#a855f7', '#8a5cff', 'Detail 2')] }
  ]
};
