// Estado global das estatísticas
let statsState = {
    currentPeriod: 'total',
    selectedDate: null,
    allGames: [],
    allGoals: [],
    allPlayers: [],
    allSessions: [],
    datasDisponiveis: []
};

// Inicialização da página
document.addEventListener('DOMContentLoaded', () => {
    initializeStatsPage();
    setupEventListeners();
    setupPlayerSearch();
    
    // Configurar botão admin baseado no usuário logado
    configurarBotaoAdmin();
    
    // Configurar botão home baseado no usuário logado
    configurarBotaoHome();
});

// Configurar event listeners
function setupEventListeners() {
    // Seletor de datas
    const selectDatas = document.getElementById('select-datas');
    if (selectDatas) {
        selectDatas.addEventListener('change', (e) => {
            if (e.target.value) {
                statsState.currentPeriod = 'data';
                statsState.selectedDate = e.target.value;
                // Remover active dos botões
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            } else {
                statsState.currentPeriod = 'total';
                statsState.selectedDate = null;
                // Ativar o botão História
                document.getElementById('btn-total').classList.add('active');
            }
            loadStatistics();
        });
    }

    // Botões de período
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            let period = e.target.id.replace('btn-', '');
            statsState.currentPeriod = period;
            statsState.selectedDate = null;
            // Limpar seletor de datas
            if (selectDatas) selectDatas.value = '';
            loadStatistics();
        });
    });

    // Botão admin - redirecionar para resultados com modal
    const btnApagarDia = document.getElementById('btn-apagar-dia');
    if (btnApagarDia) {
        btnApagarDia.addEventListener('click', () => {
            // Só permitir se for admin
            if (isAdmin()) {
                // Redirecionar para resultados com parâmetro para abrir modal
                window.location.href = 'resultados.html?openAdminModal=true';
            } else {
                // Mostrar mensagem de acesso negado
                alert('🔒 Acesso negado!\n\nApenas administradores podem acessar esta função.');
            }
        });
    }
}

// Inicializar página de estatísticas
async function initializeStatsPage() {
    try {
        console.log('📊 Inicializando página de estatísticas...');
        
        // Carregar todos os dados necessários
        await loadAllData();
        
        // Carregar estatísticas do período atual
        await loadStatistics();
        
    } catch (error) {
        console.error('Erro ao inicializar estatísticas:', error);
        showError('Erro ao carregar estatísticas');
    }
}

// Carregar todos os dados do banco
async function loadAllData() {
    try {
        // Carregar jogos
        const { data: games, error: gamesError } = await client
            .from('jogos')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (gamesError) throw gamesError;
        statsState.allGames = games || [];
        
        // Carregar gols
        const { data: goals, error: goalsError } = await client
            .from('gols')
            .select('*, jogador_id, jogo_id')
            .order('created_at', { ascending: false });
        
        if (goalsError) throw goalsError;
        statsState.allGoals = goals || [];
        
        // Carregar jogadores
        const { data: players, error: playersError } = await client
            .from('jogadores')
            .select('*')
            .order('nome');
        
        if (playersError) throw playersError;
        statsState.allPlayers = players || [];
        
        // Carregar sessões
        const { data: sessions, error: sessionsError } = await client
            .from('sessoes')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (sessionsError) throw sessionsError;
        statsState.allSessions = sessions || [];
        
        // Carregar dados da fila para contar jogadores que participaram
        const { data: queueData, error: queueError } = await client
            .from('fila')
            .select('*, jogador_id, sessao_id')
            .order('created_at', { ascending: false });
        
        if (queueError) throw queueError;
        statsState.allQueueData = queueData || [];
        
        console.log('📊 Dados carregados:', {
            jogos: statsState.allGames.length,
            gols: statsState.allGoals.length,
            jogadores: statsState.allPlayers.length,
            sessoes: statsState.allSessions.length,
            filaRegistros: statsState.allQueueData.length
        });
        
        // Preencher datas disponíveis
        preencherDatasDisponiveis();
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        throw error;
    }
}

// Preencher datas disponíveis no seletor
function preencherDatasDisponiveis() {
    console.log('Preenchendo datas disponíveis. Total de jogos:', statsState.allGames.length);
    
    // Obter datas únicas dos jogos
    const datasUnicas = [...new Set(statsState.allGames.map(jogo => {
        const data = new Date(jogo.created_at);
        return data.toISOString().split('T')[0];
    }))].sort().reverse(); // Mais recentes primeiro

    console.log('Datas únicas encontradas:', datasUnicas);

    // Limpar select
    const selectDatas = document.getElementById('select-datas');
    if (!selectDatas) return;
    
    selectDatas.innerHTML = '<option value="">Selecione uma data</option>';
    
    // Adicionar opções de datas
    datasUnicas.forEach(data => {
        const dataFormatada = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        
        const option = document.createElement('option');
        option.value = data;
        option.textContent = dataFormatada;
        selectDatas.appendChild(option);
    });
    
    statsState.datasDisponiveis = datasUnicas;
    console.log('Select preenchido com', datasUnicas.length, 'datas');
}

// Carregar estatísticas do período
async function loadStatistics() {
    try {
        console.log('📊 Carregando estatísticas para período:', statsState.currentPeriod);
        
        const dateRange = getDateRange(statsState.currentPeriod);
        const filteredGames = filterByDateRange(statsState.allGames, dateRange);
        const filteredGoals = filterByDateRange(statsState.allGoals, dateRange);
        
        // Atualizar resumo geral
        updateSummaryCards(filteredGames, filteredGoals);
        
        // Atualizar rankings
        updateRankings(filteredGames, filteredGoals);
        
        // Atualizar histórico
        updateHistory(filteredGames, filteredGoals);
        
        // Atualizar estatísticas detalhadas
        updateDetailedStats(filteredGames, filteredGoals);
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// Obter range de datas
function getDateRange(period) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
        case 'data':
            // Data específica selecionada
            if (statsState.selectedDate) {
                const selectedDate = new Date(statsState.selectedDate + 'T00:00:00');
                return {
                    start: selectedDate,
                    end: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000)
                };
            }
            // Se não há data selecionada, retorna range total
            return {
                start: new Date(2020, 0, 1),
                end: new Date(2030, 11, 31)
            };
        case 'mes':
            // Primeiro dia do mês atual até hoje
            return {
                start: new Date(now.getFullYear(), now.getMonth(), 1),
                end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            };
        case 'ano':
            // Primeiro dia do ano atual até hoje
            return {
                start: new Date(now.getFullYear(), 0, 1),
                end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            };
        case 'total':
        default:
            return {
                start: new Date(2020, 0, 1),
                end: new Date(2030, 11, 31)
            };
    }
}

// Filtrar dados por range de data
function filterByDateRange(data, dateRange) {
    return data.filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= dateRange.start && itemDate < dateRange.end;
    });
}

