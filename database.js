// Configuração do Supabase
// Credenciais do projeto Pelada 3

const SUPABASE_URL = 'https://wflcddqgnspqnvdsvojs.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmbGNkZHFnbnNwcW52ZHN2b2pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNzA4NTEsImV4cCI6MjA3Njc0Njg1MX0.tYhUsiY7vp93O69JXhiayOjsP7PObcQ7EYKNVj5fjwQ'

// Inicialização do cliente Supabase
let client;

// Função para inicializar o cliente Supabase
function initializeSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase não foi carregado. Verifique se o script foi importado.');
        return null;
    }
    if (!client) {
        // Configurações específicas para resolver erro 406
        const options = {
            db: {
                schema: 'public'
            },
            global: {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Prefer': 'return=representation'
                }
            }
        };
        
        client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, options);
        console.log('🔗 Cliente Supabase inicializado com sucesso');
    }
    return client;
}

// Função para testar conectividade
async function testarConectividade() {
    try {
        const supabase = initializeSupabase();
        if (!supabase) {
            return { success: false, error: 'Cliente não inicializado' };
        }

        console.log('🔍 Testando conectividade com Supabase...');
        console.log('🔗 URL:', SUPABASE_URL);
        console.log('🔑 Key:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
        
        // Teste mais simples - verificar se o cliente responde
        const { data, error } = await supabase
            .from('jogos')
            .select('id')
            .limit(1);
            
        if (error) {
            console.error('❌ Erro de conectividade:', error);
            if (error.message?.includes('Failed to fetch')) {
                return { success: false, error: 'Erro de rede - sem conexão com internet ou Supabase' };
            }
            return { success: false, error: error.message };
        }
        
        console.log('✅ Conectividade confirmada - dados obtidos:', data?.length || 0);
        return { success: true };
    } catch (error) {
        console.error('❌ Erro na função de teste:', error);
        if (error.message?.includes('Failed to fetch')) {
            return { success: false, error: 'Erro de rede - verifique sua conexão com a internet' };
        }
        return { success: false, error: error.message };
    }
}

// Inicializar imediatamente se possível
if (typeof supabase !== 'undefined') {
    client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Funções utilitárias para o banco de dados

class Database {
    // ========== JOGADORES ==========
    
    // Cadastrar jogador
    static async cadastrarJogador(dadosJogador) {
        try {
            const { data, error } = await client
                .from('jogadores')
                .insert([dadosJogador])
                .select()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao cadastrar jogador:', error)
            return { success: false, error: error.message }
        }
    }

    // Buscar todos os jogadores
    static async buscarJogadores() {
        try {
            const { data, error } = await client
                .from('jogadores')
                .select('*')
                .order('nome')
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao buscar jogadores:', error)
            return { success: false, error: error.message }
        }
    }

    // Atualizar jogador
    static async atualizarJogador(id, dadosAtualizados) {
        try {
            const { data, error } = await client
                .from('jogadores')
                .update(dadosAtualizados)
                .eq('id', id)
                .select()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao atualizar jogador:', error)
            return { success: false, error: error.message }
        }
    }

    // Deletar jogador
    static async deletarJogador(id) {
        try {
            const { error } = await client
                .from('jogadores')
                .delete()
                .eq('id', id)
            
            if (error) throw error
            return { success: true }
        } catch (error) {
            console.error('Erro ao deletar jogador:', error)
            return { success: false, error: error.message }
        }
    }

    // ========== SESSÕES ==========
    
    // Buscar sessão ativa
    static async buscarSessaoAtiva() {
        try {
            // Primeira tentativa: buscar sem .single() para evitar erro 406
            const { data, error } = await client
                .from('sessoes')
                .select('*')
                .eq('status', 'ativa')
                .order('created_at', { ascending: false })
                .limit(1)
            
            if (error) {
                console.error('Erro na consulta de sessão ativa:', error);
                throw error;
            }
            
            // Se não há dados, retornar null
            if (!data || data.length === 0) {
                return { success: true, data: null };
            }
            
            // Pegar o primeiro resultado
            const sessao = data[0];
            
            // Verificar se a sessão ativa é do dia atual
            const dataSessao = new Date(sessao.created_at).toISOString().split('T')[0];
            const dataAtual = new Date().toISOString().split('T')[0];
            
            // Se a sessão é de outro dia, finalizar automaticamente
            if (dataSessao !== dataAtual) {
                console.log(`🔄 Finalizando sessão do dia ${dataSessao} automaticamente (hoje é ${dataAtual})`);
                
                await this.finalizarSessao(sessao.id);
                
                // Retornar null pois não há mais sessão ativa
                return { success: true, data: null };
            }
            
            return { success: true, data: sessao };
        } catch (error) {
            console.error('Erro ao buscar sessão ativa:', error);
            
            // Tratamento específico para erro 406 (Not Acceptable)
            if (error.code === 406 || error.status === 406) {
                console.warn('⚠️ Erro 406: Tentando consulta alternativa...');
                
                try {
                    // Consulta alternativa sem order
                    const { data: dataAlt, error: errorAlt } = await client
                        .from('sessoes')
                        .select('*')
                        .eq('status', 'ativa')
                        .limit(1);
                    
                    if (errorAlt) throw errorAlt;
                    
                    if (!dataAlt || dataAlt.length === 0) {
                        return { success: true, data: null };
                    }
                    
                    return { success: true, data: dataAlt[0] };
                    
                } catch (altError) {
                    console.error('Erro na consulta alternativa:', altError);
                    return { success: false, error: altError };
                }
            }
            
            return { success: false, error: error.message };
        }
    }

    // Criar nova sessão
    static async criarSessao(dadosSessao) {
        try {
            const { data, error } = await client
                .from('sessoes')
                .insert([dadosSessao])
                .select()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao criar sessão:', error)
            return { success: false, error: error.message }
        }
    }

    // Finalizar sessão
    static async finalizarSessao(id) {
        try {
            const { data, error } = await client
                .from('sessoes')
                .update({ status: 'finalizada' })
                .eq('id', id)
                .select()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao finalizar sessão:', error)
            return { success: false, error: error.message }
        }
    }

    // ========== FILA ==========
    
    // Buscar fila por sessão
    static async buscarFilaPorSessao(sessaoId) {
        try {
            const { data, error } = await client
                .from('fila')
                .select(`
                    *,
                    jogadores (
                        id,
                        nome,
                        nivel_habilidade
                    )
                `)
                .eq('sessao_id', sessaoId)
                .order('posicao_fila')
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao buscar fila:', error)
            return { success: false, error: error.message }
        }
    }

    // Criar fila (inserir múltiplos jogadores)
    static async criarFila(dadosFila) {
        try {
            const { data, error } = await client
                .from('fila')
                .insert(dadosFila)
                .select()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao criar fila:', error)
            return { success: false, error: error.message }
        }
    }

    // Atualizar posições da fila
    static async atualizarFila(atualizacoes) {
        try {
            const promises = atualizacoes.map(async (item) => {
                const { data, error } = await client
                    .from('fila')
                    .update(item.dados)
                    .eq('id', item.id)
                    .select()
                
                if (error) throw error
                return data
            })
            
            const resultados = await Promise.all(promises)
            return { success: true, data: resultados }
        } catch (error) {
            console.error('Erro ao atualizar fila:', error)
            return { success: false, error: error.message }
        }
    }

    // Limpar toda a fila
    static async limparFila() {
        try {
            const { error } = await client
                .from('fila')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows (usando UUID válido)
            
            if (error) throw error
            return { success: true }
        } catch (error) {
            console.error('Erro ao limpar fila:', error)
            return { success: false, error: error.message }
        }
    }

    // Adicionar jogador individual à fila
    static async adicionarJogadorFila(sessaoId, jogadorId, posicao, status = 'fila') {
        try {
            // Validar status
            if (!['fila', 'reserva'].includes(status)) {
                status = 'fila'; // Valor padrão seguro
            }
            
            // Converter o jogadorId para string para compatibilidade
            const jogadorIdStr = String(jogadorId);
            
            const { data, error } = await client
                .from('fila')
                .insert({
                    sessao_id: sessaoId,
                    jogador_id: jogadorIdStr,
                    posicao_fila: posicao,
                    status: status
                })
                .select()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao adicionar jogador à fila:', error)
            return { success: false, error: error.message }
        }
    }

    // ========== JOGOS ==========
    
    // Buscar jogo ativo
    static async buscarJogoAtivo(sessaoId) {
        try {
            const { data, error } = await client
                .from('jogos')
                .select('*')
                .eq('sessao_id', sessaoId)
                .in('status', ['em_andamento', 'pausado'])
                .order('created_at', { ascending: false })
                .limit(1)
            
            // Se não encontrou nenhum jogo, retorna null
            if (error && error.code === 'PGRST116') {
                return { success: true, data: null };
            }
            
            if (error) throw error;
            
            // Se data é um array, pegar o primeiro item
            const jogoAtivo = Array.isArray(data) && data.length > 0 ? data[0] : data;
            
            return { success: true, data: jogoAtivo }
        } catch (error) {
            console.error('Erro ao buscar jogo ativo:', error)
            return { success: false, error: error.message }
        }
    }

    // Criar novo jogo
    static async criarJogo(dadosJogo) {
        try {
            const { data, error } = await client
                .from('jogos')
                .insert([dadosJogo])
                .select()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao criar jogo:', error)
            return { success: false, error: error.message }
        }
    }

    // Atualizar jogo
    static async atualizarJogo(id, dadosAtualizados) {
        try {
            const { data, error } = await client
                .from('jogos')
                .update(dadosAtualizados)
                .eq('id', id)
                .select()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao atualizar jogo:', error)
            return { success: false, error: error.message }
        }
    }

    // Buscar jogos recentes
    static async buscarJogosRecentes(limite = 5) {
        try {
            const { data, error } = await client
                .from('jogos')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limite)
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao buscar jogos recentes:', error)
            return { success: false, error: error.message }
        }
    }

    // ========== GOLS ==========
    
    // Registrar gol
    static async registrarGol(dadosGol) {
        try {
            const { data, error } = await client
                .from('gols')
                .insert([dadosGol])
                .select()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao registrar gol:', error)
            return { success: false, error: error.message }
        }
    }

    // Registrar gol contra (sem jogador específico)
    static async registrarGolContra(dadosGolContra) {
        try {
            const golContra = {
                jogo_id: dadosGolContra.jogo_id,
                jogador_id: null, // Gol contra não tem jogador específico
                time: dadosGolContra.time_beneficiado, // Time que recebeu o ponto
                gol_contra: true,
                time_gol_contra: dadosGolContra.time_gol_contra,
                observacoes: `Gol contra do Time ${dadosGolContra.time_gol_contra}`
            };
            
            const { data, error } = await client
                .from('gols')
                .insert([golContra])
                .select()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao registrar gol contra:', error)
            return { success: false, error: error.message }
        }
    }

    // Buscar gols por jogo
    static async buscarGolsPorJogo(jogoId) {
        try {
            // Buscar gols simples primeiro
            const { data: gols, error } = await client
                .from('gols')
                .select('*')
                .eq('jogo_id', jogoId)
                .order('created_at')
            
            if (error) throw error
            
            // Se não há gols, retornar vazio
            if (!gols || gols.length === 0) {
                return { success: true, data: [] }
            }
            
            // Buscar dados dos jogadores
            const jogadorIds = [...new Set(gols.map(g => g.jogador_id))]
            const { data: jogadores, error: errorJogadores } = await client
                .from('jogadores')
                .select('id, nome')
                .in('id', jogadorIds)
            
            if (errorJogadores) throw errorJogadores
            
            // Combinar dados
            const golsComJogadores = gols.map(gol => ({
                ...gol,
                jogadores: jogadores.find(j => j.id === gol.jogador_id)
            }))
            
            return { success: true, data: golsComJogadores }
        } catch (error) {
            console.error('Erro ao buscar gols:', error)
            return { success: false, error: error.message }
        }
    }

    // Deletar gol (para desfazer)
    static async deletarGol(id) {
        try {
            const { error } = await client
                .from('gols')
                .delete()
                .eq('id', id)
            
            if (error) throw error
            return { success: true }
        } catch (error) {
            console.error('Erro ao deletar gol:', error)
            return { success: false, error: error.message }
        }
    }

    // Buscar gols por jogador em jogos específicos
    static async buscarGolsPorJogador(jogadorId, jogoIds) {
        try {
            const jogadorIdStr = String(jogadorId);
            const { data, error } = await client
                .from('gols')
                .select('*')
                .eq('jogador_id', jogadorIdStr)
                .in('jogo_id', jogoIds)
            
            if (error) throw error
            return { success: true, data: data || [] }
        } catch (error) {
            console.error('Erro ao buscar gols do jogador:', error)
            return { success: false, error: error.message, data: [] }
        }
    }

    // ========== REGRAS ==========
    
    // Criar regras
    static async criarRegras(dadosRegras) {
        try {
            const { data, error } = await client
                .from('regras')
                .insert([dadosRegras])
                .select()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao criar regras:', error)
            return { success: false, error: error.message }
        }
    }
    
    // Buscar regras ativas
    static async buscarRegras() {
        try {
            const { data, error } = await client
                .from('regras')
                .select('*')
                .eq('ativo', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao buscar regras:', error)
            return { success: false, error: error.message }
        }
    }

    // Atualizar regras
    static async atualizarRegras(id, novasRegras) {
        try {
            const { data, error } = await client
                .from('regras')
                .update(novasRegras)
                .eq('id', id)
                .select()
            
            if (error) throw error
            return { success: true, data }
        } catch (error) {
            console.error('Erro ao atualizar regras:', error)
            return { success: false, error: error.message }
        }
    }

    // Obter jogador
    static async obterJogador(jogadorId) {
        return await obterJogador(jogadorId);
    }

    // Atualizar estatísticas do jogador
    static async atualizarEstatisticasJogador(jogadorId, incrementos) {
        return await atualizarEstatisticasJogador(jogadorId, incrementos);
    }

    // Atualizar vitórias consecutivas
    static async atualizarVitoriasConsecutivas(novoValor) {
        return await atualizarVitoriasConsecutivas(novoValor);
    }

    // Rotacionar apenas Time A
    static async rotacionarApenasTimeA() {
        return await rotacionarApenasTimeA();
    }

    // Rotacionar apenas Time B
    static async rotacionarApenasTimeB() {
        return await rotacionarApenasTimeB();
    }

    // Rotacionar ambos os times
    static async rotacionarAmbosOsTimes() {
        return await rotacionarAmbosOsTimes();
    }

    // Rotacionar empate com prioridade
    static async rotacionarEmpateComPrioridade(timePrioridade) {
        return await rotacionarEmpateComPrioridade(timePrioridade);
    }

    // Rotacionar terceira vitória consecutiva (vencedor tem prioridade)
    static async rotacionarTerceiraVitoriaConsecutiva(timeVencedor) {
        return await rotacionarTerceiraVitoriaConsecutiva(timeVencedor);
    }

    static async testarConectividade() {
        return await testarConectividade();
    }

    // Obter sessão ativa (wrapper para função externa)
    static async obterSessaoAtiva() {
        return await obterSessaoAtiva();
    }

    // Obter fila (wrapper para função externa)  
    static async obterFila() {
        return await obterFila();
    }
    
    // Buscar usuário por username
    static async buscarUsuarioPorUsername(username) {
        try {
            const { data, error } = await client
                .from('usuarios')
                .select('*')
                .eq('username', username)
                .single();
                
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Erro ao buscar usuário por username:', error);
            return { success: false, error };
        }
    }

    // ========== MÉTODOS GENÉRICOS ==========
    
    // Buscar todos os registros de uma tabela
    static async buscarTodos(tabela, opcoes = {}) {
        try {
            // Garantir que o client está inicializado
            if (!client) {
                client = initializeSupabase();
                if (!client) {
                    throw new Error('Não foi possível inicializar o Supabase');
                }
            }
            
            let query = client.from(tabela).select('*');
            
            // Aplicar ordenação se especificada
            if (opcoes.orderBy) {
                const ascending = opcoes.orderDirection !== 'desc';
                query = query.order(opcoes.orderBy, { ascending });
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            return { success: true, data: data || [] };
            
        } catch (error) {
            console.error(`Erro ao buscar registros da tabela ${tabela}:`, error);
            return { success: false, error: error.message || error };
        }
    }
    
    // Inserir registro
    static async inserir(tabela, dados) {
        try {
            // Garantir que o client está inicializado
            if (!client) {
                client = initializeSupabase();
                if (!client) {
                    throw new Error('Não foi possível inicializar o Supabase');
                }
            }
            
            const { data, error } = await client
                .from(tabela)
                .insert([dados])
                .select();
            
            if (error) throw error;
            return { success: true, data: data?.[0] };
            
        } catch (error) {
            console.error(`Erro ao inserir registro na tabela ${tabela}:`, error);
            return { success: false, error: error.message || error };
        }
    }
    
    // Atualizar registro
    static async atualizar(tabela, id, dados) {
        try {
            // Garantir que o client está inicializado
            if (!client) {
                client = initializeSupabase();
                if (!client) {
                    throw new Error('Não foi possível inicializar o Supabase');
                }
            }
            
            const { data, error } = await client
                .from(tabela)
                .update(dados)
                .eq('id', id)
                .select();
            
            if (error) throw error;
            return { success: true, data: data?.[0] };
            
        } catch (error) {
            console.error(`Erro ao atualizar registro na tabela ${tabela}:`, error);
            return { success: false, error: error.message || error };
        }
    }
    
    // Excluir registro
    static async excluir(tabela, id) {
        try {
            // Garantir que o client está inicializado
            if (!client) {
                client = initializeSupabase();
                if (!client) {
                    throw new Error('Não foi possível inicializar o Supabase');
                }
            }
            
            const { data, error } = await client
                .from(tabela)
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return { success: true, data };
            
        } catch (error) {
            console.error(`Erro ao excluir registro da tabela ${tabela}:`, error);
            return { success: false, error: error.message || error };
        }
    }

    // Apagar dados de um dia específico (administrativo)
    static async apagarDadosDoDia(data) {
        try {
            // Garantir que o client está inicializado
            if (!client) {
                client = initializeSupabase();
                if (!client) {
                    throw new Error('Não foi possível inicializar o Supabase');
                }
            }

            console.log(`🗑️ Iniciando exclusão de dados do dia: ${data}`);
            
            // 1. Buscar sessões do dia
            const { data: sessoes, error: errorSessoes } = await client
                .from('sessoes')
                .select('id')
                .eq('data', data);
                
            if (errorSessoes) throw errorSessoes;
            
            if (!sessoes || sessoes.length === 0) {
                console.log('📋 Nenhuma sessão encontrada para este dia');
                return { success: true, message: 'Nenhuma sessão encontrada para este dia' };
            }

            const sessoesIds = sessoes.map(s => s.id);
            console.log(`📋 Encontradas ${sessoes.length} sessões: ${sessoesIds.join(', ')}`);

            // 2. Buscar jogos das sessões
            const { data: jogos, error: errorJogos } = await client
                .from('jogos')
                .select('id')
                .in('sessao_id', sessoesIds);
                
            if (errorJogos) throw errorJogos;

            if (jogos && jogos.length > 0) {
                const jogosIds = jogos.map(j => j.id);
                console.log(`⚽ Encontrados ${jogos.length} jogos: ${jogosIds.join(', ')}`);

                // 3. Apagar gols dos jogos
                const { error: errorGols } = await client
                    .from('gols')
                    .delete()
                    .in('jogo_id', jogosIds);
                    
                if (errorGols) throw errorGols;
                console.log('🗑️ Gols removidos');

                // 4. Apagar jogos
                const { error: errorDelJogos } = await client
                    .from('jogos')
                    .delete()
                    .in('id', jogosIds);
                    
                if (errorDelJogos) throw errorDelJogos;
                console.log('🗑️ Jogos removidos');
            }

            // 5. Apagar fila das sessões
            const { error: errorFila } = await client
                .from('fila')
                .delete()
                .in('sessao_id', sessoesIds);
                
            if (errorFila) throw errorFila;
            console.log('🗑️ Registros da fila removidos');

            // 6. Apagar sessões
            const { error: errorDelSessoes } = await client
                .from('sessoes')
                .delete()
                .in('id', sessoesIds);
                
            if (errorDelSessoes) throw errorDelSessoes;
            console.log('🗑️ Sessões removidas');

            console.log('✅ Todos os dados do dia foram removidos com sucesso');
            return { 
                success: true, 
                message: `Dados do dia ${data} removidos com sucesso`,
                sessoesRemovidas: sessoes.length,
                jogosRemovidos: jogos ? jogos.length : 0
            };

        } catch (error) {
            console.error('❌ Erro ao apagar dados do dia:', error);
            return { success: false, error: error.message || error };
        }
    }
}

// Exportar para uso global
window.Database = Database

// ========== FUNÇÕES ESPECÍFICAS PARA FILA ==========

// Função para obter sessão ativa (compatibilidade com fila.js)
async function obterSessaoAtiva() {
    // Garantir que o Supabase está inicializado
    if (!client) {
        client = initializeSupabase();
        if (!client) {
            throw new Error('Não foi possível inicializar o Supabase');
        }
    }
    
    const result = await Database.buscarSessaoAtiva();
    return result.success ? result.data : null;
}

// Função para obter jogadores (todos os jogadores cadastrados)
async function obterJogadores() {
    try {
        // Garantir que o client está inicializado
        if (!client) {
            client = initializeSupabase();
        }
        
        const { data, error } = await client
            .from('jogadores')
            .select('*')
            .order('nome');
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao obter jogadores:', error);
        return [];
    }
}

// Função para obter fila por sessão
async function obterFila(sessaoId) {
    try {
        // Garantir que o client está inicializado
        if (!client) {
            client = initializeSupabase();
        }
        
        // Se não foi fornecido sessaoId, buscar a sessão ativa
        if (!sessaoId) {
            const sessaoAtiva = await obterSessaoAtiva();
            if (!sessaoAtiva) {
                console.warn('Nenhuma sessão ativa encontrada');
                return [];
            }
            sessaoId = sessaoAtiva.id;
        }
        
        // Primeiro, obter os dados da fila
        const { data: filaData, error: filaError } = await client
            .from('fila')
            .select('*')
            .eq('sessao_id', sessaoId)
            .eq('status', 'fila')
            .order('posicao_fila');
        
        if (filaError) throw filaError;
        
        if (!filaData || filaData.length === 0) {
            return [];
        }
        
        // Obter os IDs dos jogadores
        const jogadorIds = filaData.map(item => item.jogador_id);
        
        // Filtrar apenas IDs que parecem ser UUIDs (tem pelo menos um hífen)
        // IDs numéricos serão tratados separadamente
        const uuidIds = jogadorIds.filter(id => id.includes('-'));
        const numericIds = jogadorIds.filter(id => !id.includes('-'));
        
        let jogadoresData = [];
        
        // Buscar jogadores com UUID
        if (uuidIds.length > 0) {
            const { data: uuidJogadores, error: uuidError } = await client
                .from('jogadores')
                .select('id, nome, nivel_habilidade')
                .in('id', uuidIds);
            
            if (!uuidError && uuidJogadores) {
                jogadoresData = jogadoresData.concat(uuidJogadores);
            }
        }
        
        // Buscar jogadores com ID numérico individualmente
        for (const numericId of numericIds) {
            const { data: numericJogador, error: numericError } = await client
                .from('jogadores')
                .select('id, nome, nivel_habilidade')
                .eq('id', numericId)
                .single();
                
            if (!numericError && numericJogador) {
                jogadoresData.push(numericJogador);
            }
        }
        
        // Combinar os dados
        const resultado = filaData.map(filaItem => {
            const jogador = jogadoresData.find(j => j.id.toString() === filaItem.jogador_id.toString());
            return {
                ...filaItem,
                jogador: jogador || { id: filaItem.jogador_id, nome: 'Jogador não encontrado', nivel_habilidade: 0 }
            };
        });
        
        return resultado;
    } catch (error) {
        console.error('Erro ao obter fila:', error);
        return [];
    }
}

// Função para obter jogos por sessão
async function obterJogos(sessaoId) {
    try {
        // Garantir que o client está inicializado
        if (!client) {
            client = initializeSupabase();
        }
        
        const { data, error } = await client
            .from('jogos')
            .select('*')
            .eq('sessao_id', sessaoId)
            .order('numero_jogo');
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao obter jogos:', error);
        return [];
    }
}

// Função para obter gols de um jogador em jogos específicos
async function obterGolsJogador(jogadorId, jogoIds) {
    try {
        if (!client) {
            client = initializeSupabase();
        }
        
        const jogadorIdStr = String(jogadorId);
        const { data, error } = await client
            .from('gols')
            .select('*')
            .eq('jogador_id', jogadorIdStr)
            .in('jogo_id', jogoIds);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao obter gols do jogador:', error);
        return [];
    }
}

// Função para remover jogador da fila
async function removerJogadorFila(sessaoId, jogadorId) {
    try {
        if (!client) {
            client = initializeSupabase();
        }
        
        // Converter o jogadorId para string para compatibilidade
        const jogadorIdStr = String(jogadorId);
        
        // Usar consulta combinada, mas de forma mais robusta
        const { data, error } = await client
            .from('fila')
            .delete()
            .match({ 
                sessao_id: sessaoId, 
                jogador_id: jogadorIdStr 
            });
            
        if (error) throw error;
        return data;
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erro ao remover jogador da fila:', error);
        throw error;
    }
}

// Função para obter reservas por sessão
async function obterReservas(sessaoId) {
    try {
        if (!client) {
            client = initializeSupabase();
        }
        
        // Primeiro, obter os dados dos reservas
        const { data: reservasData, error: reservasError } = await client
            .from('fila')
            .select('*')
            .eq('sessao_id', sessaoId)
            .eq('status', 'reserva');
        
        if (reservasError) throw reservasError;
        
        if (!reservasData || reservasData.length === 0) {
            return [];
        }
        
        // Obter os IDs dos jogadores
        const jogadorIds = reservasData.map(item => item.jogador_id);
        
        // Filtrar IDs por tipo (UUID vs numérico)
        const uuidIds = jogadorIds.filter(id => id.includes('-'));
        const numericIds = jogadorIds.filter(id => !id.includes('-'));
        
        let jogadoresData = [];
        
        // Buscar jogadores com UUID
        if (uuidIds.length > 0) {
            const { data: uuidJogadores, error: uuidError } = await client
                .from('jogadores')
                .select('id, nome, nivel_habilidade')
                .in('id', uuidIds);
            
            if (!uuidError && uuidJogadores) {
                jogadoresData = jogadoresData.concat(uuidJogadores);
            }
        }
        
        // Buscar jogadores com ID numérico individualmente
        for (const numericId of numericIds) {
            const { data: numericJogador, error: numericError } = await client
                .from('jogadores')
                .select('id, nome, nivel_habilidade')
                .eq('id', numericId)
                .single();
                
            if (!numericError && numericJogador) {
                jogadoresData.push(numericJogador);
            }
        }
        
        // Combinar os dados
        const resultado = reservasData.map(reservaItem => {
            const jogador = jogadoresData.find(j => j.id.toString() === reservaItem.jogador_id.toString());
            return {
                ...reservaItem,
                jogador: jogador || { id: reservaItem.jogador_id, nome: 'Jogador não encontrado', nivel_habilidade: 0 }
            };
        });
        
        return resultado.map(r => r.jogador); // Retornar apenas os dados dos jogadores
    } catch (error) {
        console.error('Erro ao obter reservas:', error);
        return [];
    }
}

// Função para limpar fila de uma sessão específica
async function limparFila(sessaoId) {
    try {
        const { error } = await client
            .from('fila')
            .delete()
            .eq('sessao_id', sessaoId);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Erro ao limpar fila:', error);
        throw error;
    }
}

// Função para adicionar jogador à fila
async function adicionarJogadorFila(sessaoId, jogadorId, posicao = null) {
    try {
        // Garantir que o client está inicializado
        if (!client) {
            client = initializeSupabase();
        }
        
        // Se não foi especificada uma posição, pegar a próxima disponível
        if (posicao === null) {
            const { data: filaAtual } = await client
                .from('fila')
                .select('posicao_fila')
                .eq('sessao_id', sessaoId)
                .order('posicao_fila', { ascending: false })
                .limit(1);
            
            posicao = filaAtual && filaAtual.length > 0 ? filaAtual[0].posicao_fila + 1 : 1;
        }
        
        // Converter o jogadorId para string para compatibilidade
        const jogadorIdStr = String(jogadorId);
        
        // Pular verificação de jogador por enquanto - focar na funcionalidade da fila
        // (A verificação pode falhar devido a tipos de ID mistos)
        
        // Primeiro verificar se o jogador já está na sessão
        const { data: filaExistente, error: verificaError } = await client
            .from('fila')
            .select('*')
            .eq('sessao_id', sessaoId)
            .eq('jogador_id', jogadorIdStr)
            .single();
            
        let data, error;
        
        if (filaExistente) {
            // Jogador já existe, apenas atualizar status
            const resultado = await client
                .from('fila')
                .update({ 
                    status: 'fila',
                    posicao_fila: posicao 
                })
                .eq('sessao_id', sessaoId)
                .eq('jogador_id', jogadorIdStr)
                .select();
            data = resultado.data;
            error = resultado.error;
        } else {
            // Jogador não existe, criar novo registro
            const resultado = await client
                .from('fila')
                .insert({
                    sessao_id: sessaoId,
                    jogador_id: jogadorIdStr,
                    posicao_fila: posicao,
                    status: 'fila'
                })
                .select();
            data = resultado.data;
            error = resultado.error;
        }
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erro ao adicionar jogador à fila:', error);
        throw error;
    }
}

// ==================== FUNÇÕES DA TELA PARTIDA ====================

// Função para criar novo jogo
async function criarNovoJogo(sessaoId, timeA, timeB) {
    try {
        console.log('🎯 criarNovoJogo chamada com (v2):', { sessaoId, timeA, timeB });
        
        const supabase = initializeSupabase();
        if (!supabase) return null;

        // Obter número do próximo jogo
        const { data: jogosExistentes, error: countError } = await supabase
            .from('jogos')
            .select('numero_jogo')
            .eq('sessao_id', sessaoId)
            .order('numero_jogo', { ascending: false })
            .limit(1);

        if (countError) {
            console.error('Erro ao contar jogos:', countError);
            return null;
        }

        const numeroJogo = jogosExistentes.length > 0 ? jogosExistentes[0].numero_jogo + 1 : 1;

        // Criar novo jogo
        const { data, error } = await supabase
            .from('jogos')
            .insert({
                sessao_id: sessaoId,
                numero_jogo: numeroJogo,
                time_a: timeA,
                time_b: timeB,
                placar_a: 0,
                placar_b: 0,
                status: 'em_andamento',
                tempo_decorrido: 0
            })
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar jogo:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Erro ao criar jogo:', error);
        return null;
    }
}

// Função para excluir jogo (cancelar partida)
async function excluirJogo(jogoId) {
    try {
        console.log('🗑️ Excluindo jogo:', jogoId);
        
        const supabase = initializeSupabase();
        if (!supabase) return false;

        // Primeiro, excluir todos os gols relacionados ao jogo
        const { error: golsError } = await supabase
            .from('gols')
            .delete()
            .eq('jogo_id', jogoId);

        if (golsError) {
            console.error('Erro ao excluir gols:', golsError);
            return false;
        }

        // Depois, excluir o jogo
        const { error: jogoError } = await supabase
            .from('jogos')
            .delete()
            .eq('id', jogoId);

        if (jogoError) {
            console.error('Erro ao excluir jogo:', jogoError);
            return false;
        }

        console.log('✅ Jogo e gols excluídos com sucesso');
        return true;
    } catch (error) {
        console.error('Erro ao excluir jogo:', error);
        return false;
    }
}

// Função para obter jogo por ID
async function obterJogo(jogoId) {
    try {
        const supabase = initializeSupabase();
        if (!supabase) return null;

        const { data, error } = await supabase
            .from('jogos')
            .select('*')
            .eq('id', jogoId)
            .maybeSingle();

        if (error) {
            console.error('Erro ao obter jogo:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Erro ao obter jogo:', error);
        return null;
    }
}

// Função para obter próximos times da fila
async function obterProximosTimes() {
    try {
        // Obter sessão ativa primeiro
        const sessao = await obterSessaoAtiva();
        if (!sessao) {
            console.error('Nenhuma sessão ativa encontrada');
            return { time1: null, time2: null };
        }

        const fila = await obterFila(sessao.id);
        if (!fila || fila.length < 12) {
            return { time1: null, time2: null };
        }

        // Primeiros 6 = Time 1, próximos 6 = Time 2
        const time1 = fila.slice(0, 6).map(item => item.jogador_id);
        const time2 = fila.slice(6, 12).map(item => item.jogador_id);

        return { time1, time2 };
    } catch (error) {
        console.error('Erro ao obter próximos times:', error);
        return { time1: null, time2: null };
    }
}

// Função para obter jogo ativo (em andamento)
async function obterJogoAtivo() {
    try {
        const supabase = initializeSupabase();
        if (!supabase) return null;

        const sessao = await obterSessaoAtiva();
        if (!sessao) return null;

        const { data, error } = await supabase
            .from('jogos')
            .select('*')
            .eq('sessao_id', sessao.id)
            .in('status', ['em_andamento', 'pausado'])
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Erro ao obter jogo ativo:', error);
            return null;
        }

        return data && data.length > 0 ? data[0] : null;
    } catch (error) {
        console.error('Erro ao obter jogo ativo:', error);
        return null;
    }
}

// Função para atualizar jogo no banco
async function atualizarJogoNoBanco(jogoId, updates) {
    try {
        const supabase = initializeSupabase();
        if (!supabase) {
            console.error('❌ Supabase não inicializado');
            return { success: false, error: 'Supabase não inicializado' };
        }

        console.log('🔄 Atualizando jogo:', jogoId, 'com dados:', updates);

        // Primeiro teste de conectividade mais específico
        try {
            const { data: testData, error: testError } = await supabase
                .from('jogos')
                .select('id')
                .limit(1);
            
            if (testError) {
                console.error('❌ Problema de conectividade:', testError);
                return { success: false, error: 'Sem conexão com o banco de dados', networkError: true };
            }
        } catch (connectError) {
            console.error('❌ Erro de rede na conectividade:', connectError);
            return { success: false, error: 'Erro de rede - verifique sua conexão', networkError: true };
        }

        const { data, error } = await supabase
            .from('jogos')
            .update(updates)
            .eq('id', jogoId)
            .select()
            .single();

        if (error) {
            console.error('❌ Erro ao atualizar jogo:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ Jogo atualizado com sucesso:', data);
        return { success: true, data };
    } catch (error) {
        console.error('❌ Erro ao atualizar jogo:', error);
        
        // Se for erro de rede, não quebrar a aplicação
        if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
            console.warn('⚠️ Erro de rede detectado - continuando sem salvar');
            return { success: false, error: 'Erro de conexão - dados não salvos', networkError: true };
        }
        
        return { success: false, error: error.message };
    }
}

// Função para obter jogador
async function obterJogador(jogadorId) {
    try {
        const supabase = initializeSupabase();
        if (!supabase) return null;

        const { data, error } = await supabase
            .from('jogadores')
            .select('*')
            .eq('id', jogadorId)
            .single();

        if (error) {
            console.error('Erro ao obter jogador:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Erro ao obter jogador:', error);
        return null;
    }
}

// Função para obter regras
async function obterRegras() {
    try {
        const supabase = initializeSupabase();
        if (!supabase) return null;

        const { data, error } = await supabase
            .from('regras')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            console.error('Erro ao obter regras:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Erro ao obter regras:', error);
        return null;
    }
}

// Função para atualizar estatísticas de um jogador
async function atualizarEstatisticasJogador(jogadorId, incrementos) {
    try {
        console.log(`🔍 Atualizando estatísticas jogador ${jogadorId}:`, incrementos);
        
        const supabase = initializeSupabase();
        if (!supabase) {
            console.error('❌ Supabase não inicializado');
            return false;
        }

        // Obter estatísticas atuais
        const jogador = await obterJogador(jogadorId);
        if (!jogador) {
            console.error(`❌ Jogador ${jogadorId} não encontrado`);
            return false;
        }

        console.log(`📊 Estatísticas atuais do jogador:`, {
            jogos: jogador.jogos,
            vitorias: jogador.vitorias,
            gols: jogador.gols
        });

        // Calcular novos valores
        const novosJogos = jogador.jogos + (incrementos.jogos || 0);
        const novasVitorias = jogador.vitorias + (incrementos.vitorias || 0);
        const novosGols = jogador.gols + (incrementos.gols || 0);

        console.log(`📈 Novos valores calculados:`, {
            jogos: novosJogos,
            vitorias: novasVitorias,
            gols: novosGols
        });

        // Atualizar no banco
        const { data, error } = await supabase
            .from('jogadores')
            .update({
                jogos: novosJogos,
                vitorias: novasVitorias,
                gols: novosGols
            })
            .eq('id', jogadorId);

        if (error) {
            console.error('❌ Erro ao atualizar estatísticas:', error);
            return false;
        }

        console.log(`✅ Estatísticas atualizadas com sucesso para jogador ${jogadorId}`);
        return true;
    } catch (error) {
        console.error('Erro ao atualizar estatísticas:', error);
        return false;
    }
}

// Função para atualizar vitórias consecutivas
async function atualizarVitoriasConsecutivas(novoValor) {
    try {
        const supabase = initializeSupabase();
        if (!supabase) return false;

        const sessao = await obterSessaoAtiva();
        if (!sessao) return false;

        const { data, error } = await supabase
            .from('sessoes')
            .update({ vitorias_consecutivas: novoValor })
            .eq('id', sessao.id);

        if (error) {
            console.error('Erro ao atualizar vitórias consecutivas:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Erro ao atualizar vitórias consecutivas:', error);
        return false;
    }
}

// Função para rotacionar apenas Time A (Time B fica)
async function rotacionarApenasTimeA() {
    try {
        console.log('🔄 Iniciando rotação - Time A sai, Time B fica');
        
        const sessao = await obterSessaoAtiva();
        if (!sessao) {
            console.error('❌ Sessão não encontrada');
            return false;
        }
        console.log('✅ Sessão encontrada:', sessao.id);

        const fila = await obterFila(sessao.id);
        if (!fila || fila.length < 6) {
            console.error('❌ Fila insuficiente:', fila?.length || 0);
            return false;
        }
        console.log('✅ Fila obtida:', fila.length, 'jogadores');

        // Time A (primeiros 6) vai para o final
        const timeA = fila.slice(0, 6);
        const resto = fila.slice(6);
        
        console.log('👥 Time A (sai):', timeA.map(p => p.jogador_id));
        console.log('👥 Resto da fila:', resto.map(p => p.jogador_id));
        
        // Nova ordem: Time B (posições 6-11) + resto + Time A
        const timeB = fila.slice(6, 12);
        const proximoTime = resto.slice(6); // Próximos 6 da fila
        const novaFila = [...timeB, ...proximoTime, ...timeA];
        
        console.log('🔄 Nova ordem da fila:', novaFila.map(p => p.jogador_id));

        // Atualizar posições na fila
        console.log('💾 Atualizando posições no banco...');
        let sucessos = 0;
        let falhas = 0;
        
        for (let i = 0; i < novaFila.length; i++) {
            const jogadorId = novaFila[i].jogador_id;
            const novaPosicao = i + 1;
            
            console.log(`🔄 Processando jogador ${jogadorId} → posição ${novaPosicao}`);
            const resultado = await atualizarPosicaoFila(jogadorId, novaPosicao);
            
            if (resultado) {
                sucessos++;
                console.log(`✅ Sucesso: Jogador ${jogadorId} → posição ${novaPosicao}`);
            } else {
                falhas++;
                console.error(`❌ Falha: Jogador ${jogadorId} → posição ${novaPosicao}`);
            }
        }
        
        console.log(`📊 Resultado da rotação: ${sucessos} sucessos, ${falhas} falhas`);
        
        if (falhas > 0) {
            console.error(`⚠️ Houve ${falhas} falhas na atualização das posições!`);
            return false;
        }

        console.log('✅ Rotação Time A concluída com sucesso');
        return true;
    } catch (error) {
        console.error('Erro ao rotacionar Time A:', error);
        return false;
    }
}

// Função para rotacionar apenas Time B (Time A fica)
async function rotacionarApenasTimeB() {
    try {
        const sessao = await obterSessaoAtiva();
        if (!sessao) return false;

        const fila = await obterFila(sessao.id);
        if (!fila || fila.length < 6) return false;

        // Time B (posições 6-11) vai para o final
        const timeA = fila.slice(0, 6);
        const timeB = fila.slice(6, 12);
        const resto = fila.slice(12);
        
        // Nova ordem: Time A + próximos 6 + resto + Time B
        const proximoTime = resto.slice(0, 6);
        const restoFila = resto.slice(6);
        const novaFila = [...timeA, ...proximoTime, ...restoFila, ...timeB];

        // Atualizar posições na fila
        for (let i = 0; i < novaFila.length; i++) {
            await atualizarPosicaoFila(novaFila[i].jogador_id, i + 1);
        }

        return true;
    } catch (error) {
        console.error('Erro ao rotacionar Time B:', error);
        return false;
    }
}

// Função para rotacionar ambos os times
async function rotacionarAmbosOsTimes() {
    try {
        const sessao = await obterSessaoAtiva();
        if (!sessao) return false;

        const fila = await obterFila(sessao.id);
        if (!fila || fila.length < 12) return false;

        // Ambos os times (primeiros 12) vão para o final
        const ambosOsTimes = fila.slice(0, 12);
        const resto = fila.slice(12);
        
        // Nova ordem: próximos 12 + resto + times anteriores
        const proximosTimes = resto.slice(0, 12);
        const restoFila = resto.slice(12);
        const novaFila = [...proximosTimes, ...restoFila, ...ambosOsTimes];

        // Atualizar posições na fila
        for (let i = 0; i < novaFila.length; i++) {
            await atualizarPosicaoFila(novaFila[i].jogador_id, i + 1);
        }

        return true;
    } catch (error) {
        console.error('Erro ao rotacionar ambos os times:', error);
        return false;
    }
}

// Função para atualizar posição na fila
async function atualizarPosicaoFila(jogadorId, novaPosicao) {
    try {
        const supabase = initializeSupabase();
        if (!supabase) {
            console.error('❌ Supabase não inicializado');
            return false;
        }

        console.log(`🔄 Atualizando jogador ${jogadorId} para posição ${novaPosicao}`);

        const { data, error } = await supabase
            .from('fila')
            .update({ posicao_fila: novaPosicao })
            .match({ jogador_id: jogadorId });

        if (error) {
            console.error('❌ Erro ao atualizar posição na fila:', error);
            console.error('Detalhes do erro:', error.message);
            return false;
        }

        console.log(`✅ Posição atualizada - jogador ${jogadorId} → ${novaPosicao}`, data);
        return true;
    } catch (error) {
        console.error('Erro ao atualizar posição na fila:', error);
        return false;
    }
}

// Rotacionar empate com prioridade
async function rotacionarEmpateComPrioridade(timePrioridade) {
    try {
        const sessao = await obterSessaoAtiva();
        if (!sessao) return false;

        const fila = await obterFila(sessao.id);
        if (!fila || fila.length < 12) return false;

        console.log(`🎯 Rotacionando empate com prioridade para TIME ${timePrioridade}`);
        
        // Ambos os times saem, mas com prioridade diferente
        const timeA = fila.slice(0, 6);
        const timeB = fila.slice(6, 12);
        const resto = fila.slice(12);
        
        // Nova ordem: próximos 12 jogam + times antigos vão para fila (com prioridade)
        const proximoTimeA = resto.slice(0, 6);  // Posições 13-18 viram Time A
        const proximoTimeB = resto.slice(6, 12); // Posições 19-24 viram Time B
        const restoFila = resto.slice(12);       // Resto da fila
        
        let novaFila;
        if (timePrioridade === 'A') {
            // Time A tem prioridade (volta primeiro na fila)
            novaFila = [...proximoTimeA, ...proximoTimeB, ...restoFila, ...timeA, ...timeB];
        } else {
            // Time B tem prioridade (volta primeiro na fila)
            novaFila = [...proximoTimeA, ...proximoTimeB, ...restoFila, ...timeB, ...timeA];
        }

        // Atualizar posições na fila
        for (let i = 0; i < novaFila.length; i++) {
            await atualizarPosicaoFila(novaFila[i].jogador_id, i + 1);
        }

        return true;
    } catch (error) {
        console.error('Erro ao rotacionar empate com prioridade:', error);
        return false;
    }
}

// Rotacionar terceira vitória consecutiva (vencedor com prioridade)
async function rotacionarTerceiraVitoriaConsecutiva(timeVencedor) {
    try {
        const sessao = await obterSessaoAtiva();
        if (!sessao) return false;

        const fila = await obterFila(sessao.id);
        if (!fila || fila.length < 12) return false;

        console.log(`🏆 Rotacionando 3ª vitória - TIME ${timeVencedor} vencedor tem prioridade`);
        
        const timeA = fila.slice(0, 6);
        const timeB = fila.slice(6, 12);
        const resto = fila.slice(12);
        
        // Nova ordem: próximos 12 jogam + times antigos vão para fila (vencedor com prioridade)
        const proximoTimeA = resto.slice(0, 6);  // Posições 13-18 viram Time A
        const proximoTimeB = resto.slice(6, 12); // Posições 19-24 viram Time B
        const restoFila = resto.slice(12);       // Resto da fila
        
        let novaFila;
        if (timeVencedor === 'A') {
            // Time A vencedor vai para posição melhor que Time B perdedor
            novaFila = [...proximoTimeA, ...proximoTimeB, ...restoFila, ...timeA, ...timeB];
        } else {
            // Time B vencedor vai para posição melhor que Time A perdedor  
            novaFila = [...proximoTimeA, ...proximoTimeB, ...restoFila, ...timeB, ...timeA];
        }

        // Atualizar posições na fila
        for (let i = 0; i < novaFila.length; i++) {
            await atualizarPosicaoFila(novaFila[i].jogador_id, i + 1);
        }

        return true;
    } catch (error) {
        console.error('Erro ao rotacionar terceira vitória consecutiva:', error);
        return false;
    }
}

// Exportar funções individuais para compatibilidade
window.atualizarJogoNoBanco = atualizarJogoNoBanco;
window.testarConectividade = testarConectividade;
window.atualizarPosicaoFila = atualizarPosicaoFila;
