const fs = require('fs');
const path = 'src/app/modo-torneio/partida/page.tsx';
let data = fs.readFileSync(path, 'utf8');

// Substituir Time A
const oldA = 'const c = cartaoPorJogador[j.id];\\n                const isGoleiro = !!j.goleiroSlot;\\n                return (\\n                  <button key={j.id}\\n                    onClick={() => aSelectando ? selecionarJogador(j) : undefined}';
const newA = 'const cCart = cartaoPorJogador[j.id];\\n                const isGoleiro = !!j.goleiroSlot;\\n                const punido = cCart && (cCart.vermelho > 0 || (cCart.azul > 0 && cartoesAzuisAtivos.some(cartao => cartao.jogadorId === j.id && cartao.segundosRestantes > 0)));\\n                return (\\n                  <button key={j.id}\\n                    onClick={() => aSelectando && !punido ? selecionarJogador(j) : undefined}';
data = data.replace(oldA, newA);

// Substituir Time B
const oldB = 'const c = cartaoPorJogador[j.id];\\n                const isGoleiro = !!j.goleiroSlot;\\n                return (\\n                  <button key={j.id}\\n                    onClick={() => bSelectando ? selecionarJogador(j) : undefined}';
const newB = 'const cCart = cartaoPorJogador[j.id];\\n                const isGoleiro = !!j.goleiroSlot;\\n                const punido = cCart && (cCart.vermelho > 0 || (cCart.azul > 0 && cartoesAzuisAtivos.some(cartao => cartao.jogadorId === j.id && cartao.segundosRestantes > 0)));\\n                return (\\n                  <button key={j.id}\\n                    onClick={() => bSelectando && !punido ? selecionarJogador(j) : undefined}';
data = data.replace(oldB, newB);

// Adicionar cursor e opacidade nos estilos
data = data.replace("cursor: aSelectando ? 'pointer' : 'default'", "cursor: (aSelectando && !punido) ? 'pointer' : 'default', opacity: punido ? 0.4 : 1");
data = data.replace("cursor: bSelectando ? 'pointer' : 'default'", "cursor: (bSelectando && !punido) ? 'pointer' : 'default', opacity: punido ? 0.4 : 1");

// Badge "Expulso" ou "Temporário" ao lado do nome
const badgeOld = "{isGoleiro && <span style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>🧤 Goleiro</span>}\\n                    </span>";
const badgeNew = "{isGoleiro && <span style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>🧤 Goleiro</span>}\\n                      {punido && <span style={{ fontSize: 11, fontWeight: 700, color: cCart?.vermelho ? '#dc2626' : '#2563eb', background: cCart?.vermelho ? '#fef2f2' : '#eff6ff', padding: '1px 6px', borderRadius: 4, marginLeft: 4 }}>{cCart?.vermelho ? '🟥' : '🟦'}</span>}\\n                    </span>";
data = data.replace(badgeOld, badgeNew);

console.log('Punidos OK:', data.includes('punido'));
console.log('Badge OK:', data.includes('Expulso') || data.includes('Temporário'));

fs.writeFileSync(path, data, 'utf8');
