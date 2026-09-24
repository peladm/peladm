'use client';

import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { supabase, validarSenhaPelada } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';
import { buscar_pelada_id } from '../../lib/credenciais';
import {
  PontuacaoEstatisticas,
  PONTUACAO_PADRAO,
  OPCOES_PONTUACAO,
  carregarPontuacaoEstatisticasLocal,
  salvarPontuacaoEstatisticasLocal,
  montarCamposPontuacaoParaRegras,
  extrairPontuacaoDeRegras,
  normalizarPontuacaoEstatisticas,
} from '../../lib/pontuacaoEstatisticas';

const REGRAS_PADRAO: Regras = {
  jogadores_por_time: 5,
  modelo_sorteio: 'equilibrado',
  duracao: 10,
  fila_automatizada: true,
  vitorias_consecutivas: 0,
  prioridade_retorno: 'prioridade',
  regra_empate: 'ambos_saem',
  regra_apos_empate: 'desempate_decide',
  empate_conta_vitoria: false,
  tipo_fila: 'modo_partida',
  cores_coletes: ['#000000', '#10b981']
};

interface Regras {
  jogadores_por_time: number;
  modelo_sorteio: 'equilibrado' | 'aleatorio';
  duracao: number;
  fila_automatizada: boolean;
  vitorias_consecutivas: number;
  prioridade_retorno: 'prioridade' | 'sem_prioridade' | 'mesclar' | 'perdedor_continua';
  regra_empate: 'ambos_saem' | 'desempate';
  regra_apos_empate: 'desempate_decide' | 'mesclar_times';
  empate_conta_vitoria: boolean;
  tipo_fila: 'modo_partida' | 'modo_prancheta';
  cores_coletes: string[];
}

