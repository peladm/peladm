'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '../../../components/Layout';
import {
  ParticipanteTorneioLocal,
  CobrancaPenaltiLocal,
  obterTorneioAtivoLocal,
  obterEquipesTorneioLocal,
  obterPartidasTorneioLocal,
  salvarPartidasTorneioLocal,
  obterJogadoresEquipesLocal,
} from '../../../lib/torneioLocalService';

const CORES_EMOJIS = ['🔴', '🔵', '🟢', '🟡', '🟠', '🟣', '⚫', '⚪'];

const COR_EMOJI_MAP: Record<string, string> = {
  '🔴': '#ef4444', '🔵': '#3b82f6', '🟢': '#22c55e', '🟡': '#eab308',
  '🟠': '#f97316', '🟣': '#a855f7', '⚫': '#374151', '⚪': '#d1d5db', '⭐': '#f59e0b',
};

function corDoEmoji(e: string | null | undefined): string {
  return COR_EMOJI_MAP[e ?? ''] ?? '#94a3b8';
}

function gerarCobrador(idx: number): ParticipanteTorneioLocal {
  return { id: `cobrador_${idx}`, torneio_id: '', pelada_id: '', jogador_id: '', nome: `Cobrador ${idx + 1}`, nivel: 0, status: 'confirmado', origem: 'avulso', created_at: '' };
}

type Cobranca = CobrancaPenaltiLocal;

function checarVencedor(kicks: Cobranca[], rodadas: number): 'A' | 'B' | null {
  const gA = kicks.filter(k => k.equipe === 'A' && k.resultado === 'gol').length;
  const gB = kicks.filter(k => k.equipe === 'B' && k.resultado === 'gol').length;
  const nA = kicks.filter(k => k.equipe === 'A').length;
  const nB = kicks.filter(k => k.equipe === 'B').length;
  if (nA <= rodadas && nB <= rodadas) {
    const remA = rodadas - nA;
    const remB = rodadas - nB;
    if (gA > gB + remB) return 'A';
    if (gB > gA + remA) return 'B';
    if (nA === rodadas && nB === rodadas && gA !== gB) return gA > gB ? 'A' : 'B';
    return null;
  }
  // Morte súbita
  if (nA === nB && gA !== gB) return gA > gB ? 'A' : 'B';
  return null;
}

function PenaltisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partidaId = searchParams?.get('id') ?? null;

  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [torneioId, setTorneioId] = useState('');
  const [equipeAId, setEquipeAId] = useState('');
  const [equipeBId, setEquipeBId] = useState('');
  const [equipeANome, setEquipeANome] = useState('');
  const [equipeBNome, setEquipeBNome] = useState('');
  const [equipeAEmoji, setEquipeAEmoji] = useState('🔴');
  const [equipeBEmoji, setEquipeBEmoji] = useState('🔵');  const [fasePartida, setFasePartida] = useState('');
  const [rodadaPartida, setRodadaPartida] = useState(0);  const [ordemA, setOrdemA] = useState<ParticipanteTorneioLocal[]>([]);
  const [ordemB, setOrdemB] = useState<ParticipanteTorneioLocal[]>([]);

  // Configurações pré-jogo
  const [primeiroTime, setPrimeiroTime] = useState<'A' | 'B'>('A');
  const [cobradoresPorTime, setCobradoresPorTime] = useState(5);
  const [configurado, setConfigurado] = useState(false);

  const [kicks, setKicks] = useState<Cobranca[]>([]);
  const [finalizado, setFinalizado] = useState(false);
  const [vencedor, setVencedor] = useState<'A' | 'B' | null>(null);

  // Drag
  const ordemARef = useRef<ParticipanteTorneioLocal[]>([]);
  const ordemBRef = useRef<ParticipanteTorneioLocal[]>([]);
  useEffect(() => { ordemARef.current = ordemA; }, [ordemA]);
  useEffect(() => { ordemBRef.current = ordemB; }, [ordemB]);
  const htmlDragFrom = useRef<{ equipe: 'A' | 'B'; idx: number } | null>(null);
  const [dragOver, setDragOver] = useState<{ equipe: 'A' | 'B'; idx: number } | null>(null);
  const [dragging, setDragging] = useState<{ equipe: 'A' | 'B'; idx: number } | null>(null);
  const touchState = useRef<{ equipe: 'A' | 'B'; fromIdx: number; startY: number; currentIdx: number; itemHeight: number } | null>(null);

  // ── Carregar ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!partidaId) { setErro('Partida não encontrada'); return; }
    const torneio = obterTorneioAtivoLocal();
    if (!torneio) { setErro('Torneio não encontrado'); return; }
    setTorneioId(torneio.id);

    const partidas = obterPartidasTorneioLocal(torneio.id);
    const partida = partidas.find(p => p.id === partidaId);
    if (!partida) { setErro('Partida não encontrada'); return; }

    const equipes = obterEquipesTorneioLocal(torneio.id);
    const eqA = equipes.find(e => e.id === partida.equipe_a_id);
    const eqB = equipes.find(e => e.id === partida.equipe_b_id);
    const idxA = equipes.findIndex(e => e.id === partida.equipe_a_id);
    const idxB = equipes.findIndex(e => e.id === partida.equipe_b_id);

    setEquipeAId(partida.equipe_a_id);
    setEquipeBId(partida.equipe_b_id);
    setEquipeANome(eqA?.nome ?? 'Time A');
    setEquipeBNome(eqB?.nome ?? 'Time B');
    setEquipeAEmoji(eqA?.cor ?? CORES_EMOJIS[idxA] ?? '🔴');
    setEquipeBEmoji(eqB?.cor ?? CORES_EMOJIS[idxB] ?? '🔵');
    setFasePartida(partida.fase ?? '');
    setRodadaPartida(partida.rodada ?? 0);

    const mapa = obterJogadoresEquipesLocal(torneio.id);
    const jogA = mapa[partida.equipe_a_id] ?? eqA?.jogadores ?? [];
    const jogB = mapa[partida.equipe_b_id] ?? eqB?.jogadores ?? [];
    setOrdemA(jogA.length > 0 ? jogA : Array.from({ length: 5 }, (_, i) => gerarCobrador(i)));
    setOrdemB(jogB.length > 0 ? jogB : Array.from({ length: 5 }, (_, i) => gerarCobrador(i)));

    // Se já há pênaltis salvos (modo edição), carrega direto sem setup
    if (partida.penaltis_kicks && partida.penaltis_kicks.length > 0) {
      setKicks(partida.penaltis_kicks);
      setConfigurado(true);
      // Descobre se já estava finalizado (tinha vencedor)
      if (partida.vencedor_id) {
        const w: 'A' | 'B' = partida.vencedor_id === partida.equipe_a_id ? 'A' : 'B';
        setVencedor(w);
        setFinalizado(true);
      }
    }

    setCarregado(true);
  }, [partidaId]);

  // ── Drag HTML5 ────────────────────────────────────────────────────────────

  const onDragStart = (equipe: 'A' | 'B', idx: number) => { htmlDragFrom.current = { equipe, idx }; setDragging({ equipe, idx }); };
  const onDragEnter = (equipe: 'A' | 'B', idx: number) => { if (!htmlDragFrom.current || htmlDragFrom.current.equipe !== equipe) return; setDragOver({ equipe, idx }); };
  const onDrop = (equipe: 'A' | 'B', toIdx: number) => {
    if (!htmlDragFrom.current || htmlDragFrom.current.equipe !== equipe) return;
    const from = htmlDragFrom.current.idx;
    if (from === toIdx) return;
    const setter = equipe === 'A' ? setOrdemA : setOrdemB;
    setter(prev => { const a = [...prev]; const [it] = a.splice(from, 1); a.splice(toIdx, 0, it); return a; });
    htmlDragFrom.current = null; setDragOver(null); setDragging(null);
  };
  const onDragEnd = () => { htmlDragFrom.current = null; setDragOver(null); setDragging(null); };

  // ── Touch drag ────────────────────────────────────────────────────────────

  const iniciarTouchDrag = useCallback((e: React.TouchEvent, equipe: 'A' | 'B', idx: number) => {
    e.stopPropagation();
    const h = (e.currentTarget as HTMLElement).closest('[data-item]')?.getBoundingClientRect().height ?? 50;
    touchState.current = { equipe, fromIdx: idx, startY: e.touches[0].clientY, currentIdx: idx, itemHeight: h };
    setDragging({ equipe, idx });
    const onMove = (ev: TouchEvent) => {
      if (!touchState.current) return;
      ev.preventDefault();
      const delta = Math.round((ev.touches[0].clientY - touchState.current.startY) / touchState.current.itemHeight);
      const lista = touchState.current.equipe === 'A' ? ordemARef.current : ordemBRef.current;
      const ni = Math.max(0, Math.min(lista.length - 1, touchState.current.fromIdx + delta));
      touchState.current.currentIdx = ni;
      setDragOver({ equipe: touchState.current.equipe, idx: ni });
    };
    const onEnd = () => {
      if (!touchState.current) return;
      const { fromIdx, currentIdx, equipe: eq } = touchState.current;
      if (fromIdx !== currentIdx) {
        const setter = eq === 'A' ? setOrdemA : setOrdemB;
        setter(prev => { const a = [...prev]; const [it] = a.splice(fromIdx, 1); a.splice(currentIdx, 0, it); return a; });
      }
      touchState.current = null; setDragOver(null); setDragging(null);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }, []);

  // ── Lógica cobranças ──────────────────────────────────────────────────────

  const kicksA = kicks.filter(k => k.equipe === 'A');
  const kicksB = kicks.filter(k => k.equipe === 'B');
  const nA = kicksA.length;
  const nB = kicksB.length;
  const totalKicks = kicks.length;

  // Time que começa na rodada 0 é o "primeiroTime"; alterna em seguida
  const segundo: 'A' | 'B' = primeiroTime === 'A' ? 'B' : 'A';
  const equipeAtual: 'A' | 'B' = totalKicks % 2 === 0 ? primeiroTime : segundo;

  const golsA = kicksA.filter(k => k.resultado === 'gol').length;
  const golsB = kicksB.filter(k => k.resultado === 'gol').length;
  const isSuddenDeath = nA >= cobradoresPorTime && nB >= cobradoresPorTime;

  const corA = corDoEmoji(equipeAEmoji);
  const corB = corDoEmoji(equipeBEmoji);
  const corAtual = equipeAtual === 'A' ? corA : corB;
  const nomeTimeAtual = equipeAtual === 'A' ? equipeANome : equipeBNome;
  const emojiTimeAtual = equipeAtual === 'A' ? equipeAEmoji : equipeBEmoji;
  const currentPlayerIdx = (equipeAtual === 'A' ? nA : nB) % Math.max((equipeAtual === 'A' ? ordemA : ordemB).length, 1);
  const jogadorAtual = (equipeAtual === 'A' ? ordemA : ordemB)[currentPlayerIdx];

  const registrarKick = (resultado: 'gol' | 'erro') => {
    if (finalizado) return;
    const lista = equipeAtual === 'A' ? ordemA : ordemB;
    const pIdx = (equipeAtual === 'A' ? nA : nB) % Math.max(lista.length, 1);
    const jogador = lista[pIdx];
    const newKicks: Cobranca[] = [...kicks, { equipe: equipeAtual, jogadorId: jogador?.id ?? 'anon', jogadorNome: jogador?.nome ?? '?', resultado }];
    setKicks(newKicks);
    const winner = checarVencedor(newKicks, cobradoresPorTime);
    // Persiste as cobranças parciais sempre (para VAR após reload)
    if (torneioId && partidaId) {
      const partidas = obterPartidasTorneioLocal(torneioId);
      if (winner) {
        const vId = winner === 'A' ? equipeAId : equipeBId;
        salvarPartidasTorneioLocal(torneioId, partidas.map(p =>
          p.id !== partidaId ? p : { ...p, status: 'finalizada' as const, vencedor_id: vId, penaltis_kicks: newKicks, proximo_desempate: undefined, updated_at: new Date().toISOString() }
        ));
      } else {
        salvarPartidasTorneioLocal(torneioId, partidas.map(p =>
          p.id !== partidaId ? p : { ...p, penaltis_kicks: newKicks, updated_at: new Date().toISOString() }
        ));
      }
      window.dispatchEvent(new CustomEvent('partida-torneio-changed'));
    }
    if (winner) {
      setVencedor(winner);
      setFinalizado(true);
    }
  };

  const desfazerKick = () => {
    if (kicks.length === 0) return;
    setKicks(prev => prev.slice(0, -1));
    setFinalizado(false);
    setVencedor(null);
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (!carregado) {
    return (
      <Layout title="Pênaltis">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
          <p style={{ color: erro ? '#ef4444' : '#6b7280', fontSize: 14 }}>{erro ?? 'Carregando...'}</p>
        </div>
      </Layout>
    );
  }

  // ── Modal de setup ────────────────────────────────────────────────────────

  if (!configurado) {
    return (
      <Layout title="Pênaltis">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ background: 'white', borderRadius: 20, border: '1px solid #e5e7eb', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 6 }}>🥅</div>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#111827' }}>Disputa de Pênaltis</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>{equipeANome} · {equipeAEmoji} vs {equipeBEmoji} · {equipeBNome}</p>
            </div>

            <div style={{ height: 1, background: '#f3f4f6' }} />

            {/* Quem cobra primeiro? */}
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151', textAlign: 'center' }}>Quem cobra primeiro?</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['A', 'B'] as const).map(eq => {
                  const cor = eq === 'A' ? corA : corB;
                  const emoji = eq === 'A' ? equipeAEmoji : equipeBEmoji;
                  const nome = eq === 'A' ? equipeANome : equipeBNome;
                  const ativo = primeiroTime === eq;
                  return (
                    <button
                      key={eq}
                      onClick={() => setPrimeiroTime(eq)}
                      style={{ flex: 1, padding: '12px 8px', borderRadius: 14, border: `2px solid ${ativo ? cor : '#e5e7eb'}`, background: ativo ? cor + '14' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s' }}
                    >
                      <span style={{ fontSize: 18 }}>{emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: ativo ? 800 : 600, color: ativo ? cor : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cobranças por time */}
            <div>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#374151', textAlign: 'center' }}>Cobranças por time</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {[3, 4, 5, 6].map(n => (
                  <button
                    key={n}
                    onClick={() => setCobradoresPorTime(n)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: `2px solid ${cobradoresPorTime === n ? '#374151' : '#e5e7eb'}`, background: cobradoresPorTime === n ? '#f3f4f6' : 'white', cursor: 'pointer', fontSize: 16, fontWeight: cobradoresPorTime === n ? 900 : 500, color: cobradoresPorTime === n ? '#111827' : '#9ca3af', transition: 'all 0.15s' }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setConfigurado(true)}
              style={{ width: '100%', padding: '16px 0', borderRadius: 16, background: '#111827', border: 'none', color: 'white', fontWeight: 900, fontSize: 15, cursor: 'pointer' }}
            >
              Iniciar disputa
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Coluna de jogadores ───────────────────────────────────────────────────

  const renderColuna = (equipe: 'A' | 'B') => {
    const lista = equipe === 'A' ? ordemA : ordemB;
    const cor = equipe === 'A' ? corA : corB;
    const emoji = equipe === 'A' ? equipeAEmoji : equipeBEmoji;
    const nome = equipe === 'A' ? equipeANome : equipeBNome;
    const teamKicks = equipe === 'A' ? kicksA : kicksB;
    const nDone = equipe === 'A' ? nA : nB;
    const isCurrTeam = equipeAtual === equipe && !finalizado;
    const currIdx = nDone % Math.max(lista.length, 1);
    const slotsCount = isSuddenDeath ? Math.max(nDone + (isCurrTeam ? 1 : 0), nDone) : cobradoresPorTime;

    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, padding: '6px 8px', background: cor + '14', borderRadius: 10, border: `1px solid ${cor}28` }}>
          <span style={{ fontSize: 15 }}>{emoji}</span>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 11, color: cor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{nome}</p>
        </div>

        {/* Players */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {Array.from({ length: slotsCount }, (_, slot) => {
            const playerIdx = slot % lista.length;
            const player = lista[playerIdx];
            const kicked = slot < nDone;
            const kick = kicked ? teamKicks[slot] : undefined;
            const isCurr = isCurrTeam && slot === currIdx && !kicked;
            const isDraggingItem = dragging?.equipe === equipe && dragging?.idx === playerIdx;
            const isDragOver = dragOver?.equipe === equipe && dragOver?.idx === playerIdx;
            const isSDDivider = slot === cobradoresPorTime && isSuddenDeath;

            return (
              <div key={`${equipe}-${slot}`}>
                {isSDDivider && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, margin: '4px 0' }}>
                    <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
                    <span style={{ fontSize: 8, color: '#d1d5db', fontWeight: 700, textTransform: 'uppercase' }}>SD</span>
                    <div style={{ flex: 1, height: 1, background: '#f3f4f6' }} />
                  </div>
                )}
                <div
                  data-item
                  draggable={!kicked}
                  onDragStart={() => !kicked && onDragStart(equipe, playerIdx)}
                  onDragEnter={() => !kicked && onDragEnter(equipe, playerIdx)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => !kicked && onDrop(equipe, playerIdx)}
                  onDragEnd={onDragEnd}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5, padding: '8px 6px', borderRadius: 10,
                    background: isCurr ? cor + '18' : isDragOver ? cor + '0e' : kicked ? (kick?.resultado === 'gol' ? '#f0fdf4' : '#fef2f2') : 'white',
                    border: `1.5px solid ${isCurr ? cor : isDragOver ? cor + '50' : kicked ? (kick?.resultado === 'gol' ? '#bbf7d0' : '#fecaca') : '#f3f4f6'}`,
                    opacity: isDraggingItem ? 0.3 : 1,
                    cursor: kicked ? 'default' : 'grab',
                    transform: isCurr ? 'scale(1.015)' : undefined,
                    boxShadow: isCurr ? `0 2px 8px ${cor}35` : undefined,
                    transition: 'all 0.1s',
                  }}
                >
                  {!kicked && (
                    <div
                      onTouchStart={e => iniciarTouchDrag(e, equipe, playerIdx)}
                      style={{ display: 'flex', flexDirection: 'column', gap: 2.5, padding: '0 1px', cursor: 'grab', flexShrink: 0, touchAction: 'none' }}
                    >
                      {[0, 1, 2].map(r => (
                        <div key={r} style={{ display: 'flex', gap: 2 }}>
                          {[0, 1].map(c => <div key={c} style={{ width: 2.5, height: 2.5, borderRadius: '50%', background: isCurr ? cor + 'aa' : '#d1d5db' }} />)}
                        </div>
                      ))}
                    </div>
                  )}
                  {kicked ? (
                    <div style={{ width: 20, height: 20, borderRadius: 99, flexShrink: 0, background: kick?.resultado === 'gol' ? '#dcfce7' : '#fee2e2', border: `2px solid ${kick?.resultado === 'gol' ? '#22c55e' : '#ef4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: kick?.resultado === 'gol' ? '#16a34a' : '#dc2626' }}>
                      {kick?.resultado === 'gol' ? '✓' : '✗'}
                    </div>
                  ) : (
                    <div style={{ width: 18, height: 18, borderRadius: 99, flexShrink: 0, background: isCurr ? cor + '20' : '#f9fafb', border: `1.5px solid ${isCurr ? cor + '60' : '#e5e7eb'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 8, fontWeight: 900, color: isCurr ? cor : '#9ca3af' }}>{slot + 1}</span>
                    </div>
                  )}
                  <p style={{ margin: 0, fontSize: 12, fontWeight: isCurr ? 800 : 600, color: isCurr ? '#111827' : kicked ? '#374151' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {player?.nome ?? '?'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Tela finalizado ───────────────────────────────────────────────────────

  if (finalizado && vencedor) {
    const vNome = vencedor === 'A' ? equipeANome : equipeBNome;
    const vCor = vencedor === 'A' ? corA : corB;
    const vEmoji = vencedor === 'A' ? equipeAEmoji : equipeBEmoji;

    const fasesLiga = ['Liga', 'Turno', 'Returno', 'Grupos'];
    const labelFase = fasePartida
      ? fasesLiga.includes(fasePartida)
        ? `${fasePartida} – Rodada ${rodadaPartida}`
        : fasePartida
      : '';

    return (
      <Layout title="Pênaltis">
        <div style={{ textAlign: 'center', paddingTop: 16 }}>
          {labelFase && (
            <div style={{ display: 'inline-block', background: '#f3f4f6', borderRadius: 99, padding: '4px 14px', marginBottom: 12, fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {labelFase}
            </div>
          )}
          <div style={{ fontSize: 52, marginBottom: 8 }}>🏆</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>{vEmoji}</span>
            <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: vCor }}>{vNome}</p>
          </div>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280', fontWeight: 600 }}>vence nos pênaltis!</p>

          <div style={{ display: 'inline-block', background: 'white', borderRadius: 20, padding: '16px 28px', border: '1px solid #e5e7eb', marginBottom: 14 }}>
            <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: '#d1d5db', textTransform: 'uppercase' }}>Pênaltis</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div><p style={{ margin: 0, fontSize: 48, fontWeight: 900, color: corA, lineHeight: 1 }}>{golsA}</p><p style={{ margin: '3px 0 0', fontSize: 10, color: '#9ca3af' }}>{equipeANome}</p></div>
              <span style={{ fontSize: 18, color: '#d1d5db' }}>×</span>
              <div><p style={{ margin: 0, fontSize: 48, fontWeight: 900, color: corB, lineHeight: 1 }}>{golsB}</p><p style={{ margin: '3px 0 0', fontSize: 10, color: '#9ca3af' }}>{equipeBNome}</p></div>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e5e7eb', padding: '12px 16px', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              {(['A', 'B'] as const).map(eq => {
                const eKicks = kicks.filter(k => k.equipe === eq);
                const c = eq === 'A' ? corA : corB;
                const n = eq === 'A' ? equipeANome : equipeBNome;
                return (
                  <div key={eq} style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 800, color: c, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{n}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {eKicks.map((k, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 99, flexShrink: 0, background: k.resultado === 'gol' ? '#dcfce7' : '#fee2e2', border: `2px solid ${k.resultado === 'gol' ? '#22c55e' : '#ef4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: k.resultado === 'gol' ? '#16a34a' : '#dc2626' }}>
                            {k.resultado === 'gol' ? '✓' : '✗'}
                          </div>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: k.resultado === 'gol' ? '#374151' : '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.jogadorNome ?? `Cobrador ${i + 1}`}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={() => router.push('/modo-torneio/painel?aba=jogos')} style={{ padding: '14px 40px', borderRadius: 16, background: '#22c55e', border: 'none', color: 'white', fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px #22c55e40' }}>
            ✓ Concluir
          </button>
        </div>
      </Layout>
    );
  }

  // ── Tela principal ────────────────────────────────────────────────────────

  return (
    <Layout title="Pênaltis">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Placar ── */}
        <div style={{ background: 'white', borderRadius: 18, border: '1px solid #e5e7eb', padding: '12px 16px' }}>
          <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
            {isSuddenDeath ? '⚡ Morte súbita' : `🥅 Pênaltis · ${Math.min(totalKicks, cobradoresPorTime * 2)} / ${cobradoresPorTime * 2}`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: corA, marginBottom: 2 }}>{equipeANome}</p>
              <p style={{ margin: 0, fontSize: 42, fontWeight: 900, color: corA, lineHeight: 1 }}>{golsA}</p>
            </div>
            <span style={{ fontSize: 20, color: '#d1d5db', fontWeight: 700 }}>×</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: corB, marginBottom: 2 }}>{equipeBNome}</p>
              <p style={{ margin: 0, fontSize: 42, fontWeight: 900, color: corB, lineHeight: 1 }}>{golsB}</p>
            </div>
          </div>
        </div>

        {/* ── Cobrador atual + configs ── */}
        <div style={{ background: 'white', borderRadius: 18, border: `2px solid ${corAtual}`, padding: '14px 16px' }}>

          {/* Cobrador */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 10 }}>
            <span style={{ fontSize: 14 }}>{emojiTimeAtual}</span>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#374151' }}>
              {nomeTimeAtual}{' '}
              <span style={{ fontWeight: 500, color: '#9ca3af' }}>próximo cobrador</span>
            </p>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 900, color: '#111827', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {jogadorAtual?.nome ?? '?'}
          </p>

          {/* Botões ✗ e ⚽ */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => registrarKick('erro')}
              className="active:scale-95 transition-transform"
              style={{ flex: 1, padding: '18px 0', borderRadius: 14, background: '#fee2e2', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 30, lineHeight: 1, color: '#ef4444', fontWeight: 900 }}>✗</span>
            </button>
            <button
              onClick={() => registrarKick('gol')}
              className="active:scale-95 transition-transform"
              style={{ flex: 1, padding: '18px 0', borderRadius: 14, background: '#dcfce7', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 30, lineHeight: 1 }}>⚽</span>
            </button>
          </div>
        </div>

        {/* ── Times lado a lado ── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {renderColuna('A')}
          {renderColuna('B')}
        </div>

        {/* ── VAR — desfazer última cobrança ── */}
        {kicks.length > 0 && (
          <button
            onClick={desfazerKick}
            className="active:scale-95 transition-transform"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px 0', borderRadius: 14, background: '#fefce8', border: '1.5px solid #fde68a', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 18 }}>📺</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>VAR — desfazer última cobrança</span>
          </button>
        )}

        {/* ── Eventos ── */}
        {kicks.length > 0 && (
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #f3f4f6', padding: '12px 14px' }}>
            <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, color: '#d1d5db', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Histórico
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[...kicks].reverse().map((k, i) => {
                const c = k.equipe === 'A' ? corA : corB;
                const n = k.equipe === 'A' ? equipeANome : equipeBNome;
                const num = kicks.length - i;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: 99, flexShrink: 0, background: k.resultado === 'gol' ? '#dcfce7' : '#fee2e2', border: `2px solid ${k.resultado === 'gol' ? '#22c55e' : '#ef4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: k.resultado === 'gol' ? '#16a34a' : '#dc2626' }}>
                      {k.resultado === 'gol' ? '✓' : '✗'}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, flex: 1 }}>
                      <span style={{ fontWeight: 700, color: c }}>{n}</span>
                      <span style={{ color: '#9ca3af' }}> · {k.jogadorNome}</span>
                    </p>
                    <span style={{ fontSize: 10, color: '#d1d5db', flexShrink: 0 }}>#{num}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}


export default function PenaltisPageWrapper() {
  return (
    <Suspense fallback={null}>
      <PenaltisPage />
    </Suspense>
  );
}
