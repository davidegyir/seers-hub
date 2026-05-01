import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: '/api/ping',
    message: 'API route is working',
  });
}

export async function POST() {
  return NextResponse.json({
    ok: true,
    route: '/api/ping',
    message: 'API POST route is working',
  });
}