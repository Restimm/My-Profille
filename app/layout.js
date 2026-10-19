import './globals.css';
import { Unbounded, Manrope } from 'next/font/google';

const display = Unbounded({ subsets: ['latin'], variable: '--font-display', weight: ['500', '700'] });
const body = Manrope({ subsets: ['latin'], variable: '--font-body' });

export const metadata = { title: 'Portofolio Graphic Designer', description: 'Karya branding, motion, ilustrasi, dan poster.' };

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning className={`${display.variable} ${body.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{localStorage.removeItem('folio:theme');document.documentElement.classList.remove('light')}catch(e){}" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
