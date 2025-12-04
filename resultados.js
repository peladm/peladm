// Elementos DOM
const btnHoje = document.getElementById('btn-hoje');
const selectDatas = document.getElementById('select-datas');
const totalPartidas = document.getElementById('total-partidas');
const totalGols = document.getElementById('total-gols');
const totalJogadores = document.getElementById('total-jogadores');
const btnPartidas = document.getElementById('btn-partidas');
const btnGols = document.getElementById('btn-gols');
const btnJogadores = document.getElementById('btn-jogadores');
const btnEstatisticas = document.getElementById('btn-estatisticas');
const loading = document.getElementById('loading');
const partidasSection = document.getElementById('partidas-section');
const emptyState = document.getElementById('empty-state');

// Estado da aplicação
let todasPartidas = [];
let jogadores = [];
let datasDisponiveis = [];
let partidasFiltradas = []; // Para os modais

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    await carregarDados();
    configurarEventos();
    aplicarFiltro('hoje');
    
    // Configurar botão admin baseado no usuário logado
    configurarBotaoAdmin();
    
    // Configurar botão home baseado no usuário logado
    configurarBotaoHome();
    
    // Verificar se deve abrir modal admin automaticamente
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('openAdminModal') === 'true') {
        // Só abrir se for admin
        if (isAdmin()) {
            // Aguardar um pouco para garantir que tudo carregou
            setTimeout(() => {
                mostrarModalApagarDia();
            }, 500);
        }
        
        // Limpar o parâmetro da URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }
});

// Configurar eventos
function configurarEventos() {
    // Botão hoje
    btnHoje.addEventListener('click', () => {
        aplicarFiltro('hoje');
        selectDatas.value = '';
        btnHoje.classList.add('active');
    });
    
    // Seletor de datas
    selectDatas.addEventListener('change', (e) => {
        if (e.target.value) {
            aplicarFiltro('data', e.target.value);
            btnHoje.classList.remove('active');
        } else {
            aplicarFiltro('hoje');
            btnHoje.classList.add('active');
        }
    });
    
    // Botão de estatísticas
    btnEstatisticas.addEventListener('click', () => {
        window.location.href = 'estatisticas.html';
    });
    
    // Botão de partidas
    btnPartidas.addEventListener('click', () => {
        window.location.reload();
    });
    
    // Botão de jogadores
    btnJogadores.addEventListener('click', () => {
        mostrarModalJogadores();
    });
    
    // Botão de gols
    btnGols.addEventListener('click', () => {
        mostrarModalGols();
    });

    // Botão de exportar imagem
    const btnExportar = document.getElementById('btn-exportar');
    if (btnExportar) {
        btnExportar.addEventListener('click', exportarComoImagem);
    }
}

// Preencher datas disponíveis
function preencherDatasDisponiveis() {
    console.log('Preenchendo datas disponíveis. Total de partidas:', todasPartidas.length);
    
    // Obter datas únicas das partidas
    const datasUnicas = [...new Set(todasPartidas.map(partida => {
        const data = new Date(partida.created_at);
        return data.toISOString().split('T')[0];
    }))].sort().reverse(); // Mais recentes primeira

    console.log('Datas únicas encontradas:', datasUnicas);

    // Limpar select
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
    
    datasDisponiveis = datasUnicas;
    console.log('Select preenchido com', datasUnicas.length, 'datas');
}

// Carregar dados do banco
async function carregarDados() {
    try {
        mostrarLoading(true);
        
        // Garantir que o client está inicializado
        if (!client) {
            client = initializeSupabase();
            if (!client) {
                throw new Error('Não foi possível inicializar o Supabase');
            }
        }
        
        // Carregar todas as partidas primeiro para debug
        const { data: todasPartidasBanco, error: todasPartidasError } = await client
            .from('jogos')
            .select('*')
            .order('created_at', { ascending: false });

        if (todasPartidasError) {
            console.error('Erro ao carregar todas as partidas:', todasPartidasError);
            throw todasPartidasError;
        }

        console.log('Todas as partidas do banco:', todasPartidasBanco);
        console.log('Status das partidas:', todasPartidasBanco?.map(p => ({ id: p.id, status: p.status, data: p.created_at })));
        
        // Debug: verificar campos de substituições
        console.log('🔍 DEBUG Substituições nas partidas:', todasPartidasBanco?.map(p => ({
            id: p.id,
            status: p.status,
            temSubstituicoes: !!p.substituicoes,
            substituicoes: p.substituicoes,
            colunas: Object.keys(p)
        })));

        // Filtrar apenas as finalizadas
        const partidasFinalizadas = todasPartidasBanco?.filter(p => p.status === 'finalizado') || [];
        
        console.log('Partidas finalizadas encontradas:', partidasFinalizadas);

        // Carregar jogadores
        const { data: jogadoresData, error: jogadoresError } = await client
            .from('jogadores')
            .select('*');

        if (jogadoresError) throw jogadoresError;

        todasPartidas = partidasFinalizadas;
        jogadores = jogadoresData || [];

        console.log('Dados finais carregados:', { 
            partidas: todasPartidas.length, 
            jogadores: jogadores.length,
            primeiraPartida: todasPartidas[0]
        });

        // Preencher datas disponíveis após carregar os dados
        preencherDatasDisponiveis();

    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        mostrarErro('Erro ao carregar dados das partidas');
    } finally {
        mostrarLoading(false);
    }
}

