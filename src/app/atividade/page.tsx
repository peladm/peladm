'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../components/Layout';
import { createClient } from '@supabase/supabase-js';
import { buscar_plano, buscar_pelada_id, buscar_supabase_url, buscar_supabase_anon_key } from '../../lib/credenciais';

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
  recemCadastrado: boolean;
}

export default function AtividadePage() {
  const router = useRouter();
  const plano = buscar_plano();
  const LIMITE_SESSOES = 10;

  const [jogadores, setJogadores] = useState<JogadorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [totalSessoes, setTotalSessoes] = useState(0);
  const [totalSessoesComJogo, setTotalSessoesComJogo] = useState(0);
  const [filtro, setFiltro] = useState<'inativos' | 'alerta' | 'ativos'>('inativos');
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    if (plano === 'free') {
      alert('🚫 Controle de Atividade disponível apenas para Gold e Premium.');
      router.push('/');
      return;
    }
    carregarDados();
  }, [plano, router]);

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

  const carregarDados = async () => {
    setLoading(true);
    setErro(null);
    try {
      const peladaId = buscar_pelada_id();
      if (!peladaId) { setErro('Usuário não autenticado.'); setLoading(false); return; }

      const supabaseUrl = buscar_supabase_url();
      const supabaseKey = buscar_supabase_anon_key();
      const isPremiun = plano === 'premium' && supabaseUrl && supabaseKey;

      // ── Buscar jogadores ──────────────────────────────────────────
      let jogadoresList: any[] = [];
      if (isPremiun) {
        const sb = createClient(supabaseUrl!, supabaseKey!);
        let data: any[] | null = null;
        let error: any = null;

        // Compatível com banco antigo (sem created_at) e novo (com created_at)
        const tentativaComCreatedAt = await sb
          .from('jogadores')
          .select('id, nome, nivel, status, created_at')
          .eq('pelada_id', peladaId);

        if (tentativaComCreatedAt.error) {
          const tentativaSemCreatedAt = await sb
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
      } else {
        const local = localStorage.getItem(`jogadores_${peladaId}`);
        jogadoresList = local ? JSON.parse(local) : [];
      }

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

      if (isPremiun) {
        const sb = createClient(supabaseUrl!, supabaseKey!);

        const { data: sessoes, error: errSessoes } = await sb
          .from('sessoes')
          .select('id, data')
          .eq('pelada_id', peladaId)
          .eq('status', 'finalizada')
          .order('data', { ascending: false })
          .limit(LIMITE_SESSOES);

        if (errSessoes) throw new Error('Erro ao buscar sessões: ' + errSessoes.message);

        todasSessoes = (sessoes || []).map((sessao: any) => ({
          id: sessao.id,
          data: sessao.data || '',
        }));

        const { data: jogos, error: errJogos } = await sb
          .from('jogos')
          .select('sessao_id, time_a, time_b, created_at')
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
      } else {
        // Free/Gold: varrer localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('jogos_')) {
            const sessaoId = key.replace('jogos_', '');
            const jogosArr: any[] = JSON.parse(localStorage.getItem(key) || '[]');
            if (jogosArr.length > 0) {
              sessoesComJogo.add(sessaoId);
              const createdAt = jogosArr.find((j: any) => j.created_at)?.created_at || '';
              const data = createdAt ? new Date(createdAt).toISOString().split('T')[0] : '';
              todasSessoes.push({ id: sessaoId, data });
              jogosArr.forEach((jogo: any) => {
                const participantes = [...extrairIdsDoTime(jogo.time_a), ...extrairIdsDoTime(jogo.time_b)];
                participantes.forEach((referencia: string) => {
                  const chaveNome = nomePorId.get(String(referencia)) || normalizarTexto(referencia);

                  if (participacaoPorNome[chaveNome]) {
                    participacaoPorNome[chaveNome].add(sessaoId);
                  }
                });
              });
            }
          }
        }

        todasSessoes = todasSessoes
          .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
          .slice(0, LIMITE_SESSOES);
      }

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

        let risco: Risco;
        if (statusAtual === 'inativo') {
          risco = 'ausente';
        } else if (recemCadastrado) {
          risco = 'ativo';
        } else if (faltasConsecutivas >= 4) {
          risco = 'ausente';
        } else if (faltasConsecutivas >= 2) {
          risco = 'risco';
        } else {
          risco = 'ativo';
        }

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
          taxaPresenca: sessoesConsideradas.length > 0
            ? Math.round((totalParticipou / sessoesConsideradas.length) * 100)
            : null,
          sessoesConsideradas: sessoesConsideradas.length,
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

      // Atualiza Supabase se Premium
      if (plano === 'premium') {
        const supabaseUrl = buscar_supabase_url();
        const supabaseKey = buscar_supabase_anon_key();
        if (supabaseUrl && supabaseKey) {
          const sb = createClient(supabaseUrl, supabaseKey);
          await sb
            .from('jogadores')
            .update({ status: novoStatus })
            .in('id', jogador.idsCadastro)
            .eq('pelada_id', peladaId);
        }
      }

      // Atualiza estado local
      setJogadores(prev => prev.map(j => {
        if (j.nomeNormalizado !== jogador.nomeNormalizado) return j;
        const novoRisco: Risco = novoStatus === 'inativo'
          ? 'ausente'
          : j.faltasConsecutivas >= 4 ? 'ausente' : j.faltasConsecutivas >= 2 ? 'risco' : 'ativo';
        return { ...j, status: novoStatus, risco: novoRisco };
      }));
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    } finally {
      setSalvando(null);
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
        <div className="bg-white border border-indigo-100 rounded-xl shadow-sm px-3 py-2 text-center">
          <h1 className="text-xl font-bold text-indigo-700 leading-tight">
            Controle de Atividade
          </h1>
          <p className="text-xs text-gray-500 mt-1 leading-tight">
            {loading
              ? 'Carregando dados...'
              : totalSessoes > 0
                  ? `Últimas ${LIMITE_SESSOES} peladas finalizadas`
                : plano === 'premium'
                  ? 'Nenhuma pelada finalizada encontrada no banco'
                  : 'Dados da sessão atual'}
          </p>
        </div>
      </div>

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
          <button onClick={carregarDados} className="ml-3 underline font-semibold">Tentar novamente</button>
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
