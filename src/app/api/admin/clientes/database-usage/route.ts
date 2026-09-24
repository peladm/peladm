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
    const { pelada_id, username, senha_hash } = body;

    if (!pelada_id || !username || !senha_hash) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    const auth = await validarMaster(pelada_id, username, senha_hash);
    if (!auth.ok) {
      await registrarAuditoriaAdmin({
        actorPeladaId: sanitizeInput(pelada_id, 40).toUpperCase(),
        actorUsername: sanitizeInput(username, 60).toLowerCase(),
        acao: 'clientes.database_usage.auth_falha',
        sucesso: false,
        detalhes: { motivo: auth.error },
      });
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data: totalSizeData, error: totalSizeError } = await supabaseAdmin.rpc('get_database_total_size');
    const { data: tableSizeData, error: tableSizeError } = await supabaseAdmin.rpc('get_tables_size');

    if (totalSizeError && !String(totalSizeError.message || '').includes('does not exist')) {
      throw new Error(`Falha ao consultar tamanho total: ${totalSizeError.message}`);
    }

    if (tableSizeError && !String(tableSizeError.message || '').includes('does not exist')) {
      throw new Error(`Falha ao consultar tamanho por tabela: ${tableSizeError.message}`);
    }

    const totalSizeBytes =
      totalSizeData && totalSizeData.length > 0 ? Number(totalSizeData[0].total_size_bytes) || 0 : 0;

    const totalSizeFormatted =
      totalSizeData && totalSizeData.length > 0
        ? String(totalSizeData[0].total_size_formatted || 'Não configurado')
        : 'Não configurado';

    const tables = Array.isArray(tableSizeData)
      ? tableSizeData.map((table: any) => {
          const totalSize = Number(table.total_size) || 0;
          const rowCount = Number(table.row_count) || 0;
          const tableName = String(table.tablename || '').replace('public.', '');

          const size =
            totalSize > 1024 * 1024
              ? `${(totalSize / (1024 * 1024)).toFixed(2)} MB`
              : totalSize > 1024
                ? `${(totalSize / 1024).toFixed(2)} KB`
                : `${totalSize} bytes`;

          return {
            tablename: tableName,
            size: `${rowCount} reg (${size})`,
            size_bytes: totalSize,
            row_count: rowCount,
          };
        })
      : [];

    await registrarAuditoriaAdmin({
      actorPeladaId: auth.admin.pelada_id,
      actorUsername: auth.admin.username,
      acao: 'clientes.database_usage.consultar',
      sucesso: true,
      detalhes: { tabelas: tables.length, total: totalSizeFormatted },
    });

    const limiteBytes = 500 * 1024 * 1024;
    const percentualUso = limiteBytes > 0 ? Number(((totalSizeBytes / limiteBytes) * 100).toFixed(2)) : 0;

    return NextResponse.json({
      ok: true,
      totalSizeBytes,
      totalSizeFormatted,
      limiteBytes,
      percentualUso,
      tables,
      setupPendente:
        String(totalSizeFormatted).toLowerCase().includes('não configurado') ||
        (tableSizeError && String(tableSizeError.message || '').includes('does not exist')) ||
        (totalSizeError && String(totalSizeError.message || '').includes('does not exist')),
    });
  } catch (error) {
    console.error('Erro na API de consumo do banco:', error);
    return NextResponse.json({ error: 'Erro ao consultar consumo do banco' }, { status: 500 });
  }
}
