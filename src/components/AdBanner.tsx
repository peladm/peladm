'use client';

import { useEffect } from 'react';
import { usePermissions } from '../lib/usePermissions';
import { usePathname } from 'next/navigation';

interface AdBannerProps {
  position?: 'top' | 'bottom';
}

export default function AdBanner({ position = 'bottom' }: AdBannerProps) {
  const { possuiPermissao, plano } = usePermissions();
  const pathname = usePathname();

  useEffect(() => {
    // Carregar script do AdMob/AdSense quando o componente montar
    if (!possuiPermissao('removerAnuncios')) {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (err) {
        console.error('Erro ao carregar banner:', err);
      }
    }
  }, [possuiPermissao]);

  // Premium: não mostrar anúncios
  if (plano === 'Premium') {
    return null;
  }

  // Gold: não mostrar banner na página de fila
  if (plano === 'Gold' && (pathname === '/fila' || pathname === '/page-fila')) {
    return null;
  }

  // Free: mostrar em todas as páginas

  return (
    <div
      style={{
        position: 'fixed',
        [position]: position === 'bottom' ? '0' : '0',
        left: 0,
        right: 0,
        height: '60px',
        background: '#f8f9fa',
        borderTop: position === 'bottom' ? '1px solid #e5e7eb' : 'none',
        borderBottom: position === 'top' ? '1px solid #e5e7eb' : 'none',
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
      }}
    >
      {/* Banner AdMob 320x50 */}
      <ins
        className="adsbygoogle"
        style={{ display: 'inline-block', width: '320px', height: '50px' }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" // Substitua pelo seu ID do AdMob
        data-ad-slot="1234567890" // Substitua pelo ID do Ad Unit
      />
      
      {/* Placeholder visual para desenvolvimento */}
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
        border: '2px dashed rgba(255,255,255,0.3)'
      }}>
        📢 Anúncio 320x50
      </div>
    </div>
  );
}
