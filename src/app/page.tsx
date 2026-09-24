'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../components/Layout';
import { createClient } from '@supabase/supabase-js';
import { buscar_pelada_id } from '../lib/credenciais';
import { validarSenhaPelada } from '../lib/supabase';
import { deveRedirecionarParaModoUnico } from '../lib/rotasAcesso';

// Banco PRINCIPAL onde está a tabela clientes
const BANCO_PRINCIPAL_URL = 'https://ewcswczqvelhlwpbraea.supabase.co';
const BANCO_PRINCIPAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks';

export default function Home() {
  const [sessaoAtiva, setSessaoAtiva] = useState(false);
  const [infoSessao, setInfoSessao] = useState<{
    data: string;
    jogadores: number;
    partidas: number;
    gols: number;
  } | null>(null);
  const router = useRouter();

  const [showModalExcluirSessao, setShowModalExcluirSessao] = useState(false);
  const [senhaExcluirSessao, setSenhaExcluirSessao] = useState('');
  const [erroExcluirSessao, setErroExcluirSessao] = useState('');
  const [isExcluindoSessao, setIsExcluindoSessao] = useState(false);
  const [avisosLista, setAvisosLista] = useState<string[]>([]);
  const [statusCliente, setStatusCliente] = useState<'ativo' | 'inativo' | 'bloqueado' | 'desconhecido'>('desconhecido');
  const [acessoPeladaTradicional, setAcessoPeladaTradicional] = useState(true);
  const [acessoModoTorneio, setAcessoModoTorneio] = useState(false);
  
  useEffect(() => {
    verificarSessaoAtiva();
    carregarAvisos();
    verificarStatusCliente();
  }, []);

  const carregarAvisos = async () => {
    try {
      const peladaId = buscar_pelada_id();
      if (!peladaId) return;

      // BANCO PRINCIPAL: buscar clientes e avisos_sistema
      const supabasePrincipal = createClient(BANCO_PRINCIPAL_URL, BANCO_PRINCIPAL_KEY);
      const hoje = new Date().toISOString().split('T')[0];
      const avisos: string[] = [];

      const { data: clienteAtualizado, error: erroCliente } = await supabasePrincipal
        .from('clientes')
        .select('data_vencimento')
        .eq('pelada_id', peladaId)
        .single();

      if (erroCliente) {
        console.error('Erro ao buscar dados do cliente:', erroCliente);
        return;
      }

      // Verificar aviso de vencimento (5 dias ou menos)
      if (clienteAtualizado?.data_vencimento) {
        const dataVencimento = new Date(clienteAtualizado.data_vencimento);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        dataVencimento.setHours(0, 0, 0, 0);
        
        const diasRestantes = Math.ceil((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diasRestantes <= 5 && diasRestantes >= 0) {
          const dataFormatada = dataVencimento.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          avisos.push(`⚠️ Seu acesso vence em ${dataFormatada}`);
        } else if (diasRestantes < 0) {
          const dataFormatada = dataVencimento.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          avisos.push(`🚫 Seu acesso está vencido desde ${dataFormatada}. Regularize para evitar bloqueio.`);
        }
      }

      // Buscar avisos do sistema
      const { data: avisosSistema, error } = await supabasePrincipal
        .from('avisos_sistema')
        .select('*')
        .eq('ativo', true)
        .lte('data_inicio', hoje)
        .gte('data_fim', hoje)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar avisos:', error);
      } else if (avisosSistema && avisosSistema.length > 0) {
        avisosSistema.forEach(aviso => {
          avisos.push(aviso.mensagem);
        });
      }

      setAvisosLista(avisos);
    } catch (error) {
      console.error('Erro ao carregar avisos:', error);
    }
  };

  const verificarStatusCliente = async () => {
    try {
      const peladaId = buscar_pelada_id();
      if (!peladaId) return;

      const response = await fetch('/api/auth/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pelada_id: peladaId }),
      });

      if (!response.ok) return;

      const data = await response.json();
      const status = String(data.status || 'desconhecido').toLowerCase();

      if (status === 'ativo' || status === 'inativo' || status === 'bloqueado') {
        setStatusCliente(status);
      }

      const acessoPeladaTradicional = data.acesso_pelada_tradicional !== false;
      const acessoModoTorneio = data.acesso_modo_torneio === true;

      setAcessoPeladaTradicional(acessoPeladaTradicional);
      setAcessoModoTorneio(acessoModoTorneio);

      if (status === 'bloqueado' || status === 'inativo') {
        // Mantém aviso local imediato e evita navegação para as telas seguintes
        localStorage.removeItem('sessao_ativa');
        return;
      }

      const destino = deveRedirecionarParaModoUnico(acessoPeladaTradicional, acessoModoTorneio);
      if (destino) {
        router.replace(destino);
      }
    } catch (error) {
      console.warn('Falha ao verificar status do cliente na home:', error);
    }
  };

  const verificarSessaoAtiva = async () => {
    try {
      // Buscar sessão ativa do LOCALSTORAGE (não do banco!)
      const sessaoAtivaStr = localStorage.getItem('sessao_ativa');
      
      if (!sessaoAtivaStr) {
        setSessaoAtiva(false);
        setInfoSessao(null);
        return;
      }

      const sessao = JSON.parse(sessaoAtivaStr);
      
      // Verificar se a sessão está realmente ativa
      if (sessao.status !== 'ativa') {
        setSessaoAtiva(false);
        setInfoSessao(null);
        return;
      }

      setSessaoAtiva(true);
      
      // Buscar dados do localStorage
      const filaAtivaStr = localStorage.getItem('fila_ativa');
      const filaAtiva = filaAtivaStr ? JSON.parse(filaAtivaStr) : [];
      
      // Buscar jogos do localStorage usando o ID da sessão
      const jogosKey = `jogos_${sessao.id}`;
      const jogosStr = localStorage.getItem(jogosKey);
      const jogos = jogosStr ? JSON.parse(jogosStr) : [];
      
      // Contar apenas jogadores que estão na fila e não são reserva
      const totalJogadores = filaAtiva.filter((j: any) => {
        const status = String(j?.status || '').toLowerCase();
        const posicaoFila = Number(j?.posicao_fila ?? 999);
        return status !== 'reserva' && posicaoFila !== 999;
      }).length;
      
      // Contar jogos finalizados
      const totalPartidas = jogos.filter((j: any) => j.status === 'finalizado').length;
      
      // Somar gols das partidas finalizadas
      const totalGols = jogos
        .filter((j: any) => j.status === 'finalizado')
        .reduce((sum: number, jogo: any) => sum + (jogo.placar_a || 0) + (jogo.placar_b || 0), 0);
      
      // Formatar data
      const dataFormatada = new Date(sessao.data).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit'
      });
      
      setInfoSessao({
        data: dataFormatada,
        jogadores: totalJogadores,
        partidas: totalPartidas,
        gols: totalGols
      });
    } catch (err) {
      console.error('Erro ao verificar sessão:', err);
      setSessaoAtiva(false);
      setInfoSessao(null);
    }
  };

  const acessarSessaoAtiva = () => {
    router.push('/page-fila');
  };

  const abrirModalExcluirSessao = (e: React.MouseEvent) => {
    e.stopPropagation();
    setErroExcluirSessao('');
    setSenhaExcluirSessao('');
    setShowModalExcluirSessao(true);
  };

  const excluirSessaoLocal = async () => {
    setErroExcluirSessao('');

    if (!senhaExcluirSessao.trim()) {
      setErroExcluirSessao('Digite sua senha para confirmar.');
      return;
    }

    const sessaoAtivaStr = localStorage.getItem('sessao_ativa');
    if (!sessaoAtivaStr) {
      setShowModalExcluirSessao(false);
      setSessaoAtiva(false);
      setInfoSessao(null);
      return;
    }

    const senhaValida = await validarSenhaPelada(senhaExcluirSessao);
    if (!senhaValida) {
      setErroExcluirSessao('Senha incorreta.');
      return;
    }

    setIsExcluindoSessao(true);

    try {
      const sessao = JSON.parse(sessaoAtivaStr);
      const sessaoId = sessao?.id;

      localStorage.removeItem('sessao_ativa');
      localStorage.removeItem('fila_ativa');
      localStorage.removeItem('partida_em_andamento');
      localStorage.removeItem('modo_partida_estado');
      localStorage.removeItem('modo_prancheta_ativo');
      localStorage.removeItem('cronometro_partida');

      if (sessaoId) {
        localStorage.removeItem(`jogos_${sessaoId}`);
        localStorage.removeItem(`gols_${sessaoId}`);
        localStorage.removeItem(`assistencias_${sessaoId}`);
        localStorage.removeItem(`fila_snapshot_${sessaoId}`);
      }

      setSessaoAtiva(false);
      setInfoSessao(null);
      setShowModalExcluirSessao(false);
      setSenhaExcluirSessao('');
      alert('🗑️ Pelada ativa local foi apagada com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir dados da pelada ativa:', error);
      setErroExcluirSessao('Erro ao apagar dados da pelada ativa.');
    } finally {
      setIsExcluindoSessao(false);
    }
  };

  const navigateTo = (page: string) => {
    if (statusCliente === 'bloqueado' || statusCliente === 'inativo') {
      alert(statusCliente === 'bloqueado'
        ? '🚫 Acesso bloqueado. Entre em contato com o administrador.'
        : '⏸️ Cliente inativo. Regularize seu acesso para continuar.');
      return;
    }

    if (page === 'pelada-tradicional' && !acessoPeladaTradicional) {
      alert('🚫 Seu cliente não possui acesso ao Modo Pelada Tradicional.');
      return;
    }

    if (page === 'modo-torneio') {
      if (!acessoModoTorneio) {
        alert('🚫 Seu cliente não possui acesso ao Modo Torneio.');
        return;
      }
    }

    router.push(`/${page}`);
  };

  return (
    <Layout title="Home" hideFooter>
      {(statusCliente === 'bloqueado' || statusCliente === 'inativo') && (
        <section className="mb-6">
          <div className="w-full bg-red-50 border-2 border-red-300 rounded-xl p-4 sm:p-5">
            <h3 className="text-base sm:text-lg font-bold text-red-800 mb-1">🚫 Acesso temporariamente indisponível</h3>
            <p className="text-sm text-red-700">
              {statusCliente === 'bloqueado'
                ? 'Seu cliente está bloqueado. As telas de Pelada Tradicional e Modo Torneio foram travadas.'
                : 'Seu cliente está inativo. As telas de Pelada Tradicional e Modo Torneio foram travadas.'}
            </p>
          </div>
        </section>
      )}

      {/* Gestão da Pelada Hero */}
      <section className="mb-6">
        <div className="rounded-2xl shadow-2xl p-5 sm:p-6 relative overflow-hidden border-2 transition-all bg-emerald-600 border-emerald-500">
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Pelada Tradicional
                </h2>
                <p className="text-sm sm:text-base mt-1 text-emerald-100">
                  Cadastre peladeiros, configure regras e inicie o sorteio
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => navigateTo('pelada-tradicional')}
                disabled={statusCliente === 'bloqueado' || statusCliente === 'inativo' || !acessoPeladaTradicional}
                className={`px-4 sm:px-5 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all text-sm sm:text-base ${
                  statusCliente === 'bloqueado' || statusCliente === 'inativo' || !acessoPeladaTradicional
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed opacity-70'
                    : 'bg-white text-emerald-700 hover:bg-emerald-50 active:scale-[0.99]'
                }`}
              >
                <span>⚽</span>
                <span>Abrir Modo Tradicional</span>
              </button>
            </div>
          </div>

          <div className="absolute -top-14 -right-10 w-36 h-36 rounded-full bg-emerald-400/30"></div>
          <div className="absolute -bottom-12 -left-10 w-28 h-28 rounded-full bg-emerald-800/30"></div>
        </div>
      </section>

      {/* Modo Torneio Hero */}
      <section className="mb-6">
        <div className="rounded-2xl shadow-lg p-5 sm:p-6 relative overflow-hidden border-2 transition-all bg-sky-600 border-sky-400">
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Modo Torneio
                  </h2>
                </div>
                <p className="text-sm sm:text-base mt-1 text-sky-100">
                  Organize competicoes em formato de grupos e mata-mata
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => navigateTo('modo-torneio')}
                disabled={statusCliente === 'bloqueado' || statusCliente === 'inativo' || !acessoModoTorneio}
                className={`px-4 sm:px-5 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all text-sm sm:text-base ${
                  statusCliente === 'bloqueado' || statusCliente === 'inativo' || !acessoModoTorneio
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                    : 'bg-white text-sky-700 hover:bg-sky-50 active:scale-[0.99]'
                }`}
              >
                <span>🏆</span>
                <span>Abrir Modo Torneio</span>
              </button>
            </div>
          </div>

          <div className="absolute -top-14 -right-10 w-36 h-36 rounded-full bg-sky-300/20"></div>
          <div className="absolute -bottom-12 -left-10 w-28 h-28 rounded-full bg-sky-900/20"></div>
        </div>
      </section>

      {/* Avisos do Sistema */}
      {avisosLista.length > 0 && (
        <section className="mb-6">
          <div className="w-full bg-white rounded-xl shadow-md border-2 border-orange-400 transition-all duration-300 p-4 sm:p-6">
            <div className="flex items-center h-full">
              {/* Emoji fixo à esquerda */}
              <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-orange-50 rounded-lg flex items-center justify-center shadow-md mr-4 border border-orange-200">
                <span className="text-3xl sm:text-4xl">📢</span>
              </div>
              {/* Lista de avisos */}
              <div className="flex-1">
                <ul className="space-y-2">
                  {avisosLista.map((aviso, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-orange-500 mr-2 mt-1 flex-shrink-0">●</span>
                      <span className="text-gray-700 text-sm sm:text-base font-medium leading-snug">
                        {aviso}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {avisosLista.length === 0 && (
        <section className="mb-6">
          <div className="w-full bg-white hover:bg-gray-50 rounded-xl shadow-md border-2 border-orange-400 transition-all duration-300 p-4 sm:p-6">
            <div className="flex items-center h-full">
              {/* Emoji fixo à esquerda */}
              <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 bg-orange-50 rounded-lg flex items-center justify-center shadow-md mr-4 border border-orange-200">
                <span className="text-3xl sm:text-4xl">📢</span>
              </div>
              {/* Texto do aviso */}
              <div className="flex-1 text-left">
                <p className="text-gray-600 text-sm sm:text-base font-medium leading-snug text-justify italic">
                  Quadro de avisos do sistema. No momento não há avisos disponíveis.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Modal: Confirmar exclusão da pelada ativa local */}
      {showModalExcluirSessao && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
          onClick={() => !isExcluindoSessao && setShowModalExcluirSessao(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#dc2626' }}>
                🗑️ Apagar Pelada Ativa Local
              </h2>
              <button
                onClick={() => !isExcluindoSessao && setShowModalExcluirSessao(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#999' }}
                disabled={isExcluindoSessao}
              >
                ×
              </button>
            </div>

            <p style={{ color: '#374151', marginBottom: '14px', fontSize: '0.95rem' }}>
              Essa ação apaga os dados locais da pelada em andamento que ainda não foram sincronizados.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#111827' }}>
                Digite sua senha para confirmar
              </label>
              <input
                type="password"
                value={senhaExcluirSessao}
                onChange={(e) => setSenhaExcluirSessao(e.target.value)}
                placeholder="Sua senha"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                disabled={isExcluindoSessao}
              />
            </div>

            {erroExcluirSessao && (
              <div style={{ marginBottom: '14px', color: '#dc2626', fontSize: '0.9rem', fontWeight: 600 }}>
                {erroExcluirSessao}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowModalExcluirSessao(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  backgroundColor: 'white',
                  color: '#666',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
                disabled={isExcluindoSessao}
              >
                Cancelar
              </button>
              <button
                onClick={excluirSessaoLocal}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  fontWeight: '600',
                  cursor: isExcluindoSessao ? 'not-allowed' : 'pointer',
                  opacity: isExcluindoSessao ? 0.6 : 1
                }}
                disabled={isExcluindoSessao}
              >
                {isExcluindoSessao ? 'Apagando...' : 'Apagar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
