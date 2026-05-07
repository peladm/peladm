const fs = require('fs');
const c = fs.readFileSync('src/app/modo-torneio/painel/page.tsx', 'utf8');

// Procurar pelo trecho do modal de jogadores
const idx = c.indexOf('p.text-sm.font-semibold.text-gray-800');
if (idx > 0) {
  console.log('Encontrado em:', idx);
  console.log(c.substring(idx - 100, idx + 300));
} else {
  console.log('Não encontrado usando className');
  
  // Tentar outro padrão
  const idx2 = c.indexOf('text-gray-800');
  if (idx2 > 0) {
    console.log('Encontrado text-gray-800 em:', idx2);
    console.log(c.substring(idx2 - 150, idx2 + 150));
  }
}