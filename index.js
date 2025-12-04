// JavaScript para a página Home

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await carregarDashboard();
    await carregarStatusPelada();
    await carregarUltimosJogos();
});

// Carrega dashboard principal
async function carregarDashboard() {
    try {
        // Verificar se o cliente Supabase está disponível
        if (!client) {
            console.error('Cliente Supabase não disponível');
            return;
        }
        
        // Elementos das métricas
        const totalPeladasEl = document.getElementById('total-peladas');
        const totalGolsEl = document.getElementById('total-gols');
        const totalPeladeirosEl = document.getElementById('total-peladeiros');
        const btnAcaoPrincipal = document.getElementById('btn-acao-principal');
        
        if (!totalPeladasEl) return;
        
        console.log('🔄 Carregando métricas do dashboard...');
        
        // Buscar total de peladas (sessões no histórico)
        try {
            console.log('📊 Buscando total de peladas...');
            const { data: sessoes, error } = await client
                .from('sessoes')
                .select('id');
            
            if (error) {
                console.error('❌ Erro ao buscar sessões:', error);
                throw error;
            }
            
            const totalPeladas = sessoes ? sessoes.length : 0;
            console.log('📅 Total de peladas encontradas:', totalPeladas);
            
            if (totalPeladasEl) {
                totalPeladasEl.textContent = totalPeladas;
            }
        } catch (error) {
            console.error('Erro ao buscar peladas:', error);
            if (totalPeladasEl) totalPeladasEl.textContent = 'Erro';
        }
        
        // Buscar total de gols
        try {
            console.log('⚽ Buscando total de gols...');
            const { data: jogos, error } = await client
                .from('jogos')
                .select('placar_a, placar_b')
                .eq('status', 'finalizado');
            
            if (error) {
                console.error('❌ Erro ao buscar jogos:', error);
                throw error;
            }
            
            let totalGols = 0;
            if (jogos && jogos.length > 0) {
                totalGols = jogos.reduce((total, jogo) => {
                    return total + (jogo.placar_a || 0) + (jogo.placar_b || 0);
                }, 0);
            }
            
            console.log('🎯 Total de gols encontrados:', totalGols, 'de', jogos ? jogos.length : 0, 'jogos');
            
            if (totalGolsEl) {
                totalGolsEl.textContent = totalGols;
            }
        } catch (error) {
            console.error('Erro ao buscar gols:', error);
            if (totalGolsEl) totalGolsEl.textContent = 'Erro';
        }
        
        // Buscar total de peladeiros cadastrados
        try {
            console.log('👥 Buscando total de peladeiros...');
            const { data: jogadores, error } = await client
                .from('jogadores')
                .select('id');
            
            if (error) {
                console.error('❌ Erro ao buscar jogadores:', error);
                throw error;
            }
            
            const totalPeladeiros = jogadores ? jogadores.length : 0;
            console.log('🏃‍♂️ Total de peladeiros encontrados:', totalPeladeiros);
            
            if (totalPeladeirosEl) {
                totalPeladeirosEl.textContent = totalPeladeiros;
            }
        } catch (error) {
            console.error('Erro ao buscar peladeiros:', error);
            if (totalPeladeirosEl) totalPeladeirosEl.textContent = 'Erro';
        }

        // Buscar total de partidas (jogos finalizados)
        try {
            console.log('🏆 Buscando total de partidas...');
            const totalPartidasEl = document.getElementById('total-partidas');
            
            const { data: partidas, error } = await client
                .from('jogos')
                .select('id')
                .eq('status', 'finalizado');
            
            if (error) {
                console.error('❌ Erro ao buscar partidas:', error);
                throw error;
            }
            
            const totalPartidas = partidas ? partidas.length : 0;
            console.log('🎮 Total de partidas encontradas:', totalPartidas);
            
            if (totalPartidasEl) {
                totalPartidasEl.textContent = totalPartidas;
            }
        } catch (error) {
            console.error('Erro ao buscar partidas:', error);
            const totalPartidasEl = document.getElementById('total-partidas');
            if (totalPartidasEl) totalPartidasEl.textContent = 'Erro';
        }

        // Calcular média de gols por partida
        try {
            console.log('📊 Calculando média de gols...');
            const mediaGolsEl = document.getElementById('media-gols');
            
            const { data: jogosFinalizados, error } = await client
                .from('jogos')
                .select('placar_a, placar_b')
                .eq('status', 'finalizado');
            
            if (error) {
                console.error('❌ Erro ao buscar jogos para média:', error);
                throw error;
            }
            
            let mediaGols = 0;
            if (jogosFinalizados && jogosFinalizados.length > 0) {
                const totalGolsPartidas = jogosFinalizados.reduce((total, jogo) => {
                    return total + (jogo.placar_a || 0) + (jogo.placar_b || 0);
                }, 0);
                mediaGols = totalGolsPartidas / jogosFinalizados.length;
            }
            
            console.log('⚽ Média de gols calculada:', mediaGols.toFixed(1));
            
            if (mediaGolsEl) {
                mediaGolsEl.textContent = mediaGols.toFixed(1);
            }
        } catch (error) {
            console.error('Erro ao calcular média de gols:', error);
            const mediaGolsEl = document.getElementById('media-gols');
            if (mediaGolsEl) mediaGolsEl.textContent = 'Erro';
        }

        // Buscar Rei da Pelada (jogador com mais gols)
        try {
            console.log('👑 Buscando Rei da Pelada...');
            const reiPeladaEl = document.getElementById('rei-pelada');
            
            // Primeiro, buscar todos os gols
            const { data: gols, error: errorGols } = await client
                .from('gols')
                .select('jogador_id');
            
            if (errorGols) {
                console.error('❌ Erro ao buscar gols:', errorGols);
                throw errorGols;
            }
            
            let reiDaPelada = '-';
            if (gols && gols.length > 0) {
                // Contar gols por jogador
                const golsPorJogador = {};
                gols.forEach(gol => {
                    if (gol.jogador_id) {
                        golsPorJogador[gol.jogador_id] = (golsPorJogador[gol.jogador_id] || 0) + 1;
                    }
                });
                
                // Encontrar jogador com mais gols
                let maxGols = 0;
                let jogadorComMaisGolsId = null;
                
                for (const [jogadorId, totalGols] of Object.entries(golsPorJogador)) {
                    if (totalGols > maxGols) {
                        maxGols = totalGols;
                        jogadorComMaisGolsId = jogadorId;
                    }
                }
                
                // Se encontrou um jogador com gols, buscar o nome dele
                if (jogadorComMaisGolsId && maxGols > 0) {
                    const { data: jogador, error: errorJogador } = await client
                        .from('jogadores')
                        .select('nome')
                        .eq('id', jogadorComMaisGolsId)
                        .single();
                    
                    if (!errorJogador && jogador) {
                        reiDaPelada = jogador.nome;
                        console.log('👑 Rei da Pelada encontrado:', reiDaPelada, 'com', maxGols, 'gols');
                    } else {
                        console.log('👑 Jogador com mais gols encontrado, mas erro ao buscar nome');
                        reiDaPelada = `Jogador #${jogadorComMaisGolsId}`;
                    }
                } else {
                    console.log('👑 Nenhum rei da pelada ainda (sem gols registrados)');
                }
            } else {
                console.log('👑 Nenhum gol registrado ainda');
            }
            
            if (reiPeladaEl) {
                reiPeladaEl.textContent = reiDaPelada;
            }
        } catch (error) {
            console.error('Erro ao buscar rei da pelada:', error);
            const reiPeladaEl = document.getElementById('rei-pelada');
            if (reiPeladaEl) reiPeladaEl.textContent = 'Erro';
        }
        
        // Configurar botão de ação principal baseado no status da sessão atual
        if (btnAcaoPrincipal) {
            const resultadoSessao = await Database.buscarSessaoAtiva();
            const sessaoAtiva = resultadoSessao?.data || resultadoSessao;
            
            if (sessaoAtiva) {
                // Verificar se há jogo ativo
                const resultadoJogo = await Database.buscarJogoAtivo(sessaoAtiva.id);
                const jogoAtivo = resultadoJogo?.data || resultadoJogo;
                
                if (jogoAtivo) {
                    btnAcaoPrincipal.innerHTML = '<span class="btn-icon">🎮</span><span>Ver Partida</span>';
                    btnAcaoPrincipal.onclick = () => irPara('partida.html');
                } else {
                    // Verificar quantos jogadores na fila
                    const resultadoFila = await Database.buscarFilaPorSessao(sessaoAtiva.id);
                    const fila = resultadoFila?.data || resultadoFila;
                    const jogadoresNaFila = fila ? fila.filter(j => j.status === 'fila').length : 0;
                    
                    if (jogadoresNaFila >= 12) {
                        btnAcaoPrincipal.innerHTML = '<span class="btn-icon">▶️</span><span>Iniciar Jogo</span>';
                        btnAcaoPrincipal.onclick = iniciarJogo;
                    } else {
                        btnAcaoPrincipal.innerHTML = '<span class="btn-icon">👥</span><span>Ver Fila</span>';
                        btnAcaoPrincipal.onclick = () => irPara('fila.html');
                    }
                }
            } else {
                btnAcaoPrincipal.innerHTML = '<span class="btn-icon">🎲</span><span>Fazer Sorteio</span>';
                btnAcaoPrincipal.onclick = () => irPara('sorteio.html');
            }
        }
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

// Ação principal dinâmica
function acaoPrincipal() {
    // Implementada dinamicamente no carregarDashboard
}

// Funções de navegação
function irPara(pagina) {
    window.location.href = pagina;
}

function irParaFila() {
    // Verificar se existe sessão ativa
    const sessaoAtiva = localStorage.getItem('sessaoAtiva');
    if (!sessaoAtiva) {
        alert('❌ Nenhuma sessão ativa! Faça um sorteio primeiro.');
        irPara('sorteio.html');
        return;
    }
    irPara('fila.html');
}

function irParaJogo() {
    // Verificar se existe jogo em andamento
    const jogoAtivo = localStorage.getItem('jogoAtivo');
    if (!jogoAtivo) {
        alert('❌ Nenhum jogo ativo! Inicie um jogo primeiro.');
        return;
    }
    irPara('partida.html');
}

// Carregar status da pelada
async function carregarStatusPelada() {
    try {
        // Verificar se os elementos existem antes de tentar atualizá-los
        const totalJogadoresEl = document.getElementById('total-jogadores');
        const jogoAtualEl = document.getElementById('jogo-atual');
        const vitoriasConsecutivasEl = document.getElementById('vitorias-consecutivas');
        
        // Se nenhum elemento existe, sair silenciosamente
        if (!totalJogadoresEl && !jogoAtualEl && !vitoriasConsecutivasEl) {
            return;
        }
        
        // Buscar sessão ativa
        const resultadoSessao = await Database.buscarSessaoAtiva();
        const sessaoAtiva = resultadoSessao?.data || resultadoSessao;
        
        if (!sessaoAtiva) {
            if (totalJogadoresEl) totalJogadoresEl.textContent = '0';
            if (jogoAtualEl) jogoAtualEl.textContent = 'Nenhum';
            if (vitoriasConsecutivasEl) vitoriasConsecutivasEl.textContent = '0';
            return;
        }

        // Buscar jogadores na fila da sessão ativa
        const resultadoFila = await Database.buscarFilaPorSessao(sessaoAtiva.id);
        const fila = resultadoFila?.data || resultadoFila;
        const jogadoresNaFila = fila ? fila.filter(j => j.status === 'fila').length : 0;
        
        // Buscar jogo em andamento
        const resultadoJogo = await Database.buscarJogoAtivo(sessaoAtiva.id);
        const jogoAtivo = resultadoJogo?.data || resultadoJogo;
        
        // Calcular vitórias consecutivas máximas
        let vitoriasConsecutivas = 0;
        if (fila && fila.length > 0) {
            vitoriasConsecutivas = Math.max(...fila.map(j => j.vitorias_consecutivas_time || 0));
        }

        // Atualizar interface apenas se os elementos existirem
        if (totalJogadoresEl) {
            totalJogadoresEl.textContent = jogadoresNaFila;
        }
        
        if (jogoAtualEl) {
            jogoAtualEl.textContent = jogoAtivo ? 
                `${jogoAtivo.placar_a} x ${jogoAtivo.placar_b}` : 'Nenhum';
        }
        
        if (vitoriasConsecutivasEl) {
            vitoriasConsecutivasEl.textContent = vitoriasConsecutivas;
        }

        // Habilitar/desabilitar botão de iniciar jogo (se existir)
        const btnIniciarJogo = document.getElementById('btn-iniciar-jogo');
        if (btnIniciarJogo) {
            if (jogadoresNaFila >= 12) {
                btnIniciarJogo.disabled = false;
                btnIniciarJogo.innerHTML = `
                    <span class="emoji">▶️</span>
                    <span>Iniciar Jogo</span>
                `;
            } else {
                btnIniciarJogo.disabled = true;
                btnIniciarJogo.innerHTML = `
                    <span class="emoji">⏸️</span>
                    <span>Precisa de 12+ jogadores</span>
                `;
            }
        }

    } catch (error) {
        console.error('Erro ao carregar status:', error);
    }
}

// Carregar últimos jogos
async function carregarUltimosJogos() {
    try {
        // Verificar se o elemento existe antes de tentar atualizá-lo
        const listaJogos = document.getElementById('lista-jogos');
        
        // Se o elemento não existe, sair silenciosamente
        if (!listaJogos) {
            return;
        }
        
        const resultadoJogos = await Database.buscarJogosRecentes(5);
        const jogos = resultadoJogos?.data || resultadoJogos;
        
        if (!jogos || jogos.length === 0) {
            listaJogos.innerHTML = `
                <div class="empty-state">
                    <span class="emoji">😴</span>
                    <p>Nenhum jogo hoje ainda</p>
                </div>
            `;
            return;
        }

        listaJogos.innerHTML = jogos.map(jogo => `
            <div class="game-item">
                <div class="game-info">
                    <div class="game-score">
                        ${jogo.placar_a} x ${jogo.placar_b}
                        ${jogo.time_vencedor ? 
                            (jogo.time_vencedor === 'A' ? ' 🟢' : ' 🔴') : 
                            ' ⚪'
                        }
                    </div>
                    <div class="game-time">
                        ${formatarTempo(jogo.tempo_decorrido)} 
                        ${jogo.status === 'finalizado' ? '✅' : '⏸️'}
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Erro ao carregar jogos:', error);
    }
}

// Iniciar novo jogo
async function iniciarJogo() {
    try {
        const { data: sessaoAtiva } = await Database.buscarSessaoAtiva();
        if (!sessaoAtiva) {
            alert('❌ Nenhuma sessão ativa!');
            return;
        }

        // Verificar se já existe jogo ativo
        const { data: jogoAtivo } = await Database.buscarJogoAtivo(sessaoAtiva.id);
        if (jogoAtivo) {
            if (confirm('🎮 Já existe um jogo ativo. Continuar?')) {
                localStorage.setItem('jogoAtivo', jogoAtivo.id);
                irPara('partida.html');
            }
            return;
        }

        // Buscar primeiros 12 da fila
        const { data: fila } = await Database.buscarFilaPorSessao(sessaoAtiva.id);
        const jogadoresAtivos = fila.filter(j => j.status === 'fila')
                                   .sort((a, b) => a.posicao_fila - b.posicao_fila);

        if (jogadoresAtivos.length < 12) {
            alert(`❌ Precisa de pelo menos 12 jogadores. Atual: ${jogadoresAtivos.length}`);
            return;
        }

        // Separar times
        const timeA = jogadoresAtivos.slice(0, 6).map(j => j.jogador_id);
        const timeB = jogadoresAtivos.slice(6, 12).map(j => j.jogador_id);

        // Criar novo jogo
        const novoJogo = {
            sessao_id: sessaoAtiva.id,
            time_a: timeA,
            time_b: timeB,
            status: 'em_andamento'
        };

        const { data: jogo } = await Database.criarJogo(novoJogo);
        
        if (jogo) {
            localStorage.setItem('jogoAtivo', jogo[0].id);
            irPara('partida.html');
        }

    } catch (error) {
        console.error('Erro ao iniciar jogo:', error);
        alert('❌ Erro ao iniciar jogo!');
    }
}

// Utilitários
function formatarTempo(segundos) {
    const min = Math.floor(segundos / 60);
    const sec = segundos % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

// Atualizar página automaticamente
setInterval(async () => {
    await carregarDashboard();
    await carregarStatusPelada();
}, 15000); // A cada 15 segundos