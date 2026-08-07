import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { SessionProvider } from "next-auth/react"

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AutoRent Markt - Comprehensive Auto Marketplace',
  description: 'Buy and sell vehicles, parts, and more with AI-powered services',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <html lang="ru" className={inter.className}>
        <body>
          <Navbar />
          <main className="min-h-screen">
            {children}
          </main>
          <Footer />
        </body>
      </html>
    </SessionProvider>
  );
}