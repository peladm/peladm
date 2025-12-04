// Estado da aplicação
let jogadoresDisponiveis = [];
let jogadoresSelecionados = [];
let timesFormados = [];
// Variável de estrelas removida - não mais necessária
let regrasAtivas = null;

// Elementos DOM
const btnSelectAll = document.getElementById('btn-select-all');
const btnSortear = document.getElementById('btn-sortear');
const btnResort = document.getElementById('btn-resort');
const btnConfirmar = document.getElementById('btn-confirmar');
const listaJogadores = document.getElementById('lista-jogadores');
const resultadoSorteio = document.getElementById('resultado-sorteio');
const teamsContainer = document.getElementById('teams-container');

// Inicialização
document.addEventListener('DOMContentLoaded', inicializar);

async function inicializar() {
    try {
        // Tentar carregar regras (com fallback automático)
        await carregarRegras();
        
        // Tentar carregar jogadores
        await carregarJogadores();
        
        // Configurar interface
        configurarEventListeners();
        configurarEstadoInicial();
        
        console.log('✅ Sistema de sorteio inicializado com sucesso');
        
    } catch (error) {
        console.error('❌ Erro crítico na inicialização:', error);
        
        // Ainda assim tentar configurar o básico
        configurarEventListeners();
        configurarEstadoInicial();
        
        // Mostrar mensagem mais amigável
        mostrarMensagem('⚠️ Alguns dados não puderam ser carregados. Verifique sua conexão e recarregue a página.', 'warning');
    }
}

// Configurar estado inicial da interface
function configurarEstadoInicial() {
    // Inicializar contador do botão sortear
    const sortearText = document.getElementById('sortear-text');
    if (sortearText) {
        sortearText.textContent = 'Sortear Times: 0';
    }
}

// Event Listeners
function configurarEventListeners() {
    // Selecionar todos
    btnSelectAll.addEventListener('click', toggleSelectAll);

    // Sortear times
    btnSortear.addEventListener('click', sortearTimes);

    // Re-sortear
    btnResort.addEventListener('click', sortearTimes);

    // Confirmar times
    btnConfirmar.addEventListener('click', confirmarTimes);
}

// Carregar regras do banco
async function carregarRegras() {
    try {
        // Tentar carregar regras do banco com timeout otimizado
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout ao carregar regras')), 3000) // Reduzido para 3s
        );
        
        const resultado = await Promise.race([Database.buscarRegras(), timeoutPromise]);
        
        if (resultado.success && resultado.data && resultado.data.length > 0) {
            regrasAtivas = resultado.data[0];
            console.log('✅ Regras carregadas do banco:', regrasAtivas);
        } else {
            console.log('⚠️ Nenhuma regra encontrada, usando padrão');
            regrasAtivas = {
                jogadores_por_time: 6,
                limite_jogadores: 30
            };
        }
    } catch (error) {
        console.warn('⚠️ Erro ao carregar regras (usando fallback):', error.message);
        
        // Usar regras padrão em caso de erro de conectividade
        regrasAtivas = {
            jogadores_por_time: 6,
            limite_jogadores: 30
        };
        
        // Mostrar aviso discreto (não bloquear a funcionalidade)
        console.log('🔧 Sistema funcionando offline com configurações padrão');
    }
}

// Cache para jogadores
let jogadoresCache = null;
let jogadoresCacheTime = 0;
const JOGADORES_CACHE_DURATION = 60000; // 1 minuto

// Carregar jogadores do banco (com cache)
async function carregarJogadores() {
    try {
        // Verificar cache primeiro
        if (jogadoresCache && Date.now() - jogadoresCacheTime < JOGADORES_CACHE_DURATION) {
            console.log('📋 Usando jogadores do cache');
            jogadoresDisponiveis = jogadoresCache;
            renderizarListaJogadores();
            return;
        }
        
        listaJogadores.innerHTML = `
            <div class="loading-state">
                <span class="emoji">⏳</span>
                <p>Carregando jogadores...</p>
            </div>
        `;

        const resultado = await Database.buscarJogadores();
        
        if (!resultado.success) {
            throw new Error(resultado.error);
        }

        // Filtrar apenas jogadores ativos
        const todosJogadores = resultado.data || [];
        jogadoresDisponiveis = todosJogadores.filter(jogador => {
            const status = jogador.status || 'ativo'; // Default para ativo se não tiver status
            return status === 'ativo';
        });
        
        if (jogadoresDisponiveis.length === 0) {
            listaJogadores.innerHTML = `
                <div class="empty-state">
                    <span class="emoji">😴</span>
                    <p>Nenhum jogador cadastrado ainda</p>
                    <p><a href="cadastro.html">Cadastre jogadores primeiro</a></p>
                </div>
            `;
            return;
        }

        // Armazenar no cache
        jogadoresCache = jogadoresDisponiveis;
        jogadoresCacheTime = Date.now();
        console.log(`📋 Cache atualizado: ${jogadoresDisponiveis.length} jogadores`);
        
        renderizarListaJogadores();
        
    } catch (error) {
        console.error('Erro ao carregar jogadores:', error);
        listaJogadores.innerHTML = `
            <div class="empty-state">
                <span class="emoji">❌</span>
                <p>Erro ao carregar jogadores</p>
                <p><small>${error.message}</small></p>
            </div>
        `;
    }
}

// Renderizar lista de jogadores
function renderizarListaJogadores() {
    listaJogadores.innerHTML = jogadoresDisponiveis.map(jogador => {
        return `
            <button class="player-button" data-id="${jogador.id}" onclick="toggleJogador('${jogador.id}')">
                <span class="player-name">${jogador.nome}</span>
            </button>
        `;
    }).join('');
}

// Toggle seleção de jogador
function toggleJogador(jogadorId) {
    const playerButton = document.querySelector(`[data-id="${jogadorId}"]`);
    
    if (jogadoresSelecionados.includes(jogadorId)) {
        // Desselecionar
        playerButton.classList.remove('selected');
        jogadoresSelecionados = jogadoresSelecionados.filter(id => id !== jogadorId);
    } else {
        // Selecionar
        playerButton.classList.add('selected');
        jogadoresSelecionados.push(jogadorId);
    }
    
    atualizarContadorSelecao();
    validarSelecao();
}

// Toggle selecionar todos
function toggleSelectAll() {
    const todosSelecionados = jogadoresSelecionados.length === jogadoresDisponiveis.length;
    
    if (todosSelecionados) {
        // Desselecionar todos
        jogadoresSelecionados = [];
        document.querySelectorAll('.player-button').forEach(btn => btn.classList.remove('selected'));
        btnSelectAll.classList.remove('active');
        btnSelectAll.innerHTML = `
            <span class="emoji">✅</span>
            <span>Selecionar Todos</span>
        `;
    } else {
        // Selecionar todos
        jogadoresSelecionados = jogadoresDisponiveis.map(j => j.id.toString());
        document.querySelectorAll('.player-button').forEach(btn => btn.classList.add('selected'));
        btnSelectAll.classList.add('active');
        btnSelectAll.innerHTML = `
            <span class="emoji">❌</span>
            <span>Desselecionar Todos</span>
        `;
    }
    
    atualizarContadorSelecao();
    validarSelecao();
}

// Função removida - toggleStars não é mais necessária

// Atualizar contador de seleção
function atualizarContadorSelecao() {
    const count = jogadoresSelecionados.length;
    
    // Atualizar texto do botão de sortear
    const sortearText = document.getElementById('sortear-text');
    if (sortearText) {
        sortearText.textContent = `Sortear Times: ${count}`;
    }
}

// Validar se pode sortear
function validarSelecao() {
    const jogadoresPorTime = regrasAtivas?.jogadores_por_time || 6;
    const minJogadores = jogadoresPorTime * 2; // Mínimo para 2 times
    const podeSortear = jogadoresSelecionados.length >= minJogadores;
    
    btnSortear.disabled = !podeSortear;
    
    return podeSortear;
}

