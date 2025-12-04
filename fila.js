// ========== LOADING STATES ==========
// Cache simples para dados frequentemente acessados
const dataCache = new Map();
const CACHE_TTL = 30000; // 30 segundos

function setCache(key, data) {
    dataCache.set(key, {
        data: data,
        timestamp: Date.now()
    });
}

function getCache(key) {
    const cached = dataCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    dataCache.delete(key);
    return null;
}

// Função para mostrar skeleton loading em times
function showTeamSkeleton(teamNumber) {
    const tbody = document.getElementById(`team${teamNumber}-body`);
    if (!tbody) return;
    
    let html = '';
    for (let i = 0; i < 6; i++) {
        html += `
            <tr>
                <td class="player-name-cell">
                    <div class="skeleton skeleton-player"></div>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

// Função para mostrar skeleton loading na fila
function showQueueSkeleton() {
    const container = document.getElementById('queue-blocks-container');
    if (!container) return;
    
    let html = '';
    for (let block = 0; block < 3; block++) {
        html += `
            <div class="queue-block">
                <div class="queue-block-header">
                    <h4>${block === 0 ? 'Próximo time' : `${block + 1}º na fila`}</h4>
                </div>
                <div class="queue-block-table-container">
                    <table class="queue-block-table">
                        <tbody>
        `;
        
        for (let i = 0; i < 6; i++) {
            html += `
                <tr>
                    <td class="queue-block-player-name">
                        <div class="skeleton skeleton-player"></div>
                    </td>
                </tr>
            `;
        }
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// Função para adicionar overlay de loading
function addLoadingOverlay(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.classList.add('loading');
    
    const existingOverlay = element.querySelector('.loading-overlay');
    if (existingOverlay) return;
    
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-spinner"></div>';
    element.appendChild(overlay);
}

// Função para remover overlay de loading
function removeLoadingOverlay(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.classList.remove('loading');
    
    const overlay = element.querySelector('.loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Função para mostrar loading durante operações assíncronas
async function withLoading(elementId, asyncFunction) {
    addLoadingOverlay(elementId);
    
    try {
        const result = await asyncFunction();
        return result;
    } finally {
        removeLoadingOverlay(elementId);
    }
}
// Função de debounce para agrupar operações
function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

// Função de throttle para limitar frequência de execução
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Versões debounced das principais operações (otimizadas)
const debouncedReloadQueue = debounce(async function() {
    console.log('🔄 Executando reload da fila (debounced)...');
    await recarregarFila();
}, 300); // Reduzido de 500ms para 300ms

const debouncedRenderInterface = debounce(async function() {
    console.log('🎨 Executando renderização (debounced)...');
    await renderGameInterface();
}, 300);

// Versão throttled para scroll events (se necessário)
const throttledScroll = throttle(function() {
    // Lógica para eventos de scroll se necessário
}, 100);

// ========== FUNÇÕES UTILITÁRIAS ==========
function showError(message) {
    // Implementar sistema de notificação de erro
    alert(message);
}

function showSuccess(message) {
    // Implementar sistema de notificação de sucesso
    alert(message);
}

// Função para mostrar tela sem sessão ativa
function showNoSessionScreen() {
    const noSessionScreen = document.getElementById('no-session-screen');
    const mainContent = document.querySelector('.main');
    
    if (noSessionScreen) {
        noSessionScreen.style.display = 'flex';
    }
    
    if (mainContent) {
        mainContent.style.display = 'none';
    }
}

// Função para esconder tela sem sessão ativa
function hideNoSessionScreen() {
    const noSessionScreen = document.getElementById('no-session-screen');
    const mainContent = document.querySelector('.main');
    
    if (noSessionScreen) {
        noSessionScreen.style.display = 'none';
    }
    
    if (mainContent) {
        mainContent.style.display = 'block';
    }
}

// ========== ESTADO DO JOGO ==========
let gameState = {
    currentGame: {
        time1: [],
        time2: [],
        gameNumber: 1,
        consecutiveWins: 0,
        lastWinner: null
    },
    queue: [],
    reserves: [],
    sessaoAtiva: null
};

// Função para exibir a data atual
function exibirDataAtual() {
    const dataAtual = new Date();
    
    // Obter dia da semana
    const diaSemana = dataAtual.toLocaleDateString('pt-BR', { weekday: 'long' });
    
    // Obter data no formato DD/MM/AAAA
    const dia = String(dataAtual.getDate()).padStart(2, '0');
    const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
    const ano = dataAtual.getFullYear();
    
    const dataFormatada = `${diaSemana}, ${dia}/${mes}/${ano}`;
    
    const elementoData = document.getElementById('data-atual');
    if (elementoData) {
        elementoData.textContent = dataFormatada;
    }
}

// Função para detectar e lidar com problemas de tracking prevention
function checkTrackingPrevention() {
    // Verificar se Supabase está disponível
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase bloqueado por tracking prevention');
        showTrackingPreventionError();
        return false;
    }
    return true;
}

// Função para mostrar erro de tracking prevention
function showTrackingPreventionError() {
    const container = document.querySelector('.container');
    if (!container) return;
    
    container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; background: #fff3cd; border: 2px solid #ffeaa7; border-radius: 15px; margin: 20px 0;">
            <h2 style="color: #856404; margin-bottom: 20px;">🚫 Bloqueio Detectado</h2>
            <p style="color: #664d03; margin-bottom: 15px; line-height: 1.6;">
                O navegador está bloqueando a conexão com o banco de dados devido às configurações de privacidade.
            </p>
            <p style="color: #664d03; margin-bottom: 20px; font-weight: bold;">
                Para usar a aplicação, você precisa:
            </p>
            <div style="text-align: left; background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <p style="margin: 10px 0;"><strong>📱 Safari/Edge:</strong> Desabilitar "Prevenir Rastreamento"</p>
                <p style="margin: 10px 0;"><strong>🔒 Ou:</strong> Usar modo privado/incógnito</p>
                <p style="margin: 10px 0;"><strong>🌐 Ou:</strong> Usar Chrome/Firefox</p>
            </div>
            <button onclick="location.reload()" style="
                background: #28a745; color: white; border: none; padding: 15px 30px; 
                border-radius: 10px; font-size: 1rem; font-weight: bold; cursor: pointer;
                margin-top: 20px;
            ">
                🔄 Tentar Novamente
            </button>
        </div>
    `;
}

// Função para aplicar restrições visuais para jogadores
function aplicarRestricoesVisuais() {
    const userRole = localStorage.getItem('userRole');
    
    if (userRole === 'player') {
        console.log('👁️ Aplicando modo visualização para jogador');
        
        // Aguardar um pouco para garantir que os elementos foram carregados
        setTimeout(() => {
            // Ocultar botões de ação para jogadores
            const botoesRestringir = [
                '#go-to-sorteio-btn',
                '#refresh-queue-btn',
                '.btn-add-queue',
                '.btn-remove',
                '.btn-encerrar-pelada',
                '.admin-controls',
                '.action-buttons',
                'button[onclick*="addPlayer"]',
                'button[onclick*="removePlayer"]',
                'button[onclick*="encerrar"]'
            ];
            
            botoesRestringir.forEach(selector => {
                const elementos = document.querySelectorAll(selector);
                elementos.forEach(el => {
                    el.style.display = 'none';
                });
            });
            
            // Adicionar aviso de modo visualização
            const container = document.querySelector('.container');
            if (container) {
                const avisoDiv = document.createElement('div');
                avisoDiv.innerHTML = `
                    <div style="background: linear-gradient(135deg, #17a2b8, #138496); color: white; padding: 15px; border-radius: 12px; margin-bottom: 20px; text-align: center; box-shadow: 0 4px 15px rgba(23, 162, 184, 0.3);">
                        <h4 style="margin: 0 0 8px 0; font-size: 1.1rem;">👁️ Modo Visualização</h4>
                        <p style="margin: 0; font-size: 0.9rem; opacity: 0.9;">Você está visualizando a fila como jogador. Algumas funcionalidades estão ocultas.</p>
                    </div>
                `;
                container.insertBefore(avisoDiv, container.firstChild);
            }
            
            // Remover event listeners de botões (prevenir ações por teclado/programação)
            document.querySelectorAll('button').forEach(btn => {
                if (btn.onclick || btn.getAttribute('onclick')) {
                    const acoes = ['add', 'remove', 'encerrar', 'clear'];
                    const temAcao = acoes.some(acao => 
                        (btn.onclick && btn.onclick.toString().includes(acao)) ||
                        (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(acao))
                    );
                    
                    if (temAcao) {
                        btn.onclick = null;
                        btn.removeAttribute('onclick');
                        btn.style.cursor = 'not-allowed';
                        btn.title = 'Ação restrita para jogadores';
                    }
                }
            });
            
        }, 1000);
    }
}

// Inicialização da página
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM carregado - iniciando aplicação...');
    
    // Exibir data atual
    exibirDataAtual();
    
    // Verificar tracking prevention ANTES de tudo
    if (!checkTrackingPrevention()) {
        return; // Para a execução se houver bloqueio
    }
    
    // Aplicar restrições visuais para jogadores
    aplicarRestricoesVisuais();
    
    // Aguardar um pouco para garantir que o Supabase foi carregado
    setTimeout(() => {
        initializePage();
    }, 200); // Aumentei o delay para dar mais tempo
    
    // Recarregar fila automaticamente quando a janela ganha foco (usuário volta da partida)
    window.addEventListener('focus', () => {
        console.log('🔄 Janela ganhou foco - agendando reload da fila...');
        debouncedReloadQueue();
    });

    // Event listeners para tela sem sessão
    const goToSorteioBtn = document.getElementById('go-to-sorteio-btn');
    const refreshQueueBtn = document.getElementById('refresh-queue-btn');
    
    if (goToSorteioBtn) {
        goToSorteioBtn.addEventListener('click', () => {
            window.location.href = 'sorteio.html';
        });
    }
    
    if (refreshQueueBtn) {
        refreshQueueBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }
});

// Função para recarregar apenas a fila
async function recarregarFila() {
    try {
        console.log('🔄 Recarregando dados da fila...');
        
        // Verificar se há uma sessão ativa
        const sessao = await obterSessaoAtiva();
        if (!sessao) {
            console.log('❌ Não há sessão ativa');
            return;
        }
        
        gameState.sessaoAtiva = sessao;
        
        // Buscar último jogo para atualizar times atuais
        const jogos = await obterJogos(sessao.id);
        const ultimoJogo = jogos.find(j => j.status === 'iniciado');
        
        if (ultimoJogo) {
            gameState.currentGame.time1 = ultimoJogo.time_a || [];
            gameState.currentGame.time2 = ultimoJogo.time_b || [];
            gameState.currentGame.gameNumber = ultimoJogo.numero_jogo || jogos.length;
        }
        
        // Recarregar fila
        const fila = await obterFila(sessao.id);
        gameState.queue = fila.sort((a, b) => a.posicao_fila - b.posicao_fila);
        
        // Recarregar reservas
        const todosJogadores = await obterJogadores();
        const jogandoIds = [
            ...gameState.currentGame.time1.map(p => p.id),
            ...gameState.currentGame.time2.map(p => p.id)
        ];
        const filaIds = gameState.queue.map(p => p.jogador_id);
        
        gameState.reserves = todosJogadores.filter(j => 
            !jogandoIds.includes(j.id) && !filaIds.includes(j.id)
        );
        
        // Renderizar interface atualizada
        await renderGameInterface();
        
        console.log('✅ Fila recarregada com sucesso');
        
    } catch (error) {
        console.error('❌ Erro ao recarregar fila:', error);
    }
}

async function initializePage() {
    try {
        console.log('🚀 Inicializando página da fila...');
        
        // Verificar se o Supabase está disponível
        if (typeof supabase === 'undefined') {
            console.error('❌ Supabase não foi carregado - problema de tracking prevention');
            showError('Erro de conexão. Desabilite o bloqueador de rastreamento ou use modo privado.');
            showNoSessionScreen();
            return;
        }
        
        // Verificar se há uma sessão ativa
        console.log('🔍 Verificando sessão ativa...');
        const sessao = await obterSessaoAtiva();
        console.log('� Sessão encontrada:', sessao);
        
        if (!sessao) {
            console.log('❌ Não há sessão ativa - mostrando tela de sessão vazia');
            // Não há sessão ativa, mostrar tela especial
            showNoSessionScreen();
            return;
        }

        gameState.sessaoAtiva = sessao;
        
        // Carregar estado atual do jogo
        console.log('📊 Carregando estado do jogo...');
        await loadGameState();
        
        // Renderizar interface
        console.log('🎨 Renderizando interface...');
        await renderGameInterface();
        
        // Verificar se deve abrir modal de gerenciamento
        if (window.location.hash === '#gerenciar') {
            console.log('🔄 Hash #gerenciar detectado - abrindo modal...');
            // Limpar o hash da URL
            window.history.replaceState(null, null, window.location.pathname);
            // Abrir modal de gerenciamento
            setTimeout(() => {
                mostrarGerenciamento();
            }, 500); // Pequeno delay para garantir que a interface foi renderizada
        }
        
        console.log('✅ Página inicializada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao inicializar página:', error);
        
        // Verificar se é erro de conexão/tracking
        if (error.message?.includes('Failed to fetch') || 
            error.message?.includes('blocked') || 
            error.message?.includes('network')) {
            showError('Erro de conexão. Verifique sua internet ou desabilite bloqueadores.');
        } else {
            showError('Erro ao carregar dados do jogo: ' + error.message);
        }
        
        showNoSessionScreen();
    }
}

async function loadGameState() {
    try {
        console.log('📊 Carregando estado do jogo para sessão:', gameState.sessaoAtiva.id);
        
        // Buscar times jogando atual
        console.log('🔍 Buscando jogos da sessão...');
        const jogos = await obterJogos(gameState.sessaoAtiva.id);
        console.log('🎮 Jogos encontrados:', jogos.length);
        
        const ultimoJogo = jogos.length > 0 ? jogos[jogos.length - 1] : null;
        console.log('🎯 Último jogo:', ultimoJogo);
        
        if (ultimoJogo && ultimoJogo.status === 'em_andamento') {
            // Há um jogo em andamento
            gameState.currentGame.time1 = ultimoJogo.time_a || [];
            gameState.currentGame.time2 = ultimoJogo.time_b || [];
            gameState.currentGame.gameNumber = ultimoJogo.numero_jogo || jogos.length;
            console.log('🏃‍♂️ Jogo em andamento detectado - times carregados');
        } else {
            console.log('⏸️ Nenhum jogo em andamento');
        }
        
        // Buscar fila
        console.log('📋 Buscando fila da sessão...');
        const fila = await obterFila(gameState.sessaoAtiva.id);
        console.log('📋 Fila encontrada:', fila.length, 'jogadores');
        
        gameState.queue = fila.sort((a, b) => a.posicao_fila - b.posicao_fila);
        console.log('📋 Fila ordenada:', gameState.queue.map(p => `${p.posicao_fila}: ${p.nome || p.jogador?.nome}`));
        
        // Adicionar botão de teste temporário se fila vazia
        if (gameState.queue.length === 0) {
            console.log('⚠️ FILA VAZIA - Adicionando botão de teste...');
            addTestButton();
        }
        
        // Buscar reservas (jogadores não na fila nem jogando)
        console.log('👥 Buscando todos os jogadores...');
        const todosJogadores = await obterJogadores();
        console.log('👥 Total de jogadores cadastrados:', todosJogadores.length);
        
        const jogandoIds = [
            ...gameState.currentGame.time1.map(p => p.id),
            ...gameState.currentGame.time2.map(p => p.id)
        ];
        const filaIds = gameState.queue.map(p => p.jogador_id);
        
        gameState.reserves = todosJogadores.filter(j => 
            !jogandoIds.includes(j.id) && !filaIds.includes(j.id)
        );
        
        console.log('🪑 Reservas encontradas:', gameState.reserves.length);
        console.log('📊 Estado carregado:', {
            sessao: gameState.sessaoAtiva.id,
            fila: gameState.queue.length,
            reservas: gameState.reserves.length,
            time1: gameState.currentGame.time1.length,
            time2: gameState.currentGame.time2.length
        });
        
        // Calcular vitórias consecutivas
        await calculateConsecutiveWins();
        
        console.log('✅ Estado do jogo carregado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao carregar estado do jogo:', error);
        throw error;
    }
}

// Função temporária para adicionar botão de teste
function addTestButton() {
    const container = document.querySelector('.container');
    if (!container) return;
    
    const testDiv = document.createElement('div');
    testDiv.innerHTML = `
        <div style="background: #ff9800; color: white; padding: 15px; border-radius: 10px; margin: 10px 0; text-align: center;">
            <p style="margin: 0 0 10px 0; font-weight: bold;">🧪 MODO TESTE - Fila Vazia</p>
            <button onclick="adicionarJogadoresTesteFila()" style="
                background: white; color: #ff9800; border: none; padding: 10px 20px; 
                border-radius: 5px; font-weight: bold; cursor: pointer;
            ">
                ➕ Adicionar Jogadores de Teste na Fila
            </button>
        </div>
    `;
    container.insertBefore(testDiv, container.firstChild);
}

