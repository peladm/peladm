// Teste: Simular cenário de sorteio concluído
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ewcswczqvelhlwpbraea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function simularSorteio() {
  try {
    console.log('🎲 Simulando sorteio concluído...');
    
    const peladaId = 'd2c29bdc-7d34-4a95-a2f3-07444ceb480b';
    
    // Buscar jogadores
    const { data: jogadores, error } = await supabase
      .from('jogadores')
      .select('id, nome')
      .eq('pelada_id', peladaId)
      .limit(16);
    
    if (error) throw error;
    
    // Simular times de 4 jogadores
    const jogadoresJogando = jogadores.slice(0, 8);  // 8 jogando (2 times de 4)
    const jogadoresFila = jogadores.slice(8, 16);     // 8 na fila
    
    console.log('\n⚽ Atualizando jogadores para JOGANDO:');
    for (const jogador of jogadoresJogando) {
      const { error: updateError } = await supabase
        .from('jogadores')
        .update({ status: 'jogando' })
        .eq('id', jogador.id);
      
      if (updateError) {
        console.error(`❌ Erro ao atualizar ${jogador.nome}:`, updateError);
      } else {
        console.log(`✅ ${jogador.nome} → jogando`);
      }
    }
    
    console.log('\n📋 Atualizando jogadores para FILA:');
    for (const jogador of jogadoresFila) {
      const { error: updateError } = await supabase
        .from('jogadores')
        .update({ status: 'fila' })
        .eq('id', jogador.id);
      
      if (updateError) {
        console.error(`❌ Erro ao atualizar ${jogador.nome}:`, updateError);
      } else {
        console.log(`✅ ${jogador.nome} → fila`);
      }
    }
    
    console.log('\n🎯 Simulação concluída! Agora teste a página da fila.');
    
  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

simularSorteio();