// Algoritmo de sorteio balanceado
function sortearTimes() {
    console.log('🎲 FUNÇÃO SORTEAR TIMES CHAMADA!');
    console.log('Jogadores selecionados:', jogadoresSelecionados);
    
    if (jogadoresSelecionados.length === 0) {
        alert('❌ Nenhum jogador selecionado!');
        return;
    }
    
    try {
        console.log('🎲 INICIANDO SORTEIO...');
        console.log('Jogadores selecionados IDs:', jogadoresSelecionados);
        
        mostrarLoading('Sorteando times...');
        
        // Buscar dados completos dos jogadores selecionados
        const jogadoresSorteio = jogadoresDisponiveis.filter(j => 
            jogadoresSelecionados.includes(j.id.toString())
        );
        
        console.log('Jogadores para sorteio:', jogadoresSorteio.map(j => j.nome));
        
        // Calcular número de times baseado nas regras
        const jogadoresPorTime = regrasAtivas?.jogadores_por_time || 6;
        const totalJogadores = jogadoresSorteio.length;
        
        console.log(`Regras ativas: ${JSON.stringify(regrasAtivas)}`);
        console.log(`Total de jogadores selecionados: ${totalJogadores}`);
        console.log(`Jogadores por time (regra): ${jogadoresPorTime}`);
        
        // PRIORIZAR TIMES COMPLETOS - não distribuir igualmente se sobrar pouco
        let numeroTimes = Math.floor(totalJogadores / jogadoresPorTime);
        const jogadoresRestantes = totalJogadores % jogadoresPorTime;
        
        console.log(`Times completos possíveis: ${numeroTimes}`);
        console.log(`Jogadores restantes: ${jogadoresRestantes}`);
        
        // Sempre criar time para jogadores restantes (se houver)
        if (jogadoresRestantes > 0) {
            numeroTimes += 1;
            console.log(`Adicionando 1 time incompleto (${jogadoresRestantes} jogadores)`);
            console.log(`DECISÃO: ${numeroTimes-1} times completos + 1 incompleto`);
        }
        
        // Mínimo de 2 times para sorteio
        if (numeroTimes < 2) {
            numeroTimes = Math.min(2, Math.floor(totalJogadores / 3));
            console.log(`Ajustando para mínimo de ${numeroTimes} times`);
        }
        
        console.log(`RESULTADO: ${numeroTimes} times serão formados`);
        
        // Separar jogadores por nível
        const jogadoresPorNivel = separarJogadoresPorNivel(jogadoresSorteio);
        
        // Inicializar times vazios
        timesFormados = Array.from({ length: numeroTimes }, (_, i) => ({
            id: i + 1,
            nome: `Time ${i + 1}`,
            jogadores: [],
            nivelMedio: 0,
            cores: ['🔴', '🔵', '🟢', '🟡', '🟠', '🟣', '⚫', '⚪'][i]
        }));
        
        // NOVO SISTEMA PROFISSIONAL: 13 padrões em ordem de prioridade
        executarSorteioInteligente(jogadoresPorNivel, timesFormados, jogadoresPorTime);
        
        // EMBARALHAMENTO AUTOMÁTICO: Randomizar ordem dos jogadores dentro de cada time
        embaralharJogadoresDentroDosTimes(timesFormados);
        
        // Calcular nível médio de cada time
        timesFormados.forEach(time => {
            if (time.jogadores.length > 0) {
                const somaNeveis = time.jogadores.reduce((soma, j) => soma + (j.nivel_habilidade || 3), 0);
                time.nivelMedio = (somaNeveis / time.jogadores.length).toFixed(1);
            }
        });
        
        // Usar requestAnimationFrame para melhor performance visual
        requestAnimationFrame(() => {
            setTimeout(() => {
                exibirResultado();
            }, 500); // Reduzido de 1000ms para 500ms
        });
        
    } catch (error) {
        console.error('Erro no sorteio:', error);
        mostrarMensagem('❌ Erro ao sortear times', 'error');
    }
}

// Embaralhar array
function embaralharArray(array) {
    const arrayCopy = [...array];
    for (let i = arrayCopy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arrayCopy[i], arrayCopy[j]] = [arrayCopy[j], arrayCopy[i]];
    }
    return arrayCopy;
}

// Embaralhar jogadores dentro de cada time (após formação dos padrões)
function embaralharJogadoresDentroDosTimes(times) {
    console.log('🎲 Embaralhando ordem dos jogadores dentro de cada time...');
    console.log(`📊 Total de times para embaralhar: ${times.length}`);
    
    let timesEmbaralhados = 0;
    
    times.forEach((time, index) => {
        if (time.jogadores && time.jogadores.length > 0) {
            console.log(`📝 ${time.nome} (${index + 1}/${times.length}) - ANTES: ${time.jogadores.map(j => `${j.nome}(${j.nivel_habilidade || 3}⭐)`).join(', ')}`);
            
            // Embaralhar a ordem dos jogadores dentro do time
            time.jogadores = embaralharArray(time.jogadores);
            
            console.log(`🎯 ${time.nome} (${index + 1}/${times.length}) - DEPOIS: ${time.jogadores.map(j => `${j.nome}(${j.nivel_habilidade || 3}⭐)`).join(', ')}`);
            timesEmbaralhados++;
        } else {
            console.log(`⚠️ ${time.nome} (${index + 1}/${times.length}) - Time vazio, pulando embaralhamento`);
        }
    });
    
    console.log(`✅ Embaralhamento concluído! ${timesEmbaralhados}/${times.length} times embaralhados - padrões mantidos, ordem randomizada!`);
}

// Separar jogadores por nível
function separarJogadoresPorNivel(jogadores) {
    const jogadoresPorNivel = {
        5: [],
        4: [],
        3: [],
        2: [],
        1: []
    };
    
    jogadores.forEach(jogador => {
        const nivel = jogador.nivel_habilidade || 3;
        jogadoresPorNivel[nivel] = jogadoresPorNivel[nivel] || [];
        jogadoresPorNivel[nivel].push(jogador);
    });
    
    // Embaralhar cada nível
    Object.keys(jogadoresPorNivel).forEach(nivel => {
        jogadoresPorNivel[nivel] = embaralharArray(jogadoresPorNivel[nivel]);
    });
    
    return jogadoresPorNivel;
}

// DEFINIR AS 13 COMBINAÇÕES EM ORDEM DE PRIORIDADE
const COMBINACOES_PRIORITARIAS = [
    // 🥇 PRIORIDADE 1 - Times "Ideais" (média 3,5)
    { id: 'A', nome: 'Ideal A', estrelas: {5: 1, 4: 2, 3: 2, 2: 1, 1: 0}, media: 3.5, prioridade: 1 },
    { id: 'B', nome: 'Ideal B', estrelas: {5: 1, 4: 1, 3: 3, 2: 1, 1: 0}, media: 3.5, prioridade: 1 },
    { id: 'C', nome: 'Ideal C', estrelas: {5: 1, 4: 0, 3: 4, 2: 1, 1: 0}, media: 3.5, prioridade: 1 },
    { id: 'D', nome: 'Ideal D', estrelas: {5: 1, 4: 2, 3: 2, 2: 0, 1: 1}, media: 3.5, prioridade: 1 },
    { id: 'E', nome: 'Ideal E', estrelas: {5: 1, 4: 1, 3: 4, 2: 0, 1: 0}, media: 3.5, prioridade: 1 },
    
    // 🥈 PRIORIDADE 2 - Média 3,4
    { id: 'F', nome: 'Bom F', estrelas: {5: 1, 4: 1, 3: 3, 2: 1, 1: 0}, media: 3.4, prioridade: 2 },
    { id: 'G', nome: 'Bom G', estrelas: {5: 1, 4: 0, 3: 5, 2: 0, 1: 0}, media: 3.4, prioridade: 2 },
    
    // 🥉 PRIORIDADE 3 - Média 3,3
    { id: 'H', nome: 'Médio H', estrelas: {5: 1, 4: 2, 3: 2, 2: 1, 1: 0}, media: 3.3, prioridade: 3 },
    { id: 'I', nome: 'Médio I', estrelas: {5: 1, 4: 0, 3: 4, 2: 1, 1: 0}, media: 3.3, prioridade: 3 },
    { id: 'J', nome: 'Médio J', estrelas: {5: 1, 4: 3, 3: 2, 2: 0, 1: 0}, media: 3.3, prioridade: 3 },
    
    // 🏅 PRIORIDADE 4 - Média 3,2
    { id: 'K', nome: 'Regular K', estrelas: {5: 1, 4: 1, 3: 3, 2: 1, 1: 0}, media: 3.2, prioridade: 4 },
    { id: 'L', nome: 'Regular L', estrelas: {5: 1, 4: 0, 3: 4, 2: 1, 1: 0}, media: 3.2, prioridade: 4 },
    { id: 'M', nome: 'Regular M', estrelas: {5: 1, 4: 1, 3: 4, 2: 0, 1: 0}, media: 3.2, prioridade: 4 }
];

// EMBARALHAR DUPLO - Garantir máxima aleatoriedade
function embaralharDuplo(jogadoresPorNivel) {
    console.log('🎲 Aplicando embaralhamento duplo...');
    
    // 1. Embaralhar todos os jogadores juntos primeiro
    const todosJogadores = [];
    Object.values(jogadoresPorNivel).forEach(nivel => {
        todosJogadores.push(...nivel);
    });
    embaralharArray(todosJogadores);
    
    // 2. Recriar arrays por nível embaralhados
    Object.keys(jogadoresPorNivel).forEach(nivel => {
        jogadoresPorNivel[nivel] = [];
    });
    
    todosJogadores.forEach(jogador => {
        const nivel = jogador.nivel_habilidade || 3;
        jogadoresPorNivel[nivel].push(jogador);
    });
    
    // 3. Embaralhar novamente cada nível individualmente
    Object.keys(jogadoresPorNivel).forEach(nivel => {
        embaralharArray(jogadoresPorNivel[nivel]);
    });
    
    console.log('✅ Embaralhamento duplo concluído!');
}