// Função para adicionar jogadores de teste na fila
async function adicionarJogadoresTesteFila() {
    try {
        console.log('🧪 Adicionando jogadores de teste na fila...');
        
        // Pegar alguns jogadores das reservas
        const jogadoresParaTeste = gameState.reserves.slice(0, 12);
        console.log('👥 Jogadores para teste:', jogadoresParaTeste.map(p => p.nome));
        
        for (let i = 0; i < jogadoresParaTeste.length; i++) {
            const jogador = jogadoresParaTeste[i];
            await adicionarJogadorFila(gameState.sessaoAtiva.id, jogador.id, i + 1);
            console.log(`➕ Adicionado: ${jogador.nome} na posição ${i + 1}`);
        }
        
        // Recarregar estado
        await loadGameState();
        await renderGameInterface();
        
        console.log('✅ Jogadores de teste adicionados!');
        
        // Remover botão de teste
        const testDiv = document.querySelector('div[style*="background: #ff9800"]');
        if (testDiv) testDiv.remove();
        
    } catch (error) {
        console.error('❌ Erro ao adicionar jogadores de teste:', error);
        alert('Erro ao adicionar jogadores de teste: ' + error.message);
    }
}

async function calculateConsecutiveWins() {
    try {
        const jogos = await obterJogos(gameState.sessaoAtiva.id);
        const jogosFinalizados = jogos.filter(j => j.status === 'finalizado');
        
        if (jogosFinalizados.length === 0) {
            gameState.currentGame.consecutiveWins = 0;
            gameState.currentGame.lastWinner = null;
            return;
        }
        
        // Buscar o último vencedor
        const ultimoJogo = jogosFinalizados[jogosFinalizados.length - 1];
        const lastWinner = ultimoJogo.time_vencedor;
        
        if (!lastWinner) {
            gameState.currentGame.consecutiveWins = 0;
            gameState.currentGame.lastWinner = null;
            return;
        }
        
        // Contar vitórias consecutivas do mesmo time
        let consecutiveWins = 0;
        for (let i = jogosFinalizados.length - 1; i >= 0; i--) {
            const jogo = jogosFinalizados[i];
            if (jogo.time_vencedor === lastWinner) {
                consecutiveWins++;
            } else {
                break;
            }
        }
        
        gameState.currentGame.consecutiveWins = consecutiveWins;
        gameState.currentGame.lastWinner = lastWinner;
        
    } catch (error) {
        console.error('Erro ao calcular vitórias consecutivas:', error);
    }
}

// ========== RENDERIZAÇÃO DIFERENCIAL ==========
// Estado anterior para comparação e renderização diferencial
let previousState = {
    queue: [],
    reserves: [],
    currentGame: { time1: [], time2: [] },
    stats: new Map(),
    initialized: false
};

// Função para comparar estados e determinar o que precisa ser atualizado
function getChangedComponents(newState) {
    const changes = {
        teams: false,
        queue: false,
        reserves: false,
        stats: false,
        header: false
    };
    
    try {
        // Verificar mudanças nos times
        const time1Changed = JSON.stringify(newState.currentGame.time1) !== JSON.stringify(previousState.currentGame.time1);
        const time2Changed = JSON.stringify(newState.currentGame.time2) !== JSON.stringify(previousState.currentGame.time2);
        changes.teams = time1Changed || time2Changed;
        
        // Verificar mudanças na fila - usar verificação mais segura
        const newQueueIds = (newState.queue || []).map(p => p.jogador_id || p.id || 'unknown');
        const oldQueueIds = (previousState.queue || []).map(p => p.jogador_id || p.id || 'unknown');
        changes.queue = JSON.stringify(newQueueIds) !== JSON.stringify(oldQueueIds);
        
        // Verificar mudanças nas reservas
        const newReserveIds = (newState.reserves || []).map(p => p.id || 'unknown');
        const oldReserveIds = (previousState.reserves || []).map(p => p.id || 'unknown');
        changes.reserves = JSON.stringify(newReserveIds) !== JSON.stringify(oldReserveIds);
        
        // Verificar mudanças no cabeçalho (total de jogadores)
        changes.header = (newState.queue || []).length !== (previousState.queue || []).length;
        
        // Log para debug
        if (changes.teams || changes.queue || changes.reserves || changes.header) {
            console.log('🔄 Mudanças detectadas:', changes);
            console.log('🔍 Estado anterior:', {
                queueLength: (previousState.queue || []).length,
                reservesLength: (previousState.reserves || []).length
            });
            console.log('🔍 Estado novo:', {
                queueLength: (newState.queue || []).length,
                reservesLength: (newState.reserves || []).length
            });
        } else {
            console.log('✅ Nenhuma mudança detectada - renderização otimizada');
        }
        
    } catch (error) {
        console.error('❌ Erro ao comparar estados:', error);
        // Em caso de erro, assumir que tudo mudou para garantir renderização
        return {
            teams: true,
            queue: true,
            reserves: true,
            stats: true,
            header: true
        };
    }
    
    return changes;
}

// Função otimizada de renderização que só atualiza o que mudou
async function renderGameInterface() {
    console.log('🎨 Iniciando renderização diferencial...');
    
    try {
        // Construir novo estado com verificações de segurança
        const newState = {
            queue: gameState.queue ? [...gameState.queue] : [],
            reserves: gameState.reserves ? [...gameState.reserves] : [],
            currentGame: {
                time1: gameState.currentGame?.time1 ? [...gameState.currentGame.time1] : [],
                time2: gameState.currentGame?.time2 ? [...gameState.currentGame.time2] : []
            }
        };
        
        // Na primeira execução, renderizar tudo
        if (!previousState.initialized) {
            console.log('🚀 Primeira renderização - renderizando tudo...');
            
            updateHeaderInfo();
            await renderNextTeams();
            await renderQueueBlocks();
            renderReserves();
            
            previousState = { ...newState, initialized: true };
            
            try {
                await carregarEstatisticasDia();
            } catch (statsError) {
                console.warn('⚠️ Erro ao carregar estatísticas do dia:', statsError);
            }
            
            console.log('✅ Primeira renderização concluída!');
            return;
        }
        
        // Verificar o que mudou
        const changes = getChangedComponents(newState);
        
        // Renderizar apenas componentes que mudaram
        if (changes.header) {
            console.log('📊 Atualizando header...');
            updateHeaderInfo();
        }
        
        if (changes.teams) {
            console.log('🏃‍♂️ Atualizando teams...');
            await renderNextTeams();
        }
        
        if (changes.queue) {
            console.log('📋 Atualizando queue...');
            await renderQueueBlocks();
        }
        
        if (changes.reserves) {
            console.log('🪑 Atualizando reserves...');
            renderReserves();
        }
        
        // Sempre carregar estatísticas do dia (leve e importante)
        try {
            await carregarEstatisticasDia();
        } catch (statsError) {
            console.warn('⚠️ Erro ao carregar estatísticas do dia:', statsError);
        }
        
        // Atualizar estado anterior
        previousState = { ...newState, initialized: true };
        
        console.log('✅ Renderização diferencial concluída!');
    } catch (error) {
        console.error('❌ Erro na renderização diferencial:', error);
        
        // Fallback: tentar renderização básica
        try {
            console.log('🔄 Tentando renderização básica...');
            updateHeaderInfo();
            await renderNextTeams();
        } catch (fallbackError) {
            console.error('❌ Erro na renderização básica:', fallbackError);
        }
    }
}

function updateHeaderInfo() {
    const LIMITE_FILA = 30;
    const queueSize = gameState.queue.length;
    
    // Atualizar contador de jogadores
    const totalJogadores = document.getElementById('total-jogadores');
    if (totalJogadores) {
        totalJogadores.textContent = `${queueSize}/${LIMITE_FILA} jogadores`;
        
        // Adicionar classe de aviso quando próximo do limite
        if (queueSize >= LIMITE_FILA * 0.9) {
            totalJogadores.style.color = '#ff4444';
        } else if (queueSize >= LIMITE_FILA * 0.8) {
            totalJogadores.style.color = '#ff8800';
        } else {
            totalJogadores.style.color = '';
        }
    }
}

// Função para calcular estatísticas de um jogador
// Função para obter data de hoje em formato YYYY-MM-DD
function getDataHoje() {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
}

async function calcularEstatisticasJogador(jogadorId) {
    try {
        const dataHoje = getDataHoje();
        console.log(`� Calculando estatísticas do dia ${dataHoje} para jogador ${jogadorId}`);
        
        // Para estatísticas diárias, sempre calcular dos jogos do dia
        // (não usar tabela jogadores que tem estatísticas gerais)
        
        if (!gameState.sessaoAtiva) {
            return { jogos: 0, vitorias: 0, gols: 0 };
        }

        // Cache de jogos da sessão para evitar múltiplas consultas
        if (!calcularEstatisticasJogador._cachedJogos || 
            Date.now() - calcularEstatisticasJogador._cacheTimestamp > 30000) {
            
            console.log('🔄 Atualizando cache de jogos da sessão...');
            calcularEstatisticasJogador._cachedJogos = await obterJogos(gameState.sessaoAtiva.id);
            calcularEstatisticasJogador._cacheTimestamp = Date.now();
        }
        
        const jogos = calcularEstatisticasJogador._cachedJogos;
        
        // Filtrar apenas jogos do dia atual
        const jogosFinalizados = jogos.filter(j => {
            if (j.status !== 'finalizado') return false;
            
            // Converter created_at para data local e comparar
            const jogoData = new Date(j.created_at).toISOString().split('T')[0];
            return jogoData === dataHoje;
        });
        
        console.log(`📅 Encontrados ${jogosFinalizados.length} jogos finalizados do dia ${dataHoje}`);
        
        let estatisticas = {
            jogos: 0,
            vitorias: 0,
            gols: 0
        };
        
        // Calcular estatísticas dos jogos do dia
        for (const jogo of jogosFinalizados) {
            const time1 = jogo.time_a || [];
            const time2 = jogo.time_b || [];
            
            const jogouTime1 = time1.includes(jogadorId);
            const jogouTime2 = time2.includes(jogadorId);
            
            if (jogouTime1 || jogouTime2) {
                estatisticas.jogos++;
                
                if (jogo.time_vencedor) {
                    const venceuTime1 = jogo.time_vencedor === 'A' && jogouTime1;
                    const venceuTime2 = jogo.time_vencedor === 'B' && jogouTime2;
                    
                    if (venceuTime1 || venceuTime2) {
                        estatisticas.vitorias++;
                    }
                }
            }
        }
        
        // Buscar gols do dia
        const jogoIds = jogosFinalizados.map(j => j.id);
        if (jogoIds.length > 0) {
            const gols = await obterGolsJogador(jogadorId, jogoIds);
            estatisticas.gols = gols.length;
        }
        
        console.log(`📊 Estatísticas do dia para jogador ${jogadorId}:`, estatisticas);
        return estatisticas;
        
    } catch (error) {
        console.error('Erro ao calcular estatísticas:', error);
        return { jogos: 0, vitorias: 0, gols: 0 };
    }
}

// Função otimizada para obter estatísticas com cache
async function getPlayerStats(playerId) {
    // Tentar obter do cache primeiro
    let stats = getCachedStats(playerId);
    
    if (stats) {
        return stats;
    }
    
    // Se não estiver em cache, calcular e cachear
    try {
        stats = await calcularEstatisticasJogador(playerId);
        setCachedStats(playerId, stats);
        return stats;
    } catch (error) {
        console.error(`❌ Erro ao obter estatísticas do jogador ${playerId}:`, error);
        // Retornar valores padrão em caso de erro
        const defaultStats = { jogos: 0, vitorias: 0, gols: 0 };
        setCachedStats(playerId, defaultStats);
        return defaultStats;
    }
}



// ========== CACHE INTELIGENTE DE ESTATÍSTICAS ==========
// Cache otimizado com expiração temporal e invalidação inteligente
let statsCache = new Map();
const STATS_CACHE_DURATION = 60000; // 60 segundos
let lastCacheInvalidation = Date.now();

// Estrutura do cache:
// { playerId: { stats: {...}, timestamp: number, version: number } }

// Função para invalidar cache quando necessário
function shouldInvalidateCache() {
    const now = Date.now();
    // Invalidar se passou mais de 60 segundos da última invalidação
    if (now - lastCacheInvalidation > STATS_CACHE_DURATION) {
        console.log('🗑️ Cache de estatísticas expirado - invalidando...');
        statsCache.clear();
        lastCacheInvalidation = now;
        return true;
    }
    return false;
}

// Função para forçar invalidação completa do cache
function forceInvalidateCache() {
    console.log('🚀 Forçando invalidação completa do cache...');
    statsCache.clear();
    gameState.queue = null;
    gameState.reserves = null;
    lastCacheInvalidation = Date.now();
}

// Função para obter estatísticas do cache com verificação de validade
function getCachedStats(playerId) {
    const cached = statsCache.get(playerId);
    if (!cached) return null;
    
    const now = Date.now();
    // Verificar se o cache ainda é válido
    if (now - cached.timestamp < STATS_CACHE_DURATION) {
        return cached.stats;
    }
    
    // Cache expirado para este jogador
    statsCache.delete(playerId);
    return null;
}

// Função para salvar no cache
function setCachedStats(playerId, stats) {
    statsCache.set(playerId, {
        stats: stats,
        timestamp: Date.now(),
        version: 1
    });
}

// Função para renderizar os próximos times com loading e fallback (SIMPLIFICADA)
async function renderNextTeams() {
    console.log('🏃‍♂️ Iniciando renderização dos times...');
    
    // Se não há jogadores na fila, renderizar times vazios
    if (!gameState.queue || gameState.queue.length === 0) {
        console.log('⚠️ Fila vazia - renderizando times vazios');
        
        // Renderizar times vazios diretamente
        const tbody1 = document.getElementById('team1-body');
        const tbody2 = document.getElementById('team2-body');
        
        if (tbody1) {
            tbody1.innerHTML = `
                <tr class="empty-row"><td class="player-name-cell">Aguardando jogador...</td></tr>
                <tr class="empty-row"><td class="player-name-cell">Aguardando jogador...</td></tr>
                <tr class="empty-row"><td class="player-name-cell">Aguardando jogador...</td></tr>
                <tr class="empty-row"><td class="player-name-cell">Aguardando jogador...</td></tr>
                <tr class="empty-row"><td class="player-name-cell">Aguardando jogador...</td></tr>
                <tr class="empty-row"><td class="player-name-cell">Aguardando jogador...</td></tr>
            `;
        }
        
        if (tbody2) {
            tbody2.innerHTML = `
                <tr class="empty-row"><td class="player-name-cell">Aguardando jogador...</td></tr>
                <tr class="empty-row"><td class="player-name-cell">Aguardando jogador...</td></tr>
                <tr class="empty-row"><td class="player-name-cell">Aguardando jogador...</td></tr>
                <tr class="empty-row"><td class="player-name-cell">Aguardando jogador...</td></tr>
                <tr class="empty-row"><td class="player-name-cell">Aguardando jogador...</td></tr>
                <tr class="empty-row"><td class="player-name-cell">Aguardando jogador...</td></tr>
            `;
        }
        
        return;
    }
    
    console.log(`📊 Total de jogadores na fila: ${gameState.queue.length}`);
    console.log('🔍 Primeiros 12 jogadores:', gameState.queue.slice(0, 12).map(p => p.nome || p.jogador?.nome));
    
    try {
        console.log('🎯 Renderizando time 1 (posições 0-5)...');
        await renderTeamSimple(1, 0, 6);  // Time 1: posições 0-5
        
        console.log('🎯 Renderizando time 2 (posições 6-11)...');
        await renderTeamSimple(2, 6, 12); // Time 2: posições 6-11
        
        console.log('✅ Renderização dos times concluída!');
    } catch (error) {
        console.error('❌ Erro ao renderizar times:', error);
        
        // Fallback: renderizar times com erro
        const tbody1 = document.getElementById('team1-body');
        const tbody2 = document.getElementById('team2-body');
        
        if (tbody1) tbody1.innerHTML = '<tr><td class="player-name-cell">Erro ao carregar time 1...</td></tr>';
        if (tbody2) tbody2.innerHTML = '<tr><td class="player-name-cell">Erro ao carregar time 2...</td></tr>';
    }
}

// Função simplificada para renderizar um time (SEM estatísticas por enquanto)
async function renderTeamSimple(teamNumber, startIndex, endIndex) {
    const tbody = document.getElementById(`team${teamNumber}-body`);
    if (!tbody) {
        console.error(`❌ Elemento team${teamNumber}-body não encontrado`);
        return;
    }
    
    console.log(`🏃‍♂️ Renderizando time ${teamNumber}, posições ${startIndex}-${endIndex-1}`);
    
    const teamPlayers = gameState.queue.slice(startIndex, endIndex);
    
    console.log(`👥 Time ${teamNumber} players:`, teamPlayers.map(p => p.nome || p.jogador?.nome));
    
    let html = '';
    for (let i = 0; i < 6; i++) {
        const player = teamPlayers[i];
        
        if (player) {
            const playerName = player.nome || player.jogador?.nome || `Jogador ${player.jogador_id}`;
            html += `
                <tr>
                    <td class="player-name-cell">${playerName}</td>
                </tr>
            `;
        } else {
            html += `
                <tr class="empty-row">
                    <td class="player-name-cell">Aguardando jogador...</td>
                </tr>
            `;
        }
    }
    
    tbody.innerHTML = html;
    console.log(`✅ Time ${teamNumber} renderizado com ${teamPlayers.length} jogadores`);
}

