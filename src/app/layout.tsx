import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import UpdateNotification from "../components/UpdateNotification";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PelADM - Gerenciador de Peladas",
  description: "Sistema completo para gerenciar suas peladas de futebol",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PelADM",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#16a34a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="PelADM" />
        
        {/* Google AdSense */}
        <script 
          async 
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1309259002546007"
          crossOrigin="anonymous"
        ></script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <UpdateNotification />
        {children}
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(registration) {
                    console.log('[SW] Registrado com sucesso:', registration.scope);
                    
                    // Verifica atualizações a cada 30 segundos
                    setInterval(() => {
                      registration.update();
                    }, 30000);
                    
                    // Escuta mudanças no Service Worker
                    registration.addEventListener('updatefound', () => {
                      const newWorker = registration.installing;
                      console.log('[SW] Nova versão encontrada!');
                      
                      if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('[SW] Nova versão instalada e pronta!');
                          }
                        });
                      }
                    });
                  },
                  function(err) {
                    console.log('[SW] Falha ao registrar:', err);
                  }
                );
              });
            }
          `
        }} />
      </body>
    </html>
  );
}
