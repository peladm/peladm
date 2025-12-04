// Variáveis globais do cronômetro
let intervaloCronometro = null;

// Estado de seleção de gol
let modoSelecaoGol = {
    ativo: false,
    time: null
};

// Configurar bloqueio de navegação quando cronômetro pausado
function configurarBloqueioNavegacao() {
    // Prevenir saída da página quando cronômetro pausado
    window.addEventListener('beforeunload', (e) => {
        if (estadoPartida.pausado && estadoPartida.iniciado && !estadoPartida.cronometroPausadoParaSubstituicao) {
            e.preventDefault();
            e.returnValue = 'O cronômetro está pausado! Retome ou finalize a partida antes de sair.';
            return e.returnValue;
        }
    });
    
    // Interceptar cliques em links de navegação
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        
        // Dar exceção para o botão de substituição
        if (link && link.id === 'substitute-footer-btn') {
            return; // Permitir substituição sempre
        }
        
        if (link && estadoPartida.pausado && estadoPartida.iniciado && !estadoPartida.cronometroPausadoParaSubstituicao) {
            e.preventDefault();
            
            // Mostrar alerta personalizado
            const confirmar = confirm(
                '⚠️ CRONÔMETRO PAUSADO!\n\n' +
                'Você tem um cronômetro pausado nesta partida.\n' +
                'Para navegar, você precisa:\n\n' +
                '• Retomar o cronômetro, OU\n' +
                '• Finalizar a partida\n\n' +
                'Deseja retomar o cronômetro agora?'
            );
            
            if (confirmar) {
                // Retomar cronômetro automaticamente
                toggleCronometro();
            }
            
            return false;
        }
    });
}

// Estado global da partida
let estadoPartida = {
    jogoId: null,
    timerId: null,
    iniciado: false,
    pausado: false,
    duracaoTotal: 10, // minutos (vem das regras)
    tempoRestante: 600, // segundos (10 minutos = 600 segundos)
    dataInicio: null,
    placarA: 0,
    placarB: 0,
    timeA: [],
    timeB: [],
    golsPartida: {},
    historicoAcoes: [],
    vitoriasConsecutivas: 0,
    limiteVitorias: 3,
    regras: null,
    acabouDeRetomar: false, // Flag para evitar salvamentos logo após retomar
    substituicoes: [], // Array de substituições realizadas
    contadorSubstituicoes: 0, // Contador para calcular próxima posição
    finalizando: false, // Flag para prevenir múltiplas finalizações
    // Sistema de cores (padrão: A=preto, B=vermelho)
    coresColetes: {
        timeA: 'black',
        timeB: 'red'
    }
};

// Função para obter nome da cor do colete
function obterNomeCor(corCodigo) {
    const coresNomes = {
        'black': 'PRETO',
        'red': 'VERMELHO',
        'blue': 'AZUL',
        'green': 'VERDE',
        'yellow': 'AMARELO',
        'orange': 'LARANJA',
        'purple': 'ROXO',
        'white': 'BRANCO',
        'gray': 'CINZA',
        'navy': 'MARINHO'
    };
    return coresNomes[corCodigo] || corCodigo.toUpperCase();
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', async () => {
    try {
        mostrarLoading(true);
        
        // Aplicar restrições visuais para jogadores
        aplicarRestricoesVisuaisPartida();
        
        // Configurar bloqueio de navegação quando cronômetro pausado
        configurarBloqueioNavegacao();
        
        // Obter ID do jogo da URL
        const urlParams = new URLSearchParams(window.location.search);
        estadoPartida.jogoId = urlParams.get('jogo_id');
        
        if (!estadoPartida.jogoId) {
            // Verificar se existe algum jogo ativo na sessão
            const jogoAtivo = await obterJogoAtivo();
            if (jogoAtivo) {
                // Redirecionar para o jogo ativo encontrado
                window.location.href = `partida.html?jogo_id=${jogoAtivo.id}`;
                return;
            } else {
                // Mostrar tela de nenhum jogo ativo
                mostrarTelaSemanJogo();
                return;
            }
        }
        
        // Carregar dados da partida
        await carregarPartida();
        
        // Configurar event listeners
        configurarEventListeners();
        
        // Iniciar sincronização
        iniciarSincronizacao();
        
        // Esconder tela sem jogo (caso esteja visível)
        esconderTelaSemanJogo();
        
        mostrarLoading(false);
        
        // Mostrar alerta de lembrete das cores dos coletes após carregar a partida
        setTimeout(() => {
            mostrarAlertaCoresColetes();
        }, 1500); // Aguardar 1.5 segundos para garantir que tudo carregou
        
    } catch (error) {
        console.error('Erro ao inicializar partida:', error);
        
        // Se não há jogo_id na URL, verificar se existe jogo ativo
        if (!estadoPartida.jogoId) {
            try {
                const jogoAtivo = await obterJogoAtivo();
                if (jogoAtivo) {
                    window.location.href = `partida.html?jogo_id=${jogoAtivo.id}`;
                    return;
                } else {
                    mostrarTelaSemanJogo();
                    return;
                }
            } catch (err) {
                console.error('Erro ao verificar jogo ativo:', err);
                mostrarTelaSemanJogo();
                return;
            }
        }
        
        // Para outros erros, mostrar tela sem jogo
        mostrarTelaSemanJogo();
    }
});

// Carregar dados da partida do banco
async function carregarPartida() {
    try {
        console.log('🔍 Carregando partida com ID:', estadoPartida.jogoId);
        
        // Testar conectividade primeiro
        console.log('🔗 Testando conectividade...');
        const conectividade = await testarConectividade();
        if (!conectividade.success) {
            console.error('❌ Falha na conectividade:', conectividade.error);
            alert('❌ Erro de conexão com o banco de dados!\nVerifique sua internet e recarregue a página.');
            return;
        }
        console.log('✅ Conectividade confirmada');
        
        // Buscar jogo
        const jogo = await obterJogo(estadoPartida.jogoId);
        console.log('🎮 Jogo encontrado:', jogo);
        
        if (!jogo) {
            throw new Error('Jogo não encontrado');
        }
        
        // Verificar se jogo está finalizado
        if (jogo.status === 'finalizado') {
            alert('🏁 Esta partida já foi finalizada.');
            window.location.href = 'fila.html';
            return;
        }
        
        // Buscar regras (usar padrões se não existir)
        estadoPartida.regras = await obterRegras();
        if (!estadoPartida.regras) {
            console.log('⚠️ Nenhuma regra encontrada, usando padrões');
            estadoPartida.regras = {
                duracao: 10, // 10 minutos
                vitorias_consecutivas: 3
            };
        }
        estadoPartida.duracaoTotal = estadoPartida.regras.duracao;
        estadoPartida.limiteVitorias = estadoPartida.regras.vitorias_consecutivas;
        
        // Configurar tempo restante (regressivo)
        const duracaoTotalSegundos = estadoPartida.duracaoTotal * 60;
        let tempoDecorrido = jogo.tempo_decorrido || 0;
        
        console.log('⏱️ Calculando tempo restante:', {
            status: jogo.status,
            duracaoTotal: duracaoTotalSegundos,
            tempoDecorridoSalvo: jogo.tempo_decorrido,
            dataInicio: jogo.data_inicio
        });
        
        // Se o jogo está em andamento, calcular tempo real decorrido
        if (jogo.status === 'em_andamento' && jogo.data_inicio) {
            const agora = new Date();
            const dataInicio = new Date(jogo.data_inicio);
            tempoDecorrido = Math.floor((agora - dataInicio) / 1000);
            console.log('🔄 Jogo em andamento - tempo calculado:', tempoDecorrido);
        } else if (jogo.status === 'pausado') {
            console.log('⏸️ Jogo pausado - usando tempo salvo:', tempoDecorrido);
        }
        
        estadoPartida.tempoRestante = Math.max(0, duracaoTotalSegundos - tempoDecorrido);
        
        console.log('⏰ Tempo restante final:', estadoPartida.tempoRestante, 'segundos');
        
        // Buscar vitórias consecutivas atuais
        const sessao = await obterSessaoAtiva();
        estadoPartida.vitoriasConsecutivas = sessao?.vitorias_consecutivas_time || 0;
        
        // Restaurar estado do jogo
        console.log('📊 Dados do jogo carregados:', {
            id: jogo.id,
            placar_a: jogo.placar_a,
            placar_b: jogo.placar_b,
            tempo_decorrido: jogo.tempo_decorrido,
            status: jogo.status,
            data_inicio: jogo.data_inicio,
            tempoRestante_calculado: estadoPartida.tempoRestante,
            acoes_partida: jogo.acoes_partida?.length || 0,
            time_a_length: jogo.time_a?.length || 0,
            time_b_length: jogo.time_b?.length || 0
        });
        
        console.log('🎯 Estado após carregamento:', {
            estadoPartida_placarA: estadoPartida.placarA,
            estadoPartida_placarB: estadoPartida.placarB,
            estadoPartida_golsPartida: Object.keys(estadoPartida.golsPartida).length
        });
        
        estadoPartida.placarA = jogo.placar_a || 0;
        estadoPartida.placarB = jogo.placar_b || 0;
        estadoPartida.timeA = jogo.time_a;
        estadoPartida.timeB = jogo.time_b;
        
        // Debug: verificar estrutura dos times
        console.log('🔍 Estrutura dos times carregados:', {
            timeA: estadoPartida.timeA,
            timeB: estadoPartida.timeB,
            timeA_type: typeof estadoPartida.timeA,
            timeB_type: typeof estadoPartida.timeB,
            timeA_isArray: Array.isArray(estadoPartida.timeA),
            timeB_isArray: Array.isArray(estadoPartida.timeB),
            timeA_sample: estadoPartida.timeA && estadoPartida.timeA[0],
            timeB_sample: estadoPartida.timeB && estadoPartida.timeB[0]
        });
        
        estadoPartida.tempoDecorrido = jogo.tempo_decorrido || 0;
        estadoPartida.dataInicio = jogo.data_inicio ? new Date(jogo.data_inicio) : null;
        estadoPartida.historicoAcoes = []; // Não usado mais, manter compatibilidade
        estadoPartida.iniciado = jogo.status === 'em_andamento' && estadoPartida.dataInicio;
        estadoPartida.pausado = jogo.status === 'pausado';
        
        // Log específico para jogo pausado
        if (estadoPartida.pausado) {
            console.log('⏸️ CARREGAMENTO: Jogo pausado detectado:', {
                tempo_decorrido_banco: jogo.tempo_decorrido,
                tempoRestante_calculado: estadoPartida.tempoRestante,
                estadoPartida_tempoDecorrido: estadoPartida.tempoDecorrido,
                dataInicio: estadoPartida.dataInicio,
                status_banco: jogo.status,
                duracaoTotal: estadoPartida.duracaoTotal
            });
            
            // VERIFICAÇÃO CRÍTICA: Se não temos tempo decorrido, há um problema
            if (!estadoPartida.tempoDecorrido || estadoPartida.tempoDecorrido === 0) {
                console.error('🚨 PROBLEMA CRÍTICO: Tempo decorrido é zero no carregamento!');
                console.log('🔍 Dados completos do jogo:', jogo);
            }
        }
        
        // Buscar gols da partida
        const resultadoGols = await Database.buscarGolsPorJogo(estadoPartida.jogoId);
        estadoPartida.golsPartida = {};
        
        if (resultadoGols.success && resultadoGols.data) {
            resultadoGols.data.forEach(gol => {
                estadoPartida.golsPartida[gol.jogador_id] = (estadoPartida.golsPartida[gol.jogador_id] || 0) + 1;
            });
            console.log('⚽ Gols carregados:', estadoPartida.golsPartida);
        }
        
        // Carregar substituições da partida
        if (jogo.substituicoes) {
            try {
                estadoPartida.substituicoes = JSON.parse(jogo.substituicoes);
                estadoPartida.contadorSubstituicoes = estadoPartida.substituicoes.length;
                console.log('🔄 Substituições carregadas:', estadoPartida.substituicoes);
            } catch (error) {
                console.warn('⚠️ Erro ao carregar substituições:', error);
                estadoPartida.substituicoes = [];
                estadoPartida.contadorSubstituicoes = 0;
            }
        } else {
            estadoPartida.substituicoes = [];
            estadoPartida.contadorSubstituicoes = 0;
        }
        
        // Atualizar interface
        await renderizarPartida();
        
        // Atualizar display de vitórias consecutivas
        await atualizarDisplayVitoriasConsecutivas();
        
        // Aplicar cores padrão
        aplicarCoresVisuais();
        
        // Inicializar cronômetro se a partida estiver em andamento
        if (estadoPartida.iniciado && !estadoPartida.pausado) {
            console.log('🔄 Reiniciando cronômetro da partida em andamento...');
            // Reiniiciar o intervalo do cronômetro
            if (intervaloCronometro) {
                clearInterval(intervaloCronometro);
            }
            intervaloCronometro = setInterval(atualizarDisplayCronometro, 1000);
        }
        
        console.log('✅ Partida carregada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao carregar partida:', error);
        throw error;
    }
}

// Renderizar interface da partida
async function renderizarPartida() {
    console.log('🖼️ Renderizando partida com placar:', {
        placarA: estadoPartida.placarA,
        placarB: estadoPartida.placarB,
        golsPartida: estadoPartida.golsPartida
    });
    
    // Atualizar títulos dos times com as cores
    atualizarTitulosTimes();
    
    // Atualizar cronômetro
    atualizarDisplayCronometro();
    
    // Atualizar placar
    document.getElementById('score-a').textContent = estadoPartida.placarA;
    document.getElementById('score-b').textContent = estadoPartida.placarB;
    
    // Atualizar vitórias consecutivas - buscar valor real do banco
    await atualizarDisplayVitoriasConsecutivas();
    
    // Renderizar times
    await renderizarTime('A', estadoPartida.timeA, 'team-a-players');
    await renderizarTime('B', estadoPartida.timeB, 'team-b-players');
    
    // Atualizar botões
    atualizarBotoes();
}

// Função para atualizar display de vitórias consecutivas
async function atualizarDisplayVitoriasConsecutivas() {
    try {
        const consecutiveElement = document.getElementById('consecutive-wins');
        if (!consecutiveElement) return;
        
        // Buscar vitórias consecutivas reais do banco
        const vitorias = await obterVitoriasConsecutivasTimeA();
        const limite = estadoPartida.limiteVitorias || 3;
        
        consecutiveElement.textContent = `Vitórias consecutivas: ${vitorias}/${limite}`;
        
        // Adicionar indicador visual quando próximo do limite
        if (vitorias >= limite - 1) {
            consecutiveElement.style.color = '#ff6b35';
            consecutiveElement.style.fontWeight = 'bold';
        } else {
            consecutiveElement.style.color = 'rgba(255, 255, 255, 0.8)';
            consecutiveElement.style.fontWeight = 'normal';
        }
        
    } catch (error) {
        console.error('Erro ao atualizar display de vitórias consecutivas:', error);
        // Fallback para valor padrão
        const consecutiveElement = document.getElementById('consecutive-wins');
        if (consecutiveElement) {
            consecutiveElement.textContent = `Vitórias consecutivas: 0/${estadoPartida.limiteVitorias || 3}`;
        }
    }
}

// Renderizar jogadores de um time
async function renderizarTime(time, jogadores, containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    // Buscar todos os jogadores de uma vez
    const todosJogadores = await obterJogadores();
    const mapaJogadores = {};
    todosJogadores.forEach(j => mapaJogadores[j.id] = j);
    
    // Aplicar substituições carregadas do banco
    let jogadoresFinais = [...jogadores];
    if (estadoPartida.substituicoes && estadoPartida.substituicoes.length > 0) {
        console.log(`🔄 Aplicando ${estadoPartida.substituicoes.length} substituições para ${time}`);
        
        for (const substituicao of estadoPartida.substituicoes) {
            const jogadorSaiuId = substituicao.jogador_saiu?.id;
            const jogadorEntrouId = substituicao.jogador_entrou?.id;
            
            // Verificar se a substituição afeta este time
            const indexJogadorSaiu = jogadoresFinais.indexOf(jogadorSaiuId);
            if (indexJogadorSaiu !== -1) {
                console.log(`🔄 Aplicando substituição: ${mapaJogadores[jogadorSaiuId]?.nome} → ${mapaJogadores[jogadorEntrouId]?.nome} no ${time}`);
                // Substituir o jogador na lista
                jogadoresFinais[indexJogadorSaiu] = jogadorEntrouId;
            }
        }
    }
    
    for (const jogadorId of jogadoresFinais) {
        const jogador = mapaJogadores[jogadorId];
        if (!jogador) continue;
        
        const golsNaPartida = estadoPartida.golsPartida[jogadorId] || 0;
        
        // Criar emojis de bolinhas para gols
        const bolinhasGols = golsNaPartida > 0 ? ' ' + '⚽'.repeat(golsNaPartida) : '';
        
        // Verificar se este jogador é um substituto
        const ehSubstituto = estadoPartida.substituicoes?.some(sub => 
            sub.jogador_entrou?.id === jogadorId
        );
        
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        
        // Adicionar classe especial para substitutos
        if (ehSubstituto) {
            playerDiv.classList.add('player-substituto');
        }
        
        playerDiv.innerHTML = `
            <div class="player-name" data-jogador-id="${jogadorId}" data-time="${time}" data-nome="${jogador.nome}">${jogador.nome}${bolinhasGols}${ehSubstituto ? ' 🔄' : ''}</div>
        `;
        
        // Adicionar event listener para seleção de gol
        const playerNameElement = playerDiv.querySelector('.player-name');
        playerNameElement.addEventListener('click', (e) => {
            if (modoSelecaoGol.ativo && modoSelecaoGol.time === time) {
                selecionarJogadorGol(jogadorId, time, jogador.nome);
            }
        });
        
        container.appendChild(playerDiv);
    }
    
    // Adicionar opção "Gol Contra" quando estiver no modo de seleção de gol
    if (modoSelecaoGol.ativo && modoSelecaoGol.time === time) {
        console.log(`🔄 Adicionando opção "Gol Contra" para time ${time}`);
        
        const golContraDiv = document.createElement('div');
        golContraDiv.className = 'player-item gol-contra-option';
        golContraDiv.innerHTML = `
            <div class="player-name gol-contra-name" data-gol-contra="true" data-time="${time}">🔄 Gol Contra</div>
        `;
        
        // Event listener para gol contra
        const golContraElement = golContraDiv.querySelector('.player-name');
        golContraElement.addEventListener('click', (e) => {
            console.log('🔄 Clique em Gol Contra detectado');
            if (modoSelecaoGol.ativo && modoSelecaoGol.time === time) {
                marcarGolContra(time); // Passa o time que vai ser beneficiado
                desativarModoSelecaoGol();
            }
        });
        
        container.appendChild(golContraDiv);
        console.log(`✅ Opção "Gol Contra" adicionada ao time ${time}`);
    }
}