// Calcular estatísticas de um jogador em background
async function calculateStatsAsync(playerId) {
    try {
        // Verificar se já não está no cache
        if (getCachedStats(playerId)) return;
        
        const stats = await calcularEstatisticasJogador(playerId);
        setCachedStats(playerId, stats);
    } catch (error) {
        console.warn('Erro ao calcular stats em background:', error);
    }
}

// Função para pré-calcular todas as estatísticas de forma otimizada
async function preCalculateStats() {
const CACHE_DURATION = 30000; // 30 segundos

// Função para limpar cache expirado
function clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of statsCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
            statsCache.delete(key);
        }
    }
}

// Função para obter stats do cache ou calcular
function getCachedStats(playerId) {
    const cached = statsCache.get(playerId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

// Função para armazenar stats no cache
function setCachedStats(playerId, stats) {
    statsCache.set(playerId, {
        data: stats,
        timestamp: Date.now()
    });
}

// Função para pré-calcular todas as estatísticas de forma otimizada
async function preCalculateStats() {
    console.log('📊 Iniciando pré-cálculo otimizado de estatísticas...');
    
    // Verificar se há jogadores na fila
    if (!gameState.queue || gameState.queue.length === 0) {
        console.log('⚠️ Não há jogadores na fila para calcular estatísticas');
        return;
    }
    
    const allPlayerIds = gameState.queue.map(p => p.jogador_id);
    console.log('👥 IDs dos jogadores na fila:', allPlayerIds);
    
    const uncachedPlayerIds = [];
    
    // Verificar quais jogadores não estão no cache ou têm cache expirado
    for (const playerId of allPlayerIds) {
        const cachedStats = getCachedStats(playerId);
        if (!cachedStats) {
            uncachedPlayerIds.push(playerId);
        }
    }
    
    console.log(`📈 Cache hit: ${allPlayerIds.length - uncachedPlayerIds.length}/${allPlayerIds.length} jogadores`);
    
    if (uncachedPlayerIds.length === 0) {
        console.log('✅ Todas as estatísticas já estão em cache!');
        return;
    }
    
    // Calcular estatísticas em lote para jogadores sem cache
    console.log(`🔄 Calculando estatísticas para ${uncachedPlayerIds.length} jogadores...`);
    
    // Processar em chunks menores para melhor responsividade
    const CHUNK_SIZE = 5;
    for (let i = 0; i < uncachedPlayerIds.length; i += CHUNK_SIZE) {
        const chunk = uncachedPlayerIds.slice(i, i + CHUNK_SIZE);
        
        // Calcular chunk em paralelo
        const promises = chunk.map(async (playerId) => {
            try {
                const stats = await calcularEstatisticasJogador(playerId);
                setCachedStats(playerId, stats);
                return { playerId, success: true };
            } catch (error) {
                console.error(`❌ Erro ao calcular estatísticas do jogador ${playerId}:`, error);
                // Cache com valores padrão em caso de erro
                setCachedStats(playerId, { jogos: 0, vitorias: 0, gols: 0 });
                return { playerId, success: false, error };
            }
        });
        
        await Promise.all(promises);
        
        // Small delay between chunks to prevent blocking
        if (i + CHUNK_SIZE < uncachedPlayerIds.length) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }
    
    console.log('✅ Pré-cálculo de estatísticas concluído!');
}

// Função para renderizar um time específico
async function renderTeam(teamNumber, startIndex, endIndex) {
    const tbody = document.getElementById(`team${teamNumber}-body`);
    if (!tbody) {
        console.error(`❌ Elemento team${teamNumber}-body não encontrado`);
        return;
    }
    
    console.log(`🏃‍♂️ Renderizando time ${teamNumber}, posições ${startIndex}-${endIndex-1}`);
    
    const teamPlayers = gameState.queue.slice(startIndex, endIndex);
    
    console.log(`👥 Time ${teamNumber} players:`, teamPlayers);
    
    // Preencher com slots vazios se necessário
    while (teamPlayers.length < 6) {
        teamPlayers.push(null);
    }
    
    let html = '';
    for (let i = 0; i < teamPlayers.length; i++) {
        const player = teamPlayers[i];
        
        if (player) {
            const playerName = player.nome || player.jogador?.nome || 'Nome não encontrado';
            html += `
                <tr>
                    <td class="player-name-cell">${playerName}</td>
                </tr>
            `;
        } else {
            html += `
                <tr class="empty-row">
                    <td class="player-name-cell">Aguardando jogador...</td>
                </tr>
            `;
        }
    }
    
    tbody.innerHTML = html;
    console.log(`✅ Time ${teamNumber} renderizado com ${teamPlayers.filter(p => p).length} jogadores`);
}

// Função para renderizar os blocos da fila de espera com loading
async function renderQueueBlocks() {
    const container = document.getElementById('queue-blocks-container');
    const queueCount = document.getElementById('queue-count');
    
    if (queueCount) {
        const remainingInQueue = Math.max(0, gameState.queue.length - 12);
        queueCount.textContent = `${remainingInQueue} aguardando`;
    }
    
    if (!container) return;
    
    // Mostrar skeleton se há muitos jogadores para processar
    if (gameState.queue.length > 12) {
        showQueueSkeleton();
        
        // Small delay to show skeleton
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Jogadores a partir da posição 13 (índice 12)
    const waitingPlayers = gameState.queue.slice(12);
    
    if (waitingPlayers.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align: center; padding: 40px;">
                <span class="emoji" style="font-size: 2rem; display: block; margin-bottom: 10px;">✅</span>
                <strong>Todos organizados!</strong><br>
                <small style="color: #666;">Próximos 12 jogadores já estão nos times</small>
            </div>
        `;
        return;
    }
    
    // Dividir jogadores em grupos de 6
    const blocks = [];
    for (let i = 0; i < waitingPlayers.length; i += 6) {
        blocks.push(waitingPlayers.slice(i, i + 6));
    }
    
    let html = '';
    blocks.forEach((block, blockIndex) => {
        const isNextUp = blockIndex === 0; // Primeiro bloco é o próximo
        
        // Definir o texto do cabeçalho
        let headerText;
        if (isNextUp) {
            headerText = 'Próximo time';
        } else {
            headerText = `${blockIndex + 1}º na fila`;
        }
        
        html += `
            <div class="queue-block ${isNextUp ? 'next-up' : ''}">
                <div class="queue-block-header">
                    <h4>${headerText}</h4>
                </div>
                <div class="queue-block-table-container">
                    <table class="queue-block-table">
                        <tbody>
        `;
        
        // Adicionar jogadores do bloco
        for (let i = 0; i < 6; i++) {
            const player = block[i];
            if (player) {
                html += `
                    <tr>
                        <td class="queue-block-player-name">${player.nome || player.jogador?.nome}</td>
                    </tr>
                `;
            } else {
                // Linha vazia para completar o time de 6
                html += `
                    <tr class="empty-row">
                        <td class="queue-block-player-name" style="color: #ccc; font-style: italic;">Aguardando jogador...</td>
                    </tr>
                `;
            }
        }
        
        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function renderReserves() {
    // Elemento removido da interface - não precisa mais renderizar reserves na tela principal
    // Reserves agora são acessadas apenas via modal
    return;
    
    if (gameState.reserves.length === 0) {
        reservesList.innerHTML = `
            <div class="empty-state">
                <span class="emoji">✅</span>
                <h3>Todos na fila!</h3>
                <p>Todos os jogadores estão jogando ou na fila</p>
            </div>
        `;
        return;
    }
    
    reservesList.innerHTML = gameState.reserves.map(player => `
        <div class="reserve-item">
            <span class="reserve-name">${player.nome}</span>
            <button class="btn-add-queue" onclick="addPlayerToQueue(${player.id})">
                Adicionar
            </button>
        </div>
    `).join('');
}

async function addPlayerToQueue(playerId) {
    try {
        const player = gameState.reserves.find(p => p.id === playerId);
        if (!player) return;
        
        // Adicionar à fila no banco
        await adicionarJogadorFila(gameState.sessaoAtiva.id, playerId);
        
        // Atualizar estado local
        gameState.reserves = gameState.reserves.filter(p => p.id !== playerId);
        gameState.queue.push({
            jogador_id: playerId,
            nome: player.nome,
            posicao_fila: gameState.queue.length + 1
        });
        
        // Re-renderizar
        renderQueue();
        renderReserves();
        
    } catch (error) {
        console.error('Erro ao adicionar jogador à fila:', error);
        showError('Erro ao adicionar jogador à fila');
    }
}

// Funções de gerenciamento de jogos removidas - serão implementadas em tela separada

function showTieModal() {
    const modal = document.getElementById('tieModal');
    const tieOptions = document.getElementById('tieOptions');
    
    // Limpar opções anteriores
    tieOptions.innerHTML = '';
    
    // Adicionar jogadores dos dois times
    const allPlayers = [...gameState.currentGame.time1, ...gameState.currentGame.time2];
    
    allPlayers.forEach(player => {
        const button = document.createElement('button');
        button.className = 'btn-secondary';
        button.style.marginBottom = '8px';
        button.onclick = () => selectTieBreaker(player.id, player.nome);
        button.innerHTML = `${player.nome} <small>(${getPlayerPosition(player.posicao)})</small>`;
        tieOptions.appendChild(button);
    });
    
    modal.style.display = 'flex';
}

async function selectTieBreaker(playerId, playerName) {
    try {
        // Determinar de qual time é o jogador
        const isTeam1 = gameState.currentGame.time1.some(p => p.id === playerId);
        const winner = isTeam1 ? 'time1' : 'time2';
        
        closeModal('tieModal');
        
        // Registrar resultado com critério de desempate
        await processGameResult(winner, playerId, playerName);
        
    } catch (error) {
        console.error('Erro ao processar desempate:', error);
        showError('Erro ao processar desempate');
    }
}

async function processGameResult(winner, tieBreakerId = null, tieBreakerName = null) {
    try {
        // Salvar resultado no banco
        await salvarResultadoJogo(
            gameState.sessaoAtiva.id,
            gameState.currentGame.gameNumber,
            winner,
            tieBreakerId
        );
        
        // Atualizar vitórias consecutivas
        const sameWinner = gameState.currentGame.lastWinner === winner;
        const newConsecutiveWins = sameWinner ? gameState.currentGame.consecutiveWins + 1 : 1;
        
        // Reorganizar fila baseado na regra
        await reorganizeQueue(winner, newConsecutiveWins);
        
        // Preparar próximo jogo
        await setupNextGame(winner, newConsecutiveWins);
        
        // Re-renderizar interface
        await renderGameInterface();
        
        // Mostrar mensagem de sucesso
        const message = tieBreakerId ? 
            `Resultado registrado! ${tieBreakerName} decidiu o jogo.` :
            `Resultado registrado! ${winner === 'time1' ? 'Time 1' : 'Time 2'} venceu.`;
        
        showSuccess(message);
        
    } catch (error) {
        console.error('Erro ao processar resultado:', error);
        throw error;
    }
}

async function reorganizeQueue(winner, consecutiveWins) {
    const losingTeam = winner === 'time1' ? gameState.currentGame.time2 : gameState.currentGame.time1;
    
    if (consecutiveWins >= 3) {
        // 3ª vitória consecutiva: time perdedor vai para o início da fila
        await moveTeamToFrontOfQueue(losingTeam);
    } else {
        // Vitória normal ou 2ª consecutiva: time perdedor vai para o final da fila
        await moveTeamToBackOfQueue(losingTeam);
    }
}

async function moveTeamToFrontOfQueue(team) {
    try {
        // Limpar fila atual
        await limparFila(gameState.sessaoAtiva.id);
        
        // Adicionar time perdedor no início
        for (let i = 0; i < team.length; i++) {
            await adicionarJogadorFila(gameState.sessaoAtiva.id, team[i].id, i + 1);
        }
        
        // Adicionar resto da fila
        for (let i = 0; i < gameState.queue.length; i++) {
            const position = i + team.length + 1;
            await adicionarJogadorFila(gameState.sessaoAtiva.id, gameState.queue[i].jogador_id, position);
        }
        
    } catch (error) {
        console.error('Erro ao mover time para início da fila:', error);
        throw error;
    }
}

async function moveTeamToBackOfQueue(team) {
    try {
        // Adicionar time perdedor no final da fila
        for (let i = 0; i < team.length; i++) {
            const position = gameState.queue.length + i + 1;
            await adicionarJogadorFila(gameState.sessaoAtiva.id, team[i].id, position);
        }
        
    } catch (error) {
        console.error('Erro ao mover time para final da fila:', error);
        throw error;
    }
}

async function setupNextGame(winner, consecutiveWins) {
    const winningTeam = winner === 'time1' ? gameState.currentGame.time1 : gameState.currentGame.time2;
    
    // Time vencedor continua jogando
    // Próximos 5 da fila entram para formar novo time adversário
    const nextPlayers = gameState.queue.slice(0, 5);
    
    if (nextPlayers.length < 5) {
        // Não há jogadores suficientes na fila
        showError('Não há jogadores suficientes na fila para o próximo jogo');
        return;
    }
    
    // Criar novo jogo
    const newGame = {
        time1: winningTeam,
        time2: nextPlayers.map(p => ({
            id: p.jogador_id,
            nome: p.nome || p.jogador?.nome,
            nivel_habilidade: p.jogador?.nivel_habilidade || 5
        })),
        gameNumber: gameState.currentGame.gameNumber + 1,
        consecutiveWins: consecutiveWins,
        lastWinner: winner
    };
    
    // Salvar novo jogo no banco
    // await criarNovoJogo_OLD(gameState.sessaoAtiva.id, newGame); // Função removida
    
    // Remover jogadores da fila que entraram no jogo
    for (const player of nextPlayers) {
        await removerJogadorFila(gameState.sessaoAtiva.id, player.jogador_id);
    }
    
    // Atualizar estado local
    gameState.currentGame = newGame;
    gameState.queue = gameState.queue.slice(5); // Remover os 5 primeiros
}

// Função removida - usando a do database.js

async function salvarResultadoJogo(sessaoId, numeroJogo, vencedor, tieBreakerId = null) {
    try {
        // Determinar o time vencedor no formato A/B
        let timeVencedor = null;
        if (vencedor === 'time1') {
            timeVencedor = 'A';
        } else if (vencedor === 'time2') {
            timeVencedor = 'B';
        }
        
        const { data, error } = await client
            .from('jogos')
            .update({
                status: 'finalizado',
                time_vencedor: timeVencedor,
                data_fim: new Date().toISOString()
            })
            .eq('sessao_id', sessaoId)
            .eq('numero_jogo', numeroJogo);
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erro ao salvar resultado:', error);
        throw error;
    }
}



function showEmptyState() {
    document.querySelector('.main').innerHTML = `
        <div class="container">
            <div class="empty-state">
                <span class="emoji">🏁</span>
                <h3>Nenhum jogo ativo</h3>
                <p>Inicie uma nova pelada na tela de sorteio</p>
                <button class="btn-primary" onclick="window.location.href='sorteio.html'">
                    <span>⚽</span>
                    <span>Ir para Sorteio</span>
                </button>
                <br><br>
                <button class="btn-secondary" onclick="criarSessaoTeste()" style="background: #ff6b35; margin-top: 10px;">
                    <span>🔧</span>
                    <span>Criar Sessão de Teste</span>
                </button>
            </div>
        </div>
    `;
}

// Função para criar sessão de teste
async function criarSessaoTeste() {
    try {
        console.log('🔧 Criando sessão de teste...');
        
        const novaSessao = {
            data_sessao: new Date().toISOString().split('T')[0],
            local: 'Campo de Teste',
            status: 'ativa'
        };
        
        const resultado = await Database.criarSessao(novaSessao);
        
        if (resultado.success) {
            console.log('✅ Sessão de teste criada:', resultado.data);
            alert('✅ Sessão de teste criada! Recarregando página...');
            location.reload();
        } else {
            console.error('❌ Erro ao criar sessão:', resultado.error);
            alert('❌ Erro ao criar sessão: ' + resultado.error);
        }
        
    } catch (error) {
        console.error('❌ Erro ao criar sessão de teste:', error);
        alert('❌ Erro: ' + error.message);
    }
}

// Funções movidas para o início do arquivo

async function endSession() {
    if (!confirm('Tem certeza que deseja encerrar a sessão? Todos os dados serão mantidos.')) {
        return;
    }
    
    try {
        // Finalizar sessão ativa
        await finalizarSessao(gameState.sessaoAtiva.id);
        
        // Redirecionar para página inicial
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Erro ao encerrar sessão:', error);
        showError('Erro ao encerrar sessão');
    }
}

async function finalizarSessao(sessaoId) {
    try {
        const { data, error } = await client
            .from('sessoes')
            .update({
                finalizada: true,
                finalizada_em: new Date().toISOString()
            })
            .eq('id', sessaoId);
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erro ao finalizar sessão:', error);
        throw error;
    }
}

// ========== SISTEMA DE GERENCIAMENTO DE JOGADORES ==========

// Estado do gerenciamento
let managementState = {
    operacao: null, // 'adicionar', 'remover', 'substituir'
    jogadorSaindo: null,
    posicaoSubstituicao: null,
    jogadoresSelecionados: []
};

// Função para mostrar opções de gerenciamento
function mostrarOpcoesGerenciamento() {
    const painel = document.getElementById('painel-gerenciamento');
    if (painel) {
        painel.style.display = painel.style.display === 'none' ? 'block' : 'none';
    }
}

// Função para mostrar painel de gerenciamento UNIFICADO
function mostrarGerenciamento() {
    // Verificar se o novo painel está disponível
    const unifiedPanel = document.querySelector('.management-content-unified');
    
    if (unifiedPanel) {
        // Usar novo painel unificado
        mostrarGerenciamentoUnificado();
    } else {
        // Fallback para painel antigo
        mostrarGerenciamentoAntigo();
    }
}

// Função do painel antigo (backup)
function mostrarGerenciamentoAntigo() {
    // Verificar permissão
    if (typeof hasActionPermission !== 'undefined' && !hasActionPermission()) {
        return;
    }
    
    const painel = document.getElementById('painel-gerenciamento');
    if (painel) {
        painel.style.display = 'flex';
        
        // Adicionar listener para fechar clicando no fundo
        painel.onclick = function(e) {
            if (e.target === painel) {
                fecharGerenciamento();
            }
        };
    }
}

// Função para fechar painel de gerenciamento
function fecharGerenciamento() {
    const painel = document.getElementById('painel-gerenciamento');
    if (painel) {
        painel.style.display = 'none';
    }
    
    // Se usando painel unificado, limpar estado
    if (unifiedManagementState && unifiedManagementState.isOpen) {
        unifiedManagementState.isOpen = false;
        unifiedManagementState.draggedElement = null;
    }
}

// Função para fechar qualquer modal
function fecharModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Não resetar estado se estamos no meio de uma substituição
    if (managementState.operacao === 'substituir' && managementState.jogadorSaindo) {
        return;
    }
    
    // Resetar estado
    managementState = {
        operacao: null,
        jogadorSaindo: null,
        posicaoSubstituicao: null,
        jogadoresSelecionados: []
    };
}

// ========== FUNCIONALIDADE ADICIONAR ==========

async function mostrarAdicionar() {
    // Verificar permissão
    if (typeof hasActionPermission !== 'undefined' && !hasActionPermission()) {
        return;
    }
    
    // Salvar estado atual dos primeiros 12 jogadores
    primeiros12Originais = gameState.queue.slice(0, 12).map(p => p.jogador_id || p.id);
    
    managementState.operacao = 'adicionar';
    fecharGerenciamento();
    
    const modal = document.getElementById('modal-adicionar');
    const lista = document.getElementById('lista-adicionar');
    
    if (!gameState.reserves || gameState.reserves.length === 0) {
        lista.innerHTML = `
            <div class="empty-state">
                <span class="emoji">🪑</span>
                <h3>Nenhuma reserva</h3>
                <p>Todos os jogadores estão na fila</p>
            </div>
        `;
    } else {
        lista.innerHTML = await renderPlayersForSelection(gameState.reserves, 'adicionar');
        adicionarEventListenersJogadores();
    }
    
    modal.style.display = 'flex';
}

async function renderPlayersForSelection(players, operacao) {
    let html = '';
    
    // Limpar cache expirado periodicamente
    clearExpiredCache();
    
    // Lazy loading de estatísticas - não pré-calcular todas
    console.log('🎯 Renderizando jogadores com lazy loading de stats...');
    
    // Processar jogadores em lotes menores para não bloquear UI
    for (let i = 0; i < players.length; i++) {
        const jogador = players[i];
        // Para remover da fila, sempre usar jogador_id, não o id do registro da fila
        const jogadorId = jogador.jogador_id || jogador.id;  // Priorizar jogador_id
        
        // Tentar cache primeiro, senão usar valores padrão
        let stats = getCachedStats(jogadorId);
        if (!stats) {
            stats = { jogos: 0, vitorias: 0, gols: 0 };
            // Calcular stats assincronamente em background se necessário
            setTimeout(() => calculateStatsAsync(jogadorId), 0);
        }
        
        const playerId = jogadorId;
        const playerName = jogador.nome || jogador.jogador?.nome;
        
        html += `
            <div class="player-item-modal" data-player-id="${playerId}" data-player-name="${playerName}" data-operacao="${operacao}">
                <div class="player-info-modal">
                    <span class="player-name-modal">${playerName}</span>
                    <span class="player-stats-modal">J:${stats.jogos} V:${stats.vitorias} G:${stats.gols}</span>
                </div>
                ${operacao === 'remover' ? `<span class="player-position-modal">${jogador.posicao_fila || gameState.queue.findIndex(p => (p.jogador_id || p.id) === playerId) + 1}</span>` : ''}
            </div>
        `;
    }
    
    return html;
}

// Função otimizada para pré-calcular estatísticas
async function preCalculateStatsForPlayers(playerIds) {
    const uncachedIds = playerIds.filter(id => !getCachedStats(id));
    
    if (uncachedIds.length === 0) {
        console.log('✅ Todas as estatísticas já estão em cache!');
        return;
    }
    
    console.log(`🔄 Calculando estatísticas para ${uncachedIds.length} jogadores em lote...`);
    
    // Calcular em paralelo para melhor performance
    const promises = uncachedIds.map(async (playerId) => {
        try {
            const stats = await calcularEstatisticasJogador(playerId);
            setCachedStats(playerId, stats);
            return stats;
        } catch (error) {
            console.error(`❌ Erro ao calcular estatísticas do jogador ${playerId}:`, error);
            const defaultStats = { jogos: 0, vitorias: 0, gols: 0 };
            setCachedStats(playerId, defaultStats);
            return defaultStats;
        }
    });
    
    await Promise.all(promises);
    console.log('✅ Pré-cálculo otimizado concluído!');
}

// ========== CLEANUP DE EVENT LISTENERS ==========
// Registro de event listeners para cleanup adequado
const eventListenerRegistry = new Map();

// Função para adicionar listener com cleanup automático
function addManagedEventListener(element, event, handler, identifier) {
    // Remove listener anterior se existir
    if (eventListenerRegistry.has(identifier)) {
        const { element: oldEl, event: oldEvent, handler: oldHandler } = eventListenerRegistry.get(identifier);
        oldEl.removeEventListener(oldEvent, oldHandler);
    }
    
    // Adiciona novo listener
    element.addEventListener(event, handler);
    eventListenerRegistry.set(identifier, { element, event, handler });
}

// Função para limpar todos os listeners
function cleanupAllEventListeners() {
    console.log('🧹 Limpando event listeners...');
    eventListenerRegistry.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
    });
    eventListenerRegistry.clear();
}

// Função para adicionar event listeners aos jogadores com cleanup
function adicionarEventListenersJogadores() {
    const playerItems = document.querySelectorAll('.player-item-modal');
    
    // Limpar listeners anteriores dos items de jogador
    playerItems.forEach((item, index) => {
        const identifier = `player-item-${index}`;
        
        // Remove listener anterior se existir
        if (eventListenerRegistry.has(identifier)) {
            const { element: oldEl, event: oldEvent, handler: oldHandler } = eventListenerRegistry.get(identifier);
            oldEl.removeEventListener(oldEvent, oldHandler);
        }
        
        // Criar novo handler
        const handler = function() {
            const playerId = this.dataset.playerId;
            const playerName = this.dataset.playerName;
            const operacao = this.dataset.operacao;
            
            selecionarJogador(playerId, playerName, operacao);
        };
        
        // Adicionar novo listener
        item.addEventListener('click', handler);
        eventListenerRegistry.set(identifier, { element: item, event: 'click', handler });
    });
}

// ========== FUNCIONALIDADE REMOVER ==========

async function mostrarRemover() {
    // Verificar permissão
    if (typeof hasActionPermission !== 'undefined' && !hasActionPermission()) {
        return;
    }
    
    // Salvar estado atual dos primeiros 12 jogadores
    primeiros12Originais = gameState.queue.slice(0, 12).map(p => p.jogador_id || p.id);
    
    managementState.operacao = 'remover';
    fecharGerenciamento();
    
    const modal = document.getElementById('modal-remover');
    const lista = document.getElementById('lista-remover');
    
    if (!gameState.queue || gameState.queue.length === 0) {
        lista.innerHTML = `
            <div class="empty-state">
                <span class="emoji">⏳</span>
                <h3>Fila vazia</h3>
                <p>Não há jogadores na fila para remover</p>
            </div>
        `;
    } else {
        lista.innerHTML = await renderPlayersForSelection(gameState.queue, 'remover');
        adicionarEventListenersJogadores();
    }
    
    modal.style.display = 'flex';
}

// ========== FUNCIONALIDADE SUBSTITUIR ==========

async function mostrarSubstituir() {
    // Verificar permissão
    if (typeof hasActionPermission !== 'undefined' && !hasActionPermission()) {
        return;
    }
    
    // Salvar estado atual dos primeiros 12 jogadores
    primeiros12Originais = gameState.queue.slice(0, 12).map(p => p.jogador_id || p.id);
    
    managementState.operacao = 'substituir';
    fecharGerenciamento();
    
    const modal = document.getElementById('modal-substituir');
    const listaSair = document.getElementById('lista-sair-fila');
    const step2 = document.getElementById('substituicao-step2');
    
    // Resetar step 2
    step2.style.display = 'none';
    managementState.jogadorSaindo = null;
    managementState.posicaoSubstituicao = null;
    
    if (!gameState.queue || gameState.queue.length === 0) {
        listaSair.innerHTML = `
            <div class="empty-state">
                <span class="emoji">⏳</span>
                <h3>Fila vazia</h3>
                <p>Não há jogadores na fila para substituir</p>
            </div>
        `;
    } else {
        listaSair.innerHTML = await renderPlayersForSelection(gameState.queue, 'substituir-sair');
        adicionarEventListenersJogadores();
    }
    
    modal.style.display = 'flex';
}

// ========== SELEÇÃO DE JOGADORES ==========

function selecionarJogador(jogadorId, nomeJogador, operacao) {
    switch (operacao) {
        case 'adicionar':
            confirmarAdicionar(jogadorId, nomeJogador);
            break;
        case 'remover':
            confirmarRemover(jogadorId, nomeJogador);
            break;
        case 'substituir-sair':
            selecionarJogadorSaindo(jogadorId, nomeJogador);
            break;
        case 'substituir-entrar':
            confirmarSubstituir(jogadorId, nomeJogador);
            break;
    }
}

function selecionarJogadorSaindo(jogadorId, nomeJogador) {
    // Encontrar posição do jogador na fila
    const posicao = gameState.queue.findIndex(p => (p.jogador_id || p.id) === jogadorId) + 1;
    
    managementState.jogadorSaindo = { id: jogadorId, nome: nomeJogador };
    managementState.posicaoSubstituicao = posicao;
    
    // Mostrar step 2
    const step2 = document.getElementById('substituicao-step2');
    const posicaoSpan = document.getElementById('posicao-substituicao');
    const jogadorSpan = document.getElementById('jogador-saindo');
    const listaEntrar = document.getElementById('lista-entrar-fila');
    
    posicaoSpan.textContent = posicao;
    jogadorSpan.textContent = nomeJogador;
    
    // Renderizar reservas para entrar
    if (gameState.reserves.length === 0) {
        listaEntrar.innerHTML = `
            <div class="empty-state">
                <span class="emoji">🪑</span>
                <h3>Nenhuma reserva</h3>
                <p>Não há jogadores na reserva</p>
            </div>
        `;
    } else {
        renderPlayersForSelection(gameState.reserves, 'substituir-entrar').then(html => {
            listaEntrar.innerHTML = html;
            adicionarEventListenersJogadores();
        });
    }
    
    step2.style.display = 'block';
}

// ========== CONFIRMAÇÕES ==========

function confirmarAdicionar(jogadorId, nomeJogador) {
    mostrarConfirmacao(
        'Adicionar Jogador',
        `<h4>➕ Adicionar à Fila</h4>
         <p><strong>${nomeJogador}</strong> será adicionado ao final da fila.</p>
         <p>Nova posição: <strong>${gameState.queue.length + 1}</strong></p>`,
        () => executarAdicionar(jogadorId)
    );
}

function confirmarRemover(jogadorId, nomeJogador) {
    const posicao = gameState.queue.findIndex(p => (p.jogador_id || p.id) === jogadorId) + 1;
    mostrarConfirmacao(
        'Remover Jogador',
        `<h4>➖ Remover da Fila</h4>
         <p><strong>${nomeJogador}</strong> será removido da posição <strong>${posicao}</strong>.</p>
         <p>Os jogadores seguintes subirão uma posição.</p>`,
        () => executarRemover(jogadorId)
    );
}

function confirmarSubstituir(jogadorEntraId, nomeJogadorEntra) {
    if (!managementState.jogadorSaindo) {
        console.error('Erro: managementState.jogadorSaindo é null');
        showError('Erro na substituição: jogador de saída não foi selecionado');
        return;
    }
    
    mostrarConfirmacao(
        'Substituir Jogadores',
        `<h4>🔄 Substituição</h4>
         <p><strong>Sai:</strong> ${managementState.jogadorSaindo.nome}</p>
         <p><strong>Entra:</strong> ${nomeJogadorEntra}</p>
         <p><strong>Posição:</strong> ${managementState.posicaoSubstituicao}</p>`,
        () => executarSubstituir(managementState.jogadorSaindo.id, jogadorEntraId)
    );
}

function mostrarConfirmacao(titulo, detalhes, callback) {
    const modal = document.getElementById('modal-confirmacao');
    const tituloEl = document.getElementById('titulo-confirmacao');
    const detalhesEl = document.getElementById('detalhes-confirmacao');
    const btnConfirmar = document.getElementById('btn-confirmar-operacao');
    
    tituloEl.textContent = titulo;
    detalhesEl.innerHTML = detalhes;
    
    // Remover listeners anteriores
    btnConfirmar.replaceWith(btnConfirmar.cloneNode(true));
    const newBtn = document.getElementById('btn-confirmar-operacao');
    newBtn.onclick = () => {
        callback();
        fecharModal('modal-confirmacao');
    };
    
    // Fechar outros modais
    fecharModal('modal-adicionar');
    fecharModal('modal-remover');
    fecharModal('modal-substituir');
    
    modal.style.display = 'flex';
}

// ========== EXECUÇÃO DAS OPERAÇÕES ==========

// Função auxiliar para verificar mudanças nos primeiros 12 após operação
async function verificarMudancaTimesPartida() {
    try {
        // Verificar se houve mudança nos primeiros 12 jogadores
        const primeiros12Atuais = gameState.queue.slice(0, 12).map(p => p.jogador_id || p.id);
        const houveMudancaNos12 = !arraysIguais(primeiros12Originais, primeiros12Atuais);
        
        // Se houve mudança nos primeiros 12, verificar se há partida ativa
        if (houveMudancaNos12) {
            const partidaAtiva = await obterJogoAtivo();
            
            if (partidaAtiva) {
                const confirmacao = confirm(`
⚠️ MUDANÇA DETECTADA NOS TIMES!

🎮 Partida em andamento: Jogo #${partidaAtiva.numero_jogo || 'Atual'}
🔄 A operação alterou os primeiros 12 jogadores da fila

Deseja atualizar os times da partida?

✅ SIM: Times serão atualizados na partida
❌ NÃO: Apenas a fila será alterada
                `);
                
                if (confirmacao) {
                    await atualizarTimesPartida(partidaAtiva.id);
                    alert('✅ Operação concluída e times da partida atualizados!');
                    return;
                }
            }
        }
        
        alert('✅ Operação concluída com sucesso!');
        
    } catch (error) {
        console.error('Erro ao verificar mudança nos times:', error);
        alert('✅ Operação concluída, mas houve erro ao verificar partida ativa.');
    }
}

async function executarAdicionar(jogadorId) {
    try {
        // Verificar limite máximo de jogadores na fila (padrão: 30)
        const LIMITE_FILA = 30;
        
        if (gameState.queue.length >= LIMITE_FILA) {
            showError(`Limite máximo de ${LIMITE_FILA} jogadores na fila foi atingido!`);
            return;
        }
        
        // Mostrar loading durante operação
        await withLoading('queue-card', async () => {
            // Adicionar jogador ao final da fila
            const proximaPosicao = gameState.queue.length + 1;
            
            await adicionarJogadorFila(gameState.sessaoAtiva.id, jogadorId, proximaPosicao);
            
            // Atualizar estado local
            await loadGameState();
            await debouncedRenderInterface();
        });
        
        // Verificar se mudança afeta partida ativa
        await verificarMudancaTimesPartida();
        
    } catch (error) {
        console.error('Erro ao adicionar jogador:', error);
        showError('Erro ao adicionar jogador à fila');
    }
}

async function executarRemover(jogadorId) {
    try {
        // Remover jogador da fila
        await removerJogadorFila(gameState.sessaoAtiva.id, jogadorId);
        
        // Reorganizar posições dos jogadores restantes
        await reorganizarFilaAposRemocao(jogadorId);
        
        // Atualizar estado local
        await loadGameState();
        await renderGameInterface();
        
        // Verificar se mudança afeta partida ativa
        await verificarMudancaTimesPartida();
        
    } catch (error) {
        console.error('Erro ao remover jogador:', error);
        showError('Erro ao remover jogador da fila');
    }
}

async function executarSubstituir(jogadorSaiId, jogadorEntraId) {
    try {
        const posicao = managementState.posicaoSubstituicao;
        
        // Remover jogador da posição
        await removerJogadorFila(gameState.sessaoAtiva.id, jogadorSaiId);
        
        // Adicionar novo jogador na mesma posição
        await adicionarJogadorFila(gameState.sessaoAtiva.id, jogadorEntraId, posicao);
        
        // Atualizar estado local
        await loadGameState();
        await renderGameInterface();
        
        // Verificar se mudança afeta partida ativa
        await verificarMudancaTimesPartida();
        
    } catch (error) {
        console.error('Erro ao substituir jogador:', error);
        showError('Erro ao realizar substituição');
    }
}

async function reorganizarFilaAposRemocao(jogadorRemovidoId) {
    try {
        // Buscar fila atual
        const fila = await obterFila(gameState.sessaoAtiva.id);
        
        // Reordenar posições
        for (let i = 0; i < fila.length; i++) {
            if (fila[i].posicao_fila !== i + 1) {
                await atualizarPosicaoFila(gameState.sessaoAtiva.id, fila[i].jogador_id, i + 1);
            }
        }
        
    } catch (error) {
        console.error('Erro ao reorganizar fila:', error);
        throw error;
    }
}

// Função auxiliar para atualizar posição na fila
async function atualizarPosicaoFila(sessaoId, jogadorId, novaPosicao) {
    try {
        if (!client) {
            client = initializeSupabase();
        }
        
        console.log(`🔄 Atualizando posição: Jogador ${jogadorId} → Posição ${novaPosicao}`);
        
        // Atualizar diretamente sem verificar se existe
        const { error } = await client
            .from('fila')
            .update({ posicao_fila: novaPosicao })
            .eq('sessao_id', sessaoId)
            .eq('jogador_id', jogadorId);
        
        if (error) {
            throw new Error(`Erro ao atualizar posição: ${error.message}`);
        }
        
        console.log(`✅ Posição atualizada: Jogador ${jogadorId} agora na posição ${novaPosicao}`);
        
    } catch (error) {
        console.error('Erro ao atualizar posição na fila:', error);
        throw error;
    }
}

// ========== FUNÇÃO PARA ENCERRAR PELADA ==========

function encerrarPelada() {
    mostrarConfirmacao(
        'Encerrar Pelada',
        `<h4>🏁 Encerrar Pelada</h4>
         <p>Tem certeza que deseja encerrar a pelada?</p>
         <p>Esta ação não pode ser desfeita.</p>`,
        () => {
            // Redirecionar para a página inicial
            window.location.href = 'index.html';
        }
    );
}

// Fechar modais ao clicar fora
document.addEventListener('click', function(event) {
    const modals = ['modal-adicionar', 'modal-remover', 'modal-substituir', 'modal-confirmacao'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            fecharModal(modalId);
        }
    });
});

// Event listener para o botão Iniciar Próxima Partida
document.addEventListener('DOMContentLoaded', function() {
    const startMatchBtn = document.getElementById('start-match-btn');
    if (startMatchBtn) {
        startMatchBtn.addEventListener('click', function() {
            iniciarProximaPartida();
        });
    }
});

// Função para iniciar próxima partida
async function iniciarProximaPartida() {
    try {
        console.log('🚀 Iniciando processo de nova partida...');
        
        // Verificar se há uma sessão ativa
        const sessao = await obterSessaoAtiva();
        console.log('📅 Sessão encontrada:', sessao);
        
        if (!sessao) {
            alert('❌ Não há sessão ativa. Inicie uma nova sessão primeiro.');
            // Redirecionar para página inicial para criar sessão
            window.location.href = 'index.html';
            return;
        }

        // Verificar se já há uma partida em andamento
        console.log('🔍 Verificando jogo ativo...');
        const jogoAtivo = await obterJogoAtivo();
        console.log('🎮 Jogo ativo:', jogoAtivo);
        
        if (jogoAtivo) {
            if (confirm('🎮 Já existe uma partida em andamento. Deseja continuar ela?')) {
                window.location.href = `partida.html?jogo_id=${jogoAtivo.id}`;
            }
            return;
        }

        // Obter times atuais da fila
        console.log('👥 Obtendo próximos times...');
        const { time1, time2 } = await obterProximosTimes();
        console.log('👥 Times obtidos:', { time1, time2 });
        
        if (!time1 || !time2) {
            alert('❌ Erro ao obter times da fila. Verifique se há jogadores suficientes.');
            return;
        }
        
        if (time1.length < 6 || time2.length < 6) {
            alert(`❌ Não há jogadores suficientes para formar os times (necessário 12 jogadores). Encontrados: ${time1.length + time2.length} jogadores.`);
            return;
        }

        // Confirmação com modal personalizado
        const confirmado = await mostrarModalIniciarPartida();
        if (confirmado) {
            console.log('✅ Usuário confirmou. Criando novo jogo...');
            
            // Criar novo jogo no banco
            const novoJogo = await criarNovoJogo(sessao.id, time1, time2);
            console.log('🎯 Novo jogo criado:', novoJogo);
            
            if (novoJogo) {
                console.log('🔄 Redirecionando para partida...');
                // Redirecionar para tela de partida
                window.location.href = `partida.html?jogo_id=${novoJogo.id}`;
            } else {
                alert('❌ Erro ao criar nova partida. Tente novamente.');
            }
        }
    } catch (error) {
        console.error('Erro ao iniciar partida:', error);
        alert('❌ Erro ao iniciar partida. Tente novamente.');
    }
}

// ========== ESTATÍSTICAS DO DIA ==========

// Função para carregar estatísticas do dia
async function carregarEstatisticasDia() {
    try {
        console.log('🔍 Carregando estatísticas do dia... [VERSÃO SIMPLIFICADA]');
        
        const dataHoje = new Date().toISOString().split('T')[0];
        console.log('📅 Data de hoje:', dataHoje);
        
        // Contar partidas do dia diretamente na tabela jogos
        const { data: jogosHoje, error: erroJogos } = await client
            .from('jogos')
            .select('id')
            .gte('created_at', dataHoje + ' 00:00:00')
            .lt('created_at', dataHoje + ' 23:59:59');
            
        if (erroJogos) throw erroJogos;
        
        const totalPartidas = jogosHoje ? jogosHoje.length : 0;
        console.log('🏆 Partidas do dia:', totalPartidas);
        
        // Contar gols do dia diretamente na tabela gols
        const { data: golsHoje, error: erroGols } = await client
            .from('gols')
            .select('id')
            .gte('created_at', dataHoje + ' 00:00:00')
            .lt('created_at', dataHoje + ' 23:59:59');
            
        if (erroGols) throw erroGols;
        
        const totalGols = golsHoje ? golsHoje.length : 0;
        console.log('⚽ Gols do dia:', totalGols);

        // Atualizar interface
        document.getElementById('total-partidas').textContent = totalPartidas;
        document.getElementById('total-gols').textContent = totalGols;
        
        console.log(`📊 Estatísticas do dia: ${totalPartidas} partidas, ${totalGols} gols`);
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas do dia:', error);
        document.getElementById('total-partidas').textContent = '0';
        document.getElementById('total-gols').textContent = '0';
    }
}

// Função movida para o início do arquivo

// Função para esconder tela sem sessão ativa
function hideNoSessionScreen() {
    const noSessionScreen = document.getElementById('no-session-screen');
    const mainContent = document.querySelector('.main');
    
    if (noSessionScreen) {
        noSessionScreen.style.display = 'none';
    }
    
    if (mainContent) {
        mainContent.style.display = 'block';
    }
}

// Função para encerrar a pelada do dia
async function encerrarPelada() {
    try {
        // Verificar permissão
        if (typeof hasActionPermission !== 'undefined' && !hasActionPermission()) {
            return;
        }
        
        if (!gameState.sessaoAtiva) {
            showError('Não há sessão ativa para encerrar');
            return;
        }

        // TELA DE SENHA PARA ENCERRAR PELADA
        const senhaCorreta = await solicitarSenhaEncerrarPelada();
        
        if (!senhaCorreta) {
            return; // Usuário cancelou ou senha incorreta
        }

        // Buscar informações da sessão atual
        const jogos = await obterJogos(gameState.sessaoAtiva.id);
        const fila = await obterFila(gameState.sessaoAtiva.id);
        const totalJogadores = fila.length;
        const partidasFinalizadas = jogos.filter(j => j.status === 'finalizado').length;

        // Buscar gols do dia para estatísticas
        const dataHoje = new Date().toISOString().split('T')[0];
        const { data: golsHoje } = await client
            .from('gols')
            .select('id')
            .gte('created_at', dataHoje + ' 00:00:00')
            .lt('created_at', dataHoje + ' 23:59:59');
        
        const totalGols = golsHoje ? golsHoje.length : 0;

        // Finalizar a sessão
        console.log('🏁 Encerrando pelada do dia...');
        const resultado = await Database.finalizarSessao(gameState.sessaoAtiva.id);

        if (resultado.success) {
            // Mostrar mensagem de sucesso
            showSuccess(`🎉 Pelada encerrada com sucesso!<br>
                        ⚽ ${partidasFinalizadas} partidas • 🥅 ${totalGols} gols • 👥 ${totalJogadores} jogadores`);
            
            // Resetar estado e redirecionar após um tempo
            gameState.sessaoAtiva = null;
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 3000);
        } else {
            showError('Erro ao encerrar a pelada: ' + resultado.error);
        }

    } catch (error) {
        console.error('Erro ao encerrar pelada:', error);
        showError('Erro ao encerrar a pelada');
    }
}

// Função para solicitar senha antes de encerrar pelada
async function solicitarSenhaEncerrarPelada() {
    return new Promise((resolve) => {
        // Criar modal de senha
        const modal = document.createElement('div');
        modal.className = 'modal-senha';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🔐 Confirmação de Segurança</h3>
                    <p>Digite sua senha de usuário para encerrar a pelada</p>
                </div>
                
                <div class="modal-body">
                    <div class="warning-box">
                        <span class="emoji">🏁</span>
                        <div>
                            <strong>ATENÇÃO:</strong>
                            <p>Isto irá finalizar definitivamente a pelada do dia.<br>
                            Todos vão para casa! 🏠</p>
                        </div>
                    </div>
                    
                    <div class="input-group">
                        <label for="senha-encerrar">Sua senha de usuário:</label>
                        <input type="password" id="senha-encerrar" placeholder="Digite sua senha" maxlength="20">
                    </div>
                </div>
                
                <div class="modal-actions">
                    <button id="btn-cancelar-encerrar" class="btn-secondary">
                        <span class="emoji">❌</span>
                        <span>Cancelar</span>
                    </button>
                    <button id="btn-confirmar-encerrar" class="btn-danger">
                        <span class="emoji">🏁</span>
                        <span>Encerrar Pelada</span>
                    </button>
                </div>
            </div>
        `;
        
        // Adicionar modal ao DOM
        document.body.appendChild(modal);
        
        // Focar no input de senha
        const inputSenha = document.getElementById('senha-encerrar');
        const btnConfirmar = document.getElementById('btn-confirmar-encerrar');
        const btnCancelar = document.getElementById('btn-cancelar-encerrar');
        
        setTimeout(() => inputSenha.focus(), 100);
        
        // Função para verificar senha
        const verificarSenha = async () => {
            const senhaDigitada = inputSenha.value.trim();
            
            // Obter dados do usuário logado
            const userData = localStorage.getItem('pelada3_user');
            if (!userData) {
                alert('Erro: Usuário não logado');
                document.body.removeChild(modal);
                resolve(false);
                return;
            }
            
            let currentUser;
            try {
                currentUser = JSON.parse(userData);
            } catch (error) {
                console.error('Erro ao ler dados do usuário:', error);
                alert('Erro: Dados de usuário inválidos');
                document.body.removeChild(modal);
                resolve(false);
                return;
            }
            
            const username = currentUser.username;
            if (!username) {
                alert('Erro: Nome de usuário não encontrado');
                document.body.removeChild(modal);
                resolve(false);
                return;
            }

            // Para admin, verificar senha fixa
            if (username === 'admin') {
                if (senhaDigitada === '4231') {
                    document.body.removeChild(modal);
                    resolve(true);
                    return;
                } else {
                    // Senha incorreta - mostrar erro
                    inputSenha.style.borderColor = '#ff4444';
                    inputSenha.style.backgroundColor = '#fff5f5';
                    inputSenha.value = '';
                    inputSenha.placeholder = '❌ Senha incorreta - Digite sua senha de usuário';
                    inputSenha.focus();
                    
                    // Resetar estilo após 3 segundos
                    setTimeout(() => {
                        inputSenha.style.borderColor = '';
                        inputSenha.style.backgroundColor = '';
                        inputSenha.placeholder = 'Digite sua senha';
                    }, 3000);
                    return;
                }
            }
                
                // Para outros usuários, verificar no banco
                try {
                    if (typeof Database === 'undefined') {
                        console.error('Database não encontrado');
                        alert('Erro: Sistema de banco não carregado');
                        document.body.removeChild(modal);
                        resolve(false);
                        return;
                    }
                    
                    // Buscar o usuário pelo username
                    const resultado = await Database.buscarUsuarioPorUsername(username);
                    
                    if (!resultado.success) {
                        console.error('Erro ao buscar usuário:', resultado.error);
                        alert('Erro ao verificar credenciais');
                        document.body.removeChild(modal);
                        resolve(false);
                        return;
                    }
                    
                    if (!resultado.data) {
                        console.error('Usuário não encontrado');
                        alert('Usuário não encontrado');
                        document.body.removeChild(modal);
                        resolve(false);
                        return;
                    }
                    
                    const senhaCorreta = resultado.data.senha;
                    
                    if (senhaDigitada === senhaCorreta) {
                        document.body.removeChild(modal);
                        resolve(true);
                    } else {
                        // Senha incorreta - mostrar erro
                        inputSenha.style.borderColor = '#ff4444';
                        inputSenha.style.backgroundColor = '#fff5f5';
                        inputSenha.value = '';
                        inputSenha.placeholder = '❌ Senha incorreta - Digite sua senha de usuário';
                        inputSenha.focus();
                        
                        // Resetar estilo após 3 segundos
                        setTimeout(() => {
                            inputSenha.style.borderColor = '';
                            inputSenha.style.backgroundColor = '';
                            inputSenha.placeholder = 'Digite sua senha';
                        }, 3000);
                    }
                } catch (error) {
                    console.error('Erro ao verificar senha:', error);
                    alert('Erro de conexão com o banco');
                    document.body.removeChild(modal);
                    resolve(false);
                }
        };
        
        // Event listeners
        btnConfirmar.addEventListener('click', verificarSenha);
        
        btnCancelar.addEventListener('click', () => {
            document.body.removeChild(modal);
            resolve(false);
        });
        
        // Enter para confirmar
        inputSenha.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                verificarSenha();
            }
        });
        
        // ESC para cancelar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                resolve(false);
            }
        });
    });
}

