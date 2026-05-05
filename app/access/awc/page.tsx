import { auth, currentUser } from '@clerk/nextjs/server';
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

  let userRows = await sql`
    SELECT id, email, full_name, status
    FROM users
    WHERE clerk_user_id = ${userId}
    LIMIT 1
  `;

  let user = userRows[0];

  if (!user) {
    const clerkUser = await currentUser();

    const email =
      clerkUser?.primaryEmailAddress?.emailAddress ||
      clerkUser?.emailAddresses?.[0]?.emailAddress ||
      null;

    const fullName =
      [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') ||
      email ||
      'Seers User';

    if (!email) {
      redirect('/sign-in?redirect_url=/access/awc');
    }

    const insertedRows = await sql`
      INSERT INTO users (
        clerk_user_id,
        email,
        full_name,
        status,
        created_at,
        updated_at
      )
      VALUES (
        ${userId},
        ${email},
        ${fullName},
        'active',
        NOW(),
        NOW()
      )
      RETURNING id, email, full_name, status
    `;

    user = insertedRows[0];
  }

  if (user.status === 'suspended') {
    redirect('/suspended');
  }

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

  redirect('/payments?product=awc');
}