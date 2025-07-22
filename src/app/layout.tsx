
import type {Metadata} from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import dynamic from 'next/dynamic';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';

// Dynamically import the AppHeader to optimize chunk loading
const AppHeader = dynamic(() => import('@/components/layout/AppHeader').then(mod => mod.AppHeader), { ssr: false });


const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['300', '400', '500', '600', '700']
});

export const metadata: Metadata = {
  title: 'ServiMap',
  description: 'Conecta con prestadores de servicios verificados en tiempo real.',
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
