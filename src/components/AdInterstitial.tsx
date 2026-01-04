'use client';

import { useState, useEffect } from 'react';
import { buscar_plano } from '../lib/credenciais';

interface AdInterstitialProps {
  onClose: () => void;
  motivo?: 'navegacao' | 'partida' | 'pelada'; // Para logs/analytics
}

export default function AdInterstitial({ onClose, motivo = 'navegacao' }: AdInterstitialProps) {
  const plano = buscar_plano();
  const [countdown, setCountdown] = useState(5);

  // Premium e Gold: NUNCA renderizar anúncios
  if (plano === 'premium' || plano === 'gold') {
    return null;
  }

  useEffect(() => {
    console.log(`🎬 Interstitial exibido - Plano: ${plano}, Motivo: ${motivo}`);
    
    // Carregar anúncio interstitial do AdMob
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('Erro ao carregar interstitial:', err);
    }
  }, []);

  useEffect(() => {
    // Countdown para fechar
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Premium: NUNCA renderizar
  if (plano === 'Premium') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.95)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      {/* Botão Fechar (aparece após countdown) */}
      {countdown === 0 ? (
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            fontSize: '20px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
        >
          ✕
        </button>
      ) : (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: '#fff',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#667eea',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}
        >
          {countdown}
        </div>
      )}

      {/* Container do Anúncio */}
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: '#fff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
        }}
      >
        {/* Anúncio Interstitial AdMob 300x250 ou 320x480 */}
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" // Substitua pelo seu ID do AdMob
          data-ad-slot="0987654321" // Substitua pelo ID do Ad Unit Interstitial
          data-ad-format="auto"
          data-full-width-responsive="true"
        />

        {/* Placeholder visual para desenvolvimento */}
        <div
          style={{
            width: '100%',
            height: '400px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            gap: '16px',
            padding: '20px'
          }}
        >
          <div style={{ fontSize: '48px' }}>📢</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', textAlign: 'center' }}>
            Anúncio Interstitial
          </div>
          <div style={{ fontSize: '14px', textAlign: 'center', opacity: 0.9 }}>
            300x250 ou 320x480
          </div>
          <div
            style={{
              marginTop: '20px',
              padding: '12px 24px',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '8px',
              fontSize: '12px'
            }}
          >
            {countdown > 0 ? `Fechar em ${countdown}s` : 'Clique no X para fechar'}
          </div>
        </div>
      </div>

      {/* Texto informativo */}
      <p
        style={{
          color: '#fff',
          fontSize: '12px',
          marginTop: '20px',
          textAlign: 'center',
          opacity: 0.7
        }}
      >
        💎 Faça upgrade para Gold/Premium e remova anúncios!
      </p>
    </div>
  );
}
