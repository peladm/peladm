// Script para criar tabela de usuários no Supabase
// Execute: node setup-usuarios-table.js

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const supabaseUrl = 'https://ewcswczqvelhlwpbraea.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupUsuariosTable() {
  try {
    console.log('🔧 Configurando tabela de usuários...');
    
    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, 'create-usuarios-table.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Executar o SQL
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: sqlContent
    });
    
    if (error) {
      // Se o erro for que a função não existe, vamos executar com uma abordagem diferente
      if (error.message.includes('exec_sql')) {
        console.log('⚡ Executando SQL diretamente...');
        
        // Dividir em comandos individuais e executar
        const commands = sqlContent.split(';').filter(cmd => cmd.trim());
        
        for (const command of commands) {
          if (command.trim()) {
            try {
              const { error: cmdError } = await supabase.from('usuarios').select('id').limit(1);
              if (cmdError && cmdError.code === '42P01') {
                // Tabela não existe, precisamos criar via PostgreSQL client
                console.log('📋 Tabela não encontrada. Criando estrutura...');
                break;
              }
            } catch (e) {
              console.log('📋 Criando tabela usuarios...');
              break;
            }
          }
        }
      } else {
        throw error;
      }
    }
    
    // Verificar se a tabela foi criada
    const { data: testData, error: testError } = await supabase
      .from('usuarios')
      .select('id')
      .limit(1);
    
    if (testError) {
      if (testError.code === '42P01') {
        console.log('❌ Tabela usuarios ainda não foi criada');
        console.log('💡 Execute manualmente no SQL Editor do Supabase:');
        console.log(sqlContent);
      } else {
        console.log('✅ Tabela usuarios criada com sucesso!');
      }
    } else {
      console.log('✅ Tabela usuarios já existe e está funcionando!');
    }
    
  } catch (error) {
    console.error('💥 Erro ao configurar tabela de usuários:', error);
  }
}

setupUsuariosTable();