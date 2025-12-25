'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface Jogador {
  id: string;
  nome: string;
  posicao?: string;
  status: string;
  pelada_id: string;
}

interface JogadorFila {
  id: string;
  nome: string;
  posicao_fila: number;
  status: 'jogando' | 'fila' | 'reserva';
}

interface Regras {
  jogadores_por_time: number;
}

export default function FilaPage() {
  const [filaCompleta, setFilaCompleta] = useState<JogadorFila[]>([]);
  const [jogadoresJogando, setJogadoresJogando] = useState<JogadorFila[]>([]);
  const [jogadoresFila, setJogadoresFila] = useState<JogadorFila[]>([]);
  const [jogadoresReserva, setJogadoresReserva] = useState<JogadorFila[]>([]);
  const [regras, setRegras] = useState<Regras>({ jogadores_por_time: 5 });
  const [totalPartidas, setTotalPartidas] = useState(0);
  const [totalGols, setTotalGols] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showManagementModal, setShowManagementModal] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setIsLoading(true);
      
      const userData = localStorage.getItem('user');
      if (!userData) {
        window.location.href = '/login';
        return;
      }
      
      const user = JSON.parse(userData);
      const peladaId = user.id;
      
      console.log('📋 Carregando fila do Supabase...');
      
      // 1. CARREGAR REGRAS
      const { data: regrasData } = await supabase
        .from('regras')
        .select('*')
        .eq('pelada_id', peladaId)
        .single();
      
      if (regrasData) {
        setRegras({
          jogadores_por_time: regrasData.jogadores_por_time || 5
        });
      }
      
      // 2. BUSCAR SESSÃO ATIVA
      const { data: sessao } = await supabase
        .from('sessoes')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .single();
      
      if (!sessao) {
        console.log('❌ Nenhuma sessão ativa');
        setIsLoading(false);
        return;
      }
      
      // 3. CARREGAR DA TABELA FILA
      const { data: filaData } = await supabase
        .from('fila')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('sessao_id', sessao.id)
        .order('posicao_fila');
      
      // 4. CARREGAR DADOS DOS JOGADORES
      const { data: todosJogadores } = await supabase
        .from('jogadores')
        .select('*')
        .eq('pelada_id', peladaId);
      
      // 5. COMBINAR DADOS
      if (filaData && todosJogadores) {
        const jogandoItems = filaData.filter(item => item.status === 'jogando');
        const filaItems = filaData.filter(item => item.status === 'fila');
        const reservaItems = filaData.filter(item => item.status === 'reserva');
        
        const mapearJogadores = (items: any[]) => items.map(item => {
          const jogador = todosJogadores.find(j => j.id === item.jogador_id);
          return {
            id: item.jogador_id,
            nome: jogador?.nome || 'Desconhecido',
            posicao_fila: item.posicao_fila || 0,
            status: item.status as 'jogando' | 'fila' | 'reserva'
          };
        });
        
        setJogadoresJogando(mapearJogadores(jogandoItems));
        setJogadoresFila(mapearJogadores(filaItems));
        setJogadoresReserva(mapearJogadores(reservaItems));
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setIsLoading(false);
    }
  };

  const moverJogadorParaReserva = async (jogadorId: string) => {
    try {
      const userData = localStorage.getItem('user');
      const user = JSON.parse(userData!);
      const peladaId = user.id;
      
      await supabase
        .from('fila')
        .update({ status: 'reserva' })
        .eq('jogador_id', jogadorId)
        .eq('pelada_id', peladaId);
      
      await carregarDados();
    } catch (error) {
      console.error('Erro ao mover para reserva:', error);
    }
  };

  const moverReservaParaFila = async (jogadorId: string) => {
    try {
      const userData = localStorage.getItem('user');
      const user = JSON.parse(userData!);
      const peladaId = user.id;
      
      const ultimaPosicao = Math.max(...jogadoresFila.map(j => j.posicao_fila), 0);
      
      await supabase
        .from('fila')
        .update({ 
          status: 'fila',
          posicao_fila: ultimaPosicao + 1
        })
        .eq('jogador_id', jogadorId)
        .eq('pelada_id', peladaId);
      
      await carregarDados();
    } catch (error) {
      console.error('Erro ao mover para fila:', error);
    }
  };

  const organizarTimes = (jogadores: JogadorFila[], jogadoresPorTime: number) => {
    const times: JogadorFila[][] = [];
    for (let i = 0; i < jogadores.length; i += jogadoresPorTime) {
      times.push(jogadores.slice(i, i + jogadoresPorTime));
    }
    return times;
  };

  const organizarFilaEmBlocos = (jogadores: JogadorFila[], jogadoresPorTime: number) => {
    const blocos: JogadorFila[][] = [];
    for (let i = 0; i < jogadores.length; i += jogadoresPorTime) {
      blocos.push(jogadores.slice(i, i + jogadoresPorTime));
    }
    return blocos;
  };

  if (isLoading) {
    return (
      <div style={{ 
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: '#fff',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>📋</div>
          <div style={{ color: '#666' }}>Carregando fila...</div>
        </div>
      </div>
    );
  }

  const times = organizarTimes(jogadoresJogando, regras.jogadores_por_time);
  const blocosFila = organizarFilaEmBlocos(jogadoresFila, regras.jogadores_por_time);

  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      backgroundColor: '#fff',
      minHeight: '100vh',
      paddingBottom: '100px'
    }}>
      <main style={{ padding: '20px 16px' }}>
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          
          {/* Header */}
          <section style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #e0e0e0',
            borderRadius: '15px',
            padding: '20px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            <h2 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              margin: '0 0 8px 0',
              color: '#333'
            }}>📋 Organização da Fila 📋</h2>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {new Date().toLocaleDateString('pt-BR', { 
                weekday: 'long', 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
              })} • {jogadoresFila.length} jogadores
            </div>
          </section>

          {/* Times Próximos */}
          {times.length > 0 && (
            <section style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px'
              }}>
                {times.slice(0, 2).map((time, timeIndex) => (
                  <div key={timeIndex} style={{
                    backgroundColor: '#f8f9fa',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      backgroundColor: timeIndex === 0 ? '#28a745' : '#dc3545',
                      color: 'white',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      textAlign: 'center'
                    }}>
                      TIME {timeIndex + 1}
                    </div>
                    <div style={{ padding: '8px' }}>
                      <table style={{ width: '100%', fontSize: '12px' }}>
                        <tbody>
                          {time.map((jogador, index) => (
                            <tr key={jogador.id}>
                              <td style={{
                                padding: '4px 0',
                                color: '#333',
                                lineHeight: '24px'
                              }}>
                                {jogador.nome}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Botão Iniciar Partida */}
          {times.length >= 2 && (
            <section style={{ 
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <button style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}>
                ⚽ Iniciar Pelada ⚽
              </button>
            </section>
          )}

          {/* Fila de Espera */}
          {blocosFila.length > 0 && (
            <section style={{
              backgroundColor: '#f8f9fa',
              border: '1px solid #e0e0e0',
              borderRadius: '15px',
              padding: '20px',
              marginBottom: '20px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  margin: 0,
                  color: '#333'
                }}>📋 Fila de Espera</h3>
                <span style={{
                  fontSize: '12px',
                  color: '#666'
                }}>{jogadoresFila.length} aguardando</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {blocosFila.map((bloco, blocoIndex) => (
                  <div key={blocoIndex} style={{
                    backgroundColor: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '10px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      backgroundColor: '#6c757d',
                      color: 'white',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      textAlign: 'center'
                    }}>
                      {blocoIndex === 0 ? 'Próximo time' : `${blocoIndex + 1}º na fila`}
                    </div>
                    <div style={{ padding: '8px' }}>
                      <table style={{ width: '100%', fontSize: '12px' }}>
                        <tbody>
                          {bloco.map((jogador) => (
                            <tr key={jogador.id}>
                              <td style={{
                                padding: '2px 0',
                                color: '#333',
                                lineHeight: '20px'
                              }}>
                                {jogador.nome}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Estatísticas do Dia */}
          <section style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #e0e0e0',
            borderRadius: '15px',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ fontSize: '24px' }}>⚽</div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Peladas</div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#333' }}>{totalPartidas}</div>
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ fontSize: '24px' }}>🥅</div>
                <div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Gols</div>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#333' }}>{totalGols}</div>
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Footer Mobile */}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#fff',
        borderTop: '1px solid #e0e0e0',
        padding: '12px 0'
      }}>
        <nav style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center'
        }}>
          <button
            onClick={() => setShowManagementModal(true)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '8px'
            }}
          >
            👥
          </button>
          <a href="/fila" style={{
            fontSize: '24px',
            textDecoration: 'none'
          }}>
            📋
          </a>
          <a href="/partida" style={{
            fontSize: '24px',
            textDecoration: 'none'
          }}>
            ⚽
          </a>
          <button style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '8px'
          }}>
            🏁
          </button>
        </nav>
      </footer>

      {/* Modal de Gerenciamento */}
      {showManagementModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            width: '90%',
            maxWidth: '420px',
            height: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden'
          }}>
            
            {/* Header do Modal */}
            <div style={{
              padding: '20px 24px 16px',
              background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
              borderBottom: '2px solid #dee2e6',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: '#28a745',
                margin: 0
              }}>⚡ Gerenciar Jogadores</h3>
              <button
                onClick={() => setShowManagementModal(false)}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {/* Busca */}
            <div style={{
              padding: '16px 24px',
              background: '#f8f9fa',
              borderBottom: '1px solid #dee2e6'
            }}>
              <input
                type="text"
                placeholder="🔍 Buscar jogador..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e9ecef',
                  borderRadius: '12px',
                  fontSize: '16px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Layout de 2 colunas */}
            <div style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              minHeight: 0
            }}>
              
              {/* Coluna Reservas */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                borderRight: '2px solid #dee2e6'
              }}>
                <div style={{
                  padding: '12px',
                  background: '#f8f9fa',
                  borderBottom: '1px solid #dee2e6',
                  textAlign: 'center'
                }}>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#495057',
                    margin: '0 0 4px 0'
                  }}>🪑 Reservas ({jogadoresReserva.length})</h4>
                  <small style={{ fontSize: '12px', color: '#6c757d' }}>Arraste para a fila</small>
                </div>
                
                <div style={{
                  flex: 1,
                  padding: '8px',
                  overflowY: 'auto'
                }}>
                  {jogadoresReserva.map((jogador) => (
                    <div
                      key={jogador.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #e9ecef',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#28a745';
                        e.currentTarget.style.background = '#f0fff0';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e9ecef';
                        e.currentTarget.style.background = '#fff';
                      }}
                      onClick={() => moverReservaParaFila(jogador.id)}
                    >
                      <div style={{ fontWeight: '500', color: '#333' }}>{jogador.nome}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna Fila */}
              <div style={{
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{
                  padding: '12px',
                  background: '#f8f9fa',
                  borderBottom: '1px solid #dee2e6',
                  textAlign: 'center'
                }}>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#495057',
                    margin: '0 0 4px 0'
                  }}>📋 Fila ({jogadoresFila.length})</h4>
                  <small style={{ fontSize: '12px', color: '#6c757d' }}>Arraste para reorganizar</small>
                </div>
                
                <div style={{
                  flex: 1,
                  padding: '8px',
                  overflowY: 'auto'
                }}>
                  {jogadoresFila.map((jogador, index) => (
                    <div
                      key={jogador.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #e9ecef',
                        borderRadius: '8px',
                        padding: '12px',
                        marginBottom: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#dc3545';
                        e.currentTarget.style.background = '#fff5f5';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e9ecef';
                        e.currentTarget.style.background = '#fff';
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '500', color: '#333' }}>{jogador.nome}</div>
                      </div>
                      <div style={{
                        background: '#28a745',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '12px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        minWidth: '30px',
                        textAlign: 'center'
                      }}>
                        {index + 1}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moverJogadorParaReserva(jogador.id);
                        }}
                        style={{
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        ➖
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}