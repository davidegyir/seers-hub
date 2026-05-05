import crypto from 'crypto';
import { sql } from '@/lib/db';

const WP_MASTERCLASS_URL = 'https://www.seersapp.com/academy/awc-level-1/';

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createWordPressLoginLink(params: {
  userId: string;
  email: string;
  courseUrl?: string;
}) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  const courseUrl = params.courseUrl || WP_MASTERCLASS_URL;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await sql`
    INSERT INTO wp_login_tokens (
      user_id,
      email,
      token_hash,
      course_url,
      expires_at
    )
    VALUES (
      ${params.userId},
      ${params.email},
      ${tokenHash},
      ${courseUrl},
      ${expiresAt}
    )
  `;

  return `https://www.seersapp.com/wp-json/seers/v1/magic-login?token=${rawToken}`;
}