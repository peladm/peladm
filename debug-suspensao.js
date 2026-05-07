// Script de debug para verificar suspensão automática
// Execute no console do navegador na tela de torneio

function debugSuspensaoAutomatica() {
  const peladaId = localStorage.getItem('pelada_id') || 'default';
  const torneioAtivo = JSON.parse(localStorage.getItem(`torneio_ativo_${peladaId}`) || 'null');

  if (!torneioAtivo) {
    console.log('❌ Nenhum torneio ativo encontrado');
    return;
  }

  console.log('🏆 Torneio Ativo:', torneioAtivo.nome);

  // Verificar registros de cartões
  const registrosKey = `registros_cartoes_${peladaId}_${torneioAtivo.id}`;
  const registros = JSON.parse(localStorage.getItem(registrosKey) || '[]');

  console.log('📋 Registros de Cartões:', registros);

  // Verificar regras
  const regrasKey = `regras_competicao_${peladaId}_${torneioAtivo.id}`;
  const regras = JSON.parse(localStorage.getItem(regrasKey) || 'null');

  console.log('⚙️ Regras:', regras);

  // Verificar suspensões ativas (deve estar vazio agora)
  const suspensoesKey = `suspensos_ativos_${peladaId}_${torneioAtivo.id}`;
  const suspensoes = JSON.parse(localStorage.getItem(suspensoesKey) || '[]');

  console.log('🚫 Suspensões Ativas (deve estar vazio):', suspensoes);

  // Verificar jogadores suspensos na próxima partida
  if (registros.length > 0 && regras) {
    const limiteAmarelos = regras.acumulacao_cartoes_amarelos || 0;
    const limiteAzuis = regras.acumulacao_cartoes_azuis || 0;

    console.log(`🎯 Limite amarelos: ${limiteAmarelos}, Limite azuis: ${limiteAzuis}`);

    const suspensos = registros.filter(r => {
      const atingiuAmarelos = limiteAmarelos > 0 && r.suspensao_automatica >= limiteAmarelos;
      const atingiuAzuis = limiteAzuis > 0 && r.suspensao_automatica >= limiteAzuis;
      return atingiuAmarelos || atingiuAzuis;
    });

    console.log('🚫 Jogadores suspensos na próxima partida:', suspensos);
  }
}

// Executar debug
debugSuspensaoAutomatica();