// Aplicar filtro
function aplicarFiltro(tipo, dataEspecificaValue = null) {
    let partidasFiltradas = [];
    
    if (tipo === 'hoje') {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const fimHoje = new Date();
        fimHoje.setHours(23, 59, 59, 999);
        
        partidasFiltradas = todasPartidas.filter(partida => {
            const dataPartida = new Date(partida.created_at);
            return dataPartida >= hoje && dataPartida <= fimHoje;
        });
    } else if (tipo === 'data' && dataEspecificaValue) {
        const dataFiltro = new Date(dataEspecificaValue + 'T00:00:00');
        const fimDataFiltro = new Date(dataEspecificaValue + 'T23:59:59');
        
        partidasFiltradas = todasPartidas.filter(partida => {
            const dataPartida = new Date(partida.created_at);
            return dataPartida >= dataFiltro && dataPartida <= fimDataFiltro;
        });
    }
    
    renderizarResultados(partidasFiltradas);
}

// Renderizar resultados
async function renderizarResultados(partidas) {
    try {
        // Salvar partidas filtradas para os modais
        partidasFiltradas = partidas;
        
        // Atualizar resumo
        await atualizarResumo(partidas);
        
        // Verificar se há partidas
        if (partidas.length === 0) {
            partidasSection.innerHTML = '';
            emptyState.style.display = 'block';
            // Esconder botão de exportar
            const exportSection = document.getElementById('export-section');
            if (exportSection) {
                exportSection.style.display = 'none';
            }
            return;
        }
        
        emptyState.style.display = 'none';
        
        // Carregar gols para todas as partidas
        const partidasComGols = await Promise.all(
            partidas.map(async (partida) => {
                const gols = await carregarGolsPartida(partida.id);
                return { ...partida, gols };
            })
        );
        
        // Renderizar partidas
        partidasSection.innerHTML = partidasComGols.map(partida => 
            criarCardPartida(partida)
        ).join('');
        
        // Mostrar botão de exportar se há partidas
        const exportSection = document.getElementById('export-section');
        if (exportSection) {
            exportSection.style.display = 'flex';
        }
        
    } catch (error) {
        console.error('Erro ao renderizar resultados:', error);
        mostrarErro('Erro ao exibir resultados');
    }
}

// Atualizar resumo
async function atualizarResumo(partidas) {
    const numPartidas = partidas.length;
    let numGols = 0;
    const jogadoresUnicos = new Set();
    
    for (const partida of partidas) {
        // Contar gols
        const gols = await carregarGolsPartida(partida.id);
        numGols += gols.length;
        
        // Contar jogadores únicos
        if (partida.time_a) {
            partida.time_a.forEach(id => jogadoresUnicos.add(id));
        }
        if (partida.time_b) {
            partida.time_b.forEach(id => jogadoresUnicos.add(id));
        }
    }
    
    // Atualizar interface
    totalPartidas.textContent = numPartidas;
    totalGols.textContent = numGols;
    totalJogadores.textContent = jogadoresUnicos.size;
}

// Carregar gols de uma partida
async function carregarGolsPartida(partidaId) {
    try {
        if (!client) {
            client = initializeSupabase();
        }
        
        const { data: gols, error } = await client
            .from('gols')
            .select('*')
            .eq('jogo_id', partidaId);

        if (error) throw error;
        return gols || [];
    } catch (error) {
        console.error('Erro ao carregar gols:', error);
        return [];
    }
}