// NOVO SISTEMA DE SORTEIO COM 13 PADRÕES EM ORDEM DE PRIORIDADE
function executarSorteioInteligente(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== INICIANDO NOVO SISTEMA DE SORTEIO PROFISSIONAL ===');
    
    // 1) EMBARALHAR DUPLO PARA GARANTIR ALEATORIEDADE
    embaralharDuplo(jogadoresPorNivel);
    
    // 2) DEFINIR QUANTOS TIMES COMPLETOS E INCOMPLETOS
    const totalJogadores = Object.values(jogadoresPorNivel).reduce((sum, arr) => sum + arr.length, 0);
    const timesCompletos = Math.min(times.length, Math.floor(totalJogadores / jogadoresPorTime));
    const temTimeIncompleto = times.length > timesCompletos;
    
    console.log(`📊 Total: ${totalJogadores} jogadores`);
    console.log(`🏆 Times completos: ${timesCompletos}`);
    console.log(`⚠️ Time incompleto: ${temTimeIncompleto ? 'SIM' : 'NÃO'}`);
    
    // 3) APLICAR PADRÕES PARA TIMES COMPLETOS
    for (let i = 0; i < timesCompletos; i++) {
        const padraoAplicado = tentarAplicarMelhorPadrao(jogadoresPorNivel, times[i], jogadoresPorTime);
        console.log(`✅ ${times[i].nome}: ${padraoAplicado}`);
    }
    
    // 4) PREENCHER TIME INCOMPLETO (SE HOUVER)
    if (temTimeIncompleto) {
        const timeIncompleto = times[timesCompletos];
        preencherTimeIncompleto(jogadoresPorNivel, timeIncompleto);
        console.log(`⚠️ ${timeIncompleto.nome}: Time incompleto (${timeIncompleto.jogadores.length} jogadores)`);
    }
    
    // 5) MOSTRAR RESULTADO FINAL NO CONSOLE
    mostrarResultadoSorteio(times, timesCompletos);
    
    // 6) EXIBIR MENSAGEM ÚNICA DE SUCESSO
    exibirMensagemFinalSorteio(times, timesCompletos);
    
    console.log('✅ Sorteio concluído com sucesso!');
}

// TENTAR APLICAR O MELHOR PADRÃO DISPONÍVEL
function tentarAplicarMelhorPadrao(jogadoresPorNivel, time, jogadoresPorTime) {
    // Contar jogadores disponíveis
    const disponivel = {
        5: jogadoresPorNivel[5].length,
        4: jogadoresPorNivel[4].length,
        3: jogadoresPorNivel[3].length,
        2: jogadoresPorNivel[2].length,
        1: jogadoresPorNivel[1].length
    };
    
    // Tentar cada combinação em ordem de prioridade
    for (const combinacao of COMBINACOES_PRIORITARIAS) {
        if (podeAplicarCombinacao(disponivel, combinacao.estrelas)) {
            aplicarCombinacao(jogadoresPorNivel, time, combinacao.estrelas);
            return `Padrão ${combinacao.id} (${combinacao.nome}) - Média ${combinacao.media}`;
        }
    }
    
    // Fallback: preencher com o que tiver disponível
    preencherComDisponiveis(jogadoresPorNivel, time, jogadoresPorTime);
    return 'Fallback: Distribuição livre';
}

// VERIFICAR SE PODE APLICAR UMA COMBINAÇÃO
function podeAplicarCombinacao(disponivel, necessario) {
    return Object.keys(necessario).every(nivel => {
        const nivelNum = parseInt(nivel);
        return disponivel[nivelNum] >= necessario[nivelNum];
    });
}

// APLICAR UMA COMBINAÇÃO ESPECÍFICA
function aplicarCombinacao(jogadoresPorNivel, time, estrelas) {
    console.log(`🎯 Aplicando combinação:`, estrelas);
    
    // Aplicar em ordem decrescente de nível (5⭐ → 1⭐)
    [5, 4, 3, 2, 1].forEach(nivel => {
        const quantidade = estrelas[nivel] || 0;
        
        for (let i = 0; i < quantidade; i++) {
            if (jogadoresPorNivel[nivel].length > 0) {
                const jogador = jogadoresPorNivel[nivel].shift();
                time.jogadores.push(jogador);
                console.log(`  + ${jogador.nome} (${nivel}⭐) → ${time.nome}`);
            }
        }
    });
}

// PREENCHER TIME INCOMPLETO
function preencherTimeIncompleto(jogadoresPorNivel, time) {
    console.log(`⚠️ Preenchendo time incompleto: ${time.nome}`);
    
    // Tentar aplicar o melhor padrão possível, mas pode faltar jogador
    const melhorPadrao = tentarAplicarMelhorPadraoIncompleto(jogadoresPorNivel, time);
    
    console.log(`📋 Padrão aplicado no time incompleto: ${melhorPadrao}`);
}

// TENTAR APLICAR MELHOR PADRÃO PARA TIME INCOMPLETO
function tentarAplicarMelhorPadraoIncompleto(jogadoresPorNivel, time) {
    // Contar jogadores disponíveis
    const disponivel = {
        5: jogadoresPorNivel[5].length,
        4: jogadoresPorNivel[4].length,
        3: jogadoresPorNivel[3].length,
        2: jogadoresPorNivel[2].length,
        1: jogadoresPorNivel[1].length
    };
    
    const totalDisponivel = Object.values(disponivel).reduce((sum, count) => sum + count, 0);
    
    if (totalDisponivel === 0) {
        return 'Nenhum jogador restante';
    }
    
    // Tentar padrões, mas respeitando limites (máximo 1 de nível 5 e 2, etc.)
    for (const combinacao of COMBINACOES_PRIORITARIAS) {
        const padraoAdaptado = adaptarPadraoParaIncompleto(combinacao.estrelas, disponivel, totalDisponivel);
        
        if (padraoAdaptado) {
            aplicarCombinacao(jogadoresPorNivel, time, padraoAdaptado);
            return `${combinacao.id} adaptado (${totalDisponivel} jogadores)`;
        }
    }
    
    // Último recurso: pegar o que tiver
    preencherComDisponiveis(jogadoresPorNivel, time, totalDisponivel);
    return `Distribuição livre (${totalDisponivel} jogadores)`;
}

// ADAPTAR PADRÃO PARA TIME INCOMPLETO
function adaptarPadraoParaIncompleto(estrelas, disponivel, maxJogadores) {
    const adaptado = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0};
    let jogadoresUsados = 0;
    
    // Respeitar limites: máximo 1 nível 5, máximo 1 nível 2
    const limites = {5: 1, 4: 6, 3: 6, 2: 1, 1: 6};
    
    // Distribuir em ordem decrescente
    [5, 4, 3, 2, 1].forEach(nivel => {
        const ideal = estrelas[nivel] || 0;
        const limite = limites[nivel];
        const disponivelNivel = disponivel[nivel];
        
        const quantidade = Math.min(ideal, limite, disponivelNivel, maxJogadores - jogadoresUsados);
        
        if (quantidade > 0) {
            adaptado[nivel] = quantidade;
            jogadoresUsados += quantidade;
        }
    });
    
    return jogadoresUsados > 0 ? adaptado : null;
}

