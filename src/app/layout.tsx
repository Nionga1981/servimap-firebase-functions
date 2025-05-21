import type {Metadata} from 'next';
// Font loading commented out to simplify
// import { Inter } from 'next/font/google';
import './globals.css';
import { AppLayout } from '@/components/layout/AppLayout';
import { Toaster } from "@/components/ui/toaster"

// const inter = Inter({
//   subsets: ['latin'],
//   variable: '--font-inter',
// });

export const metadata: Metadata = {
  title: 'ServiMap', 
  description: 'Conecta con profesionales calificados en tiempo real.',
  icons: null, // Explicitly state no icons should be processed via metadata
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      {/* <body className={`${inter.variable} font-sans antialiased`}> */}
      <body className="font-sans antialiased"> {/* Font class removed */}
        <AppLayout>
          {children}
        </AppLayout>
        <Toaster />
      </body>
    </html>
  );
}
