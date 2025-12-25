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
  const [regras, setRegras] = useState<Regras>({ jogadores_por_time: 5 });
  const [totalPartidas, setTotalPartidas] = useState(0);
  const [totalGols, setTotalGols] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

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
        console.log('🏆 Regras carregadas: times de', regrasData.jogadores_por_time);
      }
      
      // 2. BUSCAR SESSÃO ATIVA
      const { data: sessao, error: sessaoError } = await supabase
        .from('sessoes')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('status', 'ativa')
        .single();
      
      if (sessaoError) {
        console.log('❌ Nenhuma sessão ativa, carregando por status...');
        // Fallback: carregar por status dos jogadores (como antes)
        await carregarPorStatus(peladaId);
        return;
      }
      
      console.log('✅ Sessão ativa encontrada:', sessao.id);
      
      // 2. CARREGAR DA TABELA FILA (sem JOIN - igual Pelada 3)
      const { data: filaData, error: filaError } = await supabase
        .from('fila')
        .select('*')
        .eq('pelada_id', peladaId)
        .eq('sessao_id', sessao.id)
        .order('posicao_fila');
      
      if (filaError) {
        console.error('💥 Erro ao carregar fila:', filaError);
        await carregarPorStatus(peladaId);
        return;
      }
      
      console.log('📊 Dados da fila carregados:', filaData);
      
      // 3. CARREGAR DADOS DOS JOGADORES SEPARADAMENTE
      const { data: todosJogadores, error: jogadoresError } = await supabase
        .from('jogadores')
        .select('*')
        .eq('pelada_id', peladaId);
      
      if (jogadoresError) {
        console.error('💥 Erro ao carregar jogadores:', jogadoresError);
        await carregarPorStatus(peladaId);
        return;
      }
      
      // 4. COMBINAR DADOS MANUALMENTE (igual Pelada 3)
      const filaJogadores = (filaData || []).filter(item => item.status === 'fila');
      const jogadoresFila = filaJogadores.map(item => {
        const jogador = todosJogadores.find(j => j.id === item.jogador_id);
        return {
          id: item.jogador_id,
          nome: jogador?.nome || 'Desconhecido',
          posicao: jogador?.posicao || '',
          status: 'fila',
          pelada_id: peladaId
        };
      });
      
      // 5. JOGADORES JOGANDO (da tabela fila, não da tabela jogadores)
      const jogandoItems = (filaData || []).filter(item => item.status === 'jogando');
      const jogadoresJogando = jogandoItems.map(item => {
        const jogador = todosJogadores.find(j => j.id === item.jogador_id);
        return {
          id: item.jogador_id,
          nome: jogador?.nome || 'Desconhecido',
          posicao: jogador?.posicao || '',
          status: 'jogando',
          pelada_id: peladaId
        };
      });
      setJogadoresJogando(jogadoresJogando);
      setJogadoresFila(jogadoresFila);
      
      // 6. CARREGAR ESTATÍSTICAS DO LOCALSTORAGE
      const stats = localStorage.getItem('peladaStats');
      if (stats) {
        const parsedStats = JSON.parse(stats);
        setTotalPartidas(parsedStats.partidas || 0);
        setTotalGols(parsedStats.gols || 0);
      }
      
      console.log(`✅ Fila carregada: ${filaOrganizada.filter(f => f.status === 'jogando').length} jogando, ${filaOrganizada.filter(f => f.status === 'fila').length} na fila, ${filaOrganizada.filter(f => f.status === 'reserva').length} reservas`);
      
    } catch (error) {
      console.error('💥 Erro geral ao carregar dados:', error);
      // Fallback final
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        await carregarPorStatus(user.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Função de fallback para carregar por status (método antigo)
  const carregarPorStatus = async (peladaId: string) => {
    console.log('🔄 Carregando por status (fallback)...');
    
    const { data: jogadoresData, error: jogadoresError } = await supabase
      .from('jogadores')
      .select('*')
      .eq('pelada_id', peladaId);
    
    if (jogadoresError) {
      console.error('💥 Erro no fallback:', jogadoresError);
      return;
    }
    
    const jogadores = jogadoresData || [];
    const jogando = jogadores.filter(j => j.status === 'jogando');
    const fila = jogadores.filter(j => j.status === 'fila');
    
    setJogadoresJogando(jogando);
    setJogadoresFila(fila);
    
    console.log(`📊 Fallback: ${jogando.length} jogando, ${fila.length} na fila`);
  };

  const iniciarPartida = () => {
    if (jogadoresJogando.length < 8) {
      alert('❌ É necessário pelo menos 8 jogadores para iniciar uma partida!');
      return;
    }
    window.location.href = '/partida';
  };

  const formatarData = () => {
    return new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const time1 = jogadoresJogando.slice(0, 4);
  const time2 = jogadoresJogando.slice(4, 8);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#fff' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '2px solid #e0e0e0',
            borderTop: '2px solid #2d8f2d',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}></div>
          <p>⚽ Carregando fila...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          -webkit-tap-highlight-color: rgba(0, 0, 0, 0.1);
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #fff;
          color: #333;
          line-height: 1.6;
          padding-bottom: 120px;
          -webkit-text-size-adjust: 100%;
          touch-action: manipulation;
          overflow-x: hidden;
          width: 100%;
        }

        .main {
          min-height: 100vh;
          padding: 16px 0;
          width: 100%;
          overflow-x: hidden;
        }

        .container {
          max-width: 400px;
          margin: 0 auto;
          padding: 0 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          box-sizing: border-box;
        }

        .header-card {
          background: #f8f9fa;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
          border: 2px solid #f0f0f0;
          text-align: center;
          touch-action: manipulation;
        }

        .header-card h2 {
          font-size: 1.3rem;
          font-weight: 600;
          color: #333;
          margin: 0 0 8px 0;
        }

        .status-info {
          font-size: 0.9rem;
          color: #666;
          font-weight: 500;
        }

        .teams-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          align-items: start;
        }

        .team-card {
          background: #fff;
          border-radius: 20px;
          padding: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
          border: 2px solid #e8e8e8;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          min-height: 200px;
        }

        .team-card:hover {
          border-color: #2d8f2d;
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(45, 143, 45, 0.1);
        }

        .team-header {
          padding: 8px 12px;
          border-radius: 8px;
          text-align: center;
          margin-bottom: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .team-header.time1 {
          background: #2196f3;
        }

        .team-header.time2 {
          background: #f44336;
        }

        .team-header h3 {
          margin: 0;
          font-size: 1rem;
          color: white;
        }

        .team-table-container {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
        }

        .team-table {
          width: 100%;
          border-collapse: collapse;
          flex-grow: 1;
        }

        .team-table td {
          padding: 2px 6px;
          border-bottom: 1px solid #f0f0f0;
          font-size: 0.8rem;
          line-height: 1;
          min-height: 22px;
          vertical-align: middle;
          text-align: center;
        }

        .team-table tr.empty-row td {
          color: #999;
          font-style: italic;
          text-align: center;
        }

        .team-table tr:last-child td {
          border-bottom: none;
        }

        .start-match-container {
          text-align: center;
          margin: 6px 0;
          padding: 0;
          display: block;
        }

        .start-match-btn {
          background: linear-gradient(135deg, #2d8f2d, #4CAF50);
          color: white;
          border: none;
          border-radius: 15px;
          padding: 16px 32px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 12px rgba(45, 143, 45, 0.3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          width: auto;
          max-width: 280px;
          min-width: 200px;
          position: relative;
          overflow: hidden;
        }

        .start-match-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .start-match-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #245d24, #45a049, #2d8f2d);
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 8px 20px rgba(45, 143, 45, 0.5);
        }

        .queue-card {
          background: #fff;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
          border: 1px solid #f0f0f0;
        }

        .queue-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 2px solid #f0f0f0;
        }

        .queue-header h3 {
          font-size: 1.2rem;
          font-weight: 600;
          color: #333;
          margin: 0;
        }

        .queue-blocks-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .queue-block {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 12px;
          border: 1px solid #e8e8e8;
        }

        .queue-block-header h4 {
          font-size: 0.9rem;
          color: #666;
          margin: 0 0 8px 0;
          text-align: center;
        }

        .queue-block-table {
          width: 100%;
          border-collapse: collapse;
        }

        .queue-block-table td {
          padding: 6px 4px;
          min-height: 32px;
          font-size: 0.85rem;
          text-align: center;
          border-bottom: 1px solid #f0f0f0;
        }

        .stats-day-card {
          background: #fff;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
          border: 1px solid #f0f0f0;
        }

        .stats-day-container {
          display: flex;
          gap: 15px;
          width: 100%;
        }

        .stat-box {
          padding: 12px;
          flex: 1;
          text-align: center;
          background: #f8f9fa;
          border-radius: 12px;
          border: 1px solid #e8e8e8;
        }

        .stat-icon {
          font-size: 1.8rem;
          margin-bottom: 8px;
          display: block;
        }

        .stat-value {
          font-size: 1.4rem;
          font-weight: 600;
          color: #2d8f2d;
          display: block;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 0.8rem;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        @media (max-width: 768px) {
          .container {
            max-width: 100%;
            padding: 0 15px;
          }
          
          .header-card {
            padding: 16px;
          }
          
          .team-card {
            padding: 8px;
            min-height: 160px;
          }
          
          .start-match-btn {
            padding: 15px 28px;
            font-size: 1rem;
            max-width: 280px;
            min-width: 220px;
          }
        }

        @media (max-width: 480px) {
          .container {
            padding: 0 12px;
          }
          
          .header-card {
            padding: 14px;
          }
          
          .header-card h2 {
            font-size: 1.1rem;
          }
          
          .teams-cards {
            grid-template-columns: 1fr 1fr !important;
          }
          
          .start-match-btn {
            padding: 14px 24px;
            font-size: 0.95rem;
            max-width: 260px;
            min-width: 200px;
          }
        }
      `}</style>

      <div className="main">
        <div className="container">
          {/* Header */}
          <section className="header-card">
            <h2>📋 Organização da Fila 📋</h2>
            <div className="status-info">
              {formatarData()} • {jogadoresJogando.length + jogadoresFila.length} jogadores
            </div>
          </section>

          {/* Times */}
          <section className="teams-cards">
            <div className="team-card">
              <div className="team-header time1">
                <h3>TIME 1</h3>
              </div>
              <div className="team-table-container">
                <table className="team-table">
                  <tbody>
                    {time1.map((jogador, index) => (
                      <tr key={jogador.id}>
                        <td>{jogador.nome}</td>
                      </tr>
                    ))}
                    {Array.from({ length: 4 - time1.length }).map((_, index) => (
                      <tr key={`empty1-${index}`} className="empty-row">
                        <td>Aguardando jogador...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="team-card">
              <div className="team-header time2">
                <h3>TIME 2</h3>
              </div>
              <div className="team-table-container">
                <table className="team-table">
                  <tbody>
                    {time2.map((jogador, index) => (
                      <tr key={jogador.id}>
                        <td>{jogador.nome}</td>
                      </tr>
                    ))}
                    {Array.from({ length: 4 - time2.length }).map((_, index) => (
                      <tr key={`empty2-${index}`} className="empty-row">
                        <td>Aguardando jogador...</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Botão Iniciar */}
          <section className="start-match-container">
            <button
              className="start-match-btn"
              onClick={iniciarPartida}
              disabled={jogadoresJogando.length < 8}
            >
              ⚽ Iniciar Pelada ⚽
            </button>
          </section>

          {/* Fila */}
          {jogadoresFila.length > 0 && (
            <section className="queue-card">
              <div className="queue-header">
                <h3>📋 Fila de Espera</h3>
                <span>{jogadoresFila.length} aguardando</span>
              </div>
              <div className="queue-blocks-container">
                <div className="queue-block">
                  <div className="queue-block-header">
                    <h4>Próximos na fila</h4>
                  </div>
                  <table className="queue-block-table">
                    <tbody>
                      {jogadoresFila.map((jogador, index) => (
                        <tr key={jogador.id}>
                          <td>{index + 1}. {jogador.nome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {/* Estatísticas */}
          <section className="stats-day-card">
            <div className="stats-day-container">
              <div className="stat-box">
                <span className="stat-icon">⚽</span>
                <span className="stat-value">{totalPartidas}</span>
                <span className="stat-label">Peladas</span>
              </div>
              <div className="stat-box">
                <span className="stat-icon">🥅</span>
                <span className="stat-value">{totalGols}</span>
                <span className="stat-label">Gols</span>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Mobile - Padrão peladm com botões da fila */}
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-30 safe-area-padding">
          <nav className="flex justify-around py-2 px-4">
            <button
              onClick={() => {/* Gerenciar Jogadores - implementar depois */}}
              className="flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors text-gray-400"
            >
              <span className="text-2xl">👥</span>
              <span className="text-xs font-medium mt-1">Gerenciar</span>
            </button>
            
            <button
              onClick={() => window.location.href = '/fila'}
              className="flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors text-green-600 bg-green-50"
            >
              <span className="text-2xl">📋</span>
              <span className="text-xs font-medium mt-1">Fila</span>
            </button>
            
            <button
              onClick={iniciarPartida}
              disabled={jogadoresJogando.length < 8}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors ${
                jogadoresJogando.length >= 8 ? 'text-gray-700 hover:text-green-600 hover:bg-green-50' : 'text-gray-300'
              }`}
            >
              <span className="text-2xl">⚽</span>
              <span className="text-xs font-medium mt-1">Partida</span>
            </button>
            
            <button
              onClick={async () => {
                if (confirm('🏁 Deseja encerrar a pelada e voltar ao menu principal?')) {
                  try {
                    const userData = localStorage.getItem('user');
                    if (userData) {
                      const user = JSON.parse(userData);
                      
                      // Encerrar sessão no Supabase
                      await supabase
                        .from('sessoes')
                        .update({ status: 'finalizada' })
                        .eq('pelada_id', user.id)
                        .eq('status', 'ativa');
                      
                      // Limpar fila
                      await supabase
                        .from('fila')
                        .delete()
                        .eq('pelada_id', user.id);
                      
                      // Resetar status dos jogadores
                      await supabase
                        .from('jogadores')
                        .update({ status: 'ativo' })
                        .eq('pelada_id', user.id);
                    }
                    
                    // Manter apenas estatísticas no localStorage
                    localStorage.removeItem('dadosPelada');
                    
                    window.location.href = '/dashboard';
                  } catch (error) {
                    console.error('Erro ao encerrar pelada:', error);
                    window.location.href = '/dashboard';
                  }
                }
              }}
              className="flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-colors text-gray-400 hover:text-red-600 hover:bg-red-50"
            >
              <span className="text-2xl">🏁</span>
              <span className="text-xs font-medium mt-1">Encerrar</span>
            </button>
          </nav>
        </footer>
      </div>
    </>
  );
}