// PREENCHER COM JOGADORES DISPONÍVEIS
function preencherComDisponiveis(jogadoresPorNivel, time, maxJogadores) {
    let adicionados = 0;
    
    // Distribuir de forma equilibrada
    [5, 4, 3, 2, 1].forEach(nivel => {
        while (jogadoresPorNivel[nivel].length > 0 && adicionados < maxJogadores) {
            const jogador = jogadoresPorNivel[nivel].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (${nivel}⭐) → ${time.nome} (livre)`);
            adicionados++;
        }
    });
}

// MOSTRAR RESULTADO DO SORTEIO
function mostrarResultadoSorteio(times, timesCompletos) {
    console.log('\n=== RESULTADO FINAL DO SORTEIO ===');
    
    times.forEach((time, index) => {
        const tipo = index < timesCompletos ? 'COMPLETO' : 'INCOMPLETO';
        const media = calcularMediaTime(time.jogadores);
        
        console.log(`\n🏆 ${time.nome} (${tipo}) - Média: ${media.toFixed(1)}⭐`);
        console.log(`   Jogadores: ${time.jogadores.map(j => `${j.nome}(${j.nivel_habilidade || 3}⭐)`).join(', ')}`);
    });
    
    const mediaGeral = times.reduce((sum, time) => sum + calcularMediaTime(time.jogadores), 0) / times.length;
    console.log(`\n📊 Média geral dos times: ${mediaGeral.toFixed(2)}⭐`);
}

// CALCULAR MÉDIA DE UM TIME
function calcularMediaTime(jogadores) {
    if (jogadores.length === 0) return 0;
    
    const somaEstrelas = jogadores.reduce((sum, jogador) => sum + (jogador.nivel_habilidade || 3), 0);
    return somaEstrelas / jogadores.length;
}

// EXIBIR MENSAGEM FINAL ÚNICA DO SORTEIO
function exibirMensagemFinalSorteio(times, timesCompletos) {
    // Verificar se algum padrão foi aplicado com sucesso
    let padroesBemSucedidos = 0;
    let timesComPadroes = 0;
    
    times.forEach((time, index) => {
        if (time.jogadores.length > 0) {
            timesComPadroes++;
            
            // Verificar se tem uma formação equilibrada (não é só fallback)
            const niveis = time.jogadores.map(j => j.nivel_habilidade || 3);
            const tem5estrelas = niveis.includes(5);
            const tem4estrelas = niveis.includes(4);
            const mediaTime = calcularMediaTime(time.jogadores);
            
            // Considerar bem-sucedido se tem boa distribuição de níveis
            if ((tem5estrelas || tem4estrelas) && mediaTime >= 3.0) {
                padroesBemSucedidos++;
            }
        }
    });
    
    // Exibir mensagem única baseada no resultado
    if (padroesBemSucedidos === timesComPadroes && timesComPadroes > 0) {
        mostrarMensagem('🎯 Sorteio concluído com sucesso! Todos os times foram formados com padrões equilibrados.', 'success');
    } else if (padroesBemSucedidos > 0) {
        mostrarMensagem(`⚖️ Sorteio concluído! ${padroesBemSucedidos} de ${timesComPadroes} times formados com padrões equilibrados.`, 'warning');
    } else {
        mostrarMensagem('🔄 Sorteio concluído com distribuição livre. Times podem não estar perfeitamente equilibrados.', 'info');
    }
}

// FUNÇÕES ANTIGAS MANTIDAS PARA COMPATIBILIDADE
function verificarPadrao1(count, numeroTimes) {
    // Função mantida para não quebrar outros códigos
    return false;
    
    const possivel = timesParaTentar > 0 && (
        disponivel[5] >= necessario[5] &&
        disponivel[4] >= necessario[4] &&
        disponivel[3] >= necessario[3] &&
        disponivel.baixo >= necessario.baixo
    );
    
    console.log('Padrão 1 possível:', possivel);
    return possivel;
}

// Verificar se Padrão 2 é possível: 1×5⭐ + 3×4⭐ + 2×(1-2⭐)
function verificarPadrao2(count, numeroTimes) {
    const timesCompletos = Math.floor((count[5] + count[4] + count[3] + count[2] + count[1]) / 6);
    const timesParaTentar = Math.min(numeroTimes, timesCompletos);
    
    console.log(`Verificando Padrão 2 para ${timesParaTentar} times completos`);
    
    const necessario = {
        5: timesParaTentar * 1,
        4: timesParaTentar * 3,
        baixo: timesParaTentar * 2
    };
    
    const disponivel = {
        5: count[5],
        4: count[4],
        baixo: count[1] + count[2]
    };
    
    const possivel = timesParaTentar > 0 && (
        disponivel[5] >= necessario[5] &&
        disponivel[4] >= necessario[4] &&
        disponivel.baixo >= necessario.baixo
    );
    
    console.log('Padrão 2 possível:', possivel);
    return possivel;
}

// Verificar se Padrão 3 é possível: 1×5⭐ + 1×4⭐ + 3×3⭐ + 1×(1-2⭐)
function verificarPadrao3(count, numeroTimes) {
    const timesCompletos = Math.floor((count[5] + count[4] + count[3] + count[2] + count[1]) / 6);
    const timesParaTentar = Math.min(numeroTimes, timesCompletos);
    
    console.log(`Verificando Padrão 3 para ${timesParaTentar} times completos`);
    
    const necessario = {
        5: timesParaTentar * 1,
        4: timesParaTentar * 1,
        3: timesParaTentar * 3,
        baixo: timesParaTentar * 1
    };
    
    const disponivel = {
        5: count[5],
        4: count[4],
        3: count[3],
        baixo: count[1] + count[2]
    };
    
    const possivel = timesParaTentar > 0 && (
        disponivel[5] >= necessario[5] &&
        disponivel[4] >= necessario[4] &&
        disponivel[3] >= necessario[3] &&
        disponivel.baixo >= necessario.baixo
    );
    
    console.log('Padrão 3 possível:', possivel);
    return possivel;
}

// Verificar se Padrão 4 é possível: 3×4⭐ + 2×3⭐ + 1×(1-2⭐)
function verificarPadrao4(count, numeroTimes) {
    const timesCompletos = Math.floor((count[5] + count[4] + count[3] + count[2] + count[1]) / 6);
    const timesParaTentar = Math.min(numeroTimes, timesCompletos);
    
    console.log(`Verificando Padrão 4 para ${timesParaTentar} times completos`);
    
    const necessario = {
        4: timesParaTentar * 3,
        3: timesParaTentar * 2,
        baixo: timesParaTentar * 1
    };
    
    const disponivel = {
        4: count[4],
        3: count[3],
        baixo: count[1] + count[2]
    };
    
    const possivel = timesParaTentar > 0 && (
        disponivel[4] >= necessario[4] &&
        disponivel[3] >= necessario[3] &&
        disponivel.baixo >= necessario.baixo
    );
    
    console.log('Padrão 4 possível:', possivel);
    return possivel;
}

// Verificar se Padrão 5 é possível: 1×5⭐ + 2×4⭐ + 1×3⭐ + 2×(1-2⭐)
function verificarPadrao5(count, numeroTimes) {
    const timesCompletos = Math.floor((count[5] + count[4] + count[3] + count[2] + count[1]) / 6);
    const timesParaTentar = Math.min(numeroTimes, timesCompletos);
    
    console.log(`Verificando Padrão 5 para ${timesParaTentar} times completos`);
    
    const necessario = {
        5: timesParaTentar * 1,
        4: timesParaTentar * 2,
        3: timesParaTentar * 1,
        baixo: timesParaTentar * 2
    };
    
    const disponivel = {
        5: count[5],
        4: count[4],
        3: count[3],
        baixo: count[1] + count[2]
    };
    
    const possivel = timesParaTentar > 0 && (
        disponivel[5] >= necessario[5] &&
        disponivel[4] >= necessario[4] &&
        disponivel[3] >= necessario[3] &&
        disponivel.baixo >= necessario.baixo
    );
    
    console.log('Padrão 5 possível:', possivel);
    return possivel;
}

// Verificar se Padrão 6 é possível: 1×4⭐ + 5×3⭐
function verificarPadrao6(count, numeroTimes) {
    const timesCompletos = Math.floor((count[5] + count[4] + count[3] + count[2] + count[1]) / 6);
    const timesParaTentar = Math.min(numeroTimes, timesCompletos);
    
    console.log(`Verificando Padrão 6 para ${timesParaTentar} times completos`);
    
    const necessario = {
        4: timesParaTentar * 1,
        3: timesParaTentar * 5
    };
    
    const disponivel = {
        4: count[4],
        3: count[3]
    };
    
    const possivel = timesParaTentar > 0 && (
        disponivel[4] >= necessario[4] &&
        disponivel[3] >= necessario[3]
    );
    
    console.log('Padrão 6 possível:', possivel);
    return possivel;
}

// Verificar se Padrão 7 é possível: 1×5⭐ + 4×3⭐ + 1×(1-2⭐)
function verificarPadrao7(count, numeroTimes) {
    const timesCompletos = Math.floor((count[5] + count[4] + count[3] + count[2] + count[1]) / 6);
    const timesParaTentar = Math.min(numeroTimes, timesCompletos);
    
    console.log(`Verificando Padrão 7 para ${timesParaTentar} times completos`);
    
    const necessario = {
        5: timesParaTentar * 1,
        3: timesParaTentar * 4,
        baixo: timesParaTentar * 1
    };
    
    const disponivel = {
        5: count[5],
        3: count[3],
        baixo: count[1] + count[2]
    };
    
    const possivel = timesParaTentar > 0 && (
        disponivel[5] >= necessario[5] &&
        disponivel[3] >= necessario[3] &&
        disponivel.baixo >= necessario.baixo
    );
    
    console.log('Padrão 7 possível:', possivel);
    return possivel;
}

// Aplicar Padrão 1: 1×5⭐ + 2×4⭐ + 2×3⭐ + 1×(1-2⭐)
function aplicarPadrao1(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== APLICANDO PADRÃO 1 ===');
    aplicarPadraoGenerico(jogadoresPorNivel, times, jogadoresPorTime, {5: 1, 4: 2, 3: 2, baixo: 1});
}

// Aplicar Padrão 2: 1×5⭐ + 3×4⭐ + 2×(1-2⭐)
function aplicarPadrao2(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== APLICANDO PADRÃO 2 ===');
    aplicarPadraoGenerico(jogadoresPorNivel, times, jogadoresPorTime, {5: 1, 4: 3, 3: 0, baixo: 2});
}

// Aplicar Padrão 3: 1×5⭐ + 1×4⭐ + 3×3⭐ + 1×(1-2⭐)
function aplicarPadrao3(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== APLICANDO PADRÃO 3 ===');
    aplicarPadraoGenerico(jogadoresPorNivel, times, jogadoresPorTime, {5: 1, 4: 1, 3: 3, baixo: 1});
}

// Aplicar Padrão 4: 3×4⭐ + 2×3⭐ + 1×(1-2⭐)
function aplicarPadrao4(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== APLICANDO PADRÃO 4 ===');
    aplicarPadraoGenerico(jogadoresPorNivel, times, jogadoresPorTime, {5: 0, 4: 3, 3: 2, baixo: 1});
}

// Aplicar Padrão 5: 1×5⭐ + 2×4⭐ + 1×3⭐ + 2×(1-2⭐)
function aplicarPadrao5(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== APLICANDO PADRÃO 5 ===');
    aplicarPadraoGenerico(jogadoresPorNivel, times, jogadoresPorTime, {5: 1, 4: 2, 3: 1, baixo: 2});
}

// Aplicar Padrão 6: 1×4⭐ + 5×3⭐
function aplicarPadrao6(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== APLICANDO PADRÃO 6 ===');
    aplicarPadraoGenerico(jogadoresPorNivel, times, jogadoresPorTime, {5: 0, 4: 1, 3: 5, baixo: 0});
}

// Aplicar Padrão 7: 1×5⭐ + 4×3⭐ + 1×(1-2⭐)
function aplicarPadrao7(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== APLICANDO PADRÃO 7 ===');
    aplicarPadraoGenerico(jogadoresPorNivel, times, jogadoresPorTime, {5: 1, 4: 0, 3: 4, baixo: 1});
}

// Função genérica para aplicar qualquer padrão
function aplicarPadraoGenerico(jogadoresPorNivel, times, jogadoresPorTime, padrao) {
    const totalJogadores = Object.values(jogadoresPorNivel).reduce((sum, arr) => sum + arr.length, 0);
    const timesCompletos = Math.min(times.length, Math.floor(totalJogadores / 6));
    
    console.log(`Aplicando padrão em ${timesCompletos} times completos de ${times.length} total`);
    
    for (let i = 0; i < timesCompletos; i++) {
        const time = times[i];
        console.log(`Montando ${time.nome}:`);
        
        // Aplicar 5 estrelas
        for (let j = 0; j < padrao[5] && jogadoresPorNivel[5].length > 0; j++) {
            const jogador = jogadoresPorNivel[5].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (5⭐)`);
        }
        
        // Aplicar 4 estrelas
        for (let j = 0; j < padrao[4] && jogadoresPorNivel[4].length > 0; j++) {
            const jogador = jogadoresPorNivel[4].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (4⭐)`);
        }
        
        // Aplicar 3 estrelas
        for (let j = 0; j < padrao[3] && jogadoresPorNivel[3].length > 0; j++) {
            const jogador = jogadoresPorNivel[3].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (3⭐)`);
        }
        
        // Aplicar jogadores baixos (2 ou 1 estrelas)
        for (let j = 0; j < padrao.baixo; j++) {
            if (jogadoresPorNivel[2].length > 0) {
                const jogador = jogadoresPorNivel[2].shift();
                time.jogadores.push(jogador);
                console.log(`  + ${jogador.nome} (2⭐)`);
            } else if (jogadoresPorNivel[1].length > 0) {
                const jogador = jogadoresPorNivel[1].shift();
                time.jogadores.push(jogador);
                console.log(`  + ${jogador.nome} (1⭐)`);
            }
        }
        
        console.log(`  Total: ${time.jogadores.length} jogadores`);
    }
    
    // Distribuir jogadores restantes
    console.log('Distribuindo jogadores restantes...');
    distribuirRestantes(jogadoresPorNivel, times, jogadoresPorTime);
}

