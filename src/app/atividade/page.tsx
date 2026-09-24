'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { buscar_pelada_id } from '../../lib/credenciais';
import { getClienteSupabase } from '../../lib/supabase';

type Risco = 'ativo' | 'risco' | 'ausente';

interface JogadorStats {
  id: string;
  idsCadastro: string[];
  nome: string;
  nomeNormalizado: string;
  status: string;
  created_at?: string | null;
  totalParticipou: number;
  faltasConsecutivas: number;
  ultimaData: string | null;
  risco: Risco;
  taxaPresenca: number | null;
  sessoesConsideradas: number;
  historicoPresenca: boolean[];
  recemCadastrado: boolean;
}

type OperadorRegra = 'e' | 'ou';

interface ConfigInatividade {
  alerta: number;
  inativo: number;
  limiteSessoes: number;
  participacaoAlerta: number;
  participacaoInativo: number;
  operadorAlerta: OperadorRegra;
  operadorInativo: OperadorRegra;
}

export default function AtividadePage() {
  const router = useRouter();
  const LIMITE_SESSOES_PADRAO = 10;

  const [jogadores, setJogadores] = useState<JogadorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [totalSessoes, setTotalSessoes] = useState(0);
  const [totalSessoesComJogo, setTotalSessoesComJogo] = useState(0);
  const [filtro, setFiltro] = useState<'inativos' | 'alerta' | 'ativos'>('ativos');
  const [salvando, setSalvando] = useState<string | null>(null);
  const [mostrarmConfiguracao, setMostrarConfiguracao] = useState(false);
  const [faltasAlerta, setFaltasAlerta] = useState(2);
  const [faltasInativo, setFaltasInativo] = useState(4);
  const [limiteSessoes, setLimiteSessoes] = useState(LIMITE_SESSOES_PADRAO);
  const [participacaoAlerta, setParticipacaoAlerta] = useState(70);
  const [participacaoInativo, setParticipacaoInativo] = useState(50);
  const [operadorAlerta, setOperadorAlerta] = useState<OperadorRegra>('ou');
  const [operadorInativo, setOperadorInativo] = useState<OperadorRegra>('ou');

  useEffect(() => {
    const inicializar = async () => {
      const peladaId = buscar_pelada_id();
      if (!peladaId) {
        alert('🚫 Sessão inválida. Faça login novamente.');
        router.push('/login');
        return;
      }

      try {
        const response = await fetch('/api/auth/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pelada_id: peladaId }),
        });

        if (!response.ok) {
          alert('🚫 Não foi possível validar seu acesso.');
          router.push('/');
          return;
        }

        const statusData = await response.json();
        const acessoPeladaTradicional = statusData.acesso_pelada_tradicional !== false;
        if (!acessoPeladaTradicional) {
          alert('🚫 Controle de Atividade indisponível para este cliente no momento.');
          router.push('/');
          return;
        }
      } catch (error) {
        console.error('Erro ao validar acesso da atividade:', error);
        alert('🚫 Não foi possível validar seu acesso.');
        router.push('/');
        return;
      }

      let configInicial: ConfigInatividade = {
        alerta: 2,
        inativo: 4,
        limiteSessoes: LIMITE_SESSOES_PADRAO,
        participacaoAlerta: 70,
        participacaoInativo: 50,
        operadorAlerta: 'ou',
        operadorInativo: 'ou',
      };

      const savedConfig = localStorage.getItem(`config_inatividade_${peladaId}`);
      if (savedConfig) {
        try {
          const config = JSON.parse(savedConfig);
          configInicial = {
            alerta: Math.max(1, Number(config.alerta) || 2),
            inativo: Math.max(2, Number(config.inativo) || 4),
            limiteSessoes: Math.max(1, Number(config.limiteSessoes) || LIMITE_SESSOES_PADRAO),
            participacaoAlerta: Math.max(0, Math.min(100, Number(config.participacaoAlerta) || 70)),
            participacaoInativo: Math.max(0, Math.min(100, Number(config.participacaoInativo) || 50)),
            operadorAlerta: config.operadorAlerta === 'e' ? 'e' : 'ou',
            operadorInativo: config.operadorInativo === 'e' ? 'e' : 'ou',
          };
        } catch (e) {
          console.error('Erro ao carregar configuração:', e);
        }
      }

      if (configInicial.alerta >= configInicial.inativo) {
        configInicial.alerta = Math.max(1, configInicial.inativo - 1);
      }

      setFaltasAlerta(configInicial.alerta);
      setFaltasInativo(configInicial.inativo);
      setLimiteSessoes(configInicial.limiteSessoes);
      setParticipacaoAlerta(configInicial.participacaoAlerta);
      setParticipacaoInativo(configInicial.participacaoInativo);
      setOperadorAlerta(configInicial.operadorAlerta);
      setOperadorInativo(configInicial.operadorInativo);
      carregarDados(configInicial);
    };

    void inicializar();
  }, [router]);

  const avaliarRegra = (
    faltasConsecutivas: number,
    taxaPresenca: number | null,
    limiteFaltas: number,
    limiteParticipacao: number,
    operador: OperadorRegra
  ) => {
    const criterioFaltas = faltasConsecutivas >= limiteFaltas;
    const criterioParticipacao = taxaPresenca !== null && taxaPresenca < limiteParticipacao;
    return operador === 'e'
      ? criterioFaltas && criterioParticipacao
      : criterioFaltas || criterioParticipacao;
  };

  const calcularRisco = (
    statusAtual: string,
    recemCadastrado: boolean,
    faltasConsecutivas: number,
    taxaPresenca: number | null,
    configAtual: ConfigInatividade
  ): Risco => {
    if (statusAtual === 'inativo') return 'ausente';
    if (recemCadastrado) return 'ativo';

    const bateuInativo = avaliarRegra(
      faltasConsecutivas,
      taxaPresenca,
      configAtual.inativo,
      configAtual.participacaoInativo,
      configAtual.operadorInativo
    );

    if (bateuInativo) return 'ausente';

    const bateuAlerta = avaliarRegra(
      faltasConsecutivas,
      taxaPresenca,
      configAtual.alerta,
      configAtual.participacaoAlerta,
      configAtual.operadorAlerta
    );

    if (bateuAlerta) return 'risco';
    return 'ativo';
  };

  const normalizarTexto = (valor: string) =>
    String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

  const extrairIdsDoTime = (time: any): string[] => {
    const lista = typeof time === 'string' ? JSON.parse(time) : Array.isArray(time) ? time : [];

    return lista
      .map((item: any) => {
        if (typeof item === 'string') return item;
        if (item?.id) return item.id;
        if (item?.jogador_id) return item.jogador_id;
        if (item?.nome) return item.nome;
        return null;
      })
      .filter(Boolean);
  };

  const obterDataCadastro = (valor?: string | null): string | null => {
    if (!valor) return null;
    try {
      return new Date(valor).toISOString().split('T')[0];
    } catch {
      return null;
    }
  };

  const compararCadastros = (a: any, b: any) => {
    const dataA = obterDataCadastro(a.created_at);
    const dataB = obterDataCadastro(b.created_at);

    if (dataA && dataB && dataA !== dataB) return dataA.localeCompare(dataB);
    if (dataA && !dataB) return -1;
    if (!dataA && dataB) return 1;

    return String(a.id || '').localeCompare(String(b.id || ''));
  };

  const carregarDados = async (configOverride?: ConfigInatividade) => {
    setLoading(true);
    setErro(null);

    const configAtual: ConfigInatividade = {
      alerta: configOverride?.alerta ?? faltasAlerta,
      inativo: configOverride?.inativo ?? faltasInativo,
      limiteSessoes: configOverride?.limiteSessoes ?? limiteSessoes,
      participacaoAlerta: configOverride?.participacaoAlerta ?? participacaoAlerta,
      participacaoInativo: configOverride?.participacaoInativo ?? participacaoInativo,
      operadorAlerta: configOverride?.operadorAlerta ?? operadorAlerta,
      operadorInativo: configOverride?.operadorInativo ?? operadorInativo,
    };

    const limiteSessoesAtual = configAtual.limiteSessoes;

    try {
      const peladaId = buscar_pelada_id();
      if (!peladaId) { setErro('Usuário não autenticado.'); setLoading(false); return; }
      const clienteDb = await getClienteSupabase(peladaId);

      // ── Buscar jogadores ──────────────────────────────────────────
      let jogadoresList: any[] = [];
      let data: any[] | null = null;
      let error: any = null;

      // Compatível com banco antigo (sem created_at) e novo (com created_at)
      const tentativaComCreatedAt = await clienteDb
        .from('jogadores')
        .select('id, nome, nivel, status, created_at')
        .eq('pelada_id', peladaId);

      if (tentativaComCreatedAt.error) {
        const tentativaSemCreatedAt = await clienteDb
          .from('jogadores')
          .select('id, nome, nivel, status')
          .eq('pelada_id', peladaId);
        data = tentativaSemCreatedAt.data;
        error = tentativaSemCreatedAt.error;
      } else {
        data = tentativaComCreatedAt.data;
        error = tentativaComCreatedAt.error;
      }

      if (error) throw new Error('Erro ao buscar jogadores: ' + error.message);
      jogadoresList = data || [];

      if (jogadoresList.length === 0) {
        setJogadores([]);
        setLoading(false);
        return;
      }

      // ── Consolidar cadastro por nome e participação por nome ──────
      const jogadoresPorNome = jogadoresList.reduce((acc: Record<string, any[]>, jogador: any) => {
        const nomeNormalizado = normalizarTexto(jogador.nome);
        if (!nomeNormalizado) return acc;
        if (!acc[nomeNormalizado]) acc[nomeNormalizado] = [];
        acc[nomeNormalizado].push(jogador);
        return acc;
      }, {});

      Object.values(jogadoresPorNome).forEach((grupo) => grupo.sort(compararCadastros));

      const nomePorId = new Map<string, string>();
      Object.entries(jogadoresPorNome).forEach(([nomeNormalizado, grupo]) => {
        grupo.forEach((jogador: any) => {
          if (jogador.id) nomePorId.set(String(jogador.id), nomeNormalizado);
        });
      });

      const participacaoPorNome: Record<string, Set<string>> = {};
      Object.keys(jogadoresPorNome).forEach((nomeNormalizado) => {
        participacaoPorNome[nomeNormalizado] = new Set();
      });

      let todasSessoes: Array<{ id: string; data: string }> = [];
      let sessoesComJogo = new Set<string>();

      const { data: sessoes, error: errSessoes } = await clienteDb
        .from('sessoes')
        .select('id, data')
        .eq('pelada_id', peladaId)
        .in('status', ['finalizada', 'finalizado'])
        .order('data', { ascending: false })
        .limit(limiteSessoesAtual);

      if (errSessoes) throw new Error('Erro ao buscar sessões: ' + errSessoes.message);

      todasSessoes = (sessoes || []).map((sessao: any) => ({
        id: sessao.id,
        data: sessao.data || '',
      }));

      const { data: jogos, error: errJogos } = await clienteDb
        .from('jogos')
        .select('sessao_id, time_a, time_b, created_at')
        .eq('pelada_id', peladaId)
        .eq('status', 'finalizado')
        .in('sessao_id', todasSessoes.map((sessao: any) => sessao.id));

      if (errJogos) throw new Error('Erro ao buscar jogos: ' + errJogos.message);

      const sessaoIdsRecentes = new Set(todasSessoes.map(s => s.id));

      (jogos || [])
        .filter((jogo: any) => sessaoIdsRecentes.has(jogo.sessao_id))
        .forEach((jogo: any) => {
          if (jogo.sessao_id) {
            sessoesComJogo.add(jogo.sessao_id);
          }
          const participantes = [...extrairIdsDoTime(jogo.time_a), ...extrairIdsDoTime(jogo.time_b)];

          participantes.forEach((referencia: string) => {
            const chaveNome = nomePorId.get(String(referencia)) || normalizarTexto(referencia);

            if (participacaoPorNome[chaveNome]) {
              participacaoPorNome[chaveNome].add(jogo.sessao_id);
            }
          });
        });

      setTotalSessoes(todasSessoes.length);
      setTotalSessoesComJogo(sessoesComJogo.size);

      const sessoesValidasParaCalculo = todasSessoes.filter((s) => sessoesComJogo.has(s.id));

      // ── Calcular stats por jogador ────────────────────────────────
      const comStats: JogadorStats[] = Object.entries(jogadoresPorNome).map(([nomeNormalizado, cadastros]) => {
        const cadastroReferencia = cadastros[0];
        const cadastroAtivo = cadastros.find((j: any) => (j.status || 'ativo').toLowerCase() === 'ativo') || cadastroReferencia;
        const part = participacaoPorNome[nomeNormalizado] || new Set<string>();
        const totalParticipou = part.size;
        const dataCadastro = obterDataCadastro(cadastroReferencia.created_at);
        const statusAtual = cadastros.some((j: any) => (j.status || 'ativo').toLowerCase() === 'ativo') ? 'ativo' : 'inativo';

        let sessoesConsideradas = sessoesValidasParaCalculo;
        if (dataCadastro) {
          sessoesConsideradas = sessoesValidasParaCalculo.filter(sessao => !sessao.data || sessao.data >= dataCadastro);
        } else if (totalParticipou === 0) {
          sessoesConsideradas = [];
        }

        // Faltas consecutivas retroativas (da sessão mais recente para a mais antiga)
        let faltasConsecutivas = 0;
        for (const s of sessoesConsideradas) {
          if (part.has(s.id)) break;
          faltasConsecutivas++;
        }

        const ultimaData = todasSessoes.find(s => part.has(s.id))?.data || null;
        const recemCadastrado = totalParticipou === 0 && sessoesConsideradas.length === 0;

        const historicoPresenca = sessoesConsideradas.map((sessao) => part.has(sessao.id));
        const taxaPresenca = sessoesConsideradas.length > 0
          ? Math.round((totalParticipou / sessoesConsideradas.length) * 100)
          : null;
        const risco = calcularRisco(statusAtual, recemCadastrado, faltasConsecutivas, taxaPresenca, configAtual);

        return {
          id: cadastroAtivo.id,
          idsCadastro: cadastros.map((j: any) => j.id).filter(Boolean),
          nome: cadastroReferencia.nome,
          nomeNormalizado,
          status: statusAtual,
          created_at: cadastroReferencia.created_at || null,
          totalParticipou,
          faltasConsecutivas,
          ultimaData,
          risco,
          taxaPresenca,
          sessoesConsideradas: sessoesConsideradas.length,
          historicoPresenca,
          recemCadastrado,
        };
      });

      // Ordenar: ausentes → em risco → ativos; dentro de cada grupo, mais faltas primeiro
      const ordemRisco: Record<Risco, number> = { ausente: 0, risco: 1, ativo: 2 };
      comStats.sort((a, b) => {
        if (ordemRisco[a.risco] !== ordemRisco[b.risco]) return ordemRisco[a.risco] - ordemRisco[b.risco];
        return b.faltasConsecutivas - a.faltasConsecutivas;
      });

      setJogadores(comStats);
    } catch (err: any) {
      console.error('Erro ao carregar atividade:', err);
      setErro(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const alterarStatus = async (jogador: JogadorStats, novoStatus: 'ativo' | 'inativo') => {
    setSalvando(jogador.id);
    try {
      const peladaId = buscar_pelada_id();
      if (!peladaId) return;

      // Atualiza localStorage
      const key = `jogadores_${peladaId}`;
      const local = localStorage.getItem(key);
      if (local) {
        const lista = JSON.parse(local);
        localStorage.setItem(key, JSON.stringify(
          lista.map((item: any) =>
            jogador.idsCadastro.includes(item.id) || normalizarTexto(item.nome) === jogador.nomeNormalizado
              ? { ...item, status: novoStatus }
              : item
          )
        ));
      }

      const clienteDb = await getClienteSupabase(peladaId);
      await clienteDb
        .from('jogadores')
        .update({ status: novoStatus })
        .in('id', jogador.idsCadastro)
        .eq('pelada_id', peladaId);

      // Atualiza estado local
      setJogadores(prev => prev.map(j => {
        if (j.nomeNormalizado !== jogador.nomeNormalizado) return j;
        const novoRisco = novoStatus === 'inativo'
          ? 'ausente'
          : calcularRisco(
              'ativo',
              j.recemCadastrado,
              j.faltasConsecutivas,
              j.taxaPresenca,
              {
                alerta: faltasAlerta,
                inativo: faltasInativo,
                limiteSessoes,
                participacaoAlerta,
                participacaoInativo,
                operadorAlerta,
                operadorInativo,
              }
            );
        return { ...j, status: novoStatus, risco: novoRisco };
      }));
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    } finally {
      setSalvando(null);
    }
  };

  const salvarConfiguracao = () => {
    const peladaId = buscar_pelada_id();
    if (peladaId) {
      const config = {
        alerta: faltasAlerta,
        inativo: faltasInativo,
        limiteSessoes,
        participacaoAlerta,
        participacaoInativo,
        operadorAlerta,
        operadorInativo,
      };
      localStorage.setItem(`config_inatividade_${peladaId}`, JSON.stringify(config));
      setMostrarConfiguracao(false);
      // Recarregar dados para aplicar novos thresholds
      carregarDados(config);
    }
  };

  const qtdAtivo = jogadores.filter(j => j.risco === 'ativo').length;
  const qtdRisco = jogadores.filter(j => j.risco === 'risco').length;
  const qtdAusente = jogadores.filter(j => j.risco === 'ausente').length;

  const filtrados = jogadores.filter(j => {
    if (filtro === 'inativos') return j.risco === 'ausente';
    if (filtro === 'alerta') return j.risco === 'risco';
    return j.risco === 'ativo';
  });

  const formatarData = (data: string | null) => {
    if (!data) return null;
    try {
      return new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    } catch { return null; }
  };

  return (
    <Layout title="Controle de Atividade">
      {/* Header info */}
      <div className="mb-4">
        <div className="bg-white border border-indigo-100 rounded-xl shadow-sm px-3 py-2 text-center relative">
          <h1 className="text-xl font-bold text-indigo-700 leading-tight">
            Controle de Atividade
          </h1>
          <p className="text-xs text-gray-500 mt-1 leading-tight">
            {loading
              ? 'Carregando dados...'
              : totalSessoes > 0
                  ? `Últimas ${limiteSessoes} peladas finalizadas`
                  : 'Nenhuma pelada finalizada encontrada no período analisado'}
          </p>
          
          {/* Botão de engrenagem */}
          <button
            onClick={() => setMostrarConfiguracao(true)}
            className="absolute top-3 right-3 p-2 rounded-lg hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 transition-colors"
            title="Configurar limiares de inatividade"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Modal de Configuração */}
      {mostrarmConfiguracao && (
        <div className="fixed inset-0 z-50 bg-black/40 p-2 sm:p-4 overflow-y-auto flex items-end sm:items-center justify-center">
          <div className="w-full max-w-sm max-h-[calc(100vh-1rem)] sm:max-h-[90vh] bg-white rounded-xl shadow-lg flex flex-col overflow-hidden">
            <div className="px-3 sm:px-5 pt-3 sm:pt-5 pb-2 border-b border-gray-100">
              <h2 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">⚙️ Configurar Inatividade</h2>
            </div>

            <div className="px-3 sm:px-5 py-3 space-y-3 overflow-y-auto">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">🧮 Janela de analise</label>
                <p className="text-xs text-gray-500 mb-2">Quantas ultimas peladas finalizadas entram no calculo</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setLimiteSessoes(Math.max(1, limiteSessoes - 1))} className="px-3 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-100 transition-colors">-</button>
                  <input type="number" min="1" value={limiteSessoes} onChange={(e) => setLimiteSessoes(Math.max(1, parseInt(e.target.value) || 1))} className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg text-center font-bold text-indigo-700" />
                  <button onClick={() => setLimiteSessoes(limiteSessoes + 1)} className="px-3 py-2 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-100 transition-colors">+</button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">📊 Peladas para ALERTA</label>
                <p className="text-xs text-gray-500 mb-2">Quantas peladas sem participar ate marcar como "Em Alerta"</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setFaltasAlerta(Math.max(1, faltasAlerta - 1))} className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-600 font-bold hover:bg-amber-100 transition-colors">-</button>
                  <input type="number" min="1" max={faltasInativo - 1} value={faltasAlerta} onChange={(e) => setFaltasAlerta(Math.max(1, Math.min(parseInt(e.target.value) || 1, faltasInativo - 1)))} className="flex-1 px-3 py-2 border border-amber-200 rounded-lg text-center font-bold text-amber-700" />
                  <button onClick={() => setFaltasAlerta(Math.min(faltasInativo - 1, faltasAlerta + 1))} className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-600 font-bold hover:bg-amber-100 transition-colors">+</button>
                </div>

                <p className="text-xs text-gray-500">Criterio de participacao na janela</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setParticipacaoAlerta(Math.max(0, participacaoAlerta - 5))} className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-600 font-bold hover:bg-amber-100 transition-colors">-</button>
                  <input type="number" min="0" max="100" value={participacaoAlerta} onChange={(e) => setParticipacaoAlerta(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} className="flex-1 px-3 py-2 border border-amber-200 rounded-lg text-center font-bold text-amber-700" />
                  <span className="text-sm font-semibold text-amber-700">%</span>
                  <button onClick={() => setParticipacaoAlerta(Math.min(100, participacaoAlerta + 5))} className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-600 font-bold hover:bg-amber-100 transition-colors">+</button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button onClick={() => setOperadorAlerta('ou')} className={`px-3 py-2 rounded-lg border font-bold transition-colors ${operadorAlerta === 'ou' ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'}`}>OU</button>
                  <button onClick={() => setOperadorAlerta('e')} className={`px-3 py-2 rounded-lg border font-bold transition-colors ${operadorAlerta === 'e' ? 'bg-amber-500 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50'}`}>E</button>
                </div>
                <p className="text-[11px] text-gray-500">Vai para alerta quando atingir {faltasAlerta} faltas seguidas <span className="font-bold">{operadorAlerta.toUpperCase()}</span> participacao &lt; {participacaoAlerta}%.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">🚫 Peladas para INATIVO</label>
                <p className="text-xs text-gray-500 mb-2">Quantas peladas sem participar ate marcar como "Inativo"</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setFaltasInativo(Math.max(faltasAlerta + 1, faltasInativo - 1))} className="px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-colors">-</button>
                  <input type="number" min={faltasAlerta + 1} value={faltasInativo} onChange={(e) => setFaltasInativo(Math.max(faltasAlerta + 1, parseInt(e.target.value) || faltasAlerta + 1))} className="flex-1 px-3 py-2 border border-red-200 rounded-lg text-center font-bold text-red-700" />
                  <button onClick={() => setFaltasInativo(faltasInativo + 1)} className="px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-colors">+</button>
                </div>

                <p className="text-xs text-gray-500">Criterio de participacao na janela</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setParticipacaoInativo(Math.max(0, participacaoInativo - 5))} className="px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-colors">-</button>
                  <input type="number" min="0" max="100" value={participacaoInativo} onChange={(e) => setParticipacaoInativo(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))} className="flex-1 px-3 py-2 border border-red-200 rounded-lg text-center font-bold text-red-700" />
                  <span className="text-sm font-semibold text-red-700">%</span>
                  <button onClick={() => setParticipacaoInativo(Math.min(100, participacaoInativo + 5))} className="px-3 py-2 rounded-lg border border-red-300 bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-colors">+</button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button onClick={() => setOperadorInativo('ou')} className={`px-3 py-2 rounded-lg border font-bold transition-colors ${operadorInativo === 'ou' ? 'bg-red-600 text-white border-red-700' : 'bg-white text-red-700 border-red-300 hover:bg-red-50'}`}>OU</button>
                  <button onClick={() => setOperadorInativo('e')} className={`px-3 py-2 rounded-lg border font-bold transition-colors ${operadorInativo === 'e' ? 'bg-red-600 text-white border-red-700' : 'bg-white text-red-700 border-red-300 hover:bg-red-50'}`}>E</button>
                </div>
                <p className="text-[11px] text-gray-500">Vai para inativo quando atingir {faltasInativo} faltas seguidas <span className="font-bold">{operadorInativo.toUpperCase()}</span> participacao &lt; {participacaoInativo}%.</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                <p><strong>Resumo das configuracoes:</strong></p>
                <p>- Janela de analise: <span className="font-bold">ultimas {limiteSessoes} peladas</span></p>
                <p>- <span className="text-amber-600 font-bold">Alerta</span>: {faltasAlerta}+ faltas <strong>{operadorAlerta.toUpperCase()}</strong> participacao &lt; {participacaoAlerta}%</p>
                <p>- <span className="text-red-600 font-bold">Inativo</span>: {faltasInativo}+ faltas <strong>{operadorInativo.toUpperCase()}</strong> participacao &lt; {participacaoInativo}%</p>
                <p>- Recem-cadastrados sem sessoes validas continuam como <span className="text-green-600 font-bold">Ativo</span></p>
              </div>
            </div>

            <div className="flex gap-2 p-3 sm:px-5 sm:pb-5 border-t border-gray-100 bg-white">
              <button onClick={() => setMostrarConfiguracao(false)} className="flex-1 px-3 sm:px-4 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50 transition-colors">Cancelar</button>
              <button onClick={salvarConfiguracao} className="flex-1 px-3 sm:px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      {!loading && !erro && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          {([
            { id: 'inativos', label: 'Inativos', total: qtdAusente },
            { id: 'alerta', label: 'Alerta', total: qtdRisco },
            { id: 'ativos', label: 'Ativos', total: qtdAtivo },
          ] as const).map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`h-14 rounded-lg text-sm font-bold border-2 transition-colors leading-tight ${
                f.id === 'inativos'
                  ? (filtro === f.id
                      ? 'bg-red-600 text-white border-red-700'
                      : 'bg-white text-red-700 border-red-500 hover:bg-red-50')
                  : f.id === 'alerta'
                    ? (filtro === f.id
                        ? 'bg-amber-500 text-white border-amber-600'
                        : 'bg-white text-amber-700 border-amber-500 hover:bg-amber-50')
                    : (filtro === f.id
                        ? 'bg-green-600 text-white border-green-700'
                        : 'bg-white text-green-700 border-green-500 hover:bg-green-50')
              }`}
            >
              {f.label} ({f.total})
            </button>
          ))}
        </div>
      )}

      {/* Estados */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="text-4xl mb-4 animate-spin">⏳</div>
          <p>Carregando dados de atividade...</p>
        </div>
      )}

      {!loading && erro && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          <strong>Erro:</strong> {erro}
          <button onClick={() => carregarDados()} className="ml-3 underline font-semibold">Tentar novamente</button>
        </div>
      )}

      {!loading && !erro && filtrados.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="text-4xl mb-4">✅</div>
          <p>Nenhum jogador nesta categoria.</p>
        </div>
      )}

      {/* Lista de jogadores */}
      {!loading && !erro && filtrados.length > 0 && (
        <div className="space-y-2.5">
          {filtrados.map(j => {
            const corFundo = j.risco === 'ativo' ? 'bg-green-50 border-green-200'
              : j.risco === 'risco' ? 'bg-yellow-50 border-yellow-200'
              : 'bg-red-50 border-red-200';
            const ultimaFmt = formatarData(j.ultimaData);
            const faltasTexto = `${j.faltasConsecutivas} falta${j.faltasConsecutivas > 1 ? 's' : ''} seguida${j.faltasConsecutivas > 1 ? 's' : ''}`;
            const presencaTexto = j.sessoesConsideradas > 0
              ? `${j.totalParticipou}/${j.sessoesConsideradas} (${j.taxaPresenca}%)`
              : '0/0 (0%)';
            const corTexto = j.risco === 'ativo'
              ? 'text-green-700'
              : j.risco === 'risco'
                ? 'text-amber-700'
                : 'text-red-700';
            const ultimaPresencaTexto = j.recemCadastrado
              ? '-'
              : j.sessoesConsideradas === 0
                ? '-'
                : (ultimaFmt || '-');

            const idsCadastro = Array.isArray(j.idsCadastro) ? j.idsCadastro : [];
            const chaveLista = `${j.nomeNormalizado}-${idsCadastro.join('-') || j.id}`;

            return (
              <div key={chaveLista} className={`rounded-xl border-2 px-3 py-2.5 ${corFundo}`}>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-gray-800 text-sm leading-tight truncate">{j.nome}</div>
                        <div className={`text-[11px] font-normal leading-tight whitespace-nowrap ${corTexto}`}>{presencaTexto}</div>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] leading-tight min-w-0">
                        <span className={`font-normal truncate ${corTexto}`}>Última Presença: {ultimaPresencaTexto}</span>
                        <span className={`font-extrabold whitespace-nowrap ${corTexto}`}>{faltasTexto}</span>
                      </div>
                      {j.recemCadastrado && (
                        <div className="text-[10px] text-gray-500 mt-0.5 leading-tight truncate">Novo cadastro, sem sessões aplicáveis ainda</div>
                      )}

                      {j.historicoPresenca.length > 0 && (
                        <div className="mt-1.5">
                          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                            {j.historicoPresenca.map((presente, index) => (
                              <span
                                key={`${chaveLista}-presenca-${index}`}
                                className={`w-2.5 h-2.5 rounded-full border ${presente ? 'bg-green-500 border-green-600' : 'bg-red-400 border-red-500'}`}
                                title={presente ? 'Presente' : 'Ausente'}
                              />
                            ))}
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">Mais recente à esquerda</div>
                        </div>
                      )}
                    </div>
                  </div>
                  {filtro === 'inativos' && (j.status === 'inativo' ? (
                    <button
                      disabled={salvando === j.id}
                      onClick={() => alterarStatus(j, 'ativo')}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold border-2 border-green-600 text-green-600 bg-white hover:bg-green-50 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {salvando === j.id ? '...' : '✅ Reativar'}
                    </button>
                  ) : (
                    <button
                      disabled={salvando === j.id}
                      onClick={() => alterarStatus(j, 'inativo')}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold border-2 border-red-500 text-red-500 bg-white hover:bg-red-50 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {salvando === j.id ? '...' : '🚫 Desativar'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