// Atualizar cards de resumo
function updateSummaryCards(games, goals) {
    const totalPartidas = games.filter(g => g.status === 'finalizado').length;
    const totalGols = goals.length;
    
    console.log('🔍 PENTE FINO - Contando jogadores que JOGARAM no período...');
    console.log('📊 DADOS INICIAIS:');
    console.log('- Total de games recebidos:', games.length);
    console.log('- Jogos finalizados:', totalPartidas);
    console.log('- Total de gols:', totalGols);
    console.log('- Período atual:', statsState.currentPeriod);
    
    // Mostrar alguns exemplos de jogos
    console.log('📋 SAMPLE DOS JOGOS:');
    games.slice(0, 3).forEach((game, index) => {
        console.log(`Jogo ${index + 1}:`, {
            id: game.id,
            status: game.status,
            data: game.data_jogo,
            time_a: typeof game.time_a,
            time_b: typeof game.time_b,
            hasTimeA: !!game.time_a,
            hasTimeB: !!game.time_b
        });
    });
    
    // Contar participações em jogos finalizados
    const participacoesPorJogador = {};
    let jogosAnalisados = 0;
    let timesEncontrados = 0;
    let jogadoresEncontrados = 0;
    
    games.filter(g => g.status === 'finalizado').forEach(game => {
        jogosAnalisados++;
        console.log(`\n🎮 ANALISANDO JOGO ${jogosAnalisados}:`, game.id);
        
        // Analisar time A
        if (game.time_a) {
            console.log('Time A encontrado, tipo:', typeof game.time_a);
            try {
                let timeA;
                if (typeof game.time_a === 'string') {
                    timeA = JSON.parse(game.time_a);
                    console.log('Time A parseado:', timeA);
                } else {
                    timeA = game.time_a;
                    console.log('Time A direto:', timeA);
                }
                
                if (Array.isArray(timeA)) {
                    timesEncontrados++;
                    console.log('Time A é array com', timeA.length, 'jogadores');
                    timeA.forEach((jogador, idx) => {
                        console.log(`Jogador ${idx + 1} do Time A:`, jogador);
                        let jogadorId = null;
                        if (typeof jogador === 'string') {
                            jogadorId = jogador;
                        } else if (jogador && (jogador.id || jogador.jogador_id)) {
                            jogadorId = jogador.id || jogador.jogador_id;
                        }
                        if (jogadorId) {
                            participacoesPorJogador[jogadorId] = (participacoesPorJogador[jogadorId] || 0) + 1;
                            jogadoresEncontrados++;
                            console.log(`✅ Jogador ${jogadorId} adicionado (total: ${participacoesPorJogador[jogadorId]})`);
                        } else {
                            console.log('❌ Jogador inválido no Time A');
                        }
                    });
                } else {
                    console.log('❌ Time A não é array:', timeA);
                }
            } catch (e) {
                console.log('❌ Erro ao parsear time_a:', e);
            }
        } else {
            console.log('❌ Time A vazio');
        }
        
        // Analisar time B
        if (game.time_b) {
            console.log('Time B encontrado, tipo:', typeof game.time_b);
            try {
                let timeB;
                if (typeof game.time_b === 'string') {
                    timeB = JSON.parse(game.time_b);
                    console.log('Time B parseado:', timeB);
                } else {
                    timeB = game.time_b;
                    console.log('Time B direto:', timeB);
                }
                
                if (Array.isArray(timeB)) {
                    timesEncontrados++;
                    console.log('Time B é array com', timeB.length, 'jogadores');
                    timeB.forEach((jogador, idx) => {
                        console.log(`Jogador ${idx + 1} do Time B:`, jogador);
                        let jogadorId = null;
                        if (typeof jogador === 'string') {
                            jogadorId = jogador;
                        } else if (jogador && (jogador.id || jogador.jogador_id)) {
                            jogadorId = jogador.id || jogador.jogador_id;
                        }
                        if (jogadorId) {
                            participacoesPorJogador[jogadorId] = (participacoesPorJogador[jogadorId] || 0) + 1;
                            jogadoresEncontrados++;
                            console.log(`✅ Jogador ${jogadorId} adicionado (total: ${participacoesPorJogador[jogadorId]})`);
                        } else {
                            console.log('❌ Jogador inválido no Time B');
                        }
                    });
                } else {
                    console.log('❌ Time B não é array:', timeB);
                }
            } catch (e) {
                console.log('❌ Erro ao parsear time_b:', e);
            }
        } else {
            console.log('❌ Time B vazio');
        }
    });
    
    console.log('\n📊 ESTATÍSTICAS DO PROCESSAMENTO:');
    console.log('- Jogos analisados:', jogosAnalisados);
    console.log('- Times encontrados:', timesEncontrados);
    console.log('- Jogadores encontrados:', jogadoresEncontrados);
    console.log('- Participações únicas:', Object.keys(participacoesPorJogador).length);
    
    console.log('\n🎯 PARTICIPAÇÕES POR JOGADOR:');
    Object.entries(participacoesPorJogador).forEach(([id, count]) => {
        console.log(`ID ${id}: ${count} participações`);
    });
    
    // Filtrar jogadores com pelo menos 1 participação
    const jogadoresQueJogaram = Object.entries(participacoesPorJogador)
        .filter(([jogadorId, participacoes]) => participacoes >= 1)
        .map(([jogadorId, participacoes]) => {
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            return {
                id: jogadorId,
                nome: jogador ? jogador.nome : `ID: ${jogadorId}`,
                participacoes: participacoes
            };
        });
    
    console.log('\n📋 JOGADORES QUE JOGARAM (J >= 1):');
    if (jogadoresQueJogaram.length === 0) {
        console.log('❌ NENHUM JOGADOR ENCONTRADO!');
    } else {
        jogadoresQueJogaram
            .sort((a, b) => a.nome.localeCompare(b.nome))
            .forEach((jogador, index) => {
                console.log(`${index + 1}. ${jogador.nome} - ${jogador.participacoes} jogo(s)`);
            });
    }
    
    const totalJogadoresQueJogaram = jogadoresQueJogaram.length;
    
    // Calcular tempo total de jogo
    let tempoTotalMs = 0;
    games.forEach(game => {
        if (game.data_fim && game.created_at) {
            const inicio = new Date(game.created_at);
            const fim = new Date(game.data_fim);
            tempoTotalMs += (fim - inicio);
        }
    });
    
    const tempoTotalHoras = Math.floor(tempoTotalMs / (1000 * 60 * 60));
    const tempoTotalMinutos = Math.floor((tempoTotalMs % (1000 * 60 * 60)) / (1000 * 60));
    const tempoTotalFormatado = `${tempoTotalHoras}h ${tempoTotalMinutos}min`;
    
    console.log('\n📊 RESUMO FINAL:');
    console.log('- Partidas:', totalPartidas);
    console.log('- Gols:', totalGols);
    console.log('- Jogadores que jogaram:', totalJogadoresQueJogaram);
    console.log('- Tempo total de jogo:', tempoTotalFormatado);
    
    // Atualizar elementos se existirem (para compatibilidade com outras telas)
    const totalPartidasEl = document.getElementById('total-partidas');
    const totalGolsEl = document.getElementById('total-gols');
    const totalJogadoresEl = document.getElementById('total-jogadores');
    const tempoTotalEl = document.getElementById('tempo-total');
    
    if (totalPartidasEl) totalPartidasEl.textContent = totalPartidas;
    if (totalGolsEl) totalGolsEl.textContent = totalGols;
    if (totalJogadoresEl) totalJogadoresEl.textContent = totalJogadoresQueJogaram;
    if (tempoTotalEl) tempoTotalEl.textContent = tempoTotalFormatado;
}

// Atualizar rankings
function updateRankings(games, goals) {
    updateArtilheiros(goals);
    updateMaisAtivos(games);
    updateOsCarasDaVitoria(games); // Antigo Reis da Pelada - por vitórias
    updateReisDaPelada(games, goals); // Novo Reis da Pelada - vitórias + gols
    updateBolaMurcha(games); // Novo Bola Murcha - mais derrotas
    updateMediaGols(games, goals); // Média de gols
    updateParceirosIdeais(games); // Duplas que mais jogam juntas
}

// Ranking de artilheiros
function updateArtilheiros(goals) {
    const golsPorJogador = {};
    
    goals.forEach(gol => {
        if (!golsPorJogador[gol.jogador_id]) {
            golsPorJogador[gol.jogador_id] = 0;
        }
        golsPorJogador[gol.jogador_id]++;
    });
    
    const ranking = Object.entries(golsPorJogador)
        .map(([jogadorId, gols]) => {
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            return {
                jogador: jogador ? jogador.nome : 'Desconhecido',
                valor: gols,
                stats: `${gols} gol${gols > 1 ? 's' : ''}`
            };
        })
        .sort((a, b) => b.valor - a.valor);
    
    renderRanking('ranking-artilheiros', ranking.slice(0, 3), ranking);
}

// Ranking de mais ativos
function updateMaisAtivos(games) {
    const participacoesPorJogador = {};
    games.filter(g => g.status === 'finalizado').forEach(game => {
        [game.time_a, game.time_b].forEach(timeJson => {
            if (timeJson) {
                let time;
                try {
                    time = typeof timeJson === 'string' ? JSON.parse(timeJson) : timeJson;
                } catch (e) { time = []; }
                if (Array.isArray(time)) {
                    time.forEach(jogador => {
                        let jogadorId = typeof jogador === 'string' ? jogador : (jogador.id || jogador.jogador_id);
                        if (jogadorId) {
                            participacoesPorJogador[jogadorId] = (participacoesPorJogador[jogadorId] || 0) + 1;
                        }
                    });
                }
            }
        });
    });
    const ranking = Object.entries(participacoesPorJogador)
        .map(([jogadorId, participacoes]) => {
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            return {
                jogador: jogador ? jogador.nome : 'Desconhecido',
                valor: participacoes,
                stats: `${participacoes} jogo${participacoes > 1 ? 's' : ''}`
            };
        })
        .sort((a, b) => b.valor - a.valor);
    
    renderRanking('ranking-participacoes', ranking.slice(0, 3), ranking);
}