// Aplicar Fallback - distribuição equilibrada
function aplicarFallback(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== APLICANDO FALLBACK ===');
    
    // PRIORIZAR TIMES COMPLETOS - preencher sequencialmente, não serpentina
    const totalJogadores = Object.values(jogadoresPorNivel).reduce((sum, arr) => sum + arr.length, 0);
    const timesCompletos = Math.min(times.length, Math.floor(totalJogadores / jogadoresPorTime));
    
    console.log(`Preenchendo ${timesCompletos} times completos primeiro`);
    
    // Preencher times completos primeiro (6 jogadores cada)
    let timeAtual = 0;
    [5, 4, 3, 2, 1].forEach(nivel => {
        console.log(`Distribuindo jogadores nível ${nivel}: ${jogadoresPorNivel[nivel].length}`);
        
        while (jogadoresPorNivel[nivel].length > 0) {
            // Primeiro, preencher times incompletos até chegarem a 6
            let encontrou = false;
            for (let i = 0; i < timesCompletos; i++) {
                if (times[i].jogadores.length < jogadoresPorTime) {
                    const jogador = jogadoresPorNivel[nivel].shift();
                    times[i].jogadores.push(jogador);
                    console.log(`  + ${jogador.nome} (${nivel}⭐) -> ${times[i].nome} (${times[i].jogadores.length}/${jogadoresPorTime})`);
                    encontrou = true;
                    break;
                }
            }
            
            // Se todos os times completos estão cheios, colocar no time incompleto
            if (!encontrou && jogadoresPorNivel[nivel].length > 0) {
                for (let i = timesCompletos; i < times.length; i++) {
                    if (times[i].jogadores.length < jogadoresPorTime) {
                        const jogador = jogadoresPorNivel[nivel].shift();
                        times[i].jogadores.push(jogador);
                        console.log(`  + ${jogador.nome} (${nivel}⭐) -> ${times[i].nome} (INCOMPLETO)`);
                        encontrou = true;
                        break;
                    }
                }
            }
            
            // Se não encontrou lugar, sair do loop
            if (!encontrou) break;
        }
    });
    
    console.log('Times após fallback:');
    times.forEach(time => {
        console.log(`${time.nome}: ${time.jogadores.length} jogadores`);
    });
}

