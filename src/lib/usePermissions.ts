import { useState, useEffect } from 'react';
import { buscar_plano } from './credenciais';
import { Plano, Permissoes, PERMISSOES_POR_PLANO, NOMES_PLANOS, CORES_PLANOS } from './permissoes';

interface UsePermissionsReturn {
  plano: Plano;
  permissoes: Permissoes;
  nomePlano: string;
  coresPlano: { bg: string; text: string; badge: string };
  loading: boolean;
  possuiPermissao: (recurso: keyof Permissoes) => boolean;
  verificarLimite: (quantidade: number, recurso: 'limiteJogadores') => { permitido: boolean; limite: number | null };
}

export function usePermissions(): UsePermissionsReturn {
  const [plano, setPlano] = useState<Plano>('Free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarPlano();
  }, []);

  const carregarPlano = async () => {
    try {
      const planoStr = buscar_plano();
      
      if (!planoStr) {
        setPlano('Free');
        setLoading(false);
        return;
      }

      // Converter de lowercase para capitalizado
      let planoFinal: Plano = 'Free';
      
      if (planoStr === 'premium') planoFinal = 'Premium';
      else if (planoStr === 'gold') planoFinal = 'Gold';
      else if (planoStr === 'free') planoFinal = 'Free';
      
      setPlano(planoFinal);
    } catch (err) {
      console.error('Erro ao carregar plano:', err);
      setPlano('Free');
    } finally {
      setLoading(false);
    }
  };

  const permissoes = PERMISSOES_POR_PLANO[plano];
  const nomePlano = NOMES_PLANOS[plano];
  const coresPlano = CORES_PLANOS[plano];

  const possuiPermissao = (recurso: keyof Permissoes): boolean => {
    return permissoes[recurso] as boolean;
  };

  const verificarLimite = (
    quantidade: number,
    recurso: 'limiteJogadores'
  ): { permitido: boolean; limite: number | null } => {
    const limite = permissoes[recurso] as number | null;
    
    if (limite === null) {
      return { permitido: true, limite: null }; // Ilimitado
    }
    
    return {
      permitido: quantidade <= limite,
      limite,
    };
  };

  return {
    plano,
    permissoes,
    nomePlano,
    coresPlano,
    loading,
    possuiPermissao,
    verificarLimite,
  };
}
