// Debug: Verificar estrutura da tabela jogadores
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ewcswczqvelhlwpbraea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugEstrutura() {
  try {
    console.log('🔍 Verificando estrutura dos jogadores...');
    
    // Buscar alguns jogadores para ver o formato dos IDs
    const { data: jogadores, error } = await supabase
      .from('jogadores')
      .select('id, nome, status')
      .eq('pelada_id', 'd2c29bdc-7d34-4a95-a2f3-07444ceb480b')
      .limit(5);
    
    if (error) throw error;
    
    console.log('\n📋 Primeiros jogadores:');
    jogadores.forEach(jogador => {
      console.log(`ID: ${jogador.id} (tipo: ${typeof jogador.id})`);
      console.log(`Nome: ${jogador.nome}`);
      console.log(`Status: ${jogador.status}`);
      console.log('---');
    });
    
    // Testar update com UUID correto
    if (jogadores.length > 0) {
      const primeiroJogador = jogadores[0];
      console.log(`🧪 Testando update do jogador: ${primeiroJogador.nome} (ID: ${primeiroJogador.id})`);
      
      const { data: updateResult, error: updateError } = await supabase
        .from('jogadores')
        .update({ status: 'fila' })
        .eq('id', primeiroJogador.id)
        .select();
      
      if (updateError) {
        console.error('❌ Erro no update:', updateError);
      } else {
        console.log('✅ Update realizado com sucesso!');
        console.log('🔄 Resultado:', updateResult);
      }
    }
    
  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

debugEstrutura();