export default function RegrasPage() {
  const { possuiPermissao } = usePermissions();
  
  const [regras, setRegras] = useState<Regras>(REGRAS_PADRAO);
  const mostrarAbaEstatisticas = regras.tipo_fila === 'modo_partida';
  const [abaAtiva, setAbaAtiva] = useState<'jogo' | 'regras' | 'estatisticas'>('jogo');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSenhaModal, setShowSenhaModal] = useState(false);
  const [senhaDigitada, setSenhaDigitada] = useState('');
  const [sessaoAtiva, setSessaoAtiva] = useState(false);
  const [pontuacaoEstatisticas, setPontuacaoEstatisticas] = useState<PontuacaoEstatisticas>(PONTUACAO_PADRAO);

  useEffect(() => {
    carregarRegras();
    verificarSessaoAtiva();
  }, []);

  useEffect(() => {
    if (abaAtiva === 'estatisticas' && !mostrarAbaEstatisticas) {
      setAbaAtiva('jogo');
    }
  }, [abaAtiva, mostrarAbaEstatisticas]);

  const carregarRegras = async () => {
    try {
      const peladaId = buscar_pelada_id();
      
      if (!peladaId) {
        console.log('⚠️ Usuário não logado, usando configurações padrão');
        return;
      }
      
      console.log('🔍 Carregando regras (cache local → master)...');
      console.log('🆔 Pelada ID:', peladaId);

      // Pré-carregar rapidamente do cache local
      setPontuacaoEstatisticas(carregarPontuacaoEstatisticasLocal(peladaId));

      // 1) Cache local primeiro para renderização rápida
      const regrasLocal = localStorage.getItem(`regras_${peladaId}`);
      if (regrasLocal) {
        const regrasCarregadas = JSON.parse(regrasLocal);
        setRegras({
          jogadores_por_time: regrasCarregadas.jogadores_por_time || REGRAS_PADRAO.jogadores_por_time,
          modelo_sorteio: regrasCarregadas.modelo_sorteio || REGRAS_PADRAO.modelo_sorteio,
          duracao: regrasCarregadas.duracao || REGRAS_PADRAO.duracao,        fila_automatizada: regrasCarregadas.fila_automatizada !== undefined ? regrasCarregadas.fila_automatizada : REGRAS_PADRAO.fila_automatizada,          vitorias_consecutivas: regrasCarregadas.vitorias_consecutivas || REGRAS_PADRAO.vitorias_consecutivas,
          prioridade_retorno: regrasCarregadas.prioridade_retorno || REGRAS_PADRAO.prioridade_retorno,
          regra_empate: regrasCarregadas.regra_empate || REGRAS_PADRAO.regra_empate,
          regra_apos_empate: regrasCarregadas.regra_apos_empate || REGRAS_PADRAO.regra_apos_empate,
          empate_conta_vitoria: regrasCarregadas.empate_conta_vitoria || REGRAS_PADRAO.empate_conta_vitoria,
          tipo_fila: regrasCarregadas.tipo_fila || REGRAS_PADRAO.tipo_fila,
          cores_coletes: regrasCarregadas.cores_coletes || REGRAS_PADRAO.cores_coletes
        });
        console.log('✅ Regras carregadas do CACHE LOCAL (renderização rápida)');
      }

      // 2) Sincronizar com Supabase MASTER e atualizar cache local
      console.log('☁️ Sincronizando com Supabase MASTER...');
      const { data: regrasMaster, error } = await supabase
        .from('regras')
        .select('*')
        .eq('pelada_id', peladaId)
        .maybeSingle();

      if (error) {
        console.warn('⚠️ Erro ao sincronizar do master, mantendo cache local:', error.message);
        return;
      }

      if (regrasMaster) {
        const regrasSincronizadas: Regras = {
          jogadores_por_time: regrasMaster.jogadores_por_time || REGRAS_PADRAO.jogadores_por_time,
          modelo_sorteio: regrasMaster.modelo_sorteio || REGRAS_PADRAO.modelo_sorteio,
          duracao: regrasMaster.duracao || REGRAS_PADRAO.duracao,
          fila_automatizada: regrasMaster.fila_automatizada !== undefined ? regrasMaster.fila_automatizada : REGRAS_PADRAO.fila_automatizada,
          vitorias_consecutivas: regrasMaster.vitorias_consecutivas || REGRAS_PADRAO.vitorias_consecutivas,
          prioridade_retorno: regrasMaster.prioridade_retorno || REGRAS_PADRAO.prioridade_retorno,
          regra_empate: regrasMaster.regra_empate || REGRAS_PADRAO.regra_empate,
          regra_apos_empate: regrasMaster.regra_apos_empate || REGRAS_PADRAO.regra_apos_empate,
          empate_conta_vitoria: regrasMaster.empate_conta_vitoria || REGRAS_PADRAO.empate_conta_vitoria,
          tipo_fila: regrasMaster.tipo_fila || REGRAS_PADRAO.tipo_fila,
          cores_coletes: regrasMaster.cores_coletes || REGRAS_PADRAO.cores_coletes
        };

        setRegras(regrasSincronizadas);
        localStorage.setItem(`regras_${peladaId}`, JSON.stringify(regrasSincronizadas));
        setPontuacaoEstatisticas(extrairPontuacaoDeRegras(regrasMaster as Record<string, unknown>));
        salvarPontuacaoEstatisticasLocal(peladaId, extrairPontuacaoDeRegras(regrasMaster as Record<string, unknown>));
        console.log('✅ Regras sincronizadas do MASTER e cache atualizado');
      }
      
    } catch (error) {
      console.error('💥 Erro ao carregar regras:', error);
    }
  };

  const verificarSessaoAtiva = async () => {
    try {
      const peladaId = buscar_pelada_id();
      if (!peladaId) return;

      const { data: sessao } = await supabase
        .from('sessoes')
        .select('id')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .single();

      setSessaoAtiva(!!sessao);
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
      setSessaoAtiva(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar se há sessão ativa
    if (sessaoAtiva) {
      setMessage('❌ Não é possível alterar regras com uma fila ativa!');
      setTimeout(() => setMessage(''), 4000);
      return;
    }
    
    // Validar jogadores por time
    if (typeof regras.jogadores_por_time !== 'number' || regras.jogadores_por_time < 3 || regras.jogadores_por_time > 11) {
      setMessage('❌ Jogadores por Time deve ser entre 3 e 11');
      setTimeout(() => setMessage(''), 4000);
      return;
    }
    
    // Abrir modal de confirmação
    setShowConfirmModal(true);
  };
  
  const abrirModalSenha = () => {
    setShowConfirmModal(false);
    setShowSenhaModal(true);
    setSenhaDigitada('');
  };

  const confirmarSalvamento = async () => {
    setShowSenhaModal(false);
    setIsLoading(true);
    setMessage('');

    // Validar senha usando função centralizada
    const senhaValida = await validarSenhaPelada(senhaDigitada);
    
    if (!senhaValida) {
      setMessage('❌ Senha incorreta!');
      setTimeout(() => setMessage(''), 3000);
      setIsLoading(false);
      return;
    }

    console.log('🚀 Salvando regras...');
    console.log('📋 Dados a serem salvos:', regras);

    try {
      const peladaId = buscar_pelada_id();
      
      if (!peladaId) {
        throw new Error('Usuário não encontrado');
      }

      console.log('☁️ Salvando regras no MASTER + cache local...');
      
      // ⚠️ Se modo MANUAL (fila_automatizada: false), zerar colunas de automação
      const dadosRegrasBase = {
        pelada_id: peladaId,
        jogadores_por_time: regras.jogadores_por_time,
        modelo_sorteio: regras.modelo_sorteio,
        tipo_fila: regras.tipo_fila,
        duracao: regras.duracao,
        fila_automatizada: regras.fila_automatizada,
        // Se modo MANUAL, zerar estas colunas para evitar conflitos
        vitorias_consecutivas: regras.fila_automatizada ? regras.vitorias_consecutivas : 0,
        prioridade_retorno: regras.fila_automatizada ? regras.prioridade_retorno : 'prioridade',
        regra_empate: regras.regra_empate,
        regra_apos_empate: regras.regra_apos_empate,
        empate_conta_vitoria: false,
        cores_coletes: regras.cores_coletes
      };
      const dadosRegras = {
        ...dadosRegrasBase,
        ...montarCamposPontuacaoParaRegras(pontuacaoEstatisticas),
      };
      
      // Log de info se zerou valores por modo manual
      if (!regras.fila_automatizada) {
        console.log('🎮 MODO MANUAL DETECTADO - zerando colunas de automação');
        console.log('   ❌ vitorias_consecutivas: foi ' + regras.vitorias_consecutivas + ' → agora 0');
        console.log('   ❌ empate_conta_vitoria: foi ' + regras.empate_conta_vitoria + ' → agora false');
      }
      
      // 1. Salvar no Supabase MASTER
      console.log('☁️ 1️⃣ Salvando no SUPABASE MASTER...');
      let { error: masterError } = await supabase
        .from('regras')
        .upsert(dadosRegras, { onConflict: 'pelada_id' });

      // Compatibilidade: se as novas colunas ainda nao existirem no banco, salva sem elas.
      if (masterError && /column .* does not exist/i.test(masterError.message)) {
        const fallback = await supabase
          .from('regras')
          .upsert(dadosRegrasBase, { onConflict: 'pelada_id' });
        masterError = fallback.error;
      }
      
      if (masterError) {
        throw new Error(`Master: ${masterError.message}`);
      }
      console.log('✅ Salvo no MASTER');

      // 2. Salvar no localStorage (cache local)
      console.log('💾 2️⃣ Salvando no localStorage...');
      localStorage.setItem(`regras_${peladaId}`, JSON.stringify(regras));
      salvarPontuacaoEstatisticasLocal(peladaId, normalizarPontuacaoEstatisticas(pontuacaoEstatisticas));
      console.log('✅ Salvo no localStorage');

      console.log('✅ Regras salvas no MASTER + cache local');
      setMessage('✅ Regras salvas no Master e cache local!');
      setTimeout(() => setMessage(''), 3000);
      
    } catch (error: any) {
      console.error('💥 Erro ao salvar regras:', error);
      setMessage(`❌ Erro ao salvar regras: ${error.message || 'Erro desconhecido'}`);
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelarSalvamento = () => {
    setShowConfirmModal(false);
    setMessage('❌ Operação cancelada pelo usuário');
    setTimeout(() => setMessage(''), 3000);
  };

  const resetarPadrao = () => {
    setRegras({
      jogadores_por_time: 5,
      modelo_sorteio: 'equilibrado',
      duracao: 10,
      fila_automatizada: true,
      vitorias_consecutivas: 0,
      prioridade_retorno: 'prioridade',
      regra_empate: 'ambos_saem',
      regra_apos_empate: 'desempate_decide',
      empate_conta_vitoria: false,
      tipo_fila: 'modo_partida',
      cores_coletes: ['#000000', '#10b981']
    });
    setPontuacaoEstatisticas(PONTUACAO_PADRAO);
    setMessage('🔄 Configurações restauradas para o padrão');
    setTimeout(() => setMessage(''), 3000);
  };

  const selecionarPontuacao = (campo: keyof PontuacaoEstatisticas, valor: number) => {
    setPontuacaoEstatisticas((prev) => ({ ...prev, [campo]: valor }));
  };

  const formatarOpcaoPontuacao = (valor: number): string => {
    const valorStr = Number.isInteger(valor) ? `${valor}` : valor.toString();
    return valorStr.replace('.', ',');
  };

  const renderLinhaOpcoesPontuacao = (
    titulo: string,
    campo: keyof PontuacaoEstatisticas,
    opcoes: number[]
  ) => (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-2">{titulo}</label>
      <div className="grid grid-cols-5 gap-2">
        {opcoes.map((valor) => (
          <button
            key={`${campo}-${valor}`}
            type="button"
            onClick={() => selecionarPontuacao(campo, valor)}
            className={`w-full py-2 rounded-lg text-xs font-semibold border transition-all ${
              pontuacaoEstatisticas[campo] === valor
                ? 'bg-emerald-600 text-white border-emerald-600 shadow'
                : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
            }`}
          >
            {formatarOpcaoPontuacao(valor)}
          </button>
        ))}
      </div>
    </div>
  );

  const handleEmpateVitoria = (valor: boolean) => {
    if (regras.fila_automatizada && regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0) {
      setRegras({ ...regras, empate_conta_vitoria: valor });
    }
  };

  const handleRegraAposEmpate = (valor: 'desempate_decide' | 'mesclar_times') => {
    if (regras.fila_automatizada && regras.regra_empate === 'ambos_saem') {
      setRegras({ ...regras, regra_apos_empate: valor });
    }
  };



  return (
    <Layout title="Regras">
      <div className="space-y-4">
        {/* Formulário de Configurações */}
        <section>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-sm py-2">
              <div className={`grid gap-2 ${mostrarAbaEstatisticas ? 'grid-cols-3' : 'grid-cols-2'}`}>
                <button
                  type="button"
                  onClick={() => setAbaAtiva('jogo')}
                  className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${
                    abaAtiva === 'jogo'
                      ? 'bg-blue-600 text-white border-blue-700 shadow'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  JOGO
                </button>
                <button
                  type="button"
                  onClick={() => setAbaAtiva('regras')}
                  className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${
                    abaAtiva === 'regras'
                      ? 'bg-blue-600 text-white border-blue-700 shadow'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  REGRAS
                </button>
                {mostrarAbaEstatisticas && (
                  <button
                    type="button"
                    onClick={() => setAbaAtiva('estatisticas')}
                    className={`py-2.5 rounded-lg text-xs font-bold border transition-all ${
                      abaAtiva === 'estatisticas'
                        ? 'bg-blue-600 text-white border-blue-700 shadow'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    ESTATISTICAS
                  </button>
                )}
              </div>
            </div>

            {abaAtiva === 'jogo' && (
              <>
              
              {/* Jogadores por Time */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <label className="block text-sm font-bold text-gray-800 mb-4">
                  ⚽ Jogadores por Time (sem o goleiro)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="3"
                    max="11"
                    value={regras.jogadores_por_time}
                    onChange={(e) => {
                      const valor = e.target.value === '' ? '' : parseInt(e.target.value);
                      setRegras({ ...regras, jogadores_por_time: valor as any });
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const atual = typeof regras.jogadores_por_time === 'number' ? regras.jogadores_por_time : REGRAS_PADRAO.jogadores_por_time;
                        setRegras({ ...regras, jogadores_por_time: Math.min(11, atual + 1) });
                      }}
                      className="h-6 w-7 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 text-xs font-bold"
                      aria-label="Aumentar jogadores por time"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const atual = typeof regras.jogadores_por_time === 'number' ? regras.jogadores_por_time : REGRAS_PADRAO.jogadores_por_time;
                        setRegras({ ...regras, jogadores_por_time: Math.max(3, atual - 1) });
                      }}
                      className="h-6 w-7 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 text-xs font-bold"
                      aria-label="Diminuir jogadores por time"
                    >
                      ▼
                    </button>
                  </div>
                  <span className="text-gray-600 text-sm font-medium">jogadores</span>
                </div>
                {typeof regras.jogadores_por_time === 'number' && (regras.jogadores_por_time < 3 || regras.jogadores_por_time > 11) && (
                  <p className="text-red-500 text-xs mt-2">Deve ser entre 3 e 11 jogadores</p>
                )}
              </div>

              {/* Duração da Partida */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <label className="block text-sm font-bold text-gray-800 mb-4">
                  ⏱️ Duração da Partida
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="90"
                    value={regras.duracao}
                    onChange={(e) => setRegras({ ...regras, duracao: parseInt(e.target.value) })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const atual = Number.isFinite(regras.duracao) ? regras.duracao : REGRAS_PADRAO.duracao;
                        setRegras({ ...regras, duracao: Math.min(90, atual + 1) });
                      }}
                      className="h-6 w-7 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 text-xs font-bold"
                      aria-label="Aumentar duração"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const atual = Number.isFinite(regras.duracao) ? regras.duracao : REGRAS_PADRAO.duracao;
                        setRegras({ ...regras, duracao: Math.max(5, atual - 1) });
                      }}
                      className="h-6 w-7 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 text-xs font-bold"
                      aria-label="Diminuir duração"
                    >
                      ▼
                    </button>
                  </div>
                  <span className="text-gray-600 text-sm font-medium">minutos</span>
                </div>
              </div>

              {/* Modelo de Sorteio */}
              <div className="bg-gray-50 p-4 rounded-lg border relative">
                {/* Tarja Gold */}
                {!possuiPermissao('sorteioEquilibrado') && (
                  <div className="absolute top-2 right-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                    <span>⭐</span>
                    <span>Acesso</span>
                  </div>
                )}

                <label className="block text-sm font-bold text-gray-800 mb-2">
                  🎲 Modelo de Sorteio
                </label>
                {!possuiPermissao('sorteioEquilibrado') && (
                  <div className="mb-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    🔒 <strong>Sorteio equilibrado indisponível para este acesso no momento.</strong>
                  </div>
                )}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (possuiPermissao('sorteioEquilibrado')) {
                        setRegras({ ...regras, modelo_sorteio: 'equilibrado' });
                      }
                    }}
                    disabled={!possuiPermissao('sorteioEquilibrado')}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all relative ${
                      regras.modelo_sorteio === 'equilibrado'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : !possuiPermissao('sorteioEquilibrado')
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {!possuiPermissao('sorteioEquilibrado') && (
                      <span className="absolute top-2 right-2">🔒</span>
                    )}
                    Equilibrado, Considera Nível Jogador
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegras({ ...regras, modelo_sorteio: 'aleatorio' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      regras.modelo_sorteio === 'aleatorio'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Aleatório, não considera nível
                  </button>
                </div>
              </div>

              {/* Tipo de Fila (Modo de Partida) */}
              <div className="bg-gray-50 p-4 rounded-lg border relative">
                {/* Tarja Premium */}
                {!possuiPermissao('usarPaginaPartida') && (
                  <div className="absolute top-2 right-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                    <span>👑</span>
                    <span>Acesso</span>
                  </div>
                )}

                <label className="block text-sm font-bold text-gray-800 mb-2">
                  ⚽ Contabilizar estatísticas? (gols, assistências etc)
                </label>
                {!possuiPermissao('usarModoPartida') && (
                  <div className="mb-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-1">
                    👑 <strong>Modo Partida indisponível para este acesso no momento.</strong>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (possuiPermissao('usarModoPartida')) {
                        setRegras({ ...regras, tipo_fila: 'modo_partida' });
                      } else {
                        alert('👑 Modo Partida indisponível para este acesso no momento.');
                      }
                    }}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all relative ${
                      regras.tipo_fila === 'modo_partida'
                        ? 'bg-purple-500 text-white shadow-lg'
                        : possuiPermissao('usarModoPartida')
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60'
                    }`}
                  >
                    {!possuiPermissao('usarModoPartida') && (
                      <span className="absolute top-2 right-2 text-base">👑</span>
                    )}
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegras({ ...regras, tipo_fila: 'modo_prancheta' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      regras.tipo_fila === 'modo_prancheta'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Não
                  </button>
                </div>
              </div>

              {/* Cores dos Coletes */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <label className="block text-sm font-bold text-gray-800 mb-1">
                  🎽 Coletes / Cores dos Times
                </label>
                <p className="text-xs text-gray-500 mb-4">
                  Selecione as cores dos coletes que você tem. Apenas essas aparecerao na tela da partida.
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { hex: '#dc3545', nome: 'Vermelho' },
                    { hex: '#000000', nome: 'Preto' },
                    { hex: '#FFFFFF', nome: 'Branco' },
                    { hex: '#fbbf24', nome: 'Amarelo' },
                    { hex: '#3b82f6', nome: 'Azul' },
                    { hex: '#10b981', nome: 'Verde' },
                    { hex: '#f97316', nome: 'Laranja' },
                    { hex: '#ec4899', nome: 'Rosa' },
                    { hex: '#8b5cf6', nome: 'Roxo' },
                    { hex: '#6b7280', nome: 'Cinza' },
                  ].map(({ hex, nome }) => {
                    const selecionado = (regras.cores_coletes ?? []).includes(hex);
                    return (
                      <button
                        key={hex}
                        type="button"
                        title={nome}
                        onClick={() => {
                          const novas = selecionado
                            ? regras.cores_coletes.filter(c => c !== hex)
                            : [...regras.cores_coletes, hex];
                          if (novas.length === 0) return;
                          setRegras({ ...regras, cores_coletes: novas });
                        }}
                        className={`relative w-full aspect-square rounded-lg border-2 transition-all ${
                          selecionado ? 'border-blue-500 scale-105 shadow-md' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: hex }}
                      >
                        {selecionado && (
                          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold"
                            style={{ color: hex === '#FFFFFF' || hex === '#fbbf24' ? '#374151' : 'white', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {regras.cores_coletes.length < 2 && (
                  <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    ⚠️ Selecione ao menos 2 cores (uma para cada time).
                  </p>
                )}
              </div>

              </>
            )}

              {abaAtiva === 'regras' && (
                <>
              {/* NOVA SEÇÃO: Deseja automatizar o andamento da fila? */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border-2 border-blue-300 shadow-sm">
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  DESEJA AUTOMATIZAR O ANDAMENTO DA FILA?
                </label>
                <div className="text-xs text-gray-600 mb-4 space-y-2">
                  <p>
                    Defina se a gestão da fila/prancheta será <strong>Automatizada</strong> ou <strong>Manual</strong> ao fim de cada partida.
                  </p>
                  <p>
                    <strong>Automatizado:</strong> aplica as regras configuradas abaixo automaticamente.
                  </p>
                  <p>
                    <strong>Manual:</strong> você confirma e ajusta cada andamento. Recomendado quando sua pelada não se encaixa bem nas regras predefinidas.
                  </p>
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setRegras({ ...regras, fila_automatizada: true })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.fila_automatizada
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Automatizado
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegras({ ...regras, fila_automatizada: false, vitorias_consecutivas: 0 })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      !regras.fila_automatizada
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              {/* Vitórias Consecutivas - Habilitada apenas se fila_automatizada = true */}
              <div className={`bg-gray-50 p-4 rounded-lg border transition-all ${!regras.fila_automatizada ? 'opacity-50' : ''}`}>
                <label className={`block text-sm font-bold mb-2 ${!regras.fila_automatizada ? 'text-gray-500' : 'text-gray-800'}`}>
                  🏆 Vitórias Consecutivas?
                </label>
                <p className={`text-xs mb-4 ${!regras.fila_automatizada ? 'text-gray-500' : 'text-gray-600'}`}>
                  Existe na pelada, limite para vitórias seguidas?
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={!regras.fila_automatizada}
                    onClick={() => {
                      if (regras.fila_automatizada) {
                        setRegras({ ...regras, vitorias_consecutivas: 0 });
                      }
                    }}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                      regras.vitorias_consecutivas === 0
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${!regras.fila_automatizada ? 'cursor-not-allowed' : ''}`}
                  >
                    Não - Sem limite de vitórias
                  </button>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      disabled={!regras.fila_automatizada}
                      placeholder="Digite de 1 a 10"
                      value={regras.vitorias_consecutivas === 0 ? '' : regras.vitorias_consecutivas}
                      onChange={(e) => {
                        if (regras.fila_automatizada && e.target.value) {
                          const valor = parseInt(e.target.value);
                          if (valor >= 1 && valor <= 10) {
                            setRegras({ ...regras, vitorias_consecutivas: valor });
                          }
                        }
                      }}
                      className={`flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm ${
                        !regras.fila_automatizada ? 'bg-gray-200 cursor-not-allowed' : ''
                      }`}
                    />
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={!regras.fila_automatizada}
                        onClick={() => {
                          if (!regras.fila_automatizada) return;
                          const atual = regras.vitorias_consecutivas === 0 ? 1 : regras.vitorias_consecutivas;
                          setRegras({ ...regras, vitorias_consecutivas: Math.min(10, atual + 1) });
                        }}
                        className={`h-6 w-7 rounded border border-gray-300 text-xs font-bold ${
                          !regras.fila_automatizada
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                        aria-label="Aumentar vitórias consecutivas"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={!regras.fila_automatizada}
                        onClick={() => {
                          if (!regras.fila_automatizada) return;
                          const atual = regras.vitorias_consecutivas === 0 ? 1 : regras.vitorias_consecutivas;
                          setRegras({ ...regras, vitorias_consecutivas: Math.max(1, atual - 1) });
                        }}
                        className={`h-6 w-7 rounded border border-gray-300 text-xs font-bold ${
                          !regras.fila_automatizada
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-gray-700 hover:bg-gray-100'
                        }`}
                        aria-label="Diminuir vitórias consecutivas"
                      >
                        ▼
                      </button>
                    </div>
                    <span className="text-gray-600 text-sm font-medium">vitórias</span>
                  </div>
                </div>
              </div>

              {/* Prioridade de Retorno - Habilitada apenas se fila_automatizada = true E vitorias_consecutivas > 0 */}
              <div className={`bg-gray-50 p-4 rounded-lg border transition-all ${!regras.fila_automatizada || regras.vitorias_consecutivas === 0 ? 'opacity-50' : ''}`}>
                <label className={`block text-sm font-bold mb-2 ${!regras.fila_automatizada || regras.vitorias_consecutivas === 0 ? 'text-gray-500' : 'text-gray-800'}`}>
                  🔄 Regra após Vitórias Consecutivas
                </label>
                <p className={`text-xs mb-4 ${!regras.fila_automatizada || regras.vitorias_consecutivas === 0 ? 'text-gray-500' : 'text-gray-600'}`}>
                  Como a fila deve agir, após atingir o limite de vitórias consecutivas
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={!regras.fila_automatizada || regras.vitorias_consecutivas === 0}
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'prioridade' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'prioridade'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${!regras.fila_automatizada || regras.vitorias_consecutivas === 0 ? 'cursor-not-allowed' : ''}`}
                  >
                    Ambos saem e o VENCEDOR retorna 1º a fila
                  </button>
                  <button
                    type="button"
                    disabled={!regras.fila_automatizada || regras.vitorias_consecutivas === 0}
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'sem_prioridade' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'sem_prioridade'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${!regras.fila_automatizada || regras.vitorias_consecutivas === 0 ? 'cursor-not-allowed' : ''}`}
                  >
                    Ambos saem e o PERDEDOR retorna 1º a fila
                  </button>
                  <button
                    type="button"
                    disabled={!regras.fila_automatizada || regras.vitorias_consecutivas === 0}
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'mesclar' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'mesclar'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${!regras.fila_automatizada || regras.vitorias_consecutivas === 0 ? 'cursor-not-allowed' : ''}`}
                  >
                    Ambos saem e os times são mesclados no retorno
                  </button>
                  <button
                    type="button"
                    disabled={!regras.fila_automatizada || regras.vitorias_consecutivas === 0}
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'perdedor_continua' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'perdedor_continua'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${!regras.fila_automatizada || regras.vitorias_consecutivas === 0 ? 'cursor-not-allowed' : ''}`}
                  >
                    Vencedor sai e o PERDEDOR continua jogando
                  </button>
                </div>
              </div>

              {/* Regra de Empate - Habilitada apenas se fila_automatizada = true */}
              <div className={`bg-gray-50 p-4 rounded-lg border transition-all ${!regras.fila_automatizada ? 'opacity-50' : ''}`}>
                <label className={`block text-sm font-bold mb-4 ${!regras.fila_automatizada ? 'text-gray-500' : 'text-gray-800'}`}>
                  ⚖️ Como funciona o empate?
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={!regras.fila_automatizada}
                    onClick={() => setRegras({ ...regras, regra_empate: 'ambos_saem' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.regra_empate === 'ambos_saem'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${!regras.fila_automatizada ? 'cursor-not-allowed' : ''}`}
                  >
                    AMBOS os times saem
                  </button>
                  <button
                    type="button"
                    disabled={!regras.fila_automatizada}
                    onClick={() => setRegras({ ...regras, regra_empate: 'desempate' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.regra_empate === 'desempate'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${!regras.fila_automatizada ? 'cursor-not-allowed' : ''}`}
                  >
                    DESEMPATE no final da partida
                  </button>
                </div>
              </div>

              {/* Regra Após Empate - Habilitada apenas se fila_automatizada = true E regra_empate = 'ambos_saem' */}
              <div className={`p-4 rounded-lg border transition-all ${
                regras.fila_automatizada && regras.regra_empate === 'ambos_saem' 
                  ? 'bg-gray-50 border-gray-200' 
                  : 'bg-gray-50 border-gray-200 opacity-50'
              }`}>
                <label className={`block text-sm font-bold mb-4 ${
                  regras.fila_automatizada && regras.regra_empate === 'ambos_saem' 
                    ? 'text-gray-800' 
                    : 'text-gray-500'
                }`}>
                  🔄 Regra após empate onde ambos saem
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={!regras.fila_automatizada || regras.regra_empate !== 'ambos_saem'}
                    onClick={() => handleRegraAposEmpate('desempate_decide')}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      !regras.fila_automatizada || regras.regra_empate !== 'ambos_saem'
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : regras.regra_apos_empate === 'desempate_decide'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Desempate decide retorno a fila
                  </button>
                  <button
                    type="button"
                    disabled={!regras.fila_automatizada || regras.regra_empate !== 'ambos_saem'}
                    onClick={() => handleRegraAposEmpate('mesclar_times')}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      !regras.fila_automatizada || regras.regra_empate !== 'ambos_saem'
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : regras.regra_apos_empate === 'mesclar_times'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Mesclar times no retorno
                  </button>
                </div>
              </div>

              {/* Empate conta como vitória? - Habilitada apenas se fila_automatizada = true E regra_empate = 'desempate' E vitorias_consecutivas > 0 */}
              {regras.fila_automatizada && regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0 && (
              <div className="p-4 rounded-lg border bg-gray-50 border-gray-200 transition-all">
                <label className="block text-sm font-bold mb-4 text-gray-800">
                  🏆 Empate conta como vitória para as vitórias consecutivas?
                </label>
                <p className="text-xs mb-4 text-gray-600">
                  Esta opção só funciona quando: Automático ✓ + Desempate ✓ + Vitórias Consecutivas &gt; 0
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => handleEmpateVitoria(true)}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.empate_conta_vitoria
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    SIM - Empate conta como vitória
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEmpateVitoria(false)}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      !regras.empate_conta_vitoria
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    NÃO - Empate não conta como vitória
                  </button>
                </div>
              </div>
              )}

                </>
              )}

              {/* Pontuação para Estatísticas (apenas Modo Partida) */}
              {abaAtiva === 'estatisticas' && mostrarAbaEstatisticas && (
                <div className="bg-gradient-to-r from-emerald-50 to-green-50 p-4 rounded-lg border-2 border-emerald-300 shadow-sm">
                  <label className="block text-sm font-bold text-gray-800 mb-1">
                    📊 Pontuação para Estatísticas
                  </label>
                  <p className="text-xs text-gray-600 mb-3">
                    Esta seção afeta somente os rankings e estatísticas (Classificação, Rei da Pelada e Bola Murcha).
                  </p>

                  <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                    💡 Os valores abaixo já vêm com sugestões pensadas para uma contabilização mais justa e equilibrada entre todos os jogadores.
                  </div>

                  <div className="space-y-3">
                    {renderLinhaOpcoesPontuacao('Vitória', 'vitoria', OPCOES_PONTUACAO.vitoria)}
                    {renderLinhaOpcoesPontuacao('Empate', 'empate', OPCOES_PONTUACAO.empate)}
                    {renderLinhaOpcoesPontuacao('Derrota', 'derrota', OPCOES_PONTUACAO.derrota)}
                    {renderLinhaOpcoesPontuacao('Gol Contra', 'golContra', OPCOES_PONTUACAO.golContra)}
                    {renderLinhaOpcoesPontuacao('Sem Sofrer Gol', 'cleanSheet', OPCOES_PONTUACAO.geral)}
                    {renderLinhaOpcoesPontuacao('Gol', 'gol', OPCOES_PONTUACAO.geral)}
                    {renderLinhaOpcoesPontuacao('Assistência', 'assistencia', OPCOES_PONTUACAO.geral)}
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetarPadrao}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span>🔄</span>
                  <span>Padrão</span>
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-sm font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span>💾</span>
                  <span>{isLoading ? 'Salvando...' : 'Salvar Regras'}</span>
                </button>
              </div>

          </form>

            {message && (
              <div className={`mt-4 p-3 rounded-lg ${message.includes('💾') || message.includes('🔄') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {message}
              </div>
            )}
        </section>

      </div>
      
      {/* Modal de Confirmação de Salvamento */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                Confirmar Alterações
              </h3>
              <p className="text-gray-600 mb-4">
                Alterar as regras da pelada irá impactar todas as funcionalidades do aplicativo.
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
                <h4 className="font-semibold text-yellow-800 mb-2">📋 Essas mudanças afetarão:</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Sistema de sorteio de times</li>
                  <li>• Mecânicas de fila e rotação</li>
                  <li>• Regras de empate e vitórias</li>
                  <li>• Duração das partidas</li>
                </ul>
              </div>
              
              <p className="text-sm text-red-600 mb-6 font-medium">
                ⚠️ Deseja realmente salvar essas alterações?
              </p>
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={cancelarSalvamento}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                >
                  🚫 Cancelar
                </button>
                <button
                  onClick={abrirModalSenha}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  ➡️ Continuar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Senha */}
      {showSenhaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="text-center">
              <div className="text-6xl mb-4">🔐</div>
              <h3 className="text-xl font-bold text-gray-800 mb-3">
                Autenticação Necessária
              </h3>
              <p className="text-gray-600 mb-6">
                Digite a senha da pelada para confirmar as alterações:
              </p>
              
              <input
                type="password"
                value={senhaDigitada}
                onChange={(e) => setSenhaDigitada(e.target.value)}
                placeholder="Digite a senha"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-6 text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && senhaDigitada.trim()) {
                    confirmarSalvamento();
                  }
                }}
              />
              
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => {
                    setShowSenhaModal(false);
                    setSenhaDigitada('');
                  }}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors duration-200"
                >
                  🚫 Cancelar
                </button>
                <button
                  onClick={confirmarSalvamento}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors duration-200"
                  disabled={!senhaDigitada.trim() || isLoading}
                >
                  {isLoading ? '🔄 Salvando...' : '💾 Salvar Regras'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}