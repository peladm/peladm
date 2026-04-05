'use client';

import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { supabase, validarSenhaPelada } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';
import { buscar_pelada_id } from '../../lib/credenciais';
import { createClient } from '@supabase/supabase-js';

const BANCO_PRINCIPAL_URL = 'https://ewcswczqvelhlwpbraea.supabase.co';
const BANCO_PRINCIPAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks';

const REGRAS_PADRAO: Regras = {
  jogadores_por_time: 5,
  modelo_sorteio: 'equilibrado',
  duracao: 10,
  vitorias_consecutivas: 0,
  prioridade_retorno: 'prioridade',
  regra_empate: 'ambos_saem',
  regra_apos_empate: 'desempate_decide',
  empate_conta_vitoria: false,
  tipo_fila: 'modo_prancheta',
  cores_coletes: ['#dc3545', '#000000', '#FFFFFF', '#fbbf24', '#3b82f6', '#10b981']
};

interface Regras {
  jogadores_por_time: number;
  modelo_sorteio: 'equilibrado' | 'aleatorio';
  duracao: number;
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
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSenhaModal, setShowSenhaModal] = useState(false);
  const [senhaDigitada, setSenhaDigitada] = useState('');
  const [sessaoAtiva, setSessaoAtiva] = useState(false);

  useEffect(() => {
    carregarRegras();
    verificarSessaoAtiva();
  }, []);

  const carregarRegras = async () => {
    try {
      const peladaId = buscar_pelada_id();
      
      if (!peladaId) {
        console.log('⚠️ Usuário não logado, usando configurações padrão');
        return;
      }
      
      console.log('🔍 Carregando regras (master + cache local)...');
      console.log('🆔 Pelada ID:', peladaId);

      // 1) Cache local primeiro para renderização rápida
      const regrasLocal = localStorage.getItem(`regras_${peladaId}`);
      if (regrasLocal) {
        const regrasCarregadas = JSON.parse(regrasLocal);
        setRegras({
          jogadores_por_time: regrasCarregadas.jogadores_por_time || REGRAS_PADRAO.jogadores_por_time,
          modelo_sorteio: regrasCarregadas.modelo_sorteio || REGRAS_PADRAO.modelo_sorteio,
          duracao: regrasCarregadas.duracao || REGRAS_PADRAO.duracao,
          vitorias_consecutivas: regrasCarregadas.vitorias_consecutivas || REGRAS_PADRAO.vitorias_consecutivas,
          prioridade_retorno: regrasCarregadas.prioridade_retorno || REGRAS_PADRAO.prioridade_retorno,
          regra_empate: regrasCarregadas.regra_empate || REGRAS_PADRAO.regra_empate,
          regra_apos_empate: regrasCarregadas.regra_apos_empate || REGRAS_PADRAO.regra_apos_empate,
          empate_conta_vitoria: regrasCarregadas.empate_conta_vitoria || REGRAS_PADRAO.empate_conta_vitoria,
          tipo_fila: regrasCarregadas.tipo_fila || REGRAS_PADRAO.tipo_fila,
          cores_coletes: regrasCarregadas.cores_coletes || REGRAS_PADRAO.cores_coletes
        });
        console.log('✅ Regras carregadas do cache local (rápido)');
      }

      // 2) Sincronizar com master e atualizar cache local
      const supabasePrincipal = createClient(BANCO_PRINCIPAL_URL, BANCO_PRINCIPAL_KEY);
      const { data: regrasMaster, error } = await supabasePrincipal
        .from('regras')
        .select('jogadores_por_time, modelo_sorteio, duracao, vitorias_consecutivas, prioridade_retorno, regra_empate, regra_apos_empate, empate_conta_vitoria, tipo_fila, cores_coletes')
        .eq('pelada_id', peladaId)
        .maybeSingle();

      if (error) {
        console.warn('⚠️ Erro ao sincronizar regras do master, mantendo cache local:', error.message);
        return;
      }

      if (regrasMaster) {
        const regrasSincronizadas: Regras = {
          jogadores_por_time: regrasMaster.jogadores_por_time || REGRAS_PADRAO.jogadores_por_time,
          modelo_sorteio: regrasMaster.modelo_sorteio || REGRAS_PADRAO.modelo_sorteio,
          duracao: regrasMaster.duracao || REGRAS_PADRAO.duracao,
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
        console.log('✅ Regras sincronizadas do master e cache local atualizado');
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

      console.log('☁️ Salvando regras no Supabase master (todos os planos)...');
      const supabasePrincipal = createClient(BANCO_PRINCIPAL_URL, BANCO_PRINCIPAL_KEY);
      
      const dadosRegras = {
        pelada_id: peladaId,
        jogadores_por_time: regras.jogadores_por_time,
        modelo_sorteio: regras.modelo_sorteio,
        tipo_fila: regras.tipo_fila,
        duracao: regras.duracao,
        vitorias_consecutivas: regras.vitorias_consecutivas,
        prioridade_retorno: regras.prioridade_retorno,
        regra_empate: regras.regra_empate,
        regra_apos_empate: regras.regra_apos_empate,
        empate_conta_vitoria: regras.empate_conta_vitoria,
        cores_coletes: regras.cores_coletes
      };
      
      // Tentar atualizar (upsert usando pelada_id como chave)
      const { error: upsertError } = await supabasePrincipal
        .from('regras')
        .upsert(dadosRegras, { onConflict: 'pelada_id' });
      
      if (upsertError) {
        throw new Error(upsertError.message);
      }
      
      // Salvar também no localStorage (cache local)
      localStorage.setItem(`regras_${peladaId}`, JSON.stringify(regras));
      
      console.log('✅ Regras salvas no master e cache local');
      setMessage('💾 Regras salvas com sucesso!');
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
      vitorias_consecutivas: 0,
      prioridade_retorno: 'prioridade',
      regra_empate: 'ambos_saem',
      regra_apos_empate: 'desempate_decide',
      empate_conta_vitoria: false,
      tipo_fila: 'modo_prancheta',
      cores_coletes: ['#dc3545', '#000000', '#FFFFFF', '#fbbf24', '#3b82f6', '#10b981']
    });
    setMessage('🔄 Configurações restauradas para o padrão');
    setTimeout(() => setMessage(''), 3000);
  };

  const selecionarJogadores = (valor: number) => {
    setRegras({ ...regras, jogadores_por_time: valor });
  };



  return (
    <Layout title="Regras">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Formulário de Configurações */}
        <section>
          <div className="bg-gradient-to-b from-white to-gray-50 rounded-2xl p-6 border-2 border-gray-200 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              {/* Jogadores por Time */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <label className="block text-sm font-bold text-gray-800 mb-4">
                  ⚽ Jogadores por Time (sem o goleiro)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[4, 5, 6, 7].map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => selecionarJogadores(valor)}
                      className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                        regras.jogadores_por_time === valor
                          ? 'bg-blue-500 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {valor}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modelo de Sorteio */}
              <div className="bg-gray-50 p-4 rounded-lg border relative">
                {/* Tarja Gold */}
                {!possuiPermissao('sorteioEquilibrado') && (
                  <div className="absolute top-2 right-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                    <span>⭐</span>
                    <span>Gold</span>
                  </div>
                )}

                <label className="block text-sm font-bold text-gray-800 mb-2">
                  🎲 Modelo de Sorteio
                </label>
                {!possuiPermissao('sorteioEquilibrado') && (
                  <div className="mb-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                    🔒 <strong>Sorteio equilibrado disponível no plano Gold e Premium</strong>. Faça upgrade para desbloquear.
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
                    Padrões Equilibrados
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
                  <span className="text-gray-600 text-sm font-medium">minutos</span>
                </div>
              </div>

              {/* Vitórias Consecutivas */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  🏆 Vitórias Consecutivas?
                </label>
                <p className="text-xs text-gray-600 mb-4">
                  Existe na pelada, limite para vitórias seguidas?
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {['Não', 2, 3, 4].map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => {
                        setRegras({ ...regras, vitorias_consecutivas: valor === 'Não' ? 0 : valor as number });
                      }}
                      className={`py-3 px-4 rounded-lg text-sm font-medium transition-all ${
                        (valor === 'Não' && regras.vitorias_consecutivas === 0) || regras.vitorias_consecutivas === valor
                          ? 'bg-blue-500 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {valor}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prioridade de Retorno - Desabilitado se vitórias consecutivas = Não */}
              <div className={`bg-gray-50 p-4 rounded-lg border ${regras.vitorias_consecutivas === 0 ? 'opacity-50' : ''}`}>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  🔄 Regra após Vitórias Consecutivas
                </label>
                <p className="text-xs text-gray-600 mb-4">
                  Como a fila deve agir, após atingir o limite de vitórias consecutivas
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={regras.vitorias_consecutivas === 0}
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'prioridade' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'prioridade'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${regras.vitorias_consecutivas === 0 ? 'cursor-not-allowed' : ''}`}
                  >
                    Ambos saem e o VENCEDOR retorna 1º a fila
                  </button>
                  <button
                    type="button"
                    disabled={regras.vitorias_consecutivas === 0}
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'sem_prioridade' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'sem_prioridade'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${regras.vitorias_consecutivas === 0 ? 'cursor-not-allowed' : ''}`}
                  >
                    Ambos saem e o PERDEDOR retorna 1º a fila
                  </button>
                  <button
                    type="button"
                    disabled={regras.vitorias_consecutivas === 0}
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'mesclar' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'mesclar'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${regras.vitorias_consecutivas === 0 ? 'cursor-not-allowed' : ''}`}
                  >
                    Ambos saem e os times são mesclados no retorno
                  </button>
                  <button
                    type="button"
                    disabled={regras.vitorias_consecutivas === 0}
                    onClick={() => setRegras({ ...regras, prioridade_retorno: 'perdedor_continua' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.prioridade_retorno === 'perdedor_continua'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${regras.vitorias_consecutivas === 0 ? 'cursor-not-allowed' : ''}`}
                  >
                    Vencedor sai e o PERDEDOR continua jogando
                  </button>
                </div>
              </div>

              {/* Regra de Empate */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <label className="block text-sm font-bold text-gray-800 mb-4">
                  ⚖️ Como funciona o empate?
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setRegras({ ...regras, regra_empate: 'ambos_saem' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.regra_empate === 'ambos_saem'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    AMBOS os times saem
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegras({ ...regras, regra_empate: 'desempate' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.regra_empate === 'desempate'
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    DESEMPATE no final da partida
                  </button>
                </div>
              </div>

              {/* Empate conta como vitória? - Só aparece se desempate E vitórias consecutivas ativo */}
              <div className={`p-4 rounded-lg border transition-all ${
                regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0
                  ? 'bg-purple-50 border-purple-200' 
                  : 'bg-gray-50 border-gray-200 opacity-50'
              }`}>
                <label className={`block text-sm font-bold mb-4 ${
                  regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0
                    ? 'text-gray-800' 
                    : 'text-gray-500'
                }`}>
                  🏆 Empate conta como vitória para as vitórias consecutivas?
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={!(regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0)}
                    onClick={() => (regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0) && setRegras({ ...regras, empate_conta_vitoria: true })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.empate_conta_vitoria
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${!(regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0) ? 'cursor-not-allowed' : ''}`}
                  >
                    SIM - Empate conta como vitória
                  </button>
                  <button
                    type="button"
                    disabled={!(regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0)}
                    onClick={() => (regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0) && setRegras({ ...regras, empate_conta_vitoria: false })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      !regras.empate_conta_vitoria
                        ? 'bg-blue-500 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } ${!(regras.regra_empate === 'desempate' && regras.vitorias_consecutivas > 0) ? 'cursor-not-allowed' : ''}`}
                  >
                    NÃO - Empate não conta como vitória
                  </button>
                </div>
              </div>

              {/* Regra Após Empate */}
              <div className={`p-4 rounded-lg border transition-all ${
                regras.regra_empate === 'ambos_saem' 
                  ? 'bg-yellow-50 border-yellow-200' 
                  : 'bg-gray-50 border-gray-200 opacity-50'
              }`}>
                <label className={`block text-sm font-bold mb-4 ${
                  regras.regra_empate === 'ambos_saem' 
                    ? 'text-gray-800' 
                    : 'text-gray-500'
                }`}>
                  🔄 Regra após empate onde ambos saem
                </label>
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={regras.regra_empate !== 'ambos_saem'}
                    onClick={() => regras.regra_empate === 'ambos_saem' && setRegras({ ...regras, regra_apos_empate: 'desempate_decide' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.regra_empate !== 'ambos_saem'
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
                    disabled={regras.regra_empate !== 'ambos_saem'}
                    onClick={() => regras.regra_empate === 'ambos_saem' && setRegras({ ...regras, regra_apos_empate: 'mesclar_times' })}
                    className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-all text-left ${
                      regras.regra_empate !== 'ambos_saem'
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

              {/* Tipo de Fila */}
              <div className="bg-gray-50 p-4 rounded-lg border relative">
                {/* Tarja Premium */}
                {!possuiPermissao('usarPaginaPartida') && (
                  <div className="absolute top-2 right-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                    <span>👑</span>
                    <span>Premium</span>
                  </div>
                )}

                <label className="block text-sm font-bold text-gray-800 mb-2">
                  ⚽ Modo de Partida
                </label>
                {!possuiPermissao('usarModoPartida') && (
                  <div className="mb-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-1">
                    👑 <strong>Modo Partida exclusivo do plano Premium</strong>. Faça upgrade para desbloquear.
                  </div>
                )}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (possuiPermissao('usarModoPartida')) {
                        setRegras({ ...regras, tipo_fila: 'modo_partida' });
                      } else {
                        alert('👑 Modo Partida é exclusivo do plano Premium!\n\nFaça upgrade para ter acesso a estatísticas completas durante a partida.');
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
                    Modo Partida (com estatísticas)
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
                    Modo Prancheta (simplificado)
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
          </div>
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