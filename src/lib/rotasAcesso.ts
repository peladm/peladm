export const obterRotaInicialPorAcesso = (
  acessoPeladaTradicional: boolean,
  acessoModoTorneio: boolean,
): string => {
  if (acessoPeladaTradicional && !acessoModoTorneio) return '/pelada-tradicional';
  if (!acessoPeladaTradicional && acessoModoTorneio) return '/modo-torneio';
  return '/';
};

export const deveRedirecionarParaModoUnico = (
  acessoPeladaTradicional: boolean,
  acessoModoTorneio: boolean,
): string | null => {
  if (acessoPeladaTradicional && !acessoModoTorneio) return '/pelada-tradicional';
  if (!acessoPeladaTradicional && acessoModoTorneio) return '/modo-torneio';
  return null;
};
