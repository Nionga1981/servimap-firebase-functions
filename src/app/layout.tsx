
import type {Metadata} from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { AppLayout } from '@/components/layout/AppLayout';
import { Toaster } from "@/components/ui/toaster";
// import { requestNotificationPermission, onForegroundMessage } from '@/lib/firebase'; // Conceptual FCM
// import { useEffect } from 'react'; // Conceptual FCM
// import { useToast } from '@/hooks/use-toast'; // Conceptual FCM

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['300', '400', '500', '600', '700']
});

export const metadata: Metadata = {
  title: 'ServiMap',
  description: 'Conecta con profesionales calificados en tiempo real.',
  icons: null,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // --- Conceptual FCM Client-Side Setup ---
  // const { toast } = useToast(); // Conceptual FCM

  // useEffect(() => { // Conceptual FCM
  //   const setupFCM = async () => {
  //     const token = await requestNotificationPermission();
  //     if (token) {
  //       // Send token to your server if needed (e.g., for a logged-in user)
  //       // await saveTokenToServer(token, "currentUserDemoId");
  //     }
  //   };
  //   setupFCM();

  //   onForegroundMessage((payload) => {
  //     console.log("Foreground message received in Layout: ", payload);
  //     toast({
  //       title: payload.notification?.title || "Nueva Notificación",
  //       description: payload.notification?.body || "Has recibido una nueva notificación.",
  //     });
  //   });
  // }, [toast]);
  // --- End Conceptual FCM Client-Side Setup ---

  return (
    <html lang="es" suppressHydrationWarning className={montserrat.variable}>
      <body className="font-montserrat antialiased">
        <AppLayout>
          {children}
        </AppLayout>
        <Toaster />
      </body>
    </html>
  );
}
