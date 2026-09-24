import { useState, useEffect } from 'react';
import { Permissoes } from './permissoes';
import { buscar_pelada_id } from './credenciais';

interface UsePermissionsReturn {
  acesso: string;
  permissoes: Permissoes;
  nomeAcesso: string;
  coresAcesso: { bg: string; text: string; badge: string };
  loading: boolean;
  possuiPermissao: (recurso: keyof Permissoes) => boolean;
  verificarLimite: (quantidade: number, recurso: 'limiteJogadores') => { permitido: boolean; limite: number | null };
}

const CORES_ACESSO = {
  bg: 'bg-emerald-50',
  text: 'text-emerald-700',
  badge: 'bg-emerald-600',
};

const criarPermissoesPorAcesso = (
  acessoPeladaTradicional: boolean,
  acessoModoTorneio: boolean
): Permissoes => {
  const possuiAlgumAcesso = acessoPeladaTradicional || acessoModoTorneio;

  return {
    usarSupabase: true,
    bancoExclusivo: false,
    multiUsuario: true,
    cadastrarNivel: true,
    limiteJogadores: null,
    limitePartidas: null,
    limiteUsuarios: null,
    sorteioEquilibrado: possuiAlgumAcesso,
    sorteioManual: possuiAlgumAcesso,
    usarPaginaPartida: acessoPeladaTradicional,
    permitirSubstituicoes: possuiAlgumAcesso,
    usarCronometro: acessoPeladaTradicional,
    desfazerPartida: acessoPeladaTradicional,
    usarModoPartida: acessoPeladaTradicional,
    verEstatisticas: possuiAlgumAcesso,
    verResultados: possuiAlgumAcesso,
    exportarRelatorios: possuiAlgumAcesso,
    configurarVitoriasConsecutivas: possuiAlgumAcesso,
    configurarRotacao: possuiAlgumAcesso,
    configurarCores: possuiAlgumAcesso,
    compartilharWhatsApp: possuiAlgumAcesso,
    removerAnuncios: true,
    multipalasPeladas: true,
    deployAoEncerrar: possuiAlgumAcesso,
  };
};

export function usePermissions(): UsePermissionsReturn {
  const [acesso] = useState('acesso');
  const [nomeAcesso, setNomeAcesso] = useState('Acesso do cliente');
  const [permissoes, setPermissoes] = useState<Permissoes>(
    criarPermissoesPorAcesso(true, false)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarPermissoes();
  }, []);

  const carregarPermissoes = async () => {
    try {
      const peladaId = buscar_pelada_id();
      if (!peladaId) {
        setPermissoes(criarPermissoesPorAcesso(true, false));
        setNomeAcesso('Acesso padrão');
        return;
      }

      const response = await fetch('/api/auth/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pelada_id: peladaId }),
      });

      if (!response.ok) {
        setPermissoes(criarPermissoesPorAcesso(true, false));
        setNomeAcesso('Acesso padrão');
        return;
      }

      const data = await response.json();
      const acessoPeladaTradicional = data.acesso_pelada_tradicional !== false;
      const acessoModoTorneio = data.acesso_modo_torneio === true;

      setPermissoes(criarPermissoesPorAcesso(acessoPeladaTradicional, acessoModoTorneio));
      if (acessoPeladaTradicional && acessoModoTorneio) {
        setNomeAcesso('Tradicional e Torneio');
      } else if (acessoModoTorneio) {
        setNomeAcesso('Somente Torneio');
      } else if (acessoPeladaTradicional) {
        setNomeAcesso('Somente Tradicional');
      } else {
        setNomeAcesso('Sem acessos ativos');
      }
    } catch (err) {
      console.error('Erro ao carregar permissões por acesso:', err);
      setPermissoes(criarPermissoesPorAcesso(true, false));
      setNomeAcesso('Acesso padrão');
    } finally {
      setLoading(false);
    }
  };

  const coresAcesso = CORES_ACESSO;

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
    acesso,
    permissoes,
    nomeAcesso,
    coresAcesso,
    loading,
    possuiPermissao,
    verificarLimite,
  };
}