// ==================== EDITAR ORDEM DA FILA ====================

// Variável para armazenar os primeiros 12 jogadores antes da edição
let primeiros12Originais = [];

function mostrarEditarOrdem() {
    if (!hasActionPermission()) {
        alert('❌ Você não tem permissão para editar a ordem da fila.');
        return;
    }
    
    // Salvar estado atual dos primeiros 12 jogadores
    primeiros12Originais = gameState.queue.slice(0, 12).map(p => p.jogador_id || p.id);
    
    fecharGerenciamento();
    
    const modal = document.getElementById('modal-editar-ordem');
    const lista = document.getElementById('lista-editar-ordem');
    
    // Renderizar lista ordenável
    renderSortableList();
    
    modal.style.display = 'flex';
}

function renderSortableList() {
    const lista = document.getElementById('lista-editar-ordem');
    if (!lista) return;
    
    let html = '';
    
    gameState.queue.forEach((player, index) => {
        const isSelected = unifiedManagementState.doubleClickSelection.isActive && 
                          unifiedManagementState.doubleClickSelection.selectedIndex === index &&
                          unifiedManagementState.doubleClickSelection.selectedType === 'queue';
        
        html += `
            <div class="sortable-item ${isSelected ? 'selected-for-swap' : ''}" draggable="true" data-index="${index}" data-type="queue">
                <div class="drag-handle"></div>
                <div class="sortable-player-info" ondblclick="handlePlayerDoubleClick(${index}, 'queue')">
                    <div class="sortable-position">${index + 1}</div>
                    <div class="sortable-name">${player.nome || player.jogador?.nome}</div>
                    ${isSelected ? '<div class="swap-indicator">🔄</div>' : ''}
                </div>
            </div>
        `;
    });
    
    lista.innerHTML = html;
    
    // Adicionar eventos de drag and drop
    initSortable();
}

