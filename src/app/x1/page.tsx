'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import StatsFilterPanel from '../../components/StatsFilterPanel';
import { getClienteSupabase, fetchAllRows } from '../../lib/supabase';
import { usePermissions } from '../../lib/usePermissions';
import { buscar_pelada_id } from '../../lib/credenciais';

interface Jogador {
  id: string;
  nome: string;
  apelido?: string;
  foto_url?: string;
  status?: string | null;
}

interface Gol {
  id?: string;
  jogo_id: string;
  jogador_id: string;
  gol_contra_jogador_id?: string | null;
  assistencia?: string | null;
  time: 'A' | 'B';
}

interface Assistencia {
  id?: string;
  jogo_id: string;
  jogador_id: string;
  time: 'A' | 'B';
  gol_id?: string;
}

interface Jogo {
  id: string;
  sessao_id: string;
  time_a: string[];
  time_b: string[];
  placar_a: number;
  placar_b: number;
  created_at: string;
  gols?: Gol[];
  assistencias?: Assistencia[];
}

export default function X1Page() {
  const STORAGE_KEY = 'peladm:x1:state:v1';
  const router = useRouter();
  const { possuiPermissao, loading: loadingPermissoes } = usePermissions();
  const [loading, setLoading] = useState(true);

  const [jogos, setJogos] = useState<Jogo[]>([]);
  const [jogosFiltrados, setJogosFiltrados] = useState<Jogo[]>([]);
  const [jogadores, setJogadores] = useState<{ [id: string]: Jogador }>({});

  const [filtro, setFiltro] = useState<'atual' | 'mes' | 'ultimas' | 'ano' | 'historia'>('atual');
  const [dataSelecionada, setDataSelecionada] = useState('');
  const [datasDisponiveis, setDatasDisponiveis] = useState<string[]>([]);
  const [mesesDisponiveis, setMesesDisponiveis] = useState<string[]>([]);
  const [anosDisponiveis, setAnosDisponiveis] = useState<string[]>([]);
  const [periodoSelecionado, setPeriodoSelecionado] = useState('');
  const [quantidadePeladas, setQuantidadePeladas] = useState('5');
  const [apenasAtivos, setApenasAtivos] = useState(false);

  const [buscaA, setBuscaA] = useState('');
  const [buscaB, setBuscaB] = useState('');
  const [jogadorA, setJogadorA] = useState<string | null>(null);
  const [jogadorB, setJogadorB] = useState<string | null>(null);
  const [sugestoesA, setSugestoesA] = useState(false);
  const [sugestoesB, setSugestoesB] = useState(false);
  const [editandoLado, setEditandoLado] = useState<'A' | 'B' | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.filtro) setFiltro(saved.filtro);
      if (typeof saved.dataSelecionada === 'string') setDataSelecionada(saved.dataSelecionada);
      if (typeof saved.periodoSelecionado === 'string') setPeriodoSelecionado(saved.periodoSelecionado);
      if (typeof saved.quantidadePeladas === 'string') setQuantidadePeladas(saved.quantidadePeladas);
      if (typeof saved.apenasAtivos === 'boolean') setApenasAtivos(saved.apenasAtivos);
      if (typeof saved.buscaA === 'string') setBuscaA(saved.buscaA);
      if (typeof saved.buscaB === 'string') setBuscaB(saved.buscaB);
      if (typeof saved.jogadorA === 'string' || saved.jogadorA === null) setJogadorA(saved.jogadorA);
      if (typeof saved.jogadorB === 'string' || saved.jogadorB === null) setJogadorB(saved.jogadorB);
    } catch {
      // ignore invalid persisted state
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      filtro,
      dataSelecionada,
      periodoSelecionado,
      quantidadePeladas,
      apenasAtivos,
      buscaA,
      buscaB,
      jogadorA,
      jogadorB,
    }));
  }, [filtro, dataSelecionada, periodoSelecionado, quantidadePeladas, apenasAtivos, buscaA, buscaB, jogadorA, jogadorB]);

  useEffect(() => {
    if (!loadingPermissoes && !possuiPermissao('verEstatisticas')) {
      alert('🚫 Estatísticas indisponíveis para este cliente no momento.');
      router.push('/');
    }
  }, [loadingPermissoes, possuiPermissao, router]);

  useEffect(() => { carregarDados(); }, []);
  useEffect(() => { aplicarFiltro(); }, [filtro, dataSelecionada, periodoSelecionado, quantidadePeladas, jogos]);

  useEffect(() => {
    const close = () => { setSugestoesA(false); setSugestoesB(false); setEditandoLado(null); };
    if (sugestoesA || sugestoesB) {
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }
  }, [sugestoesA, sugestoesB]);

  const buscarJogador = (jogadorId: any): string => {
    if (typeof jogadorId === 'object' && jogadorId?.nome) return jogadorId.apelido || jogadorId.nome;
    const idStr = String(jogadorId);
    const j = jogadores[idStr];
    if (j) return j.apelido || j.nome;
    return idStr.substring(0, 8);
  };

  const derivarAssistenciasDeGols = (gols: Gol[]): Assistencia[] => {
    return gols
      .filter((g) => g.id && g.assistencia)
      .map((g) => ({
        id: `gol-assistencia-${g.id}`,
        jogo_id: g.jogo_id,
        jogador_id: g.assistencia as string,
        time: g.time,
        gol_id: g.id,
      }));
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      const peladaId = buscar_pelada_id();
      if (!peladaId) { router.push('/login'); return; }
      const clienteDb = await getClienteSupabase(peladaId);

      const jogosData = await fetchAllRows((from, to) =>
        clienteDb
          .from('jogos')
          .select('*')
          .eq('pelada_id', peladaId)
          .eq('status', 'finalizado')
          .order('created_at', { ascending: false })
          .range(from, to)
      );

      if (jogosData && jogosData.length > 0) {
        const datas = [...new Set(jogosData.map(j => new Date(j.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })))];
        const meses = [...new Set(jogosData.map(j => { const d = new Date(j.created_at); return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; }))].sort().reverse();
        const anos = [...new Set(jogosData.map(j => new Date(j.created_at).getFullYear().toString()))].sort().reverse();
        setDatasDisponiveis(datas);
        setMesesDisponiveis(meses);
        setAnosDisponiveis(anos);

        // Paginação manual: o Supabase limita respostas a 1000 linhas por padrão,
        // e uma pelada com muito histórico facilmente ultrapassa isso.
        const ids = jogosData.map(j => j.id);
        const golsData = await fetchAllRows((from, to) =>
          clienteDb
            .from('gols')
            .select('*')
            .eq('pelada_id', peladaId)
            .in('jogo_id', ids)
            .range(from, to)
        );
        setJogos(jogosData.map(j => {
          const golsDoJogo = (golsData || []).filter(g => g.jogo_id === j.id) as Gol[];
          const assistenciasDerivadas = derivarAssistenciasDeGols(golsDoJogo);

          return {
            ...j,
            gols: golsDoJogo,
            assistencias: assistenciasDerivadas,
          };
        }));
      } else {
        setJogos([]);
      }

      const { data: jogadoresData } = await clienteDb.from('jogadores').select('*').eq('pelada_id', peladaId);
      if (jogadoresData) {
        const map: { [id: string]: Jogador } = {};
        jogadoresData.forEach(j => { map[j.id] = j; map[j.nome] = j; });
        setJogadores(map);
      }
    } catch (err) {
      console.error('Erro ao carregar X1:', err);
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltro = () => {
    let filtered = [...jogos];
    const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    if (filtro === 'atual') {
      if (dataSelecionada) filtered = jogos.filter(j => fmt(j.created_at) === dataSelecionada);
      else if (jogos.length > 0) {
        const recente = jogos.reduce((p, c) => new Date(c.created_at) > new Date(p.created_at) ? c : p);
        filtered = jogos.filter(j => j.sessao_id === recente.sessao_id);
      }
    } else if (filtro === 'mes') {
      if (periodoSelecionado) filtered = jogos.filter(j => { const d = new Date(j.created_at); return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` === periodoSelecionado; });
      else filtered = jogos.filter(j => new Date(j.created_at) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    } else if (filtro === 'ultimas') {
      const sessoes = [...new Set(jogos.map(j => j.sessao_id))]
        .map(sid => { const ultimo = jogos.filter(j => j.sessao_id === sid).reduce((p, c) => new Date(c.created_at) > new Date(p.created_at) ? c : p); return { sid, data: new Date(ultimo.created_at) }; })
        .sort((a, b) => b.data.getTime() - a.data.getTime())
        .slice(0, parseInt(quantidadePeladas)).map(s => s.sid);
      filtered = jogos.filter(j => sessoes.includes(j.sessao_id));
    } else if (filtro === 'historia') {
      filtered = [...jogos];
    } else if (filtro === 'ano') {
      if (periodoSelecionado) {
        filtered = jogos.filter(j => {
          const [ano, parte] = periodoSelecionado.split('-');
          const data = new Date(j.created_at);
          const anoJogo = data.getFullYear().toString();
          if (parte === undefined) return anoJogo === periodoSelecionado;
          if (anoJogo !== ano) return false;
          const mes = data.getMonth();
          if (parte === 's1') return mes < 6;
          if (parte === 's2') return mes >= 6;
          if (parte === 'q1') return mes <= 2;
          if (parte === 'q2') return mes >= 3 && mes <= 5;
          if (parte === 'q3') return mes >= 6 && mes <= 8;
          if (parte === 'q4') return mes >= 9 && mes <= 11;
          return false;
        });
      } else {
        filtered = jogos.filter(j => new Date(j.created_at) >= new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
      }
    }
    setJogosFiltrados(filtered);
  };

  const labelFiltro = () => {
    if (dataSelecionada) return `Pelada: ${dataSelecionada}`;
    if (filtro === 'atual') return 'Pelada mais recente';
    if (filtro === 'ultimas') return `Últimas ${quantidadePeladas} peladas`;
    if (filtro === 'historia') return 'Histórico completo';
    if (filtro === 'mes') return periodoSelecionado || 'Todos os meses';
    if (filtro === 'ano') return periodoSelecionado || 'Todos os anos';
    return '';
  };

  const nomesJogadores = [...new Set(
    Object.values(jogadores)
      .filter(j => j.id && j.nome && (!apenasAtivos || j.status === undefined || j.status === null || j.status === 'ativo'))
      .map(j => j.apelido || j.nome)
  )].sort();

  const calcularStats = (nome: string) => {
    let jogosJogados = 0, vitorias = 0, derrotas = 0, empates = 0, gols = 0, golsContra = 0, assistencias = 0, semSofrer = 0, hatTricks = 0, mvps = 0;
    const detalhes: Array<{ resultado: 'vitoria' | 'empate' | 'derrota'; gols: number; assistencias: number; mvp: boolean; hatTrick: boolean; semSofrer: boolean; deiteiERolei: boolean }> = [];

    jogosFiltrados.forEach(jogo => {
      const todos = [...jogo.time_a, ...jogo.time_b];
      const jId = todos.find(id => buscarJogador(id) === nome);
      if (!jId) return;
      jogosJogados++;
      const noA = jogo.time_a.includes(jId);
      let resultado: 'vitoria' | 'empate' | 'derrota' = 'derrota';
      let ganhou = false;
      if (jogo.placar_a === jogo.placar_b) {
        empates++;
        resultado = 'empate';
      }
      else if ((noA && jogo.placar_a > jogo.placar_b) || (!noA && jogo.placar_b > jogo.placar_a)) { vitorias++; resultado = 'vitoria'; ganhou = true; }
      else derrotas++;
      const gj = (jogo.gols || []).filter(g => buscarJogador(g.jogador_id) === nome).length;
      const aj = (jogo.assistencias || []).filter(a => buscarJogador(a.jogador_id) === nome).length;
      const gc = (jogo.gols || []).filter(g => g.jogador_id === 'gol_contra' && g.gol_contra_jogador_id && buscarJogador(g.gol_contra_jogador_id) === nome).length;
      const ht = gj >= 3 || aj >= 3;
      const ss = (noA && jogo.placar_b === 0) || (!noA && jogo.placar_a === 0);
      const mvp = ganhou && (gj > 0 || aj > 0);
      if (ht) hatTricks++;
      if (ss) semSofrer++;
      if (mvp) mvps++;
      gols += gj; golsContra += gc; assistencias += aj;
      detalhes.push({ resultado, gols: gj, assistencias: aj, mvp, hatTrick: ht, semSofrer: ss, deiteiERolei: ganhou && gj > 0 && aj > 0 });
    });

    // Decisivo: Gols + Assistências em vitórias
    const decisivo = detalhes.filter(d => d.resultado === 'vitoria').reduce((sum, d) => sum + d.gols + d.assistencias, 0);

    // Invicto: Maior sequência sem derrota (vitória ou empate consecutivos)
    let maiorSequencia = 0, sequenciaAtual = 0;
    detalhes.forEach(d => {
      if (d.resultado !== 'derrota') {
        sequenciaAtual++;
        maiorSequencia = Math.max(maiorSequencia, sequenciaAtual);
      } else {
        sequenciaAtual = 0;
      }
    });

    // Carregou o time: Partidas com gols ou assists em derrotas/empates
    const carregouTime = detalhes.filter(d => d.resultado !== 'vitoria' && (d.gols > 0 || d.assistencias > 0)).length;

    const pts = vitorias * 3 + empates;
    const aproveitamento = jogosJogados > 0 ? ((pts / (jogosJogados * 3)) * 100).toFixed(1) : '0.0';
    const mediaGols = jogosJogados > 0 ? (gols / jogosJogados).toFixed(2) : '0.00';
    const participacoesGols = gols + assistencias;
    return { nome, jogosJogados, vitorias, derrotas, empates, gols, golsContra, assistencias, participacoesGols, semSofrer, hatTricks, mvps, mediaGols, aproveitamento, detalhes, decisivo, invicto: maiorSequencia, carregouTime };
  };


  // Jogos em que ambos participaram
  const jogosEmComum = (nomeA: string, nomeB: string) => {
    return jogosFiltrados.filter(jogo => {
      const todos = [...jogo.time_a, ...jogo.time_b];
      return todos.some(id => buscarJogador(id) === nomeA) && todos.some(id => buscarJogador(id) === nomeB);
    });
  };

  const statsA = jogadorA ? calcularStats(jogadorA) : null;
  const statsB = jogadorB ? calcularStats(jogadorB) : null;
  const comuns = jogadorA && jogadorB ? jogosEmComum(jogadorA, jogadorB) : [];

  // Confronto direto
  const confronto = comuns.reduce(
    (acc, jogo) => {
      const idA = [...jogo.time_a, ...jogo.time_b].find(id => buscarJogador(id) === jogadorA);
      const idB = [...jogo.time_a, ...jogo.time_b].find(id => buscarJogador(id) === jogadorB);
      if (!idA || !idB) return acc;
      const aNoTimeA = jogo.time_a.includes(idA);
      const bNoTimeA = jogo.time_a.includes(idB);
      const mesmoTime = aNoTimeA === bNoTimeA;
      if (mesmoTime) { acc.juntos++; return acc; }
      // adversários
      const aVenceu = (aNoTimeA && jogo.placar_a > jogo.placar_b) || (!aNoTimeA && jogo.placar_b > jogo.placar_a);
      const bVenceu = (bNoTimeA && jogo.placar_a > jogo.placar_b) || (!bNoTimeA && jogo.placar_b > jogo.placar_a);
      if (jogo.placar_a === jogo.placar_b) acc.empates++;
      else if (aVenceu) acc.vitoriasA++;
      else if (bVenceu) acc.vitoriasB++;
      return acc;
    },
    { vitoriasA: 0, vitoriasB: 0, empates: 0, juntos: 0 }
  );
  const jogosContra = Math.max(0, comuns.length - confronto.juntos);

  const metricasComparativo = statsA && statsB
    ? [
        { label: 'Vitórias', valA: statsA.vitorias, valB: statsB.vitorias, inv: false },
        { label: 'Confronto Direto', valA: confronto.vitoriasA, valB: confronto.vitoriasB, inv: false, cond: comuns.length > 0 },
        { label: 'Derrotas', valA: statsA.derrotas, valB: statsB.derrotas, inv: true },
        { label: 'Gols', valA: statsA.gols, valB: statsB.gols, inv: false },
        { label: 'Média de Gols', valA: parseFloat(statsA.mediaGols), valB: parseFloat(statsB.mediaGols), inv: false },
        { label: 'Assistências', valA: statsA.assistencias, valB: statsB.assistencias, inv: false },
        { label: 'Participações em Gols', valA: statsA.participacoesGols, valB: statsB.participacoesGols, inv: false },
        { label: 'Decisivo', valA: statsA.decisivo, valB: statsB.decisivo, inv: false },
        { label: 'MVP', valA: statsA.mvps, valB: statsB.mvps, inv: false },
        { label: 'Gol Contra', valA: statsA.golsContra, valB: statsB.golsContra, inv: true },
        { label: 'Invicto', valA: statsA.invicto, valB: statsB.invicto, inv: false },
        { label: 'Sem Sofrer Gols', valA: statsA.semSofrer, valB: statsB.semSofrer, inv: false },
      ].filter((m) => m.cond === undefined || m.cond)
    : [];

  const placarComparativo = metricasComparativo.reduce(
    (acc, m) => {
      if (m.inv) {
        if (m.valA < m.valB) acc.venceuA++;
        else if (m.valA === m.valB) acc.empatados++;
        else acc.venceuB++;
      } else {
        if (m.valA > m.valB) acc.venceuA++;
        else if (m.valA === m.valB) acc.empatados++;
        else acc.venceuB++;
      }
      return acc;
    },
    { venceuA: 0, empatados: 0, venceuB: 0 }
  );

  if (loadingPermissoes || loading) {
    return (
      <Layout title="X1">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center"><div className="text-5xl mb-4">⚔️</div><div className="text-gray-600">Carregando...</div></div>
        </div>
      </Layout>
    );
  }

  const StatBar = ({ valA, valB, label, invertido }: { valA: number; valB: number; label: string; invertido?: boolean }) => {
    const total = valA + valB;
    const pctA = total === 0 ? 50 : Math.round((valA / total) * 100);
    const pctB = 100 - pctA;
    // Se invertido, quem tem MENOR valor é melhor
    const melhorA = invertido ? valA < valB : valA > valB;
    const melhorB = invertido ? valB < valA : valB > valA;
    return (
      <div className="mb-3">
        <div className="grid grid-cols-[minmax(44px,1fr)_auto_minmax(44px,1fr)] items-center text-xs text-gray-500 mb-1 gap-2">
          <span className={`justify-self-start ${melhorA ? 'font-bold text-green-800 bg-green-100 px-1.5 rounded' : ''}`}>{valA}</span>
          <span className="font-medium text-gray-600 text-center inline-flex items-center gap-1">
            {label}
            {invertido && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">menor vence</span>
            )}
          </span>
          <span className={`justify-self-end ${melhorB ? 'font-bold text-green-800 bg-green-100 px-1.5 rounded' : ''}`}>{valB}</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden">
          <div className="bg-blue-500 transition-all" style={{ width: `${pctA}%` }} />
          <div className="bg-orange-400 transition-all" style={{ width: `${pctB}%` }} />
        </div>
      </div>
    );
  };

  return (
    <Layout title="X1">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <StatsFilterPanel
          filtro={filtro}
          setFiltro={setFiltro}
          dataSelecionada={dataSelecionada}
          setDataSelecionada={setDataSelecionada}
          periodoSelecionado={periodoSelecionado}
          setPeriodoSelecionado={setPeriodoSelecionado}
          quantidadePeladas={quantidadePeladas}
          setQuantidadePeladas={setQuantidadePeladas}
          apenasAtivos={apenasAtivos}
          setApenasAtivos={setApenasAtivos}
          datasDisponiveis={datasDisponiveis}
          mesesDisponiveis={mesesDisponiveis}
          anosDisponiveis={anosDisponiveis}
        />

        {/* Filtro ativo */}
        <div className="w-full bg-blue-600 rounded-lg px-4 py-1.5 flex items-center justify-center gap-2 shadow-sm mb-4">
          <span className="text-white text-xs font-bold">{labelFiltro()}</span>
        </div>

        {/* Seleção dos jogadores */}
        <div className="mb-3">
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 text-center">Escolha os jogadores</h3>
          <div className="mb-1 mx-auto w-full max-w-[640px]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
              <div className="relative min-w-0 flex-1 text-center">
                {editandoLado === 'A' ? (
                  <input
                    autoFocus
                    type="text"
                    value={buscaA}
                    onChange={e => { setBuscaA(e.target.value); setSugestoesA(true); setJogadorA(null); }}
                    placeholder="Buscar jogador..."
                    className="w-full py-1 px-2 rounded-md border border-blue-300 text-sm text-blue-700 font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditandoLado('A'); setSugestoesA(true); setSugestoesB(false); }}
                    className="w-full text-base font-extrabold text-blue-700 truncate"
                  >
                    {jogadorA || 'Jogador 1'}
                  </button>
                )}
                {sugestoesA && editandoLado === 'A' && buscaA.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto text-left">
                    {nomesJogadores.filter(n => n.toLowerCase().includes(buscaA.toLowerCase()) && n !== jogadorB).map(n => (
                      <button
                        key={n}
                        onMouseDown={() => { setJogadorA(n); setBuscaA(n); setSugestoesA(false); setEditandoLado(null); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-gray-100 last:border-0"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="text-xl leading-none">⚔️</div>

              <div className="relative min-w-0 flex-1 text-center">
                {editandoLado === 'B' ? (
                  <input
                    autoFocus
                    type="text"
                    value={buscaB}
                    onChange={e => { setBuscaB(e.target.value); setSugestoesB(true); setJogadorB(null); }}
                    placeholder="Buscar jogador..."
                    className="w-full py-1 px-2 rounded-md border border-orange-300 text-sm text-orange-600 font-bold text-center focus:outline-none focus:ring-2 focus:ring-orange-300"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { setEditandoLado('B'); setSugestoesB(true); setSugestoesA(false); }}
                    className="w-full text-base font-extrabold text-orange-600 truncate"
                  >
                    {jogadorB || 'Jogador 2'}
                  </button>
                )}
                {sugestoesB && editandoLado === 'B' && buscaB.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto text-left">
                    {nomesJogadores.filter(n => n.toLowerCase().includes(buscaB.toLowerCase()) && n !== jogadorA).map(n => (
                      <button
                        key={n}
                        onMouseDown={() => { setJogadorB(n); setBuscaB(n); setSugestoesB(false); setEditandoLado(null); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 border-b border-gray-100 last:border-0"
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Comparativo */}
        {statsA && statsB && (
          <>
            <section className="mb-4 mx-auto w-full max-w-[640px] rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="text-center text-[11px] text-gray-500">
                {`Empates: ${placarComparativo.empatados} • Partidas em comum: ${comuns.length} • Juntos: ${confronto.juntos} • Contra: ${jogosContra}`}
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <div className="text-[11px] font-semibold text-blue-700 mb-0.5">{jogadorA}</div>
                  <div className="text-3xl font-black text-blue-600">{placarComparativo.venceuA}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <div className="text-[11px] font-semibold text-gray-500 mb-0.5">Empates</div>
                  <div className="text-3xl font-black text-gray-500">{placarComparativo.empatados}</div>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <div className="text-[11px] font-semibold text-orange-700 mb-0.5">{jogadorB}</div>
                  <div className="text-3xl font-black text-orange-500">{placarComparativo.venceuB}</div>
                </div>
              </div>
            </section>

            {/* Comparativo de estatísticas */}
            <section className="bg-white rounded-xl shadow-md p-4 mb-4 border border-gray-300">
              <StatBar valA={statsA.vitorias} valB={statsB.vitorias} label="Vitórias" />
              {comuns.length > 0 && <StatBar valA={confronto.vitoriasA} valB={confronto.vitoriasB} label="Confronto Direto" />}
              <StatBar valA={statsA.derrotas} valB={statsB.derrotas} label="Derrotas" invertido={true} />
              <StatBar valA={statsA.gols} valB={statsB.gols} label="Gols" />
              <StatBar valA={parseFloat(statsA.mediaGols)} valB={parseFloat(statsB.mediaGols)} label="Média de Gols" />
              <StatBar valA={statsA.assistencias} valB={statsB.assistencias} label="Assistências" />
              <StatBar valA={statsA.participacoesGols} valB={statsB.participacoesGols} label="Participações em Gols" />
              <StatBar valA={statsA.decisivo} valB={statsB.decisivo} label="Decisivo" />
              <StatBar valA={statsA.mvps} valB={statsB.mvps} label="MVP" />
              <StatBar valA={statsA.golsContra} valB={statsB.golsContra} label="Gol Contra" invertido={true} />
              <StatBar valA={statsA.invicto} valB={statsB.invicto} label="Invicto" />
              <StatBar valA={statsA.semSofrer} valB={statsB.semSofrer} label="Sem Sofrer Gols" />

              {/* Aproveitamento */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="grid grid-cols-[minmax(44px,1fr)_auto_minmax(44px,1fr)] items-center text-xs text-gray-500 mb-1 gap-2">
                  <span className={`justify-self-start ${parseFloat(statsA.aproveitamento) > parseFloat(statsB.aproveitamento) ? 'font-bold text-green-800 bg-green-100 px-1.5 rounded' : ''}`}>{statsA.aproveitamento}%</span>
                  <span className="font-medium text-gray-600 text-center">Aproveitamento</span>
                  <span className={`justify-self-end ${parseFloat(statsB.aproveitamento) > parseFloat(statsA.aproveitamento) ? 'font-bold text-green-800 bg-green-100 px-1.5 rounded' : ''}`}>{statsB.aproveitamento}%</span>
                </div>
              </div>
            </section>

          </>
        )}

        {(!jogadorA || !jogadorB || !statsA || !statsB) && (
          <div className="text-center py-12 text-gray-400">
            <span className="text-5xl block mb-3">⚔️</span>
            <p className="text-sm">Selecione dois jogadores acima para comparar</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