// Nova função de distribuição equilibrada
function aplicarDistribuicaoEquilibrada(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== APLICANDO DISTRIBUIÇÃO EQUILIBRADA ===');
    
    const totalJogadores = Object.values(jogadoresPorNivel).reduce((sum, arr) => sum + arr.length, 0);
    const timesCompletos = Math.floor(totalJogadores / jogadoresPorTime);
    
    console.log(`Distribuindo ${totalJogadores} jogadores em ${times.length} times (${timesCompletos} completos)`);
    
    // Distribuir de forma equilibrada - um jogador de cada nível por vez em cada time
    let timeAtual = 0;
    
    // Primeiro, distribuir jogadores de alto nível (5⭐ e 4⭐) de forma equilibrada
    [5, 4].forEach(nivel => {
        console.log(`Distribuindo jogadores ${nivel}⭐: ${jogadoresPorNivel[nivel].length}`);
        
        while (jogadoresPorNivel[nivel].length > 0) {
            // Encontrar o time com menos jogadores deste nível
            let melhorTime = 0;
            let menorCount = times[0].jogadores.filter(j => (j.nivel_habilidade || 3) === nivel).length;
            
            for (let i = 1; i < timesCompletos; i++) {
                const count = times[i].jogadores.filter(j => (j.nivel_habilidade || 3) === nivel).length;
                if (count < menorCount && times[i].jogadores.length < jogadoresPorTime) {
                    menorCount = count;
                    melhorTime = i;
                }
            }
            
            if (times[melhorTime].jogadores.length < jogadoresPorTime) {
                const jogador = jogadoresPorNivel[nivel].shift();
                times[melhorTime].jogadores.push(jogador);
                console.log(`  + ${jogador.nome} (${nivel}⭐) -> ${times[melhorTime].nome}`);
            } else {
                break; // Todos os times completos estão cheios
            }
        }
    });
    
    // Depois, distribuir jogadores de nível médio e baixo (3⭐, 2⭐, 1⭐)
    [3, 2, 1].forEach(nivel => {
        console.log(`Distribuindo jogadores ${nivel}⭐: ${jogadoresPorNivel[nivel].length}`);
        
        while (jogadoresPorNivel[nivel].length > 0) {
            // Distribuir sequencialmente, mas priorizando times incompletos
            let colocado = false;
            
            // Primeiro, preencher times incompletos
            for (let i = 0; i < timesCompletos; i++) {
                if (times[i].jogadores.length < jogadoresPorTime) {
                    const jogador = jogadoresPorNivel[nivel].shift();
                    times[i].jogadores.push(jogador);
                    console.log(`  + ${jogador.nome} (${nivel}⭐) -> ${times[i].nome}`);
                    colocado = true;
                    break;
                }
            }
            
            // Se todos os times completos estão cheios, colocar no time incompleto
            if (!colocado && timesCompletos < times.length) {
                for (let i = timesCompletos; i < times.length; i++) {
                    if (jogadoresPorNivel[nivel].length > 0) {
                        const jogador = jogadoresPorNivel[nivel].shift();
                        times[i].jogadores.push(jogador);
                        console.log(`  + ${jogador.nome} (${nivel}⭐) -> ${times[i].nome} (INCOMPLETO)`);
                        break;
                    }
                }
            }
            
            if (!colocado && jogadoresPorNivel[nivel].length > 0) {
                break; // Não conseguiu colocar, sair do loop
            }
        }
    });
    
    console.log('Times após distribuição equilibrada:');
    times.forEach(time => {
        const niveis = time.jogadores.map(j => j.nivel_habilidade || 3);
        const contagem = niveis.reduce((acc, n) => { acc[n] = (acc[n] || 0) + 1; return acc; }, {});
        console.log(`${time.nome}: ${time.jogadores.length} jogadores - ${JSON.stringify(contagem)}`);
    });
}

// Função de sorteio equilibrado COM REGRAS
function aplicarSorteioEquilibrado(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== SORTEIO EQUILIBRADO COM REGRAS ===');
    
    // Criar array com todos os jogadores
    const todosJogadores = [];
    [5, 4, 3, 2, 1].forEach(nivel => {
        jogadoresPorNivel[nivel].forEach(jogador => {
            todosJogadores.push(jogador);
        });
    });
    
    const totalJogadores = todosJogadores.length;
    const timesCompletos = Math.floor(totalJogadores / jogadoresPorTime);
    const jogadoresRestantes = totalJogadores % jogadoresPorTime;
    
    console.log(`Total: ${totalJogadores} jogadores`);
    console.log(`Regra: ${jogadoresPorTime} jogadores por time`);
    console.log(`Formando: ${timesCompletos} times completos + ${jogadoresRestantes > 0 ? '1 incompleto' : '0 incompleto'}`);
    
    // FASE 1: PREENCHER TIMES COMPLETOS (6 jogadores cada)
    let jogadorIndex = 0;
    
    // Preencher times completos usando serpentina
    for (let rodada = 0; rodada < jogadoresPorTime; rodada++) {
        console.log(`\n--- RODADA ${rodada + 1} (preenchendo times completos) ---`);
        
        // Ida: Time 0 → Time (timesCompletos-1)
        for (let t = 0; t < timesCompletos && jogadorIndex < totalJogadores; t++) {
            if (times[t].jogadores.length < jogadoresPorTime) {
                const jogador = todosJogadores[jogadorIndex];
                times[t].jogadores.push(jogador);
                console.log(`${jogadorIndex + 1}º: ${jogador.nome} (${jogador.nivel_habilidade || 3}⭐) → ${times[t].nome} (${times[t].jogadores.length}/${jogadoresPorTime})`);
                jogadorIndex++;
            }
        }
        
        // Volta: Time (timesCompletos-1) → Time 0 (se ainda há jogadores)
        if (rodada < jogadoresPorTime - 1) {
            for (let t = timesCompletos - 1; t >= 0 && jogadorIndex < totalJogadores; t--) {
                if (times[t].jogadores.length < jogadoresPorTime) {
                    const jogador = todosJogadores[jogadorIndex];
                    times[t].jogadores.push(jogador);
                    console.log(`${jogadorIndex + 1}º: ${jogador.nome} (${jogador.nivel_habilidade || 3}⭐) → ${times[t].nome} (${times[t].jogadores.length}/${jogadoresPorTime})`);
                    jogadorIndex++;
                }
            }
            rodada++; // Pular uma rodada pois já fez ida e volta
        }
    }
    
    // FASE 2: COLOCAR JOGADORES RESTANTES NO ÚLTIMO TIME (INCOMPLETO)
    if (jogadorIndex < totalJogadores && times.length > timesCompletos) {
        console.log(`\n--- PREENCHENDO TIME INCOMPLETO ---`);
        const timeIncompleto = times[timesCompletos];
        
        while (jogadorIndex < totalJogadores) {
            const jogador = todosJogadores[jogadorIndex];
            timeIncompleto.jogadores.push(jogador);
            console.log(`${jogadorIndex + 1}º: ${jogador.nome} (${jogador.nivel_habilidade || 3}⭐) → ${timeIncompleto.nome} (INCOMPLETO - ${timeIncompleto.jogadores.length} jogadores)`);
            jogadorIndex++;
        }
    }
    
    // RESULTADO FINAL
    console.log('\n=== TIMES FINAIS ===');
    times.forEach((time, index) => {
        if (time.jogadores.length > 0) {
            const niveis = time.jogadores.map(j => j.nivel_habilidade || 3);
            const soma = niveis.reduce((sum, n) => sum + n, 0);
            const media = (soma / niveis.length).toFixed(1);
            const status = time.jogadores.length === jogadoresPorTime ? 'COMPLETO' : 'INCOMPLETO';
            
            console.log(`${time.nome}: ${time.jogadores.length} jogadores (${status}) - Média: ${media}⭐`);
        }
    });
}

// Distribuir jogadores restantes
function distribuirRestantes(jogadoresPorNivel, times, jogadoresPorTime) {
    console.log('=== DISTRIBUINDO JOGADORES RESTANTES ===');
    let timeAtual = 0;
    
    [5, 4, 3, 2, 1].forEach(nivel => {
        console.log(`Distribuindo jogadores nível ${nivel}: ${jogadoresPorNivel[nivel].length} restantes`);
        
        while (jogadoresPorNivel[nivel].length > 0) {
            // Primeiro tentar preencher times incompletos
            let encontrou = false;
            for (let i = 0; i < times.length; i++) {
                const index = (timeAtual + i) % times.length;
                if (times[index].jogadores.length < jogadoresPorTime) {
                    const jogador = jogadoresPorNivel[nivel].shift();
                    times[index].jogadores.push(jogador);
                    console.log(`  + ${jogador.nome} (${nivel}⭐) -> ${times[index].nome}`);
                    timeAtual = (index + 1) % times.length;
                    encontrou = true;
                    break;
                }
            }
            
            // Se todos os times estão cheios, distribuir mesmo assim (times ficam com mais jogadores)
            if (!encontrou && jogadoresPorNivel[nivel].length > 0) {
                const index = timeAtual % times.length;
                const jogador = jogadoresPorNivel[nivel].shift();
                times[index].jogadores.push(jogador);
                console.log(`  + ${jogador.nome} (${nivel}⭐) -> ${times[index].nome} (EXTRA)`);
                timeAtual = (timeAtual + 1) % times.length;
            }
        }
    });
    
    console.log('Times finais:');
    times.forEach(time => {
        console.log(`${time.nome}: ${time.jogadores.length} jogadores`);
    });
}

