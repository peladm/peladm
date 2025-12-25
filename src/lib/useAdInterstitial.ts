import { useState, useEffect } from 'react';
import { usePermissions } from './usePermissions';

interface AdInterstitialManager {
  shouldShowInterstitial: boolean;
  incrementActionCounter: () => void;
  resetInterstitial: () => void;
}

const AD_FREQUENCY = 4; // Mostrar anúncio a cada X ações

export function useAdInterstitial(): AdInterstitialManager {
  const { possuiPermissao } = usePermissions();
  const [actionCounter, setActionCounter] = useState(0);
  const [shouldShowInterstitial, setShouldShowInterstitial] = useState(false);

  // Carregar contador do localStorage
  useEffect(() => {
    const savedCounter = localStorage.getItem('ad_action_counter');
    if (savedCounter) {
      setActionCounter(parseInt(savedCounter));
    }
  }, []);

  const incrementActionCounter = () => {
    // Não incrementar se usuário tem permissão para remover anúncios
    if (possuiPermissao('removerAnuncios')) {
      return;
    }

    const newCounter = actionCounter + 1;
    setActionCounter(newCounter);
    localStorage.setItem('ad_action_counter', newCounter.toString());

    // Verificar se deve mostrar anúncio
    if (newCounter >= AD_FREQUENCY) {
      setShouldShowInterstitial(true);
      // Resetar contador
      setActionCounter(0);
      localStorage.setItem('ad_action_counter', '0');
    }
  };

  const resetInterstitial = () => {
    setShouldShowInterstitial(false);
  };

  return {
    shouldShowInterstitial,
    incrementActionCounter,
    resetInterstitial
  };
}