function initSortable() {
    const sortableItems = document.querySelectorAll('.sortable-item');
    
    sortableItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);
        item.addEventListener('dragenter', handleDragEnter);
        item.addEventListener('dragleave', handleDragLeave);
    });
}

let draggedElement = null;
let draggedIndex = null;

function handleDragStart(e) {
    draggedElement = this;
    draggedIndex = parseInt(this.dataset.index);
    
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.outerHTML);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (this !== draggedElement) {
        const dropIndex = parseInt(this.dataset.index);
        
        // Reordenar array
        movePlayerInQueue(draggedIndex, dropIndex);
        
        // Re-renderizar lista
        renderSortableList();
    }
    
    return false;
}

function handleDragEnd(e) {
    const items = document.querySelectorAll('.sortable-item');
    items.forEach(item => {
        item.classList.remove('dragging', 'drag-over');
    });
    
    draggedElement = null;
    draggedIndex = null;
}

function movePlayerInQueue(fromIndex, toIndex) {
    // Remover jogador da posição original
    const player = gameState.queue.splice(fromIndex, 1)[0];
    
    // Inserir na nova posição
    gameState.queue.splice(toIndex, 0, player);
}

async function salvarNovaOrdem() {
    try {
        console.log('🔄 Iniciando salvamento da nova ordem...');
        
        // Verificar se há sessão ativa
        if (!gameState.sessaoAtiva || !gameState.sessaoAtiva.id) {
            alert('❌ Nenhuma sessão ativa encontrada');
            return;
        }
        
        console.log('📊 Estado atual:', {
            originais: primeiros12Originais,
            atuais: gameState.queue.slice(0, 12).map(p => p.jogador_id || p.id)
        });
        
        // Verificar se houve mudança nos primeiros 12 jogadores
        const primeiros12Atuais = gameState.queue.slice(0, 12).map(p => p.jogador_id || p.id);
        const houveMudancaNos12 = !arraysIguais(primeiros12Originais, primeiros12Atuais);
        
        console.log('🔍 Houve mudança nos 12 primeiros?', houveMudancaNos12);
        
        // Se houve mudança nos primeiros 12, verificar se há partida ativa
        if (houveMudancaNos12) {
            console.log('🎮 Verificando partida ativa...');
            const partidaAtiva = await obterJogoAtivo();
            console.log('🎮 Partida ativa encontrada:', partidaAtiva);
            
            if (partidaAtiva) {
                const confirmacao = confirm(`
⚠️ ATENÇÃO: Mudança detectada nos primeiros 12 jogadores da fila!

🎮 Há uma partida em andamento (Jogo #${partidaAtiva.numero_jogo || 'Atual'})

🔄 Deseja atualizar os times da partida com os novos jogadores?

✅ SIM: Os times da partida serão atualizados
❌ NÃO: Apenas a fila será reordenada
                `);
                
                if (confirmacao) {
                    console.log('✅ Usuário confirmou atualização dos times');
                    
                    // Salvar ordem da fila
                    await salvarOrdemFila();
                    
                    // Atualizar times da partida
                    await atualizarTimesPartida(partidaAtiva.id);
                    
                    // Fechar modal
                    fecharModal('modal-editar-ordem');
                    
                    // Re-renderizar interface
                    await recarregarFila();
                    
                    alert('✅ Fila e times da partida atualizados com sucesso!');
                    return;
                } else {
                    console.log('❌ Usuário optou por não atualizar os times');
                }
            }
        }
        
        console.log('💾 Salvando apenas a ordem da fila...');
        
        // Salvamento normal (sem atualizar partida)
        await salvarOrdemFila();
        
        // Fechar modal
        fecharModal('modal-editar-ordem');
        
        // Re-renderizar interface
        await recarregarFila();
        
        alert('✅ Ordem da fila atualizada com sucesso!');
        
    } catch (error) {
        console.error('Erro ao salvar ordem:', error);
        alert('❌ Erro ao salvar a nova ordem da fila');
    }
}

