/**
 * Lista de nomes zoeiros para os times do torneio.
 * Adicione novos nomes aqui à vontade!
 */
export const NOMES_TIMES_TORNEIO: string[] = [
  // Originais
  'Pernas de Pau',
  'Cachaçeiros',
  'Zero Habilidade',
  'Bola Murcha',
  'Perna Bamba',
  'Os Gordinhos',
  'Toco Futebol Clube',
  'Cansados FC',
  'Esquenta Banco',
  'Vai Que É Tua',
  'Faz o L',
  'Os Pênaltis',
  'Chutou Errado',
  'Fora de Forma',
  'Barriga de Aluguel',
  'Sem Preparo',
  'Joelho de Ferro',
  'Dois Tempos',
  'Chutou na Trave',
  'Os Atrasados',
  'Tá Valendo',
  'Caiu na Área',
  'Fez na Mão',
  'Gandula United',
  'Faltou no Treino',
  'Os Sortudos',
  'Carrinho Errou',
  'Suor e Banha',
  'Deu Ruim FC',
  'Mal Dormido',
  'Só na Raça',
  'Péssima Fase',
  'Lesão Misteriosa',
  'Expulso no 1º Tempo',
  'Gol Contra FC',
  'Fome de Bola',
  'Ressaca Futebol',
  'Tromba Fina',
  'Pedalou Caiu',
  'Os Bestas',

  // Adicionados
  'Pé Descalço',
  'Caneludos',
  'Fome Zero',
  'Sem Futuro',
  'Só Derrota',
  'Inacreditável FC',
  'Amigos do Juiz',
  'Papel Higiênico',
  'Come Capim',
  'Gordura Trans',
  'Água com Gás',
  'Sem Ritmo',
  'Lesionados',
  'Chama o VAR',
  'Pindaíba',
  'Diarreia',
  'Má Fase',
  'Anulados FC',
  'Calça Jeans',
  'Eutanásia',
  'Assustados',
  'Pé de Foice',
];

/**
 * Retorna `quantidade` nomes únicos escolhidos aleatoriamente da lista.
 */
export function sortearNomesUnicos(quantidade: number): string[] {
  const embaralhados = [...NOMES_TIMES_TORNEIO].sort(() => Math.random() - 0.5);
  return Array.from({ length: quantidade }, (_, i) => embaralhados[i % embaralhados.length]);
}
