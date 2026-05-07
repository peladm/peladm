const fs = require('fs');
let c = fs.readFileSync('src/app/modo-torneio/painel/page.tsx', 'utf8');

// 1. Adicionar import de obterRegistrosCartoesLocal
if (!c.includes('obterRegistrosCartoesLocal')) {
  c = c.replace(
    'obterTorneiosEncerrados,\n} from',
    'obterTorneiosEncerrados,\n  obterRegistrosCartoesLocal,\n} from'
  );
  console.log('Import adicionado');
}

// 2. Adicionar estado de cartoesAcumulados após 'const [stats, setStats]'
c = c.replace(
  "const [stats, setStats] = useState<EstatisticaJogadorTorneio[]>([]);",
  "const [stats, setStats] = useState<EstatisticaJogadorTorneio[]>([]);\n  const [cartoesAcumulados, setCartoesAcumulados] = useState<Record<string, { amarelos: number; vermelhos: number; azuis: number; suspenso: boolean }>>({});"
);

// 3. Dentro da função carregar, adicionar busca de cartões
const buscaCartoes = `\n    // Carregar registros de cartões acumulados\n    const regsCartoes = obterRegistrosCartoesLocal(t.id);\n    const mapaCartoes: Record<string, { amarelos: number; vermelhos: number; azuis: number; suspenso: boolean }> = {};\n    regsCartoes.forEach(r => {\n      mapaCartoes[r.jogador_id] = {\n        amarelos: r.cartoesAmarelos,\n        vermelhos: 0, // não exposto na interface atual, ajustar se necessário\n        azuis: r.cartoesAzuis,\n        suspenso: r.suspensaoPendente\n      };\n    });\n    setCartoesAcumulados(mapaCartoes);\n`;

if (!c.includes('mapaCartoes: Record<string, { amarelos')) {
  // Inserir logo após o carregamento de 'stats'
  c = c.replace(
    'setStats(obterEstatisticasTorneio(t.id));',
    'setStats(obterEstatisticasTorneio(t.id));' + buscaCartoes
  );
  console.log('Busca de cartões adicionada');
}

fs.writeFileSync('src/app/modo-torneio/painel/page.tsx', c, 'utf8');
console.log('✅ Painel atualizado!');