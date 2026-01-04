'use client';

import { useEffect } from 'react';
import { buscar_plano } from '../lib/credenciais';
import { usePathname } from 'next/navigation';

interface AdBannerProps {
  position?: 'top' | 'bottom';
}

export default function AdBanner({ position = 'bottom' }: AdBannerProps) {
  const plano = buscar_plano();
  const pathname = usePathname();

  // Premium e Gold: SEM anúncios
  if (plano === 'premium' || plano === 'gold') {
    return null;
  }

  // Login: NUNCA mostrar banner
  if (pathname === '/login' || pathname === '/cadastro-free') {
    return null;
  }

  useEffect(() => {
    // Carregar script do AdMob/AdSense quando o componente montar (somente Free)
    if (plano === 'free') {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {
        console.error('Erro ao carregar banner:', err);
      }
    }
  }, [plano]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0, // Totalmente embaixo
        left: 0,
        right: 0,
        height: '60px',
        background: '#f8f9fa',
        borderTop: '1px solid #e5e7eb',
        zIndex: 20, // Abaixo do footer
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
      }}
    >
      {/* Placeholder visual para desenvolvimento - sempre visível */}
      <div style={{
        width: '320px',
        height: '50px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: '12px',
        fontWeight: 'bold',
        border: '2px dashed rgba(255,255,255,0.3)',
        position: 'relative',
        zIndex: 1
      }}>
        📢 Anúncio Banner 320x50
      </div>

      {/* Banner AdMob 320x50 - desabilitado em dev */}
      {/* <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: '320px', height: '50px', position: 'absolute' }}
        data-ad-client="ca-pub-1309259002546007"
        data-ad-slot="1234567890"
      /> */}
    </div>
  );
}
