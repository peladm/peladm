'use client';

interface AdInterstitialProps {
  onClose: () => void;
  motivo?: 'navegacao' | 'partida' | 'pelada'; // Para logs/analytics
}

export default function AdInterstitial({ onClose, motivo = 'navegacao' }: AdInterstitialProps) {
  void onClose;
  void motivo;
  return null;
}