// Criar card de partida
function criarCardPartida(partida) {
    const dataPartida = new Date(partida.created_at);
    const dataFormatada = dataPartida.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const horaFormatada = dataPartida.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit'
    });

    // Calcular duração
    let duracaoTexto = 'N/A';
    if (partida.data_fim) {
        const inicio = new Date(partida.created_at);
        const fim = new Date(partida.data_fim);
        const diferencaMs = fim - inicio;
        const minutos = Math.floor(diferencaMs / 60000);
        const segundos = Math.floor((diferencaMs % 60000) / 1000);
        if (minutos > 0 || segundos > 0) {
            duracaoTexto = `⏱️ ${minutos}min ${segundos}s`;
        }
    }

    // Contar gols por time
    const golsTimeA = partida.gols?.filter(g => g.time === 'A').length || 0;
    const golsTimeB = partida.gols?.filter(g => g.time === 'B').length || 0;

    // Determinar vencedor
    let classVencedorA = '', classVencedorB = '';
    if (golsTimeA > golsTimeB) {
        classVencedorA = 'vencedor';
    } else if (golsTimeB > golsTimeA) {
        classVencedorB = 'vencedor';
    }

    // Estatísticas da partida
    const totalGolsPartida = partida.gols?.length || 0;
    const totalJogadoresPartida = (partida.time_a?.length || 0) + (partida.time_b?.length || 0);
    const mediaGolsPartida = totalJogadoresPartida > 0 ? (totalGolsPartida / totalJogadoresPartida).toFixed(1) : '0.0';

    return `
        <div class="partida-card">
            <!-- Header -->
            <div class="partida-header">
                <div class="partida-info">
                    <div class="partida-data">${dataFormatada}</div>
                    <div class="partida-hora">${horaFormatada}</div>
                </div>
                <div class="partida-duracao">${duracaoTexto}</div>
            </div>

            <!-- Placar -->
            <div class="partida-placar">
                <div class="placar">
                    <div class="time ${classVencedorA}">
                        <div class="time-gols">${golsTimeA}</div>
                    </div>
                    <div class="vs">×</div>
                    <div class="time ${classVencedorB}">
                        <div class="time-gols">${golsTimeB}</div>
                    </div>
                </div>
            </div>

            ${renderizarJogadoresPartida(partida)}
        </div>
    `;
}

