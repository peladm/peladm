"const fs = require('fs');
const path = 'src/app/modo-torneio/partida/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// ==========================================
// 1. Remover badges de Expulso/Temporário (já foi feito, verificar)
// ==========================================
c = c.replace(
  \"{punido && <span style={{ fontSize: 11, fontWeight: 700, color: cCart?.vermelho ? '#dc2626' : '#2563eb', background: cCart?.vermelho ? '#fef2f2' : '#eff6ff', padding: '1px 6px', borderRadius: 4, marginLeft: 4 }}>{cCart?.vermelho ? '🟥 Expulso' : '🟦 Temporário'}</span>}\",
  ''
);
console.log('Badges removidos');

// ==========================================
// 2. Remover blocos de cartões antigos (CARTAO_TIPOS.map) do Time A e Time B
// ==========================================

// Encontrar e remover Bloco Time A (se existe)
const padraoBlocoCartoes = new RegExp(
  '<div style=\\{\\{ display: \\'flex\\', justifyContent: \\'center\\', gap: 2, flex: 1 \\}\\}>\\\\s*\\\\{CARTAO_TIPOS\\.map\\(\\\\(tipo\\\\) => \\\\{[\\\\s\\\\S]*?<\\\\/button>\\\\s*\\\\)\\}\\\\s*<\\\\/div>',
  'g'
);
c = c.replace(padraoBlocoCartoes, '');
console.log('Blocos de cartões antigos removidos');

// ==========================================
// 3. Adicionar botão único de cartão na linha Gol/VAR
// ==========================================

// Encontrar a linha do VAR e inserir botão de cartão antes e depois
// Time A: antes do VAR, Time B: depois do VAR

// Substituir a linha: botão Gol A | VAR | botão Gol B
// Adicionar botão de cartão antes do VAR (Time A) e depois (Time B)

// Procurar onde está o VAR
const idxVar = c.indexOf('>VAR</button>');
const antesVar = c.lastIndexOf('<button', idxVar);
const depoisVar = c.indexOf('<button', idxVar + 10);

// Pegar os estilos dos botões de gol para manter consistência
const golAClose = c.substring(0, idxVar).lastIndexOf('</button>');
const golAStyle = c.substring(golAClose - 10, golAClose);
console.log('Contexto ao redor do VAR:', c.substring(idxVar - 150, idxVar + 50));

// Inserir botão de cartão para Time A antes do VAR e para Time B depois do VAR
// Botão A: antes do VAR
c = c.replace(
  '>VAR</button>',
  '>{cartaoModalAberto && <CartaoModal equipe=\"A\" onSelect={selecionarCartaoA} onClose={fecharCartaoModal} />}<button onClick={() => setCartaoModalA(true)} style={{ padding: \\'12px 14px\\', borderRadius: 12, background: cartaoModalAberto ? \\'#fef3c7\\' : \\'#f3f4f6\\', border: \\'none\\', color: cartaoModalAberto ? \\'#b45309\\' : \\'#6b7280\\', fontWeight: 700, fontSize: 14, cursor: \\'pointer\\', whiteSpace: \\'nowrap\\' }}><img src=\"/cartao-vermelho.png\" style={{ width: 16, height: 16 }} /></button>VAR</button>'
);

// Depois do VAR, botão do Time B
c = c.replace(
  '>VAR</button><button',
  '>VAR</button><button onClick={() => setCartaoModalB(true)} style={{ padding: \\'12px 14px\\', borderRadius: 12, background: cartaoModalBerto ? \\'#fef3c7\\' : \\'#f3f4f6\\', border: \\'none\\', color: cartaoModalBerto ? \\'#b45309\\' : \\'#6b7280\\', fontWeight: 700, fontSize: 14, cursor: \\'pointer\\', whiteSpace: \\'nowrap\\' }}><img src=\"/cartao-vermelho.png\" style={{ width: 16, height: 16 }} /></button><button'
);

console.log('Botões de cartão adicionados');

// ==========================================
// 4. Adicionar estados e funções do modal de cartão
// ==========================================

// Adicionar estados no componente
c = c.replace(
  'const [cartoesAzuisAtivos, setCartoesAzuisAtivos] = useState<CartaoAzulAtivo[]>([]);',
  'const [cartoesAzuisAtivos, setCartoesAzuisAtivos] = useState<CartaoAzulAtivo[]>([]);\\nconst [cartaoModalA, setCartaoModalA] = useState(false);\\nconst [cartaoModalB, setCartaoModalB] = useState(false);'
);

// Adicionar funções de seleção de cartão
c = c.replace(
  'const selecionarJogador = (jogador: JogadorComEquipe) => {',
  'const selecionarCartao = (equipe: \\'A\\' | \\'B\\', tipo: CartaoTipo) => {\\n    setCartaoTipo(tipo);\\n    setSeletorVisivel(equipe);\\n    setTipoEvento(\\'cartao\\');\\n    if (equipe === \\'A\\') setCartaoModalA(false);\\n    else setCartaoModalB(false);\\n  };\\n\\n  const selecionarJogador = (jogador: JogadorComEquipe) => {'
);

console.log('Funções adicionadas');

// ==========================================
// 5. Adicionar lógica de cancelamento: clicar no botão ativo cancela
// ==========================================

// Cancelar ação de gol: se clicar no botão de gol enquanto já está selecionando gol, cancela
c = c.replace(
  'onClick={() => { if (!comandosBloqueados && temJogadores) { setSeletorVisivel(\\'A\\'); setTipoEvento(\\'gol\\'); } else if (!comandosBloqueados) registrarGolSemJogador(\\'A\\'); }} disabled={comandosBloqueados}',
  'onClick={() => { if (!comandosBloqueados) { if (seletorVisivel === \\'A\\' && tipoEvento === \\'gol\\') { setSeletorVisivel(null); setTipoEvento(null); } else if (temJogadores) { setSeletorVisivel(\\'A\\'); setTipoEvento(\\'gol\\'); } else registrarGolSemJogador(\\'A\\'); } }} disabled={comandosBloqueados}'
);

c = c.replace(
  'onClick={() => { if (!comandosBloqueados && temJogadores) { setSeletorVisivel(\\'B\\'); setTipoEvento(\\'gol\\'); } else if (!comandosBloqueados) registrarGolSemJogador(\\'B\\'); }} disabled={comandosBloqueados}',
  'onClick={() => { if (!comandosBloqueados) { if (seletorVisivel === \\'B\\' && tipoEvento === \\'gol\\') { setSeletorVisivel(null); setTipoEvento(null); } else if (temJogadores) { setSeletorVisivel(\\'B\\'); setTipoEvento(\\'gol\\'); } else registrarGolSemJogador(\\'B\\'); } }} disabled={comandosBloqueados}'
);

console.log('Cancelamento de gol adicionado');

fs.writeFileSync(path, c, 'utf8');
console.log('✅ Arquivo salvo!');"