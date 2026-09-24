import { NextRequest, NextResponse } from 'next/server';
import {
  excluirDadosClientePorPeladaId,
  registrarAuditoriaAdmin,
  sanitizeInput,
  supabaseAdmin,
  validarMaster,
  validarOrigemAdmin,
} from '../_utils';

import { createHash } from 'node:crypto';

const hashSenha = (senha: string): string => createHash('sha256').update(senha).digest('hex');

const calcularStatusAoCancelarExclusao = (dataVencimento?: string | null): 'ativo' | 'bloqueado' => {
  if (!dataVencimento) return 'ativo';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const vencimento = new Date(`${dataVencimento}T00:00:00`);
  vencimento.setHours(0, 0, 0, 0);

  return vencimento < hoje ? 'bloqueado' : 'ativo';
};

export async function POST(request: NextRequest) {
  try {
    const origemValida = validarOrigemAdmin(request);
    if (!origemValida.ok) {
      return NextResponse.json({ error: origemValida.error }, { status: origemValida.status });
    }

    const body = await request.json();
    const { pelada_id, username, senha_hash, senha_confirmacao_hash, clienteId, acao, dataRemocao } = body;

    if (!pelada_id || !username || !senha_hash || !clienteId || !acao) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 });
    }

    const auth = await validarMaster(pelada_id, username, senha_hash);
    if (!auth.ok) {
      await registrarAuditoriaAdmin({
        actorPeladaId: sanitizeInput(pelada_id, 40).toUpperCase(),
        actorUsername: sanitizeInput(username, 60).toLowerCase(),
        acao: 'clientes.delete.auth_falha',
        alvoPeladaId: sanitizeInput(clienteId, 40).toUpperCase() || undefined,
        sucesso: false,
        detalhes: { motivo: auth.error, operacao: acao },
      });
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const alvoPeladaId = sanitizeInput(clienteId, 40).toUpperCase();
    const { data: cliente, error: clienteError } = await supabaseAdmin
      .from('clientes')
      .select('pelada_id, nome, is_master, status, data_vencimento, data_remocao_programada')
      .ilike('pelada_id', alvoPeladaId)
      .maybeSingle();

    if (clienteError || !cliente) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    if (cliente.is_master === true) {
      return NextResponse.json({ error: 'O perfil master não pode ser excluído' }, { status: 400 });
    }

    if ((acao === 'programar_exclusao' || acao === 'remover_imediatamente') && !senha_confirmacao_hash) {
      return NextResponse.json({ error: 'Senha de confirmação obrigatória' }, { status: 400 });
    }

    if (senha_confirmacao_hash) {
      const hashNoBanco = hashSenha(String(auth.admin.senha_raw || ''));
      if (hashNoBanco !== senha_confirmacao_hash) {
        return NextResponse.json({ error: 'Senha de confirmação inválida' }, { status: 401 });
      }
    }

    if (acao === 'programar_exclusao') {
      if (!dataRemocao) {
        return NextResponse.json({ error: 'Data de remoção obrigatória' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('clientes')
        .update({
          status: 'excluido',
          data_remocao_programada: dataRemocao,
        })
        .eq('pelada_id', alvoPeladaId)
        .select('pelada_id, status, data_remocao_programada')
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Falha ao programar exclusão' }, { status: 500 });
      }

      await registrarAuditoriaAdmin({
        actorPeladaId: auth.admin.pelada_id,
        actorUsername: auth.admin.username,
        acao: 'clientes.delete.programar_exclusao',
        alvoPeladaId: data.pelada_id,
        sucesso: true,
        detalhes: { data_remocao_programada: data.data_remocao_programada },
      });

      return NextResponse.json({ ok: true, cliente: data });
    }

    if (acao === 'cancelar_exclusao') {
      const statusRestaurado = calcularStatusAoCancelarExclusao(cliente.data_vencimento);
      const { data, error } = await supabaseAdmin
        .from('clientes')
        .update({
          status: statusRestaurado,
          data_remocao_programada: null,
        })
        .eq('pelada_id', alvoPeladaId)
        .select('pelada_id, status, data_remocao_programada')
        .single();

      if (error || !data) {
        return NextResponse.json({ error: 'Falha ao cancelar exclusão' }, { status: 500 });
      }

      await registrarAuditoriaAdmin({
        actorPeladaId: auth.admin.pelada_id,
        actorUsername: auth.admin.username,
        acao: 'clientes.delete.cancelar_exclusao',
        alvoPeladaId: data.pelada_id,
        sucesso: true,
        detalhes: { status_restaurado: statusRestaurado },
      });

      return NextResponse.json({ ok: true, cliente: data });
    }

    if (acao === 'remover_imediatamente') {
      const resultado = await excluirDadosClientePorPeladaId(alvoPeladaId, { removerRegistroCliente: true });

      await registrarAuditoriaAdmin({
        actorPeladaId: auth.admin.pelada_id,
        actorUsername: auth.admin.username,
        acao: 'clientes.delete.remover_imediatamente',
        alvoPeladaId: alvoPeladaId,
        sucesso: true,
        detalhes: resultado,
      });

      return NextResponse.json({ ok: true, removido: true, resultado });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('Erro na API delete cliente:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