// Renderizar jogadores da partida
function renderizarJogadoresPartida(partida) {
    const timeA = partida.time_a || [];
    const timeB = partida.time_b || [];
    const gols = partida.gols || [];
    
    // Debug: verificar se substituições existem
    console.log('🔍 DEBUG Substituições:', {
        partidaId: partida.id,
        temSubstituicoes: !!partida.substituicoes,
        substituicoesRaw: partida.substituicoes,
        tipoSubstituicoes: typeof partida.substituicoes
    });
    
    // Carregar substituições se existirem
    let substituicoes = [];
    if (partida.substituicoes) {
        try {
            if (typeof partida.substituicoes === 'string') {
                substituicoes = JSON.parse(partida.substituicoes);
            } else if (Array.isArray(partida.substituicoes)) {
                substituicoes = partida.substituicoes;
            }
            console.log('🔄 Substituições carregadas:', substituicoes);
            console.log('🔍 Estrutura detalhada das substituições:', substituicoes.map(sub => ({
                jogador_saiu: sub.jogador_saiu,
                jogador_entrou: sub.jogador_entrou,
                time: sub.time,
                id_saiu: sub.jogador_saiu?.id,
                id_entrou: sub.jogador_entrou?.id
            })));
            console.log('🏟️ Times da partida:', {
                timeA: timeA,
                timeB: timeB
            });
        } catch (error) {
            console.warn('Erro ao carregar substituições:', error);
            substituicoes = [];
        }
    } else {
        console.log('❌ Nenhuma substituição encontrada para partida', partida.id);
    }

    if (timeA.length === 0 && timeB.length === 0) {
        return '';
    }

    // Criar map de jogadores que fizeram gols por time
    const golsPorJogador = {};
    gols.forEach(gol => {
        if (!golsPorJogador[gol.jogador_id]) {
            golsPorJogador[gol.jogador_id] = 0;
        }
        golsPorJogador[gol.jogador_id]++;
    });

    // Função para renderizar jogador com possível substituição
    function renderizarJogador(jogadorId, time) {
        const nomeJogador = obterNomeJogador(jogadorId);
        const numGols = golsPorJogador[jogadorId] || 0;
        const bolasGol = numGols > 0 ? '⚽'.repeat(numGols) + ' ' : '';
        
        console.log(`🔍 Renderizando jogador ${jogadorId} (${nomeJogador}) do time ${time}`);
        
        // Verificar se este jogador foi substituído (sem depender do campo 'time')
        const substituicao = substituicoes.find(sub => {
            const jogadorSaiuId = sub.jogador_saiu?.id || sub.jogadorSaiu;
            console.log(`🔍 Comparando substituição: ${jogadorId} === ${jogadorSaiuId}`);
            
            // Verificar se o jogador que saiu está no time atual sendo renderizado
            const jogadorEstaNoTime = (time === 'A' ? timeA : timeB).includes(jogadorId);
            
            return jogadorSaiuId === jogadorId && jogadorEstaNoTime;
        });
        
        if (substituicao) {
            console.log(`🔄 SUBSTITUIÇÃO ENCONTRADA!`, substituicao);
            const jogadorEntrouId = substituicao.jogador_entrou?.id || substituicao.jogadorEntrou;
            const nomeSubstituto = obterNomeJogador(jogadorEntrouId);
            const golsSubstituto = golsPorJogador[jogadorEntrouId] || 0;
            const bolasGolSubstituto = golsSubstituto > 0 ? '⚽'.repeat(golsSubstituto) + ' ' : '';
            
            return `
                <div class="jogador-substituido">
                    <div class="jogador-nome jogador-saiu">${bolasGol}${nomeJogador}</div>
                    <div class="jogador-nome jogador-entrou">${bolasGolSubstituto}${nomeSubstituto}</div>
                </div>
            `;
        }
        
        // Verificar se este jogador entrou como substituto (não mostrar duplicado)
        const jaEhSubstituto = substituicoes.some(sub => {
            const jogadorEntrouId = sub.jogador_entrou?.id || sub.jogadorEntrou;
            // Verificar se o substituto fez gol (pode não estar na lista original do time)
            return jogadorEntrouId === jogadorId;
        });
        
        if (jaEhSubstituto) {
            console.log(`➡️ Jogador ${nomeJogador} é um substituto, não será mostrado duplicado`);
            return ''; // Já será mostrado como substituto acima
        }
        
        return `<div class="jogador-nome">${bolasGol}${nomeJogador}</div>`;
    }

    // Renderizar com substituições (lógica simplificada)
    function renderizarTimeComSubstituicoes(jogadores, nomeTime) {
        console.log(`🏟️ Renderizando ${nomeTime} com ${jogadores.length} jogadores`);
        
        let html = '';
        const jogadoresJaProcessados = new Set();
        
        for (let jogadorId of jogadores) {
            if (jogadoresJaProcessados.has(jogadorId)) continue;
            
            const nomeJogador = obterNomeJogador(jogadorId);
            const numGols = golsPorJogador[jogadorId] || 0;
            const bolasGol = numGols > 0 ? '⚽'.repeat(numGols) + ' ' : '';
            
            // Buscar se este jogador foi substituído
            const substituicao = substituicoes.find(sub => {
                const idSaiu = sub.jogador_saiu?.id;
                return idSaiu === jogadorId;
            });
            
            if (substituicao) {
                const idEntrou = substituicao.jogador_entrou?.id;
                const nomeSubstituto = obterNomeJogador(idEntrou);
                const golsSubstituto = golsPorJogador[idEntrou] || 0;
                const bolasGolSubstituto = golsSubstituto > 0 ? '⚽'.repeat(golsSubstituto) + ' ' : '';
                
                console.log(`🔄 ${nomeTime}: ${nomeJogador} → ${nomeSubstituto}`);
                
                html += `
                    <div class="jogador-substituido">
                        <div class="jogador-nome jogador-saiu">${bolasGol}${nomeJogador}</div>
                        <div class="jogador-nome jogador-entrou">${bolasGolSubstituto}${nomeSubstituto}</div>
                    </div>
                `;
                jogadoresJaProcessados.add(jogadorId);
                jogadoresJaProcessados.add(idEntrou);
            } else {
                html += `<div class="jogador-nome">${bolasGol}${nomeJogador}</div>`;
                jogadoresJaProcessados.add(jogadorId);
            }
        }
        
        return html;
    }

    return `
        <div class="partida-jogadores">
            <div class="jogadores-grid">
                <div class="time-jogadores">
                    <div class="jogadores-lista">
                        ${renderizarTimeComSubstituicoes(timeA, 'Time A')}
                    </div>
                </div>
                <div class="time-jogadores">
                    <div class="jogadores-lista">
                        ${renderizarTimeComSubstituicoes(timeB, 'Time B')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Obter nome do jogador por ID (número antigo)
function obterNomeJogador(jogadorId) {
    const jogador = jogadores.find(j => j.id === jogadorId);
    return jogador ? jogador.nome : `Jogador ${jogadorId}`;
}

// Obter nome do jogador por UUID
function obterNomeJogadorPorId(jogadorUuid) {
    const jogador = jogadores.find(j => j.id === jogadorUuid);
    return jogador ? jogador.nome : `Jogador não encontrado`;
}

// Mostrar/ocultar loading
function mostrarLoading(mostrar) {
    loading.style.display = mostrar ? 'block' : 'none';
    partidasSection.style.display = mostrar ? 'none' : 'block';
}

// Mostrar erro
function mostrarErro(mensagem) {
    partidasSection.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <h3>Erro</h3>
            <p>${mensagem}</p>
        </div>
    `;
}