// Exibir resultado do sorteio
function exibirResultado() {
    console.log('=== EXIBINDO RESULTADO ===');
    console.log('Times formados:', timesFormados.map(t => `${t.nome}: ${t.jogadores.length} jogadores`));
    
    // Filtrar apenas times que têm jogadores
    const timesComJogadores = timesFormados.filter(time => time.jogadores.length > 0);
    console.log(`Exibindo ${timesComJogadores.length} times com jogadores`);
    
    teamsContainer.innerHTML = timesComJogadores.map(time => `
        <div class="team-card">
            <div class="team-header">
                <div class="team-name">${time.cores} ${time.nome}</div>
                <div class="team-average">
                    ⭐ ${time.nivelMedio}
                    <small>(${time.jogadores.length} jogadores)</small>
                </div>
            </div>
            <div class="team-players">
                ${time.jogadores.map(jogador => {
                    return `
                        <div class="team-player">
                            <span class="team-player-name">${jogador.nome}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
    
    // Mostrar resultado e botões
    resultadoSorteio.style.display = 'block';
    btnSortear.style.display = 'none';
    btnResort.style.display = 'block';
    
    // Scroll para o resultado
    resultadoSorteio.scrollIntoView({ behavior: 'smooth' });
}

// Confirmar times
async function confirmarTimes() {
    // TELA DE SENHA PARA INICIAR PELADA
    const senhaCorreta = await solicitarSenhaIniciarPelada();
    
    if (!senhaCorreta) {
        return; // Usuário cancelou ou senha incorreta
    }
    
    try {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = `
            <span class="emoji">⏳</span>
            <span>Iniciando Pelada...</span>
        `;
        
        console.log('=== INICIANDO PELADA ===');
        
        // Verificar se o sorteio foi feito
        if (!timesFormados || timesFormados.length === 0) {
            throw new Error('Faça o sorteio primeiro antes de confirmar os times');
        }
        
        // 1. LIMPAR FILA ATUAL (caso haja conflito de datas)
        console.log('Limpando fila atual...');
        const limparFila = await Database.limparFila();
        if (!limparFila.success) {
            console.warn('Aviso ao limpar fila:', limparFila.error);
        }
        
        // 2. CRIAR FILA ATIVA COM JOGADORES SORTEADOS
        console.log('Criando fila ativa...');
        const filaAtiva = [];
        let posicaoFila = 1;
        
        // Adicionar jogadores dos times na ordem: Time1(1-6), Time2(1-6), Time3(1-6), etc.
        timesFormados.forEach((time, timeIndex) => {
            console.log(`Adicionando ${time.nome} à fila (${time.jogadores.length} jogadores)`);
            
            time.jogadores.forEach((jogador, jogadorIndex) => {
                filaAtiva.push({
                    jogador_id: jogador.id,
                    posicao: posicaoFila,
                    status: 'fila',
                    time_origem: timeIndex + 1,
                    posicao_time: jogadorIndex + 1
                });
                
                console.log(`  ${posicaoFila}º na fila: ${jogador.nome} (${time.nome} - posição ${jogadorIndex + 1})`);
                posicaoFila++;
            });
        });
        
        // 3. ADICIONAR JOGADORES NÃO SELECIONADOS COMO RESERVA
        console.log('Adicionando jogadores não selecionados como reserva...');
        
        // Verificar se as variáveis estão definidas
        console.log('Debug - jogadoresDisponiveis:', jogadoresDisponiveis?.length);
        console.log('Debug - jogadoresSelecionados:', jogadoresSelecionados?.length);
        console.log('Debug - timesFormados:', timesFormados?.length);
        
        if (!jogadoresDisponiveis || !jogadoresSelecionados) {
            throw new Error('Erro: dados dos jogadores não encontrados');
        }
        
        const jogadoresReserva = jogadoresDisponiveis.filter(jogador => 
            !jogadoresSelecionados.includes(jogador.id.toString())
        );
        
        jogadoresReserva.forEach(jogador => {
            filaAtiva.push({
                jogador_id: jogador.id,
                posicao: posicaoFila,
                status: 'reserva',
                time_origem: null,
                posicao_time: null
            });
            
            console.log(`  ${posicaoFila}º na fila: ${jogador.nome} (RESERVA)`);
            posicaoFila++;
        });
        
        // 4. CRIAR SESSÃO DA PELADA PRIMEIRO
        console.log('Criando sessão da pelada...');
        
        // Verificar se os times foram formados corretamente
        if (!timesFormados || timesFormados.length < 2) {
            throw new Error('Erro ao formar times. Tente novamente.');
        }
        
        // Calcular jogadores em campo (primeiros 2 times)
        const time1Jogadores = timesFormados[0]?.jogadores?.length || 0;
        const time2Jogadores = timesFormados[1]?.jogadores?.length || 0;
        const jogadoresEmCampo = time1Jogadores + time2Jogadores;
        const jogadoresNaFila = jogadoresSelecionados.length - jogadoresEmCampo;
        
        const sessaoData = {
            data: new Date().toISOString().split('T')[0], // Apenas a data no formato YYYY-MM-DD
            total_jogadores: jogadoresSelecionados.length,
            status: 'ativa',
            observacoes: `Pelada com ${jogadoresEmCampo} jogadores em campo e ${jogadoresNaFila} na fila`
        };
        
        const resultadoSessao = await Database.criarSessao(sessaoData);
        if (!resultadoSessao.success) {
            throw new Error(resultadoSessao.error);
        }
        
        const sessaoId = resultadoSessao.data[0].id;
        console.log('✅ Sessão criada com ID:', sessaoId);
        
        // 5. SALVAR FILA NO BANCO DE DADOS
        console.log(`Salvando fila completa (${filaAtiva.length} jogadores)...`);
        for (const itemFila of filaAtiva) {
            // Garantir que o status é válido
            let statusValido = itemFila.status;
            if (!['fila', 'reserva'].includes(statusValido)) {
                statusValido = 'fila'; // Padrão seguro
            }
            
            const resultado = await Database.adicionarJogadorFila(
                sessaoId,
                itemFila.jogador_id,
                itemFila.posicao,
                statusValido
            );
            
            if (!resultado.success) {
                console.error(`Erro ao adicionar jogador ${itemFila.jogador_id} à fila:`, resultado.error);
            }
        }
        
        // 6. SUCESSO!
        console.log('✅ PELADA INICIADA COM SUCESSO!');
        mostrarMensagem('🚀 Pelada iniciada com sucesso!\nRedirecionando para a fila!', 'success');
        
        setTimeout(() => {
            window.location.href = 'fila.html';
        }, 2500);
        
    } catch (error) {
        console.error('❌ Erro ao iniciar pelada:', error);
        mostrarMensagem('❌ Erro ao iniciar pelada: ' + error.message, 'error');
        
        // Restaurar botão
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = `
            <span class="emoji">✅</span>
            <span>Confirmar Times</span>
        `;
    }
}

// Mostrar loading
function mostrarLoading(mensagem) {
    teamsContainer.innerHTML = `
        <div class="loading-state">
            <span class="emoji">🎲</span>
            <p>${mensagem}</p>
        </div>
    `;
    resultadoSorteio.style.display = 'block';
}

// Mostrar mensagem
function mostrarMensagem(mensagem, tipo = 'info') {
    const cores = {
        success: '#28a745',
        error: '#dc3545',
        warning: '#ffc107',
        info: '#2d8f2d'
    };
    
    const div = document.createElement('div');
    div.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${cores[tipo] || cores.info};
        color: ${tipo === 'warning' ? '#000' : 'white'};
        padding: 12px 24px;
        border-radius: 12px;
        font-weight: 500;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    div.textContent = mensagem;
    
    document.body.appendChild(div);
    
    setTimeout(() => {
        div.remove();
    }, 4000);
}

// Função para solicitar senha antes de iniciar pelada
async function solicitarSenhaIniciarPelada() {
    return new Promise((resolve) => {
        // Criar modal de senha
        const modal = document.createElement('div');
        modal.className = 'modal-senha';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🔐 Confirmação de Segurança</h3>
                        <p>Digite sua senha de usuário para iniciar a pelada</p>
                    </div>
                    
                    <div class="modal-body">
                        <div class="warning-box">
                            <span class="emoji">⚠️</span>
                            <div>
                                <strong>ATENÇÃO:</strong>
                                <p>Isto irá limpar a fila atual e iniciar uma nova pelada.</p>
                            </div>
                        </div>
                        
                        <div class="input-group">
                            <label for="senha-pelada">Sua senha de usuário:</label>
                            <input type="password" id="senha-pelada" placeholder="Digite sua senha" maxlength="20">
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button id="btn-cancelar-senha" class="btn-secondary">
                            <span class="emoji">❌</span>
                            <span>Cancelar</span>
                        </button>
                        <button id="btn-confirmar-senha" class="btn-primary">
                            <span class="emoji">🚀</span>
                            <span>Iniciar Pelada</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Adicionar modal ao DOM
        document.body.appendChild(modal);
        
        // Focar no input de senha
        const inputSenha = document.getElementById('senha-pelada');
        const btnConfirmar = document.getElementById('btn-confirmar-senha');
        const btnCancelar = document.getElementById('btn-cancelar-senha');
        
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

            try {
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
                    
                    // Verificar se a senha está correta
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
            } catch (error) {
                console.error('Erro ao conectar com banco:', error);
                alert('Erro de conexão');
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
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(modal);
                resolve(false);
            }
        });
    });
}

// ========================================
// NOVAS FUNÇÕES PARA SORTEIO INDIVIDUAL
// ========================================

// Verificar padrões individualmente para um time
function podeAplicarPadrao1Individual(count) {
    return count[5] >= 1 && count[4] >= 2 && count[3] >= 2 && (count[1] + count[2]) >= 1;
}

