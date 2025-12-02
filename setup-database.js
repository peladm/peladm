/**
 * Script para criar tabelas no Supabase via API
 * Execute: node setup-database.js
 */

const fs = require('fs');
const path = require('path');

// Suas credenciais Supabase
const SUPABASE_URL = 'https://ewcswczqvelhlwpbraea.supabase.co';
const SUPABASE_SERVICE_KEY = 'SUA_SERVICE_KEY_AQUI'; // Você precisa pegar essa no Supabase

async function setupDatabase() {
  console.log('🚀 Iniciando setup do banco de dados...');
  
  try {
    // Ler arquivo SQL
    const sqlFile = path.join(__dirname, 'database-setup.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // Executar SQL via API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      },
      body: JSON.stringify({
        sql: sql
      })
    });
    
    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status} - ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Banco de dados criado com sucesso!');
    console.log('📋 Tabelas criadas:');
    console.log('   - users (usuários e perfis)');
    console.log('   - clients (multi-tenant)'); 
    console.log('   - peladas (grupos de futebol)');
    console.log('   - players (jogadores)');
    console.log('   - matches (partidas)');
    console.log('   - match_players (jogadores por partida)');
    console.log('   - queue (fila de espera)');
    console.log('\n🎯 Pronto para usar!');
    
  } catch (error) {
    console.error('❌ Erro ao criar banco:', error.message);
    console.log('\n💡 Alternativa: Execute o arquivo database-setup.sql manualmente no Supabase');
    console.log('   1. Acesse https://app.supabase.com/project/ewcswczqvelhlwpbraea');
    console.log('   2. Vá em SQL Editor');
    console.log('   3. Cole o conteúdo do arquivo database-setup.sql');
    console.log('   4. Execute o script');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };