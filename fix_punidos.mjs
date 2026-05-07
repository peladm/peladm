import fs from 'fs';

let c = fs.readFileSync('src/app/modo-torneio/partida/page.tsx', 'utf8');

// Substituir Time A - adicionar punido, opacidade e bloqueio
c = c.replace(
  "const g = golsPorJogador[j.id] ?? 0;\n                const a = assistenciasPorJogador[j.id] ?? 0;\n                const c = cartaoPorJogador[j.id];\n                const isGoleiro = !!j.goleiroSlot;\n                return (\n                  <button key={j.id}\n                    onClick={() => aSelectando ? selecionarJogador(j) : undefined}\n                    style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '11px 8px', background: aSelectando ? '#fef9c3' : isGoleiro ? '#eff6ff' : 'transparent', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: aSelectando ? 'pointer' : 'default', transition: 'background .15s' }}",
  "const g = golsPorJogador[j.id] ?? 0;\n                const a = assistenciasPorJogador[j.id] ?? 0;\n                const cCart = cartaoPorJogador[j.id];\n                const isGoleiro = !!j.goleiroSlot;\n                const punido = cCart && (cCart.vermelho > 0 || (cCart.azul > 0 && cartoesAzuisAtivos.some(cartao => cartao.jogadorId === j.id && cartao.segundosRestantes > 0)));\n                return (\n                  <button key={j.id}\n                    onClick={() => aSelectando && !punido ? selecionarJogador(j) : undefined}\n                    style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '11px 8px', background: aSelectando ? '#fef9c3' : isGoleiro ? '#eff6ff' : 'transparent', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: (aSelectando && !punido) ? 'pointer' : 'default', opacity: punido ? 0.4 : 1, transition: 'background .15s' }}"
);

console.log('Time A - punido OK: ' + c.includes('punido'));

// Substituir Time B (mesma estrutura)
c = c.replace(
  "const g = golsPorJogador[j.id] ?? 0;\n                const a = assistenciasPorJogador[j.id] ?? 0;\n                const c = cartaoPorJogador[j.id];\n                const isGoleiro = !!j.goleiroSlot;\n                return (\n                  <button key={j.id}\n                    onClick={() => bSelectando ? selecionarJogador(j) : undefined}\n                    style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '11px 8px', background: bSelectando ? '#fef9c3' : isGoleiro ? '#eff6ff' : 'transparent', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: bSelectando ? 'pointer' : 'default', transition: 'background .15s' }}",
  "const g = golsPorJogador[j.id] ?? 0;\n                const a = assistenciasPorJogador[j.id] ?? 0;\n                const cCart = cartaoPorJogador[j.id];\n                const isGoleiro = !!j.goleiroSlot;\n                const punido = cCart && (cCart.vermelho > 0 || (cCart.azul > 0 && cartoesAzuisAtivos.some(cartao => cartao.jogadorId === j.id && cartao.segundosRestantes > 0)));\n                return (\n                  <button key={j.id}\n                    onClick={() => bSelectando && !punido ? selecionarJogador(j) : undefined}\n                    style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: '11px 8px', background: bSelectando ? '#fef9c3' : isGoleiro ? '#eff6ff' : 'transparent', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: (bSelectando && !punido) ? 'pointer' : 'default', opacity: punido ? 0.4 : 1, transition: 'background .15s' }}"
);

console.log('Time B - punido OK');

// Adicionar badge de punido ao lado do nome (🟥 Expulso ou 🟦 Temporário)
c = c.replace(
  "{isGoleiro && <span style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>🧤 Goleiro</span>}\n                    </span>",
  "{isGoleiro && <span style={{ fontSize: 12, fontWeight: 700, color: '#1f2937' }}>🧤 Goleiro</span>}\n                      {punido && <span style={{ fontSize: 11, fontWeight: 700, color: cCart?.vermelho ? '#dc2626' : '#2563eb', background: cCart?.vermelho ? '#fef2f2' : '#eff6ff', padding: '1px 6px', borderRadius: 4, marginLeft: 4 }}>{cCart?.vermelho ? '🟥' : '🟦'}</span>}\n                    </span>"
);

console.log('Badge punido adicionado');

fs.writeFileSync('src/app/modo-torneio/partida/page.tsx', c, 'utf8');
console.log('✅ Arquivo salvo');