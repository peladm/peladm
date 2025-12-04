// Funções para controle de vitórias consecutivas
// Usar a tabela fila.vitorias_consecutivas_time

// Função para obter vitórias consecutivas do Time A atual
async function obterVitoriasConsecutivasTimeA() {
    try {
        // Garantir que o client está inicializado
        if (!client) {
            client = initializeSupabase();
        }
        
        const sessao = await Database.obterSessaoAtiva();
        if (!sessao) return 0;

        const fila = await Database.obterFila();
        if (!fila || fila.length < 6) return 0;

        // Time A são as primeiras 6 posições
        const timeA = fila.slice(0, 6);
        
        // Pegar o valor de vitorias_consecutivas_time do primeiro jogador (todos do time têm o mesmo valor)
        const vitoriasConsecutivas = timeA[0]?.vitorias_consecutivas_time || 0;
        
        console.log(`📊 Vitórias consecutivas Time A atual: ${vitoriasConsecutivas}`);
        return vitoriasConsecutivas;
        
    } catch (error) {
        console.error('Erro ao obter vitórias consecutivas:', error);
        return 0;
    }
}

// Função para atualizar vitórias consecutivas do Time A
async function atualizarVitoriasConsecutivasTimeA(novasVitorias) {
    try {
        // Garantir que o client está inicializado
        if (!client) {
            client = initializeSupabase();
        }
        
        const sessao = await Database.obterSessaoAtiva();
        if (!sessao) return false;

        const fila = await Database.obterFila();
        if (!fila || fila.length < 6) return false;

        // Time A são as primeiras 6 posições
        const timeA = fila.slice(0, 6);
        
        console.log(`🔄 Atualizando vitórias consecutivas Time A: ${novasVitorias}`);
        
        // Atualizar todos os jogadores do Time A
        for (const jogador of timeA) {
            const { data, error } = await client
                .from('fila')
                .update({ vitorias_consecutivas_time: novasVitorias })
                .eq('jogador_id', jogador.jogador_id);
                
            if (error) {
                console.error(`Erro ao atualizar vitórias para jogador ${jogador.jogador_id}:`, error);
                return false;
            }
        }
        
        console.log(`✅ Vitórias consecutivas atualizadas para ${novasVitorias}`);
        return true;
        
    } catch (error) {
        console.error('Erro ao atualizar vitórias consecutivas:', error);
        return false;
    }
}

// Função para resetar vitórias consecutivas de todos os jogadores (usado após rotação)
async function resetarTodasVitoriasConsecutivas() {
    try {
        // Garantir que o client está inicializado
        if (!client) {
            client = initializeSupabase();
        }
        
        const sessao = await Database.obterSessaoAtiva();
        if (!sessao) return false;

        console.log('🔄 Resetando todas as vitórias consecutivas para 0');
        
        const { data, error } = await client
            .from('fila')
            .update({ vitorias_consecutivas_time: 0 })
            .eq('sessao_id', sessao.id);
            
        if (error) {
            console.error('Erro ao resetar vitórias consecutivas:', error);
            return false;
        }
        
        console.log('✅ Todas as vitórias consecutivas resetadas');
        return true;
        
    } catch (error) {
        console.error('Erro ao resetar vitórias consecutivas:', error);
        return false;
    }
}

// Exportar funções
window.obterVitoriasConsecutivasTimeA = obterVitoriasConsecutivasTimeA;
window.atualizarVitoriasConsecutivasTimeA = atualizarVitoriasConsecutivasTimeA;
window.resetarTodasVitoriasConsecutivas = resetarTodasVitoriasConsecutivas;