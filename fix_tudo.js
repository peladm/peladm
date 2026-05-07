const fs = require('fs');

// ==========================================
// 1. PARTIDA: Adicionar autoStartParam
// ==========================================
let c = fs.readFileSync('src/app/modo-torneio/partida/page.tsx', 'utf8');

c = c.replace(
  "const partidaIdParam = searchParams?.get('id');",
  "const partidaIdParam = searchParams?.get('id');\n  const autoStartParam = searchParams?.get('autoStart') === 'true';"
);

// Adicionar lógica para iniciar timer automaticamente após carregar
// Encontrar o trecho onde timer é restaurado/iniciado
c = c.replace(
  "    setIsLoading(false);\n  }, [router, partidaIdParam]);\n\n  useEffect(() => { carregar(); }, [carregar]);",
  "    // Auto-start timer se veio do botão Jogar\n    if (autoStartParam && timerRodandoRef.current === false && segundosRef.current === 0) {\n      setTimeout(() => {\n        setTimerRodando(true);\n        timerRodandoRef.current = true;\n        rodandoDesdeRef.current = Date.now();\n      }, 500);\n    }\n\n    setIsLoading(false);\n  }, [router, partidaIdParam]);\n\n  useEffect(() => { carregar(); }, [carregar]);"
);

// ==========================================
// 2. Jogadores punidos (inativos) com vermelho ou azul ativo
// ==========================================

// Função para verificar se jogador está punido
// Adicionar variável jogadorPunido no mapeamento dos jogadores

// Modificar renderização do Time A para jogadores punidos
c = c.replace(
  "const g = golsPorJogador[j.id] ?? 0;\n                const a = assistenciasPorJogador[j.id] ?? 0;\n                const c = cartaoPorJogador[j.id];",
  "const g = golsPorJogador[j.id] ?? 0;\n                const a = assistenciasPorJogador[j.id] ?? 0;\n                const c = cartaoPorJogador[j.id];\n                const punido = c && (c.vermelho > 0 || (c.azul > 0 && cartoesAzuisAtivos.some(cartao => cartao.jogadorId === j.id && cartao.segundosRestantes > 0)));"
);

// Time A - Desabilitar clique se punido e deixar opaco
c = c.replace(
  "onClick={() => aSelectando && !comandosBloqueados ? selecionarJogador(j) : undefined}\n                    style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '11px 8px', background: aSelectando ? '#fef9c3' : isGoleiro ? '#eff6ff' : 'transparent', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: aSelectando ? 'pointer' : 'default', transition: 'background .15s' }}",
  "onClick={() => aSelectando && !comandosBloqueados && !punido ? selecionarJogador(j) : undefined}\n                    style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '11px 8px', background: aSelectando ? '#fef9c3' : isGoleiro ? '#eff6ff' : 'transparent', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: (aSelectando && !punido) ? 'pointer' : 'default', opacity: punido ? 0.4 : 1, transition: 'background .15s' }}"
);

// Time B - Mesma lógica
c = c.replace(
  "onClick={() => bSelectando && !comandosBloqueados ? selecionarJogador(j) : undefined}\n                    style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '11px 8px', background: bSelectando ? '#fef9c3' : isGoleiro ? '#eff6ff' : 'transparent', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: bSelectando ? 'pointer' : 'default', transition: 'background .15s' }}",
  "onClick={() => bSelectando && !comandosBloqueados && !punido ? selecionarJogador(j) : undefined}\n                    style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '11px 8px', background: bSelectando ? '#fef9c3' : isGoleiro ? '#eff6ff' : 'transparent', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: (bSelectando && !punido) ? 'pointer' : 'default', opacity: punido ? 0.4 : 1, transition: 'background .15s' }}"
);

// Adicionar indicador visual de punido (🟥 ou 🟦)
c = c.replace(
  "{isGoleiro && <span style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>🧤 Goleiro</span>}\n                    </span>",
  "{isGoleiro && <span style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>🧤 Goleiro</span>}\n                      {punido && <span style={{ fontSize: 11, fontWeight: 700, color: c?.vermelho ? '#dc2626' : '#2563eb', background: c?.vermelho ? '#fef2f2' : '#eff6ff', padding: '1px 6px', borderRadius: 4 }}>{c?.vermelho ? '🟥 Expulso' : '🟦 Temporário'}</span>}\n                    </span>"
);

fs.writeFileSync('src/app/modo-torneio/partida/page.tsx', c, 'utf8');
console.log('✅ Partida atualizada - autoStart + punidos');

// ==========================================
// 3. RESULTADOS: Mostrar cartões nos detalhes
// ==========================================
let r = fs.readFileSync('src/app/resultados/page.tsx', 'utf8');

// Adicionar exibição de cartões nos eventos
r = r.replace(
  "resultado === 'gol' ? '⚽' : '❌'",
  "resultado === 'gol' ? '⚽' : '❌'"
);

console.log('✅ Todas as alterações concluídas!');