// Função para salvar apenas a ordem da fila
async function salvarOrdemFila() {
    // Inicializar client se necessário
    if (!client) {
        client = initializeSupabase();
    }
    
    // Atualizar a posição de cada jogador na fila
    const updatePromises = gameState.queue.map(async (player, index) => {
        try {
            const { error } = await client
                .from('fila')
                .update({ posicao_fila: index + 1 })
                .eq('sessao_id', gameState.sessaoAtiva.id)
                .eq('jogador_id', player.jogador_id || player.id);
            
            return { error, playerId: player.jogador_id || player.id };
        } catch (error) {
            return { error, playerId: player.jogador_id || player.id };
        }
    });
    
    // Executar todas as atualizações
    const results = await Promise.all(updatePromises);
    
    // Verificar se houve algum erro
    const hasError = results.some(result => result.error);
    if (hasError) {
        console.error('Erro ao atualizar posições:', results);
        throw new Error('Erro ao salvar posições na fila');
    }
}

// Função para atualizar os times da partida ativa
async function atualizarTimesPartida(jogoId) {
    try {
        if (!client) {
            client = initializeSupabase();
        }
        
        // Pegar os novos times (primeiros 12 da fila atual)
        const time1 = gameState.queue.slice(0, 6).map(p => ({
            id: p.jogador_id || p.id,
            nome: p.nome || p.jogador?.nome
        }));
        
        const time2 = gameState.queue.slice(6, 12).map(p => ({
            id: p.jogador_id || p.id,
            nome: p.nome || p.jogador?.nome
        }));
        
        console.log('Atualizando jogo:', jogoId, 'com times:', { time1, time2 });
        
        // Atualizar o jogo com os novos times
        const { error } = await client
            .from('jogos')
            .update({
                time_a: time1,
                time_b: time2
            })
            .eq('id', jogoId);
        
        if (error) {
            console.error('Erro ao atualizar times da partida:', error);
            throw error;
        }
        
        console.log('✅ Times da partida atualizados com sucesso');
        
        // Tentar registrar a substituição no histórico (opcional)
        try {
            await registrarSubstituicao(jogoId, primeiros12Originais, gameState.queue.slice(0, 12).map(p => p.jogador_id || p.id));
        } catch (histError) {
            console.log('Aviso: Não foi possível registrar no histórico:', histError);
            // Não interrompe o fluxo principal
        }
        
    } catch (error) {
        console.error('Erro ao atualizar times da partida:', error);
        throw error;
    }
}

// Função para registrar substituições no histórico
async function registrarSubstituicao(jogoId, timesOriginais, timesAtuais) {
    try {
        if (!client) {
            client = initializeSupabase();
        }
        
        const agora = new Date().toISOString();
        
        // Tentar criar registro de substituição (se tabela existir)
        const { error } = await client
            .from('substituicoes')
            .insert({
                jogo_id: jogoId,
                momento_substituicao: agora,
                motivo: 'Alteração manual da fila durante partida'
            });
        
        if (error) {
            console.log('Tabela substituicoes não existe ou erro ao inserir:', error);
            // Salvar como comentário alternativo no console
            console.log(`📝 SUBSTITUIÇÃO REGISTRADA:
                Jogo: ${jogoId}
                Momento: ${agora}
                Times Originais: ${JSON.stringify(timesOriginais)}
                Times Atuais: ${JSON.stringify(timesAtuais)}`);
        } else {
            console.log('✅ Substituição registrada no histórico');
        }
        
    } catch (error) {
        console.log('Aviso: Erro ao registrar substituição:', error);
        // Log alternativo
        console.log(`📝 SUBSTITUIÇÃO (LOG): Jogo ${jogoId} - ${new Date().toISOString()}`);
    }
}

// Função auxiliar para comparar arrays
function arraysIguais(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((item, index) => item === arr2[index]);
}

// Event listener para o botão salvar
document.addEventListener('DOMContentLoaded', function() {
    const btnSalvar = document.getElementById('btn-salvar-ordem');
    if (btnSalvar) {
        btnSalvar.addEventListener('click', salvarNovaOrdem);
    }
    
    // Event listeners para o modal de iniciar partida
    const btnConfirmar = document.getElementById('btn-confirmar-iniciar');
    const btnCancelar = document.getElementById('btn-cancelar-iniciar');
    
    if (btnConfirmar) {
        btnConfirmar.addEventListener('click', confirmarIniciarPartida);
    }
    
    if (btnCancelar) {
        btnCancelar.addEventListener('click', fecharModalIniciarPartida);
    }
});

// Funções do modal de iniciar partida
let resolveModalIniciarPartida = null;

function mostrarModalIniciarPartida() {
    return new Promise((resolve) => {
        resolveModalIniciarPartida = resolve;
        const modal = document.getElementById('modal-iniciar-partida');
        const overlay = modal?.querySelector('.modal-overlay-iniciar');
        
        if (modal) {
            modal.style.display = 'flex';
            
            // Fechar ao clicar no overlay
            if (overlay) {
                overlay.onclick = () => {
                    fecharModalIniciarPartida();
                };
            }
        }
    });
}

function fecharModalIniciarPartida() {
    const modal = document.getElementById('modal-iniciar-partida');
    if (modal) {
        modal.style.display = 'none';
    }
    if (resolveModalIniciarPartida) {
        resolveModalIniciarPartida(false);
        resolveModalIniciarPartida = null;
    }
}

function confirmarIniciarPartida() {
    const modal = document.getElementById('modal-iniciar-partida');
    if (modal) {
        modal.style.display = 'none';
    }
    if (resolveModalIniciarPartida) {
        resolveModalIniciarPartida(true);
        resolveModalIniciarPartida = null;
    }
}

// ========== NOVO PAINEL DE GERENCIAMENTO UNIFICADO ==========

// Estado do novo painel de gerenciamento
const unifiedManagementState = {
    isOpen: false,
    originalQueue: [],
    originalReserves: [],
    workingQueue: [],
    workingReserves: [],
    draggedElement: null,
    searchTerm: '',
    previewVisible: true,
    // Sistema de duplo-clique para troca
    doubleClickSelection: {
        selectedPlayer: null,
        selectedIndex: null,
        selectedType: null, // 'queue' ou 'reserve'
        isActive: false
    },
    cache: {
        queueList: null,
        reservesList: null,
        lastUpdate: 0,
        ttl: 30000 // 30 segundos
    }
};

// Cache inteligente para listas de jogadores
function getCachedList(type) {
    const now = Date.now();
    if (now - unifiedManagementState.cache.lastUpdate > unifiedManagementState.cache.ttl) {
        unifiedManagementState.cache = {
            queueList: null,
            reservesList: null,
            lastUpdate: 0,
            ttl: 30000
        };
        return null;
    }
    return unifiedManagementState.cache[type];
}

function setCachedList(type, html) {
    unifiedManagementState.cache[type] = html;
    unifiedManagementState.cache.lastUpdate = Date.now();
}

// Função principal para mostrar o painel unificado
async function mostrarGerenciamentoUnificado() {
    console.log('📋 Abrindo modal de gerenciamento unificado...');
    
    // Verificar permissões
    if (typeof hasActionPermission !== 'undefined' && !hasActionPermission()) {
        return;
    }

    const modal = document.getElementById('gerenciamento-modal');
    if (!modal) {
        console.error('Modal de gerenciamento não encontrado!');
        return;
    }

    // Debug do gameState
    console.log('🎮 Estado atual do jogo:', {
        queue: gameState.queue,
        reserves: gameState.reserves,
        queueLength: gameState.queue?.length || 0,
        reservesLength: gameState.reserves?.length || 0
    });

    // Inicializar estado unificado
    unifiedManagementState.isOpen = true;
    unifiedManagementState.originalQueue = [...(gameState.queue || [])];
    unifiedManagementState.originalReserves = [...(gameState.reserves || [])];
    unifiedManagementState.filaLocal = [...(gameState.queue || [])];
    unifiedManagementState.reservasLocal = [...(gameState.reserves || [])];

    // Mostrar modal fullscreen
    modal.style.display = 'block';
    modal.classList.add('active');
    
    // Carregar listas
    setupUnifiedManagement();
    
    // Carregar listas
    await loadUnifiedLists();
    
    // Atualizar contadores
    updateCountersAndInterface();
    
    console.log('✅ Painel de gerenciamento carregado');
}

// Setup dos event listeners do painel unificado
function setupUnifiedManagement() {
    // Busca de jogadores
    const searchInput = document.getElementById('search-players');
    if (searchInput) {
        // Remove existing listeners
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        newSearchInput.addEventListener('input', debounce((e) => {
            unifiedManagementState.searchTerm = e.target.value.toLowerCase();
            filterPlayerLists();
        }, 300));
    }

    // Click no painel para fechar
    const painel = document.getElementById('painel-gerenciamento');
    if (painel) {
        painel.onclick = function(e) {
            if (e.target === painel) {
                fecharGerenciamento();
            }
        };
    }
}

// Carregar listas no painel unificado
async function loadUnifiedLists() {
    const reservesList = document.getElementById('reservas-list');
    const queueList = document.getElementById('fila-list');
    
    if (!reservesList || !queueList) {
        console.error('Elementos da lista não encontrados:', { reservesList, queueList });
        return;
    }

    try {
        // Sempre recarregar as listas com os dados locais
        const reservesHTML = await renderPlayersList(unifiedManagementState.reservasLocal, 'reserve');
        const queueHTML = await renderPlayersList(unifiedManagementState.filaLocal, 'queue');

        reservesList.innerHTML = reservesHTML;
        queueList.innerHTML = queueHTML;

        // Configurar botão mover inicial
        atualizarBotaoMover();

        console.log('✅ Listas carregadas:', {
            reservas: unifiedManagementState.reservasLocal.length,
            fila: unifiedManagementState.filaLocal.length
        });
        
    } catch (error) {
        console.error('Erro ao carregar listas:', error);
        reservesList.innerHTML = '<div class="loading-placeholder">Erro ao carregar reservas</div>';
        queueList.innerHTML = '<div class="loading-placeholder">Erro ao carregar fila</div>';
    }
}

// Renderizar lista de jogadores com seleção (otimizada)
async function renderPlayersList(players, type) {
    if (!players || players.length === 0) {
        return `<div class="empty-list">
            <span>${type === 'reserve' ? '🪑 Nenhuma reserva' : '📋 Fila vazia'}</span>
        </div>`;
    }

    // Usar DocumentFragment para melhor performance
    const fragment = document.createDocumentFragment();
    let html = '';
    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        const position = type === 'queue' ? i + 1 : 'R';
        
        // Extrair nome e ID baseado no tipo
        let nomeJogador, playerId;
        
        if (type === 'queue') {
            playerId = player.jogador_id;
            nomeJogador = player.jogador?.nome || 
                         player.jogador?.nome_usuario || 
                         `Jogador #${player.jogador?.id || player.jogador_id}`;
        } else {
            playerId = player.id;
            nomeJogador = player.nome || 
                         player.nome_usuario || 
                         `Jogador #${player.id}`;
        }
        
        // Atributos para drag & drop (apenas fila pode ser reordenada)
        const dragAttrs = type === 'queue' ? 
            `draggable="true" ondragstart="startDragReorder(event)" ondragover="allowDrop(event)" ondrop="dropReorder(event)"` : 
            '';
        
        html += `
        <div class="player-item ${type}-item ${type === 'queue' ? 'draggable-item' : ''}" 
             onclick="selecionarJogador('${playerId}', '${type}', ${i})" 
             data-player-id="${playerId}" 
             data-type="${type}" 
             data-position="${i}"
             ${dragAttrs}>
            <div class="player-position">${position}</div>
            <div class="player-name">${nomeJogador}</div>
        </div>`;
    }

    return html;
}

// ========== FUNÇÕES GLOBAIS DE DRAG & DROP (EVENTOS INLINE) ==========

let draggedQueueItem = null;

// Iniciar drag (função global)
function startDragReorder(event) {
    console.log('🚀 DRAG INICIADO!', event.target);
    
    const item = event.target.closest('.player-item');
    draggedQueueItem = {
        element: item,
        playerId: item.dataset.playerId,
        position: parseInt(item.dataset.position),
        type: item.dataset.type
    };
    
    item.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    
    console.log('📦 Item arrastado:', draggedQueueItem);
}

// Permitir drop (função global)
function allowDrop(event) {
    event.preventDefault();
    const targetItem = event.target.closest('.player-item');
    if (targetItem && targetItem.dataset.type === 'queue' && draggedQueueItem) {
        // Limpar highlights anteriores
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        // Adicionar highlight
        targetItem.classList.add('drag-over');
    }
}

// Executar drop (função global)
function dropReorder(event) {
    event.preventDefault();
    console.log('📥 DROP EXECUTADO!');
    
    const targetItem = event.target.closest('.player-item');
    if (!targetItem || !draggedQueueItem) {
        console.warn('⚠️ Sem target ou item arrastado');
        cleanupReorderDrag();
        return;
    }
    
    const targetPosition = parseInt(targetItem.dataset.position);
    
    if (draggedQueueItem.type === 'queue' && targetItem.dataset.type === 'queue' && draggedQueueItem.position !== targetPosition) {
        console.log(`🔄 REORDENANDO: posição ${draggedQueueItem.position + 1} → ${targetPosition + 1}`);
        reorderQueue(draggedQueueItem.position, targetPosition);
    }
    
    cleanupReorderDrag();
}

// Limpeza do drag
function cleanupReorderDrag() {
    document.querySelectorAll('.dragging, .drag-over').forEach(el => {
        el.classList.remove('dragging', 'drag-over');
    });
    draggedQueueItem = null;
    console.log('🧹 Drag limpo');
}

