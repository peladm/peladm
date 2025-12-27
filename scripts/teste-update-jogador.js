// Teste: Atualizar status de um jogador específico
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ewcswczqvelhlwpbraea.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testeUpdateJogador() {
  try {
    console.log('🧪 Testando update de jogador...');
    
    // Testar update simples
    const { data, error } = await supabase
      .from('jogadores')
      .update({ status: 'fila' })
      .eq('id', 1)
      .select();
    
    if (error) {
      console.error('❌ Erro no update:', error);
    } else {
      console.log('✅ Update realizado com sucesso:', data);
    }
    
    // Verificar se o update funcionou
    const { data: jogador, error: selectError } = await supabase
      .from('jogadores')
      .select('id, nome, status')
      .eq('id', 1)
      .single();
    
    if (selectError) {
      console.error('❌ Erro ao verificar:', selectError);
    } else {
      console.log('🔍 Status atual do jogador:', jogador);
    }
    
  } catch (error) {
    console.error('💥 Erro geral:', error);
  }
}

testeUpdateJogador();