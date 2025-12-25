// Reset: Voltar todos os jogadores para status "ativo"
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ewcswczqvelhlwpbraea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function resetJogadores() {
  try {
    console.log('🔄 Resetando status dos jogadores para "ativo"...');
    
    const { data, error } = await supabase
      .from('jogadores')
      .update({ status: 'ativo' })
      .eq('pelada_id', 'd2c29bdc-7d34-4a95-a2f3-07444ceb480b')
      .select('nome, status');
    
    if (error) throw error;
    
    console.log(`✅ ${data.length} jogadores resetados para status "ativo"`);
    console.log('🎯 Agora você pode testar o fluxo do sorteio novamente!');
    
  } catch (error) {
    console.error('💥 Erro:', error);
  }
}

resetJogadores();