// Ranking de eficiência (Os Caras da Vitória - antigo Reis da Pelada)
function updateOsCarasDaVitoria(games) {
    // Top 3 jogadores com mais vitórias
    const vitoriasPorJogador = {};
    games.filter(g => g.status === 'finalizado').forEach(game => {
        let timeVencedor = game.time_vencedor;
        let time;
        if (timeVencedor === 'A') {
            time = typeof game.time_a === 'string' ? JSON.parse(game.time_a) : game.time_a;
        } else if (timeVencedor === 'B') {
            time = typeof game.time_b === 'string' ? JSON.parse(game.time_b) : game.time_b;
        } else {
            time = [];
        }
        if (Array.isArray(time)) {
            time.forEach(jogador => {
                let jogadorId = typeof jogador === 'string' ? jogador : (jogador.id || jogador.jogador_id);
                if (jogadorId) {
                    vitoriasPorJogador[jogadorId] = (vitoriasPorJogador[jogadorId] || 0) + 1;
                }
            });
        }
    });
    const ranking = Object.entries(vitoriasPorJogador)
        .map(([jogadorId, vitorias]) => {
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            return {
                jogador: jogador ? jogador.nome : 'Desconhecido',
                valor: vitorias,
                stats: `${vitorias} vitória${vitorias > 1 ? 's' : ''}`
            };
        })
        .sort((a, b) => b.valor - a.valor);
    
    renderRanking('ranking-eficiencia', ranking.slice(0, 3), ranking);
}

// Ranking Reis da Pelada (vitórias + gols)
function updateReisDaPelada(games, goals) {
    const scoresPorJogador = {};
    
    // Contar vitórias
    games.filter(g => g.status === 'finalizado').forEach(game => {
        let timeVencedor = game.time_vencedor;
        let time;
        if (timeVencedor === 'A') {
            time = typeof game.time_a === 'string' ? JSON.parse(game.time_a) : game.time_a;
        } else if (timeVencedor === 'B') {
            time = typeof game.time_b === 'string' ? JSON.parse(game.time_b) : game.time_b;
        } else {
            time = [];
        }
        if (Array.isArray(time)) {
            time.forEach(jogador => {
                let jogadorId = typeof jogador === 'string' ? jogador : (jogador.id || jogador.jogador_id);
                if (jogadorId) {
                    if (!scoresPorJogador[jogadorId]) {
                        scoresPorJogador[jogadorId] = { vitorias: 0, gols: 0 };
                    }
                    scoresPorJogador[jogadorId].vitorias++;
                }
            });
        }
    });
    
    // Contar gols - usar a mesma lógica dos artilheiros
    goals.forEach(goal => {
        if (goal.jogador_id) {
            if (!scoresPorJogador[goal.jogador_id]) {
                scoresPorJogador[goal.jogador_id] = { vitorias: 0, gols: 0 };
            }
            scoresPorJogador[goal.jogador_id].gols++;
        }
    });
    
    const ranking = Object.entries(scoresPorJogador)
        .map(([jogadorId, stats]) => {
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            const scoreTotal = stats.vitorias + stats.gols;
            return {
                jogador: jogador ? jogador.nome : 'Desconhecido',
                valor: scoreTotal,
                stats: `${stats.vitorias} vitória${stats.vitorias !== 1 ? 's' : ''} + ${stats.gols} gol${stats.gols !== 1 ? 's' : ''} = ${scoreTotal} pontos`
            };
        })
        .sort((a, b) => b.valor - a.valor);
    
    renderRanking('ranking-reis', ranking.slice(0, 3), ranking);
}

// Ranking Bola Murcha (mais derrotas)
function updateBolaMurcha(games) {
    const derrotasPorJogador = {};
    const partidasPorJogador = {};
    
    games.filter(g => g.status === 'finalizado').forEach(game => {
        let timeVencedor = game.time_vencedor;
        let timeA = typeof game.time_a === 'string' ? JSON.parse(game.time_a) : game.time_a;
        let timeB = typeof game.time_b === 'string' ? JSON.parse(game.time_b) : game.time_b;
        
        // Contar partidas para todos os jogadores
        if (Array.isArray(timeA)) {
            timeA.forEach(jogador => {
                let jogadorId = typeof jogador === 'string' ? jogador : (jogador.id || jogador.jogador_id);
                if (jogadorId) {
                    partidasPorJogador[jogadorId] = (partidasPorJogador[jogadorId] || 0) + 1;
                    derrotasPorJogador[jogadorId] = derrotasPorJogador[jogadorId] || 0;
                    
                    // Se time B venceu, jogadores do time A perderam
                    if (timeVencedor === 'B') {
                        derrotasPorJogador[jogadorId]++;
                    }
                }
            });
        }
        
        if (Array.isArray(timeB)) {
            timeB.forEach(jogador => {
                let jogadorId = typeof jogador === 'string' ? jogador : (jogador.id || jogador.jogador_id);
                if (jogadorId) {
                    partidasPorJogador[jogadorId] = (partidasPorJogador[jogadorId] || 0) + 1;
                    derrotasPorJogador[jogadorId] = derrotasPorJogador[jogadorId] || 0;
                    
                    // Se time A venceu, jogadores do time B perderam
                    if (timeVencedor === 'A') {
                        derrotasPorJogador[jogadorId]++;
                    }
                }
            });
        }
    });
    
    const ranking = Object.entries(derrotasPorJogador)
        .filter(([jogadorId, derrotas]) => partidasPorJogador[jogadorId] >= 3) // Apenas jogadores com 3+ partidas
        .map(([jogadorId, derrotas]) => {
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            const partidas = partidasPorJogador[jogadorId];
            return {
                jogador: jogador ? jogador.nome : 'Desconhecido',
                valor: derrotas,
                stats: `${derrotas} derrota${derrotas !== 1 ? 's' : ''} em ${partidas} partida${partidas !== 1 ? 's' : ''}`
            };
        })
        .sort((a, b) => b.valor - a.valor);
    
    renderRanking('ranking-derrotas', ranking.slice(0, 3), ranking);
}

// Ranking Clutch Players (primeiros gols)
function updateClutchPlayers(goals) {
    const clutchPorJogador = {};
    
    if (!goals || goals.length === 0) {
        renderRanking('ranking-clutch', [], []);
        return;
    }
    
    // Contar apenas primeiros gols de cada partida (versão simplificada)
    const partidasProcessadas = new Set();
    
    goals.forEach(gol => {
        const partidaId = gol.partida_id;
        const jogadorId = gol.jogador_id;
        
        // Se essa partida ainda não foi processada, contar este como primeiro gol
        if (partidaId && jogadorId && !partidasProcessadas.has(partidaId)) {
            clutchPorJogador[jogadorId] = (clutchPorJogador[jogadorId] || 0) + 1;
            partidasProcessadas.add(partidaId);
        }
    });
    
    const ranking = Object.entries(clutchPorJogador)
        .map(([jogadorId, golsClutch]) => {
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            return {
                jogador: jogador ? jogador.nome : 'Desconhecido',
                valor: golsClutch,
                stats: `${golsClutch} primeiro${golsClutch !== 1 ? 's' : ''} gol${golsClutch !== 1 ? 's' : ''}`
            };
        })
        .sort((a, b) => b.valor - a.valor);
    
    renderRanking('ranking-clutch', ranking.slice(0, 3), ranking);
}

