import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { createWordPressLoginLink } from '@/lib/wp-login-token';

export const dynamic = 'force-dynamic';

const FEATURE_KEY = 'ai_workshop';
const MASTERCLASS_URL = 'https://www.seersapp.com/academy/awc-level-1/';

export default async function AwcAccessPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in?redirect_url=/access/awc');
  }

  const userRows = await sql`
    SELECT id, email, status
    FROM users
    WHERE clerk_user_id = ${userId}
    LIMIT 1
  `;

  const user = userRows[0];

  if (!user) {
    redirect('/sign-in?redirect_url=/access/awc');
  }

  if (user.status === 'suspended') {
    redirect('/suspended');
  }

  // ✅ CORRECT entitlement check
  const entitlementRows = await sql`
    SELECT id
    FROM entitlements
    WHERE user_id = ${user.id}
      AND feature_key = ${FEATURE_KEY}
      AND granted = true
    LIMIT 1
  `;

  const hasAccess = entitlementRows.length > 0;

  if (hasAccess) {
    const loginLink = await createWordPressLoginLink({
      userId: user.id,
      email: user.email,
      courseUrl: MASTERCLASS_URL,
    });

    redirect(loginLink);
  }

  // Not paid → go to payment
  redirect('/payments?product=awc');
}