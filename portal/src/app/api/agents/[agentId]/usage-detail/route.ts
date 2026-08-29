import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: { agentId: string } }) {
  const gatewayUrl = process.env.OPENX_GATEWAY_URL || process.env.NEXT_PUBLIC_OPENX_GATEWAY_URL;
  if (!gatewayUrl) return NextResponse.json({ ok: false, error: 'telemetry_upstream_unavailable' }, { status: 503 });
  const month = request.nextUrl.searchParams.get('month');
  const query = month && /^\d{4}-\d{2}$/.test(month) ? `?month=${encodeURIComponent(month)}` : '';
  try {
    const upstream = await fetch(`${gatewayUrl.replace(/\/$/, '')}/v1/agents/${encodeURIComponent(params.agentId)}/usage-detail${query}`, {
      headers: { Accept: 'application/json' }, cache: 'no-store',
    });
    const body = await upstream.json();
    return NextResponse.json(body, { status: upstream.status });
  } catch {
    return NextResponse.json({ ok: false, error: 'telemetry_upstream_unavailable' }, { status: 503 });
  }
}