// Ranking Média de Gols (mínimo 5 partidas)
function updateMediaGols(games, goals) {
    const golsPorJogador = {};
    const partidasPorJogador = {};
    
    // Contar gols
    goals.forEach(gol => {
        let jogadorId = gol.jogador_id;
        if (jogadorId) {
            golsPorJogador[jogadorId] = (golsPorJogador[jogadorId] || 0) + 1;
        }
    });
    
    // Contar partidas
    games.filter(g => g.status === 'finalizado').forEach(game => {
        let timeA = typeof game.time_a === 'string' ? JSON.parse(game.time_a) : game.time_a;
        let timeB = typeof game.time_b === 'string' ? JSON.parse(game.time_b) : game.time_b;
        
        if (Array.isArray(timeA)) {
            timeA.forEach(jogador => {
                let jogadorId = typeof jogador === 'string' ? jogador : (jogador.id || jogador.jogador_id);
                if (jogadorId) {
                    partidasPorJogador[jogadorId] = (partidasPorJogador[jogadorId] || 0) + 1;
                }
            });
        }
        
        if (Array.isArray(timeB)) {
            timeB.forEach(jogador => {
                let jogadorId = typeof jogador === 'string' ? jogador : (jogador.id || jogador.jogador_id);
                if (jogadorId) {
                    partidasPorJogador[jogadorId] = (partidasPorJogador[jogadorId] || 0) + 1;
                }
            });
        }
    });
    
    const ranking = Object.entries(partidasPorJogador)
        .filter(([jogadorId, partidas]) => partidas >= 5) // Mínimo 5 partidas
        .map(([jogadorId, partidas]) => {
            const gols = golsPorJogador[jogadorId] || 0;
            const media = (gols / partidas).toFixed(2);
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            return {
                jogador: jogador ? jogador.nome : 'Desconhecido',
                valor: parseFloat(media),
                stats: `${media} gols/partida (${gols} gols em ${partidas} partidas)`
            };
        })
        .sort((a, b) => b.valor - a.valor);
    
    renderRanking('ranking-media-gols', ranking.slice(0, 3), ranking);
}

// Ranking Parceiros Ideais (duplas que mais jogam juntas)
function updateParceirosIdeais(games) {
    const duplas = {};
    
    games.filter(g => g.status === 'finalizado').forEach(game => {
        let timeA = typeof game.time_a === 'string' ? JSON.parse(game.time_a) : game.time_a;
        let timeB = typeof game.time_b === 'string' ? JSON.parse(game.time_b) : game.time_b;
        
        // Analisar duplas no time A
        if (Array.isArray(timeA) && timeA.length >= 2) {
            for (let i = 0; i < timeA.length; i++) {
                for (let j = i + 1; j < timeA.length; j++) {
                    let jogador1Id = typeof timeA[i] === 'string' ? timeA[i] : (timeA[i].id || timeA[i].jogador_id);
                    let jogador2Id = typeof timeA[j] === 'string' ? timeA[j] : (timeA[j].id || timeA[j].jogador_id);
                    
                    if (jogador1Id && jogador2Id) {
                        // Criar chave da dupla (ordem alfabética para evitar duplicatas)
                        let chave = [jogador1Id, jogador2Id].sort().join('-');
                        duplas[chave] = duplas[chave] || {
                            jogador1Id: jogador1Id,
                            jogador2Id: jogador2Id,
                            partidas: 0
                        };
                        duplas[chave].partidas++;
                    }
                }
            }
        }
        
        // Analisar duplas no time B
        if (Array.isArray(timeB) && timeB.length >= 2) {
            for (let i = 0; i < timeB.length; i++) {
                for (let j = i + 1; j < timeB.length; j++) {
                    let jogador1Id = typeof timeB[i] === 'string' ? timeB[i] : (timeB[i].id || timeB[i].jogador_id);
                    let jogador2Id = typeof timeB[j] === 'string' ? timeB[j] : (timeB[j].id || timeB[j].jogador_id);
                    
                    if (jogador1Id && jogador2Id) {
                        // Criar chave da dupla (ordem alfabética para evitar duplicatas)
                        let chave = [jogador1Id, jogador2Id].sort().join('-');
                        duplas[chave] = duplas[chave] || {
                            jogador1Id: jogador1Id,
                            jogador2Id: jogador2Id,
                            partidas: 0
                        };
                        duplas[chave].partidas++;
                    }
                }
            }
        }
    });
    
    const ranking = Object.values(duplas)
        .filter(dupla => dupla.partidas >= 3) // Mínimo 3 partidas juntos
        .map(dupla => {
            const jogador1 = statsState.allPlayers.find(p => p.id == dupla.jogador1Id);
            const jogador2 = statsState.allPlayers.find(p => p.id == dupla.jogador2Id);
            const nome1 = jogador1 ? jogador1.nome : 'Desconhecido';
            const nome2 = jogador2 ? jogador2.nome : 'Desconhecido';
            return {
                jogador: `${nome1} & ${nome2}`,
                valor: dupla.partidas,
                stats: `${dupla.partidas} partida${dupla.partidas !== 1 ? 's' : ''} juntos`
            };
        })
        .sort((a, b) => b.valor - a.valor);
    
    renderRanking('ranking-parceiros', ranking.slice(0, 3), ranking);
}

