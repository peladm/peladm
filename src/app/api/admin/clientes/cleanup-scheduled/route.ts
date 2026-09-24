import { NextRequest, NextResponse } from 'next/server';
import { excluirDadosClientePorPeladaId, registrarAuditoriaAdmin, supabaseAdmin } from '../_utils';

const isAuthorizedCron = (request: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = request.headers.get('authorization') || '';
  return authorization === `Bearer ${secret}`;
};

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorizedCron(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const hoje = new Date().toISOString().split('T')[0];

    const { data: clientes, error } = await supabaseAdmin
      .from('clientes')
      .select('pelada_id, username, data_remocao_programada, is_master')
      .eq('status', 'excluido')
      .lte('data_remocao_programada', hoje);

    if (error) {
      if (String(error.message || '').toLowerCase().includes('data_remocao_programada')) {
        return NextResponse.json({ error: 'Coluna data_remocao_programada ausente no banco. Execute add-exclusao-clientes.sql.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Falha ao consultar exclusões agendadas' }, { status: 500 });
    }

    const clientesElegiveis = (clientes || []).filter((cliente) => cliente.is_master !== true);
    const resultados = [];

    for (const cliente of clientesElegiveis) {
      try {
        const resultado = await excluirDadosClientePorPeladaId(cliente.pelada_id, { removerRegistroCliente: true });
        resultados.push({ pelada_id: cliente.pelada_id, ok: true, resultado });
      } catch (cleanupError) {
        resultados.push({ pelada_id: cliente.pelada_id, ok: false, erro: String(cleanupError) });
      }
    }

    await registrarAuditoriaAdmin({
      actorPeladaId: 'CRON',
      actorUsername: 'cron',
      acao: 'clientes.cleanup_scheduled',
      sucesso: true,
      detalhes: { processados: resultados.length, resultados },
    });

    return NextResponse.json({ ok: true, processados: resultados.length, resultados });
  } catch (error) {
    console.error('Erro no cleanup agendado:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
