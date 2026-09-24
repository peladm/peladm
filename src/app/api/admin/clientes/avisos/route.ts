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
      acao,
      aviso,
      id,
    } = body;

    if (!pelada_id || !username || !senha_hash || !acao) {
      return NextResponse.json({ error: 'Dados obrigatórios ausentes' }, { status: 400 });
    }

    const auth = await validarMaster(pelada_id, username, senha_hash);
    if (!auth.ok) {
      await registrarAuditoriaAdmin({
        actorPeladaId: sanitizeInput(pelada_id, 40).toUpperCase(),
        actorUsername: sanitizeInput(username, 60).toLowerCase(),
        acao: 'clientes.avisos.auth_falha',
        sucesso: false,
        detalhes: { motivo: auth.error, operacao: acao },
      });
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (acao === 'listar') {
      const { data, error } = await supabaseAdmin
        .from('avisos_sistema')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) {
        await registrarAuditoriaAdmin({
          actorPeladaId: auth.admin.pelada_id,
          actorUsername: auth.admin.username,
          acao: 'clientes.avisos.listar',
          sucesso: false,
          detalhes: { motivo: 'erro_listar_avisos' },
        });
        return NextResponse.json({ error: 'Erro ao carregar avisos' }, { status: 500 });
      }

      await registrarAuditoriaAdmin({
        actorPeladaId: auth.admin.pelada_id,
        actorUsername: auth.admin.username,
        acao: 'clientes.avisos.listar',
        sucesso: true,
        detalhes: { quantidade: data?.length || 0 },
      });

      return NextResponse.json({ ok: true, avisos: data || [] });
    }

    if (acao === 'criar') {
      if (!aviso?.mensagem || !aviso?.dataInicio || !aviso?.dataFim) {
        return NextResponse.json({ error: 'Preencha todos os campos obrigatórios' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('avisos_sistema')
        .insert([{
          mensagem: aviso.mensagem,
          plano_alvo: 'todos',
          data_inicio: aviso.dataInicio,
          data_fim: aviso.dataFim,
          ativo: true,
        }])
        .select('*')
        .single();

      if (error || !data) {
        await registrarAuditoriaAdmin({
          actorPeladaId: auth.admin.pelada_id,
          actorUsername: auth.admin.username,
          acao: 'clientes.avisos.criar',
          sucesso: false,
          detalhes: { motivo: 'erro_criar_aviso' },
        });
        return NextResponse.json({ error: 'Erro ao salvar aviso' }, { status: 500 });
      }

      await registrarAuditoriaAdmin({
        actorPeladaId: auth.admin.pelada_id,
        actorUsername: auth.admin.username,
        acao: 'clientes.avisos.criar',
        sucesso: true,
        detalhes: { aviso_id: data.id, publico_alvo: 'todos' },
      });

      return NextResponse.json({ ok: true, aviso: data });
    }

    if (acao === 'excluir') {
      if (!id) {
        return NextResponse.json({ error: 'ID do aviso é obrigatório' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('avisos_sistema')
        .delete()
        .eq('id', id);

      if (error) {
        await registrarAuditoriaAdmin({
          actorPeladaId: auth.admin.pelada_id,
          actorUsername: auth.admin.username,
          acao: 'clientes.avisos.excluir',
          sucesso: false,
          detalhes: { aviso_id: id, motivo: 'erro_excluir_aviso' },
        });
        return NextResponse.json({ error: 'Erro ao excluir aviso' }, { status: 500 });
      }

      await registrarAuditoriaAdmin({
        actorPeladaId: auth.admin.pelada_id,
        actorUsername: auth.admin.username,
        acao: 'clientes.avisos.excluir',
        sucesso: true,
        detalhes: { aviso_id: id },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    console.error('Erro na API avisos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