// Funções dos modais
function fecharModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

async function mostrarModalJogadores() {
    const modal = document.getElementById('modal-jogadores');
    const lista = document.getElementById('lista-jogadores');
    
    // Contar partidas, vitórias e gols por jogador
    const jogadoresStats = {};
    
    for (const partida of partidasFiltradas) {
        const jogadoresPartida = [...(partida.time_a || []), ...(partida.time_b || [])];
        
        // Contar gols para determinar vencedor E gols individuais
        const gols = await carregarGolsPartida(partida.id);
        const golsTimeA = gols.filter(g => g.time === 'A').length;
        const golsTimeB = gols.filter(g => g.time === 'B').length;
        
        for (const jogadorId of jogadoresPartida) {
            if (!jogadoresStats[jogadorId]) {
                jogadoresStats[jogadorId] = { partidas: 0, vitorias: 0, gols: 0 };
            }
            jogadoresStats[jogadorId].partidas++;
            
            // Verificar se jogador estava no time vencedor
            const jogadorNoTimeA = partida.time_a?.includes(jogadorId);
            const jogadorNoTimeB = partida.time_b?.includes(jogadorId);
            
            if ((jogadorNoTimeA && golsTimeA > golsTimeB) || 
                (jogadorNoTimeB && golsTimeB > golsTimeA)) {
                jogadoresStats[jogadorId].vitorias++;
            }
            
            // Contar gols do jogador nesta partida
            const golsJogador = gols.filter(g => g.jogador_id === jogadorId).length;
            jogadoresStats[jogadorId].gols += golsJogador;
        }
    }
    
    // Converter para array e ordenar
    const jogadoresArray = Object.entries(jogadoresStats)
        .map(([id, stats]) => {
            const nomeJogador = obterNomeJogadorPorId(id);
            return {
                nome: nomeJogador,
                partidas: stats.partidas,
                vitorias: stats.vitorias,
                gols: stats.gols
            };
        })
        .sort((a, b) => b.partidas - a.partidas);
    
    // Gerar HTML
    let html = '';
    if (jogadoresArray.length === 0) {
        html = '<div class="jogador-sem-gol">Nenhum jogador encontrado no período selecionado.</div>';
    } else {
        jogadoresArray.forEach(jogador => {
            html += `
                <div class="jogador-item">
                    <span class="jogador-nome">${jogador.nome}</span>
                    <span class="jogador-stats">${jogador.partidas} partida${jogador.partidas !== 1 ? 's' : ''} • ${jogador.vitorias} vitória${jogador.vitorias !== 1 ? 's' : ''} • ${jogador.gols} gol${jogador.gols !== 1 ? 's' : ''}</span>
                </div>
            `;
        });
    }
    
    lista.innerHTML = html;
    modal.style.display = 'flex';
}

