/**
 * Script de Debug - Fluxo Completo de Busca de Jogadores
 * 
 * Este script vai mostrar:
 * 1. Qual banco PRINCIPAL está configurado
 * 2. Qual pelada_id está no localStorage (ID do cliente logado)
 * 3. Quais credenciais (supabase_url e anon_key) estão cadastradas para esse cliente
 * 4. Para qual banco a conexão está apontando
 * 5. Estrutura da tabela jogadores nesse banco específico
 * 6. Se a coluna pelada_id existe na tabela
 * 7. Quantos jogadores existem nesse banco
 */

const { createClient } = require('@supabase/supabase-js');

// 1. BANCO PRINCIPAL (configurado em src/lib/supabase.ts)
const BANCO_PRINCIPAL_URL = 'https://ewcswczqvelhlwpbraea.supabase.co';
const BANCO_PRINCIPAL_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3Y3N3Y3pxdmVsaGx3cGJyYWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2Mzc1MzksImV4cCI6MjA4MDIxMzUzOX0.DRzgAuj171lUG_7wMVCFhuDH71sGxlHHEB28qBN9wks';

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║  🔍 DEBUG - FLUXO COMPLETO DE BUSCA DE JOGADORES         ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

console.log('📍 PASSO 1: BANCO PRINCIPAL');
console.log('   URL:', BANCO_PRINCIPAL_URL);
console.log('   Key:', BANCO_PRINCIPAL_KEY.substring(0, 50) + '...\n');

// 2. PEGAR PELADA_ID DO CLIENTE
// (Simular - você deve pegar do seu localStorage no navegador)
const PELADA_ID_EXEMPLO = 'MT2307';

console.log('📍 PASSO 2: PELADA_ID DO CLIENTE LOGADO');
console.log('   ⚠️  ATENÇÃO: Cole abaixo o ID do cliente que está no seu localStorage');
console.log('   Como pegar: No navegador → F12 → Console → digite: localStorage.getItem("user")');
console.log('   Copie o valor do campo "id" e cole na variável PELADA_ID_EXEMPLO\n');

