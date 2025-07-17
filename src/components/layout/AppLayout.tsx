import type {Metadata} from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { AppHeader } from '@/components/layout/AppHeader'; // Directly import AppHeader
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils'; // Import cn utility

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['300', '400', '500', '600', '700']
});

export const metadata: Metadata = {
  title: 'ConectaPro',
  description: 'Conecta con profesionales calificados en tiempo real.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", montserrat.variable)}>
        <div className="relative flex min-h-screen flex-col">
          <AppHeader />
          <main className="flex-1">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}