// Renderizar ranking
function renderRanking(containerId, topRanking, fullRanking) {
    const container = document.getElementById(containerId);
    
    if (topRanking.length === 0) {
        container.innerHTML = '<div class="loading-ranking">📭 Nenhum dado encontrado</div>';
        return;
    }
    
    const html = topRanking.map((item, index) => {
        const positionClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'other';
        return `
            <div class="ranking-item">
                <div class="ranking-position ${positionClass}">
                    ${index + 1}
                </div>
                <div class="ranking-info">
                    <div class="ranking-name">${item.jogador}</div>
                    <div class="ranking-stats">${item.stats}</div>
                </div>
                <div class="ranking-value">${item.valor}</div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
    
    // Configurar botão "Ver Completo" se existir mais jogadores
    if (fullRanking && fullRanking.length > 3) {
        const rankingCard = container.closest('.ranking-card');
        const verCompletoBtn = rankingCard.querySelector('.ver-completo-btn');
        if (verCompletoBtn) {
            verCompletoBtn.style.display = 'block';
            verCompletoBtn.onclick = () => showFullRanking(rankingCard.querySelector('h3').textContent, fullRanking);
        }
    } else {
        const rankingCard = container.closest('.ranking-card');
        const verCompletoBtn = rankingCard.querySelector('.ver-completo-btn');
        if (verCompletoBtn) {
            verCompletoBtn.style.display = 'none';
        }
    }
}

// Mostrar ranking completo no modal
function showFullRanking(title, fullRanking) {
    const modal = document.getElementById('modal-ranking-completo');
    const modalTitle = document.getElementById('modal-ranking-titulo');
    const modalContent = document.getElementById('modal-ranking-lista');
    
    modalTitle.textContent = title;
    
    const html = fullRanking.map((item, index) => {
        const positionClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : 'other';
        return `
            <div class="ranking-item">
                <div class="ranking-position ${positionClass}">
                    ${index + 1}º
                </div>
                <div class="ranking-info">
                    <div class="ranking-name">${item.jogador}</div>
                    <div class="ranking-stats">${item.stats}</div>
                </div>
                <div class="ranking-value">${item.valor}</div>
            </div>
        `;
    }).join('');
    
    modalContent.innerHTML = html;
    modal.style.display = 'flex';
}

// Fechar modal
function closeRankingModal() {
    const modal = document.getElementById('modal-ranking-completo');
    modal.style.display = 'none';
}

// Atualizar histórico
function updateHistory(games, goals) {
    // Agrupar por data
    const gamesByDate = {};
    
    games.filter(g => g.status === 'finalizado').forEach(game => {
        const date = new Date(game.created_at).toISOString().split('T')[0];
        if (!gamesByDate[date]) {
            gamesByDate[date] = [];
        }
        gamesByDate[date].push(game);
    });
    
    // Criar histórico
    const historyItems = Object.entries(gamesByDate)
        .sort(([a], [b]) => new Date(b) - new Date(a))
        .slice(0, 10)
        .map(([date, gamesInDate]) => {
            const golsNaData = goals.filter(gol => {
                const golDate = new Date(gol.created_at).toISOString().split('T')[0];
                return golDate === date;
            }).length;
            
            return {
                date,
                partidas: gamesInDate.length,
                gols: golsNaData
            };
        });
    
    renderHistory(historyItems);
}

// Renderizar histórico
function renderHistory(historyItems) {
    const container = document.getElementById('historico-partidas');
    
    // Se o elemento não existir (não estamos na página certa), sair silenciosamente
    if (!container) {
        return;
    }
    
    if (historyItems.length === 0) {
        container.innerHTML = '<div class="loading-history">📭 Nenhum histórico encontrado</div>';
        return;
    }
    
    const html = historyItems.map(item => {
        const date = new Date(item.date);
        const dateStr = date.toLocaleDateString('pt-BR', { 
            weekday: 'short', 
            day: '2-digit', 
            month: '2-digit' 
        });
        
        return `
            <div class="history-item">
                <div class="history-date">${dateStr}</div>
                <div class="history-stats">
                    <div class="history-stat">
                        <span>⚽</span>
                        <span>${item.partidas}</span>
                    </div>
                    <div class="history-stat">
                        <span>🥅</span>
                        <span>${item.gols}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// Atualizar estatísticas detalhadas
function updateDetailedStats(games, goals) {
    const sessoesPeriodo = filterByDateRange(statsState.allSessions, getDateRange(statsState.currentPeriod));
    
    // Total de sessões
    const totalSessoesEl = document.getElementById('total-sessoes');
    if (totalSessoesEl) {
        totalSessoesEl.textContent = sessoesPeriodo.length;
    }
    
    // Tempo médio (placeholder - seria necessário dados de duração)
    const tempoMedioEl = document.getElementById('tempo-medio');
    if (tempoMedioEl) {
        tempoMedioEl.textContent = '10min';
    }
    
    // Maior goleada
    let maiorGoleada = { scoreA: 0, scoreB: 0 };
    games.filter(g => g.status === 'finalizado').forEach(game => {
        if (Math.abs(game.score_a - game.score_b) > Math.abs(maiorGoleada.scoreA - maiorGoleada.scoreB)) {
            maiorGoleada = { scoreA: game.score_a, scoreB: game.score_b };
        }
    });
    const maiorGoleadaEl = document.getElementById('maior-goleada');
    if (maiorGoleadaEl) {
        maiorGoleadaEl.textContent = `${maiorGoleada.scoreA}-${maiorGoleada.scoreB}`;
    }
    
    // Melhor dia (dia com mais gols)
    const golsPorDia = {};
    goals.forEach(gol => {
        const date = new Date(gol.created_at).toISOString().split('T')[0];
        golsPorDia[date] = (golsPorDia[date] || 0) + 1;
    });
    
    const melhorDia = Object.entries(golsPorDia)
        .sort(([,a], [,b]) => b - a)[0];
    
    const melhorDiaEl = document.getElementById('melhor-dia');
    if (melhorDiaEl) {
        if (melhorDia) {
            const date = new Date(melhorDia[0]);
            const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            melhorDiaEl.textContent = dateStr;
        } else {
            melhorDiaEl.textContent = '--';
        }
    }
}

// Função de erro
function showError(message) {
    console.error(message);
    // Aqui você pode implementar uma notificação visual de erro
}

// Funcionalidade de busca individual
let currentSelectedPlayer = null;

function setupPlayerSearch() {
    const searchInput = document.getElementById('search-player');
    const clearBtn = document.getElementById('clear-search');
    const suggestionsDropdown = document.getElementById('player-suggestions');
    const individualStats = document.getElementById('individual-stats');
    
    let currentHighlightIndex = -1;
    let filteredPlayers = [];
    
    // Event listener para busca com autocomplete
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        if (query.length > 0) {
            clearBtn.style.display = 'block';
            showPlayerSuggestions(query);
        } else {
            clearBtn.style.display = 'none';
            hideSuggestions();
            hideIndividualStats();
        }
    });
    
    // Navegação por teclado
    searchInput.addEventListener('keydown', (e) => {
        const suggestions = suggestionsDropdown.querySelectorAll('.suggestion-item');
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                currentHighlightIndex = Math.min(currentHighlightIndex + 1, suggestions.length - 1);
                updateHighlight(suggestions);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                currentHighlightIndex = Math.max(currentHighlightIndex - 1, -1);
                updateHighlight(suggestions);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (currentHighlightIndex >= 0 && suggestions[currentHighlightIndex]) {
                    const playerId = suggestions[currentHighlightIndex].dataset.playerId;
                    const playerName = suggestions[currentHighlightIndex].dataset.playerName;
                    selectPlayer(playerId, playerName);
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                hideSuggestions();
                searchInput.blur();
                break;
        }
    });
    
    // Fechar sugestões quando clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-wrapper')) {
            hideSuggestions();
        }
    });
    
    // Botão limpar
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        hideSuggestions();
        hideIndividualStats();
        searchInput.focus();
    });
    
    function showPlayerSuggestions(query) {
        filteredPlayers = statsState.allPlayers.filter(player => 
            player.nome.toLowerCase().includes(query.toLowerCase())
        );
        
        currentHighlightIndex = -1;
        
        if (filteredPlayers.length > 0) {
            const html = filteredPlayers
                .slice(0, 6) // Limitar a 6 sugestões para melhor UX
                .map((player, index) => {
                    // Calcular estatísticas básicas do jogador
                    const playerGames = statsState.allGames.filter(game => 
                        game.time_a?.some(p => p.id === player.id) || 
                        game.time_b?.some(p => p.id === player.id)
                    );
                    const playerGoals = statsState.allGoals.filter(goal => goal.jogador_id === player.id);
                    
                    return `
                        <div class="suggestion-item" 
                             data-player-id="${player.id}" 
                             data-player-name="${player.nome}"
                             onclick="selectPlayerFromSuggestion('${player.id}', '${player.nome}')">
                            <div class="suggestion-name">${highlightMatch(player.nome, query)}</div>
                            <div class="suggestion-info">${playerGames.length} jogos • ${playerGoals.length} gols</div>
                        </div>
                    `;
                }).join('');
            
            suggestionsDropdown.innerHTML = html;
            suggestionsDropdown.classList.add('show');
        } else {
            suggestionsDropdown.innerHTML = '<div class="no-suggestions">Nenhum jogador encontrado</div>';
            suggestionsDropdown.classList.add('show');
        }
    }
    
    function updateHighlight(suggestions) {
        suggestions.forEach((item, index) => {
            item.classList.toggle('highlighted', index === currentHighlightIndex);
        });
    }
    
    function hideSuggestions() {
        suggestionsDropdown.classList.remove('show');
        currentHighlightIndex = -1;
    }
    
    function highlightMatch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<strong>$1</strong>');
    }
}

// Função global para seleção via clique
function selectPlayerFromSuggestion(playerId, playerName) {
    selectPlayer(playerId, playerName);
}

function selectPlayer(playerId, playerName) {
    currentSelectedPlayer = { id: playerId, nome: playerName };
    document.getElementById('search-player').value = playerName;
    document.getElementById('player-suggestions').classList.remove('show');
    document.getElementById('clear-search').style.display = 'block';
    
    showIndividualStats(playerId, playerName);
}

function showIndividualStats(playerId, playerName) {
    const individualStats = document.getElementById('individual-stats');
    const playerTitle = document.getElementById('player-name-title');
    
    playerTitle.textContent = `Estatísticas de ${playerName}`;
    individualStats.style.display = 'block';
    
    calculatePlayerStats(playerId);
}

function hideIndividualStats() {
    document.getElementById('individual-stats').style.display = 'none';
    currentSelectedPlayer = null;
}