async function mostrarModalGols() {
    const modal = document.getElementById('modal-gols');
    const lista = document.getElementById('lista-gols');
    
    // Coletar todos os gols do período
    const golsPorJogador = {};
    const todosJogadores = new Set();
    
    for (const partida of partidasFiltradas) {
        // Adicionar todos os jogadores da partida
        [...(partida.time_a || []), ...(partida.time_b || [])].forEach(id => {
            todosJogadores.add(id);
            if (!golsPorJogador[id]) {
                golsPorJogador[id] = 0;
            }
        });
        
        // Contar gols
        const gols = await carregarGolsPartida(partida.id);
        gols.forEach(gol => {
            if (golsPorJogador[gol.jogador_id] !== undefined) {
                golsPorJogador[gol.jogador_id]++;
            } else {
                golsPorJogador[gol.jogador_id] = 1;
                todosJogadores.add(gol.jogador_id);
            }
        });
    }
    
    // Separar jogadores com e sem gols
    const comGols = [];
    const semGols = [];
    
    Array.from(todosJogadores).forEach(jogadorId => {
        const nomeJogador = obterNomeJogadorPorId(jogadorId);
        const numGols = golsPorJogador[jogadorId] || 0;
        
        if (numGols > 0) {
            comGols.push({ nome: nomeJogador, gols: numGols });
        } else {
            semGols.push({ nome: nomeJogador });
        }
    });
    
    // Ordenar
    comGols.sort((a, b) => b.gols - a.gols);
    semGols.sort((a, b) => a.nome.localeCompare(b.nome));
    
    // Gerar HTML
    let html = '';
    
    if (comGols.length > 0) {
        html += '<div class="gols-section"><h4>⚽ Artilheiros</h4>';
        comGols.forEach(jogador => {
            html += `
                <div class="gol-item">
                    <span class="jogador-nome">${jogador.nome}</span>
                    <span class="jogador-stats">${jogador.gols} gol${jogador.gols !== 1 ? 's' : ''}</span>
                </div>
            `;
        });
        html += '</div>';
    }
    
    if (semGols.length > 0) {
        html += '<div class="gols-section"><h4>👥 Sem Gols</h4>';
        semGols.forEach(jogador => {
            html += `<div class="jogador-sem-gol">${jogador.nome}</div>`;
        });
        html += '</div>';
    }
    
    if (comGols.length === 0 && semGols.length === 0) {
        html = '<div class="jogador-sem-gol">Nenhum jogador encontrado no período selecionado.</div>';
    }
    
    lista.innerHTML = html;
    modal.style.display = 'flex';
}

// ================================
// FUNÇÃO ADMINISTRATIVA - APAGAR DADOS DO DIA
// ================================

// Elementos do modal de apagar dados
const btnApagarDia = document.getElementById('btn-apagar-dia');
const modalApagarDia = document.getElementById('modal-apagar-dia');
const dataApagar = document.getElementById('data-apagar');
const confirmacaoTexto = document.getElementById('confirmacao-texto');
const btnCancelarApagar = document.getElementById('cancelar-apagar');
const btnConfirmarApagar = document.getElementById('confirmar-apagar');

// Event listeners
if (btnApagarDia) {
    btnApagarDia.addEventListener('click', (e) => {
        // Só permitir se for admin
        if (isAdmin()) {
            mostrarModalApagarDia();
        } else {
            // Mostrar mensagem de acesso negado
            alert('🔒 Acesso negado!\n\nApenas administradores podem acessar esta função.');
        }
    });
}

if (btnCancelarApagar) {
    btnCancelarApagar.addEventListener('click', fecharModalApagarDia);
}

if (btnConfirmarApagar) {
    btnConfirmarApagar.addEventListener('click', executarApagarDados);
}

// Buscar datas disponíveis no banco
async function buscarDatasDisponiveis() {
    try {
        console.log('🔍 Buscando datas disponíveis...');
        
        // Garantir que o Supabase está disponível
        if (typeof supabase === 'undefined') {
            console.error('❌ Supabase não está carregado');
            return [];
        }
        
        // Criar cliente Supabase
        const client = supabase.createClient(
            'https://wflcddqgnspqnvdsvojs.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmbGNkZHFnbnNwcW52ZHN2b2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNzA4NTEsImV4cCI6MjA3Njc0Njg1MX0.tYhUsiY7vp93O69JXhiayOjsP7PObcQ7EYKNVj5fjwQ'
        );
        
        console.log('📡 Cliente Supabase criado');
        
        // Buscar sessões
        const { data, error } = await client
            .from('sessoes')
            .select('data')
            .order('data', { ascending: false });
        
        if (error) {
            console.error('❌ Erro ao buscar sessões:', error);
            return [];
        }
        
        console.log('📊 Dados das sessões:', data);
        
        if (!data || data.length === 0) {
            console.log('📋 Nenhuma sessão encontrada');
            return [];
        }
        
        // Extrair datas únicas
        const datas = [...new Set(data.map(sessao => sessao.data))];
        console.log('📅 Datas únicas extraídas:', datas);
        
        return datas;
        
    } catch (error) {
        console.error('❌ Erro ao buscar datas:', error);
        return [];
    }
}