// Configurar event listeners
function configurarEventListeners() {
    // Botão Play/Pause
    document.getElementById('play-pause-btn').addEventListener('click', toggleCronometro);
    
    // Botão Reset
    document.getElementById('reset-btn').addEventListener('click', resetCronometro);
    
    // Botões de troca de cor (qualquer um dos dois)
    document.getElementById('team-a-color').addEventListener('click', trocarCoresColetes);
    document.getElementById('team-b-color').addEventListener('click', trocarCoresColetes);
    
    // Botões de Gol
    document.getElementById('goal-team-a').addEventListener('click', (e) => {
        e.stopPropagation();
        ativarModoSelecaoGol('A');
    });
    document.getElementById('goal-team-b').addEventListener('click', (e) => {
        e.stopPropagation();
        ativarModoSelecaoGol('B');
    });
    
    // Botão VAR
    document.getElementById('var-btn').addEventListener('click', mostrarVAR);
    
    // Botão Finalizar
    document.getElementById('finish-btn').addEventListener('click', finalizarPartida);
    
    // Botão Cancelar Partida no rodapé
    document.getElementById('cancel-footer-btn').addEventListener('click', (e) => {
        e.preventDefault();
        mostrarModalCancelarPartida();
    });
    
    // Botões do modal cancelar partida
    document.getElementById('cancelar-confirmacao').addEventListener('click', fecharModalCancelarPartida);
    document.getElementById('confirmar-cancelamento').addEventListener('click', cancelarPartida);
    
    // Fechar modal cancelar clicando fora
    document.getElementById('modal-cancelar-partida').addEventListener('click', (e) => {
        if (e.target.id === 'modal-cancelar-partida') {
            fecharModalCancelarPartida();
        }
    });
    
    // Modal confirmação
    document.getElementById('modal-cancelar').addEventListener('click', () => fecharModal());
    document.getElementById('modal-confirmar').addEventListener('click', confirmarAcao);
    
    // Cancelar modo de seleção de gol ao clicar fora
    document.addEventListener('click', (e) => {
        if (modoSelecaoGol.ativo) {
            // Se clicou em um jogador, o event listener do jogador vai tratar
            if (e.target.closest('.player-name') || 
                e.target.closest('.goal-btn') || 
                e.target.closest('.team-section') ||
                e.target.id.includes('goal-team')) {
                console.log('👆 Clique em área válida - não cancelar modo');
                return;
            }
            
            console.log('❌ Clique fora - cancelando modo seleção de gol');
            // Clicou fora - cancelar modo
            desativarModoSelecaoGol();
        }
    });
    
    // Fechar modals clicando fora
    document.getElementById('modal-confirmacao').addEventListener('click', (e) => {
        if (e.target.id === 'modal-confirmacao') {
            fecharModal();
        }
    });
    
    // Botões do modal fim de tempo
    document.getElementById('btn-finalizar-partida').addEventListener('click', () => {
        // Verificar se há empate e se um time foi selecionado
        if (estadoPartida.placarA === estadoPartida.placarB) {
            const timesSelecionados = document.querySelectorAll('.btn-time.selected');
            if (timesSelecionados.length === 0) {
                alert('⚠️ Selecione qual time terá prioridade na fila!');
                return;
            }
        }
        
        if (confirm('🏁 Confirma a finalização da partida?')) {
            fecharModalFimTempo();
            finalizarPartida();
        }
    });
    
    document.getElementById('btn-realizar-ajuste').addEventListener('click', () => {
        fecharModalFimTempo();
        // Cronômetro já está parado, usuário pode fazer ajustes
        alert('⚽ Cronômetro finalizado. Você pode marcar gols de último segundo se necessário.');
    });
    
    // Botões de seleção de prioridade
    document.getElementById('btn-prioridade-preto').addEventListener('click', function() {
        selecionarTimePrioridade('preto');
    });
    
    document.getElementById('btn-prioridade-vermelho').addEventListener('click', function() {
        selecionarTimePrioridade('vermelho');
    });
    
    // Event listeners para modal de empate
    document.getElementById('btn-empate-preto').addEventListener('click', function() {
        selecionarTimePrioridade('preto');
    });
    
    document.getElementById('btn-empate-vermelho').addEventListener('click', function() {
        selecionarTimePrioridade('vermelho');
    });
    
    document.getElementById('btn-confirmar-empate-final').addEventListener('click', function() {
        const timesSelecionados = document.querySelectorAll('#modal-confirmar-empate .btn-time.selected');
        if (timesSelecionados.length === 0) {
            alert('⚠️ Selecione qual time terá prioridade na fila!');
            return;
        }
        
        if (confirm('🏁 Confirma a finalização da partida em empate?')) {
            fecharModaisConfirmacao();
            processarFinalizacao();
        }
    });
    
    document.getElementById('btn-cancelar-empate').addEventListener('click', function() {
        fecharModaisConfirmacao();
    });
    
    // Event listeners para modal de vitória
    document.getElementById('btn-confirmar-vitoria-final').addEventListener('click', function() {
        if (confirm('🏁 Confirma a finalização da partida?')) {
            fecharModaisConfirmacao();
            processarFinalizacao();
        }
    });
    
    document.getElementById('btn-cancelar-vitoria').addEventListener('click', function() {
        fecharModaisConfirmacao();
    });
    
    // Inicializar visibilidade do botão de substituição
    atualizarVisibilidadeBotaoSubstituicao();
}

// Perguntar se deseja iniciar cronômetro
// Reset cronômetro
async function resetCronometro() {
    if (confirm('🔄 Tem certeza que deseja resetar o cronômetro?')) {
        // Parar intervalo do cronômetro
        if (intervaloCronometro) {
            clearInterval(intervaloCronometro);
            intervaloCronometro = null;
        }
        
        estadoPartida.iniciado = false;
        estadoPartida.pausado = false;
        estadoPartida.tempoRestante = estadoPartida.duracaoTotal * 60;
        estadoPartida.dataInicio = null;
        estadoPartida.tempoDecorrido = 0;
        
        // Atualizar display
        atualizarDisplayCronometro();
        atualizarStatusCronometro('Cronômetro resetado');
        atualizarBotaoCronometro();
        
        // Atualizar visibilidade do botão de substituição
        atualizarVisibilidadeBotaoSubstituicao();
        
        // Salvar no banco
        await atualizarJogoNoBanco(estadoPartida.jogoId, {
            tempo_decorrido: 0
        });
    }
}

// Toggle cronômetro (Play/Pause)
async function toggleCronometro() {
    try {
        if (!estadoPartida.iniciado) {
            // Iniciar cronômetro
            estadoPartida.dataInicio = new Date();
            estadoPartida.iniciado = true;
            estadoPartida.pausado = false;
            
            // Iniciar intervalo do cronômetro
            if (intervaloCronometro) clearInterval(intervaloCronometro);
            intervaloCronometro = setInterval(atualizarDisplayCronometro, 1000);
            
            // Atualizar visibilidade do botão de substituição
            atualizarVisibilidadeBotaoSubstituicao();
            
            // Salvar no banco
            await atualizarJogoNoBanco(estadoPartida.jogoId, {
                data_inicio: estadoPartida.dataInicio,
                status: 'em_andamento'
            });
            
        } else if (estadoPartida.pausado) {
            // Retomar cronômetro
            console.log('🚀 DEBUG: Estado antes da retomada:', {
                pausado: estadoPartida.pausado,
                tempoDecorridoSalvo: estadoPartida.tempoDecorrido,
                tempoRestanteAtual: estadoPartida.tempoRestante,
                duracaoTotal: estadoPartida.duracaoTotal * 60,
                dataInicioAtual: estadoPartida.dataInicio
            });
            
            // VERIFICAR se realmente temos um tempo decorrido salvo
            if (!estadoPartida.tempoDecorrido || estadoPartida.tempoDecorrido === 0) {
                console.error('❌ PROBLEMA: Não há tempo decorrido salvo para retomar!');
                console.log('🔍 Vamos buscar do banco novamente...');
                
                // Buscar dados atuais do banco
                const jogoAtual = await obterJogo(estadoPartida.jogoId);
                console.log('📊 Dados do banco na retomada:', {
                    status: jogoAtual?.status,
                    tempo_decorrido: jogoAtual?.tempo_decorrido,
                    data_inicio: jogoAtual?.data_inicio
                });
                
                if (jogoAtual?.tempo_decorrido) {
                    estadoPartida.tempoDecorrido = jogoAtual.tempo_decorrido;
                    console.log('✅ Tempo decorrido recuperado do banco:', estadoPartida.tempoDecorrido);
                }
            }
            
            // CORREÇÃO: Usar o tempo decorrido SALVO ao invés de calcular pelo tempo restante
            const tempoDecorridoReal = estadoPartida.tempoDecorrido;
            
            console.log('🔧 RETOMADA: Calculando nova dataInicio:', {
                tempoDecorridoReal: tempoDecorridoReal,
                agora: new Date(),
                milissegundosParaSubtrair: tempoDecorridoReal * 1000,
                novaDataInicio: new Date(Date.now() - (tempoDecorridoReal * 1000))
            });
            
            estadoPartida.dataInicio = new Date(Date.now() - (tempoDecorridoReal * 1000));
            estadoPartida.pausado = false;
            
            // Atualizar visibilidade do botão de substituição
            atualizarVisibilidadeBotaoSubstituicao();
            
            // Reiniciar intervalo do cronômetro
            if (intervaloCronometro) clearInterval(intervaloCronometro);
            
            // IMPORTANTE: Salvar primeiro no banco ANTES de iniciar o intervalo
            await atualizarJogoNoBanco(estadoPartida.jogoId, { 
                status: 'em_andamento',
                data_inicio: estadoPartida.dataInicio
                // NÃO incluir tempo_decorrido aqui para não sobrescrever
            });
            
            console.log('⏰ Dados salvos, iniciando intervalo do cronômetro');
            
            // Esconder aviso de navegação bloqueada
            esconderAvisoNavegacaoBloqueada();
            
            // Marcar que acabou de retomar para evitar salvamentos imediatos
            estadoPartida.acabouDeRetomar = true;
            
            intervaloCronometro = setInterval(atualizarDisplayCronometro, 1000);
            
            // Limpar flag após 5 segundos
            setTimeout(() => {
                estadoPartida.acabouDeRetomar = false;
                console.log('🔓 Flag de retomada limpa, salvamento periódico liberado');
            }, 5000);
            
        } else {
            // Pausar cronômetro
            estadoPartida.pausado = true;
            const tempoCalculado = calcularTempoDecorrido();
            estadoPartida.tempoDecorrido = tempoCalculado;
            
            // Atualizar visibilidade do botão de substituição
            atualizarVisibilidadeBotaoSubstituicao();
            
            // Mostrar aviso de navegação bloqueada
            mostrarAvisoNavegacaoBloqueada();
            
            // Calcular também o tempo restante para debugar
            const duracaoTotal = estadoPartida.duracaoTotal * 60;
            const tempoRestanteCalculado = duracaoTotal - tempoCalculado;
            
            // Atualizar também o tempo restante no estado
            estadoPartida.tempoRestante = tempoRestanteCalculado;
            
            console.log('⏸️ Pausando cronômetro:', {
                tempoDecorrido: tempoCalculado,
                tempoRestante: tempoRestanteCalculado,
                duracaoTotal: duracaoTotal,
                dataInicio: estadoPartida.dataInicio,
                agora: new Date()
            });
            
            // Parar intervalo do cronômetro
            if (intervaloCronometro) {
                clearInterval(intervaloCronometro);
                intervaloCronometro = null;
            }
            
            const dadosParaSalvar = { 
                status: 'pausado',
                tempo_decorrido: estadoPartida.tempoDecorrido
            };
            
            console.log('💾 Tentando salvar pause:', dadosParaSalvar);
            
            const resultadoPause = await atualizarJogoNoBanco(estadoPartida.jogoId, dadosParaSalvar);
            
            if (!resultadoPause?.success) {
                console.error('❌ Falha ao salvar pause:', resultadoPause?.error);
            } else {
                console.log('✅ Pause salvo com sucesso!', resultadoPause.data);
                
                // Verificar se foi salvo corretamente - buscar o jogo novamente
                const jogoVerificacao = await obterJogo(estadoPartida.jogoId);
                console.log('🔍 Verificação pós-salvamento:', {
                    tempo_decorrido_salvo: jogoVerificacao?.tempo_decorrido,
                    status_salvo: jogoVerificacao?.status
                });
            }
        }
        
        atualizarBotoes();
        
    } catch (error) {
        console.error('Erro ao toggle cronômetro:', error);
        alert('❌ Erro ao controlar cronômetro.');
    }
}