function calculatePlayerStats(playerId) {
    console.log('🔍 Calculando estatísticas para jogador:', playerId);
    console.log('📊 Dados disponíveis:', {
        games: statsState.allGames.length,
        goals: statsState.allGoals.length,
        players: statsState.allPlayers.length
    });
    
    let partidas = 0;
    let gols = 0;
    let vitorias = 0;
    let empates = 0;
    let tempoTotal = 0;
    let sessoesParticipadas = new Set();
    let partidasMVP = 0;
    let parceirosCount = {};
    let timeACount = 0;
    let timeBCount = 0;
    let primeiroGol = 0;
    let hatTricks = 0;
    let golsDecisivos = 0;
    
    // Analisar cada partida
    for (const game of statsState.allGames) {
        const jogadoresPartida = [...(game.time_a || []), ...(game.time_b || [])];
        
        if (jogadoresPartida.includes(playerId)) {
            partidas++;
            sessoesParticipadas.add(game.sessao_id);
            
            // Calcular tempo
            if (game.data_fim && game.created_at) {
                const duracao = new Date(game.data_fim) - new Date(game.created_at);
                tempoTotal += duracao;
            }
            
            // Determinar time do jogador
            const jogadorNoTimeA = game.time_a?.includes(playerId);
            const jogadorNoTimeB = game.time_b?.includes(playerId);
            
            if (jogadorNoTimeA) {
                timeACount++;
                // Contar parceiros do time A
                game.time_a?.forEach(parceiroId => {
                    if (parceiroId !== playerId) {
                        parceirosCount[parceiroId] = (parceirosCount[parceiroId] || 0) + 1;
                    }
                });
            } else if (jogadorNoTimeB) {
                timeBCount++;
                // Contar parceiros do time B
                game.time_b?.forEach(parceiroId => {
                    if (parceiroId !== playerId) {
                        parceirosCount[parceiroId] = (parceirosCount[parceiroId] || 0) + 1;
                    }
                });
            }
            
            // Analisar gols da partida
            const golsPartida = statsState.allGoals.filter(g => g.jogo_id === game.id);
            const golsTimeA = golsPartida.filter(g => g.time === 'A').length;
            const golsTimeB = golsPartida.filter(g => g.time === 'B').length;
            const golsJogador = golsPartida.filter(g => g.jogador_id === playerId).length;
            
            // Verificar resultado (vitória/empate/derrota)
            if (golsTimeA === golsTimeB) {
                empates++;
            } else if ((jogadorNoTimeA && golsTimeA > golsTimeB) || 
                      (jogadorNoTimeB && golsTimeB > golsTimeA)) {
                vitorias++;
                
                // Verificar se foi gol decisivo (diferença de 1 gol e jogador fez gol)
                if (Math.abs(golsTimeA - golsTimeB) === 1 && golsJogador > 0) {
                    golsDecisivos++;
                }
            }
            
            // Verificar se foi MVP (artilheiro da partida)
            const maxGolsPartida = Math.max(...jogadoresPartida.map(jId => 
                golsPartida.filter(g => g.jogador_id === jId).length
            ));
            if (golsJogador > 0 && golsJogador === maxGolsPartida) {
                partidasMVP++;
            }
            
            // Verificar hat-trick (3+ gols na partida)
            if (golsJogador >= 3) {
                hatTricks++;
            }
            
            // Verificar primeiro gol da partida
            if (golsPartida.length > 0) {
                const primeiroGolPartida = golsPartida.sort((a, b) => 
                    new Date(a.created_at) - new Date(b.created_at)
                )[0];
                if (primeiroGolPartida.jogador_id === playerId) {
                    primeiroGol++;
                }
            }
        }
    }
    
    // Contar total de gols
    gols = statsState.allGoals.filter(g => g.jogador_id === playerId).length;
    
    console.log('📈 Estatísticas calculadas:', {
        partidas, gols, vitorias, empates, sessoesParticipadas: sessoesParticipadas.size
    });
    
    // Calcular métricas
    const taxaConversao = partidas > 0 ? ((gols / partidas) * 100).toFixed(1) : "0.0";
    const aproveitamento = partidas > 0 ? (((vitorias + empates * 0.5) / partidas) * 100).toFixed(1) : "0.0";
    const mediaGols = partidas > 0 ? (gols / partidas).toFixed(1) : "0.0";
    const tempoMedio = partidas > 0 ? Math.round(tempoTotal / (partidas * 1000 * 60)) : 0;
    
    // Encontrar parceiro mais frequente
    let parceiroFrequente = "-";
    if (Object.keys(parceirosCount).length > 0) {
        const parceiroMaisFrequenteId = Object.keys(parceirosCount).reduce((a, b) => 
            parceirosCount[a] > parceirosCount[b] ? a : b
        );
        const jogadorParceiro = statsState.allPlayers.find(p => p.id === parceiroMaisFrequenteId);
        parceiroFrequente = jogadorParceiro ? jogadorParceiro.nome : "Desconhecido";
    }
    
    // Determinar posição favorita
    const posicaoFavorita = timeACount > timeBCount ? "Time A" : 
                           timeBCount > timeACount ? "Time B" : "Equilibrado";
    
    // Formatar tempo total
    const horas = Math.floor(tempoTotal / (1000 * 60 * 60));
    const minutos = Math.floor((tempoTotal % (1000 * 60 * 60)) / (1000 * 60));
    const tempoFormatado = `${horas}h ${minutos}min`;
    
    // Atualizar interface - Estatísticas Básicas
    const elementPartidas = document.getElementById('player-partidas');
    const elementGols = document.getElementById('player-gols');
    const elementVitorias = document.getElementById('player-vitorias');
    const elementEmpates = document.getElementById('player-empates');
    const elementTempo = document.getElementById('player-tempo');
    
    if (elementPartidas) elementPartidas.textContent = partidas;
    if (elementGols) elementGols.textContent = gols;
    if (elementVitorias) elementVitorias.textContent = vitorias;
    if (elementEmpates) elementEmpates.textContent = empates;
    if (elementTempo) elementTempo.textContent = tempoFormatado;
    
    // Atualizar interface - Performance
    const elementConversao = document.getElementById('player-conversao');
    const elementAproveitamento = document.getElementById('player-aproveitamento');
    const elementMediaGols = document.getElementById('player-media-gols');
    
    if (elementConversao) elementConversao.textContent = `${taxaConversao}%`;
    if (elementAproveitamento) elementAproveitamento.textContent = `${aproveitamento}%`;
    if (elementMediaGols) elementMediaGols.textContent = mediaGols;
    
    // Atualizar interface - Participação
    const elementSessoes = document.getElementById('player-sessoes');
    const elementMvp = document.getElementById('player-mvp');
    const elementParceiro = document.getElementById('player-parceiro');
    
    if (elementSessoes) elementSessoes.textContent = sessoesParticipadas.size;
    if (elementMvp) elementMvp.textContent = partidasMVP;
    if (elementParceiro) elementParceiro.textContent = parceiroFrequente;
    
    // Atualizar interface - Temporais
    const elementTempoMedio = document.getElementById('player-tempo-medio');
    if (elementTempoMedio) elementTempoMedio.textContent = `${tempoMedio}min`;
    
    // Atualizar interface - Curiosas
    const elementPrimeiroGol = document.getElementById('player-primeiro-gol');
    const elementHatTricks = document.getElementById('player-hat-tricks');
    const elementClutch = document.getElementById('player-clutch');
    
    if (elementPrimeiroGol) elementPrimeiroGol.textContent = primeiroGol;
    if (elementHatTricks) elementHatTricks.textContent = hatTricks;
    if (elementClutch) elementClutch.textContent = golsDecisivos;
    
    // Calcular posições nos rankings gerais
    calculatePlayerRankings(playerId);
    
    console.log('✅ Interface atualizada com sucesso');
}

// Calcular posição do jogador nos rankings gerais
function calculatePlayerRankings(playerId) {
    const rankings = {
        artilharia: calculateArtilhariaRanking(),
        fominhas: calculateFominhasRanking(),
        carasVitoria: calculateCarasVitoriaRanking(),
        reisPelada: calculateReisPeladaRanking(),
        bolaMurcha: calculateBolaMurchaRanking(),
        mediagols: calculateMediaGolsRanking(),
        parceiros: calculateParceirosRanking()
    };
    
    // Encontrar posições do jogador
    const positions = {
        artilharia: findPlayerPosition(rankings.artilharia, playerId),
        fominhas: findPlayerPosition(rankings.fominhas, playerId),
        carasVitoria: findPlayerPosition(rankings.carasVitoria, playerId),
        reisPelada: findPlayerPosition(rankings.reisPelada, playerId),
        bolaMurcha: findPlayerPosition(rankings.bolaMurcha, playerId),
        mediagols: findPlayerPosition(rankings.mediagols, playerId),
        parceiros: findPlayerPosition(rankings.parceiros, playerId)
    };
    
    // Atualizar interface
    document.getElementById('player-rank-artilharia').textContent = positions.artilharia;
    document.getElementById('player-rank-fominhas').textContent = positions.fominhas;
    document.getElementById('player-rank-caras-vitoria').textContent = positions.carasVitoria;
    document.getElementById('player-rank-reis-pelada').textContent = positions.reisPelada;
    document.getElementById('player-rank-bola-murcha').textContent = positions.bolaMurcha;
    document.getElementById('player-rank-media-gols').textContent = positions.mediagols;
    document.getElementById('player-rank-parceiros').textContent = positions.parceiros;
}

// Encontrar posição do jogador no ranking
function findPlayerPosition(ranking, playerId) {
    const jogador = statsState.allPlayers.find(p => p.id == playerId);
    if (!jogador) return '-';
    
    const position = ranking.findIndex(item => item.jogador === jogador.nome);
    return position !== -1 ? `${position + 1}º` : '-';
}

