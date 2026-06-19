'use client';

import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { supabase, validarSenhaPelada, getClienteSupabase } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';
import { buscar_pelada_id } from '../../lib/credenciais';
import { createClient } from '@supabase/supabase-js';

const BANCO_PRINCIPAL_URL = 'https://ewcswczqvelhlwpbraea.supabase.co';
const BANCO_PRINCIPAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks';

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
  tipo_fila: 'modo_prancheta',
  cores_coletes: ['#dc3545', '#000000', '#FFFFFF', '#fbbf24', '#3b82f6', '#10b981']
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
      
      console.log('🔍 Carregando regras (cache local → cliente → master)...');
      console.log('🆔 Pelada ID:', peladaId);

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

      // 2) Sincronizar com Supabase DO CLIENTE (dedicado)
      console.log('☁️ Sincronizando com Supabase DO CLIENTE...');
      const clienteDb = await getClienteSupabase(peladaId);
      const { data: regrasCliente, error: erroCliente } = await clienteDb
        .from('regras')
        .select('jogadores_por_time, modelo_sorteio, duracao, fila_automatizada, vitorias_consecutivas, prioridade_retorno, regra_empate, regra_apos_empate, empate_conta_vitoria, tipo_fila, modo_sincronizacao, cores_coletes')
        .eq('pelada_id', peladaId)
        .maybeSingle();

      if (erroCliente) {
        console.warn('⚠️ Erro ao sincronizar do cliente, tentando master:', erroCliente.message);
      } else if (regrasCliente) {
        const regrasSincronizadas: Regras = {
          jogadores_por_time: regrasCliente.jogadores_por_time || REGRAS_PADRAO.jogadores_por_time,
          modelo_sorteio: regrasCliente.modelo_sorteio || REGRAS_PADRAO.modelo_sorteio,
          duracao: regrasCliente.duracao || REGRAS_PADRAO.duracao,
          fila_automatizada: regrasCliente.fila_automatizada !== undefined ? regrasCliente.fila_automatizada : REGRAS_PADRAO.fila_automatizada,
          vitorias_consecutivas: regrasCliente.vitorias_consecutivas || REGRAS_PADRAO.vitorias_consecutivas,
          prioridade_retorno: regrasCliente.prioridade_retorno || REGRAS_PADRAO.prioridade_retorno,
          regra_empate: regrasCliente.regra_empate || REGRAS_PADRAO.regra_empate,
          regra_apos_empate: regrasCliente.regra_apos_empate || REGRAS_PADRAO.regra_apos_empate,
          empate_conta_vitoria: regrasCliente.empate_conta_vitoria || REGRAS_PADRAO.empate_conta_vitoria,
          tipo_fila: regrasCliente.tipo_fila || REGRAS_PADRAO.tipo_fila,
          cores_coletes: regrasCliente.cores_coletes || REGRAS_PADRAO.cores_coletes
        };
        setRegras(regrasSincronizadas);
        localStorage.setItem(`regras_${peladaId}`, JSON.stringify(regrasSincronizadas));
        console.log('✅ Regras sincronizadas do CLIENTE e cache atualizado');
        return;
      }

      // 3) Se cliente falhar, sincronizar com master e atualizar cache local
      console.log('☁️ Sincronizando com Supabase MASTER...');
      const supabasePrincipal = createClient(BANCO_PRINCIPAL_URL, BANCO_PRINCIPAL_KEY);
      const { data: regrasMaster, error } = await supabasePrincipal
        .from('regras')
        .select('jogadores_por_time, modelo_sorteio, duracao, fila_automatizada, vitorias_consecutivas, prioridade_retorno, regra_empate, regra_apos_empate, empate_conta_vitoria, tipo_fila, modo_sincronizacao, cores_coletes')
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

      console.log('☁️ Salvando regras nos 3 locais...');
      const supabasePrincipal = createClient(BANCO_PRINCIPAL_URL, BANCO_PRINCIPAL_KEY);
      
      // ⚠️ Se modo MANUAL (fila_automatizada: false), zerar colunas de automação
      const dadosRegras = {
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
      
      // Log de info se zerou valores por modo manual
      if (!regras.fila_automatizada) {
        console.log('🎮 MODO MANUAL DETECTADO - zerando colunas de automação');
        console.log('   ❌ vitorias_consecutivas: foi ' + regras.vitorias_consecutivas + ' → agora 0');
        console.log('   ❌ empate_conta_vitoria: foi ' + regras.empate_conta_vitoria + ' → agora false');
      }
      
      // 1. Salvar no Supabase MASTER
      console.log('☁️ 1️⃣ Salvando no SUPABASE MASTER...');
      const { error: masterError } = await supabasePrincipal
        .from('regras')
        .upsert(dadosRegras, { onConflict: 'pelada_id' });
      
      if (masterError) {
        throw new Error(`Master: ${masterError.message}`);
      }
      console.log('✅ Salvo no MASTER');
      
      // 2. Salvar no Supabase DO CLIENTE (dedicado)
      console.log('☁️ 2️⃣ Salvando no SUPABASE DO CLIENTE...');
      const clienteDb = await getClienteSupabase(peladaId);
      const { error: clienteError } = await clienteDb
        .from('regras')
        .upsert(dadosRegras, { onConflict: 'pelada_id' });
      
      if (clienteError) {
        console.warn('⚠️ Erro ao salvar no cliente (continuando):', clienteError.message);
      } else {
        console.log('✅ Salvo no CLIENTE');
      }
      
      // 3. Salvar no localStorage (cache local)
      console.log('💾 3️⃣ Salvando no localStorage...');
      localStorage.setItem(`regras_${peladaId}`, JSON.stringify(regras));
      console.log('✅ Salvo no localStorage');
      
      console.log('✅ Regras salvas em todos os 3 locais (Master + Cliente + Cache)');
      setMessage('✅ Regras salvas nos 3 locais (Master + Cliente + Cache)!');
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
      tipo_fila: 'modo_prancheta',
      cores_coletes: ['#dc3545', '#000000', '#FFFFFF', '#fbbf24', '#3b82f6', '#10b981']
    });
    setMessage('🔄 Configurações restauradas para o padrão');
    setTimeout(() => setMessage(''), 3000);
  };

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
                  <span className="text-gray-600 text-sm font-medium">minutos</span>
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

              {/* Tipo de Fila (Modo de Partida) */}
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

              {/* NOVA SEÇÃO: Deseja automatizar o andamento da fila? */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border-2 border-blue-300 shadow-sm">
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  DESEJA AUTOMATIZAR O ANDAMENTO DA FILA?
                </label>
                <p className="text-xs text-gray-600 mb-4">
                  Se <strong>NÃO</strong>, todo andamento da fila será manual (você confirma a cada partida). Se <strong>SIM</strong>, as regras abaixo definem como a fila se comporta automaticamente.
                </p>
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