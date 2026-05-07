'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../components/Layout';
import { createClient } from '@supabase/supabase-js';
import { buscar_plano, buscar_pelada_id, buscar_supabase_url, buscar_supabase_anon_key } from '../lib/credenciais';
import { validarSenhaPelada } from '../lib/supabase';

// Banco PRINCIPAL onde está a tabela clientes
const BANCO_PRINCIPAL_URL = 'https://ewcswczqvelhlwpbraea.supabase.co';
const BANCO_PRINCIPAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks';

export default function Home() {
  const plano = buscar_plano();
  const [stats, setStats] = useState({
    totalPeladas: 0,
    totalGols: 0,
    totalPeladeiros: 0,
    totalPartidas: 0,
    mediaGols: 0.0,
    reiPelada: '-'
  });

  const [sessaoAtiva, setSessaoAtiva] = useState(false);
  const [infoSessao, setInfoSessao] = useState<{
    data: string;
    jogadores: number;
    partidas: number;
    gols: number;
  } | null>(null);
  const router = useRouter();

  // States para modal de lista da pelada
  const [showModalLista, setShowModalLista] = useState(false);
  const [showModalExcluirSessao, setShowModalExcluirSessao] = useState(false);
  const [senhaExcluirSessao, setSenhaExcluirSessao] = useState('');
  const [erroExcluirSessao, setErroExcluirSessao] = useState('');
  const [isExcluindoSessao, setIsExcluindoSessao] = useState(false);
  const [dataLista, setDataLista] = useState('');
  const [numLinhas, setNumLinhas] = useState(10);
  const [observacao, setObservacao] = useState('');
  const [avisosLista, setAvisosLista] = useState<string[]>([]);
  
  useEffect(() => {
    verificarSessaoAtiva();
    carregarAvisos();
  }, []);

  useEffect(() => {
    verificarSessaoAtiva();
    carregarAvisos();
    
    // Simular carregamento de estatísticas
    // TODO: Implementar chamada real para API
    setTimeout(() => {
      setStats({
        totalPeladas: 12,
        totalGols: 156,
        totalPeladeiros: 24,
        totalPartidas: 48,
        mediaGols: 3.25,
        reiPelada: 'João'
      });
    }, 1000);
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
        .select('data_vencimento, plano')
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
          avisos.push(`⚠️ Seu plano vence em ${dataFormatada}`);
        }
      }

      // Buscar avisos do sistema
      const { data: avisosSistema, error } = await supabasePrincipal
        .from('avisos_sistema')
        .select('*')
        .eq('ativo', true)
        .lte('data_inicio', hoje)
        .gte('data_fim', hoje)
        .or(`plano_alvo.eq.todos,plano_alvo.eq.${clienteAtualizado?.plano || 'Free'}`)
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

  const gerarListaWhatsApp = () => {
    if (!dataLista) {
      alert('Por favor, preencha a data da pelada!');
      return;
    }
    
    // Validar se numLinhas está preenchido
    if (!numLinhas || numLinhas < 1) {
      alert('Por favor, preencha o número de linhas (mínimo 1)!');
      return;
    }

    // Gerar texto formatado
    let texto = '*Lista de Presença*\n';
    texto += `Data: *${dataLista}*\n`;
    
    if (observacao.trim()) {
      // Aplicar itálico em cada linha da observação
      const linhasObs = observacao.split('\n');
      const obsFormatada = linhasObs.map(linha => `_${linha}_`).join('\n');
      texto += `${obsFormatada}\n`;
    }
    
    texto += '\n';
    
    for (let i = 1; i <= numLinhas; i++) {
      texto += `${i} - \n`;
    }
    
    // Codificar para URL
    const textoEncoded = encodeURIComponent(texto);
    
    // Abrir WhatsApp
    const urlWhatsApp = `https://wa.me/?text=${textoEncoded}`;
    window.open(urlWhatsApp, '_blank');
    
    // Fechar modal e limpar campos
    setShowModalLista(false);
    setDataLista('');
    setNumLinhas(10);
    setObservacao('');
  };

  const navigateTo = (page: string) => {
    router.push(`/${page}`);
  };

  return (
    <Layout title="Home" hideFooter>
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
                className="px-4 sm:px-5 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all text-sm sm:text-base bg-white text-emerald-700 hover:bg-emerald-50 active:scale-[0.99]"
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
      <section className="mb-6 opacity-50">
        <div className="rounded-2xl shadow-lg p-5 sm:p-6 relative overflow-hidden border-2 transition-all bg-sky-600 border-sky-400">
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                    Modo Torneio
                  </h2>
                  <span className="inline-block px-2 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full">
                    em desenvolvimento
                  </span>
                </div>
                <p className="text-sm sm:text-base mt-1 text-sky-100">
                  Organize competicoes em formato de grupos e mata-mata
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                disabled
                onClick={() => navigateTo('modo-torneio')}
                className="px-4 sm:px-5 py-3 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all text-sm sm:text-base bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
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



      {/* Gerar Lista e Atividade */}
      {plano === 'free' ? (
        <section className="mb-6">
          <button 
            onClick={() => setShowModalLista(true)}
            className="w-full bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-500 hover:to-green-600 rounded-xl shadow-md hover:shadow-lg p-4 sm:p-6 border border-emerald-300 transition-all duration-300 min-h-[5rem] sm:h-20 group"
          >
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-white text-sm sm:text-base">Lista de Presença</h3>
                  <p className="text-xs text-emerald-100 group-hover:text-white transition-colors">Gerar lista de presenca para WhatsApp</p>
                </div>
              </div>
            </div>
          </button>
        </section>
      ) : (
        <section className="mb-6">
          <button 
            onClick={() => setShowModalLista(true)}
            className="w-full bg-gradient-to-r from-emerald-400 to-green-500 hover:from-emerald-500 hover:to-green-600 rounded-xl shadow-md hover:shadow-lg p-4 sm:p-6 border border-emerald-300 transition-all duration-300 min-h-[5rem] sm:h-20 group"
          >
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-lg flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="font-semibold text-white text-sm sm:text-base">Lista de Presença</h3>
                  <p className="text-xs text-emerald-100 group-hover:text-white transition-colors">Gerar lista de presenca para WhatsApp</p>
                </div>
              </div>
            </div>
          </button>
        </section>
      )}

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

      {/* Modal: Gerar Lista da Pelada */}
      {showModalLista && (
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
          onClick={() => setShowModalLista(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#059669', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Gerar Lista da Pelada
              </h2>
              <button
                onClick={() => setShowModalLista(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#999'
                }}
              >
                ×
              </button>
            </div>

            {/* Campo: Data da Pelada */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                Data da Pelada *
              </label>
              <input 
                type="text"
                value={dataLista}
                onChange={(e) => setDataLista(e.target.value)}
                placeholder="Ex: 25/12/2024"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#059669'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Campo: Nº de Linhas */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                Nº de Linhas
              </label>
              <input 
                type="number"
                value={numLinhas}
                onChange={(e) => {
                  const valor = e.target.value;
                  // Permite campo vazio (para poder apagar e digitar novo número)
                  if (valor === '') {
                    setNumLinhas('' as any);
                  } else {
                    const numero = parseInt(valor);
                    // Limita entre 1 e 50
                    if (numero >= 1 && numero <= 50) {
                      setNumLinhas(numero);
                    }
                  }
                }}
                placeholder="1"
                min="1"
                max="50"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  fontSize: '1rem',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#059669'}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e5e7eb';
                  // Se estiver vazio ao sair do campo, volta para 1
                  if (e.target.value === '') {
                    setNumLinhas(1);
                  }
                }}
              />
            </div>

            {/* Campo: Observação */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#333' }}>
                Observação (opcional)
              </label>
              <textarea 
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Trazer chuteira e camisa..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  fontSize: '1rem',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
                onFocus={(e) => e.target.style.borderColor = '#059669'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowModalLista(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  backgroundColor: 'white',
                  color: '#666',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                Cancelar
              </button>
              <button 
                onClick={gerarListaWhatsApp}
                disabled={!dataLista.trim()}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: dataLista.trim() ? '#25D366' : '#ccc',
                  color: 'white',
                  fontWeight: '600',
                  cursor: dataLista.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '1rem'
                }}
              >
                Gerar e Compartilhar
              </button>
            </div>
          </div>
        </div>
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
