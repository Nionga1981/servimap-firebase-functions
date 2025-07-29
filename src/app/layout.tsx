
import type {Metadata} from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { AppHeader } from '@/components/layout/AppHeader';
import { PWAInstaller } from '@/components/PWAInstaller';
import { AuthProvider } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';


const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['300', '400', '500', '600', '700']
});

export const metadata: Metadata = {
  title: 'ServiMap',
  description: 'Conecta con prestadores de servicios verificados en tiempo real.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ServiMap',
  },
  applicationName: 'ServiMap',
  keywords: ['servicios', 'profesionales', 'plomeria', 'electricidad', 'limpieza', 'reparaciones'],
  authors: [{ name: 'ServiMap Team' }],
  creator: 'ServiMap',
  publisher: 'ServiMap',
  category: 'business',
};

export const viewport = {
  themeColor: '#3b82f6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", montserrat.variable)}>
        <AuthProvider>
          <LocationProvider>
            <div className="relative flex min-h-screen flex-col">
              <AppHeader />
              <main className="flex-1">{children}</main>
            </div>
            <Toaster />
            <PWAInstaller />
          </LocationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