// Popular o select de datas
async function popularSelectDatas() {
    const selectData = document.getElementById('data-apagar');
    
    if (!selectData) {
        console.error('❌ Elemento select não encontrado!');
        return;
    }
    
    // Limpar opções existentes
    selectData.innerHTML = '<option value="">Carregando datas...</option>';
    selectData.disabled = true;
    
    try {
        const datas = await buscarDatasDisponiveis();
        
        // Limpar novamente
        selectData.innerHTML = '';
        
        if (datas.length === 0) {
            selectData.innerHTML = '<option value="">Nenhuma data encontrada</option>';
            selectData.disabled = true;
            return;
        }
        
        // Adicionar opção padrão
        selectData.innerHTML = '<option value="">Selecione uma data...</option>';
        
        // Adicionar opções de datas
        datas.forEach(data => {
            const option = document.createElement('option');
            option.value = data;
            
            // Formatar data para exibição
            const dataFormatada = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
            option.textContent = dataFormatada;
            
            selectData.appendChild(option);
        });
        
        selectData.disabled = false;
        console.log(`✅ Select populado com ${datas.length} datas`);
        
    } catch (error) {
        console.error('❌ Erro ao popular select de datas:', error);
        selectData.innerHTML = '<option value="">Erro ao carregar datas</option>';
        selectData.disabled = true;
    }
}

if (confirmacaoTexto) {
    confirmacaoTexto.addEventListener('input', validarConfirmacao);
}