// Calcular ranking de artilharia (igual à função updateArtilheiros mas retorna dados)
function calculateArtilhariaRanking() {
    const golsPorJogador = {};
    
    statsState.allGoals.forEach(gol => {
        if (!golsPorJogador[gol.jogador_id]) {
            golsPorJogador[gol.jogador_id] = 0;
        }
        golsPorJogador[gol.jogador_id]++;
    });
    
    return Object.entries(golsPorJogador)
        .map(([jogadorId, gols]) => {
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            return {
                jogador: jogador ? jogador.nome : 'Desconhecido',
                valor: gols,
                stats: `${gols} gol${gols > 1 ? 's' : ''}`
            };
        })
        .sort((a, b) => b.valor - a.valor);
}

// Calcular ranking de fominhas (mais participações)
function calculateFominhasRanking() {
    const participacoesPorJogador = {};
    statsState.allGames.filter(g => g.status === 'finalizado').forEach(game => {
        [game.time_a, game.time_b].forEach(timeJson => {
            if (timeJson) {
                let time;
                try {
                    time = typeof timeJson === 'string' ? JSON.parse(timeJson) : timeJson;
                } catch (e) { time = []; }
                if (Array.isArray(time)) {
                    time.forEach(jogador => {
                        let jogadorId = typeof jogador === 'string' ? jogador : (jogador.id || jogador.jogador_id);
                        if (jogadorId) {
                            participacoesPorJogador[jogadorId] = (participacoesPorJogador[jogadorId] || 0) + 1;
                        }
                    });
                }
            }
        });
    });
    
    return Object.entries(participacoesPorJogador)
        .map(([jogadorId, participacoes]) => {
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            return {
                jogador: jogador ? jogador.nome : 'Desconhecido',
                valor: participacoes,
                stats: `${participacoes} jogo${participacoes > 1 ? 's' : ''}`
            };
        })
        .sort((a, b) => b.valor - a.valor);
}

// Calcular ranking Os Caras da Vitória (vitórias)
function calculateCarasVitoriaRanking() {
    const vitoriasPorJogador = {};
    statsState.allGames.filter(g => g.status === 'finalizado').forEach(game => {
        let timeVencedor = game.time_vencedor;
        let time;
        if (timeVencedor === 'A') {
            time = typeof game.time_a === 'string' ? JSON.parse(game.time_a) : game.time_a;
        } else if (timeVencedor === 'B') {
            time = typeof game.time_b === 'string' ? JSON.parse(game.time_b) : game.time_b;
        } else {
            time = [];
        }
        if (Array.isArray(time)) {
            time.forEach(jogador => {
                let jogadorId = typeof jogador === 'string' ? jogador : (jogador.id || jogador.jogador_id);
                if (jogadorId) {
                    vitoriasPorJogador[jogadorId] = (vitoriasPorJogador[jogadorId] || 0) + 1;
                }
            });
        }
    });
    
    return Object.entries(vitoriasPorJogador)
        .map(([jogadorId, vitorias]) => {
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            return {
                jogador: jogador ? jogador.nome : 'Desconhecido',
                valor: vitorias,
                stats: `${vitorias} vitória${vitorias > 1 ? 's' : ''}`
            };
        })
        .sort((a, b) => b.valor - a.valor);
}

// Calcular ranking Reis da Pelada (vitórias + gols)
function calculateReisPeladaRanking() {
    const scoresPorJogador = {};
    
    // Contar vitórias
    statsState.allGames.filter(g => g.status === 'finalizado').forEach(game => {
        let timeVencedor = game.time_vencedor;
        let time;
        if (timeVencedor === 'A') {
            time = typeof game.time_a === 'string' ? JSON.parse(game.time_a) : game.time_a;
        } else if (timeVencedor === 'B') {
            time = typeof game.time_b === 'string' ? JSON.parse(game.time_b) : game.time_b;
        } else {
            time = [];
        }
        if (Array.isArray(time)) {
            time.forEach(jogador => {
                let jogadorId = typeof jogador === 'string' ? jogador : (jogador.id || jogador.jogador_id);
                if (jogadorId) {
                    if (!scoresPorJogador[jogadorId]) {
                        scoresPorJogador[jogadorId] = { vitorias: 0, gols: 0 };
                    }
                    scoresPorJogador[jogadorId].vitorias++;
                }
            });
        }
    });
    
    // Contar gols
    statsState.allGoals.forEach(goal => {
        if (goal.jogador_id) {
            if (!scoresPorJogador[goal.jogador_id]) {
                scoresPorJogador[goal.jogador_id] = { vitorias: 0, gols: 0 };
            }
            scoresPorJogador[goal.jogador_id].gols++;
        }
    });
    
    return Object.entries(scoresPorJogador)
        .map(([jogadorId, stats]) => {
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            const scoreTotal = stats.vitorias + stats.gols;
            return {
                jogador: jogador ? jogador.nome : 'Desconhecido',
                valor: scoreTotal,
                stats: `${stats.vitorias} vitória${stats.vitorias !== 1 ? 's' : ''} + ${stats.gols} gol${stats.gols !== 1 ? 's' : ''} = ${scoreTotal} pontos`
            };
        })
        .sort((a, b) => b.valor - a.valor);
}

// Calcular ranking Bola Murcha (derrotas)
function calculateBolaMurchaRanking() {
    const derrotasPorJogador = {};
    const partidasPorJogador = {};
    
    statsState.allGames.filter(g => g.status === 'finalizado').forEach(game => {
        let timeVencedor = game.time_vencedor;
        let timeA = typeof game.time_a === 'string' ? JSON.parse(game.time_a) : game.time_a;
        let timeB = typeof game.time_b === 'string' ? JSON.parse(game.time_b) : game.time_b;
        
        // Contar partidas para todos os jogadores
        if (Array.isArray(timeA)) {
            timeA.forEach(jogador => {
                let jogadorId = typeof jogador === 'string' ? jogador : (jogador.id || jogador.jogador_id);
                if (jogadorId) {
                    partidasPorJogador[jogadorId] = (partidasPorJogador[jogadorId] || 0) + 1;
                    derrotasPorJogador[jogadorId] = derrotasPorJogador[jogadorId] || 0;
                    
                    // Se time B venceu, jogadores do time A perderam
                    if (timeVencedor === 'B') {
                        derrotasPorJogador[jogadorId]++;
                    }
                }
            });
        }
        
        if (Array.isArray(timeB)) {
            timeB.forEach(jogador => {
                let jogadorId = typeof jogador === 'string' ? jogador : (jogador.id || jogador.jogador_id);
                if (jogadorId) {
                    partidasPorJogador[jogadorId] = (partidasPorJogador[jogadorId] || 0) + 1;
                    derrotasPorJogador[jogadorId] = derrotasPorJogador[jogadorId] || 0;
                    
                    // Se time A venceu, jogadores do time B perderam
                    if (timeVencedor === 'A') {
                        derrotasPorJogador[jogadorId]++;
                    }
                }
            });
        }
    });
    
    return Object.entries(derrotasPorJogador)
        .filter(([jogadorId, derrotas]) => partidasPorJogador[jogadorId] >= 3) // Apenas jogadores com 3+ partidas
        .map(([jogadorId, derrotas]) => {
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            const partidas = partidasPorJogador[jogadorId];
            return {
                jogador: jogador ? jogador.nome : 'Desconhecido',
                valor: derrotas,
                stats: `${derrotas} derrota${derrotas !== 1 ? 's' : ''} em ${partidas} partida${partidas !== 1 ? 's' : ''}`
            };
        })
        .sort((a, b) => b.valor - a.valor);
}

// Calcular ranking de primeiros gols
function calculatePrimeirosGolsRanking() {
    const clutchPorJogador = {};
    
    if (!statsState.allGoals || statsState.allGoals.length === 0) {
        return [];
    }
    
    // Contar apenas primeiros gols de cada partida (versão simplificada)
    const partidasProcessadas = new Set();
    
    statsState.allGoals.forEach(gol => {
        const partidaId = gol.partida_id;
        const jogadorId = gol.jogador_id;
        
        // Se essa partida ainda não foi processada, contar este como primeiro gol
        if (partidaId && jogadorId && !partidasProcessadas.has(partidaId)) {
            clutchPorJogador[jogadorId] = (clutchPorJogador[jogadorId] || 0) + 1;
            partidasProcessadas.add(partidaId);
        }
    });
    
    return Object.entries(clutchPorJogador)
        .map(([jogadorId, golsClutch]) => {
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            return {
                jogador: jogador ? jogador.nome : 'Desconhecido',
                valor: golsClutch,
                stats: `${golsClutch} primeiro${golsClutch !== 1 ? 's' : ''} gol${golsClutch !== 1 ? 's' : ''}`
            };
        })
        .sort((a, b) => b.valor - a.valor);
}

