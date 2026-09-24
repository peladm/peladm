import { useState } from 'react';

interface AdInterstitialManager {
  shouldShowInterstitial: boolean;
  incrementPageNavigation: () => void; // Contador de navegações entre páginas
  resetInterstitial: () => void;
  showAdOnPartidaEnd: () => void; // FREE: ao finalizar cada partida
  showAdOnPeladaEnd: () => void; // FREE e GOLD: ao encerrar pelada completa
  navegacoes: number;
}

const AD_FREQUENCY_FREE = 4; // FREE: interstitial a cada 4 navegações

export function useAdInterstitial(): AdInterstitialManager {
  const [navegacoes, setNavegacoes] = useState(0);
  const [shouldShowInterstitial] = useState(false);

  const incrementPageNavigation = () => {
    setNavegacoes((valorAtual) => valorAtual + 1);
  };

  const resetInterstitial = () => {
    // Mantido por compatibilidade com chamadas existentes.
  };

  const showAdOnPartidaEnd = () => {
    // Mantido por compatibilidade com chamadas existentes.
  };

  const showAdOnPeladaEnd = () => {
    // Mantido por compatibilidade com chamadas existentes.
  };

  return {
    shouldShowInterstitial,
    incrementPageNavigation,
    resetInterstitial,
    showAdOnPartidaEnd,
    showAdOnPeladaEnd,
    navegacoes
  };
}