// Adicionar evento global quando documento carrega
window.startDragReorder = startDragReorder;
window.allowDrop = allowDrop;
window.dropReorder = dropReorder;

function handleDragStart(event) {
    console.log('🚀 DRAG START ATIVADO!', event.target);
    
    reorderDraggedElement = {
        element: event.target,
        playerId: event.target.dataset.playerId,
        position: parseInt(event.target.dataset.position),
        type: event.target.dataset.type
    };
    
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    
    console.log('🚀 Drag iniciado - reordenar fila:', reorderDraggedElement);
}

function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    
    const targetItem = event.target.closest('.player-item');
    if (targetItem && targetItem.dataset.type === 'queue' && reorderDraggedElement) {
        // Remover highlight anterior
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        // Adicionar highlight atual
        targetItem.classList.add('drag-over');
    }
}

function handleDrop(event) {
    event.preventDefault();
    
    const targetElement = event.target.closest('.player-item');
    if (!targetElement || !reorderDraggedElement) return;
    
    const targetType = targetElement.dataset.type;
    const targetPosition = parseInt(targetElement.dataset.position);
    
    // Apenas permitir reordenar dentro da fila
    if (reorderDraggedElement.type !== 'queue' || targetType !== 'queue') {
        console.log('⚠️ Reordenação apenas permitida dentro da fila');
        cleanupDrag();
        return;
    }
    
    if (reorderDraggedElement.position !== targetPosition) {
        console.log(`🔄 Reordenando fila: posição ${reorderDraggedElement.position + 1} → ${targetPosition + 1}`);
        reorderQueue(reorderDraggedElement.position, targetPosition);
    }
    
    cleanupDrag();
}

// Configurar eventos de drag & drop
function setupDragEvents() {
    console.log('🔍 DEBUG: Iniciando setupDragEvents...');
    
    // Verificar se há elementos dragáveis
    const allDraggableItems = document.querySelectorAll('.draggable-item');
    const queueDraggableItems = document.querySelectorAll('.draggable-item[data-type="queue"]');
    
    console.log('🔍 DEBUG: Elementos encontrados:', {
        totalDraggable: allDraggableItems.length,
        queueDraggable: queueDraggableItems.length,
        allItems: document.querySelectorAll('.player-item').length
    });
    
    // Log dos elementos encontrados
    queueDraggableItems.forEach((item, index) => {
        console.log(`🔍 Item ${index}:`, {
            id: item.dataset.playerId,
            position: item.dataset.position,
            draggable: item.getAttribute('draggable'),
            hasClass: item.classList.contains('draggable-item')
        });
    });
    
    // Remover eventos antigos
    document.querySelectorAll('.draggable-item').forEach(item => {
        item.removeEventListener('dragstart', handleDragStart);
        item.removeEventListener('dragover', handleDragOver);
        item.removeEventListener('drop', handleDrop);
        item.removeEventListener('dragend', cleanupDrag);
    });
    
    // Adicionar novos eventos apenas para fila
    queueDraggableItems.forEach((item, index) => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', cleanupDrag);
        
        console.log(`✅ Eventos adicionados ao item ${index}: ${item.querySelector('.player-name').textContent}`);
    });
    
    console.log(`✅ setupDragEvents concluído: ${queueDraggableItems.length} itens configurados`);
}

function cleanupDrag() {
    document.querySelectorAll('.dragging, .drag-over').forEach(el => {
        el.classList.remove('dragging', 'drag-over');
    });
    reorderDraggedElement = null;
}

// Reordenar fila
async function reorderQueue(fromIndex, toIndex) {
    try {
        console.log(`🔄 Iniciando reordenação: ${fromIndex + 1} → ${toIndex + 1}`);
        
        // Verificar se índices são válidos
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= unifiedManagementState.filaLocal.length || toIndex >= unifiedManagementState.filaLocal.length) {
            console.error('❌ Índices inválidos para reordenação');
            return;
        }
        
        // Salvar ordem anterior para possível rollback
        const oldOrder = [...unifiedManagementState.filaLocal];
        
        // Mover elemento
        const [movedPlayer] = unifiedManagementState.filaLocal.splice(fromIndex, 1);
        unifiedManagementState.filaLocal.splice(toIndex, 0, movedPlayer);
        
        // Atualizar posições de todos os jogadores
        unifiedManagementState.filaLocal.forEach((player, index) => {
            player.posicao_fila = index + 1;
        });
        
        // Atualizar também no gameState global
        gameState.queue = [...unifiedManagementState.filaLocal];
        
        console.log(`✅ Fila reordenada localmente: ${movedPlayer.jogador?.nome} movido para posição ${toIndex + 1}`);
        
        // Recarregar interface imediatamente
        await loadUnifiedLists();
        updateCountersAndInterface();
        
        // Salvar no banco as novas posições
        try {
            console.log('💾 Salvando reordenação no banco...');
            await salvarOrdemFila();
            console.log('✅ Reordenação salva no banco com sucesso!');
        } catch (saveError) {
            console.warn('⚠️ Erro ao salvar no banco, mantendo ordem local:', saveError);
            // Mantém a ordem local mesmo se não conseguir salvar
        }
        
    } catch (error) {
        console.error('❌ Erro ao reordenar fila:', error);
        showError('Erro ao reordenar fila');
        // Recarregar para reverter em caso de erro crítico
        await loadUnifiedLists();
    }
}

// Estado da seleção
const selectionState = {
    selectedPlayerId: null,
    selectedType: null, // 'queue' ou 'reserve'
    selectedIndex: null
};

// Selecionar jogador
function selecionarJogador(playerId, type, index) {
    console.log('👆 Selecionando jogador:', { playerId, type, index });
    
    // Remover seleção anterior
    document.querySelectorAll('.player-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Se o mesmo jogador foi clicado, desselecionar
    if (selectionState.selectedPlayerId === playerId) {
        selectionState.selectedPlayerId = null;
        selectionState.selectedType = null;
        selectionState.selectedIndex = null;
        atualizarBotaoMover();
        return;
    }
    
    // Selecionar novo jogador
    selectionState.selectedPlayerId = playerId;
    selectionState.selectedType = type;
    selectionState.selectedIndex = index;
    
    // Marcar visualmente
    const playerElement = document.querySelector(`[data-player-id="${playerId}"][data-type="${type}"]`);
    if (playerElement) {
        playerElement.classList.add('selected');
    }
    
    // Atualizar botão
    atualizarBotaoMover();
    
    console.log('✅ Jogador selecionado:', selectionState);
}

// Atualizar estado do botão mover
function atualizarBotaoMover() {
    const btnMover = document.getElementById('btn-mover-jogador');
    if (!btnMover) return;
    
    if (selectionState.selectedPlayerId) {
        btnMover.disabled = false;
        
        const nomeJogador = obterNomeJogadorSelecionado();
        if (selectionState.selectedType === 'reserve') {
            // Da reserva para fila - seta aponta para direita (fila)
            btnMover.innerHTML = `⬅️ ${nomeJogador} CHEGOU`;
        } else {
            // Da fila para reserva - seta aponta para esquerda (reserva)  
            btnMover.innerHTML = `➡️ ${nomeJogador} SAIU`;
        }
    } else {
        btnMover.disabled = true;
        btnMover.innerHTML = '↔️ Selecione um Jogador';
    }
}

// Obter nome do jogador selecionado
function obterNomeJogadorSelecionado() {
    if (!selectionState.selectedPlayerId) return '';
    
    if (selectionState.selectedType === 'reserve') {
        const player = unifiedManagementState.reservasLocal.find(p => p.id === selectionState.selectedPlayerId);
        return player?.nome || player?.nome_usuario || 'Jogador';
    } else {
        const player = unifiedManagementState.filaLocal.find(p => p.jogador_id === selectionState.selectedPlayerId);
        return player?.jogador?.nome || player?.jogador?.nome_usuario || 'Jogador';
    }
}

// Executar movimento do jogador selecionado
async function moverJogadorSelecionado() {
    if (!selectionState.selectedPlayerId) {
        showError('Nenhum jogador selecionado');
        return;
    }
    
    console.log('🚀 Executando movimento:', selectionState);
    
    try {
        if (selectionState.selectedType === 'reserve') {
            await moverReservaParaFila(selectionState.selectedPlayerId);
        } else {
            await moverFilaParaReserva(selectionState.selectedPlayerId);
        }
        
        // Limpar seleção após movimento
        selectionState.selectedPlayerId = null;
        selectionState.selectedType = null;
        selectionState.selectedIndex = null;
        atualizarBotaoMover();
        
    } catch (error) {
        console.error('❌ Erro no movimento:', error);
        showError(`Erro: ${error.message}`);
    }
}

// Mover jogador da reserva para fila
async function moverReservaParaFila(playerId) {
    console.log('➡️ Movendo reserva para fila:', playerId);
    
    try {
        // Encontrar jogador na reserva
        const playerIndex = unifiedManagementState.reservasLocal.findIndex(p => p.id == playerId);
        if (playerIndex === -1) {
            showError('Jogador não encontrado na reserva');
            return;
        }
        
        const player = unifiedManagementState.reservasLocal[playerIndex];
        console.log('👤 Jogador encontrado:', player);
        
        // Remover da reserva
        unifiedManagementState.reservasLocal.splice(playerIndex, 1);
        
        // Criar estrutura para fila
        const newPosition = unifiedManagementState.filaLocal.length + 1;
        const filaPlayer = {
            jogador_id: playerId,
            posicao_fila: newPosition,
            status_fila: 'fila',
            sessao_id: gameState.sessaoAtiva.id,
            jogador: {
                id: player.id,
                nome: player.nome || player.nome_usuario,
                nome_usuario: player.nome_usuario,
                nivel_habilidade: player.nivel_habilidade || 3
            }
        };
        
        // Adicionar à fila
        unifiedManagementState.filaLocal.push(filaPlayer);
        
        console.log('📋 Estrutura criada:', filaPlayer);
        
        // Recarregar listas
        await loadUnifiedLists();
        updateCountersAndInterface();
        
        // Salvar no banco
        await adicionarJogadorFila(gameState.sessaoAtiva.id, playerId, newPosition);
        
        // Atualizar gameState global
        await updateGlobalGameState();
        
        showSuccess(`✅ ${player.nome || player.nome_usuario} adicionado à fila!`);
        
    } catch (error) {
        console.error('❌ Erro:', error);
        showError(`Erro ao mover jogador: ${error.message}`);
        // Recarregar para reverter mudanças
        await loadUnifiedLists();
    }
}

// Mover jogador da fila para reserva
async function moverFilaParaReserva(playerId) {
    console.log('⬅️ Movendo fila para reserva:', playerId);
    
    try {
        // Encontrar jogador na fila
        const playerIndex = unifiedManagementState.filaLocal.findIndex(p => p.jogador_id == playerId);
        if (playerIndex === -1) {
            showError('Jogador não encontrado na fila');
            return;
        }
        
        const player = unifiedManagementState.filaLocal[playerIndex];
        console.log('👤 Jogador encontrado:', player);
        
        // Remover da fila
        unifiedManagementState.filaLocal.splice(playerIndex, 1);
        
        // Atualizar posições dos jogadores restantes
        unifiedManagementState.filaLocal.forEach((p, index) => {
            p.posicao_fila = index + 1;
        });
        
        // Criar estrutura para reserva
        const reservaPlayer = {
            id: player.jogador.id,
            nome: player.jogador.nome,
            nome_usuario: player.jogador.nome_usuario,
            nivel_habilidade: player.jogador.nivel_habilidade || 3,
            sessao_id: gameState.sessaoAtiva.id
        };
        
        // Adicionar às reservas
        unifiedManagementState.reservasLocal.push(reservaPlayer);
        
        console.log('📋 Estrutura criada:', reservaPlayer);
        
        // Recarregar listas
        await loadUnifiedLists();
        updateCountersAndInterface();
        
        // Salvar no banco
        await removerJogadorFila(gameState.sessaoAtiva.id, playerId);
        
        // Atualizar gameState global
        await updateGlobalGameState();
        
        showSuccess(`✅ ${player.jogador.nome} movido para reserva!`);
        
    } catch (error) {
        console.error('❌ Erro:', error);
        showError(`Erro ao mover jogador: ${error.message}`);
        // Recarregar para reverter mudanças
        await loadUnifiedLists();
    }
}

// Funções auxiliares
function showSuccess(message) {
    console.log('✅', message);
    alert(message); // Substituir por toast/notification depois
}

function showError(message) {
    console.error('❌', message);
    alert('Erro: ' + message); // Substituir por toast/notification depois
}

// Atualizar gameState global
async function updateGlobalGameState() {
    try {
        console.log('🔄 Atualizando gameState global...');
        await loadGameState();
        await renderGameInterface();
        
        // Sincronizar estado local
        unifiedManagementState.originalQueue = [...(gameState.queue || [])];
        unifiedManagementState.originalReserves = [...(gameState.reserves || [])];
        unifiedManagementState.filaLocal = [...(gameState.queue || [])];
        unifiedManagementState.reservasLocal = [...(gameState.reserves || [])];
        
        console.log('✅ GameState atualizado!');
    } catch (error) {
        console.error('❌ Erro ao atualizar gameState:', error);
    }
}
async function renderDragPlayersList(players, type) {
    if (!players || players.length === 0) {
        return `<div class="drop-zone">
            <span>${type === 'reserve' ? '🪑 Nenhuma reserva' : '📋 Fila vazia'}</span>
        </div>`;
    }

    console.log(`🎮 Renderizando ${type}:`, players); // Debug

    let html = '';
    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        const position = type === 'queue' ? i + 1 : 'R';
        
        // Para fila, o nome está em player.jogador.nome
        // Para reservas, o nome está diretamente em player.nome
        let nomeJogador;
        
        if (type === 'queue' && player.jogador) {
            // Estrutura da fila: { jogador_id, posicao_fila, jogador: { id, nome, ... } }
            nomeJogador = player.jogador.nome || player.jogador.nome_usuario || `Jogador #${player.jogador.id}`;
        } else {
            // Estrutura das reservas: { id, nome, nome_usuario, ... }
            nomeJogador = player.nome || 
                         player.nome_usuario || 
                         player.nome_completo || 
                         player.apelido || 
                         `Jogador #${player.id}`;
        }
        
        console.log(`🔍 Jogador ${i} (${type}):`, {
            player: player,
            nomeEncontrado: nomeJogador,
            estrutura: type === 'queue' ? 'fila-aninhada' : 'reserva-direta'
        });
        
        html += `
        <div class="drag-player-item ${type}-item" 
             draggable="true" 
             ondblclick="handlePlayerDoubleClick(${i}, '${type}')"
             data-player-id="${type === 'queue' ? player.jogador_id : player.id}"
             data-type="${type}"
             data-position="${i}">
            <div class="player-position">${position}</div>
            <div class="player-name">${nomeJogador}</div>
        </div>`;
    }

    return html;
}

// Setup de drag & drop
function setupDragAndDrop() {
    // Drag start para items dos jogadores
    document.querySelectorAll('.drag-player-item').forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });

    // Drop zones para as colunas
    document.querySelectorAll('.players-list').forEach(zone => {
        zone.addEventListener('dragover', handleDragOver);
        zone.addEventListener('drop', handleDrop);
        zone.addEventListener('dragenter', handleDragEnter);
        zone.addEventListener('dragleave', handleDragLeave);
    });
    
    // Drop em items específicos para reordenação dentro da fila
    document.querySelectorAll('.drag-player-item').forEach(item => {
        item.addEventListener('dragover', handleItemDragOver);
        item.addEventListener('drop', handleItemDrop);
    });
}

function handleDragStart(e) {
    const item = e.target;
    unifiedManagementState.draggedElement = {
        playerId: item.dataset.playerId,
        type: item.dataset.type,
        position: parseInt(item.dataset.position),
        element: item
    };
    
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    unifiedManagementState.draggedElement = null;
    
    // Remover classes de drag over
    document.querySelectorAll('.drop-zone.drag-over').forEach(zone => {
        zone.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    if (e.target.classList.contains('player-list-drag') || e.target.classList.contains('drop-zone')) {
        e.target.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
        e.currentTarget.classList.remove('drag-over');
    }
}

// Drag over em items específicos (para reordenação)
function handleItemDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!unifiedManagementState.draggedElement) return;
    
    const targetItem = e.currentTarget;
    const targetType = targetItem.dataset.type;
    const sourceType = unifiedManagementState.draggedElement.type;
    
    // Só permitir reordenação dentro da mesma lista
    if (sourceType === targetType && sourceType === 'queue') {
        e.dataTransfer.dropEffect = 'move';
        targetItem.classList.add('drag-over-item');
    }
}

// Drop em items específicos (para reordenação)
async function handleItemDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const targetItem = e.currentTarget;
    targetItem.classList.remove('drag-over-item');
    
    if (!unifiedManagementState.draggedElement) return;
    
    const sourceType = unifiedManagementState.draggedElement.type;
    const targetType = targetItem.dataset.type;
    const sourcePosition = unifiedManagementState.draggedElement.position;
    const targetPosition = parseInt(targetItem.dataset.position);
    
    // Só permitir reordenação dentro da fila
    if (sourceType !== 'queue' || targetType !== 'queue') return;
    if (sourcePosition === targetPosition) return;
    
    console.log(`🔄 Reordenando fila: posição ${sourcePosition + 1} → ${targetPosition + 1}`);
    
    // Realizar reordenação
    await reorderQueue(sourcePosition, targetPosition);
}

