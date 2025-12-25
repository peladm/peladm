'use client';

import React, { useState, useEffect } from 'react';

interface Jogador {
  id: string;
  nome: string;
  apelido?: string;
}

interface Gol {
  jogo_id: string;
  jogador_id: string;
  time: 'A' | 'B';
}

interface Jogo {
  id: string;
  time_a: string[];
  time_b: string[];
  placar_a: number;
  placar_b: number;
  data_inicio?: string;
  data_fim?: string;
  gols?: Gol[];
}

export default function SharePage() {
  const [jogo, setJogo] = useState<Jogo | null>(null);
  const [numeroPartida, setNumeroPartida] = useState(1);
  const [jogadores, setJogadores] = useState<{ [id: string]: Jogador }>({});

  useEffect(() => {
    // Carregar dados do sessionStorage
    const jogoData = sessionStorage.getItem('shareJogo');
    const numeroData = sessionStorage.getItem('shareNumeroPartida');
    const jogadoresData = sessionStorage.getItem('shareJogadores');

    if (jogoData) {
      setJogo(JSON.parse(jogoData));
    }
    if (numeroData) {
      setNumeroPartida(parseInt(numeroData));
    }
    if (jogadoresData) {
      setJogadores(JSON.parse(jogadoresData));
    }
  }, []);

  const buscarJogador = (jogadorId: string): string => {
    const jogador = jogadores[jogadorId];
    return jogador ? (jogador.apelido || jogador.nome) : jogadorId.substring(0, 8);
  };

  if (!jogo) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(to bottom, #ffffff, #f9fafb)',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚽</div>
          <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>Carregando resultado...</p>
        </div>
      </div>
    );
  }

  let duracao = '';
  let horario = '';
  if (jogo.data_inicio && jogo.data_fim) {
    const inicio = new Date(jogo.data_inicio);
    const fim = new Date(jogo.data_fim);
    const duracaoMs = fim.getTime() - inicio.getTime();
    const duracaoSeg = Math.floor(duracaoMs / 1000);
    const minutos = Math.floor(duracaoSeg / 60);
    const segundos = duracaoSeg % 60;
    duracao = `${minutos}:${String(segundos).padStart(2, '0')}`;
    horario = inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #ffffff, #f9fafb)',
      padding: '2rem 1rem',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '1rem',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        padding: '2rem',
        overflow: 'hidden'
      }}>
        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '2.5rem', 
            fontWeight: 'bold', 
            color: '#1f2937',
            margin: '0 0 0.5rem 0'
          }}>
            Partida #{numeroPartida}
          </h1>
          {duracao && horario && (
            <p style={{ 
              fontSize: '1.125rem', 
              color: '#6b7280',
              margin: 0
            }}>
              ⏱️ {duracao} • 🕐 {horario}
            </p>
          )}
        </div>

        {/* Linha decorativa */}
        <div style={{
          height: '2px',
          background: '#e5e7eb',
          margin: '1.5rem 0'
        }} />

        {/* Placar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '2rem',
          margin: '2rem 0'
        }}>
          <div style={{
            fontSize: '5rem',
            fontWeight: 'bold',
            color: '#22c55e'
          }}>
            {jogo.placar_a}
          </div>
          <div style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#9ca3af'
          }}>
            VS
          </div>
          <div style={{
            fontSize: '5rem',
            fontWeight: 'bold',
            color: '#374151'
          }}>
            {jogo.placar_b}
          </div>
        </div>

        {/* Times */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          marginTop: '2rem'
        }}>
          {/* Time 1 */}
          <div>
            <div style={{
              background: '#dcfce7',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              marginBottom: '0.75rem'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#15803d',
                textAlign: 'center'
              }}>
                Time 1
              </h3>
            </div>
            <div style={{ padding: '0 0.5rem' }}>
              {jogo.time_a.map((jogadorId, idx) => {
                const nome = buscarJogador(jogadorId);
                const gols = (jogo.gols || []).filter(g => g.jogador_id === jogadorId && g.time === 'A').length;
                return (
                  <div key={idx} style={{
                    padding: '0.5rem 0',
                    fontSize: '1rem',
                    color: '#1f2937',
                    borderBottom: idx < jogo.time_a.length - 1 ? '1px solid #f3f4f6' : 'none'
                  }}>
                    {nome} {gols > 0 && '⚽'.repeat(gols)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time 2 */}
          <div>
            <div style={{
              background: '#f3f4f6',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              marginBottom: '0.75rem'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#374151',
                textAlign: 'center'
              }}>
                Time 2
              </h3>
            </div>
            <div style={{ padding: '0 0.5rem' }}>
              {jogo.time_b.map((jogadorId, idx) => {
                const nome = buscarJogador(jogadorId);
                const gols = (jogo.gols || []).filter(g => g.jogador_id === jogadorId && g.time === 'B').length;
                return (
                  <div key={idx} style={{
                    padding: '0.5rem 0',
                    fontSize: '1rem',
                    color: '#1f2937',
                    borderBottom: idx < jogo.time_b.length - 1 ? '1px solid #f3f4f6' : 'none'
                  }}>
                    {nome} {gols > 0 && '⚽'.repeat(gols)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div style={{
          textAlign: 'center',
          marginTop: '3rem',
          paddingTop: '1.5rem',
          borderTop: '2px solid #e5e7eb',
          color: '#9ca3af',
          fontSize: '0.875rem'
        }}>
          PelADM • {new Date().toLocaleDateString('pt-BR')}
        </div>
      </div>
    </div>
  );
}
