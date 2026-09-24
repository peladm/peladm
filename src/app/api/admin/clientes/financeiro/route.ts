import { NextRequest, NextResponse } from 'next/server';
import {
  registrarAuditoriaAdmin,
  sanitizeInput,
  supabaseAdmin,
  validarMaster,
  validarOrigemAdmin,
} from '../_utils';

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
      clienteId,
      acao,
      valor_plano,
      data_vencimento,
      meses,
    } = body;

    if (!pelada_id || !username || !senha_hash || !clienteId || !acao) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 });
    }

    const auth = await validarMaster(pelada_id, username, senha_hash);
    if (!auth.ok) {
      await registrarAuditoriaAdmin({
        actorPeladaId: sanitizeInput(pelada_id, 40).toUpperCase(),
        actorUsername: sanitizeInput(username, 60).toLowerCase(),
        acao: 'clientes.financeiro.auth_falha',
        alvoPeladaId: sanitizeInput(clienteId, 40).toUpperCase() || undefined,
        sucesso: false,
        detalhes: { motivo: auth.error, operacao: acao },
      });
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (acao === 'atualizar') {
      const { data, error } = await supabaseAdmin
        .from('clientes')
        .update({
          valor_plano: Number(valor_plano) || 0,
          data_vencimento: data_vencimento || null,
        })
        .eq('pelada_id', clienteId)
        .select('pelada_id, valor_plano, data_vencimento, status')
        .single();

      if (error || !data) {
        await registrarAuditoriaAdmin({
          actorPeladaId: auth.admin.pelada_id,
          actorUsername: auth.admin.username,
          acao: 'clientes.financeiro.atualizar',
          alvoPeladaId: sanitizeInput(clienteId, 40).toUpperCase(),
          sucesso: false,
          detalhes: { motivo: 'erro_update_financeiro' },
        });
        return NextResponse.json({ error: 'Falha ao atualizar dados financeiros' }, { status: 500 });
      }

      await registrarAuditoriaAdmin({
        actorPeladaId: auth.admin.pelada_id,
        actorUsername: auth.admin.username,
        acao: 'clientes.financeiro.atualizar',
        alvoPeladaId: data.pelada_id,
        sucesso: true,
        detalhes: { valor_plano: data.valor_plano, data_vencimento: data.data_vencimento },
      });

      return NextResponse.json({ ok: true, cliente: data });
    }

    if (acao === 'confirmar_pagamento') {
      const mesesPagamento = Math.max(1, Number(meses) || 1);

      const { data: clienteAtual, error: errCliente } = await supabaseAdmin
        .from('clientes')
        .select('data_vencimento')
        .eq('pelada_id', clienteId)
        .single();

      if (errCliente || !clienteAtual?.data_vencimento) {
        await registrarAuditoriaAdmin({
          actorPeladaId: auth.admin.pelada_id,
          actorUsername: auth.admin.username,
          acao: 'clientes.financeiro.confirmar_pagamento',
          alvoPeladaId: sanitizeInput(clienteId, 40).toUpperCase(),
          sucesso: false,
          detalhes: { motivo: 'sem_vencimento' },
        });
        return NextResponse.json({ error: 'Cliente sem data de vencimento definida' }, { status: 400 });
      }

      const dataAtual = new Date(`${clienteAtual.data_vencimento}T00:00:00`);
      dataAtual.setMonth(dataAtual.getMonth() + mesesPagamento);
      const novaData = dataAtual.toISOString().split('T')[0];

      const { data, error } = await supabaseAdmin
        .from('clientes')
        .update({ data_vencimento: novaData, status: 'ativo' })
        .eq('pelada_id', clienteId)
        .select('pelada_id, data_vencimento, status')
        .single();

      if (error || !data) {
        await registrarAuditoriaAdmin({
          actorPeladaId: auth.admin.pelada_id,
          actorUsername: auth.admin.username,
          acao: 'clientes.financeiro.confirmar_pagamento',
          alvoPeladaId: sanitizeInput(clienteId, 40).toUpperCase(),
          sucesso: false,
          detalhes: { motivo: 'erro_confirmar_pagamento' },
        });
        return NextResponse.json({ error: 'Falha ao confirmar pagamento' }, { status: 500 });
      }

      await registrarAuditoriaAdmin({
        actorPeladaId: auth.admin.pelada_id,
        actorUsername: auth.admin.username,
        acao: 'clientes.financeiro.confirmar_pagamento',
        alvoPeladaId: data.pelada_id,
        sucesso: true,
        detalhes: { novaData, mesesPagamento },
      });

      return NextResponse.json({ ok: true, cliente: data, novaData, mesesPagamento });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('Erro na API financeiro:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