async function debugarConexao() {
  try {
    // Criar conexão com banco principal
    const supabasePrincipal = createClient(BANCO_PRINCIPAL_URL, BANCO_PRINCIPAL_KEY);
    
    console.log('📍 PASSO 3: BUSCAR CREDENCIAIS DO CLIENTE');
    console.log('   Consultando tabela: clientes');
    console.log('   Filtro: id =', PELADA_ID_EXEMPLO, '\n');
    
    // Buscar credenciais do cliente
    const { data: cliente, error: erroCliente } = await supabasePrincipal
      .from('clientes')
      .select('id, nome, plano, supabase_url, supabase_anon_key')
      .eq('id', PELADA_ID_EXEMPLO)
      .single();
    
    if (erroCliente) {
      console.error('❌ ERRO ao buscar cliente:', erroCliente);
      return;
    }
    
    if (!cliente) {
      console.error('❌ Cliente não encontrado com ID:', PELADA_ID_EXEMPLO);
      return;
    }
    
    console.log('✅ Cliente encontrado:');
    console.log('   Nome:', cliente.nome);
    console.log('   Plano:', cliente.plano);
    console.log('   Banco URL:', cliente.supabase_url);
    console.log('   Tem anon_key:', cliente.supabase_anon_key ? 'SIM' : 'NÃO');
    console.log('');
    
    if (!cliente.supabase_url || !cliente.supabase_anon_key) {
      console.error('❌ PROBLEMA: Cliente não tem credenciais de banco cadastradas!');
      console.log('   Solução: Adicionar supabase_url e supabase_anon_key no cadastro do cliente\n');
      return;
    }
    
    console.log('📍 PASSO 4: CONECTAR NO BANCO DO CLIENTE');
    console.log('   URL:', cliente.supabase_url);
    console.log('   Key:', cliente.supabase_anon_key.substring(0, 50) + '...\n');
    
    // Criar conexão com banco do cliente
    const supabaseCliente = createClient(cliente.supabase_url, cliente.supabase_anon_key);
    
    console.log('📍 PASSO 5: VERIFICAR ESTRUTURA DA TABELA JOGADORES');
    console.log('   Fazendo query de teste...\n');
    
    // Tentar buscar jogadores SEM filtro pelada_id
    const { data: jogadoresSemFiltro, error: erroSemFiltro } = await supabaseCliente
      .from('jogadores')
      .select('*')
      .limit(5);
    
    if (erroSemFiltro) {
      console.error('❌ ERRO ao buscar jogadores (sem filtro):', erroSemFiltro);
      console.log('   Mensagem:', erroSemFiltro.message);
      console.log('   Código:', erroSemFiltro.code);
      console.log('');
      return;
    }
    
    console.log('✅ Jogadores encontrados (sem filtro pelada_id):');
    console.log('   Total:', jogadoresSemFiltro?.length || 0);
    
    if (jogadoresSemFiltro && jogadoresSemFiltro.length > 0) {
      console.log('   Exemplo (primeiro jogador):');
      console.log('   ', JSON.stringify(jogadoresSemFiltro[0], null, 2));
      console.log('');
      
      // Verificar se tem coluna pelada_id
      const primeiroJogador = jogadoresSemFiltro[0];
      const temPeladaId = 'pelada_id' in primeiroJogador;
      
      console.log('📍 PASSO 6: VERIFICAR COLUNA pelada_id');
      console.log('   Existe coluna pelada_id:', temPeladaId ? '✅ SIM' : '❌ NÃO');
      console.log('');
      
      if (temPeladaId) {
        // Tentar buscar COM filtro pelada_id
        console.log('📍 PASSO 7: BUSCAR COM FILTRO pelada_id');
        console.log('   Testando: .eq("pelada_id", "' + PELADA_ID_EXEMPLO + '")\n');
        
        const { data: jogadoresComFiltro, error: erroComFiltro } = await supabaseCliente
          .from('jogadores')
          .select('*')
          .eq('pelada_id', PELADA_ID_EXEMPLO);
        
        if (erroComFiltro) {
          console.error('❌ ERRO ao buscar jogadores (COM filtro pelada_id):', erroComFiltro);
          console.log('   Mensagem:', erroComFiltro.message);
          console.log('');
        } else {
          console.log('✅ Jogadores encontrados COM filtro pelada_id:');
          console.log('   Total:', jogadoresComFiltro?.length || 0);
          console.log('');
        }
      } else {
        console.log('⚠️  DIAGNÓSTICO: A tabela jogadores NÃO TEM a coluna pelada_id!');
        console.log('   Solução: Executar migração para adicionar a coluna\n');
      }
    } else {
      console.log('⚠️  Nenhum jogador encontrado na tabela\n');
    }
    
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  📋 RESUMO                                                ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('Cliente:', cliente.nome);
    console.log('Plano:', cliente.plano);
    console.log('Banco:', cliente.supabase_url);
    console.log('Jogadores sem filtro:', jogadoresSemFiltro?.length || 0);
    console.log('Tem coluna pelada_id:', jogadoresSemFiltro?.[0] ? ('pelada_id' in jogadoresSemFiltro[0] ? 'SIM' : 'NÃO') : 'N/A');
    console.log('');
    
  } catch (error) {
    console.error('💥 ERRO GERAL:', error);
  }
}

// Executar
if (PELADA_ID_EXEMPLO === 'cole-aqui-o-id-do-cliente-logado') {
  console.log('⚠️  ATENÇÃO: Você precisa colar o pelada_id do cliente!');
  console.log('   1. Abra seu navegador em http://localhost:3000');
  console.log('   2. Faça login');
  console.log('   3. Abra o Console (F12)');
  console.log('   4. Digite: localStorage.getItem("user")');
  console.log('   5. Copie o valor do campo "id"');
  console.log('   6. Cole na variável PELADA_ID_EXEMPLO neste arquivo');
  console.log('   7. Execute: node debug-conexao-jogadores.js\n');
} else {
  debugarConexao();
}
