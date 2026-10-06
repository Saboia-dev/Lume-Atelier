import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Lume — Atelier de Pele',
  description: 'Um espaço para cuidar da pele com tempo, escuta e intenção. Conheça os rituais e reserve sua avaliação na Lume.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : 'http://localhost:3000')),
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
