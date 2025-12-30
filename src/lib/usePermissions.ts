import { useState, useEffect } from 'react';
import { supabase } from './supabase';
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
      const userData = localStorage.getItem('user');
      
      if (!userData) {
        setPlano('Free');
        setLoading(false);
        return;
      }

      const user = JSON.parse(userData);
      
      // Buscar plano do cliente no Supabase
      const { data: cliente, error } = await supabase
        .from('clientes')
        .select('plano')
        .eq('id', user.id)
        .single();

      if (error || !cliente) {
        setPlano('Free');
      } else {
        // Normalizar plano do banco (lowercase) para o formato TypeScript (capitalizado)
        const planoNormalizado = cliente.plano?.toLowerCase();
        let planoFinal: Plano = 'Free';
        
        if (planoNormalizado === 'premium') planoFinal = 'Premium';
        else if (planoNormalizado === 'gold') planoFinal = 'Gold';
        else if (planoNormalizado === 'free') planoFinal = 'Free';
        
        setPlano(planoFinal);
      }
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
