import { NextRequest, NextResponse } from 'next/server';
import {
  registrarAuditoriaAdmin,
  sanitizeInput,
  supabaseAdmin,
  validarMaster,
  validarOrigemAdmin,
} from '../_utils';


const gerarPeladaId = (nomeCompleto: string, telefone: string): string => {
  const nomes = nomeCompleto.trim().toUpperCase().split(/\s+/);
  if (nomes.length < 2) {
    throw new Error('Nome completo deve ter ao menos 2 nomes (Nome e Sobrenome)');
  }

  const prefixo = nomes[0][0] + nomes[1][0];
  const apenasNumeros = telefone.replace(/\D/g, '');
  const ultimos4 = apenasNumeros.slice(-4);
  return prefixo + ultimos4;
};

const gerarUsername = (nomeCompleto: string): string => {
  const nomes = nomeCompleto.trim().split(/\s+/);
  return nomes[0].toLowerCase();
};

const gerarSenhaAdmin = (): string => {
  const numeros = '0123456789';
  let senha = '';
  for (let i = 0; i < 4; i++) {
    senha += numeros[Math.floor(Math.random() * numeros.length)];
  }
  return senha;
};

const CORES_COLETES_VALIDAS = ['#dc3545', '#000000', '#FFFFFF', '#fbbf24', '#3b82f6', '#10b981', '#f97316', '#ec4899', '#8b5cf6', '#6b7280'];
const CORES_COLETES_PADRAO = ['#000000', '#10b981'];

const normalizarCoresColetes = (input: unknown): string[] => {
  if (!Array.isArray(input)) {
    return CORES_COLETES_PADRAO;
  }

  const escolhidas = input
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => CORES_COLETES_VALIDAS.includes(item));

  const unicas = Array.from(new Set(escolhidas));
  return unicas.length >= 2 ? unicas : CORES_COLETES_PADRAO;
};

const montarRegrasPadrao = (peladaId: string, coresColetes: string[]): Record<string, any> => ({
  pelada_id: peladaId,
  jogadores_por_time: 5,
  modelo_sorteio: 'equilibrado',
  duracao: 10,
  fila_automatizada: true,
  vitorias_consecutivas: 0,
  prioridade_retorno: 'prioridade',
  regra_empate: 'ambos_saem',
  regra_apos_empate: 'desempate_decide',
  empate_conta_vitoria: false,
  tipo_fila: 'modo_partida',
  modo_sincronizacao: 'tempo_real',
  cores_coletes: coresColetes
});

const extrairColunaAusente = (error: { details?: string | null; message?: string | null }): string | null => {
  const detalhes = error.details || '';
  const mensagem = error.message || '';

  const matchDetails = detalhes.match(/column\s+'([^']+)'/i);
  if (matchDetails?.[1]) return matchDetails[1];

  const matchMessage = mensagem.match(/Could not find the '([^']+)' column/i);
  if (matchMessage?.[1]) return matchMessage[1];

  return null;
};

const upsertRegrasPadraoComFallback = async (peladaId: string, coresColetes: string[]): Promise<{ ok: boolean; ignoradas: string[]; error?: any }> => {
  const payload = montarRegrasPadrao(peladaId, coresColetes);
  const ignoradas: string[] = [];

  for (let tentativa = 0; tentativa < 12; tentativa++) {
    const { error } = await supabaseAdmin
      .from('regras')
      .upsert(payload, { onConflict: 'pelada_id' });

    if (!error) {
      return { ok: true, ignoradas };
    }

    if (error.code === 'PGRST204') {
      const colunaAusente = extrairColunaAusente({ details: error.details, message: error.message });
      if (colunaAusente && Object.prototype.hasOwnProperty.call(payload, colunaAusente)) {
        delete payload[colunaAusente];
        ignoradas.push(colunaAusente);
        continue;
      }
    }

    return { ok: false, ignoradas, error };
  }

  return { ok: false, ignoradas, error: new Error('Falha ao salvar regras padrão após múltiplas tentativas.') };
};

