import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { createWordPressLoginLink } from '@/lib/wp-login-token';

export const dynamic = 'force-dynamic';

const PRODUCT_KEY = 'awc';
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

  const accessRows = await sql`
    SELECT entitlements.id
    FROM entitlements
    INNER JOIN products ON entitlements.product_id = products.id
    WHERE entitlements.user_id = ${user.id}
      AND products.product_key = ${PRODUCT_KEY}
      AND entitlements.status = 'active'
    LIMIT 1
  `;

  const hasAccess = accessRows.length > 0;

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