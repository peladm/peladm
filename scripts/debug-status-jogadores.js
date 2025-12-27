// Debug: Verificar status dos jogadores
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ewcswczqvelhlwpbraea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function debugJogadoresStatus() {
  try {
    console.log('🔍 Verificando status dos jogadores...');
    
    // Pegar pelada_id do cliente logado (simulando)
    const peladaId = 'd2c29bdc-7d34-4a95-a2f3-07444ceb480b';
    
    // Buscar todos os jogadores
    const { data: jogadores, error } = await supabase
      .from('jogadores')
      .select('id, nome, status')
      .eq('pelada_id', peladaId)
      .order('nome');
    
    if (error) throw error;
    
    console.log(`\n📊 Total de jogadores: ${jogadores.length}`);
    console.log('\n📋 Status dos jogadores:');
    
    const statusCount = {};
    
    jogadores.forEach(jogador => {
      const status = jogador.status || 'sem_status';
      if (!statusCount[status]) statusCount[status] = [];
      statusCount[status].push(jogador.nome);
    });
    
    Object.keys(statusCount).forEach(status => {
      console.log(`\n${getStatusEmoji(status)} ${status.toUpperCase()}: ${statusCount[status].length}`);
      statusCount[status].forEach(nome => {
        console.log(`  - ${nome}`);
      });
    });
    
    console.log('\n🎯 Resumo por status:');
    console.log(`⚽ Jogando: ${(statusCount.jogando || []).length}`);
    console.log(`📋 Fila: ${(statusCount.fila || []).length}`);
    console.log(`🪑 Reserva: ${(statusCount.reserva || []).length}`);
    console.log(`✅ Ativo: ${(statusCount.ativo || []).length}`);
    console.log(`❌ Inativo: ${(statusCount.inativo || []).length}`);
    
  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

function getStatusEmoji(status) {
  const emojis = {
    'jogando': '⚽',
    'fila': '📋', 
    'reserva': '🪑',
    'ativo': '✅',
    'inativo': '❌',
    'sem_status': '❓'
  };
  return emojis[status] || '❓';
}

debugJogadoresStatus();