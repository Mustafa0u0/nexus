import localFont from 'next/font/local';
import './globals.css';

const geistSans = localFont({
  src: '../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2',
  variable: '--font-manrope',
  display: 'swap',
  weight: '100 900',
});

const geistMono = localFont({
  src: '../../node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2',
  variable: '--font-ibm-plex-mono',
  display: 'swap',
  weight: '100 900',
});

export const metadata = {
  title: 'Mihna AI Interview Platform',
  description: 'Premium AI hiring workspace for voice interviews, recruiter workflows, and executive-ready evaluation reports.',
  icons: {
    icon: '/mihna-logo.png',
    shortcut: '/mihna-logo.png',
    apple: '/mihna-logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
