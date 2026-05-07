const fs = require('fs');
let c = fs.readFileSync('src/app/modo-torneio/partida/page.tsx', 'utf8');

// Procurar e substituir filtro dos jogadores
const oldA = `setJogadoresA(ordenarJogadoresComGoleiroUltimo((mapaJogadores[partida.equipe_a_id] ?? eqA?.jogadores ?? []).map(`;
const oldB = `setJogadoresB(ordenarJogadoresComGoleiroUltimo((mapaJogadores[partida.equipe_b_id] ?? eqB?.jogadores ?? []).map(`;

const newA = `setJogadoresA(ordenarJogadoresComGoleiroUltimo((mapaJogadores[partida.equipe_a_id] ?? eqA?.jogadores ?? []).filter(p => !suspensosSet.has(p.id)).map(`;
const newB = `setJogadoresB(ordenarJogadoresComGoleiroUltimo((mapaJogadores[partida.equipe_b_id] ?? eqB?.jogadores ?? []).filter(p => !suspensosSet.has(p.id)).map(`;

if (c.includes(oldA)) {
  c = c.replace(oldA, newA);
  console.log('Time A filtrado');
} else {
  console.log('Erro: Trecho Time A não encontrado');
}

if (c.includes(oldB)) {
  c = c.replace(oldB, newB);
  console.log('Time B filtrado');
} else {
  console.log('Erro: Trecho Time B não encontrado');
}

fs.writeFileSync('src/app/modo-torneio/partida/page.tsx', c, 'utf8');
console.log('Arquivo salvo.');