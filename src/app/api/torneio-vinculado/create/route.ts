import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Endpoint não implementado ainda.' }, { status: 501 });
}