// Função para formatar tempo em segundos para MM:SS
function formatarTempo(tempoSegundos) {
    const minutos = Math.floor(tempoSegundos / 60);
    const segundos = tempoSegundos % 60;
    return `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
}

// Calcular tempo decorrido
function calcularTempoDecorrido() {
    if (!estadoPartida.iniciado || !estadoPartida.dataInicio) {
        console.log('⚠️ calcularTempoDecorrido: jogo não iniciado ou sem dataInicio');
        return 0;
    }
    
    const agora = new Date();
    const diferenca = Math.floor((agora - estadoPartida.dataInicio) / 1000);
    const resultado = Math.max(0, diferenca);
    
    console.log('🧮 calcularTempoDecorrido:', {
        agora: agora,
        dataInicio: estadoPartida.dataInicio,
        diferenca: diferenca,
        resultado: resultado
    });
    
    return resultado;
}

// Atualizar display do cronômetro (regressivo)
async function atualizarDisplayCronometro() {
    let tempoRestanteAtual;
    
    console.log('🔍 atualizarDisplayCronometro:', {
        iniciado: estadoPartida.iniciado,
        pausado: estadoPartida.pausado,
        cronometroPausadoParaSubstituicao: estadoPartida.cronometroPausadoParaSubstituicao
    });
    
    if (estadoPartida.iniciado && !estadoPartida.pausado && estadoPartida.dataInicio) {
        console.log('⏱️ Cronômetro RODANDO - calculando tempo real');
        // Calcular tempo baseado no timestamp real
        const agora = new Date();
        const tempoDecorridoReal = Math.floor((agora - estadoPartida.dataInicio) / 1000);
        const duracaoTotalSegundos = estadoPartida.duracaoTotal * 60;
        tempoRestanteAtual = Math.max(0, duracaoTotalSegundos - tempoDecorridoReal);
        
        console.log('⏱️ Display cronômetro:', {
            tempoDecorridoReal: tempoDecorridoReal,
            tempoRestanteAtual: tempoRestanteAtual,
            dataInicio: estadoPartida.dataInicio,
            agora: agora
        });
        
        // Salvar no banco periodicamente (a cada 10 segundos)
        // MAS APENAS se não acabou de retomar (evita sobrescrever tempo correto)
        if (tempoDecorridoReal % 10 === 0 && tempoDecorridoReal > 3 && !estadoPartida.acabouDeRetomar) {
            console.log('💾 Salvando tempo periodicamente:', tempoDecorridoReal);
            try {
                const resultado = await atualizarJogoNoBanco(estadoPartida.jogoId, { tempo_decorrido: tempoDecorridoReal });
                if (!resultado.success && resultado.networkError) {
                    console.warn('⚠️ Erro de rede - cronômetro continua funcionando normalmente');
                }
            } catch (error) {
                console.warn('⚠️ Erro ao salvar tempo - continuando:', error.message);
            }
        } else if (estadoPartida.acabouDeRetomar && tempoDecorridoReal % 10 === 0) {
            console.log('🚫 Salvamento bloqueado - acabou de retomar:', tempoDecorridoReal);
        }
    } else {
        console.log('⏸️ Cronômetro PAUSADO/NÃO INICIADO - usando tempo armazenado');
        // Usar valor armazenado quando pausado ou não iniciado
        tempoRestanteAtual = estadoPartida.tempoRestante;
    }
    
    const minutos = Math.floor(tempoRestanteAtual / 60);
    const segundos = tempoRestanteAtual % 60;
    
    const display = `${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
    
    document.getElementById('timer-display').textContent = display;
    
    // Verificar se tempo acabou
    if (tempoRestanteAtual <= 0) {
        document.getElementById('timer-display').style.color = '#dc3545';
        if (estadoPartida.iniciado) {
            // Parar cronômetro
            estadoPartida.iniciado = false;
            if (intervaloCronometro) {
                clearInterval(intervaloCronometro);
                intervaloCronometro = null;
            }
            
            mostrarModalFimTempo();
            // finalizarPartida() será chamado pelo botão do modal
        }
    } else if (tempoRestanteAtual <= 60) {
        // Último minuto - cor vermelha
        document.getElementById('timer-display').style.color = '#dc3545';
    } else {
        document.getElementById('timer-display').style.color = 'white';
    }
    
    // Atualizar estado para pausar/reset
    if (estadoPartida.iniciado && !estadoPartida.pausado && estadoPartida.dataInicio) {
        estadoPartida.tempoRestante = tempoRestanteAtual;
    }
}

// Atualizar status do cronômetro
function atualizarStatusCronometro(status) {
    const statusElement = document.getElementById('timer-status');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

// Atualizar botões conforme estado
function atualizarBotoes() {
    atualizarBotaoCronometro();
    atualizarBotaoCancelar();
}

// Mostrar modal personalizado de fim de tempo
async function mostrarModalFimTempo() {
    // Verificar se modal já está sendo exibido
    const modal = document.getElementById('modal-fim-tempo');
    if (modal.style.display === 'flex') {
        console.log('⚠️ Modal de fim de tempo já está sendo exibido, ignorando duplicação');
        return;
    }
    
    // Obter nomes das cores dos coletes
    const nomeCorTimeA = obterNomeCor(estadoPartida.coresColetes.timeA);
    const nomeCorTimeB = obterNomeCor(estadoPartida.coresColetes.timeB);
    
    // Atualizar elementos do modal
    document.getElementById('cor-time-a').textContent = nomeCorTimeA;
    document.getElementById('cor-time-b').textContent = nomeCorTimeB;
    document.getElementById('placar-final-a').textContent = estadoPartida.placarA;
    document.getElementById('placar-final-b').textContent = estadoPartida.placarB;
    
    // Atualizar botões de prioridade com cores corretas
    document.getElementById('nome-time-preto').textContent = estadoPartida.coresColetes.timeA === 'black' ? nomeCorTimeA : nomeCorTimeB;
    document.getElementById('nome-time-vermelho').textContent = estadoPartida.coresColetes.timeA === 'red' ? nomeCorTimeA : nomeCorTimeB;
    
    // Função auxiliar para extrair nome do jogador dos elementos já renderizados
    function obterNomeJogadorDaTela(jogadorId) {
        if (!jogadorId) return null;
        
        // Buscar nos elementos já renderizados na tela
        const elementoJogador = document.querySelector(`[data-jogador-id="${jogadorId}"]`);
        
        if (elementoJogador) {
            const nome = elementoJogador.getAttribute('data-nome');
            return nome;
        }
        
        // Fallback
        return `Jogador ${jogadorId.substring(0, 8)}`;
    }
        
    let primeiroJogadorPreto = 'Sem jogador';
    let primeiroJogadorVermelho = 'Sem jogador';
    
    console.log('🔍 DEBUG TEMPO - Estado dos times:', {
        timeA: estadoPartida.timeA,
        timeB: estadoPartida.timeB,
        coresColetes: estadoPartida.coresColetes
    });
    
    // Verificar qual time tem qual cor e buscar primeiro jogador
    if (estadoPartida.coresColetes.timeA === 'black') {
        if (estadoPartida.timeA && estadoPartida.timeA.length > 0) {
            const jogador = estadoPartida.timeA[0];
            const nomeJogador = obterNomeJogadorHTML(jogador);
            primeiroJogadorPreto = nomeJogador || 'Jogador Time Preto';
            console.log('👤 Primeiro jogador PRETO (Time A):', jogador, '→', nomeJogador);
        }
    } else if (estadoPartida.timeB && estadoPartida.timeB.length > 0) {
        const jogador = estadoPartida.timeB[0];
        const nomeJogador = obterNomeJogadorHTML(jogador);
        primeiroJogadorPreto = nomeJogador || 'Jogador Time Preto';
        console.log('👤 Primeiro jogador PRETO (Time B):', jogador, '→', nomeJogador);
    }
    
    if (estadoPartida.coresColetes.timeB === 'red') {
        if (estadoPartida.timeB && estadoPartida.timeB.length > 0) {
            const jogador = estadoPartida.timeB[0];
            const nomeJogador = obterNomeJogadorHTML(jogador);
            primeiroJogadorVermelho = nomeJogador || 'Jogador Time Vermelho';
            console.log('👤 Primeiro jogador VERMELHO (Time B):', jogador, '→', nomeJogador);
        }
    } else if (estadoPartida.timeA && estadoPartida.timeA.length > 0) {
        const jogador = estadoPartida.timeA[0];
        const nomeJogador = obterNomeJogadorHTML(jogador);
        primeiroJogadorVermelho = nomeJogador || 'Jogador Time Vermelho';
        console.log('👤 Primeiro jogador VERMELHO (Time A):', jogador, '→', nomeJogador);
    }
    
    // Definir texto nos elementos do modal de fim de tempo
    const elementoTempoPreto = document.getElementById('primeiro-jogador-tempo-preto');
    const elementoTempoVermelho = document.getElementById('primeiro-jogador-tempo-vermelho');
    
    if (elementoTempoPreto) elementoTempoPreto.textContent = primeiroJogadorPreto;
    if (elementoTempoVermelho) elementoTempoVermelho.textContent = primeiroJogadorVermelho;
    
    // Determinar resultado da partida
    let resultadoTexto = '';
    const selecaoPrioridade = document.getElementById('selecao-prioridade');
    
    if (estadoPartida.placarA > estadoPartida.placarB) {
        resultadoTexto = `🎉 ${nomeCorTimeA} VENCEU!`;
        selecaoPrioridade.style.display = 'none';
    } else if (estadoPartida.placarB > estadoPartida.placarA) {
        resultadoTexto = `🎉 ${nomeCorTimeB} VENCEU!`;
        selecaoPrioridade.style.display = 'none';
    } else {
        resultadoTexto = `🤝 EMPATE!<br>Par ou Ímpar, decide a prioridade de retorno`;
        selecaoPrioridade.style.display = 'block';
    }
    document.getElementById('resultado-texto').innerHTML = resultadoTexto;
    
    // Mostrar modal (reutilizando a variável modal já declarada)
    modal.style.display = 'flex';
    
    // Prevenir scroll do body
    document.body.style.overflow = 'hidden';
}

// Fechar modal de fim de tempo
function fecharModalFimTempo() {
    const modal = document.getElementById('modal-fim-tempo');
    modal.style.display = 'none';
    document.body.style.overflow = '';
    
    // Limpar seleções
    document.querySelectorAll('.btn-time').forEach(btn => {
        btn.classList.remove('selected');
    });
}

// Função para selecionar time com prioridade no empate
function selecionarTimePrioridade(corSelecionada) {
    // Remover seleção anterior de ambos os modais
    document.querySelectorAll('.btn-time').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Adicionar seleção aos botões corretos em ambos os modais
    if (corSelecionada === 'preto') {
        const btnFimTempo = document.getElementById('btn-prioridade-preto');
        const btnEmpate = document.getElementById('btn-empate-preto');
        if (btnFimTempo) btnFimTempo.classList.add('selected');
        if (btnEmpate) btnEmpate.classList.add('selected');
    } else {
        const btnFimTempo = document.getElementById('btn-prioridade-vermelho');
        const btnEmpate = document.getElementById('btn-empate-vermelho');
        if (btnFimTempo) btnFimTempo.classList.add('selected');
        if (btnEmpate) btnEmpate.classList.add('selected');
    }
    
    // Converter cor para time A ou B baseado nas cores dos coletes
    let timePrioridade;
    if (corSelecionada === 'preto') {
        timePrioridade = estadoPartida.coresColetes.timeA === 'black' ? 'A' : 'B';
    } else {
        timePrioridade = estadoPartida.coresColetes.timeA === 'red' ? 'A' : 'B';
    }
    
    // Salvar a escolha para usar na finalização (usar a variável que o sistema espera)
    estadoPartida.timePrioridadeEmpate = timePrioridade;
    console.log(`🎯 Selecionado time ${timePrioridade} para prioridade (cor: ${corSelecionada})`);
}

// Modal para confirmar empate manual
async function mostrarModalConfirmarEmpate() {
    // Verificar se modal já está sendo exibido
    const modal = document.getElementById('modal-confirmar-empate');
    if (modal.style.display === 'flex') {
        console.log('⚠️ Modal de empate já está sendo exibido, ignorando duplicação');
        return;
    }
    
    const nomeCorTimeA = obterNomeCor(estadoPartida.coresColetes.timeA);
    const nomeCorTimeB = obterNomeCor(estadoPartida.coresColetes.timeB);
    
    // Atualizar elementos do modal
    document.getElementById('cor-time-empate-a').textContent = nomeCorTimeA;
    document.getElementById('cor-time-empate-b').textContent = nomeCorTimeB;
    document.getElementById('placar-empate-a').textContent = estadoPartida.placarA;
    document.getElementById('placar-empate-b').textContent = estadoPartida.placarB;
    
    // Atualizar botões com cores corretas
    document.getElementById('nome-empate-preto').textContent = estadoPartida.coresColetes.timeA === 'black' ? nomeCorTimeA : nomeCorTimeB;
    document.getElementById('nome-empate-vermelho').textContent = estadoPartida.coresColetes.timeB === 'red' ? nomeCorTimeB : nomeCorTimeA;
    

    
    // Adicionar primeiros jogadores de cada time
    let primeiroJogadorPreto = 'Sem jogador';
    let primeiroJogadorVermelho = 'Sem jogador';
    
    console.log('🔍 DEBUG EMPATE - Estado dos times:', {
        timeA: estadoPartida.timeA,
        timeB: estadoPartida.timeB,
        coresColetes: estadoPartida.coresColetes
    });
    
    // Verificar qual time tem qual cor e buscar primeiro jogador
    if (estadoPartida.coresColetes.timeA === 'black') {
        if (estadoPartida.timeA && estadoPartida.timeA.length > 0) {
            const jogador = estadoPartida.timeA[0];
            const nomeJogador = obterNomeJogadorHTML(jogador);
            primeiroJogadorPreto = nomeJogador || 'Jogador Time Preto';
            console.log('👤 Primeiro jogador PRETO (Time A):', jogador, '→', nomeJogador);
        }
    } else if (estadoPartida.timeB && estadoPartida.timeB.length > 0) {
        const jogador = estadoPartida.timeB[0];
        const nomeJogador = obterNomeJogadorHTML(jogador);
        primeiroJogadorPreto = nomeJogador || 'Jogador Time Preto';
        console.log('👤 Primeiro jogador PRETO (Time B):', jogador, '→', nomeJogador);
    }
    
    if (estadoPartida.coresColetes.timeB === 'red') {
        if (estadoPartida.timeB && estadoPartida.timeB.length > 0) {
            const jogador = estadoPartida.timeB[0];
            const nomeJogador = obterNomeJogadorHTML(jogador);
            primeiroJogadorVermelho = nomeJogador || 'Jogador Time Vermelho';
            console.log('👤 Primeiro jogador VERMELHO (Time B):', jogador, '→', nomeJogador);
        }
    } else if (estadoPartida.timeA && estadoPartida.timeA.length > 0) {
        const jogador = estadoPartida.timeA[0];
        const nomeJogador = obterNomeJogadorHTML(jogador);
        primeiroJogadorVermelho = nomeJogador || 'Jogador Time Vermelho';
        console.log('👤 Primeiro jogador VERMELHO (Time A):', jogador, '→', nomeJogador);
    }
    
    // Definir texto nos elementos
    const elementoPreto = document.getElementById('primeiro-jogador-preto');
    const elementoVermelho = document.getElementById('primeiro-jogador-vermelho');
    
    console.log('🔍 DEBUG EMPATE - Elementos encontrados:', {
        elementoPreto: !!elementoPreto,
        elementoVermelho: !!elementoVermelho,
        primeiroJogadorPreto,
        primeiroJogadorVermelho
    });
    
    if (elementoPreto) {
        elementoPreto.textContent = primeiroJogadorPreto;
        console.log('✅ Nome PRETO definido no elemento:', primeiroJogadorPreto);
    }
    if (elementoVermelho) {
        elementoVermelho.textContent = primeiroJogadorVermelho;
        console.log('✅ Nome VERMELHO definido no elemento:', primeiroJogadorVermelho);
    }
    
    console.log('Jogadores:', {primeiroJogadorPreto, primeiroJogadorVermelho});
    
    // Limpar seleções anteriores
    document.querySelectorAll('#modal-confirmar-empate .btn-time').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Mostrar modal
    document.getElementById('modal-confirmar-empate').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Garantir que os nomes sejam definidos após o modal estar visível
    setTimeout(() => {
        const elementoPreto = document.getElementById('primeiro-jogador-preto');
        const elementoVermelho = document.getElementById('primeiro-jogador-vermelho');
        
        console.log('🔄 FORÇANDO atualização dos nomes após modal visível');
        
        if (elementoPreto) {
            elementoPreto.textContent = primeiroJogadorPreto;
            console.log('🔄 PRETO forçado:', primeiroJogadorPreto);
        }
        if (elementoVermelho) {
            elementoVermelho.textContent = primeiroJogadorVermelho;
            console.log('🔄 VERMELHO forçado:', primeiroJogadorVermelho);
        }
    }, 100);
}

// Modal para confirmar vitória
async function mostrarModalConfirmarVitoria(timeVencedor, nomeTimeVencedor) {
    // Verificar se modal já está sendo exibido
    const modal = document.getElementById('modal-confirmar-vitoria');
    if (modal.style.display === 'flex') {
        console.log('⚠️ Modal de vitória já está sendo exibido, ignorando duplicação');
        return;
    }
    
    const nomeCorTimeA = obterNomeCor(estadoPartida.coresColetes.timeA);
    const nomeCorTimeB = obterNomeCor(estadoPartida.coresColetes.timeB);
    
    // Atualizar elementos do modal
    document.getElementById('cor-time-vitoria-a').textContent = nomeCorTimeA;
    document.getElementById('cor-time-vitoria-b').textContent = nomeCorTimeB;
    document.getElementById('placar-vitoria-a').textContent = estadoPartida.placarA;
    document.getElementById('placar-vitoria-b').textContent = estadoPartida.placarB;
    
    // Buscar vitórias consecutivas do time que realmente venceu
    let vitoriasAtuais = 0;
    try {
        if (timeVencedor === 'A') {
            // Time A venceu - buscar vitórias do Time A
            vitoriasAtuais = await obterVitoriasConsecutivasTimeA();
            console.log(`🏆 Time A venceu - vitórias atuais: ${vitoriasAtuais}`);
        } else {
            // Time B venceu - Time B sempre inicia nova sequência (nova lógica)
            // Na rotação, Time B vira o novo Time A com 1 vitória
            vitoriasAtuais = 0; // Time B não tinha vitórias consecutivas antes
            console.log(`🏆 Time B venceu - iniciará nova sequência`);
        }
    } catch (error) {
        console.warn('Erro ao buscar vitórias consecutivas:', error);
        vitoriasAtuais = 0;
    }
    
    // Calcular próxima vitória (atual + 1)
    const proximaVitoria = vitoriasAtuais + 1;
    
    // Atualizar texto da vitória com informação correta
    document.getElementById('texto-resultado-vitoria').innerHTML = `🎉 ${nomeTimeVencedor} VENCEU!<br>⚡ ${proximaVitoria}ª vitória consecutiva`;
    
    // Verificar se é terceira vitória consecutiva
    const avisoTerceiraVitoria = document.getElementById('aviso-terceira-vitoria');
    
    if (timeVencedor === 'A' && vitoriasAtuais >= 2) { 
        // Só mostra aviso se Time A venceu E já tinha 2+ vitórias (será a 3ª)
        avisoTerceiraVitoria.style.display = 'block';
        document.getElementById('time-terceira-vitoria').textContent = nomeTimeVencedor;
        document.getElementById('titulo-vitoria').textContent = 'Terceira Vitória!';
        console.log(`🔥 Time A atingiu 3ª vitória consecutiva!`);
    } else {
        avisoTerceiraVitoria.style.display = 'none';
        document.getElementById('titulo-vitoria').textContent = 'Vitória!';
        console.log(`✅ Vitória normal - não é terceira consecutiva`);
    }
    
    // Salvar informação do time vencedor
    estadoPartida.timeVencedorModal = timeVencedor;
    
    // Mostrar modal
    document.getElementById('modal-confirmar-vitoria').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Fechar modais de confirmação
function fecharModaisConfirmacao() {
    document.getElementById('modal-confirmar-empate').style.display = 'none';
    document.getElementById('modal-confirmar-vitoria').style.display = 'none';
    document.body.style.overflow = '';
    
    // Resetar flag de finalização para permitir nova tentativa se necessário
    estadoPartida.finalizando = false;
    
    // Limpar seleções
    document.querySelectorAll('.btn-time').forEach(btn => {
        btn.classList.remove('selected');
    });
}

// Atualizar títulos dos times com base nas cores dos coletes
function atualizarTitulosTimes() {
    const nomeCorTimeA = obterNomeCor(estadoPartida.coresColetes.timeA);
    const nomeCorTimeB = obterNomeCor(estadoPartida.coresColetes.timeB);
    
    document.getElementById('titulo-time-a').textContent = nomeCorTimeA;
    document.getElementById('titulo-time-b').textContent = nomeCorTimeB;
}

// Atualizar visibilidade do botão cancelar
function atualizarBotaoCancelar() {
    const cancelFooterBtn = document.getElementById('cancel-footer-btn');
    if (!cancelFooterBtn) return;
    
    // Mostrar botão cancelar sempre que há uma partida ativa
    cancelFooterBtn.style.display = 'flex';
}

// Atualizar botão do cronômetro
function atualizarBotaoCronometro() {
    const playPauseBtn = document.getElementById('play-pause-btn');
    const emoji = playPauseBtn.querySelector('.emoji');
    
    if (!estadoPartida.iniciado) {
        emoji.textContent = '▶️';
        atualizarStatusCronometro('Pronto para iniciar');
    } else if (estadoPartida.pausado) {
        emoji.textContent = '▶️';
        atualizarStatusCronometro('Pausado');
    } else {
        emoji.textContent = '⏸️';
        atualizarStatusCronometro('Em andamento');
    }
    
    // Atualizar visibilidade do botão de substituição
    atualizarVisibilidadeBotaoSubstituicao();
}

// Marcar gol
// Sistema de Cores dos Coletes - Versão Simplificada
function trocarCoresColetes() {
    // Trocar as cores dos times
    const corTemporariaA = estadoPartida.coresColetes.timeA;
    estadoPartida.coresColetes.timeA = estadoPartida.coresColetes.timeB;
    estadoPartida.coresColetes.timeB = corTemporariaA;
    
    // Aplicar mudanças visuais
    aplicarCoresVisuais();
    
    // Feedback suave de troca
    const buttons = document.querySelectorAll('.team-color-btn');
    buttons.forEach(btn => {
        btn.style.transform = 'scale(0.9)';
        setTimeout(() => {
            btn.style.transform = '';
        }, 150);
    });
}

function aplicarCoresVisuais() {
    // Atualizar círculos de cor
    const circleA = document.getElementById('color-circle-a');
    const circleB = document.getElementById('color-circle-b');
    
    // Limpar classes anteriores
    circleA.classList.remove('black', 'red');
    circleB.classList.remove('black', 'red');
    
    // Aplicar novas cores aos círculos
    circleA.classList.add(estadoPartida.coresColetes.timeA);
    circleB.classList.add(estadoPartida.coresColetes.timeB);
    
    // Aplicar cores aos quadros dos times
    const teamSectionA = document.querySelector('.team-section:first-child');
    const teamSectionB = document.querySelector('.team-section:last-child');
    
    // Limpar classes anteriores
    teamSectionA.classList.remove('black', 'red');
    teamSectionB.classList.remove('black', 'red');
    
    // Aplicar novas cores
    teamSectionA.classList.add(estadoPartida.coresColetes.timeA);
    teamSectionB.classList.add(estadoPartida.coresColetes.timeB);
    
    // Atualizar títulos dos times com nomes das cores
    const titleA = teamSectionA.querySelector('h3');
    const titleB = teamSectionB.querySelector('h3');
    
    const nomeCorA = estadoPartida.coresColetes.timeA === 'black' ? 'PRETO' : 'VERMELHO';
    const nomeCorB = estadoPartida.coresColetes.timeB === 'black' ? 'PRETO' : 'VERMELHO';
    
    titleA.textContent = nomeCorA;
    titleB.textContent = nomeCorB;
    
    // Aplicar cores aos botões de gol
    const goalBtnA = document.getElementById('goal-team-a');
    const goalBtnB = document.getElementById('goal-team-b');
    
    // Limpar classes anteriores
    goalBtnA.classList.remove('black-team', 'red-team');
    goalBtnB.classList.remove('black-team', 'red-team');
    
    // Aplicar novas cores
    goalBtnA.classList.add(`${estadoPartida.coresColetes.timeA}-team`);
    goalBtnB.classList.add(`${estadoPartida.coresColetes.timeB}-team`);
}

// Mostrar modal de seleção de jogador para gol
// Ativar modo de seleção de gol
function ativarModoSelecaoGol(time) {
    console.log('🔥 Tentativa de ativar modo gol:', {
        time: time,
        modoAtivo: modoSelecaoGol.ativo,
        cronometroIniciado: estadoPartida.iniciado,
        cronometroPausado: estadoPartida.pausado
    });
    
    // Verificar se cronômetro está rodando
    if (!estadoPartida.iniciado || estadoPartida.pausado) {
        alert('⚠️ Inicie o cronômetro antes de marcar gols.');
        return;
    }
    
    if (modoSelecaoGol.ativo) {
        // Se já está ativo, desativar
        console.log('🔄 Modo já ativo - desativando');
        desativarModoSelecaoGol();
        return;
    }
    
    console.log('✅ Ativando modo seleção de gol para time', time);
    modoSelecaoGol.ativo = true;
    modoSelecaoGol.time = time;
    
    // Re-renderizar times para mostrar opção de gol contra
    renderizarTime('A', estadoPartida.timeA, 'team-a-players');
    renderizarTime('B', estadoPartida.timeB, 'team-b-players');
    
    // Adicionar classe visual aos jogadores
    aplicarEfeitoSelecaoGol(time);
    
    // Feedback visual no botão
    const botaoGol = document.getElementById(`goal-team-${time.toLowerCase()}`);
    botaoGol.style.background = '#ff6b35';
    botaoGol.innerHTML = '<span class="text">👆 Clique no jogador</span>';
    
    // Mostrar mensagem de instrução
    atualizarStatusCronometro(`⚽ Clique no jogador do TIME ${time} que fez o gol`);
}

// Desativar modo de seleção de gol
function desativarModoSelecaoGol() {
    modoSelecaoGol.ativo = false;
    modoSelecaoGol.time = null;
    
    // Re-renderizar times para remover opção de gol contra
    renderizarTime('A', estadoPartida.timeA, 'team-a-players');
    renderizarTime('B', estadoPartida.timeB, 'team-b-players');
    
    // Remover efeitos visuais
    removerEfeitoSelecaoGol();
    
    // Restaurar botões
    restaurarBotoesGol();
    
    // Restaurar status
    atualizarStatusCronometro(estadoPartida.iniciado ? 'Em andamento' : 'Pronto para iniciar');
}

// Aplicar efeito visual de seleção
function aplicarEfeitoSelecaoGol(time) {
    const teamSection = time === 'A' ? 
        document.querySelector('.team-section:first-child') :
        document.querySelector('.team-section:last-child');
    
    teamSection.classList.add('modo-selecao-gol');
    
    // Adicionar event listeners temporários nos nomes dos jogadores
    const jogadorElements = teamSection.querySelectorAll('.player-name');
    jogadorElements.forEach(element => {
        element.style.cursor = 'pointer';
        element.style.background = 'rgba(255, 107, 53, 0.2)';
        element.style.borderRadius = '5px';
        element.style.padding = '5px';
        element.style.border = '2px dashed #ff6b35';
        element.setAttribute('data-clicavel-gol', 'true');
    });
}

// Remover efeito visual de seleção
function removerEfeitoSelecaoGol() {
    document.querySelectorAll('.team-section').forEach(section => {
        section.classList.remove('modo-selecao-gol');
    });
    
    document.querySelectorAll('[data-clicavel-gol]').forEach(element => {
        element.style.cursor = '';
        element.style.background = '';
        element.style.borderRadius = '';
        element.style.padding = '';
        element.style.border = '';
        element.removeAttribute('data-clicavel-gol');
    });
}

// Restaurar botões de gol
function restaurarBotoesGol() {
    const botaoA = document.getElementById('goal-team-a');
    const botaoB = document.getElementById('goal-team-b');
    
    botaoA.style.background = '';
    botaoB.style.background = '';
    botaoA.innerHTML = '<span class="text">Gol ⚽</span>';
    botaoB.innerHTML = '<span class="text">Gol ⚽</span>';
}

async function mostrarModalGol_OLD(time) {
    const modal = document.getElementById('modal-jogador-gol');
    const titulo = document.getElementById('modal-gol-titulo');
    const lista = document.getElementById('lista-jogadores-gol');
    
    titulo.textContent = `⚽ Quem fez o gol? - TIME ${time}`;
    
    const jogadores = time === 'A' ? estadoPartida.timeA : estadoPartida.timeB;
    
    lista.innerHTML = '';
    for (const jogadorId of jogadores) {
        // Buscar dados do jogador
        const todosJogadores = await obterJogadores();
        const jogador = todosJogadores.find(j => j.id === jogadorId);
        if (!jogador) continue;
        
        const golsNaPartida = estadoPartida.golsPartida[jogadorId] || 0;
        
        const item = document.createElement('div');
        item.className = 'jogador-gol-item';
        item.innerHTML = `
            <div>
                <div class="jogador-gol-nome">${jogador.nome}</div>
                <div class="jogador-gol-stats">
                    <span>Gols na partida: ${golsNaPartida}</span>
                </div>
            </div>
            <button class="jogador-gol-btn" onclick="selecionarJogadorGol('${jogadorId}', '${time}', '${jogador.nome}')">
                ⚽ Gol!
            </button>
        `;
        
        lista.appendChild(item);
    }
    
    modal.style.display = 'flex';
}

// Fechar modal de gol
// Selecionar jogador para gol
async function selecionarJogadorGol(jogadorId, time, nomeJogador) {
    console.log('⚽ selecionarJogadorGol chamada:', {
        jogadorId: jogadorId,
        time: time,
        nomeJogador: nomeJogador,
        modoSelecaoAtivo: modoSelecaoGol.ativo,
        modoSelecaoTime: modoSelecaoGol.time
    });
    
    // Verificar se o modo de seleção está ativo para este time
    if (!modoSelecaoGol.ativo || modoSelecaoGol.time !== time) {
        console.log('❌ Modo seleção não ativo ou time diferente');
        return;
    }
    
    // Desativar modo de seleção
    desativarModoSelecaoGol();
    
    await marcarGol(jogadorId, time, nomeJogador);
}

async function marcarGol(jogadorId, time, nomeJogador) {
    try {
        if (!estadoPartida.iniciado) {
            alert('⚠️ Inicie o cronômetro antes de marcar gols.');
            return;
        }
        
        // Atualizar placar
        if (time === 'A') {
            estadoPartida.placarA++;
        } else {
            estadoPartida.placarB++;
        }
        
        // Atualizar gols do jogador
        estadoPartida.golsPartida[jogadorId] = (estadoPartida.golsPartida[jogadorId] || 0) + 1;
        
        // Salvar no banco
        console.log('💾 Salvando gol no banco:', {
            placar_a: estadoPartida.placarA,
            placar_b: estadoPartida.placarB,
            jogador: nomeJogador,
            time: time
        });
        
        // Salvar placar atualizado na tabela jogos
        const resultadoPlacar = await atualizarJogoNoBanco(estadoPartida.jogoId, {
            placar_a: estadoPartida.placarA,
            placar_b: estadoPartida.placarB
        });
        
        // Salvar gol individual na tabela gols
        const resultadoGol = await Database.registrarGol({
            jogo_id: estadoPartida.jogoId,
            jogador_id: jogadorId,
            time: time
        });
        
        if (!resultadoPlacar?.success || !resultadoGol?.success) {
            console.error('❌ Falha ao salvar gol:', {
                placar: resultadoPlacar?.error,
                gol: resultadoGol?.error
            });
            alert('❌ Erro ao salvar gol no banco de dados!');
        } else {
            console.log('✅ Gol salvo com sucesso!');
        }
        
        // Atualizar interface
        await renderizarPartida();
        
    } catch (error) {
        console.error('Erro ao marcar gol:', error);
        alert('❌ Erro ao marcar gol.');
    }
}

// Marcar gol contra (sem contabilizar estatística para jogador)
async function marcarGolContra(timeBeneficiado) {
    try {
        if (!estadoPartida.iniciado) {
            alert('⚠️ Inicie o cronômetro antes de marcar gols.');
            return;
        }
        
        // Definir qual time fez o gol contra
        const timeQueFezGolContra = timeBeneficiado === 'A' ? 'B' : 'A';
        const nomeTimeBeneficiado = timeBeneficiado === 'A' ? 'Time A' : 'Time B';
        const nomeTimeQueFez = timeQueFezGolContra === 'A' ? 'Time A' : 'Time B';
        
        if (!confirm(`🔄 Confirmar gol contra?\n\n${nomeTimeQueFez} fez gol contra a favor do ${nomeTimeBeneficiado}.`)) {
            return;
        }
        
        // CORRIGIDO: Atualizar placar do time que recebe o benefício
        if (timeBeneficiado === 'A') {
            estadoPartida.placarA++; // Gol contra a favor do Time A
        } else {
            estadoPartida.placarB++; // Gol contra a favor do Time B
        }
        
        // Salvar no banco
        console.log('💾 Salvando gol contra no banco:', {
            placar_a: estadoPartida.placarA,
            placar_b: estadoPartida.placarB,
            gol_contra: true,
            time_beneficiado: timeBeneficiado,
            time_que_fez_gol_contra: timeQueFezGolContra
        });
        
        // Salvar placar atualizado na tabela jogos
        const resultadoPlacar = await atualizarJogoNoBanco(estadoPartida.jogoId, {
            placar_a: estadoPartida.placarA,
            placar_b: estadoPartida.placarB
        });
        
        // Registrar gol contra na tabela gols (sem jogador específico)
        const resultadoGol = await Database.registrarGolContra({
            jogo_id: estadoPartida.jogoId,
            time_gol_contra: timeQueFezGolContra,
            time_beneficiado: timeBeneficiado
        });
        
        if (!resultadoPlacar?.success) {
            console.error('❌ Falha ao salvar gol contra:', resultadoPlacar?.error);
            alert('❌ Erro ao salvar gol contra no banco de dados!');
        } else {
            console.log('✅ Gol contra salvo com sucesso!');
            alert(`✅ Gol contra marcado!\n${nomeTimeQueFez} fez gol contra a favor do ${nomeTimeBeneficiado}!`);
        }
        
        // Atualizar interface
        await renderizarPartida();
        
        // Verificar fim de jogo
        await verificarFimDeJogo();
        
    } catch (error) {
        console.error('Erro ao marcar gol contra:', error);
        alert('❌ Erro ao marcar gol contra.');
    }
}

// Mostrar opções do VAR
async function mostrarVAR() {
    console.log('📺 Abrindo VAR...');
    
    // Buscar último gol da partida
    const resultadoGols = await Database.buscarGolsPorJogo(estadoPartida.jogoId);
    const temGols = resultadoGols.success && resultadoGols.data && resultadoGols.data.length > 0;
    
    // Verificar se há substituições
    const temSubstituicoes = estadoPartida.substituicoes && estadoPartida.substituicoes.length > 0;
    
    console.log('📺 Estado VAR:', {
        temGols: temGols,
        totalGols: temGols ? resultadoGols.data.length : 0,
        temSubstituicoes: temSubstituicoes,
        totalSubstituicoes: temSubstituicoes ? estadoPartida.substituicoes.length : 0
    });
    
    if (!temGols && !temSubstituicoes) {
        alert('⚠️ Não há ações para desfazer (gols ou substituições).');
        return;
    }
    
    // Criar modal com opções
    let opcoes = '';
    
    if (temGols) {
        const ultimoGol = resultadoGols.data[resultadoGols.data.length - 1];
        let descricaoGol;
        
        if (ultimoGol.gol_contra) {
            const timeBeneficiado = ultimoGol.time === 'A' ? 'Time A' : 'Time B';
            const timeQueFez = ultimoGol.time_gol_contra === 'A' ? 'Time A' : 'Time B';
            descricaoGol = `Gol contra: ${timeQueFez} → ${timeBeneficiado}`;
        } else {
            const nomeJogador = ultimoGol.jogadores ? ultimoGol.jogadores.nome : 'Jogador';
            descricaoGol = `Gol de ${nomeJogador}`;
        }
        
        opcoes += `
            <div class="var-option" onclick="desfazerUltimoGol(${JSON.stringify(ultimoGol).replace(/"/g, '&quot;')})">
                🥅 Desfazer último gol<br>
                <small>${descricaoGol}</small>
            </div>
        `;
    }
    
    if (temSubstituicoes) {
        const ultimaSubstituicao = estadoPartida.substituicoes[estadoPartida.substituicoes.length - 1];
        opcoes += `
            <div class="var-option" onclick="desfazerUltimaSubstituicao()">
                🔄 Desfazer última substituição<br>
                <small>${ultimaSubstituicao.jogador_entrou.nome} → ${ultimaSubstituicao.jogador_saiu.nome}</small>
            </div>
        `;
    }
    
    // Mostrar modal customizado
    mostrarModalVAR(opcoes);
}

// Modal customizado para VAR
function mostrarModalVAR(opcoes) {
    const modalContent = `
        <div style="text-align: center; padding: 20px;">
            <h3 style="color: #333; margin-bottom: 20px;">📺 VAR - Video Assistant Referee</h3>
            <p style="margin-bottom: 20px; color: #666;">Selecione a ação para desfazer:</p>
            <div class="var-options">
                ${opcoes}
            </div>
            <button onclick="fecharModalVAR()" style="margin-top: 15px; padding: 8px 16px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
        </div>
    `;
    
    // Criar modal dinamicamente
    const modal = document.createElement('div');
    modal.id = 'modal-var-custom';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
        background: rgba(0,0,0,0.7); display: flex; align-items: center; 
        justify-content: center; z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 8px; max-width: 400px; width: 90%; max-height: 80vh; overflow-y: auto;">
            ${modalContent}
            <style>
                .var-options {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    margin: 15px 0;
                }
                .var-option {
                    padding: 15px;
                    border: 2px solid #ddd;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    text-align: center;
                }
                .var-option:hover {
                    border-color: #3498db;
                    background: #f8f9fa;
                    transform: translateY(-2px);
                }
                .var-option small {
                    color: #666;
                    display: block;
                    margin-top: 5px;
                }
            </style>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function fecharModalVAR() {
    const modal = document.getElementById('modal-var-custom');
    if (modal) {
        modal.remove();
    }
}

// Desfazer última substituição
async function desfazerUltimaSubstituicao() {
    try {
        if (!estadoPartida.substituicoes || estadoPartida.substituicoes.length === 0) {
            alert('❌ Não há substituições para desfazer.');
            return;
        }
        
        const ultimaSubstituicao = estadoPartida.substituicoes[estadoPartida.substituicoes.length - 1];
        
        console.log('🔄 Desfazendo substituição:', ultimaSubstituicao);
        
        // Confirmar ação
        const confirmar = confirm(
            `Desfazer substituição?\n\n` +
            `${ultimaSubstituicao.jogador_entrou.nome} voltará para a fila\n` +
            `${ultimaSubstituicao.jogador_saiu.nome} retornará ao time`
        );
        
        if (!confirmar) return;
        
        // 1. Reverter no estado dos times
        const jogadorQueEntrou = ultimaSubstituicao.jogador_entrou;
        const jogadorQueSaiu = ultimaSubstituicao.jogador_saiu;
        
        // Encontrar e reverter no time correto
        if (jogadorQueSaiu.time === 'A') {
            const index = estadoPartida.timeA.findIndex(id => {
                const jogadorId = typeof id === 'object' ? id.id : id;
                return jogadorId === jogadorQueEntrou.id;
            });
            if (index !== -1) {
                estadoPartida.timeA[index] = jogadorQueSaiu.id;
            }
        } else {
            const index = estadoPartida.timeB.findIndex(id => {
                const jogadorId = typeof id === 'object' ? id.id : id;
                return jogadorId === jogadorQueEntrou.id;
            });
            if (index !== -1) {
                estadoPartida.timeB[index] = jogadorQueSaiu.id;
            }
        }
        
        // 2. Atualizar contador
        estadoPartida.contadorSubstituicoes--;
        
        // 3. Remover da lista de substituições
        estadoPartida.substituicoes.pop();
        
        // 4. Atualizar interface
        await renderizarTime('A', estadoPartida.timeA, 'team-a-players');
        await renderizarTime('B', estadoPartida.timeB, 'team-b-players');
        atualizarBotoes();
        
        // 5. Fechar modal VAR
        fecharModalVAR();
        
        alert(`✅ Substituição desfeita!\n${jogadorQueSaiu.nome} está de volta ao time.`);
        
        console.log('✅ Substituição desfeita com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao desfazer substituição:', error);
        alert('❌ Erro ao desfazer substituição. Tente novamente.');
    }
}

// Desfazer último gol (VAR)
async function desfazerUltimoGol(gol) {
    try {
        
        // Remover gol da tabela
        const resultadoRemocao = await Database.deletarGol(gol.id);
        
        if (!resultadoRemocao.success) {
            throw new Error('Falha ao remover gol do banco');
        }
        
        // Atualizar placar baseado no tipo de gol
        if (gol.gol_contra) {
            // É gol contra - diminuir do time que recebeu o benefício
            if (gol.time === 'A') {
                estadoPartida.placarA--;
            } else {
                estadoPartida.placarB--;
            }
            console.log('📺 VAR: Gol contra desfeito');
        } else {
            // É gol normal - diminuir do time que marcou
            if (gol.time === 'A') {
                estadoPartida.placarA--;
            } else {
                estadoPartida.placarB--;
            }
            
            // Atualizar gols do jogador (só para gols normais)
            if (gol.jogador_id && estadoPartida.golsPartida[gol.jogador_id] > 0) {
                estadoPartida.golsPartida[gol.jogador_id]--;
            }
            console.log('📺 VAR: Gol normal desfeito');
        }
        
        // Salvar placar atualizado
        const resultadoPlacar = await atualizarJogoNoBanco(estadoPartida.jogoId, {
            placar_a: estadoPartida.placarA,
            placar_b: estadoPartida.placarB
        });
        
        if (!resultadoPlacar.success) {
            throw new Error('Falha ao atualizar placar');
        }
        
        // Atualizar interface
        await renderizarPartida();
        
        // Mostrar confirmação
        const tipoGol = gol.gol_contra ? 'gol contra' : 'gol';
        alert(`✅ ${tipoGol.charAt(0).toUpperCase() + tipoGol.slice(1)} desfeito com sucesso!`);
        
        fecharModal();
        fecharModalVAR(); // Fechar modal VAR também
        
    } catch (error) {
        console.error('Erro ao desfazer ação:', error);
        alert('❌ Erro ao desfazer ação.');
    }
}

// Funções do Modal Cancelar Partida
function mostrarModalCancelarPartida() {
    const modal = document.getElementById('modal-cancelar-partida');
    if (modal) {
        modal.style.display = 'flex';
        // Prevenir scroll do body
        document.body.style.overflow = 'hidden';
    }
}

function fecharModalCancelarPartida() {
    const modal = document.getElementById('modal-cancelar-partida');
    if (modal) {
        modal.style.display = 'none';
        // Restaurar scroll do body
        document.body.style.overflow = '';
    }
}

// Finalizar partida
// Função para cancelar partida (só no início, sem gols)
async function cancelarPartida() {
    // Fechar modal primeiro
    fecharModalCancelarPartida();
    
    // Verificar se há gols registrados
    if (estadoPartida.placarA > 0 || estadoPartida.placarB > 0) {
        alert('❌ Não é possível cancelar a partida após gols terem sido marcados.');
        return;
    }
    
    try {
        console.log('🔄 Cancelando partida:', estadoPartida.jogoId);
        
        // Parar cronômetro se estiver rodando
        if (intervaloCronometro) {
            clearInterval(intervaloCronometro);
            intervaloCronometro = null;
        }
        
        // Excluir jogo do banco de dados
        const resultado = await excluirJogo(estadoPartida.jogoId);
        
        if (resultado) {
            console.log('✅ Partida cancelada com sucesso');
            alert('✅ Partida cancelada! Voltando para a fila...');
            
            // Redirecionar para fila
            window.location.href = 'fila.html';
        } else {
            throw new Error('Erro ao excluir jogo do banco');
        }
        
    } catch (error) {
        console.error('Erro ao cancelar partida:', error);
        alert('❌ Erro ao cancelar partida. Tente novamente.');
    }
}

async function finalizarPartida() {
    // Verificar se já está finalizando para evitar duplicação
    if (estadoPartida.finalizando) {
        console.log('⚠️ Partida já está sendo finalizada, ignorando chamada duplicada');
        return;
    }
    
    // Marcar como finalizando
    estadoPartida.finalizando = true;
    
    const nomeCorTimeA = obterNomeCor(estadoPartida.coresColetes.timeA);
    const nomeCorTimeB = obterNomeCor(estadoPartida.coresColetes.timeB);
    
    if (estadoPartida.placarA > estadoPartida.placarB) {
        // Vitória do Time A
        await mostrarModalConfirmarVitoria('A', nomeCorTimeA);
    } else if (estadoPartida.placarB > estadoPartida.placarA) {
        // Vitória do Time B
        await mostrarModalConfirmarVitoria('B', nomeCorTimeB);
    } else {
        // Empate - mostrar modal de confirmação com seleção
        mostrarModalConfirmarEmpate();
    }
}

// FUNÇÃO DESATIVADA - Modal de desempate movido para o modal de fim de tempo
// Mostrar modal de desempate
/*
function mostrarModalDesempate() {
    const nomeCorTimeA = obterNomeCor(estadoPartida.coresColetes.timeA);
    const nomeCorTimeB = obterNomeCor(estadoPartida.coresColetes.timeB);
    
    // Obter emojis das cores
    const emojiTimeA = estadoPartida.coresColetes.timeA === 'black' ? '⚫' : '🔴';
    const emojiTimeB = estadoPartida.coresColetes.timeB === 'black' ? '⚫' : '🔴';
    
    const modalContent = `
        <div style="text-align: center;">
            <h3>🤝 Empate ${estadoPartida.placarA}x${estadoPartida.placarB}</h3>
            <p>Escolha qual time terá <strong>prioridade na fila</strong>:</p>
            <div style="margin: 20px 0; display: flex; gap: 15px; justify-content: center;">
                <button onclick="finalizarComPrioridade('A')" style="background: #333; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                    ${emojiTimeA} ${nomeCorTimeA}
                </button>
                <button onclick="finalizarComPrioridade('B')" style="background: #dc3545; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">
                    ${emojiTimeB} ${nomeCorTimeB}
                </button>
            </div>
            <p style="font-size: 12px; color: #666;">Time com prioridade ficará em posição melhor na fila</p>
        </div>
    `;
    
    // Reutilizar o modal existente
    document.getElementById('modal-mensagem').innerHTML = modalContent;
    document.getElementById('modal-titulo').textContent = 'Desempate';
    document.getElementById('modal-confirmacao').style.display = 'flex';
    
    // Esconder botões padrão do modal
    document.querySelector('.modal-buttons').style.display = 'none';
}

// FUNÇÃO DESATIVADA - Finalizar com prioridade específica no empate
window.finalizarComPrioridade = function(timePrioridade) {
    estadoPartida.timePrioridadeEmpate = timePrioridade;
    console.log(`🎯 Empate com prioridade para TIME ${timePrioridade}`);
    
    // Restaurar modal para estado normal
    document.querySelector('.modal-buttons').style.display = 'flex';
    
    fecharModal();
    processarFinalizacao();
}
*/

// Processar finalização da partida
async function processarFinalizacao() {
    // Esconder aviso de navegação bloqueada
    esconderAvisoNavegacaoBloqueada();
    try {
        mostrarLoading(true);
        
        // Determinar vencedor
        let timeVencedor = null;
        let isEmpate = false;
        
        if (estadoPartida.placarA > estadoPartida.placarB) {
            timeVencedor = 'A';
        } else if (estadoPartida.placarB > estadoPartida.placarA) {
            timeVencedor = 'B';
        } else {
            // Empate - usar prioridade escolhida
            isEmpate = true;
            timeVencedor = null; // Manter null para empate
        }
        
        console.log('🏁 Iniciando finalização da partida:', {
            placarA: estadoPartida.placarA,
            placarB: estadoPartida.placarB,
            timeVencedor: timeVencedor,
            isEmpate: isEmpate,
            timePrioridadeEmpate: estadoPartida.timePrioridadeEmpate,
            vitoriasConsecutivas: estadoPartida.vitoriasConsecutivas,
            timeA: estadoPartida.timeA,
            timeB: estadoPartida.timeB,
            golsPartida: estadoPartida.golsPartida
        });
        
        // Finalizar jogo no banco
        try {
            const resultado = await atualizarJogoNoBanco(estadoPartida.jogoId, {
                status: 'finalizado',
                time_vencedor: timeVencedor,
                data_fim: new Date(),
                tempo_decorrido: calcularTempoDecorrido()
            });
            
            if (resultado.success) {
                console.log('✅ Jogo finalizado no banco');
            } else {
                console.warn('⚠️ Erro ao finalizar no banco:', resultado.error);
                if (!resultado.networkError) {
                    throw new Error(resultado.error);
                }
            }
        } catch (error) {
            console.error('❌ Erro crítico ao finalizar jogo:', error);
            if (!error.message?.includes('Erro de conexão')) {
                alert('❌ Erro ao finalizar partida no banco de dados!');
                mostrarLoading(false);
                return;
            }
        }
        
        // Atualizar estatísticas dos jogadores
        console.log('🔄 Iniciando atualização de estatísticas...');
        try {
            await atualizarEstatisticasJogadores(timeVencedor);
            console.log('✅ Estatísticas dos jogadores atualizadas');
        } catch (errorEstatisticas) {
            console.error('❌ Erro ao atualizar estatísticas:', errorEstatisticas);
        }
        
        // Verificar conectividade antes de processar rotação
        console.log('🔍 Testando conectividade antes de processar rotação...');
        const conectividade = await testarConectividade();
        
        if (!conectividade.success) {
            console.error('❌ Sem conectividade - não é possível processar rotação da fila');
            console.error('Erro:', conectividade.error);
            
            // Mostrar aviso ao usuário
            alert(`⚠️ Sem conexão com o banco de dados!\n\nA partida foi finalizada, mas as mudanças na fila não foram salvas.\n\nErro: ${conectividade.error}\n\nVerifique sua conexão e recarregue a página.`);
            
            fecharModal();
            mostrarLoading(false);
            return;
        }

        // Processar vitórias consecutivas e rotação
        console.log('🔄 Iniciando processamento de rotação da fila...');
        try {
            // Verificar se as funções de rotação existem
            console.log('🔍 Verificando funções de rotação disponíveis:', {
                Database: typeof Database,
                rotacionarApenasTimeA: typeof Database.rotacionarApenasTimeA,
                rotacionarApenasTimeB: typeof Database.rotacionarApenasTimeB,
                rotacionarAmbosOsTimes: typeof Database.rotacionarAmbosOsTimes,
                atualizarVitoriasConsecutivas: typeof Database.atualizarVitoriasConsecutivas
            });
            
            await processarRotacaoFila(timeVencedor);
            console.log('✅ Rotação da fila processada');
            
            // Atualizar display de vitórias consecutivas após rotação
            await atualizarDisplayVitoriasConsecutivas();
        } catch (errorRotacao) {
            console.error('❌ Erro ao processar rotação:', errorRotacao);
            alert(`❌ Erro ao processar rotação da fila!\n\nErro: ${errorRotacao.message}\n\nA partida foi finalizada, mas a fila pode não ter sido atualizada corretamente.`);
        }
        
        fecharModal();
        mostrarLoading(false);
        
        // Redirecionar para fila
        alert('✅ Partida finalizada com sucesso!');
        window.location.href = 'fila.html';
        
    } catch (error) {
        console.error('Erro ao finalizar partida:', error);
        mostrarLoading(false);
        alert('❌ Erro ao finalizar partida.');
    }
}

// Atualizar estatísticas dos jogadores
async function atualizarEstatisticasJogadores(timeVencedor) {
    const todosJogadores = [...estadoPartida.timeA, ...estadoPartida.timeB];
    
    console.log('👥 Atualizando estatísticas para jogadores:', {
        todosJogadores: todosJogadores.length,
        timeVencedor: timeVencedor,
        golsPartida: estadoPartida.golsPartida
    });
    
    for (const jogadorId of todosJogadores) {
        const isVencedor = (timeVencedor === 'A' && estadoPartida.timeA.includes(jogadorId)) ||
                          (timeVencedor === 'B' && estadoPartida.timeB.includes(jogadorId));
        
        const golsNaPartida = estadoPartida.golsPartida[jogadorId] || 0;
        
        const incrementos = {
            jogos: 1,
            vitorias: isVencedor ? 1 : 0,
            gols: golsNaPartida
        };
        
        console.log(`📊 Atualizando jogador ${jogadorId}:`, incrementos);
        
        try {
            const resultado = await Database.atualizarEstatisticasJogador(jogadorId, incrementos);
            
            if (resultado) {
                console.log(`✅ Estatísticas atualizadas para jogador ${jogadorId}`);
            } else {
                console.error(`❌ Falha ao atualizar estatísticas para jogador ${jogadorId}`);
                throw new Error('Falha na atualização das estatísticas');
            }
        } catch (error) {
            console.error(`❌ Erro ao atualizar estatísticas do jogador ${jogadorId}:`, error);
            if (error.message?.includes('Failed to fetch')) {
                console.warn(`⚠️ Erro de rede - estatísticas do jogador ${jogadorId} não salvas`);
                continue; // Continua com próximo jogador
            }
            throw error; // Re-lança outros tipos de erro
        }
    }
}

// Processar rotação da fila
// NOVA LÓGICA: usar tabela fila.vitorias_consecutivas_time para controle persistente
// - Time A vence: +1 vitória consecutiva, Time B sai se < 3, ambos saem se ≥ 3
// - Time B vence: Time B assume posição A com 1 vitória, ex-Time A sai
// - Empate: ambos saem, próximos entram com 0 vitórias
async function processarRotacaoFila(timeVencedor) {
    // Obter vitórias consecutivas atuais do banco de dados
    const vitoriasAtuais = await obterVitoriasConsecutivasTimeA();
    
    console.log('🔄 Processando rotação da fila:', {
        timeVencedor: timeVencedor,
        vitoriasAtuais: vitoriasAtuais,
        limiteVitorias: estadoPartida.limiteVitorias
    });
    
    // Lógica de rotação baseada no resultado e vitórias consecutivas
    if (timeVencedor === null) {
        // Empate - ambos os times saem, resetar todas as vitórias
        console.log('🤝 Empate - resetando vitórias e rotacionando ambos os times');
        await resetarTodasVitoriasConsecutivas();
        
        // Rotacionar com prioridade
        const timePrioridade = estadoPartida.timePrioridadeEmpate;
        console.log(`🎯 Rotacionando com prioridade para TIME ${timePrioridade}`);
        
        const resultadoRotacao = await Database.rotacionarEmpateComPrioridade(timePrioridade);
        console.log('🔄 Ambos os times rotacionados com prioridade:', resultadoRotacao);
        
    } else if (timeVencedor === 'A') {
        // Time A venceu - continua sequência
        const novasVitorias = vitoriasAtuais + 1;
        console.log(`🏆 Time A venceu - vitórias consecutivas: ${vitoriasAtuais} → ${novasVitorias}`);
        
        await atualizarVitoriasConsecutivasTimeA(novasVitorias);
        
        console.log(`🔍 DEBUG: novasVitorias (${novasVitorias}) >= limiteVitorias (${estadoPartida.limiteVitorias})? ${novasVitorias >= estadoPartida.limiteVitorias}`);
        
        if (novasVitorias >= estadoPartida.limiteVitorias) {
            // Time A atingiu limite - resetar todas as vitórias e ambos saem
            console.log('🚫 Time A atingiu limite - resetando vitórias e rotacionando ambos os times (vencedor com prioridade)');
            await resetarTodasVitoriasConsecutivas();
            
            const resultadoRotacao = await Database.rotacionarTerceiraVitoriaConsecutiva('A');
            console.log('🔄 Ambos os times rotacionados com prioridade para vencedor:', resultadoRotacao);
        } else {
            // Time A continua, Time B sai - manter vitórias do Time A
            console.log('➡️ Time A continua - rotacionando apenas Time B');
            const resultadoRotacao = await Database.rotacionarApenasTimeB();
            console.log('🔄 Time B rotacionado:', resultadoRotacao);
            
            // Após rotação, Time A continua com as mesmas vitórias consecutivas
            // Novos jogadores do Time B começam com 0 vitórias
        }
    } else {
        // Time B venceu - Time B inicia nova sequência com 1 vitória
        console.log('🔴 Time B venceu - rotacionando Time A, Time B vira novo Time A com 1 vitória');
        
        const resultadoRotacao = await Database.rotacionarApenasTimeA(); // Time A sai, Time B fica
        console.log('� Time A rotacionado:', resultadoRotacao);
        
        // Após rotação, o ex-Time B agora é Time A com 1 vitória consecutiva
        await atualizarVitoriasConsecutivasTimeA(1);
    }
}

// Iniciar sincronização automática
function iniciarSincronizacao() {
    // Atualizar display a cada segundo
    setInterval(() => {
        atualizarDisplayCronometro();
    }, 1000);
    
    // Salvar estado periodicamente é feito dentro de atualizarDisplayCronometro
}

// Funções auxiliares
function mostrarModal(titulo, mensagem, callback) {
    document.getElementById('modal-titulo').textContent = titulo;
    document.getElementById('modal-mensagem').textContent = mensagem;
    document.getElementById('modal-confirmacao').style.display = 'block';
    
    // Guardar callback para confirmação
    window.modalCallback = callback;
}

function fecharModal() {
    document.getElementById('modal-confirmacao').style.display = 'none';
    window.modalCallback = null;
}

function confirmarAcao() {
    if (window.modalCallback) {
        window.modalCallback();
    }
}

function mostrarLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

// Função para voltar à fila (com confirmação se jogo ativo)
function voltarParaFila() {
    if (estadoPartida.iniciado && !estadoPartida.pausado) {
        if (confirm('⚠️ A partida está em andamento. Tem certeza que deseja sair?')) {
            window.location.href = 'fila.html';
        }
    } else {
        window.location.href = 'fila.html';
    }
}

// Mostrar aviso de navegação bloqueada
function mostrarAvisoNavegacaoBloqueada() {
    let aviso = document.getElementById('aviso-navegacao-bloqueada');
    if (!aviso) {
        aviso = document.createElement('div');
        aviso.id = 'aviso-navegacao-bloqueada';
        aviso.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff6b6b;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 15px;
            font-weight: bold;
            z-index: 1100;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            text-align: center;
            border: 2px solid #ff5252;
            animation: pulse 2s infinite;
        `;
        aviso.innerHTML = '🔒 NAVEGAÇÃO BLOQUEADA<br><small>Cronômetro pausado</small>';
        
        // Adicionar animação CSS se não existir
        if (!document.getElementById('aviso-navegacao-styles')) {
            const styles = document.createElement('style');
            styles.id = 'aviso-navegacao-styles';
            styles.innerHTML = `
                @keyframes pulse {
                    0% { opacity: 1; transform: translateX(-50%) scale(1); }
                    50% { opacity: 0.8; transform: translateX(-50%) scale(1.05); }
                    100% { opacity: 1; transform: translateX(-50%) scale(1); }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(aviso);
    }
    aviso.style.display = 'block';
}

// Esconder aviso de navegação bloqueada
function esconderAvisoNavegacaoBloqueada() {
    const aviso = document.getElementById('aviso-navegacao-bloqueada');
    if (aviso) {
        aviso.style.display = 'none';
    }
}

// Confirmar encerramento (footer)
function confirmarEncerramento() {
    mostrarModal(
        '🏁 Encerrar Sessão',
        'Isso encerrará toda a sessão. Deseja continuar?',
        () => {
            window.location.href = 'index.html';
        }
    );
}

// Mostrar tela sem jogo ativo
function mostrarTelaSemanJogo() {
    mostrarLoading(false);
    
    // Esconder conteúdo principal
    document.querySelector('.container').style.display = 'none';
    
    // Mostrar tela sem jogo
    const noGameScreen = document.getElementById('no-game-screen');
    noGameScreen.style.display = 'flex';
    
    // Configurar event listeners dos botões
    document.getElementById('go-to-queue-btn').addEventListener('click', () => {
        window.location.href = 'fila.html';
    });
    
    document.getElementById('refresh-game-btn').addEventListener('click', async () => {
        try {
            mostrarLoading(true);
            noGameScreen.style.display = 'none';
            
            // Verificar novamente se há jogo ativo
            const jogoAtivo = await obterJogoAtivo();
            if (jogoAtivo) {
                window.location.href = `partida.html?jogo_id=${jogoAtivo.id}`;
            } else {
                // Ainda não há jogo, mostrar tela novamente
                setTimeout(() => {
                    mostrarTelaSemanJogo();
                }, 1000);
            }
        } catch (error) {
            console.error('Erro ao verificar jogo:', error);
            mostrarTelaSemanJogo();
        }
    });
}

// Esconder tela sem jogo
function esconderTelaSemanJogo() {
    document.getElementById('no-game-screen').style.display = 'none';
    document.querySelector('.container').style.display = 'block';
}

// Função para aplicar restrições visuais para jogadores na partida
function aplicarRestricoesVisuaisPartida() {
    const userRole = localStorage.getItem('userRole');
    
    if (userRole === 'player') {
        console.log('👁️ Aplicando modo visualização para jogador na partida');
        
        setTimeout(() => {
            // Botões de controle da partida que jogadores não podem usar
            const botoesRestringir = [
                '#play-pause-btn',  // Play/Pause cronômetro
                '#reset-btn',       // Reset cronômetro
                '#var-btn',         // VAR
                '#finish-btn',      // Finalizar partida
                '.goal-btn',        // Botões de gol
                '.team-color-btn',  // Botões de cores dos coletes
                '.control-button',  // Outros controles
                '.admin-controls'   // Controles administrativos
            ];
            
            botoesRestringir.forEach(selector => {
                const elementos = document.querySelectorAll(selector);
                elementos.forEach(el => {
                    el.style.display = 'none';
                });
            });
            
            // Adicionar aviso de modo visualização na partida
            const container = document.querySelector('.container');
            if (container) {
                const avisoDiv = document.createElement('div');
                avisoDiv.innerHTML = `
                    <div style="background: linear-gradient(135deg, #28a745, #20c997); color: white; padding: 15px; border-radius: 12px; margin-bottom: 20px; text-align: center; box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);">
                        <h4 style="margin: 0 0 8px 0; font-size: 1.1rem;">⚽ Modo Espectador</h4>
                        <p style="margin: 0; font-size: 0.9rem; opacity: 0.9;">Você está acompanhando a partida como jogador. Controles restritos.</p>
                    </div>
                `;
                container.insertBefore(avisoDiv, container.firstChild);
            }
            
            // Desabilitar cliques em elementos interativos
            const elementosInterativos = document.querySelectorAll('button, .clickable, .interactive');
            elementosInterativos.forEach(el => {
                const isControlButton = el.classList.contains('goal-btn') || 
                                       el.classList.contains('control-button') ||
                                       el.id.includes('btn');
                
                if (isControlButton) {
                    el.style.cursor = 'not-allowed';
                    el.title = 'Ação restrita para jogadores';
                    el.onclick = null;
                    el.removeAttribute('onclick');
                    
                    // Remover event listeners
                    const newEl = el.cloneNode(true);
                    el.parentNode.replaceChild(newEl, el);
                }
            });
            
        }, 1500); // Aguardar mais tempo para garantir que a partida foi carregada
    }
}

// ========== SISTEMA DE SUBSTITUIÇÕES ==========

// Abrir modal de substituição
async function abrirSubstituicao() {
    console.log('=======================================');
    console.log('🔄 INICIANDO ABERTURA DE SUBSTITUIÇÃO 🔄');
    console.log('=======================================');
    console.log('🔄 Abrindo modal de substituição...');
    console.log('📊 Estado ANTES da pausa:', {
        iniciado: estadoPartida.iniciado,
        pausado: estadoPartida.pausado,
        tempoDecorrido: estadoPartida.tempoDecorrido,
        tempoRestante: estadoPartida.tempoRestante
    });
    
    // Pausar cronômetro automaticamente
    let cronometroPausadoParaSubstituicao = false;
    if (estadoPartida.iniciado && !estadoPartida.pausado) {
        console.log('⏸️ Pausando cronômetro para substituição...');
        
        // Calcular tempo atual antes de pausar
        const agora = new Date();
        const tempoDecorridoAtual = Math.floor((agora - estadoPartida.dataInicio) / 1000);
        const duracaoTotalSegundos = estadoPartida.duracaoTotal * 60;
        const tempoRestanteAtual = Math.max(0, duracaoTotalSegundos - tempoDecorridoAtual);
        
        // Atualizar estado antes de pausar
        estadoPartida.tempoDecorrido = tempoDecorridoAtual;
        estadoPartida.tempoRestante = tempoRestanteAtual;
        
        console.log('📊 Calculando tempo na pausa:', {
            agora: agora,
            dataInicio: estadoPartida.dataInicio,
            tempoDecorridoAtual: tempoDecorridoAtual,
            tempoRestanteAtual: tempoRestanteAtual
        });
        
        // Pausar efetivamente
        estadoPartida.pausado = true;
        cronometroPausadoParaSubstituicao = true;
        console.log('⏸️ Cronômetro pausado para substituição');
        
        // Atualizar display imediatamente
        atualizarDisplayCronometro();
        
        // Adicionar indicador visual de pausa
        adicionarIndicadorPausa('Substituição em andamento...');
        
        // Salvar estado pausado no banco
        const dadosParaSalvar = { 
            status: 'pausado',
            tempo_decorrido: tempoDecorridoAtual
        };
        console.log('💾 Salvando estado pausado:', dadosParaSalvar);
        await atualizarJogoNoBanco(estadoPartida.jogoId, dadosParaSalvar);
    } else {
        console.log('❌ NÃO pausou cronômetro:', {
            motivo: estadoPartida.iniciado ? 'Já estava pausado' : 'Jogo não iniciado'
        });
    }
    
    // Guardar se pausamos o cronômetro para esta substituição
    estadoPartida.cronometroPausadoParaSubstituicao = cronometroPausadoParaSubstituicao;
    console.log('🔧 Flag de pausa para substituição:', cronometroPausadoParaSubstituicao);
    
    console.log('📊 Estado atual:', {
        iniciado: estadoPartida.iniciado,
        pausado: estadoPartida.pausado,
        timeA: estadoPartida.timeA,
        timeB: estadoPartida.timeB,
        contadorSubstituicoes: estadoPartida.contadorSubstituicoes
    });
    
    // Verificar se há fila suficiente
    console.log('🔍 DEBUG - Iniciando verificação da fila...');
    const filaAtual = await obterFilaCompleta();
    console.log('📋 Fila atual:', filaAtual);
    console.log('📊 Tamanho da fila:', filaAtual ? filaAtual.length : 'null/undefined');
    
    const posicaoProxima = 13 + estadoPartida.contadorSubstituicoes;
    console.log(`📍 Posição próximo substituto: ${posicaoProxima}`);
    console.log(`🔢 Contador de substituições atual: ${estadoPartida.contadorSubstituicoes}`);
    
    if (!filaAtual || filaAtual.length < posicaoProxima) {
        console.log('❌ Fila insuficiente para substituição');
        console.log('🔍 Detalhes da verificação:', {
            filaExiste: !!filaAtual,
            tamanhoFila: filaAtual ? filaAtual.length : 'null',
            posicaoNecessaria: posicaoProxima
        });
        alert('❌ Não há jogadores suficientes na fila para substituição!');
        return;
    }
    
    // Preencher listas com jogadores atuais dos times
    console.log('🔄 Preenchendo listas de jogadores...');
    await preencherListasJogadores();
    
    // Mostrar modal
    console.log('✅ Exibindo modal de substituição');
    document.getElementById('modal-substituicao').style.display = 'block';
}

// Buscar dados completos de um jogador por ID
async function buscarJogadorPorId(jogadorId) {
    try {
        console.log(`🔍 Buscando jogador ID: ${jogadorId}`);
        
        // Primeiro tentar buscar nos elementos HTML já renderizados
        const nomeHTML = obterNomeJogadorHTML(jogadorId);
        if (nomeHTML) {
            console.log(`✅ Nome encontrado nos elementos HTML: ${nomeHTML}`);
            return {
                id: jogadorId,
                nome: nomeHTML,
                nome_usuario: nomeHTML
            };
        }
        
        // Se não encontrou no HTML, buscar no banco
        const supabaseClient = initializeSupabase();
        console.log(`📡 Cliente Supabase inicializado:`, !!supabaseClient);
        
        if (!supabaseClient) {
            console.error('❌ Cliente Supabase não disponível');
            return null;
        }
        
        console.log(`🎯 Tentando buscar na tabela usuarios...`);
        const { data: jogador, error } = await supabaseClient
            .from('usuarios')
            .select('*')
            .eq('id', jogadorId)
            .single();
        
        console.log(`📋 Resultado da busca usuarios:`, { data: jogador, error });
        
        if (error) {
            console.error(`❌ Erro ao buscar jogador ${jogadorId} na tabela usuarios:`, error);
            
            // Tentar buscar na tabela jogadores como alternativa
            console.log(`🔄 Tentando buscar na tabela jogadores...`);
            const { data: jogadorAlt, error: errorAlt } = await supabaseClient
                .from('jogadores')
                .select('*')
                .eq('id', jogadorId)
                .single();
            
            console.log(`📋 Resultado da busca jogadores:`, { data: jogadorAlt, error: errorAlt });
            
            if (errorAlt) {
                console.error(`❌ Erro na busca alternativa:`, errorAlt);
                return null;
            }
            
            console.log(`✅ Jogador encontrado na tabela jogadores:`, jogadorAlt);
            return jogadorAlt;
        }
        
        console.log(`✅ Jogador encontrado na tabela usuarios:`, jogador);
        return jogador;
    } catch (error) {
        console.error(`❌ Erro inesperado ao buscar jogador:`, error);
        return null;
    }
}

// Preencher listas de jogadores por time
async function preencherListasJogadores() {
    console.log('🔄 Iniciando preenchimento das listas...');
    
    const teamAContainer = document.getElementById('substituicao-team-a-players');
    const teamBContainer = document.getElementById('substituicao-team-b-players');
    
    console.log('📋 Containers encontrados:', {
        teamAContainer: !!teamAContainer,
        teamBContainer: !!teamBContainer
    });
    
    if (!teamAContainer || !teamBContainer) {
        console.error('❌ Containers não encontrados!');
        return;
    }
    
    // Mostrar indicador de carregamento
    teamAContainer.innerHTML = '<div style="text-align: center; padding: 20px;">Carregando...</div>';
    teamBContainer.innerHTML = '<div style="text-align: center; padding: 20px;">Carregando...</div>';
    
    console.log('👥 IDs dos times a serem renderizados:', {
        timeA: estadoPartida.timeA,
        timeB: estadoPartida.timeB
    });
    
    try {
        // Limpar containers
        teamAContainer.innerHTML = '';
        teamBContainer.innerHTML = '';
        
        // Buscar dados completos dos jogadores do Time A
        if (estadoPartida.timeA && estadoPartida.timeA.length > 0) {
            console.log('🔍 Buscando dados do Time A...');
            for (let i = 0; i < estadoPartida.timeA.length; i++) {
                const jogadorId = estadoPartida.timeA[i];
                
                try {
                    const jogadorCompleto = await buscarJogadorPorId(jogadorId);
                    console.log(`➕ Jogador Time A [${i}]:`, { id: jogadorId, dados: jogadorCompleto });
                    
                    if (jogadorCompleto) {
                        const playerDiv = createPlayerOption(jogadorCompleto, 'A');
                        teamAContainer.appendChild(playerDiv);
                    } else {
                        console.warn(`❌ Jogador ${jogadorId} não encontrado, criando fallback`);
                        // Temporário: criar fallback com nome mais amigável
                        const playerDiv = createPlayerOption({
                            id: jogadorId,
                            nome: `Jogador ${i + 1}`,
                            nome_usuario: null
                        }, 'A');
                        teamAContainer.appendChild(playerDiv);
                    }
                } catch (error) {
                    console.error(`⚠️ Erro ao buscar jogador ${jogadorId}:`, error);
                    // Criar fallback em caso de erro
                    const playerDiv = createPlayerOption({
                        id: jogadorId,
                        nome: `Jogador ${i + 1}`,
                        nome_usuario: null
                    }, 'A');
                    teamAContainer.appendChild(playerDiv);
                }
            }
        } else {
            console.warn('⚠️ Time A vazio ou indefinido');
            teamAContainer.innerHTML = '<div style="text-align: center; color: #999;">Nenhum jogador</div>';
        }
        
        // Buscar dados completos dos jogadores do Time B
        if (estadoPartida.timeB && estadoPartida.timeB.length > 0) {
            console.log('🔍 Buscando dados do Time B...');
            for (let i = 0; i < estadoPartida.timeB.length; i++) {
                const jogadorId = estadoPartida.timeB[i];
                
                try {
                    const jogadorCompleto = await buscarJogadorPorId(jogadorId);
                    console.log(`➕ Jogador Time B [${i}]:`, { id: jogadorId, dados: jogadorCompleto });
                    
                    if (jogadorCompleto) {
                        const playerDiv = createPlayerOption(jogadorCompleto, 'B');
                        teamBContainer.appendChild(playerDiv);
                    } else {
                        console.warn(`❌ Jogador ${jogadorId} não encontrado, criando fallback`);
                        // Temporário: criar fallback com nome mais amigável
                        const playerDiv = createPlayerOption({
                            id: jogadorId,
                            nome: `Jogador ${i + 1}`,
                            nome_usuario: null
                        }, 'B');
                        teamBContainer.appendChild(playerDiv);
                    }
                } catch (error) {
                    console.error(`⚠️ Erro ao buscar jogador ${jogadorId}:`, error);
                    // Criar fallback em caso de erro
                    const playerDiv = createPlayerOption({
                        id: jogadorId,
                        nome: `Jogador ${i + 1}`,
                        nome_usuario: null
                    }, 'B');
                    teamBContainer.appendChild(playerDiv);
                }
            }
        } else {
            console.warn('⚠️ Time B vazio ou indefinido');
            teamBContainer.innerHTML = '<div style="text-align: center; color: #999;">Nenhum jogador</div>';
        }
        
        console.log('✅ Preenchimento concluído');
    } catch (error) {
        console.error('❌ Erro geral ao preencher listas:', error);
        teamAContainer.innerHTML = '<div style="text-align: center; color: red;">Erro ao carregar</div>';
        teamBContainer.innerHTML = '<div style="text-align: center; color: red;">Erro ao carregar</div>';
    }
}

// Criar elemento clicável para jogador
function createPlayerOption(jogador, time) {
    console.log('🎯 Criando opção para jogador:', { jogador, time });
    
    const div = document.createElement('div');
    div.className = 'player-option';
    
    // Tentar extrair o nome de diferentes formas possíveis
    let nomeJogador;
    
    if (typeof jogador === 'string') {
        nomeJogador = jogador;
    } else if (jogador && typeof jogador === 'object') {
        nomeJogador = jogador.nome || 
                     jogador.nome_usuario || 
                     jogador.nome_completo || 
                     jogador.apelido ||
                     jogador.name ||
                     jogador.username ||
                     `Jogador ${jogador.id || 'sem ID'}`;
    } else {
        nomeJogador = 'Jogador desconhecido';
    }
    
    console.log('📝 Nome extraído:', { nomeJogador, jogadorOriginal: jogador });
    
    div.textContent = nomeJogador;
    div.dataset.jogadorData = JSON.stringify({...jogador, time});
    
    div.addEventListener('click', function() {
        console.log('👆 Jogador clicado:', nomeJogador);
        
        // Remover seleção anterior
        document.querySelectorAll('.player-option.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Selecionar este jogador
        this.classList.add('selected');
        
        // Atualizar substituto
        atualizarSubstituto();
    });
    
    return div;
}

// Fechar modal de substituição
async function fecharSubstituicao() {
    console.log('=======================================');
    console.log('❌ INICIANDO FECHAMENTO DE SUBSTITUIÇÃO ❌');
    console.log('=======================================');
    
    // Retomar cronômetro se foi pausado para substituição
    if (estadoPartida.cronometroPausadoParaSubstituicao) {
        console.log('▶️ Retomando cronômetro após substituição...');
        console.log('📊 Estado ANTES da retomada:', {
            pausado: estadoPartida.pausado,
            tempoDecorrido: estadoPartida.tempoDecorrido,
            tempoRestante: estadoPartida.tempoRestante,
            dataInicio: estadoPartida.dataInicio
        });
        
        // Calcular nova data de início baseada no tempo decorrido
        const agora = new Date();
        estadoPartida.dataInicio = new Date(agora.getTime() - (estadoPartida.tempoDecorrido * 1000));
        
        console.log('📊 Nova dataInicio calculada:', {
            agora: agora,
            tempoDecorrido: estadoPartida.tempoDecorrido,
            novaDataInicio: estadoPartida.dataInicio
        });
        
        estadoPartida.pausado = false;
        console.log('▶️ Cronômetro retomado após fechar substituição');
        
        // Atualizar display imediatamente  
        atualizarDisplayCronometro();
        
        // Salvar estado no banco
        const dadosParaSalvar = { 
            status: 'em_andamento',
            tempo_decorrido: estadoPartida.tempoDecorrido
        };
        await atualizarJogoNoBanco(estadoPartida.jogoId, dadosParaSalvar);
        
        // Limpar flag
        estadoPartida.cronometroPausadoParaSubstituicao = false;
        
        // Remover indicador visual de pausa
        removerIndicadorPausa();
        
        // Atualizar visibilidade do botão
        atualizarVisibilidadeBotaoSubstituicao();
    }
}

// Indicador visual de pausa
function adicionarIndicadorPausa(mensagem) {
    // Remover indicador existente se houver
    removerIndicadorPausa();
    
    const indicador = document.createElement('div');
    indicador.id = 'indicador-pausa-substituicao';
    indicador.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #ff9500, #ff6b35);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 13px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        border: 1px solid #ff8c00;
        animation: fadeIn 0.3s ease;
    `;
    indicador.innerHTML = `⏸️ ${mensagem}`;
    
    document.body.appendChild(indicador);
}

function removerIndicadorPausa() {
    const indicador = document.getElementById('indicador-pausa-substituicao');
    if (indicador) {
        indicador.remove();
    }
    
    document.getElementById('modal-substituicao').style.display = 'none';
    
    // Resetar seleções
    document.querySelectorAll('.player-option.selected').forEach(el => {
        el.classList.remove('selected');
    });
    document.getElementById('substituto-info').style.display = 'none';
    document.getElementById('btn-confirmar-substituicao').disabled = true;
}

// Atualizar informações do substituto quando jogador é selecionado
async function atualizarSubstituto() {
    const jogadorSelecionado = document.querySelector('.player-option.selected');
    
    if (!jogadorSelecionado) {
        document.getElementById('substituto-info').style.display = 'none';
        document.getElementById('btn-confirmar-substituicao').disabled = true;
        return;
    }
    
    try {
        // Obter dados do jogador selecionado
        const jogadorData = JSON.parse(jogadorSelecionado.dataset.jogadorData);
        
        // Obter fila atual
        const filaAtual = await obterFilaCompleta();
        const posicaoSubstituto = 13 + estadoPartida.contadorSubstituicoes;
        
        if (filaAtual.length >= posicaoSubstituto) {
            const substituto = filaAtual[posicaoSubstituto - 1]; // Array é zero-indexed
            
            // Obter nome do substituto com fallback
            console.log('🔍 DEBUG COMPLETO: Analisando substituto...');
            console.log('📊 Objeto substituto completo:', JSON.stringify(substituto, null, 2));
            
            const nome1 = substituto.nome;
            const nome2 = substituto.nome_usuario;
            
            // Para jogadores da fila (que não estão na tela), tentar buscar no banco
            let nome3 = null;
            if (!nome1 && !nome2) {
                console.log('🔍 Jogador não está na tela (está na fila). Buscando diretamente no banco...');
                try {
                    // Buscar diretamente no banco SEM tentar obterNomeJogadorHTML primeiro
                    const supabaseClient = initializeSupabase();
                    if (supabaseClient) {
                        console.log('🎯 Fazendo consulta direta na tabela usuarios para ID:', substituto.id);
                        const { data: jogador, error } = await supabaseClient
                            .from('usuarios')
                            .select('*')
                            .eq('id', substituto.id)
                            .single();
                        
                        console.log('📋 Resultado da consulta direta:', { 
                            encontrado: !!jogador, 
                            erro: !!error, 
                            detalhesErro: error,
                            dadosJogador: jogador ? { 
                                nome: jogador.nome, 
                                nome_usuario: jogador.nome_usuario,
                                id: jogador.id 
                            } : null
                        });
                        
                        if (!error && jogador) {
                            nome3 = jogador.nome || jogador.nome_usuario;
                            console.log('✅ Nome encontrado diretamente no banco:', nome3);
                        } else {
                            console.log('❌ Jogador não encontrado na tabela usuarios - Erro:', error?.message || 'Sem dados');
                            
                            // Tentar na tabela jogadores como alternativa
                            console.log('🔄 Tentando buscar na tabela jogadores...');
                            const { data: jogadorAlt, error: errorAlt } = await supabaseClient
                                .from('jogadores')
                                .select('*')
                                .eq('id', substituto.id)
                                .single();
                                
                            if (!errorAlt && jogadorAlt) {
                                nome3 = jogadorAlt.nome || jogadorAlt.nome_usuario;
                                console.log('✅ Nome encontrado na tabela jogadores:', nome3);
                            } else {
                                console.log('❌ Também não encontrado na tabela jogadores:', errorAlt?.message);
                            }
                        }
                    }
                } catch (error) {
                    console.log('❌ Erro ao buscar no banco:', error);
                }
            }
            
            const nome4 = `Jogador ${posicaoSubstituto}`;
            
            console.log('� Tentativas de nome:', {
                'substituto.nome': nome1,
                'substituto.nome_usuario': nome2,
                'obterNomeJogadorHTML(id)': nome3,
                'fallback final': nome4,
                'ID usado para HTML': substituto.id
            });
            
            const nomeSubstituto = nome1 || nome2 || nome3 || nome4;
            
            console.log('👤 DEBUG: Resultado final:', {
                nomeEscolhido: nomeSubstituto,
                elementoTarget: document.getElementById('nome-substituto')
            });
            
            // Mostrar informações do substituto
            console.log('� Nome final escolhido para exibição:', nomeSubstituto);
            document.getElementById('nome-substituto').textContent = nomeSubstituto;
            document.getElementById('posicao-substituto').textContent = `${posicaoSubstituto}º na fila`;
            document.getElementById('substituto-info').style.display = 'block';
            
            // Habilitar botão confirmar
            document.getElementById('btn-confirmar-substituicao').disabled = false;
        } else {
            alert('❌ Não há jogadores suficientes na fila!');
            fecharSubstituicao();
        }
    } catch (error) {
        console.error('Erro ao buscar substituto:', error);
        alert('Erro ao carregar substituto. Tente novamente.');
    }
}

// Confirmar substituição
async function confirmarSubstituicao() {
    const jogadorSelecionadoElement = document.querySelector('.player-option.selected');
    if (!jogadorSelecionadoElement) return;
    
    const jogadorSelecionado = JSON.parse(jogadorSelecionadoElement.dataset.jogadorData);
    
    try {
        // Obter substituto da fila
        const filaAtual = await obterFilaCompleta();
        const posicaoSubstituto = 13 + estadoPartida.contadorSubstituicoes;
        
        console.log('🔍 DEBUG substituição:', {
            tamanhoFila: filaAtual.length,
            posicaoNecessaria: posicaoSubstituto,
            indiceArray: posicaoSubstituto - 1,
            substitutoEncontrado: !!filaAtual[posicaoSubstituto - 1]
        });
        
        const substituto = filaAtual[posicaoSubstituto - 1];
        
        if (!substituto) {
            throw new Error(`Não há substituto na posição ${posicaoSubstituto} da fila`);
        }
        
        console.log('🔄 Realizando substituição:', {
            sai: jogadorSelecionado.nome,
            entra: substituto.nome || substituto.nome_usuario || `ID: ${substituto.id}`,
            posicao: posicaoSubstituto
        });
        
        // Criar objeto de substituição para histórico
        const substituicaoInfo = {
            jogador_saiu: jogadorSelecionado,
            jogador_entrou: substituto,
            momento: new Date(),
            tempo_jogo: formatarTempo(estadoPartida.duracaoTotal * 60 - estadoPartida.tempoRestante),
            posicao_fila: posicaoSubstituto
        };
        
        // Atualizar times na partida (manter apenas IDs)
        if (jogadorSelecionado.time === 'A') {
            const index = estadoPartida.timeA.findIndex(id => {
                // Pode ser ID direto ou objeto com ID
                const jogadorId = typeof id === 'object' ? id.id : id;
                return jogadorId === jogadorSelecionado.id;
            });
            if (index !== -1) {
                estadoPartida.timeA[index] = substituto.id;
            }
        } else {
            const index = estadoPartida.timeB.findIndex(id => {
                // Pode ser ID direto ou objeto com ID
                const jogadorId = typeof id === 'object' ? id.id : id;
                return jogadorId === jogadorSelecionado.id;
            });
            if (index !== -1) {
                estadoPartida.timeB[index] = substituto.id;
            }
        }
        
        // Registrar substituição
        estadoPartida.substituicoes.push(substituicaoInfo);
        estadoPartida.contadorSubstituicoes++;
        
        // Salvar no banco
        await salvarSubstituicao(substituicaoInfo);
        console.log('✅ Substituição salva no banco');
        
        // Debug: verificar estado após substituição
        console.log('🔄 Estados dos times após substituição:', {
            timeA: estadoPartida.timeA,
            timeB: estadoPartida.timeB
        });
        
        // Atualizar interface
        console.log('🔄 Atualizando interface...');
        await renderizarTime('A', estadoPartida.timeA, 'team-a-players');
        await renderizarTime('B', estadoPartida.timeB, 'team-b-players');
        atualizarBotoes();
        console.log('✅ Interface atualizada');
        
        // Fechar modal
        fecharSubstituicao();
        
        // Obter nome do substituto para a mensagem
        const nomeSubstitutoMsg = substituto.nome || substituto.nome_usuario || 
                                obterNomeJogadorHTML(substituto.id) || 
                                `Jogador ${posicaoSubstituto}`;
        
        alert(`✅ ${jogadorSelecionado.nome} foi substituído por ${nomeSubstitutoMsg}!`);
        
    } catch (error) {
        console.error('Erro ao confirmar substituição:', error);
        alert('Erro ao realizar substituição. Tente novamente.');
    }
}

// Obter fila completa do banco
async function obterFilaCompleta() {
    try {
        console.log('🔍 DEBUG obterFilaCompleta - Iniciando...');
        const supabase = initializeSupabase();
        if (!supabase) {
            console.log('❌ Supabase não inicializado');
            throw new Error('Supabase não inicializado');
        }
        console.log('✅ Supabase inicializado com sucesso');
        
        // Obter sessão ativa
        console.log('🔍 Buscando sessão ativa...');
        const sessaoAtiva = await obterSessaoAtiva();
        if (!sessaoAtiva) {
            console.log('❌ Nenhuma sessão ativa encontrada');
            throw new Error('Nenhuma sessão ativa');
        }
        console.log('✅ Sessão ativa encontrada:', sessaoAtiva.id);
        
        // Buscar fila da sessão atual
        console.log('🔍 Buscando fila da sessão...', 'ID da sessão:', sessaoAtiva.id);
        
        // IMPORTANTE: Buscar APENAS da tabela 'fila' (jogadores ativos presentes)
        // NÃO buscar de 'reservas' (que são jogadores cadastrados mas talvez ausentes)
        const { data: filaData, error: filaError } = await supabase
            .from('fila')
            .select(`
                *,
                sessao_id,
                jogador_id,
                posicao_fila,
                created_at
            `)
            .eq('sessao_id', sessaoAtiva.id)
            .order('posicao_fila', { ascending: true });
            
        if (filaError) {
            console.log('❌ Erro ao buscar fila:', filaError);
            throw filaError;
        }
        
        console.log('📊 Dados da fila encontrados:', filaData ? filaData.length : 0, 'itens');
        console.log('🎯 VERIFICAÇÃO: Buscando APENAS da tabela FILA (não reservas)');
        console.log('📋 Primeiros 3 itens da fila:', filaData ? filaData.slice(0, 3) : []);
        console.log('📋 Últimos 3 itens da fila:', filaData ? filaData.slice(-3) : []);
        
        if (!filaData || filaData.length === 0) {
            console.log('⚠️ Fila vazia - retornando array vazio');
            return [];
        }
        
        // Verificar se há duplicatas na fila (possível problema no banco)
        const sessoesUnicas = [...new Set(filaData.map(item => item.sessao_id))];
        const jogadoresUnicos = [...new Set(filaData.map(item => item.jogador_id))];
        console.log('🔍 Verificação da integridade da fila:', {
            totalItens: filaData.length,
            sessoesUnicas: sessoesUnicas.length,
            jogadoresUnicos: jogadoresUnicos.length,
            sessaoEsperada: sessaoAtiva.id,
            sessoesEncontradas: sessoesUnicas,
            haJogadoresDuplicados: jogadoresUnicos.length !== filaData.length
        });
        
        // Se há jogadores duplicados na fila, filtrar para manter apenas um de cada
        if (jogadoresUnicos.length !== filaData.length) {
            console.warn('⚠️ DETECTADO: Jogadores duplicados na fila! Removendo duplicatas...');
            const filaSemDuplicatas = filaData.filter((item, index, self) => 
                index === self.findIndex(t => t.jogador_id === item.jogador_id)
            );
            console.log('✅ Fila filtrada:', filaSemDuplicatas.length, 'jogadores únicos (antes:', filaData.length, ')');
            
            // IMPORTANTE: Atualizar a variável filaData
            filaData.splice(0, filaData.length, ...filaSemDuplicatas);
            console.log('✅ Array filaData atualizado com', filaData.length, 'jogadores únicos');
        }
        
        // Buscar dados dos jogadores
        console.log('🔍 Buscando dados dos jogadores...');
        const jogadorIds = filaData.map(item => item.jogador_id);
        console.log('👥 IDs dos jogadores na fila (após filtro):', jogadorIds.length, 'IDs:', jogadorIds.slice(0, 5), '...');
        
        const { data: jogadoresData, error: jogadoresError } = await supabase
            .from('usuarios')
            .select('*')
            .in('id', jogadorIds);
            
        if (jogadoresError) {
            console.log('❌ Erro ao buscar jogadores:', jogadoresError);
            throw jogadoresError;
        }
        
        console.log('👥 Dados dos jogadores encontrados:', jogadoresData ? jogadoresData.length : 0);
        
        // Se não encontrou dados dos usuários, buscar individualmente no banco
        if (!jogadoresData || jogadoresData.length === 0) {
            console.error('❌ CRÍTICO: Nenhum dado de jogador encontrado na busca em lote!');
            console.log('🔍 Tentando buscar jogadores individualmente...');
            
            // Buscar cada jogador individualmente no banco
            const filaComNomes = await Promise.all(filaData.map(async (filaItem) => {
                try {
                    console.log(`🔍 Buscando individualmente jogador ${filaItem.jogador_id}...`);
                    const { data: jogador, error } = await supabase
                        .from('usuarios')
                        .select('*')
                        .eq('id', filaItem.jogador_id)
                        .single();
                    
                    if (!error && jogador) {
                        console.log(`✅ Encontrado: ${jogador.nome || jogador.nome_usuario}`);
                        return {
                            ...jogador,
                            posicao_fila: filaItem.posicao_fila
                        };
                    } else {
                        console.warn(`❌ Jogador ${filaItem.jogador_id} não encontrado individualmente`);
                        return {
                            id: filaItem.jogador_id,
                            nome: null, // Deixar null para ser tratado depois
                            nome_usuario: null,
                            posicao_fila: filaItem.posicao_fila
                        };
                    }
                } catch (error) {
                    console.error(`❌ Erro ao buscar ${filaItem.jogador_id}:`, error);
                    return {
                        id: filaItem.jogador_id,
                        nome: null,
                        nome_usuario: null,
                        posicao_fila: filaItem.posicao_fila
                    };
                }
            }));
            
            console.log('✅ Fila montada com busca individual:', filaComNomes.length, 'jogadores');
            return filaComNomes;
        }
        
        // Combinar dados da fila com dados dos jogadores
        const filaCompleta = filaData.map(filaItem => {
            const jogador = jogadoresData.find(j => j.id === filaItem.jogador_id);
            if (!jogador) {
                console.warn(`⚠️ Jogador ${filaItem.jogador_id} não encontrado na tabela usuarios`);
                // Fallback para jogador não encontrado
                const nomeHTML = obterNomeJogadorHTML(filaItem.jogador_id);
                return {
                    id: filaItem.jogador_id,
                    nome: nomeHTML || `Jogador ${filaItem.posicao_fila}`,
                    nome_usuario: nomeHTML || `Jogador ${filaItem.posicao_fila}`,
                    posicao_fila: filaItem.posicao_fila
                };
            }
            
            return {
                ...jogador,
                posicao_fila: filaItem.posicao_fila
            };
        });
        
        console.log('✅ Fila completa montada com', filaCompleta.length, 'jogadores');
        
        // Log do 13º jogador para debug
        if (filaCompleta.length >= 13) {
            console.log('👤 13º jogador na fila:', filaCompleta[12]);
        } else {
            console.log('❌ Não há 13º jogador - fila tem apenas', filaCompleta.length, 'jogadores');
        }
        
        return filaCompleta;
    } catch (error) {
        console.error('❌ Erro ao obter fila:', error);
        return []; // Retorna array vazio em caso de erro em vez de lançar
    }
}

// Salvar substituição no banco
async function salvarSubstituicao(substituicaoInfo) {
    try {
        console.log('💾 Tentando salvar substituição:', substituicaoInfo);
        console.log('📋 Substituições atuais do estado:', estadoPartida.substituicoes);
        
        // Salvar substituições no jogo atual
        const resultado = await atualizarJogoNoBanco(estadoPartida.jogoId, {
            substituicoes: JSON.stringify(estadoPartida.substituicoes)
        });
        
        if (resultado.success) {
            console.log('✅ Substituições salvas no jogo');
        } else {
            console.warn('⚠️ Erro ao salvar substituições no banco:', resultado.error);
        }
    } catch (error) {
        console.error('Erro ao salvar substituição:', error);
        // Não interrompe o fluxo em caso de erro de salvamento
    }
}

// Processar estatísticas considerando substituições
function processarEstatisticasComSubstituicoes(timeVencedor) {
    // Identificar jogadores que saíram antes do final
    const jogadoresSairam = estadoPartida.substituicoes.map(sub => sub.jogador_saiu.id);
    
    // Atualizar estatísticas apenas dos jogadores que terminaram o jogo
    const estatisticasFinais = {
        vencedores: [],
        perdedores: [],
        jogadoresSairamAntes: []
    };
    
    // Processar Time A
    estadoPartida.timeA.forEach(jogador => {
        if (jogadoresSairam.includes(jogador.id)) {
            // Jogador saiu antes - só conta jogos, mantém gols
            estatisticasFinais.jogadoresSairamAntes.push({
                ...jogador,
                contaVitoria: false,
                contaDerrota: false,
                contaJogo: true
            });
        } else {
            // Jogador terminou o jogo
            if (timeVencedor === 'A') {
                estatisticasFinais.vencedores.push(jogador);
            } else {
                estatisticasFinais.perdedores.push(jogador);
            }
        }
    });
    
    // Processar Time B
    estadoPartida.timeB.forEach(jogador => {
        if (jogadoresSairam.includes(jogador.id)) {
            // Jogador saiu antes - só conta jogos, mantém gols
            estatisticasFinais.jogadoresSairamAntes.push({
                ...jogador,
                contaVitoria: false,
                contaDerrota: false,
                contaJogo: true
            });
        } else {
            // Jogador terminou o jogo
            if (timeVencedor === 'B') {
                estatisticasFinais.vencedores.push(jogador);
            } else {
                estatisticasFinais.perdedores.push(jogador);
            }
        }
    });
    
    return estatisticasFinais;
}

// Controlar visibilidade do botão de substituição
function atualizarVisibilidadeBotaoSubstituicao() {
    const botaoSubstituicao = document.getElementById('substitute-footer-btn');
    if (!botaoSubstituicao) return;
    
    // Mostrar se partida estiver ativa e (não pausada OU pausada apenas para substituição)
    if (estadoPartida.iniciado && (!estadoPartida.pausado || estadoPartida.cronometroPausadoParaSubstituicao)) {
        botaoSubstituicao.style.display = 'block';
    } else {
        botaoSubstituicao.style.display = 'none';
    }
}

// Função de debug para testes rápidos
function debugIniciarJogo() {
    console.log('🎮 FUNÇÃO DEBUG: Iniciando jogo para teste...');
    estadoPartida.iniciado = true;
    estadoPartida.pausado = false;
    estadoPartida.dataInicio = new Date();
    estadoPartida.duracaoTotal = 15; // 15 minutos para teste
    estadoPartida.tempoDecorrido = 0;
    estadoPartida.tempoRestante = 15 * 60; // 15 minutos em segundos
    
    // Atualizar display
    atualizarDisplayCronometro();
    console.log('✅ Jogo iniciado para debug:', estadoPartida);
}

// Função de debug para testar substituição
function debugTestarSubstituicao() {
    console.log('🔄 FUNÇÃO DEBUG: Testando substituição...');
    abrirSubstituicao();
}

// Função de debug para testar empate
async function debugTestarEmpate() {
    console.log('🤝 FUNÇÃO DEBUG: Testando modal de empate...');
    
    // Usar dados simples primeiro para testar
    estadoPartida.placarA = 2;
    estadoPartida.placarB = 2;
    estadoPartida.coresColetes = { timeA: 'black', timeB: 'red' };
    
    // Simular estrutura com nomes diretos para testar
    estadoPartida.timeA = [
        { nome: 'João Silva', posicao: 'atacante' }, 
        { nome: 'Pedro Santos', posicao: 'meio-campo' }
    ];
    estadoPartida.timeB = [
        { nome_usuario: 'Carlos Lima', posicao: 'defesa' }, 
        { name: 'Miguel Costa', posicao: 'goleiro' }
    ];
    
    console.log('🔍 Times configurados para teste:', {
        timeA: estadoPartida.timeA,
        timeB: estadoPartida.timeB
    });
    
    // Mostrar modal
    mostrarModalConfirmarEmpate();
}

// Função auxiliar para listar jogadores da sessão para debug
async function debugListarJogadoresSessao() {
    try {
        console.log('🔍 === DEBUG: LISTANDO JOGADORES DA SESSÃO ===');
        
        const { data: sessaoData, error } = await supabaseClient
        
        if (error) {
            console.log('❌ Erro ao buscar sessão:', error);
            return;
        }
        
        if (!sessaoData) {
            console.log('❌ Nenhuma sessão ativa encontrada');
            return;
        }
        
        console.log('✅ Sessão encontrada:', sessaoData.id);
        console.log('📊 Time A:', sessaoData.time_a);
        console.log('📊 Time B:', sessaoData.time_b);
        
        if (sessaoData.time_a) {
            console.log('👥 Jogadores Time A:');
            sessaoData.time_a.forEach((jogador, index) => {
                console.log(`  ${index + 1}. ID: ${jogador.id || jogador.userId || 'N/A'} | Nome: ${jogador.nome || 'N/A'}`);
            });
        }
        
        if (sessaoData.time_b) {
            console.log('👥 Jogadores Time B:');
            sessaoData.time_b.forEach((jogador, index) => {
                console.log(`  ${index + 1}. ID: ${jogador.id || jogador.userId || 'N/A'} | Nome: ${jogador.nome || 'N/A'}`);
            });
        }
        
    } catch (error) {
        console.log('❌ Erro na função debug:', error);
    }
}

// Chamar automaticamente o debug quando a página carregar
window.debugListarJogadoresSessao = debugListarJogadoresSessao;

// Função utilitária para obter nome do jogador dos elementos HTML
function obterNomeJogadorHTML(jogadorId) {
    console.log('🔍 obterNomeJogadorHTML chamado com ID:', jogadorId);
    
    if (!jogadorId) {
        console.log('❌ ID vazio ou nulo');
        return null;
    }
    
    // Buscar nos elementos já renderizados na tela
    const seletor = `[data-jogador-id="${jogadorId}"]`;
    console.log('🎯 Buscando seletor:', seletor);
    
    const elementoJogador = document.querySelector(seletor);
    console.log('📱 Elemento encontrado:', !!elementoJogador);
    
    if (elementoJogador) {
        const nome = elementoJogador.getAttribute('data-nome');
        console.log('✅ Nome encontrado na tela:', nome, 'para ID:', jogadorId);
        console.log('🔍 Elemento completo:', elementoJogador);
        return nome;
    }
    
    // Verificar todos os elementos com data-jogador-id para debug
    const todosElementos = document.querySelectorAll('[data-jogador-id]');
    console.log('🔍 DEBUG: Todos elementos com data-jogador-id:', todosElementos.length);
    console.log('🔍 IDs disponíveis na tela:', Array.from(todosElementos).map(el => el.getAttribute('data-jogador-id')).slice(0, 10));
    
    // Fallback
    console.log('❌ Nome não encontrado na tela para ID:', jogadorId);
    return `Jogador ${jogadorId.substring(0, 8)}`;
}

// Função para mostrar alerta de lembrete das cores dos coletes
function mostrarAlertaCoresColetes() {
    // Criar elemento do alerta
    const alertDiv = document.createElement('div');
    alertDiv.id = 'alerta-cores-coletes';
    alertDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(145deg, #4CAF50 0%, #2E7D32 100%);
        color: white;
        padding: 25px 35px;
        border-radius: 20px;
        font-size: 16px;
        font-weight: 600;
        text-align: center;
        box-shadow: 0 15px 35px rgba(76, 175, 80, 0.4), 0 5px 15px rgba(0,0,0,0.12);
        z-index: 10000;
        border: 2px solid rgba(255,255,255,0.2);
        backdrop-filter: blur(10px);
        max-width: 320px;
        width: 320px;
        min-height: 180px;
        line-height: 1.5;
        animation: slideIn 0.5s ease-out;
    `;
    
    // CSS das animações
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
        @keyframes slideIn {
            from { 
                transform: translate(-50%, -50%) scale(0.7);
                opacity: 0;
            }
            to { 
                transform: translate(-50%, -50%) scale(1);
                opacity: 1;
            }
        }
        
        .emoji-cores {
            font-size: 20px;
            margin: 0 8px;
            display: inline-block;
            animation: rotate 2s linear infinite;
        }
        
        @keyframes rotate {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(styleSheet);
    
    let contador = 10;
    
    function atualizarTexto() {
        alertDiv.innerHTML = `
            <div style="margin-bottom: 15px; font-size: 18px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap;">
                ⚡ <strong>CONFIGURAR CORES</strong> ⚡
            </div>
            <div style="margin-bottom: 15px; font-size: 14px; opacity: 0.95; white-space: nowrap;">
                Selecione a cor do <strong>colete</strong> de cada time
            </div>
            <div style="margin-bottom: 20px; font-size: 14px; display: flex; align-items: center; justify-content: center; white-space: nowrap;">
                <span class="emoji-cores">⚫</span>
                <span style="margin: 0 10px;">Clique nos círculos</span>
                <span class="emoji-cores">🔴</span>
            </div>
            <div style="font-size: 28px; color: #FFD700; font-weight: bold; text-shadow: 0 3px 6px rgba(0,0,0,0.4);">
                ${contador}s
            </div>
            <div style="margin-top: 15px; font-size: 12px; opacity: 0.8; white-space: nowrap;">
                Clique para fechar
            </div>
        `;
    }
    
    // Primeira atualização
    atualizarTexto();
    
    // Adicionar ao DOM
    document.body.appendChild(alertDiv);
    
    // Iniciar contagem regressiva
    const intervalContador = setInterval(() => {
        contador--;
        atualizarTexto();
        
        if (contador <= 0) {
            clearInterval(intervalContador);
            fecharAlerta();
        }
    }, 1000);
    
    function fecharAlerta() {
        alertDiv.style.animation = 'none';
        alertDiv.style.transform = 'translate(-50%, -50%) scale(0)';
        alertDiv.style.opacity = '0';
        alertDiv.style.transition = 'all 0.3s ease-out';
        
        setTimeout(() => {
            if (alertDiv.parentNode) alertDiv.remove();
            if (styleSheet.parentNode) styleSheet.remove();
        }, 300);
    }
    
    // Permitir fechar clicando no alerta
    alertDiv.addEventListener('click', () => {
        clearInterval(intervalContador);
        fecharAlerta();
    });
}