// Calcular ranking de média de gols
function calculateMediaGolsRanking() {
    const golsPorJogador = {};
    const partidasPorJogador = {};
    
    statsState.allGoals.forEach(gol => {
        let jogadorId = gol.jogador_id;
        if (jogadorId) {
            golsPorJogador[jogadorId] = (golsPorJogador[jogadorId] || 0) + 1;
        }
    });
    
    statsState.allGames.filter(g => g.status === 'finalizado').forEach(game => {
        let timeA = typeof game.time_a === 'string' ? JSON.parse(game.time_a) : game.time_a;
        let timeB = typeof game.time_b === 'string' ? JSON.parse(game.time_b) : game.time_b;
        
        if (Array.isArray(timeA)) {
            timeA.forEach(jogador => {
                let jogadorId = typeof jogador === 'string' ? jogador : (jogador.id || jogador.jogador_id);
                if (jogadorId) {
                    partidasPorJogador[jogadorId] = (partidasPorJogador[jogadorId] || 0) + 1;
                }
            });
        }
        
        if (Array.isArray(timeB)) {
            timeB.forEach(jogador => {
                let jogadorId = typeof jogador === 'string' ? jogador : (jogador.id || jogador.jogador_id);
                if (jogadorId) {
                    partidasPorJogador[jogadorId] = (partidasPorJogador[jogadorId] || 0) + 1;
                }
            });
        }
    });
    
    return Object.entries(partidasPorJogador)
        .filter(([jogadorId, partidas]) => partidas >= 5)
        .map(([jogadorId, partidas]) => {
            const gols = golsPorJogador[jogadorId] || 0;
            const media = (gols / partidas).toFixed(2);
            const jogador = statsState.allPlayers.find(p => p.id == jogadorId);
            return {
                jogador: jogador ? jogador.nome : 'Desconhecido',
                valor: parseFloat(media),
                stats: `${media} gols/partida (${gols} gols em ${partidas} partidas)`
            };
        })
        .sort((a, b) => b.valor - a.valor);
}

// Calcular ranking de parceiros ideais
function calculateParceirosRanking() {
    const duplas = {};
    
    statsState.allGames.filter(g => g.status === 'finalizado').forEach(game => {
        let timeA = typeof game.time_a === 'string' ? JSON.parse(game.time_a) : game.time_a;
        let timeB = typeof game.time_b === 'string' ? JSON.parse(game.time_b) : game.time_b;
        
        if (Array.isArray(timeA) && timeA.length >= 2) {
            for (let i = 0; i < timeA.length; i++) {
                for (let j = i + 1; j < timeA.length; j++) {
                    let jogador1Id = typeof timeA[i] === 'string' ? timeA[i] : (timeA[i].id || timeA[i].jogador_id);
                    let jogador2Id = typeof timeA[j] === 'string' ? timeA[j] : (timeA[j].id || timeA[j].jogador_id);
                    
                    if (jogador1Id && jogador2Id) {
                        let chave = [jogador1Id, jogador2Id].sort().join('-');
                        duplas[chave] = duplas[chave] || {
                            jogador1Id: jogador1Id,
                            jogador2Id: jogador2Id,
                            partidas: 0
                        };
                        duplas[chave].partidas++;
                    }
                }
            }
        }
        
        if (Array.isArray(timeB) && timeB.length >= 2) {
            for (let i = 0; i < timeB.length; i++) {
                for (let j = i + 1; j < timeB.length; j++) {
                    let jogador1Id = typeof timeB[i] === 'string' ? timeB[i] : (timeB[i].id || timeB[i].jogador_id);
                    let jogador2Id = typeof timeB[j] === 'string' ? timeB[j] : (timeB[j].id || timeB[j].jogador_id);
                    
                    if (jogador1Id && jogador2Id) {
                        let chave = [jogador1Id, jogador2Id].sort().join('-');
                        duplas[chave] = duplas[chave] || {
                            jogador1Id: jogador1Id,
                            jogador2Id: jogador2Id,
                            partidas: 0
                        };
                        duplas[chave].partidas++;
                    }
                }
            }
        }
    });
    
    return Object.values(duplas)
        .filter(dupla => dupla.partidas >= 3)
        .map(dupla => {
            const jogador1 = statsState.allPlayers.find(p => p.id == dupla.jogador1Id);
            const jogador2 = statsState.allPlayers.find(p => p.id == dupla.jogador2Id);
            const nome1 = jogador1 ? jogador1.nome : 'Desconhecido';
            const nome2 = jogador2 ? jogador2.nome : 'Desconhecido';
            return {
                jogador: `${nome1} & ${nome2}`,
                valor: dupla.partidas,
                stats: `${dupla.partidas} partida${dupla.partidas !== 1 ? 's' : ''} juntos`
            };
        })
        .sort((a, b) => b.valor - a.valor);
}

// Event listeners para o modal
document.addEventListener('DOMContentLoaded', function() {
    // Fechar modal ao clicar no fundo
    const modal = document.getElementById('modal-ranking-completo');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeRankingModal();
            }
        });
    }
    
    // Fechar modal com botão X
    const fecharBtn = document.getElementById('fechar-modal-ranking');
    if (fecharBtn) {
        fecharBtn.addEventListener('click', closeRankingModal);
    }
    
    // Fechar modal com ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeRankingModal();
        }
    });
});

// Função para verificar se o usuário atual é admin
function isAdmin() {
    try {
        const userData = localStorage.getItem('pelada3_user');
        if (!userData) return false;
        
        const user = JSON.parse(userData);
        return user.username === 'admin';
    } catch (error) {
        console.error('Erro ao verificar admin:', error);
        return false;
    }
}

// Função para verificar se o usuário atual é jogador (role: player)
function isPlayer() {
    try {
        const userData = localStorage.getItem('pelada3_user');
        if (!userData) return false;
        
        const user = JSON.parse(userData);
        return user.role === 'player';
    } catch (error) {
        console.error('Erro ao verificar jogador:', error);
        return false;
    }
}

// Função para configurar o botão admin baseado no usuário
function configurarBotaoAdmin() {
    const btnApagarDia = document.getElementById('btn-apagar-dia');
    const adminEmoji = document.getElementById('admin-emoji');
    
    if (!btnApagarDia || !adminEmoji) return;
    
    if (isAdmin()) {
        // Admin: botão ativo
        adminEmoji.textContent = '🔒';
        btnApagarDia.title = 'Apagar dados do dia';
        btnApagarDia.style.opacity = '1';
        btnApagarDia.style.cursor = 'pointer';
        btnApagarDia.style.filter = 'none';
    } else {
        // Não admin: botão bloqueado
        adminEmoji.textContent = '🚫';
        btnApagarDia.title = 'Acesso restrito - Apenas administradores';
        btnApagarDia.style.opacity = '0.5';
        btnApagarDia.style.cursor = 'not-allowed';
        btnApagarDia.style.filter = 'grayscale(1)';
    }
}

// Função para configurar o botão home baseado no usuário
function configurarBotaoHome() {
    const homeLink = document.querySelector('a[href="index.html"]');
    const homeEmoji = homeLink?.querySelector('.emoji');
    
    if (!homeLink || !homeEmoji) return;
    
    if (isPlayer()) {
        // Jogador: botão home bloqueado
        homeEmoji.textContent = '🚫';
        homeLink.title = 'Acesso restrito - Jogadores não podem acessar home';
        homeLink.style.opacity = '0.5';
        homeLink.style.cursor = 'not-allowed';
        homeLink.style.filter = 'grayscale(1)';
        
        // Remover funcionalidade do link
        homeLink.addEventListener('click', (e) => {
            e.preventDefault();
            alert('🔒 Acesso negado!\n\nJogadores não podem acessar a tela principal.');
        });
    } else {
        // Admin/Organizador: botão home normal
        homeEmoji.textContent = '🏠';
        homeLink.title = 'Tela principal';
        homeLink.style.opacity = '1';
        homeLink.style.cursor = 'pointer';
        homeLink.style.filter = 'none';
    }
}