// Função para mostrar modal
function mostrarModalApagarDia() {
    // Popular as datas disponíveis
    popularSelectDatas();
    
    // Limpar confirmação
    confirmacaoTexto.value = '';
    btnConfirmarApagar.disabled = true;
    
    // Mostrar modal
    modalApagarDia.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Função para fechar modal
function fecharModalApagarDia() {
    modalApagarDia.style.display = 'none';
    document.body.style.overflow = '';
    
    // Limpar campos
    dataApagar.value = '';
    dataApagar.innerHTML = '<option value="">Selecione uma data...</option>';
    confirmacaoTexto.value = '';
    btnConfirmarApagar.disabled = true;
}

// Validar confirmação
function validarConfirmacao() {
    const senhaDigitada = confirmacaoTexto.value.trim();
    const senhaAdmin = '4231';
    
    if (senhaDigitada === senhaAdmin) {
        btnConfirmarApagar.disabled = false;
        btnConfirmarApagar.style.background = '#dc3545';
    } else {
        btnConfirmarApagar.disabled = true;
        btnConfirmarApagar.style.background = '#ccc';
    }
}

// Executar exclusão dos dados
async function executarApagarDados() {
    const dataSelecionada = dataApagar.value;
    
    if (!dataSelecionada) {
        alert('⚠️ Selecione uma data válida!');
        return;
    }
    
    if (confirmacaoTexto.value.trim() !== '4231') {
        alert('⚠️ Senha do admin incorreta!');
        return;
    }
    
    try {
        // Mostrar loading
        btnConfirmarApagar.innerHTML = '<span class="emoji">⏳</span><span>Apagando...</span>';
        btnConfirmarApagar.disabled = true;
        
        console.log(`🗑️ Iniciando exclusão de dados do dia: ${dataSelecionada}`);
        
        // Chamar função do banco para apagar dados do dia
        const resultado = await Database.apagarDadosDoDia(dataSelecionada);
        
        if (resultado.success) {
            console.log('✅ Dados apagados com sucesso:', resultado);
            
            // Fechar modal
            fecharModalApagarDia();
            
            // Mostrar confirmação
            alert(`✅ Dados de ${formatarData(dataSelecionada)} foram apagados com sucesso!\n\n📊 Dados removidos:\n• ${resultado.sessoesRemovidas || 0} sessões\n• ${resultado.jogosRemovidos || 0} partidas\n• Todos os gols e registros da fila`);
            
            // Recarregar dados da tela
            await carregarDados();
            
        } else {
            throw new Error(resultado.error || 'Erro desconhecido');
        }
        
    } catch (error) {
        console.error('❌ Erro ao apagar dados:', error);
        alert(`❌ Erro ao apagar dados: ${error.message}`);
        
        // Restaurar botão
        btnConfirmarApagar.innerHTML = '<span class="emoji">🗑️</span><span>Apagar Dados</span>';
        btnConfirmarApagar.disabled = false;
    }
}

// Função auxiliar para formatar data
function formatarData(dataString) {
    const data = new Date(dataString + 'T00:00:00');
    return data.toLocaleDateString('pt-BR');
}

// Função para criar sessão de teste (apenas para debug)
async function criarSessaoTeste() {
    try {
        console.log('🧪 Criando sessão de teste...');
        
        const hoje = new Date().toISOString().split('T')[0];
        
        // Criar objeto com dados da sessão
        const dadosSessao = {
            data: hoje,
            status: 'ativa',
            total_jogadores: 0
        };
        
        const resultado = await Database.criarSessao(dadosSessao);
        
        if (resultado.success) {
            console.log('✅ Sessão de teste criada:', resultado.data);
            alert('✅ Sessão de teste criada com sucesso!');
            
            // Recarregar dados
            await carregarDados();
        } else {
            console.error('❌ Erro ao criar sessão:', resultado.error);
            alert(`❌ Erro ao criar sessão de teste: ${resultado.error}`);
        }
        
    } catch (error) {
        console.error('❌ Erro ao criar sessão de teste:', error);
        alert(`❌ Erro ao criar sessão de teste: ${error.message}`);
    }
}

// Adicionar função global para o botão
window.criarSessaoTeste = criarSessaoTeste;

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

// Função para exportar como imagem
async function exportarComoImagem() {
    const btnExportar = document.getElementById('btn-exportar');
    const originalText = btnExportar.innerHTML;
    
    try {
        // Mostrar loading
        btnExportar.disabled = true;
        btnExportar.innerHTML = `
            <span class="emoji">⏳</span>
            <span>Gerando imagem...</span>
        `;
        
        // Elemento que será capturado (main container)
        const container = document.querySelector('.container');
        
        // Esconder temporariamente elementos que não devem aparecer na imagem
        const elementsToHide = [
            document.querySelector('.footer-mobile'),
            document.getElementById('export-section'),
        ];
        
        // Salvar estilos originais
        const originalStyles = elementsToHide.map(el => {
            if (el) {
                const display = el.style.display;
                el.style.display = 'none';
                return { element: el, display };
            }
            return null;
        }).filter(Boolean);
        
        // Adicionar classe especial para exportação
        document.body.classList.add('exporting');
        
        // Configurações do html2canvas
        const canvas = await html2canvas(container, {
            backgroundColor: '#ffffff',
            scale: 2, // Alta qualidade
            useCORS: true,
            allowTaint: true,
            height: container.scrollHeight,
            width: container.scrollWidth,
            scrollX: 0,
            scrollY: 0,
            logging: false
        });
        
        // Remover classe de exportação
        document.body.classList.remove('exporting');
        
        // Restaurar elementos escondidos
        originalStyles.forEach(({ element, display }) => {
            element.style.display = display;
        });
        
        // Converter canvas para blob
        canvas.toBlob((blob) => {
            // Criar nome do arquivo baseado na data atual
            const agora = new Date();
            const dataFormatada = agora.toLocaleDateString('pt-BR').replace(/\//g, '-');
            const horaFormatada = agora.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit' 
            }).replace(':', 'h');
            
            const nomeArquivo = `Pelada3_Resultados_${dataFormatada}_${horaFormatada}.png`;
            
            // Criar link de download
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = nomeArquivo;
            
            // Executar download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Limpar URL
            URL.revokeObjectURL(url);
            
            // Mostrar sucesso
            mostrarMensagem(`📸 Imagem salva como: ${nomeArquivo}`, 'success');
        }, 'image/png', 0.95);
        
    } catch (error) {
        console.error('Erro ao exportar imagem:', error);
        mostrarMensagem('❌ Erro ao gerar imagem', 'error');
    } finally {
        // Restaurar botão
        btnExportar.disabled = false;
        btnExportar.innerHTML = originalText;
    }
}

// Função para mostrar mensagens
function mostrarMensagem(texto, tipo = 'info') {
    // Remover mensagem anterior se existir
    const mensagemExistente = document.querySelector('.toast-message');
    if (mensagemExistente) {
        mensagemExistente.remove();
    }
    
    // Criar nova mensagem
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${tipo}`;
    toast.textContent = texto;
    
    // Estilos inline para o toast
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${tipo === 'success' ? '#2d8f2d' : tipo === 'error' ? '#dc3545' : '#007bff'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 0.9rem;
        z-index: 10000;
        max-width: 350px;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;
    
    document.body.appendChild(toast);
    
    // Remover após 4 segundos
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 4000);
}