function podeAplicarPadrao2Individual(count) {
    return count[5] >= 1 && count[4] >= 3 && (count[1] + count[2]) >= 2;
}

function podeAplicarPadrao3Individual(count) {
    return count[5] >= 1 && count[4] >= 1 && count[3] >= 3 && (count[1] + count[2]) >= 1;
}

function podeAplicarPadrao4Individual(count) {
    return count[4] >= 3 && count[3] >= 2 && (count[1] + count[2]) >= 1;
}

function podeAplicarPadrao5Individual(count) {
    return count[5] >= 1 && count[4] >= 2 && count[3] >= 1 && (count[1] + count[2]) >= 2;
}

function podeAplicarPadrao6Individual(count) {
    return count[4] >= 1 && count[3] >= 5;
}

function podeAplicarPadrao7Individual(count) {
    return count[5] >= 1 && count[3] >= 4 && (count[1] + count[2]) >= 1;
}

// Aplicar padrão individual para um time específico
function aplicarPadraoIndividual(jogadoresPorNivel, time, padrao) {
    console.log(`Aplicando padrão individual: 5⭐=${padrao[5]}, 4⭐=${padrao[4]}, 3⭐=${padrao[3]}, baixo=${padrao.baixo}`);
    
    // Aplicar 5 estrelas
    for (let i = 0; i < padrao[5] && jogadoresPorNivel[5].length > 0; i++) {
        const jogador = jogadoresPorNivel[5].shift();
        time.jogadores.push(jogador);
        console.log(`  + ${jogador.nome} (5⭐)`);
    }
    
    // Aplicar 4 estrelas
    for (let i = 0; i < padrao[4] && jogadoresPorNivel[4].length > 0; i++) {
        const jogador = jogadoresPorNivel[4].shift();
        time.jogadores.push(jogador);
        console.log(`  + ${jogador.nome} (4⭐)`);
    }
    
    // Aplicar 3 estrelas
    for (let i = 0; i < padrao[3] && jogadoresPorNivel[3].length > 0; i++) {
        const jogador = jogadoresPorNivel[3].shift();
        time.jogadores.push(jogador);
        console.log(`  + ${jogador.nome} (3⭐)`);
    }
    
    // Aplicar jogadores baixos (2 ou 1 estrelas)
    for (let i = 0; i < padrao.baixo; i++) {
        if (jogadoresPorNivel[2].length > 0) {
            const jogador = jogadoresPorNivel[2].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (2⭐)`);
        } else if (jogadoresPorNivel[1].length > 0) {
            const jogador = jogadoresPorNivel[1].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (1⭐)`);
        }
    }
}

// Preencher time com jogadores restantes (fallback individual)
function preencherTimeComRestantes(jogadoresPorNivel, time, jogadoresPorTime) {
    console.log(`Preenchendo ${time.nome} com jogadores restantes...`);
    
    // Preencher até atingir o número de jogadores por time
    const niveis = [5, 4, 3, 2, 1];
    let nivelAtual = 0;
    
    while (time.jogadores.length < jogadoresPorTime && nivelAtual < niveis.length) {
        const nivel = niveis[nivelAtual];
        
        if (jogadoresPorNivel[nivel].length > 0) {
            const jogador = jogadoresPorNivel[nivel].shift();
            time.jogadores.push(jogador);
            console.log(`  + ${jogador.nome} (${nivel}⭐) [RESTANTE]`);
        } else {
            nivelAtual++;
        }
    }
    
    console.log(`${time.nome} preenchido com ${time.jogadores.length} jogadores`);
}

// NOVA FUNÇÃO: Sorteio inteligente individual por time
function executarSorteioInteligenteIndividual(jogadoresPorNivel, times, jogadoresPorTime) {
    const numeroTimes = times.length;
    
    console.log('=== SORTEIO INDIVIDUAL POR TIME COM ALEATORIEDADE ===');
    console.log(`Formando ${numeroTimes} times com ${jogadoresPorTime} jogadores cada`);
    
    // 🎲 ALEATORIEDADE: Embaralhar todos os níveis antes de começar
    console.log('🎲 Embaralhando jogadores para garantir aleatoriedade...');
    Object.keys(jogadoresPorNivel).forEach(nivel => {
        jogadoresPorNivel[nivel] = embaralharArray(jogadoresPorNivel[nivel]);
        console.log(`Nível ${nivel}⭐: ${jogadoresPorNivel[nivel].length} jogadores embaralhados`);
    });
    
    // 🏆 APLICAR PADRÕES INDIVIDUAIS PARA CADA TIME
    for (let i = 0; i < numeroTimes; i++) {
        const time = times[i];
        console.log(`\n=== MONTANDO ${time.nome} ===`);
        
        // Contar jogadores restantes
        const countAtual = {
            5: jogadoresPorNivel[5].length,
            4: jogadoresPorNivel[4].length,
            3: jogadoresPorNivel[3].length,
            2: jogadoresPorNivel[2].length,
            1: jogadoresPorNivel[1].length
        };
        
        console.log(`Restantes: 5⭐=${countAtual[5]}, 4⭐=${countAtual[4]}, 3⭐=${countAtual[3]}, 2⭐=${countAtual[2]}, 1⭐=${countAtual[1]}`);
        
        // Tentar padrões em ordem de prioridade
        let padraoAplicado = false;
        
        if (!padraoAplicado && podeAplicarPadrao1Individual(countAtual)) {
            console.log(`✅ Padrão 1 no ${time.nome}: 1×5⭐ + 2×4⭐ + 2×3⭐ + 1×baixo`);
            aplicarPadraoIndividual(jogadoresPorNivel, time, {5: 1, 4: 2, 3: 2, baixo: 1});
            padraoAplicado = true;
        }
        else if (!padraoAplicado && podeAplicarPadrao2Individual(countAtual)) {
            console.log(`✅ Padrão 2 no ${time.nome}: 1×5⭐ + 3×4⭐ + 2×baixo`);
            aplicarPadraoIndividual(jogadoresPorNivel, time, {5: 1, 4: 3, 3: 0, baixo: 2});
            padraoAplicado = true;
        }
        else if (!padraoAplicado && podeAplicarPadrao3Individual(countAtual)) {
            console.log(`✅ Padrão 3 no ${time.nome}: 1×5⭐ + 1×4⭐ + 3×3⭐ + 1×baixo`);
            aplicarPadraoIndividual(jogadoresPorNivel, time, {5: 1, 4: 1, 3: 3, baixo: 1});
            padraoAplicado = true;
        }
        else if (!padraoAplicado && podeAplicarPadrao4Individual(countAtual)) {
            console.log(`✅ Padrão 4 no ${time.nome}: 3×4⭐ + 2×3⭐ + 1×baixo`);
            aplicarPadraoIndividual(jogadoresPorNivel, time, {5: 0, 4: 3, 3: 2, baixo: 1});
            padraoAplicado = true;
        }
        else if (!padraoAplicado && podeAplicarPadrao5Individual(countAtual)) {
            console.log(`✅ Padrão 5 no ${time.nome}: 1×5⭐ + 2×4⭐ + 1×3⭐ + 2×baixo`);
            aplicarPadraoIndividual(jogadoresPorNivel, time, {5: 1, 4: 2, 3: 1, baixo: 2});
            padraoAplicado = true;
        }
        else if (!padraoAplicado && podeAplicarPadrao6Individual(countAtual)) {
            console.log(`✅ Padrão 6 no ${time.nome}: 1×4⭐ + 5×3⭐`);
            aplicarPadraoIndividual(jogadoresPorNivel, time, {5: 0, 4: 1, 3: 5, baixo: 0});
            padraoAplicado = true;
        }
        else if (!padraoAplicado && podeAplicarPadrao7Individual(countAtual)) {
            console.log(`✅ Padrão 7 no ${time.nome}: 1×5⭐ + 4×3⭐ + 1×baixo`);
            aplicarPadraoIndividual(jogadoresPorNivel, time, {5: 1, 4: 0, 3: 4, baixo: 1});
            padraoAplicado = true;
        }
        
        // Fallback individual
        if (!padraoAplicado) {
            console.log(`🔄 Fallback individual para ${time.nome}`);
            preencherTimeComRestantes(jogadoresPorNivel, time, jogadoresPorTime);
        }
    }
    
    // Log final
    console.log('\n=== TIMES FINAIS ===');
    times.forEach(time => {
        if (time.jogadores.length > 0) {
            const niveis = time.jogadores.map(j => j.nivel_habilidade || 3);
            const soma = niveis.reduce((sum, n) => sum + n, 0);
            const media = (soma / niveis.length).toFixed(1);
            console.log(`${time.nome}: ${time.jogadores.length} jogadores - Total: ${soma} pts - Média: ${media}⭐`);
        }
    });
}