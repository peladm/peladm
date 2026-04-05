import { obterCredenciais } from './credenciais';

export const validarAcessoMaster = async (): Promise<boolean> => {
  const credenciais = obterCredenciais();

  if (!credenciais?.pelada_id || !credenciais?.username || !credenciais?.senha) {
    return false;
  }

  try {
    const response = await fetch('/api/auth/admin-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pelada_id: credenciais.pelada_id,
        username: credenciais.username,
        senha_hash: credenciais.senha,
      }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data?.autorizado === true;
  } catch {
    return false;
  }
};
