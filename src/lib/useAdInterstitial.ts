import { useState, useEffect, useRef } from 'react';
import { usePermissions } from './usePermissions';
import { usePathname } from 'next/navigation';

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
  const { plano } = usePermissions();
  const pathname = usePathname();
  const [navegacoes, setNavegacoes] = useState(0);
  const [shouldShowInterstitial, setShouldShowInterstitial] = useState(false);

  // Detectar mudança de página usando localStorage
  useEffect(() => {
    const ultimoPath = localStorage.getItem('ad_ultimo_path') || '';
    
    // Se mudou E não é a primeira vez E é Free
    if (pathname !== ultimoPath && ultimoPath !== '' && plano === 'Free') {
      const currentCounter = parseInt(localStorage.getItem('ad_nav_counter') || '0');
      const newCounter = currentCounter + 1;
      
      setNavegacoes(newCounter);
      localStorage.setItem('ad_nav_counter', newCounter.toString());

      if (newCounter >= AD_FREQUENCY_FREE) {
        setShouldShowInterstitial(true);
        localStorage.setItem('ad_nav_counter', '0');
      }
    }
    
    // Sempre salvar o path atual
    localStorage.setItem('ad_ultimo_path', pathname);
  }, [pathname, plano]);

  const incrementPageNavigation = () => {
    console.log('🔄 incrementPageNavigation chamado manualmente');
    
    // Premium: NUNCA mostrar
    if (plano === 'Premium') {
      console.log('⛔ Premium - sem anúncios');
      return;
    }

    // Gold: não conta navegações (só interstitial ao finalizar pelada)
    if (plano === 'Gold') {
      console.log('⛔ Gold - sem contador de navegação');
      return;
    }

    // Free: incrementar e verificar se atingiu 4
    const newCounter = navegacoes + 1;
    setNavegacoes(newCounter);
    localStorage.setItem('ad_nav_counter', newCounter.toString());
    
    console.log(`📊 Contador manual: ${newCounter}/4 (FREE)`);

    if (newCounter >= AD_FREQUENCY_FREE) {
      console.log('🎬 EXIBINDO INTERSTITIAL FREE (manual)');
      setShouldShowInterstitial(true);
      setNavegacoes(0);
      localStorage.setItem('ad_nav_counter', '0');
    }
  };

  const resetInterstitial = () => {
    setShouldShowInterstitial(false);
  };

  const showAdOnPartidaEnd = () => {
    // Premium: NUNCA
    if (plano === 'Premium') {
      return;
    }

    // Gold: NÃO exibe ao finalizar partida (só ao finalizar pelada)
    if (plano === 'Gold') {
      return;
    }

    // Free: exibir ao finalizar cada partida
    if (plano === 'Free') {
      console.log('🎬 Exibindo interstitial FREE (fim de partida)');
      setShouldShowInterstitial(true);
    }
  };

  const showAdOnPeladaEnd = () => {
    // Premium: NUNCA
    if (plano === 'Premium') {
      return;
    }

    // Free e Gold: exibir ao encerrar pelada completa
    console.log(`🎬 Exibindo interstitial ${plano} (fim de pelada)`);
    setShouldShowInterstitial(true);
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
