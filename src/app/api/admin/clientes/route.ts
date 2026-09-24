import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  excluirDadosClientePorPeladaId,
  registrarAuditoriaAdmin,
  sanitizeInput,
  sincronizarStatusClientePorVencimento,
} from './_utils';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const hashSenha = (senha: string): string => {
  return createHash('sha256').update(senha).digest('hex');
};

const isMissingColumnError = (error: unknown, columnName: string): boolean => {
  const message = String((error as { message?: string } | null)?.message || '');
  return message.toLowerCase().includes(columnName.toLowerCase());
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pelada_id, username, senha_hash, senha_confirmacao_hash, clienteId, acao, dataRemocao } = body;

    if (!pelada_id || !username || !senha_hash) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    // Verifica se é admin/master
    const { data: admin, error: adminError } = await supabaseAdmin
      .from('clientes')
      .select('pelada_id, username, senha, is_master, status')
      .eq('pelada_id', pelada_id)
      .eq('username', username)
      .single();

    if (adminError || !admin) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 401 });
    }

    if (admin.status !== 'ativo') {
      return NextResponse.json({ error: 'Usuário inativo' }, { status: 403 });
    }

    const senhaCorreta = hashSenha(String(admin.senha || '')) === senha_hash;
    if (!senhaCorreta) {
      return NextResponse.json({ error: 'Senha inválida' }, { status: 401 });
    }

    if (admin.is_master !== true) {
      return NextResponse.json({ error: 'Acesso restrito ao master' }, { status: 403 });
    }

    const calcularStatusAoCancelarExclusao = (dataVencimento?: string | null): 'ativo' | 'bloqueado' => {
      if (!dataVencimento) return 'ativo';

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const vencimento = new Date(`${dataVencimento}T00:00:00`);
      vencimento.setHours(0, 0, 0, 0);

      return vencimento < hoje ? 'bloqueado' : 'ativo';
    };

    if (acao === 'remover_imediatamente' || acao === 'programar_exclusao' || acao === 'cancelar_exclusao') {
      if (!clienteId) {
        return NextResponse.json({ error: 'Cliente não informado' }, { status: 400 });
      }

      const alvoPeladaId = sanitizeInput(clienteId, 40).toUpperCase();
      const { data: cliente, error: clienteError } = await supabaseAdmin
        .from('clientes')
        .select('pelada_id, nome, is_master, status, data_vencimento')
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
        const hashNoBanco = hashSenha(String(admin.senha || ''));
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
          .update({ status: 'excluido', data_remocao_programada: dataRemocao })
          .ilike('pelada_id', alvoPeladaId)
          .select('pelada_id, status, data_remocao_programada')
          .maybeSingle();

        if (error && isMissingColumnError(error, 'data_remocao_programada')) {
          return NextResponse.json({ error: 'A coluna data_remocao_programada ainda não existe no banco. Rode o script add-exclusao-clientes.sql para usar exclusão agendada.' }, { status: 409 });
        }

        if (error || !data) {
          return NextResponse.json({ error: 'Falha ao programar exclusão' }, { status: 500 });
        }

        await registrarAuditoriaAdmin({
          actorPeladaId: admin.pelada_id,
          actorUsername: admin.username,
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
          .update({ status: statusRestaurado, data_remocao_programada: null })
          .ilike('pelada_id', alvoPeladaId)
          .select('pelada_id, status, data_remocao_programada')
          .maybeSingle();

        if (error && isMissingColumnError(error, 'data_remocao_programada')) {
          return NextResponse.json({ error: 'A coluna data_remocao_programada ainda não existe no banco. Rode o script add-exclusao-clientes.sql para usar exclusão agendada.' }, { status: 409 });
        }

        if (error || !data) {
          return NextResponse.json({ error: 'Falha ao cancelar exclusão' }, { status: 500 });
        }

        await registrarAuditoriaAdmin({
          actorPeladaId: admin.pelada_id,
          actorUsername: admin.username,
          acao: 'clientes.delete.cancelar_exclusao',
          alvoPeladaId: data.pelada_id,
          sucesso: true,
          detalhes: { status_restaurado: statusRestaurado },
        });

        return NextResponse.json({ ok: true, cliente: data });
      }

      const resultado = await excluirDadosClientePorPeladaId(alvoPeladaId, { removerRegistroCliente: true });

      await registrarAuditoriaAdmin({
        actorPeladaId: admin.pelada_id,
        actorUsername: admin.username,
        acao: 'clientes.delete.remover_imediatamente',
        alvoPeladaId,
        sucesso: true,
        detalhes: resultado,
      });

      return NextResponse.json({ ok: true, removido: true, resultado });
    }

    // Se chegou aqui, é admin. Busca os clientes
    const { data: clientes, error: clientesError } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .order('nome');

    if (clientesError) {
      console.error('Erro ao carregar clientes:', clientesError);
      return NextResponse.json({ error: 'Erro ao carregar clientes' }, { status: 500 });
    }

    const clientesNormalizados = await Promise.all((clientes || []).map(sincronizarStatusClientePorVencimento));

    return NextResponse.json({ clientes: clientesNormalizados });
  } catch (error) {
    console.error('Erro na API:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, { status: 500 });
  }
}