export async function POST(request: NextRequest) {
  try {
    const origemValida = validarOrigemAdmin(request);
    if (!origemValida.ok) {
      return NextResponse.json({ error: origemValida.error }, { status: origemValida.status });
    }

    const body = await request.json();
    const {
      pelada_id,
      username,
      senha_hash,
      modo,
      clienteId,
      formData,
    } = body;

    if (!pelada_id || !username || !senha_hash || !modo || !formData) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 });
    }

    const auth = await validarMaster(pelada_id, username, senha_hash);
    if (!auth.ok) {
      await registrarAuditoriaAdmin({
        actorPeladaId: sanitizeInput(pelada_id, 40).toUpperCase(),
        actorUsername: sanitizeInput(username, 60).toLowerCase(),
        acao: 'clientes.save.auth_falha',
        alvoPeladaId: sanitizeInput(clienteId || formData?.peladaId, 40).toUpperCase() || undefined,
        sucesso: false,
        detalhes: { motivo: auth.error },
      });
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const dadosCliente = {
      telefone: formData.telefone,
      nome: formData.nome,
      nome_pelada: formData.nomePelada,
      cidade: formData.cidade,
      uf: formData.uf,
      is_master: false,
      status: formData.status,
      acesso_pelada_tradicional: formData.acesso_pelada_tradicional,
      acesso_modo_torneio: formData.acesso_modo_torneio,
      valor_plano: formData.valor_plano || null,
      data_vencimento: formData.data_vencimento || null,
    };

    if (modo === 'update') {
      if (!clienteId) {
        return NextResponse.json({ error: 'clienteId é obrigatório para edição' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('clientes')
        .update(dadosCliente)
        .eq('pelada_id', clienteId)
        .select()
        .single();

      if (error || !data) {
        await registrarAuditoriaAdmin({
          actorPeladaId: auth.admin.pelada_id,
          actorUsername: auth.admin.username,
          acao: 'clientes.save.update',
          alvoPeladaId: sanitizeInput(clienteId, 40).toUpperCase(),
          sucesso: false,
          detalhes: { motivo: 'erro_update_cliente' },
        });
        return NextResponse.json({ error: 'Erro ao atualizar cliente' }, { status: 500 });
      }

      const coresColetes = normalizarCoresColetes(formData.cores_coletes);
      const regrasResult = await upsertRegrasPadraoComFallback(data.pelada_id, coresColetes);

      await registrarAuditoriaAdmin({
        actorPeladaId: auth.admin.pelada_id,
        actorUsername: auth.admin.username,
        acao: 'clientes.save.update',
        alvoPeladaId: data.pelada_id,
        sucesso: true,
        detalhes: {
          regras_ok: regrasResult.ok,
          regras_ignoradas: regrasResult.ignoradas,
          cores_coletes: coresColetes,
        },
      });

      return NextResponse.json({ ok: true, cliente: data, regras: regrasResult });
    }

    if (modo !== 'create') {
      return NextResponse.json({ error: 'Modo inválido' }, { status: 400 });
    }

    const nomes = String(formData.nome || '').trim().split(/\s+/);
    if (nomes.length < 2) {
      return NextResponse.json({ error: 'Informe nome completo (nome e sobrenome)' }, { status: 400 });
    }

    let novoPeladaId = String(formData.peladaId || '').trim().toUpperCase();
    if (!novoPeladaId) {
      novoPeladaId = gerarPeladaId(String(formData.nome || ''), String(formData.telefone || ''));
    }

    const { data: existente } = await supabaseAdmin
      .from('clientes')
      .select('pelada_id')
      .eq('pelada_id', novoPeladaId)
      .maybeSingle();

    if (existente) {
      await registrarAuditoriaAdmin({
        actorPeladaId: auth.admin.pelada_id,
        actorUsername: auth.admin.username,
        acao: 'clientes.save.create',
        alvoPeladaId: novoPeladaId,
        sucesso: false,
        detalhes: { motivo: 'pelada_id_duplicado' },
      });
      return NextResponse.json({ error: 'Código da pelada já existe' }, { status: 409 });
    }

    const novoUsername = gerarUsername(String(formData.nome || ''));
    const novaSenha = gerarSenhaAdmin();

    const { data: clienteCriado, error: erroCriacao } = await supabaseAdmin
      .from('clientes')
      .insert([{
        pelada_id: novoPeladaId,
        username: novoUsername,
        senha: novaSenha,
        ...dadosCliente,
        status: 'ativo',
      }])
      .select()
      .single();

    if (erroCriacao || !clienteCriado) {
      await registrarAuditoriaAdmin({
        actorPeladaId: auth.admin.pelada_id,
        actorUsername: auth.admin.username,
        acao: 'clientes.save.create',
        alvoPeladaId: novoPeladaId,
        sucesso: false,
        detalhes: { motivo: 'erro_insert_cliente' },
      });
      return NextResponse.json({ error: 'Erro ao cadastrar cliente' }, { status: 500 });
    }

    const coresColetes = normalizarCoresColetes(formData.cores_coletes);
    const regrasResult = await upsertRegrasPadraoComFallback(novoPeladaId, coresColetes);

    await registrarAuditoriaAdmin({
      actorPeladaId: auth.admin.pelada_id,
      actorUsername: auth.admin.username,
      acao: 'clientes.save.create',
      alvoPeladaId: novoPeladaId,
      sucesso: true,
      detalhes: {
        regras_ok: regrasResult.ok,
        regras_ignoradas: regrasResult.ignoradas,
        cores_coletes: coresColetes,
      },
    });

    return NextResponse.json({
      ok: true,
      cliente: clienteCriado,
      regras: regrasResult,
      credenciaisGeradas: {
        peladaId: novoPeladaId,
        usuario: novoUsername,
        senha: novaSenha,
      },
    });
  } catch (error) {
    console.error('Erro ao salvar cliente:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