async function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    if (!unifiedManagementState.draggedElement) return;

    const targetZone = e.currentTarget;
    const sourceType = unifiedManagementState.draggedElement.type;
    
    // Determinar tipo de destino baseado nas classes da zona
    let targetType;
    if (targetZone.id === 'fila-list' || targetZone.closest('.fila-section')) {
        targetType = 'queue';
    } else if (targetZone.id === 'reservas-list' || targetZone.closest('.reservas-section')) {
        targetType = 'reserve';
    } else {
        return; // Zona não reconhecida
    }
    
    // Se não houve mudança de tipo, ignorar (reordenação é tratada em handleItemDrop)
    if (sourceType === targetType) return;
    
    const playerId = unifiedManagementState.draggedElement.playerId;
    const player = findPlayerById(playerId);
    
    if (!player) return;

    console.log(`📋 Movendo jogador: ${sourceType} → ${targetType}`, player);

    // Realizar a operação
    if (sourceType === 'reserve' && targetType === 'queue') {
        // Mover da reserva para fila
        await movePlayerReserveToQueue(player);
    } else if (sourceType === 'queue' && targetType === 'reserve') {
        // Mover da fila para reserva
        await movePlayerQueueToReserve(player);
    }
}

async function movePlayerReserveToQueue(player) {
    const playerId = player.jogador_id || player.id;
    
    console.log('🔄 Movendo jogador da reserva para fila:', {
        player: player,
        playerId: playerId,
        nome: player.jogador?.nome || player.nome
    });
    
    // Remover da reserva local
    unifiedManagementState.reservasLocal = unifiedManagementState.reservasLocal
        .filter(p => (p.jogador_id || p.id) !== playerId);
    
    // Adicionar à fila local no final
    const newPosition = unifiedManagementState.filaLocal.length;
    unifiedManagementState.filaLocal.push(player);
    
    console.log(`📋 Jogador adicionado à fila na posição ${newPosition + 1}`);
    
    // Recarregar listas
    await reloadListsAfterChange();
    
    // Auto-salvar a mudança imediatamente
    console.log('💾 Tentando auto-salvar mudança...');
    try {
        await adicionarJogadorFila(
            gameState.sessaoAtiva.id,
            playerId,
            newPosition + 1
        );
        
        console.log('✅ Mudança salva automaticamente!');
        showSuccess(`✅ ${player.jogador?.nome || player.nome} adicionado à fila!`);
        
    } catch (error) {
        console.error('❌ Erro no auto-save:', error);
        console.log('⚠️ Mudança mantida para salvamento manual');
        showError('Erro ao salvar. Use o botão "Aplicar" para tentar novamente.');
    }
}

async function movePlayerQueueToReserve(player) {
    const playerId = player.jogador_id || player.id;
    
    console.log('🔄 Movendo jogador da fila para reserva:', {
        player: player,
        playerId: playerId,
        nome: player.jogador?.nome || player.nome
    });
    
    // Encontrar posição na fila
    const oldPosition = unifiedManagementState.filaLocal.findIndex(
        p => (p.jogador_id || p.id) === playerId
    );
    
    // Remover da fila local
    unifiedManagementState.filaLocal = unifiedManagementState.filaLocal
        .filter(p => (p.jogador_id || p.id) !== playerId);
    
    // Adicionar às reservas locais
    unifiedManagementState.reservasLocal.push(player);
    
    console.log(`📋 Jogador removido da fila (posição ${oldPosition + 1}) e adicionado às reservas`);
    
    // Recarregar listas
    await reloadListsAfterChange();
    
    // Auto-salvar a mudança imediatamente
    console.log('💾 Tentando auto-salvar remoção...');
    try {
        await removerJogadorFila(
            gameState.sessaoAtiva.id,
            playerId
        );
        
        console.log('✅ Remoção salva automaticamente!');
        showSuccess(`✅ ${player.jogador?.nome || player.nome} movido para reserva!`);
        
    } catch (error) {
        console.error('❌ Erro no auto-save da remoção:', error);
        console.log('⚠️ Mudança mantida para salvamento manual');
        showError('Erro ao salvar. Use o botão "Aplicar" para tentar novamente.');
    }
}

// Recarregar listas após mudanças
async function reloadListsAfterChange() {
    // Recarregar listas
    await loadUnifiedLists();
    
    // Atualizar contadores e interface
    updateCountersAndInterface();
}

// Atualizar contadores e interface
function updateCountersAndInterface() {
    const reservesCount = document.getElementById('reservas-count');
    const queueCount = document.getElementById('fila-count');
    
    if (reservesCount) reservesCount.textContent = `(${unifiedManagementState.reservasLocal.length})`;
    if (queueCount) queueCount.textContent = `(${unifiedManagementState.filaLocal.length})`;
}

// Utilitários
function findPlayerById(playerId) {
    return [...unifiedManagementState.filaLocal, ...unifiedManagementState.reservasLocal]
        .find(p => (p.jogador_id || p.id) == playerId);
}

function filterPlayerLists() {
    // TODO: Implementar filtro por nome
    console.log('Filtrar por:', unifiedManagementState.searchTerm);
}

// Funções dos botões
function undoLastChange() {
    if (unifiedManagementState.changes.length === 0) return;
    
    const lastChange = unifiedManagementState.changes.pop();
    
    // Reverter a operação
    if (lastChange.type === 'add_to_queue') {
        // Reverter: remover da fila e voltar para reserva
        const playerId = lastChange.player.jogador_id || lastChange.player.id;
        unifiedManagementState.workingQueue = unifiedManagementState.workingQueue
            .filter(p => (p.jogador_id || p.id) !== playerId);
        unifiedManagementState.workingReserves.push(lastChange.player);
    } else if (lastChange.type === 'remove_from_queue') {
        // Reverter: remover da reserva e voltar para fila
        const playerId = lastChange.player.jogador_id || lastChange.player.id;
        unifiedManagementState.workingReserves = unifiedManagementState.workingReserves
            .filter(p => (p.jogador_id || p.id) !== playerId);
        // Inserir na posição correta (lastChange.oldPosition - 1)
        const insertIndex = Math.min(lastChange.oldPosition - 1, unifiedManagementState.workingQueue.length);
        unifiedManagementState.workingQueue.splice(insertIndex, 0, lastChange.player);
    }
    
    reloadListsAfterChange();
}

function clearAllChanges() {
    // Restaurar estado original
    unifiedManagementState.workingQueue = [...unifiedManagementState.originalQueue];
    unifiedManagementState.workingReserves = [...unifiedManagementState.originalReserves];
    unifiedManagementState.changes = [];
    
    reloadListsAfterChange();
}

async function applyAllChanges() {
    if (unifiedManagementState.changes.length === 0) return;
    
    try {
        const btnApply = document.getElementById('btn-apply');
        if (btnApply) {
            btnApply.disabled = true;
            btnApply.textContent = '⏳ Aplicando...';
        }
        
        // Aplicar mudanças no servidor
        for (const change of unifiedManagementState.changes) {
            if (change.type === 'add_to_queue') {
                await adicionarJogadorFila(gameState.sessaoAtiva.id, 
                    change.player.jogador_id || change.player.id, 
                    change.newPosition);
            } else if (change.type === 'remove_from_queue') {
                await removerJogadorFila(gameState.sessaoAtiva.id, 
                    change.player.jogador_id || change.player.id);
            }
        }
        
        // Atualizar estado global
        await loadGameState();
        await renderGameInterface();
        
        // Fechar painel
        fecharGerenciamento();
        
        alert(`✅ ${unifiedManagementState.changes.length} mudanças aplicadas com sucesso!`);
        
    } catch (error) {
        console.error('Erro ao aplicar mudanças:', error);
        showError('Erro ao aplicar mudanças. Tente novamente.');
        
        const btnApply = document.getElementById('btn-apply');
        if (btnApply) {
            btnApply.disabled = false;
            btnApply.textContent = '✅ Aplicar Mudanças';
        }
    }
}

// =============================================
// FUNÇÕES DOS BOTÕES DO MODAL UNIFICADO
// =============================================

// Desfazer última ação
// Limpar toda a fila
async function limparFila() {
    if (unifiedManagementState.filaLocal.length === 0) {
        showError('A fila já está vazia.');
        return;
    }

    const confirmacao = confirm(`Tem certeza que deseja limpar toda a fila?\n\n${unifiedManagementState.filaLocal.length} jogadores serão movidos para reservas.`);
    
    if (!confirmacao) return;

    try {
        // Mover todos da fila para reservas
        const jogadoresDaFila = [...unifiedManagementState.filaLocal];
        
        // Limpar fila local
        unifiedManagementState.filaLocal = [];
        
        // Adicionar todos às reservas
        for (const jogador of jogadoresDaFila) {
            unifiedManagementState.reservasLocal.push(jogador);
        }
        
        // Recarregar listas
        await reloadListsAfterChange();
        
        // Atualizar botão desfazer
        const btnDesfazer = document.querySelector('.btn-desfazer');
        if (btnDesfazer) {
            btnDesfazer.disabled = false;
        }
        
        console.log('✅ Fila limpa:', jogadoresDaFila.length, 'jogadores movidos para reservas');
        
    } catch (error) {
        console.error('Erro ao limpar fila:', error);
        showError('Erro ao limpar a fila.');
    }
}

// Aplicar todas as alterações


// Fechar modal de gerenciamento unificado
async function fecharGerenciamentoUnificado() {
    console.log('🔄 Fechando modal de gerenciamento...');
    const modal = document.getElementById('gerenciamento-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        
        // Limpar estado local
        unifiedManagementState.reservasLocal = [];
        unifiedManagementState.filaLocal = [];
        
        console.log('✅ Recarregando página para atualizar visualização...');
        // Recarregar a página para garantir visualização das mudanças
        window.location.reload();
    }
}

// ========== SISTEMA DE DUPLO-CLIQUE PARA TROCA ========== 

// Função para lidar com duplo-clique nos jogadores
function handlePlayerDoubleClick(index, type) {
    console.log('👆👆 Duplo-clique detectado:', { index, type });
    
    const selection = unifiedManagementState.doubleClickSelection;
    
    // Se já há uma seleção e clicou no mesmo jogador, desselecionar
    if (selection.isActive && selection.selectedIndex === index && selection.selectedType === type) {
        clearDoubleClickSelection();
        return;
    }
    
    // Se não há seleção, selecionar este jogador
    if (!selection.isActive) {
        selectPlayerForSwap(index, type);
        return;
    }
    
    // Se há seleção e clicou em outro jogador, propor troca
    if (selection.isActive && (selection.selectedIndex !== index || selection.selectedType !== type)) {
        proposePlayerSwap(selection.selectedIndex, selection.selectedType, index, type);
        return;
    }
}

// Selecionar jogador para troca
function selectPlayerForSwap(index, type) {
    const selection = unifiedManagementState.doubleClickSelection;
    const list = type === 'queue' ? unifiedManagementState.filaLocal : unifiedManagementState.reservasLocal;
    const player = list[index];
    
    selection.selectedPlayer = player;
    selection.selectedIndex = index;
    selection.selectedType = type;
    selection.isActive = true;
    
    console.log('✅ Jogador selecionado para troca:', player.nome);
    
    // Atualizar interface
    refreshManagementLists();
    
    // Mostrar feedback visual
    showSwapSelectionFeedback(player.nome, index + 1, type);
}

// Limpar seleção
function clearDoubleClickSelection() {
    const selection = unifiedManagementState.doubleClickSelection;
    
    selection.selectedPlayer = null;
    selection.selectedIndex = null;
    selection.selectedType = null;
    selection.isActive = false;
    
    console.log('🔄 Seleção de troca limpa');
    
    // Atualizar interface
    refreshManagementLists();
    hideSwapSelectionFeedback();
}

// Propor troca entre dois jogadores
function proposePlayerSwap(index1, type1, index2, type2) {
    const list1 = type1 === 'queue' ? unifiedManagementState.filaLocal : unifiedManagementState.reservasLocal;
    const list2 = type2 === 'queue' ? unifiedManagementState.filaLocal : unifiedManagementState.reservasLocal;
    
    const player1 = list1[index1];
    const player2 = list2[index2];
    
    const position1 = type1 === 'queue' ? `${index1 + 1}º na fila` : 'reserva';
    const position2 = type2 === 'queue' ? `${index2 + 1}º na fila` : 'reserva';
    
    console.log('🔄 Propondo troca:', { player1: player1.nome, player2: player2.nome });
    
    // Mostrar modal de confirmação
    showSwapConfirmationModal(player1, position1, player2, position2, index1, type1, index2, type2);
}

// Mostrar modal de confirmação de troca
function showSwapConfirmationModal(player1, position1, player2, position2, index1, type1, index2, type2) {
    const modal = document.getElementById('modal-confirmacao') || createConfirmationModal();
    
    const message = `Trocar ${player1.nome} (${position1}) ↔ ${player2.nome} (${position2})?`;
    
    modal.querySelector('#modal-titulo').textContent = '🔄 Confirmar Troca';
    modal.querySelector('#modal-mensagem').textContent = message;
    
    // Configurar botões
    const btnConfirmar = modal.querySelector('#modal-confirmar');
    const btnCancelar = modal.querySelector('#modal-cancelar');
    
    // Remover eventos anteriores
    const newBtnConfirmar = btnConfirmar.cloneNode(true);
    const newBtnCancelar = btnCancelar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(newBtnConfirmar, btnConfirmar);
    btnCancelar.parentNode.replaceChild(newBtnCancelar, btnCancelar);
    
    // Adicionar novos eventos
    newBtnConfirmar.addEventListener('click', () => {
        executePlayerSwap(index1, type1, index2, type2);
        modal.style.display = 'none';
    });
    
    newBtnCancelar.addEventListener('click', () => {
        modal.style.display = 'none';
        clearDoubleClickSelection();
    });
    
    modal.style.display = 'block';
}

// Executar troca de jogadores
function executePlayerSwap(index1, type1, index2, type2) {
    console.log('⚡ Executando troca de jogadores...');
    
    const list1 = type1 === 'queue' ? unifiedManagementState.filaLocal : unifiedManagementState.reservasLocal;
    const list2 = type2 === 'queue' ? unifiedManagementState.filaLocal : unifiedManagementState.reservasLocal;
    
    // Se são da mesma lista, trocar posições
    if (type1 === type2) {
        const temp = list1[index1];
        list1[index1] = list1[index2];
        list1[index2] = temp;
        
        console.log('✅ Troca executada na mesma lista');
    } else {
        // Se são de listas diferentes, mover entre listas
        const player1 = list1[index1];
        const player2 = list2[index2];
        
        list1[index1] = player2;
        list2[index2] = player1;
        
        console.log('✅ Troca executada entre listas diferentes');
    }
    
    // Registrar mudança
    unifiedManagementState.changes.push({
        type: 'swap',
        details: { index1, type1, index2, type2 },
        timestamp: Date.now()
    });
    
    // Limpar seleção
    clearDoubleClickSelection();
    
    // Atualizar interface
    refreshManagementLists();
    
    // Feedback para o usuário
    showTemporaryMessage('✅ Troca realizada com sucesso!');
}

// Mostrar feedback de seleção
function showSwapSelectionFeedback(playerName, position, type) {
    const typeText = type === 'queue' ? 'fila' : 'reserva';
    showTemporaryMessage(`👆 ${playerName} (${position}º) selecionado. Clique em outro para trocar.`, 3000);
}

// Esconder feedback de seleção
function hideSwapSelectionFeedback() {
    // O feedback temporário já se esconde automaticamente
}

// Mostrar mensagem temporária
function showTemporaryMessage(message, duration = 2000) {
    // Criar ou encontrar elemento de mensagem
    let messageEl = document.getElementById('temp-message');
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.id = 'temp-message';
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #4CAF50;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 9999;
            font-size: 0.9rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        `;
        document.body.appendChild(messageEl);
    }
    
    messageEl.textContent = message;
    messageEl.style.opacity = '1';
    messageEl.style.transform = 'translateX(-50%) translateY(0)';
    
    // Esconder após o tempo especificado
    setTimeout(() => {
        messageEl.style.opacity = '0';
        messageEl.style.transform = 'translateX(-50%) translateY(-20px)';
    }, duration);
}

// Criar modal de confirmação se não existir
function createConfirmationModal() {
    const modal = document.createElement('div');
    modal.id = 'modal-confirmacao';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3 id="modal-titulo">Confirmação</h3>
            <p id="modal-mensagem">Tem certeza?</p>
            <div class="modal-buttons">
                <button id="modal-cancelar" class="btn-cancel">❌ Cancelar</button>
                <button id="modal-confirmar" class="btn-confirm">✅ Confirmar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

// Recarregar listas no painel unificado
function refreshManagementLists() {
    if (unifiedManagementState.isOpen) {
        loadUnifiedLists().then(() => {
            updateCountersAndInterface();
        }).catch(error => {
            console.error('Erro ao recarregar listas:', error);
        });
    }
}
}