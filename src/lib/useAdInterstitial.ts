import { useState, useEffect } from 'react';
import { usePermissions } from './usePermissions';

interface AdInterstitialManager {
  shouldShowInterstitial: boolean;
  incrementActionCounter: () => void;
  resetInterstitial: () => void;
  showAdOnPeladaEnd: () => void; // Nova função para forçar anúncio ao encerrar pelada
}

const AD_FREQUENCY_FREE = 4; // FREE: a cada 4 ações

export function useAdInterstitial(): AdInterstitialManager {
  const { possuiPermissao, planoUsuario } = usePermissions();
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
    // Premium não mostra anúncios
    if (planoUsuario === 'Premium') {
      return;
    }

    // Gold não mostra anúncios de ação (só ao encerrar pelada)
    if (planoUsuario === 'Gold') {
      return;
    }

    // Free: mostrar a cada 4 ações
    const newCounter = actionCounter + 1;
    setActionCounter(newCounter);
    localStorage.setItem('ad_action_counter', newCounter.toString());

    if (newCounter >= AD_FREQUENCY_FREE) {
      setShouldShowInterstitial(true);
      setActionCounter(0);
      localStorage.setItem('ad_action_counter', '0');
    }
  };

  const resetInterstitial = () => {
    setShouldShowInterstitial(false);
  };

  const showAdOnPeladaEnd = () => {
    // Premium não mostra anúncios
    if (planoUsuario === 'Premium') {
      return;
    }

    // Free e Gold mostram anúncio ao encerrar pelada
    setShouldShowInterstitial(true);
  };

  return {
    shouldShowInterstitial,
    incrementActionCounter,
    resetInterstitial,
    showAdOnPeladaEnd
  };
}
