const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ewcswczqvelhlwpbraea.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks'
);

async function verificarTabelas() {
  console.log('🔍 Verificando estrutura das tabelas...\n');
  
  try {
    // Verificar se tabela clientes existe e pegar dados
    const { data: clientes, error: errorClientes } = await supabase
      .from('clientes')
      .select('*')
      .limit(1);
    
    if (errorClientes) {
      console.log('❌ Erro ao acessar tabela clientes:', errorClientes.message);
    } else {
      console.log('✅ Tabela clientes existe!');
      console.log('📋 Colunas encontradas:', clientes.length > 0 ? Object.keys(clientes[0]) : 'Tabela vazia');
      console.log('📊 Total de registros:', clientes.length);
    }

    // Verificar tabela usuarios também
    const { data: usuarios, error: errorUsuarios } = await supabase
      .from('usuarios')
      .select('*')
      .limit(1);
    
    if (errorUsuarios) {
      console.log('❌ Erro ao acessar tabela usuarios:', errorUsuarios.message);
    } else {
      console.log('✅ Tabela usuarios existe!');
      console.log('📋 Colunas encontradas:', usuarios.length > 0 ? Object.keys(usuarios[0]) : 'Tabela vazia');
    }
    
  } catch (error) {
    console.error('💥 Erro geral:', error.message);
  }
}

verificarTabelas();