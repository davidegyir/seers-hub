import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = body.token;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Missing token' },
        { status: 400 }
      );
    }

    const tokenHash = hashToken(token);

    const tokenRows = await sql`
      SELECT
        id,
        user_id,
        email,
        course_url,
        expires_at,
        used_at
      FROM wp_login_tokens
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `;

    const loginToken = tokenRows[0];

    if (!loginToken) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 404 }
      );
    }

    if (loginToken.used_at) {
      return NextResponse.json(
        { success: false, error: 'Token already used' },
        { status: 410 }
      );
    }

    if (new Date(loginToken.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Token expired' },
        { status: 410 }
      );
    }

    await sql`
      UPDATE wp_login_tokens
      SET used_at = NOW()
      WHERE id = ${loginToken.id}
    `;

    return NextResponse.json({
      success: true,
      email: loginToken.email,
      courseUrl: loginToken.course_url,
    });
  } catch (error) {
    console.error('WP login token verification error:', error);

    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    );
  }
}